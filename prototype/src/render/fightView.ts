import type { FightConfig } from "../sim/config.js";
import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";
import { MAX_CHAIN_AFFINITY, MIN_CHAIN_AFFINITY } from "../sim/heroes.js";

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
  /** The charge (CHAIN) bar fill — player-side only; built for every slot
   * for simplicity, styled to collapse on the enemy side (see style.css).
   * Persists and reads like an HP bar: it carries across fights (2026-08-14
   * chain rebuild — see sim/types.ts's HeroState.charge), so a near-full bar
   * is real information at field-pick time, not just mid-fight suspense.
   * A direct slot child (like hpFill), not wrapped in its own row, so its
   * width:100% resolves against the slot rather than shrink-wrapping around
   * a label — see 2026-08-15 chain-bar-visibility fix. */
  chargeFill: HTMLElement;
  /** Lags behind chargeFill via a longer, delayed CSS transition — same
   * device as hpGhostFill above. The one moment this matters is the chain
   * FIRING: chargeFill snaps to 0 instantly while the ghost drains behind
   * it, so the reset reads as a visible drain rather than a silent jump. */
  chargeGhostFill: HTMLElement;
  /** The CHAIN bar's own readout line, under the track — same role as
   * hpLabel above ("132/220" vs. "75/195"). */
  chargeLabel: HTMLElement;
  /** The last fraction actually rendered into chargeFill's width, so
   * updateSide can tell a rise (creep, via --charge-rise) from a fire-reset
   * (must stay instant) without reading any chain-specific snapshot flag —
   * see the .charge-fill.instant device in style.css. */
  lastChargeFraction: number;
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
 * Renders one fight's replay. As of the 2026-08-14 chain rebuild (see
 * DECISIONS.md), the CHAIN bar reads like an HP bar — it fills gradually,
 * carries across fights, and there is no more hidden candidate contest: the
 * hero whose bar fills simply fires. What the player can't predict is which
 * WAY it fires — chainStart decides good vs. backfire once, at the moment of
 * firing, and every beat after that (the hot hero's glow colour, every
 * chainHit tracer/popup, the chain HUD, the payoff callout) reads that same
 * flag so gold-burst-vs-red-implosion is legible instantly, with zero
 * advance telegraph. A backfire repeats the hero's own action at the WRONG
 * side — an attacker hits its own team, a healer heals the enemy — rather
 * than doing something different, so the reversed tracer direction alone
 * carries most of the read.
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
  /** Fixed for the whole fight, same as heroMaxHp above — what
   * showChainStart reads to scale an ignition's tell to that hero's own
   * expected magnitude (2026-08-15, chain-payoff-axis pass). Enemies are
   * inert (1) and never chain, so this is only meaningful on the player
   * side, but is populated for both for simplicity. */
  private heroChainAffinity: Map<string, number> = new Map();
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
  /** Cycles a small vertical jitter across popups so near-simultaneous
   * numbers on the same target don't land on the exact same baseline. */
  private popupSeq = 0;
  /** Player-side HP fraction as of the last tick rendered — the margin
   * signal showResolve tiers a win by (2026-08-15). Updated every render()
   * call rather than read off the resolve event itself, since `resolve`
   * only carries outcome/reason (sim/events.ts), not a margin. */
  private lastPlayerHpFraction = 1;
  /** The most recent tick's player hero snapshots — what showResolve's
   * near-miss check reads to find whoever ended closest to a chain without
   * firing one (2026-08-15). */
  private lastPlayerHeroes: HeroSnapshot[] = [];
  /** True once any chain has fired this fight (2026-08-15) — gates the
   * near-miss beat so it never competes with a chain that actually landed;
   * "so close" only means something when nothing else already happened. */
  private anyChainFiredThisFight = false;

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

    // Ambient dimming (2026-08-14, chain pacing) — while a hero is hot, the
    // arena's own combat traffic (ordinary tracers/popups, non-participant
    // bodies) fades via the .chain-live class in style.css; the chain's own
    // tracers/popups/callout/HUD are excluded from that rule and stay at
    // full strength. .chain-backfire additionally tints that dim red so a
    // backfire reads as dangerous even in peripheral vision, not just at the
    // hot hero's own body. Render-only: no timing change, no Playback change.
    this.arena.classList.toggle("chain-live", snapshot.hotHeroId !== null);
    this.arena.classList.toggle("chain-backfire", snapshot.hotHeroId !== null && snapshot.chainBackfire);

    this.updateChainHud(snapshot);
    this.updateSide(this.playerHeroes, snapshot.playerHeroes, snapshot);
    this.updateSide(this.enemyHeroes, snapshot.enemyHeroes, snapshot);

    this.lastPlayerHpFraction = snapshot.playerMaxHp > 0 ? snapshot.playerHp / snapshot.playerMaxHp : 0;
    this.lastPlayerHeroes = snapshot.playerHeroes;

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
    this.arena.classList.remove("shake", "chain-live", "chain-backfire");
    this.lastPlayerHpFraction = 1;
    this.lastPlayerHeroes = [];
    this.anyChainFiredThisFight = false;
    for (const refs of [...this.playerHeroes.values(), ...this.enemyHeroes.values()]) {
      refs.body.classList.remove("down", "hot", "lunge", "flinch", "healed", "broken", "charging");
      refs.body.querySelectorAll(".impact-flash").forEach((el) => el.remove());
      refs.status.classList.remove("show");
      // Drop back to 0 without animating the sweep — a restart isn't a fire,
      // so it must skip --charge-rise entirely, not play it backwards.
      refs.chargeFill.classList.add("instant");
      refs.chargeFill.style.width = "0%";
      refs.chargeGhostFill.style.width = "0%";
      refs.lastChargeFraction = 0;
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
      this.heroChainAffinity.set(hero.id, hero.chainAffinity);
    });
  }

  /** Drives the persistent chain HUD purely off the snapshot — owner, hit
   * count, running total — so it stays correct under pause/step/scrub, same
   * discipline as every other snapshot-driven tell. Backfire flips both the
   * label and the colour so a glance mid-chain reads "is this working"
   * without waiting for the next chainHit event. */
  private updateChainHud(snapshot: TickSnapshot): void {
    if (!snapshot.hotHeroId) {
      this.chainHud.classList.remove("show");
      return;
    }
    const name = this.nameOf(snapshot.hotHeroId);
    const refs = this.slotFor(snapshot.hotHeroId);
    const label = snapshot.chainBackfire ? "BACKFIRE" : "CHAIN";
    this.chainHud.textContent = `${name} — ${label} ×${snapshot.visibleChainLength} · ${Math.round(snapshot.chainDamageSoFar)}`;
    this.chainHud.style.color = snapshot.chainBackfire ? "var(--backfire)" : (refs?.accent ?? "var(--ignite)");
    this.chainHud.classList.add("show");
  }

  private updateSide(map: Map<string, HeroSlot>, heroes: HeroSnapshot[], snapshot: TickSnapshot): void {
    for (const hero of heroes) {
      const refs = map.get(hero.id);
      if (!refs) continue;
      const fraction = hero.maxHp > 0 ? Math.max(hero.hp, 0) / hero.maxHp : 0;
      refs.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpGhostFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpLabel.textContent = `${Math.round(Math.max(hero.hp, 0))}/${Math.round(hero.maxHp)}`;
      refs.body.classList.toggle("down", !hero.alive);
      // .hot (2026-08-14 chain rebuild): a single, immediate glow — there is
      // no more "earn the glow" delay. Its colour is driven by --chain-color
      // (set below), gold for a real chain, red for a backfire, so the
      // WHICH-WAY read is instant, not just the fact that someone's hot.
      const isHot = hero.id === snapshot.hotHeroId;
      refs.body.classList.toggle("hot", isHot);
      refs.body.style.setProperty("--chain-color", isHot && snapshot.chainBackfire ? "var(--backfire)" : refs.accent);
      refs.body.classList.toggle("broken", hero.role === "tank" && hero.alive && !hero.holding);
      // Wind-up telegraph (2026-08-07): snapshot-driven, like hot/broken
      // above, so it stays correct under pause/step/scrub rather than
      // depending on a timer racing the wall clock.
      refs.body.classList.toggle("charging", hero.alive && hero.id === snapshot.windupTargetId);
      // Charge (CHAIN) bar (2026-08-14 chain rebuild) — reads like an HP bar
      // and persists across fights (see sim/types.ts's HeroState.charge).
      // Enemies also carry a charge field but it's never read for firing, so
      // their bar stays empty; CSS collapses it on the enemy side regardless.
      const chargeFraction = this.cfg.chargeThreshold > 0 ? Math.min(hero.charge / this.cfg.chargeThreshold, 1) : 0;
      // 2026-08-15 chain-bar-visibility fix: a rise should CREEP (see
      // --charge-rise in style.css) but a fire-reset must stay instant, same
      // as HP's own ghost-gap device. Comparing against the last value we
      // actually rendered (rather than snapshot.hotHeroId) means this also
      // does the right thing on restart()/scrub-backwards for free.
      refs.chargeFill.classList.toggle("instant", chargeFraction < refs.lastChargeFraction);
      refs.chargeFill.style.width = `${(chargeFraction * 100).toFixed(1)}%`;
      refs.chargeGhostFill.style.width = `${(chargeFraction * 100).toFixed(1)}%`;
      refs.lastChargeFraction = chargeFraction;
      refs.chargeLabel.textContent = `CHAIN ${Math.round(hero.charge)}/${Math.round(this.cfg.chargeThreshold)}`;
      // Near-full pulse (2026-08-14) — the dread beat: the player feels the
      // bar closing in on firing without knowing which way it'll go.
      refs.chargeFill.classList.toggle("near-full", chargeFraction >= 0.85 && chargeFraction < 1);
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
      case "chainStart":
        this.showChainStart(e.heroId, e.backfire);
        break;
      case "chainHit":
        this.showChainHit(e.hitIndex, e.damage, e.targetId, e.kind, e.backfire, e.sourceId);
        break;
      case "chainEnd":
        this.showChainEnd(e.heroId, e.chainLength, e.totalDamage, e.killedIds, e.backfire);
        break;
      case "heroDown":
        this.showHeroDown(e.heroId);
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

  /** A hero's death — the moment, not just the ongoing `.down` dim that
   * updateSide applies every tick once !alive (2026-08-15). In a game whose
   * whole stake is permanent death, a death that produces no callout reads
   * as if it didn't matter. Deliberately quieter than a chain payoff (muted
   * callout, no shake) but louder than a tank-break status line (the shared
   * arena callout, not just that hero's own row) — a death is common enough
   * to need its own register, distinct from both. */
  private showHeroDown(heroId: string): void {
    const refs = this.slotFor(heroId);
    const name = this.nameOf(heroId);
    this.showCallout(`${name} FALLS`, true, "var(--muted)");
    if (refs) {
      refs.body.style.setProperty("--flinch-scale", "1");
      pulseClass(refs.body, "flinch", 300);
      this.showImpactFlash(refs.body, 1);
    }
  }

  /** A named hero's bar fills and fires (2026-08-14 chain rebuild) — the
   * loud, named beat that establishes "it's THIS hero, starting NOW, and
   * it's going THIS way" before a single bonus hit has landed. No advance
   * telegraph exists before this moment (see config.ts's backfireChance
   * docstring) — this callout and burst ARE the reveal.
   *
   * 2026-08-15 (chain-payoff-axis pass): the burst ring's own size now
   * scales to this hero's chainAffinity, normalized against the pool's
   * range (--ignite-scale, read by style.css's igniteBurst/backfireBurst
   * keyframes) — a low-affinity ignition is a visibly smaller tell than
   * Rook's, so the callout stops over-promising for the heroes whose
   * chains used to be a dud. Never scales below 0.6 — every ignition is
   * still a real tell, per the same "nothing goes silent" rule the hit-by-
   * hit spectacle ladder follows (see showChainHit). */
  private showChainStart(heroId: string, backfire: boolean): void {
    this.anyChainFiredThisFight = true;
    const refs = this.slotFor(heroId);
    if (!refs) return;
    const label = backfire ? "BACKFIRES" : "IGNITES";
    this.showCallout(`${this.nameOf(heroId)} ${label}`, false, backfire ? "var(--backfire)" : refs.accent);
    const affinity = this.heroChainAffinity.get(heroId) ?? MAX_CHAIN_AFFINITY;
    const range = MAX_CHAIN_AFFINITY - MIN_CHAIN_AFFINITY || 1;
    const igniteScale = 0.6 + 0.4 * ((affinity - MIN_CHAIN_AFFINITY) / range);
    refs.body.style.setProperty("--ignite-scale", igniteScale.toFixed(2));
    pulseClass(refs.body, backfire ? "backfire-burst" : "ignite-burst", 500);
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

  /** Tiered per DECISIONS.md's 2026-08-06 "spectacle gated on payoff" entry
   * for callout LOUDNESS only — a length-1 hit gets a bigger number and
   * nothing else; at chainTellThreshold a quiet callout joins it; at
   * chainFullTellThreshold the full show (shake, escalating font, loud
   * callout) fires. Attribution and direction are NOT gated (2026-08-14
   * chain rebuild) — `sourceId`/`kind`/`backfire` ride the event itself,
   * so even a length-1 hit reads who did it and which way immediately.
   *
   * `kind`/`backfire` together decide who actually gets hit: an attacker's
   * good hit lands on the enemy, its backfire lands on an ally; a healer's
   * good hit lands on the lowest-HP ally, its backfire lands on the enemy
   * (targetId is already resolved to the right side by fight.ts's
   * resolveChainHit — this only has to pick which MAP to look the id up in). */
  private showChainHit(
    hitIndex: number,
    amount: number,
    targetId: string,
    kind: "damage" | "heal",
    backfire: boolean,
    sourceId: string,
  ): void {
    const targetIsEnemy = (kind === "damage") !== backfire;
    const targetMap = targetIsEnemy ? this.enemyHeroes : this.playerHeroes;
    const attacker = this.playerHeroes.get(sourceId);
    const target = targetMap.get(targetId);
    const scale = chainPopupScale(hitIndex, this.cfg.chainFullTellThreshold);
    const chainColor = backfire ? "var(--backfire)" : kind === "heal" ? HEAL_ACCENT : (attacker?.accent ?? "var(--ignite)");

    if (attacker && target) {
      this.lungeToward(attacker.body, target.body, 14);
      this.fireTracer(attacker.body, target.body, chainColor, 8, "chain-tracer");
    }

    const land = () => {
      if (target) {
        const maxHp = this.heroMaxHp.get(targetId) ?? 1;
        const frac = Math.max(0.15, Math.min(1, amount / maxHp));
        if (kind === "heal") {
          pulseClass(target.body, "healed", 500);
        } else {
          target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
          pulseClass(target.body, "flinch", 300);
          this.showImpactFlash(target.body, frac);
        }
        const sign = kind === "heal" ? "+" : "-";
        const popupColor = kind === "heal" || backfire ? chainColor : undefined;
        const popup = this.showPopup(target.body, `${sign}${Math.round(amount)}`, "chain", scale, Math.min(hitIndex, 5), popupColor);
        if (attacker && popup) popup.style.setProperty("--owner-accent", chainColor);
      }
      const ownerName = this.nameOf(sourceId);
      const label = backfire ? "BACKFIRE" : "CHAIN";
      if (hitIndex >= this.cfg.chainFullTellThreshold) {
        this.arena.classList.remove("shake");
        void this.arena.offsetWidth;
        this.arena.classList.add("shake");
        this.showCallout(`${ownerName} · ${label} ×${hitIndex}`, false, chainColor);
      } else if (hitIndex >= this.cfg.chainTellThreshold) {
        this.showCallout(`${ownerName} · ${label} ×${hitIndex}`, true, chainColor);
      }
    };
    if (attacker && target) setTimeout(land, TRACER_MS);
    else land();
  }

  /** The chain's payoff summary. Quiet for a fizzle (below
   * chainFullTellThreshold, same register as a tank transition); loud with a
   * kill line for a real payoff. `backfire` flips both the label
   * (CHAIN/BACKFIRE) and the colour so the summary reads consistently with
   * every beat that led up to it. */
  private showChainEnd(heroId: string, chainLength: number, totalDamage: number, killedIds: string[], backfire: boolean): void {
    if (chainLength === 0) return; // fired but never landed a single bonus hit — nothing to summarize
    const refs = this.slotFor(heroId);
    const name = this.nameOf(heroId);
    const label = backfire ? "BACKFIRE" : "CHAIN";
    const color = backfire ? "var(--backfire)" : refs?.accent;
    const killNote = killedIds.length > 0 ? ` — ${killedIds.map((id) => this.nameOf(id)).join(", ")} DOWN` : "";
    if (chainLength >= this.cfg.chainFullTellThreshold) {
      this.showCallout(`${name}'S ${label} — ${chainLength} HITS, ${Math.round(totalDamage)}${killNote}`, false, color);
    } else {
      this.showHeroStatusTell(heroId, `${label.toLowerCase()} ×${chainLength}, ${Math.round(totalDamage)}${killNote}`);
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

  /** Tiers a WIN by remaining player HP fraction as of the final tick
   * (2026-08-15) — "flawless" and "narrow" are both real information: a win
   * that cost nothing and a win that nearly wasn't are different outcomes,
   * and the old binary overlay showed them identically. A loss stays
   * untiered — the runOverScreen recap (runScreens.ts) is where a lost
   * fight gets its account, not this overlay. Also fires the near-miss beat
   * (a hero who ended charged but never fired) into the same overlay via a
   * `.margin-note` line, since the fight is definitively over at this point
   * and nothing later in the fight view will show it. */
  private showResolve(outcome: "win" | "loss"): void {
    const tier = outcome === "win" ? this.winMarginTier() : null;
    const label = tier === "flawless" ? "FLAWLESS VICTORY" : outcome === "win" ? "VICTORY" : "DEFEAT";
    this.resolveOverlay.innerHTML = label;
    const note = this.nearMissNote();
    if (note) {
      const noteEl = document.createElement("span");
      noteEl.className = "margin-note";
      noteEl.textContent = note;
      this.resolveOverlay.appendChild(noteEl);
    } else if (tier === "narrow") {
      const noteEl = document.createElement("span");
      noteEl.className = "margin-note";
      noteEl.textContent = `WON WITH ${Math.round(this.lastPlayerHpFraction * 100)}% OF THE SQUAD'S HP LEFT`;
      this.resolveOverlay.appendChild(noteEl);
    }
    this.resolveOverlay.className = `resolve-overlay show ${outcome}${tier ? ` ${tier}` : ""}`;
    for (const { body } of this.playerHeroes.values()) {
      body.classList.remove("hot");
    }
  }

  private winMarginTier(): "flawless" | "narrow" | null {
    if (this.lastPlayerHpFraction >= 0.85) return "flawless";
    if (this.lastPlayerHpFraction < 0.25) return "narrow";
    return null;
  }

  /** Whoever ended the fight closest to firing without doing so, if they
   * were above ~85% charged and no chain fired at all this fight — the
   * dread beat's unresolved half. Silent once any chain fired (a real
   * payoff already happened; a second hero's near-miss would only compete
   * with it) or if nobody got close. */
  private nearMissNote(): string | null {
    if (this.anyChainFiredThisFight) return null;
    const threshold = this.cfg.chargeThreshold;
    if (threshold <= 0) return null;
    let closest: HeroSnapshot | undefined;
    for (const hero of this.lastPlayerHeroes) {
      if (!hero.alive) continue;
      if (!closest || hero.charge > closest.charge) closest = hero;
    }
    if (!closest) return null;
    const fraction = closest.charge / threshold;
    if (fraction < 0.85 || fraction >= 1) return null;
    return `${this.nameOf(closest.id)} ENDED ${Math.round(fraction * 100)}% CHARGED — SO CLOSE`;
  }
}

/** A chain hit's damage-popup scale, tiered per the same "no chain is
 * silent, but escalation is back-loaded" rule as the callout ladder above
 * (2026-08-15, chain-payoff-axis pass — replaces the old continuous
 * `1 + hitIndex * 0.25` ramp). Below fullTellThreshold, growth is
 * deliberately sublinear — a 2-hit chain reads as "something happened,"
 * not as a scaled-down cascade. AT fullTellThreshold, the scale jumps
 * discontinuously — paired with the arena shake and loud callout that fire
 * at the same threshold (see showChainHit) — so a cascade is
 * distinguishable from a good chain without reading the damage number. */
function chainPopupScale(hitIndex: number, fullTellThreshold: number): number {
  if (hitIndex < fullTellThreshold) return Math.min(1 + hitIndex * 0.1, 1.5);
  const over = hitIndex - fullTellThreshold;
  return Math.min(2.2 + over * 0.3, 3.5);
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

  // Charge (CHAIN) bar (2026-08-14 chain rebuild, restructured 2026-08-15 for
  // visibility) — built for every slot for simplicity; style.css collapses
  // it on the enemy side, since only the player's charge ever fires a chain.
  // A direct slot child, same shape as hpTrack/hpLabel above (NOT wrapped in
  // a row with its label — a shrink-to-fit row squeezed width:100% to zero,
  // which is why this bar previously rendered invisibly). Reads like the HP
  // bar: a real fill on top of a delayed ghost fill, so the reset-to-zero on
  // firing drains visibly instead of snapping.
  const chargeTrack = document.createElement("div");
  chargeTrack.className = "charge-track";
  const chargeGhostFill = document.createElement("div");
  chargeGhostFill.className = "charge-ghost-fill";
  chargeTrack.appendChild(chargeGhostFill);
  const chargeFill = document.createElement("div");
  chargeFill.className = "charge-fill";
  chargeTrack.appendChild(chargeFill);

  const chargeLabel = document.createElement("div");
  chargeLabel.className = "charge-label";
  chargeLabel.textContent = "CHAIN";

  slot.appendChild(body);
  slot.appendChild(name);
  slot.appendChild(hpTrack);
  slot.appendChild(hpLabel);
  slot.appendChild(chargeTrack);
  slot.appendChild(chargeLabel);
  slot.appendChild(counter);

  return {
    slot,
    body,
    hpFill,
    hpGhostFill,
    hpLabel,
    chargeFill,
    chargeGhostFill,
    chargeLabel,
    lastChargeFraction: 0,
    counter,
    status,
    accent,
    offsetIndex,
  };
}

/** Adds `className` to `el`, then removes it after `ms` — restarting the
 * animation if it's re-triggered before the previous run finished. */
function pulseClass(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}
