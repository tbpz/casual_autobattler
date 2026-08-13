import type { FightConfig } from "../sim/config.js";
import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";

interface HeroSlot {
  slot: HTMLElement;
  body: HTMLElement;
  hpFill: HTMLElement;
  /** Lags behind hpFill via a longer, delayed CSS transition (see
   * .hp-ghost-fill in style.css) — no JS bookkeeping needed. Whenever HP
   * drops fast (a chain, a wind-up slam), the real fill jumps down almost
   * instantly while the ghost catches up half a second later, leaving a
   * visible gap that IS "how much that just took" without the renderer
   * having to track chain start/end or handle mid-chain retargeting itself.
   * Present on both sides — most visible on the enemy during a chain, but
   * equally true (and equally informative) of a player hero eating a
   * wind-up slam. */
  hpGhostFill: HTMLElement;
  hpLabel: HTMLElement;
  counter: HTMLElement;
  status: HTMLElement;
  /** Heat meter fill (2026-08-07 rebuild) — player-side only; built for
   * every slot for simplicity, styled to collapse on the enemy side (see
   * style.css). Filling this IS the anticipation the old pity-gate never
   * gave the player: you watch it approach the threshold instead of being
   * handed the payoff (or not) with no warning. */
  heatFill: HTMLElement;
  /** "NEXT" tag on the CHAIN bar (2026-08-14 chain-legibility pass) — the
   * living, eligible player hero closest to heatThreshold. Answers "who's
   * about to get a shot" before heatFull/ignitionRoll ever fires; suppressed
   * while a chain is already live (see updateSide) since no new candidate
   * can be checked mid-chain. */
  nextTag: HTMLElement;
  /** This hero's stable identity colour — the attribution channel (see the
   * "make attacks and heals attributable" plan). Distinct from the side's
   * blue/red body fill, which stays reserved for the who's-winning read. */
  accent: string;
  /** This hero's position within its side, fixed at build time — used to
   * fan out simultaneous damage popups on a shared target (e.g. all three
   * player heroes hitting the front-most enemy) so overlapping numbers
   * separate instead of stacking at one pixel. */
  offsetIndex: number;
}

/** How long a tracer takes to fly from attacker to target, in ms. Impact
 * (flinch/flash/popup) is scheduled to land at the end of this flight, not
 * at t=0, so the tracer is the thing that establishes "who hit whom" before
 * the damage number appears. Keep in sync with .tracer's transition
 * duration in style.css. */
const TRACER_MS = 200;

/** A heat-gift tracer (2026-08-14 chain-legibility pass) flies slower than a
 * combat tracer and lands on the receiver's CHAIN bar, not its body — ally-
 * to-ally, unhurried, deliberately reading as a different KIND of motion
 * than combat traffic. Keep in sync with .tracer.gift's transition duration
 * in style.css. */
const GIFT_TRACER_MS = 450;

/** Heals share one colour regardless of healer identity — green reads as
 * "restoration" on sight, and a healer's own accent ring already carries
 * their identity once the tracer lands on them. */
const HEAL_ACCENT = "#6ee7a0";

/** The bruiser's wind-up/slam colour (2026-08-07 rebuild) — a distinct
 * danger-red, separate from both the enemy body's own red and the chain's
 * ignite-yellow, so a telegraphed hit reads as its own category of threat. */
const WINDUP_ACCENT = "#ff5252";

/** Six well-separated hues, chosen to stay legible against the panel
 * background and distinct from both the player-blue/enemy-red body fill and
 * the ignite-yellow chain colour. Assigned by a hero's fixed slot index
 * within its side, so the same hero keeps the same colour for the whole
 * fight. */
const ACCENT_PALETTE = ["#ffb454", "#5ad1a0", "#b98cff", "#4dd9e8", "#ff8ac2", "#d9e34d"];

function accentFor(index: number): string {
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length] as string;
}

