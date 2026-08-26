/**
 * Answers Tu's report (2026-08-26 — see the "measure whether CLOCK/WOUNDED
 * actually bite" plan and DECISIONS.md's CLOCK/WOUNDED entry): "enrage and
 * WOUNDED do not have much impact — CLOCK takes too long to increase,
 * WOUNDED triggers too little when enemies burst quickly, and none of it
 * makes the burst-vs-grinder choice matter strategically." Same shape of
 * complaint chainLeverage.ts was built to answer for the chain mechanic
 * (2026-08-22) — a new mechanism, the same treatment: separate "the lever
 * genuinely doesn't move outcomes" from "it moves outcomes but is invisible"
 * from "it moves outcomes but too little to feel."
 *
 * Diagnostics run ahead of this file (batch/report.ts's clockTierHistogram /
 * meanWoundedFireSec / durationPercentiles, added this same pass) already
 * measured the SHAPE of the problem against the default draft: CLOCK tier 1
 * (20s) lands in ~52% of fights, tier 2 (32s) in ~12%, tier 3 (44s) in ~0.3%
 * — decorative past the first step — while WOUNDED fires in ~90% of fights
 * at a MEAN of ~11s, well before CLOCK's first tier can land. This file adds
 * the piece those diagnostics can't answer alone: whether any of it is
 * CAUSAL (does removing/retiming the mechanism change a real outcome?), and
 * whether chain shape's tempo delta is even large enough for CLOCK to price
 * at any tuning.
 *
 * This is a REPORT, not a check — same discipline batch/affinity.ts and
 * batch/chainLeverage.ts established: it answers an open question rather
 * than pinning a known-good value, so it stays out of `npm run check` (wired
 * as `npm run measure:enrage`). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every prior measurement pass.
 *
 * Seed block 400_000-499_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999, and
 * batch/chainLeverage.ts's 300_000-399_999 + 700_000 scratch — see each
 * file's own header). Allocation within the block:
 *   Block 1 (ablation ladder):         400_000 + 1500          -> 401_499
 *   Block 2 tempo pair, baseline cfg:  410_000 + 1500          -> 411_499
 *   Block 2 tempo pair, no-enrage cfg: 413_000 + 1500          -> 414_499
 *   Block 2 tempo pair, retimed cfg:   416_000 + 1500          -> 417_499
 *   Block 3: reuses Block 1's own arms — no new seeds.
 *   Block 4 (perceptibility): pure arithmetic on Blocks 1-2's numbers — no
 *   new simulation.
 *   Preamble self-verification:        490_000 + 25            -> 490_024
 *
 * Same honest limitation as chainLeverage.ts: runFight/runRun's Rng is
 * shared across whatever they simulate, so two arms that differ in ANY way
 * (config override, roster transform) diverge their dice from that point
 * onward. Every block below is a POPULATION comparison (many seeds,
 * aggregated), never a claim about what one specific seed "would have done"
 * under the road not taken.
 */
import { DEFAULT_RUN_CONFIG, type RunConfig, type FightConfig, type ChainProfile } from "../sim/config.js";
import { CHAIN_PROFILES, DEFAULT_DRAFT_ROSTER_IDS, PLAYER_HERO_POOL } from "../sim/heroes.js";
import type { RosterState } from "../sim/roster.js";
import { runArm, printArm, printDetectability, ASSUMED_MINUTES_PER_RUN, type ArmResult } from "./arm.js";
import { baseHeroId } from "./heroChain.js";

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
// --quick divides every block's n by this factor — for fast local iteration
// on the harness itself, NOT for trusting the printed numbers. Real answers
// need the full n's below.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

/** Effect sizes captured by whichever blocks actually ran, for Block 4 to
 * convert into "runs needed to notice" — see that block's own header. Module
 * scope (not local to each `if`) so Block 4 can read them regardless of
 * which earlier blocks executed in this same process. */
const effectSizes: { label: string; p1: number; p2: number }[] = [];

function withFightConfig(overrides: Partial<FightConfig>): RunConfig {
  return { ...cfg, fight: { ...cfg.fight, ...overrides } };
}

