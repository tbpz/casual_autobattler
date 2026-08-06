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
 *  2. The gatePoolFraction denominator is fixed at fight start, not
 *     recomputed as heroes die mid-fight (fight.ts).
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

  /** Eligibility gate (2026-08-06 rework — see DECISIONS.md's "jeopardy no
   * longer mandatory" and "squad pick is the risk dial" entries): the gate
   * is only reachable once the player's tank line has broken (or there's no
   * living tank), AND the pool is at/below this fraction of fight-start max.
   * Replaces the old eligibilityGateFraction, which fired on pool alone and
   * was reached by nearly every fight regardless of squad or play. */
  gatePoolFraction: number;

  /** A tank stops holding aggro (targeting weight drops to
   * brokenTankTargetWeight) once its own HP falls to/below this fraction of
   * its own maxHp. */
  tankBreakFraction: number;
  /** Hysteresis: a broken tank resumes holding once healed back up to this
   * fraction, so a healer's save is a real, visible event rather than the
   * break/recover tell flickering every tick near the threshold. Must be
   * greater than tankBreakFraction. */
  tankRecoverFraction: number;

  /** Ignition PRD by fights-since-last-ignition: index 0 = 0 fights since,
   * last entry repeats (capped) for any higher count. */
  ignitionChanceByFightsSince: number[];

  /** Chain PRD by bonus-hits-so-far: index 0 = chance the *first* bonus hit
   * after ignition lands, last entry repeats (capped) beyond that. */
  chainChanceByHitsSoFar: number[];
  /** Bonus hit N damage = min(bonusHitStep * N, bonusHitCap). */
  bonusHitStep: number;
  bonusHitCap: number;

  /** Chain length (bonusHitsLanded) at/above which the render layer shows
   * the small tell (glow + quiet callout). Below this, a chain hit gets only
   * a slightly bigger damage number — see DECISIONS.md's "spectacle gated
   * on payoff" entry. */
  chainTellThreshold: number;
  /** Chain length at/above which the render layer shows the FULL spectacle
   * (shake, escalating font, loud callout). This is deliberately the same
   * threshold batch/report.ts's fractionWinsWithChain3Plus already tracks,
   * so tuning "how rare is the big moment" and "how rare is the show" stay
   * the same knob. */
  chainFullTellThreshold: number;

  /** Weight multiplier applied to a tank's chance of being the enemy's
   * chosen target while holding (HP above tankBreakFraction), relative to
   * weight 1 for every other role. */
  tankTargetWeight: number;
  /** Same, but for a tank that has broken — dropping this near 1 is what
   * makes damage splash onto the rest of the squad once the tank fails. */
  brokenTankTargetWeight: number;

  /** Per-hit damage variance for normal attacks, as a fraction of base
   * damage (e.g. 0.25 = ±25%). NOT applied to chain bonus hits, which stay
   * exact so the escalating tiers read cleanly. 0 disables variance (used by
   * checks/beatsheet.ts to isolate the pure-combat trajectory). */
  damageVariance: number;
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

  gatePoolFraction: 0.35,
  // tankBreakFraction retuned down hard from an initial 0.3 during the
  // 2026-08-06 tuning pass: at 0.3 the comfortable comp (bracer+rook+cairn)
  // broke its tank line in ~90-100% of fights regardless of Bracer's own
  // HP/damage (batch-verified — tripling his damage and adding 40% more HP
  // each barely moved the rate). The real driver turned out to be that a
  // tank's SHARE of incoming damage (weighted targeting) sustained over a
  // whole fight overwhelms almost any reasonable buffer above ~15-20% of his
  // own maxHp; only a low break threshold (tank has to be nearly dead, not
  // just battered) gets a comfortable comp's dip rate down near the ~25%
  // target. Batch-verified at these values (npm run batch --squad
  // comfortable): dip rate ~27%, ignition ~20%, full-spectacle (chain>=3)
  // ~8% — see checks/chaindist.ts's pinned bands for the regression guard.
  tankBreakFraction: 0.03,
  tankRecoverFraction: 0.2,

  // Retuned 2026-08-06: the gate is now reachable only from a broken tank
  // line, which happens in a minority of fights by construction (see
  // projection.ts's margin bands) — so ignition needs to fire more often
  // *conditional on the gate opening* than the old always-reachable gate
  // did, to land the same overall funnel. See checks/chaindist.ts for the
  // measured bands this targets.
  ignitionChanceByFightsSince: [0.5, 0.7, 0.85],

  chainChanceByHitsSoFar: [0.7, 0.75, 0.8, 0.85, 0.9],
  bonusHitStep: 20,
  bonusHitCap: 100,

  chainTellThreshold: 2,
  chainFullTellThreshold: 3,

  tankTargetWeight: 3,
  brokenTankTargetWeight: 1,

  damageVariance: 0.25,
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
