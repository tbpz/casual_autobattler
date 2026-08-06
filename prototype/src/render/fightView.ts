import type { FightConfig } from "../sim/config.js";
import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";

interface HeroSlot {
  slot: HTMLElement;
  body: HTMLElement;
  hpFill: HTMLElement;
  hpLabel: HTMLElement;
  counter: HTMLElement;
  status: HTMLElement;
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
 * Renders one fight's replay. As of the attributability pass, every attack
 * and heal is drawn as a travelling tracer from a named source to a named
 * target (not just paired, unlinked lunge/flinch animations), attackers
 * carry a stable per-hero accent colour that also tints their damage
 * numbers, and heals finally render their source at all — previously
 * `healerId` was dropped on the floor and a heal was pure target-side
 * decoration. See per-hero proportional HP bars, job counters, damage/heal
 * numbers on ordinary attacks, the "broken" tank tell, and the tiered chain
 * spectacle from the 2026-08-06 legibility pass, all still present here.
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

    this.clock.textContent = `t = ${snapshot.t.toFixed(1)}s`;
    this.currentHotHeroId = snapshot.hotHeroId;

    this.updateSide(this.playerHeroes, snapshot.playerHeroes, snapshot.visibleChainHeroId);
    this.updateSide(this.enemyHeroes, snapshot.enemyHeroes, snapshot.visibleChainHeroId);

