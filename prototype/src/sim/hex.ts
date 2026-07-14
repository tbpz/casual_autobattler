/**
 * Axial hex-grid math. Flat-top axial coordinates (q, r); s = -q - r is derived, never stored.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export function hex(q: number, r: number): Hex {
  return { q, r };
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r };
}

/** The six axial neighbor directions, in a fixed clockwise order starting at 0=E. */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbor(h: Hex, direction: number): Hex {
  return hexAdd(h, HEX_DIRECTIONS[((direction % 6) + 6) % 6]);
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

/** Hex distance (number of steps), not Euclidean distance. */
export function hexDistance(a: Hex, b: Hex): number {
  const d = hexSubtract(a, b);
  return (Math.abs(d.q) + Math.abs(d.r) + Math.abs(d.q + d.r)) / 2;
}

/** All hexes within `radius` steps of `center`, including center. */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const results: Hex[] = [];
  let h = hexAdd(center, { q: -radius, r: radius });
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(h);
      h = hexNeighbor(h, side);
    }
  }
  return results;
}

export function hexSpiral(center: Hex, radius: number): Hex[] {
  const results: Hex[] = [center];
  for (let k = 1; k <= radius; k++) {
    results.push(...hexRing(center, k));
  }
  return results;
}

/** Linear interpolation between two hexes in cube space, then rounded to the nearest hex. */
function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);

  const qDiff = Math.abs(q - qf);
  const rDiff = Math.abs(r - rf);
  const sDiff = Math.abs(s - sf);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }
  return { q, r };
}

/** Every hex on the straight line from a to b, in order (inclusive of both endpoints). */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const results: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const qf = a.q + (b.q - a.q) * t;
    const rf = a.r + (b.r - a.r) * t;
    results.push(hexRound(qf, rf));
  }
  return results;
}
