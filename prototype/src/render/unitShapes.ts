import type { Graphics } from "pixi.js";
import type { Role } from "../sim/types";
import { hexCorners, HEX_SIZE } from "./hexLayout";

/**
 * Unit body geometry, shared by the fight renderer and the setup stage so a hero looks
 * the same whether the player is placing them or watching them fight (DECISIONS
 * 2026-07-15: setup happens on the battle map itself, so visual continuity between the
 * two screens matters).
 */
export const UNIT_RADIUS = HEX_SIZE * 0.4;
export const TANK_RADIUS = UNIT_RADIUS * 1.25;
export const ARCHER_RADIUS = UNIT_RADIUS * 0.8;

/** Draws the role-distinguishing body shape into `g`: tanks as a larger hex slab, archers as a smaller ringed dot. */
export function drawUnitBody(g: Graphics, role: Role, fillColor: number): void {
  g.clear();
  if (role === "melee_tank") {
    const corners = hexCorners({ x: 0, y: 0 }).map((p) => ({
      x: (p.x / HEX_SIZE) * TANK_RADIUS,
      y: (p.y / HEX_SIZE) * TANK_RADIUS,
    }));
    g.poly(corners).fill(fillColor);
    g.poly(corners).stroke({ width: 2.5, color: 0x000000, alpha: 0.5 });
  } else {
    g.circle(0, 0, ARCHER_RADIUS).fill(fillColor);
    g.circle(0, 0, ARCHER_RADIUS).stroke({ width: 2, color: 0x000000, alpha: 0.4 });
    g.circle(0, 0, ARCHER_RADIUS * 0.4).fill({ color: 0x000000, alpha: 0.35 });
  }
}

/**
 * Short, stable on-body label derived only from the unit id (no game-layer name lookup —
 * the render layer stays ignorant of hero identity, per the sim/skin boundary). Ids look
 * like "e1_tank" or "garrick"; this keeps whatever prefix distinguishes sibling units
 * (the digit in "e1"/"e2") and drops the role suffix, since role is already shown by shape.
 */
export function shortLabel(id: string): string {
  const underscoreIdx = id.indexOf("_");
  const prefix = underscoreIdx === -1 ? id : id.slice(0, underscoreIdx);
  return prefix.slice(0, 3).toUpperCase();
}
