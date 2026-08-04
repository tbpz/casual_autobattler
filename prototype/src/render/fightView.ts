import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";

/**
 * Renders one fight's replay: two aggregate meters (with a mark for the
 * eligibility gate), a body per hero sized/shaped by role with a name label,
 * attack lunges and heal pulses so every HP change traces to a visible
 * cause, the ignition tell, and the chain's escalating damage-pop.
 *
 * Pure DOM + CSS, no canvas library. Driven entirely by render/playback.ts's
 * onTick callback; never touches the sim.
 *
 * Bodies are built lazily from the first snapshot's hero list (id/name/role),
 * not from a fixed N — attrition can leave a later fight with fewer than
 * cfg.playerN living heroes, and the roster's role composition depends on
 * the player's squad pick, neither of which the view should hardcode.
 */
export class FightView {
  private playerMeterFill: HTMLElement;
  private enemyMeterFill: HTMLElement;
  private playerMeterLabel: HTMLElement;
  private enemyMeterLabel: HTMLElement;
  private gateMark: HTMLElement;
  private playerBodies: Map<string, HTMLElement> = new Map();
  private enemyBodies: Map<string, HTMLElement> = new Map();
  private heroNames: Map<string, string> = new Map();
  private playerSlots: HTMLElement;
  private enemySlots: HTMLElement;
  private arena: HTMLElement;
  private callout: HTMLElement;
  private popupLayer: HTMLElement;
  private resolveOverlay: HTMLElement;
  private clock: HTMLElement;
  private built = false;

  constructor(container: HTMLElement, eligibilityGateFraction: number) {
    container.innerHTML = "";
    container.classList.add("fight-view");

    this.clock = document.createElement("div");
    this.clock.className = "fight-clock";
    container.appendChild(this.clock);

    const meters = document.createElement("div");
    meters.className = "meters";
    const [playerMeter, playerFill, playerLabel, playerTrack] = makeMeter("player");
    const [enemyMeter, enemyFill, enemyLabel] = makeMeter("enemy");
    this.gateMark = document.createElement("div");
    this.gateMark.className = "gate-mark";
    this.gateMark.style.left = `${eligibilityGateFraction * 100}%`;
    playerTrack.appendChild(this.gateMark);
    meters.appendChild(playerMeter);
    meters.appendChild(enemyMeter);
    container.appendChild(meters);
    this.playerMeterFill = playerFill;
    this.enemyMeterFill = enemyFill;
    this.playerMeterLabel = playerLabel;
    this.enemyMeterLabel = enemyLabel;

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

    this.popupLayer = document.createElement("div");
    this.popupLayer.className = "popup-layer";
    this.arena.appendChild(this.popupLayer);

    this.resolveOverlay = document.createElement("div");
    this.resolveOverlay.className = "resolve-overlay hidden";
    container.appendChild(this.resolveOverlay);
  }

  render(snapshot: TickSnapshot, eventsThisTick: FightEvent[]): void {
    if (!this.built) {
      this.buildBodies(this.playerSlots, this.playerBodies, snapshot.playerHeroes, "player");
      this.buildBodies(this.enemySlots, this.enemyBodies, snapshot.enemyHeroes, "enemy");
      this.built = true;
    }

    this.clock.textContent = `t = ${snapshot.t.toFixed(1)}s`;

    const playerFraction = snapshot.playerMaxHp > 0 ? snapshot.playerHp / snapshot.playerMaxHp : 0;
    const enemyFraction = snapshot.enemyMaxHp > 0 ? snapshot.enemyHp / snapshot.enemyMaxHp : 0;
    this.playerMeterFill.style.width = `${(playerFraction * 100).toFixed(1)}%`;
    this.enemyMeterFill.style.width = `${(enemyFraction * 100).toFixed(1)}%`;
    this.playerMeterLabel.textContent = `${Math.round(snapshot.playerHp)} / ${Math.round(snapshot.playerMaxHp)}`;
    this.enemyMeterLabel.textContent = `${Math.round(snapshot.enemyHp)} / ${Math.round(snapshot.enemyMaxHp)}`;
    this.gateMark.classList.toggle("crossed", snapshot.gateOpen);

    updateBodies(this.playerBodies, snapshot.playerHeroes, snapshot.hotHeroId);
    updateBodies(this.enemyBodies, snapshot.enemyHeroes, null);

    for (const e of eventsThisTick) {
      this.handleEvent(e);
    }
  }

  reset(): void {
    this.resolveOverlay.classList.add("hidden");
    this.resolveOverlay.textContent = "";
    this.callout.textContent = "";
    this.callout.classList.remove("show");
    this.popupLayer.innerHTML = "";
    this.arena.classList.remove("shake");
    this.gateMark.classList.remove("crossed");
    for (const body of [...this.playerBodies.values(), ...this.enemyBodies.values()]) {
      body.classList.remove("down", "hot", "lunge-right", "lunge-left", "flinch", "healed");
      body.style.opacity = "1";
    }
  }

