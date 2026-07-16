import { Application, Container, FederatedPointerEvent, Graphics, Text } from "pixi.js";
import { hexEquals, type Hex } from "../sim/hex";
import type { GameMap } from "../sim/map";
import type { UnitDef } from "../sim/types";
import type { HeroInstance } from "../game/hero";
import type { RoundDef } from "../game/rounds";
import { axialToPixel, hexCorners, pixelToAxial } from "./hexLayout";
import { centerCameraOnMap, drawMapTiles } from "./mapView";
import { TEAM_COLORS } from "./palette";
import { drawUnitBody, shortLabel } from "./unitShapes";

/**
 * The pre-fight setup screen (DECISIONS 2026-07-15): setup happens ON the battle map, not
 * on a separate dropdown screen. The player sees the enemy squad in place, the authored
 * deploy zone highlighted, and drag-places their own heroes onto any legal hex inside it —
 * free placement within a bounded, authored zone (TFT-style), replacing the old coarse
 * row x lane slots.
 *
 * This is a thin, self-contained Pixi scene — unlike ArenaRenderer it never plays back a
 * SimResult, it only reflects the current RunState (bench + placements) and reports drops
 * back to the caller via callbacks. It reuses drawMapTiles/centerCameraOnMap/drawUnitBody
 * so the map and hero rendering never drift from the fight screen the player sees next.
 */

export interface SetupStageCallbacks {
  /** The player dropped a hero on `hex`. Caller validates + applies via RunController.placeHero. */
  readonly onDrop: (heroId: string, hex: Hex) => void;
  /** The player dragged a placed hero off the board (dropped outside the map bounds). */
  readonly onUnplace: (heroId: string) => void;
}

interface HeroToken {
  readonly heroId: string;
  readonly container: Container;
  readonly body: Graphics;
}

/**
 * Reads (bench, deployZone, placements, enemyRoster) each render() call and draws the
 * board. Placement changes come back through `callbacks`, not by mutating anything here —
 * the caller (main.ts) owns RunState and re-renders after every change, same pattern as
 * the rest of the loop wrapper.
 */
export class SetupStage {
  readonly app: Application;
  private readonly world = new Container();
  private readonly mapLayer = new Container();
  private readonly zoneLayer = new Container();
  private readonly enemyLayer = new Container();
  private readonly tokenLayer = new Container();
  private readonly tokens = new Map<string, HeroToken>();
  private readonly callbacks: SetupStageCallbacks;
  private readonly deployZone: readonly Hex[];

  private dragging: HeroToken | null = null;
  private hoverValid = true;

  private constructor(app: Application, deployZone: readonly Hex[], callbacks: SetupStageCallbacks) {
    this.app = app;
    this.deployZone = deployZone;
    this.callbacks = callbacks;
  }

  static async create(
    container: HTMLElement,
    map: GameMap,
    round: RoundDef,
    callbacks: SetupStageCallbacks,
  ): Promise<SetupStage> {
    const app = new Application();
    await app.init({ background: 0x101018, resizeTo: container, antialias: true });
    container.appendChild(app.canvas);

    const stage = new SetupStage(app, round.deployZone, callbacks);
    stage.world.addChild(stage.mapLayer, stage.zoneLayer, stage.enemyLayer, stage.tokenLayer);
    app.stage.addChild(stage.world);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    drawMapTiles(stage.mapLayer, map);
    centerCameraOnMap(stage.world, map, container);
    stage.drawDeployZone();
    stage.drawEnemyPreview(round.enemyRoster);

    app.stage.on("pointerup", () => stage.endDrag());
    app.stage.on("pointerupoutside", () => stage.endDrag());
    app.stage.on("pointermove", (e) => stage.onPointerMove(e));

    return stage;
  }

  private drawDeployZone(): void {
    for (const hex of this.deployZone) {
      const g = new Graphics();
      g.poly(hexCorners(axialToPixel(hex))).stroke({ width: 1.5, color: 0x5fd35f, alpha: 0.35 });
      this.zoneLayer.addChild(g);
    }
  }

  private isLegalHex(hex: Hex): boolean {
    return this.deployZone.some((h) => hexEquals(h, hex));
  }

