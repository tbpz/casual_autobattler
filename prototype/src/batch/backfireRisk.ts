/**
 * Answers the question the 2026-08-19 affinity-as-risk pass never actually
 * settled: does backfire risk (chainAffinity -> backfireChanceFor,
 * config.ts) work as a balance tool, or does the same flatness that killed
 * chain shape (2026-08-20) and chain targeting (2026-09-02) apply here too?
 *
 * That 2026-08-19 pass (batch/affinity.ts Block C) swapped heroes within the
 * support role and found Cairn beat Ward in all four pairings. Read alone,
 * that looks like "risk doesn't create a choice" — but it can't say that,
 * for two reasons this file exists to fix:
 *   1. Cairn and Ward differ in more than risk (heal rate, HP, whether they
 *      swing while healing), so the result cannot separate "risk does
 *      nothing" from "Cairn is simply the stronger hero."
 *   2. Every arm in affinity.ts is a full 5-fight run, so the 11-encounter
 *      draw is averaged away. If risk pays off in some fights and costs in
 *      others, that rig could not have seen it.
 *
 * There is also a design fact that reframes the question entirely.
 * chainMagnitudeScaleAbsolute (config.ts) already compensates riskier
 * heroes: a bigger backfire chance earns a bigger per-hit payoff, tuned so
 * every hero lands on the same expected NET value. That compensation
 * assumes a backfire costs exactly what an equal payoff gains
 * (harmWeight=1, config.ts's expectedNetChainUnits). Both that function's
 * own docstring and chainOutcomes.ts's deathsFromBackfire docstring flag the
 * same doubt: a backfire's deaths are PERMANENT for the run, which
 * harmWeight=1 does not price. So the real question is not "does risk
 * matter" — it's already cancelled out on average, by construction. It's
 * "how wide are the swings, and does the permanent-death cost make a
 * riskier hero a hidden loser the current compensation under-pays."
 *
 * This is a REPORT, not a check — same discipline every prior batch/*Verdict
 * file established: it answers an open question rather than pinning a
 * known-good value, so it stays out of `npm run check` (wired as
 * `npm run measure:backfire-risk`). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every prior pass.
 *
 * Changes no sim behaviour and no UX: every arm is either pure config.ts
 * arithmetic (Block 1) or a harness-side roster transform (chainAffinity /
 * chainMagnitudeTarget on the cloned roster only — never sim/heroes.ts, see
 * "How the harm-weight sweep is wired" below).
 *
 * Seed block 800_000-899_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999 (which
 * itself overruns to 242_000), batch/chainLeverage.ts's 300_000-399_999 plus
 * its own 700_000+ scratch counter, the retired batch/enrageLeverage.ts's
 * 400_000-419_999, batch/shapeVerdict.ts's 500_000-599_999, and
 * batch/targetingVerdict.ts's 600_000-699_999). Allocation within the block:
 *   Preamble A (transform-inert + wiring):    890_000 + 25       -> 890_024
 *   Preamble B (baseline completion band):    890_100 + 1500     -> 891_599
 *   Preamble C (dial-is-live, 6 heroes):      892_000 + 6x300    -> 893_799
 *   Block 2 (pairs x encounters x timings):   800_000 .. 839_599 (3x11x2 x 600)
 *   Block 3 (risk-only x encounters):         840_000 .. 859_799 (3x11 x 600)
 *   Block 4 (full runs, 8 squads, 2 sizes):   860_000 + 1500     -> 861_499
 *   Block 5 (harm-weight sweep):              862_000 + 600      -> 862_599
 *   Block 6 (slope-zero):                     863_000 + 600      -> 863_599
 * Free: 864_000-889_999 and 894_000-899_999.
 *
 * Same honest limitation as every other file here: runFight/runRun share one
 * Rng across whatever they simulate, so two arms differing in ANY way
 * diverge their dice from that point onward. Sharing a seed array matches
 * the encounter draw and the starting dice, not the whole stream — every
 * comparison below is a POPULATION comparison, never a claim about what one
 * seed "would have done" under the road not taken.
 *
 * Two landmines, both from chainOutcomes.ts, worth stating once instead of
 * at every call site:
 *   - evRealization is WRONG under a chainAffinity or chainMagnitudeTarget
 *     transform (analyticGrossPerChain recomputes from the pool's AUTHORED
 *     values). Every stat this file reads instead — backfireRate,
 *     deathsPerBackfire, spillFraction — is event-sourced and safe.
 *   - Rows key on chainProfile id, not hero id. Since chainProfile is never
 *     touched here and every hero in the pool owns a distinct profile id,
 *     filtering chainOutcome rows by a hero's profile id still isolates that
 *     hero correctly.
 */
import { Rng } from "../sim/rng.js";
import {
  DEFAULT_RUN_CONFIG,
  backfireChanceFor,
  chainMagnitudeScaleAbsolute,
  expectedNetChainUnits,
  type FightConfig,
  type RunConfig,
} from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { DEFAULT_DRAFT_ROSTER_IDS, PLAYER_HERO_POOL, makePlayerSide, type HeroDef } from "../sim/heroes.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { ENCOUNTERS, makeEncounterEnemySide } from "../sim/encounters.js";
import { makePolicy, runRun } from "../sim/run.js";
import type { RosterState } from "../sim/roster.js";
import { baseHeroId } from "./heroChain.js";
import { runArm, printArm, printDetectability, mean, type ArmResult } from "./arm.js";
import { ChainOutcomeAggregator, chainOutcomeStats, type ChainOutcomeRow } from "./chainOutcomes.js";