/**
 * Renders one fight's replay. As of the 2026-08-14 chain-legibility pass,
 * the cascade is attributed at every beat rather than only once it earns its
 * spectacle tell: an ignition beat names who just went hot, a persistent
 * chain HUD tracks the running hit count and damage while a hero is hot, the
 * heat economy (heroes.ts's heatGift) that decides WHO ignites finally
 * renders instead of moving silently, and the arena dims its ambient combat
 * traffic while a chain is live so the moment doesn't have to compete with
 * six bodies swinging at once. See DECISIONS.md and this pass's own root-
 * cause writeup for why: attribution ("who, why, what did it buy the team")
 * was previously carried by nothing but a same-coloured damage number.
 *
 * Everything below that pass — per-hero proportional HP bars, job counters,
 * damage/heal numbers, the "broken" tank tell, and the tiered chain
 * spectacle from the 2026-08-06 legibility pass — is still present here.
 *
 * Pure DOM + CSS, no canvas library. Driven entirely by render/playback.ts's
 * onTick callback; never touches the sim.
 *
 * Hero slots are built lazily from the first snapshot's hero list, sized
 * proportionally to that fight's starting maxHp values (both within a side
 * and between sides), never from a fixed N — attrition can leave a later
 * fight with fewer than cfg.playerN living heroes.
 */
export class FightView {
  private cfg: FightConfig;
  private playerSlots: HTMLElement;
  private enemySlots: HTMLElement;
  private playerHeroes: Map<string, HeroSlot> = new Map();
  private enemyHeroes: Map<string, HeroSlot> = new Map();
  private heroNames: Map<string, string> = new Map();
  private heroRoles: Map<string, string> = new Map();
  /** Fixed for the whole fight (only current hp changes) — captured at
   * build time so a delayed impact (post-tracer-flight) can still scale its
   * flinch/flash by damage-as-a-fraction-of-maxHp. */
  private heroMaxHp: Map<string, number> = new Map();
  private arena: HTMLElement;
  private tracerLayer: HTMLElement;
  private callout: HTMLElement;
  private popupLayer: HTMLElement;
  private resolveOverlay: HTMLElement;
  private clock: HTMLElement;
  /** Persistent "what is happening right now" readout (2026-08-14) — unlike
   * .callout, which pops and fades after ~1.1s, this stays up for the whole
   * duration of a chain and updates every tick, so a glance mid-chain always
   * finds owner/hits/damage rather than only catching the instant a callout
   * happened to fire. */
  private chainHud: HTMLElement;
  private built = false;
  /** The hero currently hot (sim-facing truth, from the snapshot just
   * rendered) — used to attribute a chainHit event's tracer/popup to its
   * source. Independent of visibleChainHeroId, which only gates the glow
   * tell once a chain has earned it; every chain hit is attributable, even
   * a fizzled one below that threshold. */
  private currentHotHeroId: string | null = null;
  /** Cycles a small vertical jitter across popups so near-simultaneous
   * numbers on the same target don't land on the exact same baseline. */
  private popupSeq = 0;

  constructor(container: HTMLElement, cfg: FightConfig) {
    this.cfg = cfg;
    container.innerHTML = "";
    container.classList.add("fight-view");

    this.clock = document.createElement("div");
    this.clock.className = "fight-clock";
    container.appendChild(this.clock);

    this.arena = document.createElement("div");
    this.arena.className = "arena";
    this.playerSlots = document.createElement("div");
    this.playerSlots.className = "side player-side";
    this.enemySlots = document.createElement("div");
    this.enemySlots.className = "side enemy-side";
    this.arena.appendChild(this.playerSlots);
    this.arena.appendChild(this.enemySlots);
    container.appendChild(this.arena);

    this.chainHud = document.createElement("div");
    this.chainHud.className = "chain-hud";
    this.arena.appendChild(this.chainHud);

    this.callout = document.createElement("div");
    this.callout.className = "callout";
    this.arena.appendChild(this.callout);

    this.tracerLayer = document.createElement("div");
    this.tracerLayer.className = "tracer-layer";
    this.arena.appendChild(this.tracerLayer);

    this.popupLayer = document.createElement("div");
    this.popupLayer.className = "popup-layer";
    this.arena.appendChild(this.popupLayer);

    this.resolveOverlay = document.createElement("div");
    this.resolveOverlay.className = "resolve-overlay hidden";
    container.appendChild(this.resolveOverlay);
  }