  private buildBodies(
    container: HTMLElement,
    map: Map<string, HTMLElement>,
    heroes: HeroSnapshot[],
    side: "player" | "enemy",
  ): void {
    for (const hero of heroes) {
      const [slot, body] = makeHeroSlot(hero, side);
      container.appendChild(slot);
      map.set(hero.id, body);
      this.heroNames.set(hero.id, hero.name);
    }
  }

  private handleEvent(e: FightEvent): void {
    switch (e.type) {
      case "attack":
        this.showAttack(e.side, e.attackerId, e.targetId);
        break;
      case "heal":
        this.showHeal(e.targetId);
        break;
      case "ignitionRoll":
        if (e.fired && e.heroId) {
          this.showIgnition(e.heroId);
        }
        break;
      case "chainHit":
        this.showChainHit(e.hitIndex, e.damage, e.targetId);
        break;
      case "resolve":
        this.showResolve(e.outcome);
        break;
      default:
        break;
    }
  }

  private showAttack(side: "player" | "enemy", attackerId: string, targetId: string): void {
    const attackerBodies = side === "player" ? this.playerBodies : this.enemyBodies;
    const defenderBodies = side === "player" ? this.enemyBodies : this.playerBodies;
    const attacker = attackerBodies.get(attackerId);
    const target = defenderBodies.get(targetId);
    if (attacker) pulseClass(attacker, side === "player" ? "lunge-right" : "lunge-left", 250);
    if (target) pulseClass(target, "flinch", 300);
  }

  private showHeal(targetId: string): void {
    const target = this.playerBodies.get(targetId) ?? this.enemyBodies.get(targetId);
    if (target) pulseClass(target, "healed", 500);
  }

  private showIgnition(heroId: string): void {
    const name = this.heroNames.get(heroId) ?? heroId;
    this.callout.textContent = `${name.toUpperCase()} IGNITES!`;
    this.callout.classList.remove("show");
    // Force reflow so the animation restarts if triggered again mid-run.
    void this.callout.offsetWidth;
    this.callout.classList.add("show");

    this.arena.classList.remove("shake");
    void this.arena.offsetWidth;
    this.arena.classList.add("shake");

    const body = this.playerBodies.get(heroId);
    body?.classList.add("hot");
  }

  private showChainHit(hitIndex: number, damage: number, targetId: string): void {
    const target = this.enemyBodies.get(targetId);
    const popup = document.createElement("div");
    popup.className = "damage-popup";
    // Font scales with hit index so hit #5 visibly reads differently than
    // hit #1 (FIGHT_SCRIPT.md §1's "numbers should look qualitatively
    // different... bigger font pop" requirement for the chain window).
    const scale = Math.min(1 + hitIndex * 0.25, 3);
    popup.style.fontSize = `${scale}em`;
    popup.textContent = `-${damage}`;
    popup.style.setProperty("--tier", String(Math.min(hitIndex, 5)));

    if (target) {
      const rect = target.getBoundingClientRect();
      const arenaRect = this.arena.getBoundingClientRect();
      popup.style.left = `${rect.left - arenaRect.left + rect.width / 2}px`;
      popup.style.top = `${rect.top - arenaRect.top}px`;
    }
    this.popupLayer.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }

  private showResolve(outcome: "win" | "loss"): void {
    this.resolveOverlay.textContent = outcome === "win" ? "VICTORY" : "DEFEAT";
    this.resolveOverlay.className = `resolve-overlay show ${outcome}`;
    for (const body of this.playerBodies.values()) {
      body.classList.remove("hot");
    }
  }
}

function makeMeter(side: "player" | "enemy"): [HTMLElement, HTMLElement, HTMLElement, HTMLElement] {
  const meter = document.createElement("div");
  meter.className = `meter ${side}`;
  const track = document.createElement("div");
  track.className = "meter-track";
  const fill = document.createElement("div");
  fill.className = "meter-fill";
  const label = document.createElement("div");
  label.className = "meter-label";
  track.appendChild(fill);
  meter.appendChild(track);
  meter.appendChild(label);
  return [meter, fill, label, track];
}

function makeHeroSlot(hero: HeroSnapshot, side: "player" | "enemy"): [HTMLElement, HTMLElement] {
  const slot = document.createElement("div");
  slot.className = "hero-slot";
  const body = document.createElement("div");
  body.className = `body ${side}-body role-${hero.role}`;
  body.dataset.id = hero.id;
  const name = document.createElement("div");
  name.className = "body-name";
  name.textContent = hero.name;
  slot.appendChild(body);
  slot.appendChild(name);
  return [slot, body];
}

/** Adds `className` to `el`, then removes it after `ms` — restarting the
 * animation if it's re-triggered before the previous run finished. */
function pulseClass(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

function updateBodies(bodies: Map<string, HTMLElement>, heroes: HeroSnapshot[], hotHeroId: string | null): void {
  for (const hero of heroes) {
    const el = bodies.get(hero.id);
    if (!el) continue;
    el.classList.toggle("down", !hero.alive);
    el.classList.toggle("hot", hero.id === hotHeroId);
    const fraction = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
    el.style.opacity = hero.alive ? String(0.4 + 0.6 * fraction) : "1";
  }
}