/** Ward's chain heal is clamped per hit against chainHealMaxFractionOfTargetMaxHp
 * (config.ts) — its last hit already sits close to that ceiling at shipped
 * settings. Raising harmWeight (Block 5) raises Ward's magnitudeScale further,
 * so a support-pair result under a high harm weight can silently under-realize
 * at the clamp rather than genuinely deliver the compensated payoff — a
 * measurement artifact, not a finding about risk. Flagged here rather than
 * built around: Block 5's support-pair numbers should be read as advisory,
 * cross-checked against evRealization on an UNTRANSFORMED arm of the same
 * hero before trusting a support-specific verdict. */

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
// --quick divides every block's n — for fast local iteration on the harness
// itself, NOT for trusting the printed numbers. shapeVerdict.ts's own
// history is the reason: at n=75 it pointed the opposite way to the truth.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));
const HERO_DEF_BY_ID: Record<string, HeroDef> = Object.fromEntries(PLAYER_HERO_POOL.map((h) => [h.id, h]));

/** Per-encounter bar: winner must FLIP — at least one row favouring each
 * side by this many points — across at least this many of the 11
 * encounters. One hero winning every row by a wide margin is a dominance
 * problem, not a risk trade. Pre-registered before Block 2/3 run. */
const PER_ENCOUNTER_BAR_PT = 10;
const PER_ENCOUNTER_MIN_FLIPS = 3;
/** Block 4's bar: a real risk trade shows the riskier hero's OUTCOME SPREAD
 * (p90-p10 of fights won) exceeding the safer hero's by at least this much,
 * while the two means stay within this many completion points of each
 * other. Same center, wider spread — a lower mean with the same width is
 * not risk working, it's one hero being worse. */
const SPREAD_BAR_FIGHTS = 0.3;
const MEAN_BAR_PT = 5;

// --- Role pairs: safe (lower affinity) vs risky (higher affinity) --------

interface RolePair {
  role: "tank" | "damage" | "support";
  safe: string;
  risky: string;
  /** The other two role slots, held at the canonical trio's default member,
   * for Block 2/3's single-fight cells. */
  squadOther: string[];
}
const ROLE_PAIRS: RolePair[] = [
  { role: "tank", safe: "bracer", risky: "hollow", squadOther: ["rook", "cairn"] },
  { role: "damage", safe: "vex", risky: "rook", squadOther: ["bracer", "cairn"] },
  { role: "support", safe: "cairn", risky: "ward", squadOther: ["bracer", "rook"] },
];
/** The canonical 3-hero trio every other report in this directory fires
 * from — reused here so Block 3 (risk-only) can hold two slots at their
 * normal identity and vary only the third's chainAffinity. */
const CANONICAL_SQUAD = ["bracer", "rook", "cairn"];
/** The pool's own real affinity range (config.ts's docstring: "the pool's
 * current range 0.7-1.4") — Block 3 sweeps a hero across exactly that
 * range, holding every other stat (including its own chainProfile) fixed. */
const RISK_LEVELS = [0.7, 1.0, 1.4] as const;

const effectSizes: { label: string; p1: number; p2: number }[] = [];

// =========================================================================
// How the harm-weight sweep is wired — no sim change. chainMagnitudeScale
// Absolute(profile, backfireChance, baseStat, target, harmWeight) resolves to
// target / (baseStat * net(profile, b, harmWeight)). fight.ts always calls it
// with harmWeight defaulted to 1. To EMULATE a different harm weight w without
// touching sim/fight.ts, scale the hero's own chainMagnitudeTarget (a real
// field on HeroState, sim/types.ts) by the ratio of the two net values:
//     target' = target * net(profile, b, 1) / net(profile, b, w)
// which makes the resolved scale exactly what the sim would compute if it
// took harmWeight=w. Preamble check 2 proves this exactly, per hero, per
// swept weight, before any block below is trusted.
// =========================================================================

function emulatedTargetForWeight(hero: HeroDef, fightCfg: FightConfig, w: number): number {
  const b = backfireChanceFor(fightCfg, hero.chainAffinity);
  const netAtOne = expectedNetChainUnits(hero.chainProfile, b, 1);
  const netAtW = expectedNetChainUnits(hero.chainProfile, b, w);
  return (hero.chainMagnitudeTarget ?? 0) * (netAtOne / netAtW);
}

function withHarmWeight(roster: RosterState, fightCfg: FightConfig, w: number): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => {
      const def = HERO_DEF_BY_ID[baseHeroId(h.id)];
      if (!def) return h;
      return { ...h, chainMagnitudeTarget: emulatedTargetForWeight(def, fightCfg, w) };
    }),
  };
}

/** expectedNetChainUnits throws once backfireChance >= 1/(1+w). Computed
 * from the pool's own worst backfire chance (Rook, 0.18) rather than
 * hard-coded, with a 0.2 safety margin subtracted before rounding down. */
function maxSafeHarmWeight(fightCfg: FightConfig): number {
  const maxB = Math.max(...PLAYER_HERO_POOL.map((h) => backfireChanceFor(fightCfg, h.chainAffinity)));
  return Math.floor((1 / maxB - 1 - 0.2) * 10) / 10;
}