    for (const e of eventsThisTick) {
      this.handleEvent(e);
    }
  }

  reset(): void {
    this.resolveOverlay.classList.add("hidden");
    this.resolveOverlay.textContent = "";
    this.callout.textContent = "";
    this.callout.classList.remove("show", "muted");
    this.popupLayer.innerHTML = "";
    this.tracerLayer.innerHTML = "";
    this.arena.classList.remove("shake");
    for (const { body, status } of [...this.playerHeroes.values(), ...this.enemyHeroes.values()]) {
      body.classList.remove("down", "hot", "lunge", "flinch", "healed", "broken");
      body.querySelectorAll(".impact-flash").forEach((el) => el.remove());
      status.classList.remove("show");
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

  private updateSide(map: Map<string, HeroSlot>, heroes: HeroSnapshot[], visibleChainHeroId: string | null): void {
    for (const hero of heroes) {
      const refs = map.get(hero.id);
      if (!refs) continue;
      const fraction = hero.maxHp > 0 ? Math.max(hero.hp, 0) / hero.maxHp : 0;
      refs.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      refs.hpLabel.textContent = `${Math.round(Math.max(hero.hp, 0))}/${Math.round(hero.maxHp)}`;
      refs.body.classList.toggle("down", !hero.alive);
      refs.body.classList.toggle("hot", hero.id === visibleChainHeroId);
      refs.body.classList.toggle("broken", hero.role === "tank" && hero.alive && !hero.holding);
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
      case "resolve":
        this.showResolve(e.outcome);
        break;
      // ignitionRoll and gateOpen deliberately have no visual as of
      // 2026-08-06 — spectacle is gated on the chain's actual length
      // (showChainHit), not on the roll that made it possible. See
      // DECISIONS.md's "spectacle gated on payoff" entry.
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
   * `from` to `to` over TRACER_MS, coloured by the source's identity. Motion
   * along a path reads as "A did something to B" without requiring the
   * viewer to correlate two separate, unlinked animations. */
  private fireTracer(from: HTMLElement, to: HTMLElement, color: string, size = 6): void {
    const start = this.centerOf(from);
    const end = this.centerOf(to);
    const el = document.createElement("div");
    el.className = "tracer";
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
    setTimeout(() => el.remove(), TRACER_MS + 60);
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

  /** A tank's line breaking or recovering — anchored to the tank's own
   * hero-slot (not the shared arena callout, which is reserved for the
   * chain spectacle) so a tank-break event mid-chain no longer overwrites
   * "CHAIN x3" and vice versa. Quiet by design: no shake, no fanfare, since
   * it's common enough to be a normal beat, not the rare payoff. */
  private showTankTransition(heroId: string, cls: "broken" | "holding", text: string): void {
    const refs = this.slotFor(heroId);
    if (refs) {
      refs.status.textContent = text;
      refs.status.classList.remove("show");
      void refs.status.offsetWidth;
      refs.status.classList.add("show");
      if (cls === "broken") refs.body.classList.add("broken");
      else refs.body.classList.remove("broken");
    }
  }

  /** Tiered per DECISIONS.md's 2026-08-06 "spectacle gated on payoff" entry:
   * a length-1 chain hit gets a bigger damage number and nothing else; at
   * chainTellThreshold the hero starts glowing with a small callout; at
   * chainFullTellThreshold the full show (shake, escalating font, loud
   * callout) fires. Every chain hit is now also a tracer from the hot hero
   * to its target, so the source reads even on a fizzled, sub-threshold
   * chain — attribution and spectacle are gated independently. */
  private showChainHit(hitIndex: number, damage: number, targetId: string): void {
    const target = this.enemyHeroes.get(targetId);
    const attacker = this.currentHotHeroId ? this.playerHeroes.get(this.currentHotHeroId) : undefined;
    const scale = Math.min(1 + hitIndex * 0.25, 3);

    if (attacker && target) {
      this.lungeToward(attacker.body, target.body, 14);
      this.fireTracer(attacker.body, target.body, attacker.accent, 8);
    }

    const land = () => {
      if (target) {
        const maxHp = this.heroMaxHp.get(targetId) ?? 1;
        const frac = Math.max(0.15, Math.min(1, damage / maxHp));
        target.body.style.setProperty("--flinch-scale", frac.toFixed(2));
        pulseClass(target.body, "flinch", 300);
        this.showImpactFlash(target.body, frac);
        // Colour deliberately NOT overridden with the attacker's accent
        // here — the chain's own tier-escalating colour (see
        // .damage-popup.chain in style.css) is the signal that matters on
        // this number; the tracer already carries the source.
        this.showPopup(target.body, `-${damage}`, "chain", scale, Math.min(hitIndex, 5));
      }
      if (hitIndex >= this.cfg.chainFullTellThreshold) {
        this.arena.classList.remove("shake");
        void this.arena.offsetWidth;
        this.arena.classList.add("shake");
        this.showCallout(`CHAIN x${hitIndex}`, false);
      } else if (hitIndex >= this.cfg.chainTellThreshold) {
        this.showCallout(`CHAIN x${hitIndex}`, true);
      }
    };
    if (attacker && target) setTimeout(land, TRACER_MS);
    else land();
  }

  private showCallout(text: string, muted: boolean): void {
    this.callout.textContent = text;
    this.callout.classList.remove("show", "muted");
    void this.callout.offsetWidth;
    this.callout.classList.add("show");
    if (muted) this.callout.classList.add("muted");
  }

  private showPopup(
    target: HTMLElement,
    text: string,
    tier: "normal" | "heal" | "chain",
    scale = 1,
    tierNum = 0,
    color?: string,
    offsetX = 0,
  ): void {
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
  }

  private showResolve(outcome: "win" | "loss"): void {
    this.resolveOverlay.textContent = outcome === "win" ? "VICTORY" : "DEFEAT";
    this.resolveOverlay.className = `resolve-overlay show ${outcome}`;
    for (const { body } of this.playerHeroes.values()) {
      body.classList.remove("hot");
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
  const hpFill = document.createElement("div");
  hpFill.className = "hp-fill";
  hpTrack.appendChild(hpFill);

  const hpLabel = document.createElement("div");
  hpLabel.className = "hp-label";

  const counter = document.createElement("div");
  counter.className = "job-counter";

  slot.appendChild(body);
  slot.appendChild(name);
  slot.appendChild(hpTrack);
  slot.appendChild(hpLabel);
  slot.appendChild(counter);

  return { slot, body, hpFill, hpLabel, counter, status, accent, offsetIndex };
}

/** Adds `className` to `el`, then removes it after `ms` — restarting the
 * animation if it's re-triggered before the previous run finished. */
function pulseClass(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}
