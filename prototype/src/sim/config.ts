/**
 * Every tunable constant for the fight and run sims, in one place.
 * Source of truth: FIGHT_SCRIPT.md (§1-4) for fight constants, PROTOTYPE_PLAN.md
 * for run constants. Values here are strawmen meant to move by playing and by
 * the batch harness (npm run batch) — see PROTOTYPE_PLAN.md Phase 2.
 *
 * Readings this file fixes that the docs left implicit:
 *  1. Continuous side-level DPS (both sides' baseline combat) splits
 *     proportionally across living heroes (fight.ts, applyDistributedDamage).
 *     The chain's bonus hits are the exception — concentrated on the
 *     front-most living target (applyConcentratedDamage), since §3 wants
 *     them focused and retargeting on a kill. (Revised during the Phase 2
 *     batch harness pass — concentrating baseline damage too killed the
 *     front hero within ~7s of every fight, contradicting DECISIONS.md's
 *     2026-07-31 "a hero falls only in the bad-case dip, not every dip" and
 *     producing a 0% run-completion rate. See fight.ts's docstring on
 *     applyDistributedDamage for the cost this trades away.)
 *  2. Player DPS does NOT scale down as heroes die (dpsScalesWithLivingHeroes).
 *  3. The 40%-of-max eligibility gate denominator is fixed at fight start,
 *     not recomputed as heroes die mid-fight (fight.ts).
 */

export type DeathPolicy = "downAtFightEnd" | "onlyOnLoss";

export interface FightConfig {
  /** Ticks per second. FIGHT_SCRIPT.md doesn't specify a tick rate; 20/s gives
   * smooth meter motion without over-resolving the 1/s attack cadence below. */
  tickRate: number;
  /** Fight length in seconds (FIGHT_SCRIPT.md §1). */
  fightDurationSec: number;
  /** How often each hero gets a discrete attack "beat" to roll a chain on.
   * 1/sec keeps a 5-hit chain inside the beat sheet's ~7s chain window. */
  attackIntervalSec: number;

  heroMaxHp: number;
  /** Player squad damage, side total, flat (FIGHT_SCRIPT.md §3). */
  playerDpsSideTotal: number;
  /** If false (the doc's own worked check requires this), a downed hero does
   * not reduce the side's total DPS mid-fight — only HP-pool absorption
   * changes. Named here because it's the first lever to flip if a downed
   * body should cost something mechanically, not just visually. */
  dpsScalesWithLivingHeroes: boolean;
  /** Enemy damage decays linearly from enemyDpsStart at t=0 to enemyDpsEnd at
   * t=fightDurationSec (FIGHT_SCRIPT.md §3 — this is the dip's mechanism). */
  enemyDpsStart: number;
  enemyDpsEnd: number;

  /** Eligibility gate: player pool <= this fraction of current (fight-start) max. */
  eligibilityGateFraction: number;

  /** Ignition PRD by fights-since-last-ignition: index 0 = 0 fights since,
   * last entry repeats (capped) for any higher count. */
  ignitionChanceByFightsSince: number[];

  /** Chain PRD by bonus-hits-so-far: index 0 = chance the *first* bonus hit
   * after ignition lands, last entry repeats (capped) beyond that. */
  chainChanceByHitsSoFar: number[];
  /** Bonus hit N damage = min(bonusHitStep * N, bonusHitCap). */
  bonusHitStep: number;
  bonusHitCap: number;
}

export interface RunConfig {
  fight: FightConfig;
  fightsPerRun: number;
  /** Enemy HP for fight index 0; later fights scale by difficultyRampFactor^i. */
  enemyHpFight1: number;
  difficultyRampFactor: number;
  playerN: number;
  enemyN: number;

  deathPolicy: DeathPolicy;

  /** Free HP granted between fights, no input, capped at current max. */
  autoRecoverHp: number;

  coinPerWin: number;
  coinBonusOnIgnition: number;
  healCoinCost: number;
  healHpAmount: number;
  upgradeCoinCost: number;
  upgradeDpsBonus: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  tickRate: 20,
  fightDurationSec: 30,
  attackIntervalSec: 1,

  heroMaxHp: 100,
  playerDpsSideTotal: 9,
  dpsScalesWithLivingHeroes: false,
  enemyDpsStart: 16,
  enemyDpsEnd: 2,

  eligibilityGateFraction: 0.4,

  ignitionChanceByFightsSince: [0.55, 0.8, 0.92],

  chainChanceByHitsSoFar: [0.35, 0.5, 0.65, 0.8, 0.9],
  bonusHitStep: 20,
  bonusHitCap: 100,
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  fight: DEFAULT_FIGHT_CONFIG,
  fightsPerRun: 5,
  enemyHpFight1: 300,
  // PROTOTYPE_PLAN.md's strawman was 1.1 (10%/fight, 300->~440 by fight 5).
  // Lowered during the Phase 2 batch pass. The deeper finding, not fully
  // fixable by this constant alone (see the batch-report writeup this pass
  // produced): FIGHT_SCRIPT.md §3's own worked check makes fight 1's
  // no-cascade case an EXACT analytic tie (both sides land at exactly 30/300
  // HP — verified by checks/beatsheet.ts). That tie is fragile, not robust:
  // any enemy-HP increase at all, even 1%, converts every later fight from
  // "coin flip" to "deterministic loss unless the cascade rescues it," since
  // there's no margin for the ramp to erode. Softening this constant alone
  // buys back individual fights but can't fix that structural cliff — five
  // sequential fights each needing a chain-rescue compounds multiplicatively
  // to a very low run-completion rate regardless of how gentle the ramp is.
  // 1.02 is a reasonable middle value, dramatically gentler than the 300->440
  // strawman; getting run-completion into the ~25%/~50% target neighborhood
  // needs either a non-exact-tie fight-1 baseline or a different ramp shape,
  // both real tuning calls left to the standing "tune by playing" step.
  difficultyRampFactor: 1.02,
  playerN: 3,
  enemyN: 3,

  deathPolicy: "downAtFightEnd",

  // Kept at PROTOTYPE_PLAN.md's strawman (100 = a full heal, since heroMaxHp
  // is also 100) even though it was tried at 60 during the Phase 2 pass to
  // give the heal sink room to matter: that change broke a MORE load-bearing
  // guarantee. DECISIONS.md (2026-07-31) names full auto-recovery as what
  // keeps the passive default *viable*, not merely present — entering a
  // fight only partially healed let ordinary (non-cascade) combat alone wipe
  // the squad before the timer, which is worse than the problem it fixed.
  // Net effect, left as a genuine finding rather than patched further here:
  // with these constants, the heal sink is currently dead — auto-recovery
  // already closes any gap heal could fill, every time. See run.ts / the
  // batch report for the always-heal vs never-spend comparison this produces.
  autoRecoverHp: 100,

  coinPerWin: 10,
  coinBonusOnIgnition: 5,
  healCoinCost: 10,
  healHpAmount: 50,
  upgradeCoinCost: 30,
  upgradeDpsBonus: 2,
};

/** Look up a PRD-style table: index by count, clamp to the last (capped) entry. */
export function prdLookup(table: number[], countSoFar: number): number {
  const idx = Math.min(countSoFar, table.length - 1);
  const value = table[idx];
  if (value === undefined) {
    throw new Error("prdLookup: table must be non-empty");
  }
  return value;
}
