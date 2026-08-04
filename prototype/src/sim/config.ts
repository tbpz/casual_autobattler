/**
 * Every tunable constant for the fight and run sims, in one place.
 * Source of truth: FIGHT_SCRIPT.md (§1-4) for the beat sheet and the two PRD
 * tables, PROTOTYPE_PLAN.md for run constants. Per-hero stats (damage, HP,
 * attack cadence) superseded the old side-level DPS budgets — see
 * STATE_REWRITE plan (2026-08-04): the fight now has actors, not a curve, so
 * "HP and DPS as side-level budgets divided among N" (FIGHT_SCRIPT.md §1) is
 * superseded by per-hero stat blocks in sim/heroes.ts and here. Values here
 * are strawmen meant to move by playing and by the batch harness (npm run
 * batch) — see PROTOTYPE_PLAN.md Phase 2.
 *
 * Readings this file fixes that the docs left implicit:
 *  1. A normal attack is single-target. The attacking side's hero targets the
 *     front-most living hero on the opposing side — deterministic, so the
 *     player can always find and kill the visible threat (the enemy bruiser)
 *     on purpose. The defending side's individual target is instead picked by
 *     *weighted-random* selection (fight.ts's pickWeightedTarget) — a tank
 *     draws more incoming attacks than a squishy ally, but not every attack,
 *     every fight, deterministically. This is what keeps a body's death
 *     contingent rather than baked into the arithmetic: the AGGREGATE pool
 *     drains at a fixed, tunable rate (so the dip and the eligibility gate
 *     stay predictable), while WHO specifically falls stays genuinely
 *     unpredictable fight to fight. Chain bonus hits keep the old
 *     concentrated-with-retarget rule (FIGHT_SCRIPT.md §3 is explicit that a
 *     bonus hit is focused and retargets on a kill).
 *  2. The 40%-of-max eligibility gate denominator is fixed at fight start,
 *     not recomputed as heroes die mid-fight (fight.ts).
 *  3. Support heroes act on their own attack beat like everyone else, but
 *     heal their lowest-HP living ally instead of attacking.
 */

export type DeathPolicy = "downAtFightEnd" | "onlyOnLoss";

/** One enemy archetype's stat block — same shape as sim/heroes.ts's HeroDef,
 * kept separate since enemy composition (one bruiser + N-1 grunts) is a
 * run-level rule, not a player pick. */
export interface EnemyArchetype {
  role: "bruiser" | "grunt";
  namePrefix: string;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
}

export interface FightConfig {
  /** Ticks per second. FIGHT_SCRIPT.md doesn't specify a tick rate; 20/s gives
   * smooth meter motion without over-resolving hero attack cadences below. */
  tickRate: number;
  /** Failsafe only — fights resolve by wipe, not by this clock. If a fight
   * somehow runs this long (should not happen given the stat blocks below),
   * it resolves by HP fraction so the sim can never hang. */
  maxFightSec: number;

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

  /** Weight multiplier applied to a tank's chance of being the enemy's
   * chosen target, relative to weight 1 for every other role. */
  tankTargetWeight: number;
}

export interface RunConfig {
  fight: FightConfig;
  fightsPerRun: number;
  bruiser: EnemyArchetype;
  grunt: EnemyArchetype;
  /** Enemy stat scaling for fight index i: stats * difficultyRampFactor^i. */
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
  /** Flat bonus added to every player hero's per-attack damage, rest of the run. */
  upgradeDpsBonus: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  tickRate: 20,
  maxFightSec: 180,

  eligibilityGateFraction: 0.4,

  ignitionChanceByFightsSince: [0.55, 0.8, 0.92],

  chainChanceByHitsSoFar: [0.35, 0.5, 0.65, 0.8, 0.9],
  bonusHitStep: 20,
  bonusHitCap: 100,

  tankTargetWeight: 3,
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  fight: DEFAULT_FIGHT_CONFIG,
  fightsPerRun: 5,
  bruiser: { role: "bruiser", namePrefix: "Bruiser", maxHp: 160, damage: 9, attackIntervalSec: 1 },
  grunt: { role: "grunt", namePrefix: "Grunt", maxHp: 50, damage: 4, attackIntervalSec: 1 },
  difficultyRampFactor: 1.06,
  playerN: 3,
  enemyN: 3,

  deathPolicy: "downAtFightEnd",

  // Full heal between fights — keeps the passive default viable (DECISIONS.md
  // 2026-07-31) rather than merely present.
  autoRecoverHp: 100,

  coinPerWin: 10,
  coinBonusOnIgnition: 5,
  healCoinCost: 16,
  healHpAmount: 25,
  upgradeCoinCost: 45,
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
