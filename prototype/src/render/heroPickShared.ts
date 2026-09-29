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

/** At or above this fraction of the charge threshold, the pick-row bar keeps
 * the full chain color; below it the bar renders muted (2026-09-21 — see
 * chargeBarHtml below). Deliberately high: the bar is only worth the eye's
 * attention when it is genuinely about to fire THIS fight. */
export const CHARGE_NEAR_THRESHOLD_FRACTION = 0.75;

/** A mini charge bar for a hero-pick row (2026-08-14 chain rebuild) — the
 * same visual language as the in-fight CHAIN bar (see fightView.ts,
 * .charge-track/.charge-fill in style.css), so a player recognizes it
 * instantly. Only meaningful where live `charge` exists (fieldPickScreen —
 * charge persists across fights, see sim/types.ts's HeroState.charge); the
 * run-start draft has no charge yet, so squadPickScreen doesn't use this.
 * Unlike the in-fight bar, this one is static — built once via innerHTML at
 * its final width, no transition ever plays (see .hero-pick-charge-row's
 * fixed-width override in style.css) — a pick row doesn't need to animate a
 * value that was already true before the screen opened.
 *
 * 2026-09-21 (the played run in logs/260921_2127 — see DECISIONS.md): the
 * bar is muted unless it clears CHARGE_NEAR_THRESHOLD_FRACTION, at which
 * point `.near-threshold` restores the chain color. It used to carry full
 * chain color at every value, which made "this hero is 5% charged" shout as
 * loudly as "this hero fires in the first seconds" — and a full-HP tank got
 * benched on a 5% reading. A bar that is not about to fire is not news. */
export function chargeBarHtml(charge: number, threshold: number): string {
  const pct = threshold > 0 ? Math.max(0, Math.min(100, Math.round((charge / threshold) * 100))) : 0;
  const near = threshold > 0 && charge / threshold >= CHARGE_NEAR_THRESHOLD_FRACTION;
  return `
    <span class="hero-pick-charge-row${near ? " near-threshold" : ""}" title="Charge — carries into this fight from how the roster has fought so far">
      <span class="hero-pick-charge-label">CHG</span>
      <span class="charge-track"><span class="charge-fill" style="width:${pct}%"></span></span>
      <span class="hero-pick-charge-pct">${pct}%</span>
    </span>
  `;
}
