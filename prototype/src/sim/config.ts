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
 *  2. Support heroes act on their own attack beat like everyone else, but
 *     heal their lowest-HP living ally instead of attacking — unless
 *     attacksWhileHealing is set (Ward), in which case the heal and the
 *     attack both happen on the same beat.
 * (Reading 2, "the gatePoolFraction denominator is fixed at fight start," is
 * gone as of the 2026-08-07 heat rebuild below — there is no pool-fraction
 * gate left to fix a denominator for.)
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

  /** A tank stops holding aggro (targeting weight drops to
   * brokenTankTargetWeight) once its own HP falls to/below this fraction of
   * its own maxHp. */
  tankBreakFraction: number;
  /** Hysteresis: a broken tank resumes holding once healed back up to this
   * fraction, so a healer's save is a real, visible event rather than the
   * break/recover tell flickering every tick near the threshold. Must be
   * greater than tankBreakFraction. */
  tankRecoverFraction: number;

  /**
   * 2026-08-07 rebuild (see DECISIONS.md's "fight causality rebuild" entry
   * and STATE.md's Next up #1 replay verdict): the old pity-gate — ignition
   * only reachable from a broken/losing tank line — is gone. It made the
   * cascade structurally unreachable on a winning path, and *inverted*:
   * the fastest/riskiest squad had the LOWEST spectacle rate because it
   * killed before its pool could fall to the gate (batch-verified: 0.5-0.9%
   * full-spectacle for the two builds the player actually played). Ignition
   * eligibility is now a per-hero HEAT meter, driven by each hero doing the
   * job it was picked for (damage dealt, damage soaked, healing restored),
   * each weighted a second time by that hero's own chainAffinity (heroes.ts)
   * — see heatWeightDealt/Soaked/Restored and heatThreshold below.
   *
   * 2026-08-08 follow-up (player verdict: squad choice moved the cascade's
   * odds by ~4 points across all 20 possible squads — there was no steering
   * wheel, and the cascade fired just as often on a fight that was already
   * won as on one that wasn't). Two changes on top of the heat mechanism
   * above:
   *  - The heat-crossed hero is no longer just the FIRST living hero over
   *    threshold in array order (which always favored the tank) — it's the
   *    HIGHEST-heat living hero, so the player's intended carrier actually
   *    gets the shot.
   *  - Heat is SPENT on the roll, win or lose, not latched to one attempt
   *    per fight forever (see fight.ts: the old heatFired flag is gone). The
   *    candidate's heat resets to 0 immediately after every roll, so it has
   *    to rebuild before it can roll again. Because heat also accrues from
   *    damage SOAKED, a squad taking a beating rebuilds heat fast and gets
   *    multiple attempts in one fight; a fast clean win gets one. This is
   *    what ties the cascade to danger as an emergent consequence, rather
   *    than a scripted "if losing, then buff" rule — see ignitionChanceBy
   *    AttemptsSinceIgnition below, which now persists per-attempt (not
   *    per-fight) to match.
   */
  heatWeightDealt: number;
  heatWeightSoaked: number;
  heatWeightRestored: number;
  /** The highest-heat living hero ignites once its heat crosses this —
   * repeatably; see the heatWeightDealt docstring above for why this is no
   * longer a once-per-fight latch. */
  heatThreshold: number;

  /**
   * The enemy bruiser's telegraphed heavy hit (2026-08-07 rebuild) — the
   * mechanism that makes fragility cost something. Every windupIntervalSec
   * the bruiser stops its normal attacks, telegraphs against a
   * weighted-random target for windupTelegraphSec (same targeting rule as a
   * normal enemy attack — a holding tank draws it tankTargetWeight-to-1),
   * then lands windupDamageMultiplier x its own base damage (scaled by the
   * enrage multiplier below) on whoever it locked onto. A telegraph is a
   * dread beat with no player input required — you watch to see if the
   * named hero survives it.
   */
  windupIntervalSec: number;
  windupTelegraphSec: number;
  windupDamageMultiplier: number;

  /**
   * The enrage clock (2026-08-07 rebuild) — the mechanism that makes
   * slowness cost something. Enemy damage (normal attacks AND wind-ups)
   * holds at 1x until enrageStartSec into the fight, then ramps linearly by
   * enrageRampPerSec per second, uncapped. This is a within-fight ramp that
   * resets every fight — NOT a cross-fight damage scale (run.ts's comment on
   * scaledArchetype records that scaling enemy damage across the run's 5
   * fights at 1.08 collapsed win rate from ~100% to ~13% by fight 3; this is
   * a different axis, deliberately reset to 1x at the start of every fight).
   */
  enrageStartSec: number;
  enrageRampPerSec: number;

  /** Ignition PRD by failed-ATTEMPTS-since-last-ignition (renamed and
   * re-scoped 2026-08-08 from "fights since" — see heatWeightDealt's
   * docstring above: since heat is now spent per-roll rather than latched
   * per-fight, the countable unit is a roll, and several can happen inside
   * one fight). Index 0 = 0 attempts since, last entry repeats (capped) for
   * any higher count. Lowered at index 0 from the pre-2026-08-08 0.5, since
   * attempts are now repeatable within a fight rather than one-shot. */
  ignitionChanceByAttemptsSinceIgnition: number[];

  /** Chain PRD by bonus-hits-so-far: index 0 = chance the *first* bonus hit
   * after ignition lands, last entry repeats (capped) beyond that. */
  chainChanceByHitsSoFar: number[];
  /** Bonus hit N damage = round(hotHero.damage * chainHitMultiplier * N *
   * hero.chainAffinity) — multiplicative off the hot hero's OWN damage stat
   * (2026-08-07 rebuild) AND its own chainAffinity (2026-08-08, see
   * heroes.ts), so a Vex chain is explosive, a Rook chain is frequent but
   * modest, and a Bracer chain is a near-total damp squib — squad choice
   * sets both whether the ceiling is reachable and how big it is. */
  chainHitMultiplier: number;
  /** Hard cap on chain length — added after the first batch pass found
   * chains running to 15-16 hits: chainChanceByHitsSoFar's last entry (0.9)
   * repeats forever once past the table, so the geometric tail averages 10
   * MORE hits past that point with no natural stop. Uncapped, multiplicative
   * per-hit damage means a chain that gets going almost never ends before
   * the enemy is deleted outright, and the fight's outcome collapses to
   * "did ignition fire" rather than staying a race. This caps the escalation
   * without touching the PRD table's shape (still easier to extend once a
   * chain is going — see chainChanceByHitsSoFar). */
  chainMaxHits: number;
  /** While a hero is hot, its next-beat advance is multiplied by this
   * (< 1 = faster) instead of the full attackIntervalSec — the chain
   * visibly accelerates the hot hero's cadence. */
  hotBeatIntervalFactor: number;

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
   * weight 1 for every other role. Also governs a wind-up's target pick. */
  tankTargetWeight: number;
  /** Same, but for a tank that has broken — dropping this near 1 is what
   * makes damage splash onto the rest of the squad once the tank fails. */
  brokenTankTargetWeight: number;

  /** Per-hit damage variance for normal attacks, as a fraction of base
   * damage (e.g. 0.25 = ±25%). NOT applied to chain bonus hits or wind-up
   * hits, which stay exact so escalating tiers and the telegraph's threat
   * read cleanly. 0 disables variance (used by checks/beatsheet.ts to
   * isolate the pure-combat trajectory). */
  damageVariance: number;
}

