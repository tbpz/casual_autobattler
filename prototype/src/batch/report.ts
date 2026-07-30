import type { RunConfig } from "../sim/config.js";
import type { RunResult } from "../sim/run.js";

/**
 * Aggregates N runs into the distribution report PROTOTYPE_PLAN.md's Phase 2
 * calls for: win rate per fight index, run-completion rate, chain-length
 * histogram, fraction of wins decided by a 3+ chain, plus a few extras
 * (ignition rate, mean duration, deaths/run) useful for spotting *why* a
 * target is missed, not just that it is.
 */
export interface BatchReport {
  n: number;
  runCompletionRate: number;
  /** Win rate at each fight index, conditioned on the run having reached it
   * (a run that already ended never "loses" fight 4 — it never got there). */
  winRateByFightIndex: number[];
  chainLengthHistogram: Record<number, number>;
  fractionWinsWithChain3Plus: number;
  ignitionRate: number;
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
  private ignitedFights = 0;
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
      }
    }

    for (const fr of r.fightResults) {
      this.totalFights++;
      if (fr.ignited) this.ignitedFights++;
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
      ignitionRate: this.totalFights > 0 ? this.ignitedFights / this.totalFights : 0,
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
    `  ignition rate:         ${(report.ignitionRate * 100).toFixed(1)}%`,
    `  wins with chain>=3:    ${(report.fractionWinsWithChain3Plus * 100).toFixed(1)}%`,
    `  chain length hist:     ${histKeys.map((k) => `${k}:${report.chainLengthHistogram[k]}`).join("  ")}`,
    `  mean fight duration:   ${report.meanFightDurationSec.toFixed(2)}s`,
    `  mean deaths per run:   ${report.meanDeathsPerRun.toFixed(2)}`,
  ];
  return lines.join("\n");
}
