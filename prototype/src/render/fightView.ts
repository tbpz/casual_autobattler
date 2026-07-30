import type { FightEvent, HeroSnapshot, TickSnapshot } from "../sim/events.js";

/**
 * Renders one fight's replay: two aggregate meters, N stub bodies per side
 * (silhouette + color, identical stats — no role identity, per scope), the
 * ignition tell, and the chain's escalating damage-pop. Pure DOM + CSS, no
 * canvas library — the fight has no spatial movement to draw.
 *
 * Driven entirely by render/playback.ts's onTick callback; never touches the
 * sim.
 */
export class FightView {
  private playerMeterFill: HTMLElement;
  private enemyMeterFill: HTMLElement;
  private playerMeterLabel: HTMLElement;
  private enemyMeterLabel: HTMLElement;
  private playerBodies: Map<string, HTMLElement> = new Map();
  private enemyBodies: Map<string, HTMLElement> = new Map();
  private arena: HTMLElement;
  private callout: HTMLElement;
  private popupLayer: HTMLElement;
  private resolveOverlay: HTMLElement;
  private clock: HTMLElement;

  constructor(container: HTMLElement, playerN: number, enemyN: number) {
    container.innerHTML = "";
    container.classList.add("fight-view");

    this.clock = document.createElement("div");
    this.clock.className = "fight-clock";
    container.appendChild(this.clock);

    const meters = document.createElement("div");
    meters.className = "meters";
    const [playerMeter, playerFill, playerLabel] = makeMeter("player");
    const [enemyMeter, enemyFill, enemyLabel] = makeMeter("enemy");
    meters.appendChild(playerMeter);
    meters.appendChild(enemyMeter);
    container.appendChild(meters);
    this.playerMeterFill = playerFill;
    this.enemyMeterFill = enemyFill;
    this.playerMeterLabel = playerLabel;
    this.enemyMeterLabel = enemyLabel;

    this.arena = document.createElement("div");
    this.arena.className = "arena";
    const playerSide = document.createElement("div");
    playerSide.className = "side player-side";
    const enemySide = document.createElement("div");
    enemySide.className = "side enemy-side";
    for (let i = 0; i < playerN; i++) {
      const body = makeBody(`p${i}`);
      playerSide.appendChild(body);
      this.playerBodies.set(`p${i}`, body);
    }
    for (let i = 0; i < enemyN; i++) {
      const body = makeBody(`e${i}`);
      enemySide.appendChild(body);
      this.enemyBodies.set(`e${i}`, body);
    }
    this.arena.appendChild(playerSide);
    this.arena.appendChild(enemySide);
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
    this.clock.textContent = `t = ${snapshot.t.toFixed(1)}s`;

    const playerFraction = snapshot.playerMaxHp > 0 ? snapshot.playerHp / snapshot.playerMaxHp : 0;
    const enemyFraction = snapshot.enemyMaxHp > 0 ? snapshot.enemyHp / snapshot.enemyMaxHp : 0;
    this.playerMeterFill.style.width = `${(playerFraction * 100).toFixed(1)}%`;
    this.enemyMeterFill.style.width = `${(enemyFraction * 100).toFixed(1)}%`;
    this.playerMeterLabel.textContent = `${Math.round(snapshot.playerHp)} / ${Math.round(snapshot.playerMaxHp)}`;
    this.enemyMeterLabel.textContent = `${Math.round(snapshot.enemyHp)} / ${Math.round(snapshot.enemyMaxHp)}`;

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
    for (const body of [...this.playerBodies.values(), ...this.enemyBodies.values()]) {
      body.classList.remove("down", "hot");
      body.style.opacity = "1";
    }
  }

  private handleEvent(e: FightEvent): void {
    switch (e.type) {
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

  private showIgnition(heroId: string): void {
    this.callout.textContent = `${heroId.toUpperCase()} IGNITES!`;
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

function makeMeter(side: "player" | "enemy"): [HTMLElement, HTMLElement, HTMLElement] {
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
  return [meter, fill, label];
}

function makeBody(id: string): HTMLElement {
  const body = document.createElement("div");
  body.className = "body";
  body.dataset.id = id;
  return body;
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