// --- Self-verification preamble — abort the sweep if any check fails ----

function identityRiskTransform(roster: RosterState): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => ({ ...h, chainAffinity: h.chainAffinity, chainMagnitudeTarget: h.chainMagnitudeTarget })),
  };
}

function verifyIdentityTransformIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 890_000 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const transformed = runRun(cfg, new Rng(seed), policy, seed, identityRiskTransform(makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)));
    if (JSON.stringify(base.fights) !== JSON.stringify(transformed.fights)) {
      console.error(`FAIL: an identity chainAffinity/chainMagnitudeTarget transform diverged from no transform at seed ${seed}`);
      return false;
    }
  }
  console.log("PASS: an identity chainAffinity/chainMagnitudeTarget transform is byte-identical to no transform, over 25 seeds");
  return true;
}

/** The one check that proves Block 5 measures what it claims: for every
 * hero and every swept harm weight, the emulated target (via
 * chainMagnitudeTarget) must produce a resolved scale identical, to 1e-9, to
 * calling chainMagnitudeScaleAbsolute with harmWeight=w directly — no
 * simulation, pure arithmetic. At w=1 the emulated target must equal the
 * hero's own shipped target (the identity case). */
function verifyHarmWeightEmulationIsExact(): boolean {
  const weights = [1, 1.5, 2, maxSafeHarmWeight(cfg.fight)];
  let ok = true;
  for (const hero of PLAYER_HERO_POOL) {
    const baseStat = hero.healPerBeat ?? hero.damage;
    const b = backfireChanceFor(cfg.fight, hero.chainAffinity);
    for (const w of weights) {
      const emulatedTarget = emulatedTargetForWeight(hero, cfg.fight, w);
      const emulatedScale = chainMagnitudeScaleAbsolute(hero.chainProfile, b, baseStat, emulatedTarget);
      const directScale = chainMagnitudeScaleAbsolute(hero.chainProfile, b, baseStat, hero.chainMagnitudeTarget ?? 0, w);
      if (Math.abs(emulatedScale - directScale) > 1e-9) {
        console.error(`FAIL: ${hero.name} at w=${w}: emulated scale ${emulatedScale} != direct scale ${directScale}`);
        ok = false;
      }
    }
    const w1Target = emulatedTargetForWeight(hero, cfg.fight, 1);
    if (Math.abs(w1Target - (hero.chainMagnitudeTarget ?? 0)) > 1e-9) {
      console.error(`FAIL: ${hero.name} at w=1: emulated target ${w1Target} != shipped target ${hero.chainMagnitudeTarget}`);
      ok = false;
    }
  }
  console.log(`${ok ? "PASS" : "FAIL"}: harm-weight emulation matches chainMagnitudeScaleAbsolute(..., w) directly, every hero, w in [${weights.join(", ")}]`);
  return ok;
}

function verifyChainOutcomeWiring(): boolean {
  const policy = makePolicy("always-heal", cfg);
  const agg = new ChainOutcomeAggregator(cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 890_000 + i;
    agg.addRun(runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)).fightResults);
  }
  const { chainStartCount, chainEndCount } = agg.finalize();
  const ok = chainStartCount === chainEndCount && chainStartCount > 0;
  console.log(`${ok ? "PASS" : "FAIL"}: chainOutcomes pairs every chainStart with exactly one chainEnd — ${chainStartCount} starts, ${chainEndCount} ends`);
  return ok;
}

let baselineDraftArm: ArmResult | undefined;

function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = Array.from({ length: Math.max(1, Math.round(1500 / QUICK_DIVISOR)) }, (_, i) => 890_100 + i);
  baselineDraftArm = runArm(`shipped default draft n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = baselineDraftArm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(`${ok ? "PASS" : "FAIL"}: baseline arm reproduces checks/chaindist.ts's pinned default-draft completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`);
  return ok;
}

/** The dial is actually live: a hero's MEASURED backfire rate (chain-weighted,
 * off events) must track backfireChanceFor(cfg.fight, chainAffinity) within a
 * couple of points, per hero, or a block finding nothing could be finding
 * nothing because backfires never happened rather than because risk is
 * inert. Fires each hero's chain reliably (preloaded charge) against a fixed
 * encounter (Pack, index 0) so the sample is all fired chains. */