  private drawEnemyPreview(enemyRoster: readonly UnitDef[]): void {
    this.enemyLayer.removeChildren();
    for (const unit of enemyRoster) {
      const container = new Container();
      const body = new Graphics();
      drawUnitBody(body, unit.role, TEAM_COLORS.enemy);
      const label = new Text({
        text: shortLabel(unit.id),
        style: { fontSize: 11, fontWeight: "bold", fill: 0xffffff },
      });
      label.anchor.set(0.5);
      container.addChild(body, label);
      const pos = axialToPixel(unit.startHex);
      container.position.set(pos.x, pos.y);
      this.enemyLayer.addChild(container);
    }
  }

  /**
   * Redraws bench/placed hero tokens from current state. Benched-but-unplaced heroes sit
   * in a tray strip above the map (in world space, left of the deploy zone's bounds is
   * unnecessary — a fixed screen offset keeps the tray visible regardless of camera pan).
   */
  render(bench: readonly HeroInstance[], placements: Readonly<Record<string, Hex>>): void {
    const seen = new Set<string>();
    let trayIndex = 0;

    for (const hero of bench) {
      seen.add(hero.id);
      const token = this.getOrCreateToken(hero);
      const placedHex = placements[hero.id];

      if (this.dragging?.heroId === hero.id) {
        // Being actively dragged — position is driven by pointer move, not by state.
      } else if (placedHex !== undefined) {
        const pos = axialToPixel(placedHex);
        token.container.position.set(pos.x, pos.y);
      } else {
        const pos = this.trayPixelPosition(trayIndex);
        token.container.position.set(pos.x, pos.y);
        trayIndex++;
      }
    }

    for (const [heroId, token] of this.tokens) {
      if (!seen.has(heroId)) {
        this.tokenLayer.removeChild(token.container);
        token.container.destroy({ children: true });
        this.tokens.delete(heroId);
      }
    }
  }

  private trayPixelPosition(index: number): { x: number; y: number } {
    // Tray sits above the map's top edge, in world space, so it pans/zooms with the board.
    const bounds = this.mapLayer.getLocalBounds();
    const spacing = 60;
    return { x: bounds.x + 30 + index * spacing, y: bounds.y - 50 };
  }

  private getOrCreateToken(hero: HeroInstance): HeroToken {
    const existing = this.tokens.get(hero.id);
    if (existing !== undefined) return existing;

    const container = new Container();
    const body = new Graphics();
    drawUnitBody(body, hero.role, TEAM_COLORS.player);
    const label = new Text({
      text: shortLabel(hero.id),
      style: { fontSize: 11, fontWeight: "bold", fill: 0xffffff },
    });
    label.anchor.set(0.5);
    container.addChild(body, label);
    container.eventMode = "static";
    container.cursor = "grab";

    const token: HeroToken = { heroId: hero.id, container, body };
    container.on("pointerdown", () => this.startDrag(token));
    this.tokenLayer.addChild(container);
    this.tokens.set(hero.id, token);
    return token;
  }

  private startDrag(token: HeroToken): void {
    this.dragging = token;
    token.container.alpha = 0.85;
    this.tokenLayer.setChildIndex(token.container, this.tokenLayer.children.length - 1);
  }

  private onPointerMove(event: FederatedPointerEvent): void {
    if (this.dragging === null) return;
    const local = this.world.toLocal(event.global);
    this.dragging.container.position.set(local.x, local.y);

    // Tint (not redraw) for a quick valid/invalid flash while hovering — cheaper than
    // re-deriving the role shape every pointer-move tick, and the token's shape never
    // changes mid-drag anyway.
    this.hoverValid = this.isLegalHex(pixelToAxial(local));
    this.dragging.body.tint = this.hoverValid ? 0xffffff : 0xff8888;
  }

  private endDrag(): void {
    const token = this.dragging;
    if (token === null) return;
    this.dragging = null;
    token.container.alpha = 1;
    token.body.tint = 0xffffff;

    const local = this.world.toLocal(this.app.renderer.events.pointer.global);
    const hex = pixelToAxial(local);
    if (this.isLegalHex(hex)) {
      this.callbacks.onDrop(token.heroId, hex);
    } else {
      this.callbacks.onUnplace(token.heroId);
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