  render(snapshot: TickSnapshot, eventsThisTick: FightEvent[]): void {
    if (!this.built) {
      this.buildSide(this.playerSlots, this.playerHeroes, snapshot.playerHeroes, "player");
      this.buildSide(this.enemySlots, this.enemyHeroes, snapshot.enemyHeroes, "enemy");
      this.built = true;
    }

    this.clock.textContent =
      snapshot.enrageMultiplier > 1
        ? `t = ${snapshot.t.toFixed(1)}s · ENRAGED ×${snapshot.enrageMultiplier.toFixed(2)}`
        : `t = ${snapshot.t.toFixed(1)}s`;
    this.currentHotHeroId = snapshot.hotHeroId;

    // Ambient dimming (2026-08-14, chain pacing) — while a hero is hot, the
    // arena's own combat traffic (ordinary tracers/popups, non-participant
    // bodies) fades via the .chain-live class in style.css; the chain's own
    // tracers/popups/callout/HUD are excluded from that rule and stay at
    // full strength. Render-only: no timing change, no Playback change.
    this.arena.classList.toggle("chain-live", snapshot.hotHeroId !== null);

    this.updateChainHud(snapshot);
    this.updateSide(this.playerHeroes, snapshot.playerHeroes, snapshot, true);
    this.updateSide(this.enemyHeroes, snapshot.enemyHeroes, snapshot, false);

    for (const e of eventsThisTick) {
      this.handleEvent(e);
    }
  }

  reset(): void {
    this.resolveOverlay.classList.add("hidden");
    this.resolveOverlay.textContent = "";
    this.callout.textContent = "";
    this.callout.classList.remove("show", "muted");
    this.callout.style.color = "";
    this.chainHud.classList.remove("show");
    this.chainHud.textContent = "";
    this.popupLayer.innerHTML = "";
    this.tracerLayer.innerHTML = "";
    this.arena.classList.remove("shake", "chain-live");
    for (const { body, status, nextTag } of [...this.playerHeroes.values(), ...this.enemyHeroes.values()]) {
      body.classList.remove("down", "hot", "igniting", "lunge", "flinch", "healed", "broken", "charging");
      body.querySelectorAll(".impact-flash").forEach((el) => el.remove());
      status.classList.remove("show");
      nextTag.classList.remove("show");
    }
  }

  private buildSide(
    container: HTMLElement,
    map: Map<string, HeroSlot>,
    heroes: HeroSnapshot[],
    side: "player" | "enemy",
  ): void {
    const totalMaxHp = heroes.reduce((sum, h) => sum + h.maxHp, 0) || 1;
    container.style.flexGrow = String(totalMaxHp);
    heroes.forEach((hero, i) => {
      const refs = makeHeroSlot(hero, side, accentFor(i), i);
      refs.slot.style.flex = `${hero.maxHp} 0 0`;
      container.appendChild(refs.slot);
      map.set(hero.id, refs);
      this.heroNames.set(hero.id, hero.name);
      this.heroRoles.set(hero.id, hero.role);
      this.heroMaxHp.set(hero.id, hero.maxHp);
    });
  }

  /** Drives the persistent chain HUD (2026-08-14) purely off the snapshot —
   * owner, hit count, running damage — so it stays correct under
   * pause/step/scrub, same discipline as every other snapshot-driven tell.
   * Deliberately NOT gated by chainTellThreshold: attribution ("who's doing
   * this right now") is the baseline read, not the reward — only the
   * glow/callout spectacle is gated (see updateSide/showChainHit). */
  private updateChainHud(snapshot: TickSnapshot): void {
    if (!snapshot.hotHeroId) {
      this.chainHud.classList.remove("show");
      return;
    }
    const name = this.nameOf(snapshot.hotHeroId);
    const refs = this.slotFor(snapshot.hotHeroId);
    this.chainHud.textContent = `${name} — CHAIN ×${snapshot.visibleChainLength} · ${Math.round(snapshot.chainDamageSoFar)}`;
    this.chainHud.style.color = refs?.accent ?? "var(--ignite)";
    this.chainHud.classList.add("show");
  }