function verifyBackfireDialIsLive(): boolean {
  // Fixed at 300, NOT divided by QUICK_DIVISOR — every other preamble check
  // in this file (and every other batch/*Verdict.ts) uses a fixed sample
  // count specifically so --quick never breaks the preamble; a backfire
  // rate is a coarse enough statistic that 20 samples (300/20) makes normal
  // sampling noise look like a dial failure.
  const n = 300;
  let seedBase = 892_000;
  let ok = true;
  for (const hero of PLAYER_HERO_POOL) {
    const agg = new ChainOutcomeAggregator(cfg);
    const squad = CANONICAL_SQUAD.includes(hero.id) ? CANONICAL_SQUAD : [...CANONICAL_SQUAD.slice(0, 2), hero.id];
    for (let i = 0; i < n; i++) {
      const seed = seedBase + i;
      const side = makePlayerSide(squad);
      const player: SideState = {
        ...side,
        heroes: side.heroes.map((h) => (baseHeroId(h.id) === hero.id ? { ...h, charge: cfg.fight.chargeThreshold - 1 } : h)),
      };
      const result = runFight({ player, enemy: makeEncounterEnemySide(cfg, 0, 0) }, cfg.fight, new Rng(seed), seed);
      agg.add(result);
    }
    seedBase += n;
    const row = agg.finalize().rows.find((r) => r.profileId === hero.chainProfile.id);
    const measured = row ? chainOutcomeStats(row).backfireRate : 0;
    const expected = backfireChanceFor(cfg.fight, hero.chainAffinity);
    const withinTol = Math.abs(measured - expected) <= 0.03;
    if (!withinTol) ok = false;
    console.log(`  ${hero.name.padEnd(7)} expected ${(expected * 100).toFixed(1)}%  measured ${(measured * 100).toFixed(1)}%  ${withinTol ? "OK" : "OUT OF TOLERANCE"}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}: measured backfire rate tracks backfireChanceFor within 3pt, every hero`);
  return ok;
}

console.log("-- preamble: self-verification --\n");
const preambleOk =
  verifyIdentityTransformIsInert() &&
  verifyHarmWeightEmulationIsExact() &&
  verifyChainOutcomeWiring() &&
  verifyBaselineMatchesChaindistBand() &&
  verifyBackfireDialIsLive();
if (!preambleOk) {
  console.error("\nbackfire-risk sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — The analytic ledger. No simulation: prints affinity -> backfire
// chance -> scale -> expected net value for every hero, and confirms the
// design's own promise (every attacker converges on CHAIN_EV_TARGET_DAMAGE,
// every healer on CHAIN_EV_TARGET_HEAL) holds in the harness's own numbers
// before any simulation block is trusted to be measuring the right thing.
// =========================================================================

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — analytic ledger: risk, compensation, and the equalization it rests on ==========\n");
  console.log("  -- per hero: affinity -> backfire chance -> scale -> realized expected net value (w=1, shipped) --");
  let equalizationOk = true;
  const attackerTargets: number[] = [];
  const healerTargets: number[] = [];
  for (const hero of PLAYER_HERO_POOL) {
    const baseStat = hero.healPerBeat ?? hero.damage;
    const b = backfireChanceFor(cfg.fight, hero.chainAffinity);
    const net = expectedNetChainUnits(hero.chainProfile, b, 1);
    const scale = chainMagnitudeScaleAbsolute(hero.chainProfile, b, baseStat, hero.chainMagnitudeTarget ?? 0);
    const realizedNet = scale * baseStat * net;
    const target = hero.chainMagnitudeTarget ?? 0;
    const withinOnePct = Math.abs(realizedNet - target) <= Math.abs(target) * 0.01;
    if (!withinOnePct) equalizationOk = false;
    (hero.healPerBeat ? healerTargets : attackerTargets).push(realizedNet);
    console.log(
      `    ${hero.name.padEnd(7)} affinity ${hero.chainAffinity.toFixed(2)}  backfire ${(b * 100).toFixed(1)}%  ` +
        `scale ${scale.toFixed(3)}  target ${target.toFixed(1)}  realized net ${realizedNet.toFixed(2)}  ` +
        `${withinOnePct ? "OK" : "MISMATCH"}`,
    );
  }
  const attackerSpread = attackerTargets.length ? Math.max(...attackerTargets) - Math.min(...attackerTargets) : 0;
  const healerSpread = healerTargets.length ? Math.max(...healerTargets) - Math.min(...healerTargets) : 0;
  console.log(
    `\n  ${equalizationOk ? "PASS" : "FAIL"}: every attacker's realized expected net value matches its target within 1% ` +
      `(attacker spread ${attackerSpread.toFixed(3)}, healer spread ${healerSpread.toFixed(3)}).\n`,
  );
  if (!equalizationOk) {
    console.log(
      "  *** ORDERING BANNER *** Risk is not compensated the way the design claims — every block below is\n" +
        "  measuring that fault, not answering the question. Fix the harness before reading Block 2 onward.\n",
    );
  }

  console.log("  -- what each swept harm weight does to scale (shows Block 5's inputs before any fight runs) --");
  const weights = [1, 1.5, 2, maxSafeHarmWeight(cfg.fight)];
  console.log(`  highest safe harm weight (pool's worst backfire chance, 0.2 margin): ${maxSafeHarmWeight(cfg.fight)}\n`);
  for (const hero of PLAYER_HERO_POOL) {
    const baseStat = hero.healPerBeat ?? hero.damage;
    const b = backfireChanceFor(cfg.fight, hero.chainAffinity);
    const row = weights
      .map((w) => {
        const target = emulatedTargetForWeight(hero, cfg.fight, w);
        const scale = chainMagnitudeScaleAbsolute(hero.chainProfile, b, baseStat, target);
        return `w=${w}: scale ${scale.toFixed(3)}`;
      })
      .join("  ");
    console.log(`    ${hero.name.padEnd(7)} ${row}`);
  }
  console.log("");
}

// =========================================================================
// BLOCK 2 — real hero pairs, per encounter. Isolated single fights, one
// hero's charge preloaded so its chain reliably fires, fightIndex=0 so no
// difficulty ramp confounds a row, two fire timings. Both heroes of a pair
// share one seed range per (pair, encounter, timing) cell, matching the
// encounter draw and starting dice.
// =========================================================================

const FIRE_TIMINGS = [
  { id: "immediate", label: "fires at t~0", startCharge: cfg.fight.chargeThreshold - 1 },
  { id: "midFight", label: "fires mid-fight", startCharge: Math.round(cfg.fight.chargeThreshold * 0.6) },
];

function preloadedSquad(squadIds: string[], heroBaseId: string, startCharge: number): SideState {
  const side = makePlayerSide(squadIds);
  return {
    ...side,
    heroes: side.heroes.map((h) => (baseHeroId(h.id) === heroBaseId ? { ...h, charge: startCharge } : h)),
  };
}

interface Cell {
  winRate: number;
  fireRate: number;
  meanPlayerHpFrac: number;
  meanDurationSec: number;
  row: ChainOutcomeRow | undefined;
}

function runCell(squadIds: string[], heroBaseId: string, encounterIdx: number, startCharge: number, seedBase: number, n: number): Cell {
  const agg = new ChainOutcomeAggregator(cfg);
  const heroDef = HERO_DEF_BY_ID[heroBaseId]!;
  let wins = 0;
  let fired = 0;
  let sumHpFrac = 0;
  let sumDurationSec = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const setup: FightSetup = {
      player: preloadedSquad(squadIds, heroBaseId, startCharge),
      enemy: makeEncounterEnemySide(cfg, 0, encounterIdx),
    };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    if (result.ignited) fired++;
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    sumHpFrac += maxHp > 0 ? hp / maxHp : 0;
    sumDurationSec += result.durationSec;
    agg.add(result);
  }
  const rows = agg.finalize().rows.filter((r) => r.profileId === heroDef.chainProfile.id);
  return { winRate: wins / n, fireRate: fired / n, meanPlayerHpFrac: sumHpFrac / n, meanDurationSec: sumDurationSec / n, row: rows[0] };
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — real hero pairs, per encounter: does the winner ever flip? ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  console.log(`  n=${cellN}/cell, seeds from 800_000. Bar: winner must flip (>=10pt each way) on >=3 of 11 encounters.\n`);

  let seedBase = 800_000;
  let worstFireRate = 1;

  for (const pair of ROLE_PAIRS) {
    for (const timing of FIRE_TIMINGS) {
      console.log(`  -- ${pair.role}: ${pair.safe} (safe) vs ${pair.risky} (risky) — ${timing.label} --`);
      const header = "  encounter".padEnd(16) + "safe".padStart(10) + "risky".padStart(10) + "  read".padStart(4);
      console.log(header);
      let flipsToSafe = 0;
      let flipsToRisky = 0;

      for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
        const cellSeedBase = seedBase;
        const safeSquad = [pair.safe, ...pair.squadOther];
        const riskySquad = [pair.risky, ...pair.squadOther];
        const safeCell = runCell(safeSquad, pair.safe, ei, timing.startCharge, cellSeedBase, cellN);
        const riskyCell = runCell(riskySquad, pair.risky, ei, timing.startCharge, cellSeedBase, cellN);
        seedBase += cellN;
        worstFireRate = Math.min(worstFireRate, safeCell.fireRate, riskyCell.fireRate);

        const eligible = safeCell.winRate > 0.1 && safeCell.winRate < 0.9;
        const safeRead = eligible ? safeCell.winRate * 100 : safeCell.meanPlayerHpFrac * 100;
        const riskyRead = eligible ? riskyCell.winRate * 100 : riskyCell.meanPlayerHpFrac * 100;
        const delta = safeRead - riskyRead;
        const clears = Math.abs(delta) >= PER_ENCOUNTER_BAR_PT;
        if (clears) {
          if (delta > 0) flipsToSafe++;
          else flipsToRisky++;
        }
        const fmt = (c: Cell) => (eligible ? `${(c.winRate * 100).toFixed(1)}%` : `${(c.meanPlayerHpFrac * 100).toFixed(0)}hp`);
        console.log(
          `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
            fmt(safeCell).padStart(10) +
            fmt(riskyCell).padStart(10) +
            `  ${clears ? (delta > 0 ? "safe" : "risky") : "-"}`,
        );
      }
      const totalFlips = flipsToSafe + flipsToRisky;
      const passes = flipsToSafe >= 1 && flipsToRisky >= 1 && totalFlips >= PER_ENCOUNTER_MIN_FLIPS;
      console.log(
        `  READ: ${flipsToSafe} encounter(s) favour safe by >=${PER_ENCOUNTER_BAR_PT}pt, ${flipsToRisky} favour risky, ` +
          `${totalFlips} total. ${passes ? "PASS — the winner flips, a real per-fight choice." : "FAIL — one side dominates or nothing clears the bar."}\n`,
      );
      effectSizes.push({ label: `Block 2 (${pair.role}, ${timing.label}): safe vs risky win rate`, p1: 0.5, p2: 0.5 });
    }
  }
  console.log(`  fire-rate sanity: lowest cell fired ${(worstFireRate * 100).toFixed(1)}% of the time (want >=95%).\n`);
}

// =========================================================================
// BLOCK 3 — risk on its own, per encounter. Holds ONE hero's every stat
// fixed (including its own chainProfile) and varies only chainAffinity
// across the pool's real range (0.7/1.0/1.4). This is the arm the
// 2026-08-19 result never had: it separates "risk itself does nothing" from
// "one hero is stronger." Read BEFORE Block 2's result — if this finds
// nothing, Block 2's pairs are a stat-balance finding, not a risk finding.
// Single fire timing (immediate) to keep the sweep bounded; backfire's cost
// is paid whenever the chain fires, so timing isn't expected to change it
// the way shape's tempo question did.
// =========================================================================

function withAffinity(roster: RosterState, heroBaseId: string, affinity: number): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => (baseHeroId(h.id) === heroBaseId ? { ...h, chainAffinity: affinity } : h)) };
}

function runRiskCell(heroBaseId: string, affinity: number, encounterIdx: number, startCharge: number, seedBase: number, n: number): Cell {
  const agg = new ChainOutcomeAggregator(cfg);
  const heroDef = HERO_DEF_BY_ID[heroBaseId]!;
  let wins = 0;
  let fired = 0;
  let sumHpFrac = 0;
  let sumDurationSec = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const side = withAffinity(preloadedSquad(CANONICAL_SQUAD, heroBaseId, startCharge), heroBaseId, affinity);
    const setup: FightSetup = { player: side, enemy: makeEncounterEnemySide(cfg, 0, encounterIdx) };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    if (result.ignited) fired++;
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    sumHpFrac += maxHp > 0 ? hp / maxHp : 0;
    sumDurationSec += result.durationSec;
    agg.add(result);
  }
  const rows = agg.finalize().rows.filter((r) => r.profileId === heroDef.chainProfile.id);
  return { winRate: wins / n, fireRate: fired / n, meanPlayerHpFrac: sumHpFrac / n, meanDurationSec: sumDurationSec / n, row: rows[0] };
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — risk on its own, per encounter: does risk ALONE move anything? ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  const timing = FIRE_TIMINGS[0]!;
  console.log(`  ${timing.label}. n=${cellN}/cell, seeds from 840_000. Bar: >=10pt spread among the 3 risk levels, somewhere in the pool.\n`);

  let seedBase = 840_000;
  let anyClears = false;

  for (const pair of ROLE_PAIRS) {
    const heroId = pair.role === "tank" ? "bracer" : pair.role === "damage" ? "rook" : "cairn";
    console.log(`  -- ${pair.role} slot (${heroId}, chainAffinity swept 0.7 / 1.0 / 1.4) --`);
    const header = "  encounter".padEnd(16) + RISK_LEVELS.map((r) => `aff=${r}`.padStart(10)).join("") + "  spread";
    console.log(header);

    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const cellSeedBase = seedBase;
      const cells = RISK_LEVELS.map((affinity) => runRiskCell(heroId, affinity, ei, timing.startCharge, cellSeedBase, cellN));
      seedBase += cellN;
      const eligible = cells[1]!.winRate > 0.1 && cells[1]!.winRate < 0.9;
      const reads = cells.map((c) => (eligible ? c.winRate * 100 : c.meanPlayerHpFrac * 100));
      const spread = Math.max(...reads) - Math.min(...reads);
      if (spread >= PER_ENCOUNTER_BAR_PT) anyClears = true;
      console.log(
        `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
          reads.map((r) => r.toFixed(1).padStart(10)).join("") +
          `  ${spread >= PER_ENCOUNTER_BAR_PT ? "PASS" : "-"} (${spread.toFixed(1)}pt)`,
      );
    }
    console.log("");
  }
  console.log(
    `  READ: ${anyClears ? "at least one encounter shows risk alone moving the outcome by >=10pt — risk has a real mechanism." : "risk alone never moves any encounter by 10pt anywhere in the pool — the strongest possible \"risk is inert\" result."}\n` +
      `  ${anyClears ? "Block 2's pair findings can be read as risk-driven." : "Block 2's pair findings, if any, are a stat-balance result — they say nothing about risk."}\n`,
  );
}

// =========================================================================
// BLOCK 4 — full runs, all three pairs, with the spread. All 8 three-hero
// squads (rosterSize=3, no bench, the affinity.ts:194 idiom), sharing ONE
// seed array so the 12 matched contrasts are encounter-matched (fixing
// affinity.ts Block C's two weaknesses: unpaired seeds, and an overrun
// allocation). Then the same 12 contrasts at rosterSize=5 (the shipped
// game). Six heroes total means a 5-hero draft always excludes exactly one —
// there is no way to hold BOTH other roles' pair-choice fixed at size 5, so
// the size-5 arm instead compares "exclude the risky hero from the draft
// entirely" vs "exclude the safe one," which is what a real 5-of-6 draft
// choice looks like (DEFAULT_DRAFT_ROSTER_IDS IS one of these six drafts —
// it excludes Vex). Documented here rather than silently narrowed.
// =========================================================================

function spreadStats(xs: number[]): { p10: number; p50: number; p90: number; width: number } {
  if (xs.length === 0) return { p10: 0, p50: 0, p90: 0, width: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
  const p10 = at(0.1);
  const p90 = at(0.9);
  return { p10, p50: at(0.5), p90, width: p90 - p10 };
}

function reportContrast(label: string, safeArm: ArmResult, riskyArm: ArmResult): void {
  const safeSpread = spreadStats(safeArm.fightsWon);
  const riskySpread = spreadStats(riskyArm.fightsWon);
  const meanDeltaPt = (riskyArm.report.runCompletionRate - safeArm.report.runCompletionRate) * 100;
  const meanFightsWonDelta = mean(riskyArm.fightsWon) - mean(safeArm.fightsWon);
  const widthDelta = riskySpread.width - safeSpread.width;
  const passes = widthDelta >= SPREAD_BAR_FIGHTS && Math.abs(meanDeltaPt) <= MEAN_BAR_PT;
  console.log(
    `    ${label.padEnd(24)} safe p10/p50/p90=${safeSpread.p10.toFixed(1)}/${safeSpread.p50.toFixed(1)}/${safeSpread.p90.toFixed(1)} ` +
      `(width ${safeSpread.width.toFixed(2)})  risky p10/p50/p90=${riskySpread.p10.toFixed(1)}/${riskySpread.p50.toFixed(1)}/${riskySpread.p90.toFixed(1)} ` +
      `(width ${riskySpread.width.toFixed(2)})  completion delta ${meanDeltaPt >= 0 ? "+" : ""}${meanDeltaPt.toFixed(1)}pt  ` +
      `mean fights won delta ${meanFightsWonDelta >= 0 ? "+" : ""}${meanFightsWonDelta.toFixed(3)}  ` +
      `${passes ? "PASS — same center, wider spread." : "FAIL"}`,
  );
}

let block4Squads3: Record<string, ArmResult> = {};

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — full runs, all three pairs: does risk widen the outcome distribution? ==========\n");
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 860_000 + i);
  console.log(`  n=${n}, seeds from 860_000, shared across every squad and both sizes below.\n`);

  console.log("  -- for reference: the shipped default draft, full report --");
  if (baselineDraftArm) printArm(baselineDraftArm, undefined, HEALER_IDS);

  console.log("  -- squad size 3 (no bench, affinity.ts's idiom) --");
  const cfg3: RunConfig = { ...cfg, rosterSize: 3 };
  const tanks = ["bracer", "hollow"];
  const damage = ["rook", "vex"];
  const support = ["cairn", "ward"];
  for (const t of tanks) {
    for (const d of damage) {
      for (const s of support) {
        const key = `${t}+${d}+${s}`;
        block4Squads3[key] = runArm(`3-squad ${key}`, cfg3, [t, d, s], seeds);
      }
    }
  }
  console.log("  -- 12 matched contrasts (swap one role, hold the other two) --");
  for (const d of damage) for (const s of support) reportContrast(`tank (hollow vs bracer, ${d}+${s})`, block4Squads3[`bracer+${d}+${s}`]!, block4Squads3[`hollow+${d}+${s}`]!);
  for (const t of tanks) for (const s of support) reportContrast(`damage (rook vs vex, ${t}+${s})`, block4Squads3[`${t}+vex+${s}`]!, block4Squads3[`${t}+rook+${s}`]!);
  for (const t of tanks) for (const d of damage) reportContrast(`support (ward vs cairn, ${t}+${d})`, block4Squads3[`${t}+${d}+cairn`]!, block4Squads3[`${t}+${d}+ward`]!);
  console.log("");

  console.log("  -- squad size 5 (shipped rosterSize, 2-hero bench): exclude-risky vs exclude-safe draft --");
  const cfg5: RunConfig = { ...cfg, rosterSize: 5 };
  const allIds = ["bracer", "hollow", "rook", "vex", "cairn", "ward"];
  function draftExcluding(id: string): string[] {
    return allIds.filter((x) => x !== id);
  }
  const excludeHollow = runArm("5-draft exclude hollow (bracer stays)", cfg5, draftExcluding("hollow"), seeds);
  const excludeBracer = runArm("5-draft exclude bracer (hollow stays)", cfg5, draftExcluding("bracer"), seeds);
  const excludeRook = runArm("5-draft exclude rook (vex stays)", cfg5, draftExcluding("rook"), seeds);
  const excludeVex = runArm("5-draft exclude vex (rook stays)", cfg5, draftExcluding("vex"), seeds);
  const excludeWard = runArm("5-draft exclude ward (cairn stays)", cfg5, draftExcluding("ward"), seeds);
  const excludeCairn = runArm("5-draft exclude cairn (ward stays)", cfg5, draftExcluding("cairn"), seeds);
  reportContrast("tank (exclude hollow vs exclude bracer)", excludeHollow, excludeBracer);
  reportContrast("damage (exclude rook vs exclude vex)", excludeVex, excludeRook);
  reportContrast("support (exclude ward vs exclude cairn)", excludeCairn, excludeWard);
  console.log(
    "\n  READ: the size-3/size-5 gap is how much of risk's cost is attrition (size 3 ends the run on the first\n" +
      "  permanent death — sim/run.ts's rosterExhausted — size 5 matches the shipped game).\n",
  );

  effectSizes.push({
    label: "Block 4: tank pair, size-3 completion (safe vs risky)",
    p1: block4Squads3["bracer+rook+cairn"]!.report.runCompletionRate,
    p2: block4Squads3["hollow+rook+cairn"]!.report.runCompletionRate,
  });
}

