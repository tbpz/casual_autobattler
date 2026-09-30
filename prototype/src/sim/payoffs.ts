import type { ChainEffect, MarkId } from "./config.js";

/**
 * 2026-09-30 (marks and payoffs — see DECISIONS.md's "upgrades become set-up
 * and pay-off combos" entry). A payoff card is a squad-wide passive the run
 * holds (RunProgress.payoffs), handed to the fight in FightSetup.payoffs. Each
 * one reads a mark that a chain ability leaves, so it is worth nothing alone
 * and a lot next to the ability that sets it up.
 *
 * This file is data plus the "does this card connect to what the squad can
 * make" question the offer draw and offer screen both ask. The rules
 * themselves — what each card DOES in a fight — live in sim/fight.ts, because
 * they hook into the damage pipeline.
 */
export type PayoffId =
  | "execute"
  | "punish"
  | "shatter"
  | "deepFreeze"
  | "spread"
  | "openWound"
  | "spikedShield"
  | "bulwark";

export interface PayoffDef {
  id: PayoffId;
  title: string;
  /** One plain sentence, shown on the offer card. */
  detail: string;
  /** The marks this card reads — it does nothing until the squad can make
   * EVERY one of them (Deep freeze needs frozen and exposed, not either). */
  reads: MarkId[];
  /** A card that needs a specific ability rather than a mark (Bulwark needs
   * Guard's blocks). When set, this overrides `reads` for the connection
   * test. */
  needsEffects?: ChainEffect[];
}

export const PAYOFF_IDS: PayoffId[] = [
  "execute",
  "punish",
  "shatter",
  "deepFreeze",
  "spread",
  "openWound",
  "spikedShield",
  "bulwark",
];

export const PAYOFF_DEFS: Record<PayoffId, PayoffDef> = {
  execute: {
    id: "execute",
    title: "Execute",
    detail: "An exposed enemy at low HP dies outright.",
    reads: ["exposed"],
  },
  punish: {
    id: "punish",
    title: "Punish",
    detail: "Your tank's hits on an exposed enemy use up its exposure for a big hit.",
    reads: ["exposed"],
  },
  shatter: {
    id: "shatter",
    title: "Shatter",
    detail: "Every hit on a frozen enemy does double.",
    reads: ["frozen"],
  },
  deepFreeze: {
    id: "deepFreeze",
    title: "Deep freeze",
    detail: "Freezing an exposed enemy lasts twice as long.",
    reads: ["frozen", "exposed"],
  },
  spread: {
    id: "spread",
    title: "Spread",
    detail: "When a burning enemy dies, its burn jumps to the next enemy.",
    reads: ["burn"],
  },
  openWound: {
    id: "openWound",
    title: "Open wound",
    detail: "Burn ticks on an exposed enemy count double.",
    reads: ["burn", "exposed"],
  },
  spikedShield: {
    id: "spikedShield",
    title: "Spiked shield",
    detail: "When a shield absorbs a hit, the attacker becomes exposed.",
    reads: ["shield"],
  },
  bulwark: {
    id: "bulwark",
    title: "Bulwark",
    detail: "Every slam Guard blocks gives the whole squad a shield.",
    reads: ["shield"],
    needsEffects: ["guard"],
  },
};

/** The marks each chain ability leaves. Exposed/Burn/Shield are stacks;
 * Frozen is the stun fields. Guard leaves Exposed on the slammer it blocks. */
export const ABILITY_MARKS: Record<ChainEffect, MarkId[]> = {
  guard: ["exposed"],
  stun: ["frozen"],
  expose: ["exposed"],
  scorch: ["burn"],
  mend: ["shield"],
  ward: ["shield"],
};

/** The set of marks a squad can currently make, given the abilities its
 * roles' chains carry. */
export function marksMadeBy(effects: readonly ChainEffect[]): Set<MarkId> {
  const marks = new Set<MarkId>();
  for (const effect of effects) for (const mark of ABILITY_MARKS[effect]) marks.add(mark);
  return marks;
}

/** True when `id` reads something the squad can make right now — the offer
 * draw tilts toward these, and the offer screen highlights them. */
export function payoffConnects(id: PayoffId, effects: readonly ChainEffect[]): boolean {
  const def = PAYOFF_DEFS[id];
  if (def.needsEffects) return def.needsEffects.some((e) => effects.includes(e));
  const made = marksMadeBy(effects);
  return def.reads.every((mark) => made.has(mark));
}

/** Which held card to drop when a run is at the cap and the player (or the
 * headless greedy policy) takes another: a card that connects to nothing goes
 * first, oldest first among ties. The interactive UI lets the player choose
 * instead. */
export function pickPayoffToDrop(held: readonly PayoffId[], effects: readonly ChainEffect[]): PayoffId {
  const dead = held.find((id) => !payoffConnects(id, effects));
  return dead ?? held[0]!;
}

/** The icon and one-word label the UI shows for each mark (2026-09-30).
 * Plain glyphs, same convention as config.ts's chainEffectChip. */
export const MARK_CHIP: Record<MarkId, { icon: string; word: string }> = {
  exposed: { icon: "✦", word: "exposed" },
  frozen: { icon: "❄", word: "frozen" },
  burn: { icon: "♨", word: "burn" },
  shield: { icon: "⛊", word: "shield" },
};
