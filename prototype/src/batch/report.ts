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
 *  - fractionFightsWithChain5Plus (2026-08-08, hardcoded value moved 3->5 on
 *    2026-08-15 alongside chainFullTellThreshold itself — see DECISIONS.md's
 *    chain-payoff-axis entry): fraction of ALL fights (same population as
 *    fullSpectacleRate, hardcoded rather than reading the configurable
 *    chainFullTellThreshold) that reached this hardcoded chain length. These
 *    two MUST match whenever the hardcoded length above equals
 *    chainFullTellThreshold's current value — the metric exists so a future
 *    change to the tell threshold can't silently reintroduce the RC1 bug
 *    (spectacle firing far more often than the payoff it advertises)
 *    without a batch number catching it. Being hardcoded rather than
 *    cfg-driven is the whole point: it catches the renderer's actual
 *    spectacle trigger silently decoupling from cfg.chainFullTellThreshold,
 *    which a cfg-driven metric could never detect. Update the hardcoded
 *    value here (and its literal name) whenever chainFullTellThreshold's
 *    OWN default moves, same as this pass did going 3->5 — the guard's
 *    value is being pinned to the current design threshold, not to any
 *    particular number for its own sake. (Compared against
 *    fractionWinsWithChain3Plus — a WINS-only figure — before 2026-08-08;
 *    that comparison only worked while nearly every fight was a win. Once
 *    real losses became common the two populations diverged by
 *    construction, independent of any actual bug.)
 *
 * Two more added for the 2026-08-07 causality rebuild (see DECISIONS.md's
 * "fight causality rebuild" entry) — the old build's per-fight win rates sat
 * at 89-100% for every squad the player tried, so one 5-fight playthrough
 * could never surface a difference; these exist to catch that regression
 * before a playtest has to:
 *  - fightDurationStdDevSec: spread of fight length, not just its mean — a
 *    system with real contingency should show fights resolving at visibly
 *    different lengths, not clustering tightly around the mean the way a
 *    closed-form DPS race does.
 *  - windupDeathRate: fraction of fights where a wind-up hit directly killed
 *    a player hero (a heroDown event on the same tick as a windupHit) — the
 *    most direct check that the wind-up mechanic is actually doing its job
 *    (punishing fragility) rather than just being visual noise.
 *
 * One more added for the 2026-08-08 "heat is spent" rebuild, still relevant
 * post-2026-08-14 chain rebuild — the direct measurement of the player's own
 * complaint ("the cascade fires when the fight's already decided, not when
 * I'm in danger"):
 *  - fractionChainsWhileLosing: of all fired chains, what fraction fired
 *    while the player's pool was below 40% of its fight-start max.
 *
 * Two more added for the 2026-08-14 chain rebuild (see DECISIONS.md) —
 * `heatCrossRate` is GONE: firing is now deterministic the instant a hero's
 * charge crosses chargeThreshold (no separate roll), so "charge crossed" and
 * "a chain fired" (chainRate, renamed from ignitionRate) are now the same
 * fact — keeping both would just print the same number twice:
 *  - chainRate (renamed from ignitionRate): fraction of fights where some
 *    hero's charge crossed chargeThreshold and fired.
 *  - backfireRate: fraction of ALL fights where at least one fired chain was
 *    a backfire.
 *  - fractionChainsBackfired: of all fired chains, what fraction backfired —
 *    should track cfg.fight.backfireChance directly; the number to watch
 *    while tuning that knob.
 *
 * meanDeathsPerRun's aggregation fixed 2026-08-09 (boring-middle root-cause
 * pass): it used to read ONLY r.fights[r.fights.length-1].livingHeroesAfter
 * and subtract from cfg.playerN. That total happened to be arithmetically
 * correct under the OLD rules (a fixed-size squad that only ever shrinks
 * under downAtFightEnd, so the last fight's living count was always
 * cumulative) — but it threw away WHICH fight each death happened in, which
 * is exactly the diagnostic that would have surfaced RC4 (deaths
 * concentrated in fights the run could not lose, arriving as an invisible
 * tax by fight 5) directly from a batch run instead of needing a separate
 * --death onlyOnLoss A/B to find it. Now walks r.fights in order, diffing
 * consecutive livingHeroesAfter (or crediting the full remaining roster to a
 * loss fight), and reports both the run total AND a per-fight-index
 * breakdown (deathsByFightIndex) — the baseline is cfg.rosterSize (the
 * 5-hero draft), not cfg.playerN (the 3 fielded per fight), now that
 * roster.ts's draft/field split (same pass) replaced deathPolicy: the
 * "read only the last fight" shortcut this replaced would have been
 * actively wrong the moment a bench existed (living count no longer
 * monotonic against a single fixed-size array).
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
  failsafeRate: number;
  chainRate: number;
  dipRate: number;
  fullSpectacleRate: number;
  meanFightDurationSec: number;
  fightDurationStdDevSec: number;
  windupDeathRate: number;
  meanDeathsPerRun: number;
  /** Mean deaths credited to each fight index, across all n runs (a run that
   * ended before reaching an index contributes 0 to it, same convention as
   * winRateByFightIndex's reach-conditioning but for a sum rather than a
   * rate) — the per-fight breakdown meanDeathsPerRun's total collapses away.
   * See this file's top docstring, 2026-08-09 entry. */
  deathsByFightIndex: number[];
  fractionChainsWhileLosing: number;
  fractionFightsWithChain5Plus: number;
  /** See this file's top docstring, 2026-08-14 chain rebuild entry. */
  backfireRate: number;
  fractionChainsBackfired: number;
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
  private failsafeFights = 0;
  private ignitedFights = 0;
  private dipFights = 0;
  private fullSpectacleFights = 0;
  private windupDeathFights = 0;
  private totalFights = 0;
  private totalDuration = 0;
  private totalDurationSq = 0;
  private totalDeaths = 0;
  private deathsByFightIndex: number[];
  private chainsFired = 0;
  private chainsWhileLosing = 0;
  private chainsBackfired = 0;
  private backfireFights = 0;
  private fightsWithChain5Plus = 0;
  private cfg: RunConfig;

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.reachedCount = new Array(cfg.fightsPerRun).fill(0) as number[];
    this.wonCount = new Array(cfg.fightsPerRun).fill(0) as number[];
    this.deathsByFightIndex = new Array(cfg.fightsPerRun).fill(0) as number[];
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
      if (fr.dipOccurred) this.dipFights++;
      if (fr.chainLength >= this.cfg.fight.chainFullTellThreshold) this.fullSpectacleFights++;
      if (fr.chainLength >= 5) this.fightsWithChain5Plus++;
      if (this.hasWindupDeath(fr.events)) this.windupDeathFights++;
      this.totalDuration += fr.durationSec;
      this.totalDurationSq += fr.durationSec * fr.durationSec;
      this.chainHist[fr.chainLength] = (this.chainHist[fr.chainLength] ?? 0) + 1;
      this.countChainsWhileLosing(fr);
    }

    // Walk fights in order, crediting each death to the fight it happened in
    // rather than only reading the run's last entry — see this file's top
    // docstring, 2026-08-09 entry. Baseline is rosterSize (the full draft),
    // not playerN (what's fielded per fight) — see config.ts's roster/bench
    // pass: deaths are permanent removals from the roster, not the fielded
    // squad.
    let livingBefore = this.cfg.rosterSize;
    for (const f of r.fights) {
      const deathsThisFight = f.outcome === "win" ? Math.max(livingBefore - f.livingHeroesAfter, 0) : livingBefore;
      this.totalDeaths += deathsThisFight;
      this.deathsByFightIndex[f.fightIndex] = (this.deathsByFightIndex[f.fightIndex] ?? 0) + deathsThisFight;
      livingBefore = f.outcome === "win" ? f.livingHeroesAfter : 0;
    }
  }

  /** For every chainStart in this fight (2026-08-14 chain rebuild — every
   * one is a real fire now, no separate roll to filter on), looks up the
   * tick snapshot at that moment and checks whether the player's pool was
   * below 40% of its fight-start max (snapshot.playerMaxHp doesn't change
   * within a fight — sideMaxHp sums maxHp regardless of alive, so it's
   * exactly the fight-start figure) — the direct measurement of "did the
   * cascade fire from a losing position." Also tallies backfires here,
   * same event, same loop. */
  private countChainsWhileLosing(fr: RunResult["fightResults"][number]): void {
    let sawBackfire = false;
    for (const e of fr.events) {
      if (e.type !== "chainStart") continue;
      this.chainsFired++;
      if (e.backfire) {
        this.chainsBackfired++;
        sawBackfire = true;
      }
      const snap = fr.snapshots.find((s) => Math.abs(s.t - e.t) < 1e-9);
      if (snap && snap.playerMaxHp > 0 && snap.playerHp / snap.playerMaxHp < 0.4) this.chainsWhileLosing++;
    }
    if (sawBackfire) this.backfireFights++;
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
      failsafeRate: this.totalFights > 0 ? this.failsafeFights / this.totalFights : 0,
      chainRate: this.totalFights > 0 ? this.ignitedFights / this.totalFights : 0,
      dipRate: this.totalFights > 0 ? this.dipFights / this.totalFights : 0,
      fullSpectacleRate: this.totalFights > 0 ? this.fullSpectacleFights / this.totalFights : 0,
      meanFightDurationSec: meanDuration,
      fightDurationStdDevSec: Math.sqrt(durationVariance),
      windupDeathRate: this.totalFights > 0 ? this.windupDeathFights / this.totalFights : 0,
      meanDeathsPerRun: this.totalDeaths / this.n,
      deathsByFightIndex: this.deathsByFightIndex.map((d) => d / this.n),
      fractionChainsWhileLosing: this.chainsFired > 0 ? this.chainsWhileLosing / this.chainsFired : 0,
      fractionFightsWithChain5Plus: this.totalFights > 0 ? this.fightsWithChain5Plus / this.totalFights : 0,
      backfireRate: this.totalFights > 0 ? this.backfireFights / this.totalFights : 0,
      fractionChainsBackfired: this.chainsFired > 0 ? this.chainsBackfired / this.chainsFired : 0,
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
    `  chain rate:            ${(report.chainRate * 100).toFixed(1)}%  (fraction of fights a chain fired)`,
    `  full-spectacle rate:   ${(report.fullSpectacleRate * 100).toFixed(1)}%  (should track wins-with-chain>=3, below)`,
    `  windup death rate:     ${(report.windupDeathRate * 100).toFixed(1)}%  (a wind-up was the killing blow)`,
    `  failsafe rate:         ${(report.failsafeRate * 100).toFixed(1)}%  (target: 0%)`,
    `  wins with chain>=3:    ${(report.fractionWinsWithChain3Plus * 100).toFixed(1)}%`,
    `  wins with no chain:    ${(report.fractionWinsWithNoChain * 100).toFixed(1)}%  (big win, not only win)`,
    `  chain length hist:     ${histKeys.map((k) => `${k}:${report.chainLengthHistogram[k]}`).join("  ")}`,
    `  mean fight duration:   ${report.meanFightDurationSec.toFixed(2)}s  (stddev ${report.fightDurationStdDevSec.toFixed(2)}s)`,
    `  mean deaths per run:   ${report.meanDeathsPerRun.toFixed(2)}`,
    `  deaths by fight:       ${report.deathsByFightIndex.map((d, i) => `f${i + 1}=${d.toFixed(2)}`).join("  ")}`,
    `  chains while losing:   ${(report.fractionChainsWhileLosing * 100).toFixed(1)}%  (<40% pool when fired)`,
    `  backfire rate:         ${(report.backfireRate * 100).toFixed(1)}%  (fraction of fights with >=1 backfire)`,
    `  chains backfired:      ${(report.fractionChainsBackfired * 100).toFixed(1)}%  (should track cfg.fight.backfireChance)`,
  ];
  return lines.join("\n");
}