export interface RunConfig {
  fight: FightConfig;
  fightsPerRun: number;
  bruiser: EnemyArchetype;
  grunt: EnemyArchetype;
  /** Enemy HP scaling for fight index i: maxHp * difficultyRampFactor^i. */
  difficultyRampFactor: number;
  /** Enemy per-hit damage scaling for fight index i: damage *
   * difficultyDamageRampFactor^i — deliberately much gentler than the HP
   * ramp (see sim/run.ts's scaledArchetype docstring for why HP-only scaling
   * has a blind spot against fast, well-protected comps that a small damage
   * ramp is what actually threatens). */
  difficultyDamageRampFactor: number;
  playerN: number;
  enemyN: number;

  deathPolicy: DeathPolicy;

  /** Fraction of each hero's OWN maxHp granted between fights, no input,
   * capped at their own max (see sim/run.ts's healFraction). Deliberately
   * per-hero-proportional rather than a flat HP amount — see healFraction's
   * docstring for why a flat amount silently favors low-maxHp heroes and
   * specifically starves the tank. */
  autoRecoverFraction: number;

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

  // tankBreakFraction retuned down hard from an initial 0.3 during the
  // 2026-08-06 tuning pass: at 0.3 the comfortable comp (bracer+rook+cairn)
  // broke its tank line in ~90-100% of fights regardless of Bracer's own
  // HP/damage. Only a low break threshold (tank has to be nearly dead, not
  // just battered) kept the "IS BREAKING" tell rare rather than routine.
  // Still governs enemy targeting weight and the broken-tank visual as of
  // the 2026-08-07 rebuild — jeopardy no longer routes through this alone
  // (see heatThreshold and windupIntervalSec below), but a tank's line still
  // visibly fails the same way.
  tankBreakFraction: 0.03,
  tankRecoverFraction: 0.2,

  // Heat (2026-08-07 rebuild, replaces the old pity-gate — see this file's
  // FightConfig docstring and DECISIONS.md's "fight causality rebuild"
  // entry). Weighted 1/0.5/1.5 so a hero's OWN job fills its meter at a rate
  // that tracks its actual DPS/HPS, not a flat counter: soaked is weighted
  // down because a tank's damage share is large but slow-accumulating,
  // restored is weighted up because heal-per-beat amounts are small. Strawman
  // values — meant to move by the batch harness (npm run batch --squad <x>),
  // same as everywhere else in this file.
  heatWeightDealt: 1,
  heatWeightSoaked: 0.5,
  heatWeightRestored: 1.5,
  heatThreshold: 110,

