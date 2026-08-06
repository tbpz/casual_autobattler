import type { RunConfig } from "../sim/config.js";
import type { RunResult } from "../sim/run.js";

/**
 * Aggregates N runs into the distribution report PROTOTYPE_PLAN.md's Phase 2
 * calls for: win rate per fight index, run-completion rate, chain-length
 * histogram, fraction of wins decided by a 3+ chain, plus a few extras
 * (ignition rate, mean duration, deaths/run) useful for spotting *why* a
 * target is missed, not just that it is.
 *
 * Three metrics added for the 2026-08-04 legibility rewrite, each a direct
 * test of one named risk from that plan:
 *  - fractionWinsWithNoChain: the "cascade is the big win, not the only win"
 *    guardrail (DECISIONS.md 2026-07-29). If this collapses toward 0%, the
 *    per-hero combat model has snowballed too hard — ordinary combat can no
 *    longer win a fight unassisted.
 *  - gateCrossRate: whether the dip (now caused by the enemy bruiser rather
 *    than a scripted DPS curve) still reliably happens.
 *  - failsafeRate: should be ~0% always — fights are meant to resolve by
 *    wipe now that the 30s timer is gone; any failsafe hit means a fight
 *    stalled and the sim's maxFightSec safety net had to step in.
 *
 * Two more added for the 2026-08-06 legibility pass (see DECISIONS.md's
 * "jeopardy no longer mandatory" and "spectacle gated on payoff" entries):
 *  - dipRate: fraction of fights where the player's tank line ever broke (or
 *    there was no tank to break). Target ~20-30% for a comfortable comp —
 *    down from ~100% under the old always-mandatory gate.
 *  - fullSpectacleRate: fraction of fights that hit chainFullTellThreshold+
 *    (the shake/loud-callout tier). This MUST equal fractionWinsWithChain3Plus
 *    by construction (both count the same chain length) — the metric exists
 *    so a future change to the tell thresholds can't silently reintroduce
 *    the RC1 bug (spectacle firing far more often than the payoff it
 *    advertises) without a batch number catching it.
 */
export interface BatchReport {
  n: number;
  runCompletionRate: number;
  /** Win rate at each fight index, conditioned on the run having reached it
   * (a run that already ended never "loses" fight 4 — it never got there). */
  winRateByFightIndex: number[];
  chainLengthHistogram: Record<number, number>;
  fractionWinsWithChain3Plus: number;
  fractionWinsWithNoChain: number;
  gateCrossRate: number;
  failsafeRate: number;
  ignitionRate: number;
  dipRate: number;
  fullSpectacleRate: number;
  meanFightDurationSec: number;
  meanDeathsPerRun: number;
}

/**
 * Incremental aggregator: consumes one RunResult at a time via `add()` so the
 * batch CLI never has to hold N full RunResults (each carrying ~600
 * per-tick-snapshot fight records) in memory at once — doing that for a few
 * thousand runs across the full policy matrix ran the process out of heap.
 */
