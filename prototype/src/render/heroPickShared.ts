import { backfireChanceFor, chainEffectLines, type FightConfig } from "../sim/config.js";

export { chainEffectLines };

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
 * CHAIN pips (see chainShapeSparkline above, its Step 3 replacement), this
 * one still ranks heroes on a real, un-equalized number — chainAffinity is
 * volatility now, full stop, so more pips genuinely means more risk.
 * Normalized against the POOL's own
 * backfire range (min/max chainAffinity in the pool, via backfireChanceFor),
 * not against [0,1], so the pips actually spread across the pool's real
 * spread rather than clustering in one corner. */
export function backfireRiskPips(cfg: FightConfig, chainAffinity: number, poolMinAffinity: number, poolMaxAffinity: number): string {
  const chance = backfireChanceFor(cfg, chainAffinity);
  const minChance = backfireChanceFor(cfg, poolMinAffinity);
  const maxChance = backfireChanceFor(cfg, poolMaxAffinity);
  const span = maxChance - minChance;
  const filled = span > 0 ? Math.max(1, Math.round(((chance - minChance) / span) * 5)) : 1;
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

/** A mini charge bar for a hero-pick row (2026-08-14 chain rebuild) — the
 * same visual language as the in-fight CHAIN bar (see fightView.ts,
 * .charge-track/.charge-fill in style.css), so a player recognizes it
 * instantly. Only meaningful where live `charge` exists (fieldPickScreen —
 * charge persists across fights, see sim/types.ts's HeroState.charge); the
 * run-start draft has no charge yet, so squadPickScreen doesn't use this.
 * Unlike the in-fight bar, this one is static — built once via innerHTML at
 * its final width, no transition ever plays (see .hero-pick-charge-row's
 * fixed-width override in style.css) — a pick row doesn't need to animate a
 * value that was already true before the screen opened. */
export function chargeBarHtml(charge: number, threshold: number): string {
  const pct = threshold > 0 ? Math.max(0, Math.min(100, Math.round((charge / threshold) * 100))) : 0;
  return `
    <span class="hero-pick-charge-row" title="Charge — carries into this fight from how the roster has fought so far">
      <span class="hero-pick-charge-label">CHARGE</span>
      <span class="charge-track"><span class="charge-fill" style="width:${pct}%"></span></span>
      <span class="hero-pick-charge-pct">${pct}%</span>
    </span>
  `;
}
