import { backfireChanceFor, chainEffectChip, chainEffectLines, type FightConfig } from "../sim/config.js";
import { chainAnswersSlam, chainVsEncounterLine } from "../sim/projection.js";

export { chainAnswersSlam, chainEffectChip, chainEffectLines, chainVsEncounterLine };

/** Renders a hero's BACKFIRE risk (config.ts's backfireChanceFor, a function
 * of the hero's own chainAffinity) as a filled/empty pip row in the danger
 * color (2026-08-20, pick-screen honesty pass — see DECISIONS.md).
 *
 * The sim-level attribution lever (chainAffinity pricing backfire risk,
 * 2026-08-19) lived entirely in the sim and was invisible on the one screen
 * where the tradeoff is actually decided — the CHAIN row's own tooltip
 * stated the tradeoff in words ("bigger pips land a bigger payoff AND carry
 * a bigger backfire risk"), but a tooltip doesn't exist on a touch device,
 * and the risk half had no color, number, or bar of its own. Unlike the old
 * CHAIN shape pips it sat beside (removed with per-hero chain shape in the
 * 2026-09-13 rebuild — heroes differ by effect now, and nothing about a
 * chain's SIZE varies by hero), this one still ranks heroes on a real,
 * un-equalized number: chainAffinity is volatility and nothing else, so more
 * pips genuinely means more risk.
 * Normalized against the POOL's own
 * backfire range (min/max chainAffinity in the pool, via backfireChanceFor),
 * not against [0,1], so the pips actually spread across the pool's real
 * spread rather than clustering in one corner. */
/** How many of the 5 backfire pips are filled — split out from
 * backfireRiskPips below (2026-09-29 round-screen rebuild) so the round
 * screen's hold card can read the same number as the dots to say
 * "low/medium/high (k of 5)" instead of re-deriving it from the pip string. */
export function backfireRiskPipCount(cfg: FightConfig, chainAffinity: number, poolMinAffinity: number, poolMaxAffinity: number): number {
  const chance = backfireChanceFor(cfg, chainAffinity);
  const minChance = backfireChanceFor(cfg, poolMinAffinity);
  const maxChance = backfireChanceFor(cfg, poolMaxAffinity);
  const span = maxChance - minChance;
  return span > 0 ? Math.max(1, Math.round(((chance - minChance) / span) * 5)) : 1;
}

export function backfireRiskPips(cfg: FightConfig, chainAffinity: number, poolMinAffinity: number, poolMaxAffinity: number): string {
  const filled = backfireRiskPipCount(cfg, chainAffinity, poolMinAffinity, poolMaxAffinity);
  return "●".repeat(filled) + "○".repeat(5 - filled);
}
