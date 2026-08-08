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
 *    there was no tank to break).
 *  - fullSpectacleRate: fraction of ALL fights (win or loss) that hit
 *    chainFullTellThreshold+ (the shake/loud-callout tier).
 *  - fractionFightsWithChain3Plus (2026-08-08): fraction of ALL fights
 *    (same population as fullSpectacleRate, hardcoded at 3 rather than the
 *    configurable chainFullTellThreshold) that reached chain length >= 3.
 *    These two MUST match whenever chainFullTellThreshold is 3 — the metric
 *    exists so a future change to the tell threshold can't silently
 *    reintroduce the RC1 bug (spectacle firing far more often than the
 *    payoff it advertises) without a batch number catching it. (Compared
 *    against fractionWinsWithChain3Plus — a WINS-only figure — before
 *    2026-08-08; that comparison only worked while nearly every fight was a
 *    win. Once real losses became common the two populations diverged by
 *    construction, independent of any actual bug.)
 *
 * Three more added for the 2026-08-07 causality rebuild (see DECISIONS.md's
 * "fight causality rebuild" entry) — the old build's per-fight win rates sat
 * at 89-100% for every squad the player tried, so one 5-fight playthrough
 * could never surface a difference; these exist to catch that regression
 * before a playtest has to:
 *  - heatCrossRate: fraction of fights where some hero's heat crossed
 *    heatThreshold (replaces gateCrossRate — the old pity-gate is gone, this
 *    is its heat-based successor: how often a fight becomes ELIGIBLE for an
 *    ignition roll at all).
 *  - fightDurationStdDevSec: spread of fight length, not just its mean — a
 *    system with real contingency should show fights resolving at visibly
 *    different lengths, not clustering tightly around the mean the way a
 *    closed-form DPS race does.
 *  - windupDeathRate: fraction of fights where a wind-up hit directly killed
 *    a player hero (a heroDown event on the same tick as a windupHit) — the
 *    most direct check that the wind-up mechanic is actually doing its job
 *    (punishing fragility) rather than just being visual noise.
 *
 * One more added for the 2026-08-08 "heat is spent" rebuild — the direct
 * measurement of the player's own complaint ("the cascade fires when the
 * fight's already decided, not when I'm in danger"):
 *  - fractionChainsWhileLosing: of all successful ignition rolls, what
 *    fraction fired while the player's pool was below 40% of its fight-start
 *    max. Pre-rebuild this was ≈0 (winning comps took 0.00 deaths per run,
 *    so danger and the cascade never co-occurred) — target ≥35%.
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
  heatCrossRate: number;
  failsafeRate: number;
  ignitionRate: number;
  dipRate: number;
  fullSpectacleRate: number;
  meanFightDurationSec: number;
  fightDurationStdDevSec: number;
  windupDeathRate: number;
  meanDeathsPerRun: number;
  fractionChainsWhileLosing: number;
  fractionFightsWithChain3Plus: number;
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
  private heatCrossedFights = 0;
  private failsafeFights = 0;
  private ignitedFights = 0;
  private dipFights = 0;
  private fullSpectacleFights = 0;
  private windupDeathFights = 0;
  private totalFights = 0;
  private totalDuration = 0;
  private totalDurationSq = 0;
  private totalDeaths = 0;
  private chainsFired = 0;
  private chainsWhileLosing = 0;
  private fightsWithChain3Plus = 0;
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
      if (fr.events.some((e) => e.type === "heatFull")) this.heatCrossedFights++;
      if (fr.dipOccurred) this.dipFights++;
      if (fr.chainLength >= this.cfg.fight.chainFullTellThreshold) this.fullSpectacleFights++;
      if (fr.chainLength >= 3) this.fightsWithChain3Plus++;
      if (this.hasWindupDeath(fr.events)) this.windupDeathFights++;
      this.totalDuration += fr.durationSec;
      this.totalDurationSq += fr.durationSec * fr.durationSec;
      this.chainHist[fr.chainLength] = (this.chainHist[fr.chainLength] ?? 0) + 1;
      this.countChainsWhileLosing(fr);
    }

    const lastFight = r.fights[r.fights.length - 1];
    if (lastFight) {
      this.totalDeaths +=
        lastFight.outcome === "win" ? this.cfg.playerN - lastFight.livingHeroesAfter : this.cfg.playerN;
    }
  }

  /** For every successful ignition roll in this fight, looks up the tick
   * snapshot at that moment and checks whether the player's pool was below
   * 40% of its fight-start max (snapshot.playerMaxHp doesn't change within a
   * fight — sideMaxHp sums maxHp regardless of alive, so it's exactly the
   * fight-start figure) — the direct measurement of "did the cascade fire
   * from a losing position," the player's own cherished-moment description. */
  private countChainsWhileLosing(fr: RunResult["fightResults"][number]): void {
    for (const e of fr.events) {
      if (e.type !== "ignitionRoll" || !e.fired) continue;
      this.chainsFired++;
      const snap = fr.snapshots.find((s) => Math.abs(s.t - e.t) < 1e-9);
      if (snap && snap.playerMaxHp > 0 && snap.playerHp / snap.playerMaxHp < 0.4) this.chainsWhileLosing++;
    }
  }

  /** True if some player hero's death (a heroDown event) landed on the same
   * tick as a windupHit — i.e. the wind-up itself was the killing blow,
   * not just incidental damage earlier in the fight. */
  private hasWindupDeath(events: RunResult["fightResults"][number]["events"]): boolean {
    const windupTicks = events.filter((e) => e.type === "windupHit").map((e) => e.t);
    if (windupTicks.length === 0) return false;
    return events.some(
      (e) => e.type === "heroDown" && e.side === "player" && windupTicks.some((wt) => Math.abs(wt - e.t) < 1e-9),
    );
  }

  finalize(): BatchReport {
    const meanDuration = this.totalFights > 0 ? this.totalDuration / this.totalFights : 0;
    const meanDurationSq = this.totalFights > 0 ? this.totalDurationSq / this.totalFights : 0;
    const durationVariance = Math.max(meanDurationSq - meanDuration * meanDuration, 0);
    return {
      n: this.n,
      runCompletionRate: this.completed / this.n,
      winRateByFightIndex: this.wonCount.map((w, i) => (this.reachedCount[i] ? w / (this.reachedCount[i] as number) : 0)),
      chainLengthHistogram: this.chainHist,
      fractionWinsWithChain3Plus: this.winsTotal > 0 ? this.winsWithChain3Plus / this.winsTotal : 0,
      fractionWinsWithNoChain: this.winsTotal > 0 ? this.winsWithNoChain / this.winsTotal : 0,
      heatCrossRate: this.totalFights > 0 ? this.heatCrossedFights / this.totalFights : 0,
      failsafeRate: this.totalFights > 0 ? this.failsafeFights / this.totalFights : 0,
      ignitionRate: this.totalFights > 0 ? this.ignitedFights / this.totalFights : 0,
      dipRate: this.totalFights > 0 ? this.dipFights / this.totalFights : 0,
      fullSpectacleRate: this.totalFights > 0 ? this.fullSpectacleFights / this.totalFights : 0,
      meanFightDurationSec: meanDuration,
      fightDurationStdDevSec: Math.sqrt(durationVariance),
      windupDeathRate: this.totalFights > 0 ? this.windupDeathFights / this.totalFights : 0,
      meanDeathsPerRun: this.totalDeaths / this.n,
      fractionChainsWhileLosing: this.chainsFired > 0 ? this.chainsWhileLosing / this.chainsFired : 0,
      fractionFightsWithChain3Plus: this.totalFights > 0 ? this.fightsWithChain3Plus / this.totalFights : 0,
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
    `  heat-cross rate:       ${(report.heatCrossRate * 100).toFixed(1)}%  (some hero's heat crossed threshold)`,
    `  full-spectacle rate:   ${(report.fullSpectacleRate * 100).toFixed(1)}%  (should track wins-with-chain>=3, below)`,
    `  windup death rate:     ${(report.windupDeathRate * 100).toFixed(1)}%  (a wind-up was the killing blow)`,
    `  failsafe rate:         ${(report.failsafeRate * 100).toFixed(1)}%  (target: 0%)`,
    `  wins with chain>=3:    ${(report.fractionWinsWithChain3Plus * 100).toFixed(1)}%`,
    `  wins with no chain:    ${(report.fractionWinsWithNoChain * 100).toFixed(1)}%  (big win, not only win)`,
    `  chain length hist:     ${histKeys.map((k) => `${k}:${report.chainLengthHistogram[k]}`).join("  ")}`,
    `  mean fight duration:   ${report.meanFightDurationSec.toFixed(2)}s  (stddev ${report.fightDurationStdDevSec.toFixed(2)}s)`,
    `  mean deaths per run:   ${report.meanDeathsPerRun.toFixed(2)}`,
    `  chains while losing:   ${(report.fractionChainsWhileLosing * 100).toFixed(1)}%  (<40% pool at ignition — target >=35%)`,
  ];
  return lines.join("\n");
}