  // Wind-up (2026-08-07 rebuild, retuned twice after batch passes — see
  // DECISIONS.md's "fight causality rebuild" entry): the initial strawman
  // (interval 5s, x3.5) combined with the enrage ramp and the larger enemy
  // pool to produce ~0% run completion across every squad. Backed off
  // further on a second pass once the enemy pool itself came back down —
  // 9s cadence, 2.0x base damage still leaves a 45hp Vex on ~27hp
  // (survivable once, dangerous twice) while landing well inside Bracer's
  // 280hp buffer.
  windupIntervalSec: 5,
  windupTelegraphSec: 1.5,
  windupDamageMultiplier: 2.0,

  // Enrage (2026-08-07 rebuild, retuned after the first batch pass): holds
  // at 1x for the first 20s, then ramps a gentle 2.5%/sec — a ~28s fight
  // ends near x1.2 enemy damage, not x1.8. Resets every fight; see this
  // file's FightConfig docstring for why this must NOT compound across the
  // run's 5 fights the way HP scaling does.
  enrageStartSec: 20,
  enrageRampPerSec: 0.025,

  // 2026-08-08: lower start (0.5 -> 0.2) and a longer ramp than the
  // pre-2026-08-08 table, because attempts are now repeatable within a
  // single fight (see heatWeightDealt's docstring) rather than one shot per
  // fight — a flatter, lower-starting curve is what keeps a single dangerous
  // fight from being ~guaranteed to ignite on its first heat-cross.
  ignitionChanceByAttemptsSinceIgnition: [0.2, 0.3, 0.42, 0.55, 0.7, 0.85],

  chainChanceByHitsSoFar: [0.7, 0.75, 0.8, 0.85, 0.9],
  // Multiplicative off the hot hero's own damage (2026-08-07 rebuild,
  // replaces the flat bonusHitStep/bonusHitCap table) — see this file's
  // FightConfig docstring.
  chainHitMultiplier: 1,
  chainMaxHits: 7,
  hotBeatIntervalFactor: 0.6,

  chainTellThreshold: 2,
  chainFullTellThreshold: 3,

  tankTargetWeight: 3,
  brokenTankTargetWeight: 1,

  damageVariance: 0.25,
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  fight: DEFAULT_FIGHT_CONFIG,
  fightsPerRun: 5,
  // HP raised from 160/50, then walked back from an initial 280/90 during
  // the first batch pass (2026-08-07 rebuild) — the larger pool nearly
  // doubled mean fight duration (~40s), which multiplies exposure to the
  // wind-up (every windupIntervalSec) and the enrage ramp (time-based) far
  // more than intended: run completion collapsed to ~0% for every squad.
  // Settled at a more modest bump — enough that a 7-hit chain (see
  // chainMaxHits) still meaningfully changes a fight rather than only
  // punctuating an already-decided one, without stretching fight length
  // enough to make the wind-up/enrage stack unsurvivable. See DECISIONS.md's
  // "fight causality rebuild" entry: enemy pool size, heatThreshold, and
  // windupIntervalSec are tuned together, not as independent knobs.
  bruiser: { role: "bruiser", namePrefix: "Bruiser", maxHp: 190, damage: 9, attackIntervalSec: 1 },
  grunt: { role: "grunt", namePrefix: "Grunt", maxHp: 60, damage: 4, attackIntervalSec: 1 },
  // Raised 1.06 -> 1.12 (2026-08-08): at 1.06 the best squad completed
  // 100% of runs with 0.00 deaths across every one of the 20 possible
  // 3-hero comps — the run literally could not be lost, which is the root
  // cause of the "solved puzzle" verdict as much as the flat dominance
  // ladder was. Retuned by the batch harness toward ~50% completion for the
  // best comp; see checks/chaindist.ts for the pinned target.
  difficultyRampFactor: 1.07,
  // Added 2026-08-08 (see scaledArchetype's docstring): even at 1.12 HP-only,
  // bracer+vex+cairn and vex+cairn+ward — fast kill, real tank, real heal,
  // no weakness on any axis — stayed at ~100% run completion, because their
  // fights are too short to accumulate much HP-ramp exposure. A small per-hit
  // damage ramp is what actually threatens a comp that wins fast.
  difficultyDamageRampFactor: 1.02,
  playerN: 3,
  enemyN: 3,

  deathPolicy: "downAtFightEnd",

  // Converted from a flat autoRecoverHp (200) to a fraction of each hero's
  // OWN maxHp (2026-08-08) — the flat amount fully erased attrition (every
  // squad completed every run at 0.00 deaths) AND, once cut to compensate,
  // inverted the risk dial: at a flat 90, any hero with maxHp <= 90 (Rook,
  // Vex, Ward) was topped off to full every fight regardless of squad, while
  // Bracer (280 maxHp) recovered only ~32% and silently carried the rest as
  // permanent attrition — so the TANK-based "comfortable" squad collapsed to
  // 3.5% run completion while the glass-cannon "greedy" squad rose to 65.9%,
  // exactly backwards. A fraction recovers every hero proportionally to its
  // own max, so the ramp above can raise real difficulty without punishing
  // one archetype specifically. See sim/run.ts's healFraction.
  autoRecoverFraction: 0.55,

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