  private updateSide(
    map: Map<string, HeroSlot>,
    heroes: HeroSnapshot[],
    snapshot: TickSnapshot,
    isPlayerSide: boolean,
  ): void {
    // "Who's next" (2026-08-14): the living, eligible player hero closest to
    // heatThreshold — mirrors fight.ts's own candidacy rule (canIgnite
    // excludes a pure healer, same as the sim's ignition-eligibility loop)
    // instead of approximating it from role alone. Suppressed while a chain
    // is already live, since the sim doesn't even check for a new candidate
    // until hotHeroId clears — showing NEXT mid-chain would promise a shot
    // that isn't actually being rolled for yet.
    let nextId: string | null = null;
    if (isPlayerSide && snapshot.hotHeroId === null) {
      let best: HeroSnapshot | undefined;
      for (const h of heroes) {
        if (!h.alive || !h.canIgnite) continue;
        if (!best || h.heat > best.heat) best = h;
      }
      if (best && best.heat > 0) nextId = best.id;
    }

    for (const hero of heroes) {
      const refs = map.get(hero.id);
      if (!refs) continue;
      const fraction = hero.maxHp > 0 ? Math.max(hero.hp, 0) / hero.maxHp : 0;
      refs.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpGhostFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpLabel.textContent = `${Math.round(Math.max(hero.hp, 0))}/${Math.round(hero.maxHp)}`;
      refs.body.classList.toggle("down", !hero.alive);
      // .igniting (attribution, ungated) vs .hot (spectacle, gated at
      // chainTellThreshold — see events.ts's visibleChainHeroId docstring):
      // a hero goes hot at hit 0, but visibleChainHeroId only turns non-null
      // once the chain has earned its glow. Both classes can be present at
      // once; .hot's box-shadow rule is declared after .igniting's in
      // style.css so it wins the moment a chain earns full spectacle.
      refs.body.classList.toggle("igniting", hero.id === snapshot.hotHeroId);
      refs.body.classList.toggle("hot", hero.id === snapshot.visibleChainHeroId);
      refs.body.classList.toggle("broken", hero.role === "tank" && hero.alive && !hero.holding);
      // Wind-up telegraph (2026-08-07): snapshot-driven, like hot/broken
      // above, so it stays correct under pause/step/scrub rather than
      // depending on a timer racing the wall clock.
      refs.body.classList.toggle("charging", hero.alive && hero.id === snapshot.windupTargetId);
      // Heat meter (2026-08-07): the anticipation the old pity-gate never
      // gave the player — you watch this fill toward the threshold instead
      // of the payoff (or not) landing with no warning. Enemies also carry
      // a heat field but it's never read for ignition, so their bar stays
      // empty; CSS collapses it on the enemy side regardless.
      const heatFraction = this.cfg.heatThreshold > 0 ? Math.min(hero.heat / this.cfg.heatThreshold, 1) : 0;
      refs.heatFill.style.width = `${(heatFraction * 100).toFixed(1)}%`;
      refs.nextTag.classList.toggle("show", hero.id === nextId);
      refs.counter.textContent = counterText(hero);
    }
  }

  private handleEvent(e: FightEvent): void {
    switch (e.type) {
      case "attack":
        this.showAttack(e.side, e.attackerId, e.targetId, e.damage);
        break;
      case "heal":
        this.showHeal(e.healerId, e.targetId, e.amount);
        break;
      case "tankBreak":
        this.showTankTransition(e.heroId, "broken", `${this.nameOf(e.heroId)} IS BREAKING`);
        break;
      case "tankRecover":
        this.showTankTransition(e.heroId, "holding", `${this.nameOf(e.heroId)} HOLDS`);
        break;
      case "chainHit":
        this.showChainHit(e.hitIndex, e.damage, e.targetId);
        break;
      case "chainEnd":
        this.showChainEnd(e.heroId, e.chainLength, e.totalDamage, e.killedIds);
        break;
      case "windupStart":
        this.showWindupStart(e.targetId);
        break;
      case "windupHit":
        this.showWindupHit(e.targetId, e.damage);
        break;
      case "enrageStart":
        this.showCallout("ENEMY ENRAGES", true);
        break;
      case "resolve":
        this.showResolve(e.outcome);
        break;
      case "ignitionRoll":
        // 2026-08-14: a FIRED roll now gets its own named beat (showIgnition)
        // instead of relying purely on the chain that follows — attribution
        // shouldn't have to wait for the first bonus hit to land. A FAILED
        // roll (2026-08-08) keeps its quiet, named tell: the heat bar
        // already visibly drains (it's reset to 0 in the sim), but without
        // this a miss and "nothing happened yet" look identical.
        if (e.fired) this.showIgnition(e.heroId);
        else this.showIgnitionMiss(e.heroId);
        break;
      case "heatGift":
        this.showHeatGift(e.fromId, e.toId);
        break;
      // heatFull deliberately has no visual of its own — the heat bar
      // filling already carries the anticipation.
      default:
        break;
    }
  }

  private nameOf(id: string): string {
    return (this.heroNames.get(id) ?? id).toUpperCase();
  }

  private slotFor(id: string): HeroSlot | undefined {
    return this.playerHeroes.get(id) ?? this.enemyHeroes.get(id);
  }

