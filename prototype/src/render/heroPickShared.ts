import { MAX_CHAIN_COEFFICIENT } from "../sim/heroes.js";

/** Renders a hero's chain-output COEFFICIENT (see sim/heroes.ts's
 * chainCoefficient — damage*chainAffinity for an attacker,
 * healPerBeat*chainAffinity for a healer) as filled/empty pips, normalized
 * against the pool's own highest coefficient (2026-08-08 — the player's
 * complaint was that squad choice had no visible connection to the cascade;
 * this is that connection, made literal at pick time).
 *
 * 2026-08-19 (affinity-as-risk pass — see DECISIONS.md/STATE.md's
 * attribution investigation): renamed from chainAffinityPips and switched
 * from raw chainAffinity to the true coefficient. The old version ranked
 * heroes on the wrong number — Vex (11 dmg x 1.0 affinity = 11.0) truly
 * out-chains Rook (6 dmg x 1.4 affinity = 8.4) by ~31%, while the old
 * affinity-only pips showed Vex with FEWER pips than Rook. Now that
 * backfireChance also scales with the firing hero's own chainAffinity
 * (config.ts's backfireChanceFor), more pips means "bigger payoff, and a
 * bigger backfire when it goes wrong" — a real tradeoff, not a strictly-
 * better upgrade. Shared by squadPickScreen (pool defs, no live state yet)
 * and fieldPickScreen (live HeroState) so the two copies can never drift. */
export function chainOutputPips(coefficient: number): string {
  const filled = Math.max(1, Math.round((coefficient / MAX_CHAIN_COEFFICIENT) * 5));
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
