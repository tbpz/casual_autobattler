/**
 * Shared arm-comparison harness for batch/*.ts measurement REPORTS (not
 * checks — see affinity.ts's and chainLeverage.ts's own headers for that
 * distinction). One "arm" is N runs of a fixed draft/fieldPick/roster-
 * transform combination over a fixed seed sequence; every report in this
 * repo that compares arms builds on the same shape so numbers from different
 * reports stay comparable side by side.
 *
 * Extracted from affinity.ts (2026-08-22, chain-leverage-measurement pass —
 * see DECISIONS.md and the "validate the feeling" plan) when
 * chainLeverage.ts needed the identical machinery — no behavior change,
 * affinity.ts's own arms print exactly what they did before this file
 * existed.
 */
import type { RunConfig } from "../sim/config.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makePolicy, runRun, type RunResult } from "../sim/run.js";
import type { FieldPick, RosterState } from "../sim/roster.js";
import { Rng } from "../sim/rng.js";
import { BatchAggregator, formatReport } from "./report.js";
import { HeroChainAggregator, formatHeroChainReport } from "./heroChain.js";

export function mcnemar(a: boolean[], b: boolean[]): { onlyA: number; onlyB: number; z: number } {
  let onlyA = 0;
  let onlyB = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && !b[i]) onlyA++;
    else if (!a[i] && b[i]) onlyB++;
  }
  const z = onlyA + onlyB > 0 ? (onlyA - onlyB) / Math.sqrt(onlyA + onlyB) : 0;
  return { onlyA, onlyB, z };
}

export function mean(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

// --- Perceptibility: how many runs would a human need to reliably notice a
// measured effect? Extracted from chainLeverage.ts's Block 5 (2026-08-26,
// enrage-leverage-measurement pass — see enrageLeverage.ts) when
// enrageLeverage.ts needed the identical machinery, same move that created
// this file out of affinity.ts originally — no behavior change, both
// reports' Block 5 output is byte-identical to before this extraction.
//
// Two-proportion power calc (alpha=0.05 two-sided, 80% power) — a
// conservative TWO-SAMPLE estimate; a report's own paired same-seed
// comparisons (McNemar, printArm above) need somewhat fewer, but this stays a
// defensible upper bound without assuming a specific pairing. ------------

const Z_ALPHA_2 = 1.959964; // alpha=0.05, two-sided
const Z_BETA = 0.8416212; // 80% power

export function runsToDetect(p1: number, p2: number): number {
  const diff = p1 - p2;
  if (Math.abs(diff) < 1e-9) return Infinity;
  const variance = p1 * (1 - p1) + p2 * (1 - p2);
  return Math.ceil(((Z_ALPHA_2 + Z_BETA) ** 2 * variance) / (diff * diff));
}

// Assumption, stated plainly: a played run (5 fights, watched, plus pick
// screens) takes roughly 4 minutes. This is a strawman for converting "runs
// needed" into "hours needed" — see STATE.md/ATTRIBUTION_TEST.md for the
// actual per-fight pacing this is estimating from.
export const ASSUMED_MINUTES_PER_RUN = 4;

export function printDetectability(label: string, p1: number, p2: number): void {
  const n = runsToDetect(p1, p2);
  const hours = (n * ASSUMED_MINUTES_PER_RUN) / 60;
  const nStr = Number.isFinite(n) ? n.toLocaleString() : "infinite (no measured difference)";
  const hoursStr = Number.isFinite(n) ? `~${hours < 1 ? hours.toFixed(2) : Math.round(hours).toLocaleString()}h` : "n/a";
  console.log(
    `  ${label}: ${(Math.abs(p1 - p2) * 100).toFixed(1)}pt delta -> ${nStr} runs to detect at 80% power -> ${hoursStr} ` +
      `(at ${ASSUMED_MINUTES_PER_RUN} min/run)`,
  );
}

export interface ArmResult {
  label: string;
  report: ReturnType<BatchAggregator["finalize"]>;
  heroReport: ReturnType<HeroChainAggregator["finalize"]>;
  completed: boolean[];
  fightsWon: number[];
}

/** Runs N seeds of one draft/fieldPick/roster-transform/policy combination
 * and aggregates both the whole-run report and the per-hero chain rollup. */
export function runArm(
  label: string,
  runCfg: RunConfig,
  draftIds: string[],
  seeds: number[],
  fieldPick?: FieldPick,
  transformRoster?: (r: RosterState) => RosterState,
  policyName: "never-spend" | "always-heal" | "always-upgrade" = "always-heal",
): ArmResult {
  const policy = makePolicy(policyName, runCfg);
  const agg = new BatchAggregator(runCfg);
  const heroAgg = new HeroChainAggregator();
  const completed: boolean[] = [];
  const fightsWon: number[] = [];

  for (const seed of seeds) {
    let roster: RosterState = makePlayerSide(draftIds);
    if (transformRoster) roster = transformRoster(roster);
    const result: RunResult = runRun(runCfg, new Rng(seed), policy, seed, roster, fieldPick ? { fieldPick } : undefined);
    agg.add(result);
    heroAgg.add(result, draftIds);
    completed.push(result.outcome === "complete");
    fightsWon.push(result.fightsWon);
  }

  return { label, report: agg.finalize(), heroReport: heroAgg.finalize(), completed, fightsWon };
}

/** Prints one arm's report, optionally diffed against a baseline arm
 * (completion delta, mean-fights-won delta, McNemar paired significance) and
 * optionally followed by the per-hero chain rollup (pass healerIds to get
 * it — omit when the arm's draft/rollup isn't the point, e.g. a field-pick
 * headroom arm). */
export function printArm(arm: ArmResult, baseline?: ArmResult, healerIds?: Set<string>): void {
  console.log(formatReport(arm.report, arm.label));
  console.log(`  mean fights won:       ${mean(arm.fightsWon).toFixed(3)}`);
  console.log(`  f5 win rate:           ${(arm.report.winRateByFightIndex[4]! * 100).toFixed(1)}%`);
  if (baseline) {
    const mfwDelta = mean(arm.fightsWon) - mean(baseline.fightsWon);
    const complDelta = (arm.report.runCompletionRate - baseline.report.runCompletionRate) * 100;
    const { onlyA, onlyB, z } = mcnemar(arm.completed, baseline.completed);
    console.log(
      `  vs ${baseline.label}: completion ${complDelta >= 0 ? "+" : ""}${complDelta.toFixed(1)}pt, ` +
        `mean fights won ${mfwDelta >= 0 ? "+" : ""}${mfwDelta.toFixed(3)}, ` +
        `McNemar onlyThis=${onlyA} onlyBaseline=${onlyB} z=${z.toFixed(2)}`,
    );
  }
  if (healerIds) {
    console.log(formatHeroChainReport(arm.heroReport, arm.label, healerIds));
  }
  console.log("");
}