// The six config arms under test — named here once so Block 1 and Block 2
// (which re-runs a subset against different rosters) share one definition.
const NO_CLOCK: Partial<FightConfig> = { enrageTierMultipliers: [0, 0, 0] };
const NO_WOUNDED: Partial<FightConfig> = { woundedMultiplier: 0 };
const NO_ENRAGE: Partial<FightConfig> = { ...NO_CLOCK, ...NO_WOUNDED };
// Tiers moved inside the measured p10-p90 duration band (9.1s-33.2s, default
// draft, always-heal — see report.ts's durationPercentiles) instead of
// 20/32/44s, which sit at the median and past p90/p99 respectively. Same
// magnitudes, different timing — isolates whether CLOCK's problem is WHEN it
// fires or HOW MUCH it adds.
const RETIMED_CLOCK: Partial<FightConfig> = { enrageTierSecs: [12, 20, 28] };
const CLOCK_2X: Partial<FightConfig> = { enrageTierMultipliers: [0.7, 1.6, 2.8] };

// --- Self-verification preamble — abort the sweep if it fails ------------

function block1Seeds(): number[] {
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  return Array.from({ length: n }, (_, i) => 400_000 + i);
}

let block1BaselineArm: ArmResult | undefined;

function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = block1Seeds();
  block1BaselineArm = runArm(`baseline n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = block1BaselineArm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm reproduces checks/chaindist.ts's pinned default-draft ` +
      `completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

if (!verifyBaselineMatchesChaindistBand()) {
  console.error("\nenrage-leverage sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — Ablation ladder: is CLOCK/WOUNDED load-bearing at all, and if
// not, is that a magnitude problem or a timing problem? Default draft,
// default fielding, always-heal, IDENTICAL seeds across arms (same
// convention as chainLeverage.ts Block 1).
// =========================================================================

interface Block1Arms {
  baseline: ArmResult;
  noEnrage: ArmResult;
  noClock: ArmResult;
  noWounded: ArmResult;
  retimed: ArmResult;
  clock2x: ArmResult;
}

let block1Arms: Block1Arms | undefined;

function ensureBlock1Arms(): Block1Arms {
  if (block1Arms) return block1Arms;
  const seeds = block1Seeds();
  const baseline = block1BaselineArm ?? runArm(`baseline n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const noEnrage = runArm(`no-enrage n=${seeds.length}`, withFightConfig(NO_ENRAGE), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const noClock = runArm(`no-CLOCK n=${seeds.length}`, withFightConfig(NO_CLOCK), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const noWounded = runArm(`no-WOUNDED n=${seeds.length}`, withFightConfig(NO_WOUNDED), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const retimed = runArm(`retimed CLOCK [12,20,28]s n=${seeds.length}`, withFightConfig(RETIMED_CLOCK), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const clock2x = runArm(`CLOCK 2x magnitude n=${seeds.length}`, withFightConfig(CLOCK_2X), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  block1Arms = { baseline, noEnrage, noClock, noWounded, retimed, clock2x };
  return block1Arms;
}

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — ablation ladder (is CLOCK/WOUNDED load-bearing?) ==========\n");
  const { baseline, noEnrage, noClock, noWounded, retimed, clock2x } = ensureBlock1Arms();
  printArm(baseline, undefined, HEALER_IDS);
  printArm(noEnrage, baseline, HEALER_IDS);
  printArm(noClock, baseline, HEALER_IDS);
  printArm(noWounded, baseline, HEALER_IDS);
  printArm(retimed, baseline, HEALER_IDS);
  printArm(clock2x, baseline, HEALER_IDS);

  const offVsOnDelta = Math.abs(baseline.report.runCompletionRate - noEnrage.report.runCompletionRate) * 100;
  const retimedDelta = Math.abs(baseline.report.runCompletionRate - retimed.report.runCompletionRate) * 100;
  console.log(
    `  READ: no-enrage vs baseline moves completion by ${offVsOnDelta.toFixed(1)} points. ` +
      `${offVsOnDelta < 5 ? "Below the 5-point bar — CLOCK/WOUNDED are NOT load-bearing as shipped." : "Above the 5-point bar — CLOCK/WOUNDED ARE load-bearing."}\n` +
      `  retimed-CLOCK vs baseline moves completion by ${retimedDelta.toFixed(1)} points — ` +
      `${retimedDelta < 5 ? "retiming alone doesn't fix it either; magnitude, not just timing, is undersized." : "retiming alone recovers real leverage — this was a timing bug, not a magnitude one."}\n`,
  );

  effectSizes.push(
    { label: "Block 1: no-enrage vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: noEnrage.report.runCompletionRate },
    { label: "Block 1: no-CLOCK vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: noClock.report.runCompletionRate },
    { label: "Block 1: no-WOUNDED vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: noWounded.report.runCompletionRate },
    { label: "Block 1: retimed CLOCK vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: retimed.report.runCompletionRate },
    { label: "Block 1: CLOCK 2x vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: clock2x.report.runCompletionRate },
  );
}

// =========================================================================
// BLOCK 2 — Does the burst-vs-grinder CHOICE move anything? Holds draft and
// encounters fixed; only each non-healer hero's chainProfile changes, which
// changes how long its chain runs (fight tempo) without changing its
// expected chain VALUE (chainMagnitudeTarget is untouched — the 2026-08-20
// EV-equalization pass's guarantee, same convention chainLeverage.ts's
// monoculture arms rely on).
// =========================================================================

// Default draft's three non-healer heroes (bracer, hollow, rook — cairn/ward
// keep their own healer profiles; a burst/grind axis on HEAL chains isn't
// what CLOCK/WOUNDED's "grinder vs burster" language is about — see
// config.ts's FightConfig docstring). Two profiles spread across three
// heroes, same "not every hero gets a distinct assignment" shape as
// chainLeverage.ts's SCRAMBLE_PROFILE_BY_ID.
const BURST_PROFILE_BY_ID: Record<string, ChainProfile> = {
  bracer: CHAIN_PROFILES.shortFuseSteep,
  hollow: CHAIN_PROFILES.shortFuseSteep,
  rook: CHAIN_PROFILES.shortFuseFlat,
};
const GRIND_PROFILE_BY_ID: Record<string, ChainProfile> = {
  bracer: CHAIN_PROFILES.longFuseFlat,
  hollow: CHAIN_PROFILES.longFuseFlat,
  rook: CHAIN_PROFILES.longFuseSteep,
};

// makePlayerSide mints instance ids as `p${i}_${id}` (see heroChain.ts's
// baseHeroId docstring) — must strip that prefix before the lookup, same
// requirement chainLeverage.ts's scrambleProfiles has, or every hero misses
// the map and this transform silently no-ops.
function withTempoProfiles(roster: RosterState, byId: Record<string, ChainProfile>): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => {
      const profile = byId[baseHeroId(h.id)];
      return profile ? { ...h, chainProfile: profile } : h;
    }),
  };
}

interface TempoPair {
  configLabel: string;
  burst: ArmResult;
  grind: ArmResult;
}

function runTempoPair(configLabel: string, runCfg: RunConfig, seedBase: number, n: number): TempoPair {
  const seeds = Array.from({ length: n }, (_, i) => seedBase + i);
  const burst = runArm(`${configLabel}: burst-leaning n=${n}`, runCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withTempoProfiles(r, BURST_PROFILE_BY_ID),
  );
  const grind = runArm(`${configLabel}: grind-leaning n=${n}`, runCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withTempoProfiles(r, GRIND_PROFILE_BY_ID),
  );
  return { configLabel, burst, grind };
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — tempo pair: does burst-vs-grind move anything, and does enrage change it? ==========\n");
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));

  const pairs: TempoPair[] = [
    runTempoPair("baseline enrage", cfg, 410_000, n),
    runTempoPair("no-enrage", withFightConfig(NO_ENRAGE), 413_000, n),
    runTempoPair("retimed CLOCK", withFightConfig(RETIMED_CLOCK), 416_000, n),
  ];

  const rankings: { configLabel: string; durationDelta: number; completionDelta: number }[] = [];
  for (const { configLabel, burst, grind } of pairs) {
    console.log(`  -- ${configLabel} --`);
    printArm(burst, grind, HEALER_IDS);
    console.log(formatDurationLine(grind));
    const durationDelta = grind.report.meanFightDurationSec - burst.report.meanFightDurationSec;
    const completionDelta = (grind.report.runCompletionRate - burst.report.runCompletionRate) * 100;
    console.log(
      `  READ: grind-leaning runs ${durationDelta.toFixed(2)}s longer than burst-leaning on mean fight duration ` +
        `(a CLOCK tier gap is 12s — ${Math.abs(durationDelta) < 12 ? "below it, so CLOCK cannot price this choice at any tuning." : "at or above it, so CLOCK could plausibly price this choice."}). ` +
        `Completion delta: ${completionDelta >= 0 ? "+" : ""}${completionDelta.toFixed(1)}pt (grind minus burst).\n`,
    );
    rankings.push({ configLabel, durationDelta, completionDelta });
    effectSizes.push({
      label: `Block 2 (${configLabel}): grind-leaning vs burst-leaning (completion)`,
      p1: grind.report.runCompletionRate,
      p2: burst.report.runCompletionRate,
    });
  }

  const baselineRanking = rankings[0]!;
  const rankingFlips = rankings.some(
    (r) => Math.sign(r.completionDelta) !== Math.sign(baselineRanking.completionDelta) && Math.abs(r.completionDelta) > 1,
  );
  console.log(
    `  READ: burst-vs-grind completion ranking ${rankingFlips ? "CHANGES" : "stays the same"} across enrage configs — ` +
      `${rankingFlips ? "enrage is doing real work in deciding which shape wins." : "enrage is not what decides the ranking; whatever separates burst from grind here, it isn't CLOCK/WOUNDED."}\n`,
  );
}

function formatDurationLine(arm: ArmResult): string {
  const p = arm.report.durationPercentiles;
  return (
    `    duration — burst mean vs grind mean printed above; grind's own spread: ` +
    `p10=${p.p10.toFixed(1)}s median=${p.median.toFixed(1)}s p90=${p.p90.toFixed(1)}s`
  );
}

// =========================================================================
// BLOCK 3 — Isolate the fight-1-4 confound: fights 1-4 win at ~94-100%
// (checks/chaindist.ts's documented KNOWN GAP) — enrage may look inert
// because nothing in those fights is close enough to losing to be moved by
// any tax, not because CLOCK/WOUNDED themselves are broken. Re-reads Block
// 1's own arms (no new simulation) for winRateByFightIndex/deathsByFightIndex,
// both already on BatchReport.
// =========================================================================

function formatByFight(label: string, values: number[], asPercent: boolean): string {
  return `  ${label.padEnd(22)}${values.map((v, i) => `f${i + 1}=${asPercent ? (v * 100).toFixed(1) + "%" : v.toFixed(2)}`).join("  ")}`;
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — per-fight-index breakdown (isolating the f1-4 confound) ==========\n");
  const { baseline, noEnrage, retimed } = ensureBlock1Arms();
  for (const arm of [baseline, noEnrage, retimed]) {
    console.log(`  -- ${arm.label} --`);
    console.log(formatByFight("win rate:", arm.report.winRateByFightIndex, true));
    console.log(formatByFight("deaths:", arm.report.deathsByFightIndex, false));
    console.log("");
  }
  const f1to4Delta = baseline.report.winRateByFightIndex
    .slice(0, 4)
    .map((w, i) => Math.abs(w - noEnrage.report.winRateByFightIndex[i]!) * 100);
  const f5Delta = Math.abs(baseline.report.winRateByFightIndex[4]! - noEnrage.report.winRateByFightIndex[4]!) * 100;
  const maxF1to4Delta = Math.max(...f1to4Delta);
  console.log(
    `  READ: no-enrage vs baseline moves f1-f4 win rate by at most ${maxF1to4Delta.toFixed(1)}pt, and f5 by ${f5Delta.toFixed(1)}pt. ` +
      `${maxF1to4Delta < 1 && f5Delta >= 1 ? "Confirmed — enrage's ENTIRE measurable effect is concentrated in fight 5; f1-4 are structurally unreachable regardless of enrage tuning." : "f1-4 move too, or f5 doesn't — the confound isn't the whole story."}\n`,
  );
}

// =========================================================================
// BLOCK 4 — Perceptibility: how many runs would a human need to reliably
// notice each measured effect? Pure arithmetic on Blocks 1-2's own numbers;
// no new simulation. See arm.ts's runsToDetect/printDetectability docstring
// for the two-proportion power calc this uses.
// =========================================================================

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — perceptibility: runs needed to notice each effect ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so Blocks 1-2's effect sizes are available)\n");
  } else {
    console.log(`  Two-proportion power estimate (alpha=0.05 two-sided, 80% power), converted to hours at\n`);
    console.log(`  an assumed ${ASSUMED_MINUTES_PER_RUN} min/run. This is what answers "or have I not played enough?" directly.\n`);
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("enrage-leverage sweep complete.");
