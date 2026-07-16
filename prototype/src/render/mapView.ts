import { Container, Graphics } from "pixi.js";
import type { GameMap } from "../sim/map";
import { axialToPixel, hexCorners, HEX_SIZE } from "./hexLayout";
import { TILE_PALETTE } from "./palette";

/**
 * Shared map-tile drawing, used by both the fight renderer (arenaRenderer.ts) and the
 * setup stage — one source of truth for tile geometry/colors so the two screens the
 * player sees the same map on can never drift apart (DECISIONS 2026-07-15: setup happens
 * on the battle map itself).
 */
export function drawMapTiles(layer: Container, map: GameMap): void {
  for (const tile of map.allTiles()) {
    const center = axialToPixel(tile.hex);
    const corners = hexCorners(center);
    const g = new Graphics();
    g.poly(corners).fill(TILE_PALETTE[tile.type].color);
    if (tile.type !== "open") {
      g.poly(corners).stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
    }
    layer.addChild(g);
  }
}

export interface PixelBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export function mapPixelBounds(map: GameMap): PixelBounds {
  const points = map.allTiles().map((t) => axialToPixel(t.hex));
  return {
    minX: Math.min(...points.map((p) => p.x)) - HEX_SIZE,
    maxX: Math.max(...points.map((p) => p.x)) + HEX_SIZE,
    minY: Math.min(...points.map((p) => p.y)) - HEX_SIZE,
    maxY: Math.max(...points.map((p) => p.y)) + HEX_SIZE,
  };
}

/** Centers `world` inside `container`'s current size, given the map's pixel bounds. */
export function centerCameraOnMap(world: Container, map: GameMap, container: HTMLElement): void {
  const { minX, maxX, minY, maxY } = mapPixelBounds(map);
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const w = container.clientWidth || contentW;
  const h = container.clientHeight || contentH;
  world.position.set((w - contentW) / 2 - minX, (h - contentH) / 2 - minY);
}
