import type { Hex } from "../sim/hex";

/**
 * Pointy-top axial-to-pixel conversion (matches the neighbor ordering in sim/hex.ts).
 * This is the ONLY place pixel space exists — the sim never sees it, per the sim/skin split.
 */
export const HEX_SIZE = 34; // pixel "radius" of one hex, center to corner

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function axialToPixel(h: Hex): Point {
  const x = HEX_SIZE * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = HEX_SIZE * (1.5 * h.r);
  return { x, y };
}

/** The 6 corner points of a pointy-top hex centered at `center`. */
export function hexCorners(center: Point): Point[] {
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + HEX_SIZE * Math.cos(angleRad),
      y: center.y + HEX_SIZE * Math.sin(angleRad),
    });
  }
  return corners;
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
