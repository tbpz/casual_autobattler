/**
 * The skill bubble that sits over a unit while it uses a skill (DECISIONS.md 2026-10-16, "The charge is a yellow border round one bubble").
 *
 * One fixed size for the whole skill. Its outline is one path, the rounded box and the little arrow under it that points at the unit, so the
 * yellow border that runs round it covers the arrow too. The path starts at the arrow tip and runs clockwise (along the bottom to the left,
 * up, across the top, down the right, back along the bottom to the arrow), which is the way the flow of yellow arrives: it reaches the tip,
 * then the border runs round from there.
 */
export const BUBBLE_W = 72;
export const BUBBLE_H = 20;
export const BUBBLE_R = 9;
/** How far the arrow reaches below the box. */
export const BUBBLE_TAIL = 4;
/** Half the arrow's width at the box. */
const TAIL_HALF = 4;
/** How far the arrow can sit from the box's centre and still clear the rounded corners. */
export const BUBBLE_TAIL_MAX_DX = BUBBLE_W / 2 - BUBBLE_R - TAIL_HALF;

export function clampTailDx(dx: number): number {
  return Math.max(-BUBBLE_TAIL_MAX_DX, Math.min(BUBBLE_TAIL_MAX_DX, dx));
}

/** The closed outline, in the box's own coordinates (0,0 is its top left; the arrow tip is below the box). `tailDx` slides the arrow along the bottom edge. */
export function bubblePath(tailDx = 0): string {
  const w = BUBBLE_W;
  const h = BUBBLE_H;
  const r = BUBBLE_R;
  const tipX = w / 2 + clampTailDx(tailDx);
  const n = (v: number) => String(Math.round(v * 100) / 100);
  return (
    `M${n(tipX)},${h + BUBBLE_TAIL} L${n(tipX - TAIL_HALF)},${h} H${r} A${r} ${r} 0 0 1 0,${h - r} V${r} A${r} ${r} 0 0 1 ${r},0 ` +
    `H${w - r} A${r} ${r} 0 0 1 ${w},${r} V${h - r} A${r} ${r} 0 0 1 ${w - r},${h} H${n(tipX + TAIL_HALF)} Z`
  );
}

/** `live` and `backfire` while the skill runs; `stopped` and `backfireStopped` when it ends, whatever the cause. */
export type BubbleKind = "live" | "backfire" | "stopped" | "backfireStopped";

export interface BubbleText {
  /** The word on the left: the skill, or what is going on with it. */
  name: string;
  /** The count on the right ("×3"), empty until the skill has repeated, and always empty once it has stopped. */
  count: string;
  /** From the full-tell hit: a brighter glow, since the bubble itself never grows. */
  big: boolean;
  /** At the cap. */
  max: boolean;
  backfire: boolean;
  /** Grey: the skill stopped. */
  muted: boolean;
}

/**
 * What the bubble says. The first use shows the skill alone; from the second hit the count appears beside it; from `fullAt` hits the glow
 * brightens; at `maxAt` the word reads MAX. A backfire says BACKFIRE. Every ending says STOPPED, with no count and no other word: grey, or
 * red for a backfire. The result bubble that follows carries the hits and the damage. The word "chain" is not used in fight text.
 */
export function bubbleText(kind: BubbleKind, length: number, skill: string, fullAt: number, maxAt: number): BubbleText {
  if (kind === "stopped") return { name: "STOPPED", count: "", big: false, max: false, backfire: false, muted: true };
  if (kind === "backfireStopped") return { name: "STOPPED", count: "", big: false, max: false, backfire: true, muted: false };
  const count = length >= 2 ? `×${length}` : "";
  const big = length >= fullAt;
  const max = length >= maxAt;
  if (kind === "backfire") return { name: "BACKFIRE", count, big, max, backfire: true, muted: false };
  return { name: max ? "MAX" : skill, count, big, max, backfire: false, muted: false };
}