  /** Arena-relative centre point of `el` — the shared basis for tracer
   * endpoints and aimed-lunge direction, so both point at the same spot. */
  private centerOf(el: HTMLElement): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    const arenaRect = this.arena.getBoundingClientRect();
    return { x: rect.left - arenaRect.left + rect.width / 2, y: rect.top - arenaRect.top + rect.height / 2 };
  }

  /** Points `body`'s existing lunge animation at `target` instead of a fixed
   * per-side direction, so the attacker's own motion carries "who I'm
   * swinging at" even if the tracer is missed. */
  private lungeToward(body: HTMLElement, target: HTMLElement, maxDist: number): void {
    const a = this.centerOf(body);
    const b = this.centerOf(target);
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    body.style.setProperty("--lunge-x", `${(((b.x - a.x) / dist) * maxDist).toFixed(1)}px`);
    body.style.setProperty("--lunge-y", `${(((b.y - a.y) / dist) * maxDist).toFixed(1)}px`);
    pulseClass(body, "lunge", 250);
  }

  /** The core attribution device: a small dot that visibly travels from
   * `from` to `to` over `durationMs`, coloured by the source's identity.
   * Motion along a path reads as "A did something to B" without requiring
   * the viewer to correlate two separate, unlinked animations. `extraClass`
   * (2026-08-14) lets a gift tracer opt into a slower, distinctly-styled
   * flight (see .tracer.gift in style.css) and skip the ambient dim rule
   * that fades ordinary combat tracers while a chain is live. */
  private fireTracer(
    from: HTMLElement,
    to: HTMLElement,
    color: string,
    size = 6,
    extraClass?: string,
    durationMs = TRACER_MS,
  ): void {
    const start = this.centerOf(from);
    const end = this.centerOf(to);
    const el = document.createElement("div");
    el.className = extraClass ? `tracer ${extraClass}` : "tracer ambient";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.marginLeft = `${-size / 2}px`;
    el.style.marginTop = `${-size / 2}px`;
    el.style.left = `${start.x}px`;
    el.style.top = `${start.y}px`;
    el.style.background = color;
    el.style.boxShadow = `0 0 6px 1px ${color}`;
    this.tracerLayer.appendChild(el);
    void el.offsetWidth;
    el.style.transform = `translate(${(end.x - start.x).toFixed(1)}px, ${(end.y - start.y).toFixed(1)}px)`;
    setTimeout(() => el.remove(), durationMs + 60);
  }

  /** An independent, additively-stacking flash on the target's own body —
   * separate DOM nodes rather than a shared toggled class, so a hero hit
   * twice inside one impact window shows two flashes instead of one being
   * cancelled by the other's reset. Sized by damage as a fraction of the
   * target's maxHp so a heavy hit visibly reads heavier than a graze. */
  private showImpactFlash(body: HTMLElement, frac: number): void {
    const flash = document.createElement("div");
    flash.className = "impact-flash";
    flash.style.setProperty("--flash-opacity", (0.35 + frac * 0.55).toFixed(2));
    body.appendChild(flash);
    setTimeout(() => flash.remove(), 380);
  }

  private showAttack(side: "player" | "enemy", attackerId: string, targetId: string, damage: number): void {
    const attackerMap = side === "player" ? this.playerHeroes : this.enemyHeroes;
    const defenderMap = side === "player" ? this.enemyHeroes : this.playerHeroes;
    const attacker = attackerMap.get(attackerId);
    const target = defenderMap.get(targetId);
    if (!attacker || !target) return;

    this.lungeToward(attacker.body, target.body, 14);
    this.fireTracer(attacker.body, target.body, attacker.accent);

    // Fan simultaneous popups out horizontally by the attacker's fixed slot
    // index — e.g. every player hero targets the front-most enemy (see
    // sim/fight.ts's front-most targeting rule), so without this all three
    // damage numbers would land at the exact same pixel.
    const offsetX = (attacker.offsetIndex - 1) * 12;
    const maxHp = this.heroMaxHp.get(targetId) ?? 1;
    const frac = Math.max(0.15, Math.min(1, damage / maxHp));

    // Impact lands when the tracer arrives, not at t=0 — the flight itself
    // is a second attribution cue ("that one is heading for Cairn").
    setTimeout(() => {
      target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
      pulseClass(target.body, "flinch", 300);
      this.showImpactFlash(target.body, frac);
      this.showPopup(target.body, `-${damage}`, "normal", 1, 0, attacker.accent, offsetX);
    }, TRACER_MS);
  }

  private showHeal(healerId: string, targetId: string, amount: number): void {
    const healer = this.slotFor(healerId);
    const target = this.slotFor(targetId);
    if (!target) return;

    if (healer) {
      this.lungeToward(healer.body, target.body, 10);
      this.fireTracer(healer.body, target.body, HEAL_ACCENT);
    }

    const land = () => {
      pulseClass(target.body, "healed", 500);
      this.showPopup(target.body, `+${amount}`, "heal", 1, 0, HEAL_ACCENT);
    };
    if (healer) setTimeout(land, TRACER_MS);
    else land();
  }

  /** The shared quiet-register tell: text on a named hero's own status line
   * (not the shared arena callout, which is reserved for the chain
   * spectacle), so events common enough to be normal beats — a tank
   * breaking, an ignition miss, a fizzled chain — never overwrite or get
   * overwritten by the rare payoff. No shake, no fanfare, by design. */
  private showHeroStatusTell(heroId: string, text: string): void {
    const refs = this.slotFor(heroId);
    if (!refs) return;
    refs.status.textContent = text;
    refs.status.classList.remove("show");
    void refs.status.offsetWidth;
    refs.status.classList.add("show");
  }

  /** A tank's line breaking or recovering. */
  private showTankTransition(heroId: string, cls: "broken" | "holding", text: string): void {
    this.showHeroStatusTell(heroId, text);
    const refs = this.slotFor(heroId);
    if (refs) {
      if (cls === "broken") refs.body.classList.add("broken");
      else refs.body.classList.remove("broken");
    }
  }

  /** A named hero's ignition roll missed (2026-08-08) — the roll's odds
   * start at 20%, common enough to be a normal beat, not the rare payoff. */
  private showIgnitionMiss(heroId: string): void {
    this.showHeroStatusTell(heroId, "not yet");
  }

  /** A named hero's ignition roll FIRED (2026-08-14) — previously silent by
   * design ("the chain itself carries it"), but that meant the instant a
   * hero went hot, nothing happened on screen: the glow was gated behind
   * chainTellThreshold and the first bonus-hit tracer was indistinguishable
   * from an ordinary attack. This is the loud, named beat that establishes
   * "it's THIS hero, starting NOW" before a single bonus hit has landed. */
  private showIgnition(heroId: string): void {
    const refs = this.slotFor(heroId);
    if (!refs) return;
    this.showCallout(`${this.nameOf(heroId)} IGNITES`, false, refs.accent);
    pulseClass(refs.body, "ignite-burst", 500);
  }

  /** Heat flowing from one ally to another via heroes.ts's heatGift
   * (2026-08-14) — previously invisible: applyHeatGift moved the receiver's
   * meter with zero render-facing trace, so "who ignites can vary fight to
   * fight" read as pure randomness rather than a mechanism the player could
   * come to recognise. A slow tracer (GIFT_TRACER_MS, well past a combat
   * tracer's TRACER_MS) flies ally-to-body, landing on the receiver's own
   * CHAIN bar rather than its body, so it reads as "heat moving into that
   * meter" and not as a second kind of attack. Already throttled at the sim
   * level (fight.ts's heatGiftAccumFor) to one tell per meaningful slice of
   * a bar, not one per underlying hit. */
  private showHeatGift(fromId: string, toId: string): void {
    const from = this.slotFor(fromId);
    const to = this.slotFor(toId);
    if (!from || !to) return;
    this.fireTracer(from.body, to.heatFill, "var(--ignite)", 4, "gift", GIFT_TRACER_MS);
    setTimeout(() => pulseClass(to.heatFill, "gift-pulse", 400), GIFT_TRACER_MS);
  }

  /** The wind-up resolves — a heavier version of a normal attack: bigger
   * flash, its own damage-popup colour (WINDUP_ACCENT) distinct from both a
   * normal hit and the chain's ignite-yellow, and a loud (non-muted)
   * callout, since this is the beat that's supposed to make fragility
   * actually threatening rather than routine. */
  private showWindupStart(targetId: string | null): void {
    const name = targetId ? this.nameOf(targetId) : "someone";
    this.showCallout(`BRUISER TARGETS ${name}`, true);
  }

  private showWindupHit(targetId: string, damage: number): void {
    const target = this.playerHeroes.get(targetId);
    if (!target) return;

    const maxHp = this.heroMaxHp.get(targetId) ?? 1;
    const frac = Math.max(0.3, Math.min(1, damage / maxHp));
    target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
    pulseClass(target.body, "flinch", 300);
    this.showImpactFlash(target.body, frac);
    this.showPopup(target.body, `-${damage}`, "windup", 1 + frac, 0, WINDUP_ACCENT);
    this.showCallout("SLAM", false);
  }

  /** Tiered per DECISIONS.md's 2026-08-06 "spectacle gated on payoff" entry:
   * a length-1 chain hit gets a bigger damage number and nothing else; at
   * chainTellThreshold the hero starts glowing with a small callout; at
   * chainFullTellThreshold the full show (shake, escalating font, loud
   * callout) fires. Every chain hit is now also a tracer from the hot hero
   * to its target, so the source reads even on a fizzled, sub-threshold
   * chain — attribution and spectacle are gated independently.
   *
   * 2026-08-14: the callout now names its owner and renders in that hero's
   * accent instead of a bare, anonymous "CHAIN x3" in the shared ignite
   * colour — the loudest beat in the fight used to carry the LEAST identity
   * of anything on screen. The damage popup keeps the tier-escalating
   * ignite/orange colour (still the size/magnitude channel) and adds the
   * owner's accent as a border rather than overriding it — both channels on
   * one number instead of one or the other. */
  private showChainHit(hitIndex: number, damage: number, targetId: string): void {
    const target = this.enemyHeroes.get(targetId);
    const attacker = this.currentHotHeroId ? this.playerHeroes.get(this.currentHotHeroId) : undefined;
    const scale = Math.min(1 + hitIndex * 0.25, 3);

    if (attacker && target) {
      this.lungeToward(attacker.body, target.body, 14);
      this.fireTracer(attacker.body, target.body, attacker.accent, 8, "chain-tracer");
    }

    const land = () => {
      if (target) {
        const maxHp = this.heroMaxHp.get(targetId) ?? 1;
        const frac = Math.max(0.15, Math.min(1, damage / maxHp));
        target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
        pulseClass(target.body, "flinch", 300);
        this.showImpactFlash(target.body, frac);
        const popup = this.showPopup(target.body, `-${damage}`, "chain", scale, Math.min(hitIndex, 5));
        if (attacker && popup) popup.style.setProperty("--owner-accent", attacker.accent);
      }
      const ownerName = this.currentHotHeroId ? this.nameOf(this.currentHotHeroId) : "";
      if (hitIndex >= this.cfg.chainFullTellThreshold) {
        this.arena.classList.remove("shake");
        void this.arena.offsetWidth;
        this.arena.classList.add("shake");
        this.showCallout(`${ownerName} · CHAIN ×${hitIndex}`, false, attacker?.accent);
      } else if (hitIndex >= this.cfg.chainTellThreshold) {
        this.showCallout(`${ownerName} · CHAIN ×${hitIndex}`, true, attacker?.accent);
      }
    };
    if (attacker && target) setTimeout(land, TRACER_MS);
    else land();
  }

  /** The chain's payoff summary (2026-08-14) — previously chainEnd was
   * dropped on the floor entirely (no case in this switch), so a cascade
   * simply stopped with no beat answering "what did that just buy the
   * team." Quiet for a fizzle (below chainFullTellThreshold, same register
   * as a tank transition or an ignition miss); loud with a kill line for a
   * real payoff. Uses the event's own heroId/totalDamage/killedIds rather
   * than this.currentHotHeroId, which the snapshot has usually already
   * cleared by the time this event is processed (hotHeroId nulls out in the
   * SAME tick a fizzle is detected — see fight.ts). */
  private showChainEnd(heroId: string, chainLength: number, totalDamage: number, killedIds: string[]): void {
    if (chainLength === 0) return; // ignited but never landed a single bonus hit — nothing to summarize
    const refs = this.slotFor(heroId);
    const name = this.nameOf(heroId);
    const killNote = killedIds.length > 0 ? ` — ${killedIds.map((id) => this.nameOf(id)).join(", ")} DOWN` : "";
    if (chainLength >= this.cfg.chainFullTellThreshold) {
      this.showCallout(`${name}'S CHAIN — ${chainLength} HITS, ${Math.round(totalDamage)}${killNote}`, false, refs?.accent);
    } else {
      this.showHeroStatusTell(heroId, `chain ×${chainLength}, ${Math.round(totalDamage)}${killNote}`);
    }
  }

  private showCallout(text: string, muted: boolean, color?: string): void {
    this.callout.textContent = text;
    this.callout.classList.remove("show", "muted");
    this.callout.style.color = color ?? "";
    void this.callout.offsetWidth;
    this.callout.classList.add("show");
    if (muted) this.callout.classList.add("muted");
  }

  private showPopup(
    target: HTMLElement,
    text: string,
    tier: "normal" | "heal" | "chain" | "windup",
    scale = 1,
    tierNum = 0,
    color?: string,
    offsetX = 0,
  ): HTMLElement {
    const popup = document.createElement("div");
    popup.className = `damage-popup ${tier}`;
    popup.style.fontSize = `${scale}em`;
    popup.textContent = text;
    popup.dataset.tier = String(tierNum);
    if (color) popup.style.color = color;

    const rect = target.getBoundingClientRect();
    const arenaRect = this.arena.getBoundingClientRect();
    const jitterY = (this.popupSeq++ % 3) * 6;
    popup.style.left = `${rect.left - arenaRect.left + rect.width / 2 + offsetX}px`;
    popup.style.top = `${rect.top - arenaRect.top - jitterY}px`;

    this.popupLayer.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
    return popup;
  }

  private showResolve(outcome: "win" | "loss"): void {
    this.resolveOverlay.textContent = outcome === "win" ? "VICTORY" : "DEFEAT";
    this.resolveOverlay.className = `resolve-overlay show ${outcome}`;
    for (const { body } of this.playerHeroes.values()) {
      body.classList.remove("hot", "igniting");
    }
  }
}