export class BatchAggregator {
  private n = 0;
  private completed = 0;
  private reachedCount: number[];
  private wonCount: number[];
  private chainHist: Record<number, number> = {};
  private winsTotal = 0;
  private winsWithChain3Plus = 0;
  private winsWithNoChain = 0;
  private gateOpenedFights = 0;
  private failsafeFights = 0;
  private ignitedFights = 0;
  private dipFights = 0;
  private fullSpectacleFights = 0;
  private totalFights = 0;
  private totalDuration = 0;
  private totalDeaths = 0;
  private cfg: RunConfig;

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.reachedCount = new Array(cfg.fightsPerRun).fill(0) as number[];
    this.wonCount = new Array(cfg.fightsPerRun).fill(0) as number[];
  }

  add(r: RunResult): void {
    this.n++;
    if (r.outcome === "complete") this.completed++;

    for (const f of r.fights) {
      this.reachedCount[f.fightIndex] = (this.reachedCount[f.fightIndex] ?? 0) + 1;
      if (f.outcome === "win") {
        this.wonCount[f.fightIndex] = (this.wonCount[f.fightIndex] ?? 0) + 1;
        this.winsTotal++;
        if (f.chainLength >= 3) this.winsWithChain3Plus++;
        if (f.chainLength === 0) this.winsWithNoChain++;
      }
    }

    for (const fr of r.fightResults) {
      this.totalFights++;
      if (fr.ignited) this.ignitedFights++;
      if (fr.endReason === "failsafe") this.failsafeFights++;
      if (fr.events.some((e) => e.type === "gateOpen")) this.gateOpenedFights++;
      if (fr.dipOccurred) this.dipFights++;
      if (fr.chainLength >= this.cfg.fight.chainFullTellThreshold) this.fullSpectacleFights++;
      this.totalDuration += fr.durationSec;
      this.chainHist[fr.chainLength] = (this.chainHist[fr.chainLength] ?? 0) + 1;
    }

    const lastFight = r.fights[r.fights.length - 1];
    if (lastFight) {
      this.totalDeaths +=
        lastFight.outcome === "win" ? this.cfg.playerN - lastFight.livingHeroesAfter : this.cfg.playerN;
    }
  }

  finalize(): BatchReport {
    return {
      n: this.n,
      runCompletionRate: this.completed / this.n,
      winRateByFightIndex: this.wonCount.map((w, i) => (this.reachedCount[i] ? w / (this.reachedCount[i] as number) : 0)),
      chainLengthHistogram: this.chainHist,
      fractionWinsWithChain3Plus: this.winsTotal > 0 ? this.winsWithChain3Plus / this.winsTotal : 0,
      fractionWinsWithNoChain: this.winsTotal > 0 ? this.winsWithNoChain / this.winsTotal : 0,
      gateCrossRate: this.totalFights > 0 ? this.gateOpenedFights / this.totalFights : 0,
      failsafeRate: this.totalFights > 0 ? this.failsafeFights / this.totalFights : 0,
      ignitionRate: this.totalFights > 0 ? this.ignitedFights / this.totalFights : 0,
      dipRate: this.totalFights > 0 ? this.dipFights / this.totalFights : 0,
      fullSpectacleRate: this.totalFights > 0 ? this.fullSpectacleFights / this.totalFights : 0,
      meanFightDurationSec: this.totalFights > 0 ? this.totalDuration / this.totalFights : 0,
      meanDeathsPerRun: this.totalDeaths / this.n,
    };
  }
}

export function formatReport(report: BatchReport, label: string): string {
  const histKeys = Object.keys(report.chainLengthHistogram)
    .map(Number)
    .sort((a, b) => a - b);
  const lines = [
    `=== ${label} (n=${report.n}) ===`,
    `  run completion rate:   ${(report.runCompletionRate * 100).toFixed(1)}%`,
    `  win rate by fight:     ${report.winRateByFightIndex
      .map((w, i) => `f${i + 1}=${(w * 100).toFixed(1)}%`)
      .join("  ")}`,
    `  dip rate:              ${(report.dipRate * 100).toFixed(1)}%  (tank line ever broke, or no tank)`,
    `  ignition rate:         ${(report.ignitionRate * 100).toFixed(1)}%`,
    `  gate-cross rate:       ${(report.gateCrossRate * 100).toFixed(1)}%`,
    `  full-spectacle rate:   ${(report.fullSpectacleRate * 100).toFixed(1)}%  (should track wins-with-chain>=3, below)`,
    `  failsafe rate:         ${(report.failsafeRate * 100).toFixed(1)}%  (target: 0%)`,
    `  wins with chain>=3:    ${(report.fractionWinsWithChain3Plus * 100).toFixed(1)}%`,
    `  wins with no chain:    ${(report.fractionWinsWithNoChain * 100).toFixed(1)}%  (big win, not only win)`,
    `  chain length hist:     ${histKeys.map((k) => `${k}:${report.chainLengthHistogram[k]}`).join("  ")}`,
    `  mean fight duration:   ${report.meanFightDurationSec.toFixed(2)}s`,
    `  mean deaths per run:   ${report.meanDeathsPerRun.toFixed(2)}`,
  ];
  return lines.join("\n");
}
