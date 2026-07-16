import { Application, Container, Graphics, Text } from "pixi.js";
import type { GameMap } from "../sim/map";
import type { SimEvent, TickSnapshot, UnitSnapshot } from "../sim/events";
import type { Role } from "../sim/types";
import { axialToPixel, lerpPoint, HEX_SIZE } from "./hexLayout";
import { centerCameraOnMap, drawMapTiles } from "./mapView";
import { TEAM_COLORS } from "./palette";
import { ARCHER_RADIUS, drawUnitBody, shortLabel, UNIT_RADIUS } from "./unitShapes";

const HP_BAR_WIDTH = HEX_SIZE * 1.1;
const HP_BAR_HEIGHT = 5;
const DEATH_FADE_TICKS = 6;
const FLASH_TICKS = 4;
const TRACER_FADE_TICKS = 10;

interface UnitVisual {
  readonly container: Container;
  readonly body: Graphics;
  readonly label: Text;
  readonly hpBarBg: Graphics;
  readonly hpBarFill: Graphics;
  readonly role: Role;
  attackFlashTicks: number;
  hitFlashTicks: number;
  deathTick: number | null;
}

interface TracerEffect {
  readonly line: Graphics;
  readonly text: Text;
  ticksLeft: number;
}

/**
 * Reads sim output (TickSnapshot + SimEvent) and draws it. This module never imports
 * from sim/engine.ts's internals — only the events.ts contract types. It has no opinion
 * about game rules; it is purely a player of pre-computed data.
 */
export class ArenaRenderer {
  readonly app: Application;
  private readonly world = new Container();
  private readonly mapLayer = new Container();
  private readonly telegraphLayer = new Container();
  private readonly unitLayer = new Container();
  private readonly effectsLayer = new Container();
  private readonly units = new Map<string, UnitVisual>();
  private readonly tracerEffects: TracerEffect[] = [];
  private lastTick: number | null = null;

  showRangeRings = false;
  showAggroLines = true;

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(container: HTMLElement, map: GameMap): Promise<ArenaRenderer> {
    const app = new Application();
    await app.init({ background: 0x101018, resizeTo: container, antialias: true });
    container.appendChild(app.canvas);

    const renderer = new ArenaRenderer(app);
    renderer.world.addChild(
      renderer.mapLayer,
      renderer.telegraphLayer,
      renderer.unitLayer,
      renderer.effectsLayer,
    );
    app.stage.addChild(renderer.world);

    drawMapTiles(renderer.mapLayer, map);
    centerCameraOnMap(renderer.world, map, container);
    return renderer;
  }

  private getOrCreateUnit(snapshot: UnitSnapshot): UnitVisual {
    const existing = this.units.get(snapshot.id);
    if (existing !== undefined) return existing;

    const container = new Container();
    const body = new Graphics();
    const label = new Text({
      text: shortLabel(snapshot.id),
      style: { fontSize: 11, fontWeight: "bold", fill: 0xffffff },
    });
    label.anchor.set(0.5);
    const hpBarBg = new Graphics();
    hpBarBg.rect(-HP_BAR_WIDTH / 2, -UNIT_RADIUS - 14, HP_BAR_WIDTH, HP_BAR_HEIGHT).fill(0x000000);
    const hpBarFill = new Graphics();

    container.addChild(body, label, hpBarBg, hpBarFill);
    this.unitLayer.addChild(container);

    const visual: UnitVisual = {
      container,
      body,
      label,
      hpBarBg,
      hpBarFill,
      role: snapshot.role,
      attackFlashTicks: 0,
      hitFlashTicks: 0,
      deathTick: null,
    };
    this.units.set(snapshot.id, visual);
    return visual;
  }

  private drawBody(visual: UnitVisual, fillColor: number): void {
    drawUnitBody(visual.body, visual.role, fillColor);
  }