/** Job counter text per role — the readout the player's squad plan is
 * checked against. Enemies (no role-specific job) show dealt. */
function counterText(hero: HeroSnapshot): string {
  if (hero.role === "support") return `restored ${Math.round(hero.restored)}`;
  if (hero.role === "tank") return `soaked ${Math.round(hero.soaked)}`;
  return `dealt ${Math.round(hero.dealt)}`;
}

function makeHeroSlot(hero: HeroSnapshot, side: "player" | "enemy", accent: string, offsetIndex: number): HeroSlot {
  const slot = document.createElement("div");
  slot.className = "hero-slot";

  const body = document.createElement("div");
  body.className = `body ${side}-body role-${hero.role}`;
  body.dataset.id = hero.id;
  body.style.setProperty("--accent", accent);

  const status = document.createElement("div");
  status.className = "hero-status";
  slot.appendChild(status);

  const name = document.createElement("div");
  name.className = "body-name";
  name.textContent = hero.name;
  name.style.color = accent;

  const hpTrack = document.createElement("div");
  hpTrack.className = "hp-track";
  // Ghost fill appended FIRST so the (narrower, opaque) real fill paints
  // over it in normal stacking order — the visible gap between the two IS
  // "how much just got taken" (see HeroSlot's hpGhostFill docstring).
  const hpGhostFill = document.createElement("div");
  hpGhostFill.className = "hp-ghost-fill";
  hpTrack.appendChild(hpGhostFill);
  const hpFill = document.createElement("div");
  hpFill.className = "hp-fill";
  hpTrack.appendChild(hpFill);

  const hpLabel = document.createElement("div");
  hpLabel.className = "hp-label";

  const counter = document.createElement("div");
  counter.className = "job-counter";

  // Heat meter (2026-08-07 rebuild) — built for every slot for simplicity;
  // style.css collapses it on the enemy side, since only the player's heat
  // ever drives ignition. Labelled CHAIN as of 2026-08-08 (see style.css) —
  // the word "heat" never appeared anywhere the player could see it before.
  const heatRow = document.createElement("div");
  heatRow.className = "heat-row";
  const heatLabel = document.createElement("span");
  heatLabel.className = "heat-label";
  heatLabel.textContent = "CHAIN";
  const nextTag = document.createElement("span");
  nextTag.className = "next-tag";
  nextTag.textContent = "NEXT";
  const heatTrack = document.createElement("div");
  heatTrack.className = "heat-track";
  const heatFill = document.createElement("div");
  heatFill.className = "heat-fill";
  heatTrack.appendChild(heatFill);
  heatRow.appendChild(heatLabel);
  heatRow.appendChild(nextTag);
  heatRow.appendChild(heatTrack);

  slot.appendChild(body);
  slot.appendChild(name);
  slot.appendChild(hpTrack);
  slot.appendChild(hpLabel);
  slot.appendChild(heatRow);
  slot.appendChild(counter);

  return { slot, body, hpFill, hpGhostFill, hpLabel, heatFill, nextTag, counter, status, accent, offsetIndex };
}

/** Adds `className` to `el`, then removes it after `ms` — restarting the
 * animation if it's re-triggered before the previous run finished. */
function pulseClass(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}
