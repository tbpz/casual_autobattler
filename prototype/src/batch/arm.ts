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
