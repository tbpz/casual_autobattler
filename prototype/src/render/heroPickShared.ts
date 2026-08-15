import { MAX_CHAIN_AFFINITY } from "../sim/heroes.js";

/** Renders a hero's chainAffinity as filled/empty pips, normalized against
 * the pool's own highest value (2026-08-08 — the player's complaint was that
 * squad choice had no visible connection to the cascade; this is that
 * connection, made literal at pick time). 2026-08-14 chain rebuild:
 * chainAffinity now scales payoff/backfire MAGNITUDE only, not how fast a
 * hero's bar fills — every hero charges at the same rate, so this pip meter
 * reads as "how loud is this hero, both ways," not "how often does it chain."
 * Shared by squadPickScreen (pool defs, no live state yet) and
 * fieldPickScreen (live HeroState) so the two copies can never drift. */
export function chainAffinityPips(affinity: number): string {
  const filled = Math.max(1, Math.round((affinity / MAX_CHAIN_AFFINITY) * 5));
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