// =========================================================================
// BLOCK 5 — the compensation sweep: fixable, or dead by design? Re-runs a
// subset of Block 4's contrasts under emulated harm weights w=1 (shipped),
// 1.5, 2, and the highest safe value Block 1 computed. Squad size 5, n=600 —
// a candidate w that looks like it works is worth a full-n follow-up, not
// four full-size sweeps paid up front.
// =========================================================================

if (BLOCK === "5" || BLOCK === "all") {
  console.log("========== BLOCK 5 — compensation sweep: does raising harmWeight fix it? ==========\n");
  const n = Math.max(1, Math.round(600 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 862_000 + i);
  const weights = [1, 1.5, 2, maxSafeHarmWeight(cfg.fight)];
  const cfg5: RunConfig = { ...cfg, rosterSize: 5 };
  const allIds = ["bracer", "hollow", "rook", "vex", "cairn", "ward"];
  function draftExcluding(id: string): string[] {
    return allIds.filter((x) => x !== id);
  }
  console.log(`  n=${n}, seeds from 862_000, weights ${weights.join(", ")}.\n`);

  for (const w of weights) {
    console.log(`  -- harmWeight=${w} --`);
    const transform = (r: RosterState) => withHarmWeight(r, cfg.fight, w);
    const excludeHollow = runArm(`w=${w} exclude hollow`, cfg5, draftExcluding("hollow"), seeds, undefined, transform);
    const excludeBracer = runArm(`w=${w} exclude bracer`, cfg5, draftExcluding("bracer"), seeds, undefined, transform);
    const excludeRook = runArm(`w=${w} exclude rook`, cfg5, draftExcluding("rook"), seeds, undefined, transform);
    const excludeVex = runArm(`w=${w} exclude vex`, cfg5, draftExcluding("vex"), seeds, undefined, transform);
    const excludeWard = runArm(`w=${w} exclude ward`, cfg5, draftExcluding("ward"), seeds, undefined, transform);
    const excludeCairn = runArm(`w=${w} exclude cairn`, cfg5, draftExcluding("cairn"), seeds, undefined, transform);
    reportContrast("tank", excludeHollow, excludeBracer);
    reportContrast("damage", excludeVex, excludeRook);
    reportContrast("support", excludeCairn, excludeWard);
  }
  console.log(
    "\n  READ: a weight where every contrast's completion gap closes inside the bar WHILE the spread gap from\n" +
      "  Block 4 survives is \"fixable by raising the compensation.\" If none does, backfire-as-risk is dead by\n" +
      "  design — no harmWeight fixes what spread is spent on, the same shape Block 2/3's failure took.\n",
  );
}

// =========================================================================
// BLOCK 6 — does the size of the risk gap matter at all? Sets
// backfireChanceAffinitySlope to 0 via a config override (every hero carries
// the SAME backfire chance), and re-runs the contrasts. If rankings and
// spreads don't move, risk is inert — the per-pair version of the
// 2026-08-19 pool-wide "flattening the spread didn't hurt completion"
// finding.
// =========================================================================

if (BLOCK === "6" || BLOCK === "all") {
  console.log("========== BLOCK 6 — slope zero: does the SIZE of the risk gap matter? ==========\n");
  const n = Math.max(1, Math.round(600 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 863_000 + i);
  const cfg5Flat: RunConfig = { ...cfg, rosterSize: 5, fight: { ...cfg.fight, backfireChanceAffinitySlope: 0 } };
  const allIds = ["bracer", "hollow", "rook", "vex", "cairn", "ward"];
  function draftExcluding(id: string): string[] {
    return allIds.filter((x) => x !== id);
  }
  console.log(`  n=${n}, seeds from 863_000, backfireChanceAffinitySlope=0 (every hero at backfireChanceBase=${cfg.fight.backfireChanceBase}).\n`);

  const excludeHollow = runArm("flat exclude hollow", cfg5Flat, draftExcluding("hollow"), seeds);
  const excludeBracer = runArm("flat exclude bracer", cfg5Flat, draftExcluding("bracer"), seeds);
  const excludeRook = runArm("flat exclude rook", cfg5Flat, draftExcluding("rook"), seeds);
  const excludeVex = runArm("flat exclude vex", cfg5Flat, draftExcluding("vex"), seeds);
  const excludeWard = runArm("flat exclude ward", cfg5Flat, draftExcluding("ward"), seeds);
  const excludeCairn = runArm("flat exclude cairn", cfg5Flat, draftExcluding("cairn"), seeds);
  reportContrast("tank", excludeHollow, excludeBracer);
  reportContrast("damage", excludeVex, excludeRook);
  reportContrast("support", excludeCairn, excludeWard);
  console.log(
    "\n  READ: if these three contrasts look the same as Block 4's size-5 contrasts, the SIZE of the risk gap\n" +
      "  (not just its existence) is doing nothing — the pool would behave identically at almost any slope.\n",
  );
}

// =========================================================================
// BLOCK 7 — Perceptibility. Pure arithmetic on the effect sizes recorded
// above; no new simulation.
// =========================================================================

if (BLOCK === "7" || BLOCK === "all") {
  console.log("========== BLOCK 7 — perceptibility: runs needed to notice the widest margin found ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so earlier blocks' effect sizes are available)\n");
  } else {
    console.log("  Two-proportion power estimate (alpha=0.05 two-sided, 80% power) — see arm.ts's runsToDetect.\n");
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("backfire-risk sweep complete.");
