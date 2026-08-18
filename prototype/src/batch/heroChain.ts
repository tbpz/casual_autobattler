/**
 * Per-hero chain rollup for the affinity-measurement harness (2026-08-19 —
 * see DECISIONS.md/STATE.md's attribution investigation and
 * batch/affinity.ts). Sibling to BatchAggregator (report.ts) with the same
 * incremental contract — never retain N full RunResults, see report.ts's own
 * docstring for the heap blowup that forced that discipline.
 *
 * Nothing in the shipped game or in report.ts breaks down outcomes by hero;
 * this is purely a measurement addition.
 */
import type { RunResult } from "../sim/run.js";

/** makePlayerSide (sim/heroes.ts) mints instance ids as `p${i}_${id}` — every
 * chain event and every fieldedIds entry carries that prefix. Strip it so
 * rows key on the base hero id ("rook"), never an instance id ("p2_rook"). */
export function baseHeroId(instanceId: string): string {
  return instanceId.replace(/^p\d+_/, "");
}

export interface HeroChainRow {
  heroId: string;
  runsDrafted: number;
  runsCompletedWhileDrafted: number;
  fightsFielded: number;
  chains: number;
  backfires: number;
  sumChainLength: number;
  /** totalDamage from non-backfire chainEnds. For a healer (healPerBeat set)
   * this is HP RESTORED, not damage — see fight.ts's resolveChainHit healer
   * branch. Never compare an attacker's and a healer's payoff numbers
   * directly; formatHeroChainReport tags healer rows explicitly. */
  sumPayoffGood: number;
  /** totalDamage from backfire chainEnds — same healer caveat as above. */
  sumPayoffBackfire: number;
  kills: number;
}

export interface HeroChainReport {
  rows: HeroChainRow[];
  /** Wiring check: every chainStart has exactly one chainEnd (the in-loop
   * miss/capped/noTarget branch, or the fightEnd force-close — see
   * fight.ts). If these counts ever diverge, the rollup is silently
   * dropping or double-counting chains. */
  chainStartCount: number;
  chainEndCount: number;
}

/** heroChain only sees event streams, not the static hero pool, so it has no
 * way to know which base ids are healers (whose chain payoff is HP restored,
 * not damage). formatHeroChainReport's caller passes the known healer id set
 * (derived from sim/heroes.ts's PLAYER_HERO_POOL) so the printed table can
 * tag those rows rather than mixing units silently. */
export class HeroChainAggregator {
  private runsDrafted: Record<string, number> = {};
  private runsCompletedWhileDrafted: Record<string, number> = {};
  private fightsFielded: Record<string, number> = {};
  private chains: Record<string, number> = {};
  private backfires: Record<string, number> = {};
  private sumChainLength: Record<string, number> = {};
  private sumPayoffGood: Record<string, number> = {};
  private sumPayoffBackfire: Record<string, number> = {};
  private kills: Record<string, number> = {};
  private chainStartCount = 0;
  private chainEndCount = 0;

  private bump(rec: Record<string, number>, key: string, by = 1): void {
    rec[key] = (rec[key] ?? 0) + by;
  }

  /** draftIds are BASE ids (not instance ids) — the caller's own draft list,
   * e.g. DEFAULT_DRAFT_ROSTER_IDS, never derived from the roster. */
  add(r: RunResult, draftIds: string[]): void {
    const completed = r.outcome === "complete";
    for (const id of draftIds) {
      this.bump(this.runsDrafted, id);
      if (completed) this.bump(this.runsCompletedWhileDrafted, id);
    }

    for (const f of r.fights) {
      for (const instanceId of f.fieldedIds) {
        this.bump(this.fightsFielded, baseHeroId(instanceId));
      }
    }

    for (const fr of r.fightResults) {
      for (const e of fr.events) {
        if (e.type === "chainStart") {
          this.chainStartCount++;
        } else if (e.type === "chainEnd") {
          this.chainEndCount++;
          const id = baseHeroId(e.heroId);
          this.bump(this.chains, id);
          this.bump(this.sumChainLength, id, e.chainLength);
          this.bump(this.kills, id, e.killedIds.length);
          if (e.backfire) {
            this.bump(this.backfires, id);
            this.bump(this.sumPayoffBackfire, id, e.totalDamage);
          } else {
            this.bump(this.sumPayoffGood, id, e.totalDamage);
          }
        }
      }
    }
  }

  finalize(): HeroChainReport {
    const ids = new Set<string>([
      ...Object.keys(this.runsDrafted),
      ...Object.keys(this.chains),
    ]);
    const rows: HeroChainRow[] = [...ids].sort().map((heroId) => ({
      heroId,
      runsDrafted: this.runsDrafted[heroId] ?? 0,
      runsCompletedWhileDrafted: this.runsCompletedWhileDrafted[heroId] ?? 0,
      fightsFielded: this.fightsFielded[heroId] ?? 0,
      chains: this.chains[heroId] ?? 0,
      backfires: this.backfires[heroId] ?? 0,
      sumChainLength: this.sumChainLength[heroId] ?? 0,
      sumPayoffGood: this.sumPayoffGood[heroId] ?? 0,
      sumPayoffBackfire: this.sumPayoffBackfire[heroId] ?? 0,
      kills: this.kills[heroId] ?? 0,
    }));
    return { rows, chainStartCount: this.chainStartCount, chainEndCount: this.chainEndCount };
  }
}

export function formatHeroChainReport(rep: HeroChainReport, label: string, healerIds: Set<string>): string {
  const lines = [`--- per-hero chain rollup: ${label} ---`];
  if (rep.chainStartCount !== rep.chainEndCount) {
    lines.push(
      `  WIRING WARNING: chainStart=${rep.chainStartCount} chainEnd=${rep.chainEndCount} (should match — rollup may be dropping events)`,
    );
  }
  lines.push(
    "  hero            drafted  compl%   fielded  chains  bf%    meanLen  meanGood      meanBackfire  kills",
  );
  for (const row of rep.rows) {
    const complPct = row.runsDrafted > 0 ? (row.runsCompletedWhileDrafted / row.runsDrafted) * 100 : 0;
    const bfPct = row.chains > 0 ? (row.backfires / row.chains) * 100 : 0;
    const meanLen = row.chains > 0 ? row.sumChainLength / row.chains : 0;
    const goodChains = row.chains - row.backfires;
    const meanGood = goodChains > 0 ? row.sumPayoffGood / goodChains : 0;
    const meanBackfire = row.backfires > 0 ? row.sumPayoffBackfire / row.backfires : 0;
    const unit = healerIds.has(row.heroId) ? "(heal)" : "";
    lines.push(
      `  ${row.heroId.padEnd(15)} ${String(row.runsDrafted).padStart(7)}  ${complPct.toFixed(1).padStart(5)}%  ` +
        `${String(row.fightsFielded).padStart(7)}  ${String(row.chains).padStart(6)}  ${bfPct.toFixed(1).padStart(4)}%  ` +
        `${meanLen.toFixed(2).padStart(7)}  ${meanGood.toFixed(1).padStart(8)} ${unit.padStart(6)}  ` +
        `${meanBackfire.toFixed(1).padStart(12)}  ${row.kills}`,
    );
  }
  return lines.join("\n");
}