  private spawnAttackTracer(attacker: UnitSnapshot, target: UnitSnapshot, damage: number): void {
    const from = lerpPoint(axialToPixel(attacker.fromHex), axialToPixel(attacker.toHex), attacker.moveT);
    const to = lerpPoint(axialToPixel(target.fromHex), axialToPixel(target.toHex), target.moveT);

    const line = new Graphics();
    line.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 3, color: TEAM_COLORS[attacker.team], alpha: 0.9 });
    this.effectsLayer.addChild(line);

    const text = new Text({
      text: `-${damage}`,
      style: { fontSize: 13, fontWeight: "bold", fill: 0xffcc44 },
    });
    text.anchor.set(0.5);
    text.position.set(to.x, to.y - ARCHER_RADIUS - 18);
    this.effectsLayer.addChild(text);

    this.tracerEffects.push({ line, text, ticksLeft: TRACER_FADE_TICKS });
  }

  private clearTracerEffects(): void {
    for (const effect of this.tracerEffects) {
      this.effectsLayer.removeChild(effect.line);
      this.effectsLayer.removeChild(effect.text);
      effect.line.destroy();
      effect.text.destroy();
    }
    this.tracerEffects.length = 0;
  }

  private advanceTracerEffects(): void {
    for (let i = this.tracerEffects.length - 1; i >= 0; i--) {
      const effect = this.tracerEffects[i];
      effect.ticksLeft--;
      const alpha = Math.max(0, effect.ticksLeft / TRACER_FADE_TICKS);
      effect.line.alpha = alpha;
      effect.text.alpha = alpha;
      effect.text.y -= 0.4;
      if (effect.ticksLeft <= 0) {
        this.effectsLayer.removeChild(effect.line);
        this.effectsLayer.removeChild(effect.text);
        effect.line.destroy();
        effect.text.destroy();
        this.tracerEffects.splice(i, 1);
      }
    }
  }

  /** Renders one tick: unit positions/HP, hit feedback, death fade, and telegraphs. */
  renderTick(snapshot: TickSnapshot, tickEvents: readonly SimEvent[]): void {
    // A non-consecutive tick (scrub, restart, step) invalidates any in-flight transient
    // effects — without this, tracers/damage numbers from a jumped-over tick would keep
    // fading in place, no longer matching what's being watched.
    if (this.lastTick !== null && snapshot.tick !== this.lastTick + 1) {
      this.clearTracerEffects();
    }
    this.lastTick = snapshot.tick;

    const byId = new Map<string, UnitSnapshot>(snapshot.units.map((u) => [u.id, u]));

    for (const event of tickEvents) {
      if (event.type === "attack") {
        const attacker = this.units.get(event.attackerId);
        const target = this.units.get(event.targetId);
        if (attacker !== undefined) attacker.attackFlashTicks = FLASH_TICKS;
        if (target !== undefined) target.hitFlashTicks = FLASH_TICKS;

        const attackerSnap = byId.get(event.attackerId);
        const targetSnap = byId.get(event.targetId);
        if (attackerSnap !== undefined && targetSnap !== undefined) {
          this.spawnAttackTracer(attackerSnap, targetSnap, event.damage);
        }
      } else if (event.type === "death") {
        const dying = this.units.get(event.unitId);
        if (dying !== undefined) dying.deathTick = event.tick;
      }
    }

    for (const u of snapshot.units) {
      const visual = this.getOrCreateUnit(u);
      const pos = lerpPoint(axialToPixel(u.fromHex), axialToPixel(u.toHex), u.moveT);
      visual.container.position.set(pos.x, pos.y);

      let fillColor: number = TEAM_COLORS[u.team];
      if (visual.attackFlashTicks > 0) {
        fillColor = 0xffffff;
        visual.attackFlashTicks--;
      } else if (visual.hitFlashTicks > 0) {
        fillColor = 0xffcc44;
        visual.hitFlashTicks--;
      }

      this.drawBody(visual, fillColor);

      visual.hpBarFill.clear();
      const hpPct = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp) : 0;
      visual.hpBarFill
        .rect(-HP_BAR_WIDTH / 2, -UNIT_RADIUS - 14, HP_BAR_WIDTH * hpPct, HP_BAR_HEIGHT)
        .fill(hpPct > 0.3 ? 0x5fd35f : 0xd35f5f);

      if (!u.alive) {
        const ticksSinceDeath = visual.deathTick !== null ? snapshot.tick - visual.deathTick : DEATH_FADE_TICKS;
        visual.container.alpha = Math.max(0, 1 - ticksSinceDeath / DEATH_FADE_TICKS);
        visual.container.visible = visual.container.alpha > 0.02;
      } else {
        visual.container.alpha = 1;
        visual.container.visible = true;
      }
    }

    this.advanceTracerEffects();
    this.drawTelegraphs(snapshot, byId);
  }

  private drawTelegraphs(snapshot: TickSnapshot, byId: ReadonlyMap<string, UnitSnapshot>): void {
    this.telegraphLayer.removeChildren();
    if (!this.showRangeRings && !this.showAggroLines) return;

    for (const u of snapshot.units) {
      if (!u.alive) continue;
      const pos = lerpPoint(axialToPixel(u.fromHex), axialToPixel(u.toHex), u.moveT);

      if (this.showRangeRings) {
        const pixelRadius = HEX_SIZE * Math.sqrt(3) * u.range;
        const ring = new Graphics();
        ring
          .circle(pos.x, pos.y, pixelRadius)
          .stroke({ width: 1.5, color: TEAM_COLORS[u.team], alpha: 0.25 });
        this.telegraphLayer.addChild(ring);
      }

      if (this.showAggroLines && u.targetId !== null) {
        const target = byId.get(u.targetId);
        if (target !== undefined && target.alive) {
          const targetPos = lerpPoint(axialToPixel(target.fromHex), axialToPixel(target.toHex), target.moveT);
          const line = new Graphics();
          line
            .moveTo(pos.x, pos.y)
            .lineTo(targetPos.x, targetPos.y)
            .stroke({ width: 2, color: TEAM_COLORS[u.team], alpha: 0.5 });
          this.telegraphLayer.addChild(line);
        }
      }
    }
  }
}
