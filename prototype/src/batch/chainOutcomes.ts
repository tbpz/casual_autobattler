/**
 * Per-chain outcome decomposition — the things the equal-EV normalization
 * cannot see (2026-08-27, "is burster obviously better than grinder" pass;
 * see CHAIN_SHAPE_LEVERAGE_FINDINGS.md and batch/shapeVerdict.ts).
 *
 * config.ts's chainMagnitudeScaleAbsolute equalizes every attacker's expected
 * NET chain value (heroes.ts's CHAIN_EV_TARGET_DAMAGE = 76) analytically. That
 * analytic promise rests on three assumptions the live sim violates:
 *   1. a chain always runs to its natural stochastic end — it doesn't; the hot
 *      hero can die mid-chain (fight.ts's per-hero loop skips dead heroes, so
 *      hotHeroId is never cleared and the chain trigger is locked out for the
 *      rest of that fight), or the fight can end under it;
 *   2. damage now is worth the same as damage later — it isn't; a kill removes
 *      an enemy's DPS for whatever fight remains;
 *   3. a backfire costs exactly what an equal payoff gains
 *      (expectedNetChainUnits' harmWeight=1) — but deaths are permanent for the
 *      run, and applyDamageFrom overflows down the list, so a concentrated
 *      backfire kills bodies where a spread one gets healed back.
 * This file measures all three off the event stream, so a win-rate delta
 * between two shapes arrives with its mechanism attached instead of as a bare
 * number.
 *
 * Same incremental contract as report.ts's BatchAggregator and heroChain.ts's
 * HeroChainAggregator — add() one FightResult at a time and never retain them
 * (see report.ts's own docstring for the heap blowup that forced that
 * discipline). Rows key on the profile id carried by the chain's OWN chainStart
 * event (events.ts's ChainShape), never on the hero pool's authored profile, so
 * a harness-side chainProfile transform is measured correctly rather than
 * silently attributed to the shape the hero shipped with.
 *
 * Reads nothing the renderer doesn't already have, and changes no sim
 * behaviour: this is pure measurement over FightResult.events.
 */
import {
  backfireChanceFor,
  chainMagnitudeScaleAbsolute,
  chainReachProbabilities,
  type ChainProfile,
  type FightConfig,
  type RunConfig,
} from "../sim/config.js";
import { chainAttackMagnitude } from "../sim/fight.js";
import { CHAIN_PROFILES, PLAYER_HERO_POOL } from "../sim/heroes.js";
import type { FightResult } from "../sim/events.js";
import { baseHeroId } from "./heroChain.js";

/** profileId -> the authored ChainProfile. chainStart's ChainShape carries only
 * the render-facing subset (label/maxHits/escalationKneeHit), not the
 * continuation table or the escalation step, both of which the intended-
 * magnitude recomputation below needs — so the id is resolved back against
 * heroes.ts's own table. A profile authored outside CHAIN_PROFILES (none today)
 * lands with no intended-magnitude figure rather than a silently mis-scaled
 * one. */
const PROFILE_BY_ID: Record<string, ChainProfile> = Object.fromEntries(
  Object.values(CHAIN_PROFILES).map((p) => [p.id, p as ChainProfile]),
);

const HERO_BY_ID = Object.fromEntries(PLAYER_HERO_POOL.map((h) => [h.id, h]));

/** Why a chain stopped. `reason` on the chainEnd event has four values
 * (fight.ts's two emission sites); this splits its "fightEnd" into the two
 * causally different cases:
 *  - fightEnd: the FIGHT ended while the chain was still live (a win by wipe
 *    mid-chain, or the failsafe) — the chain was cut short by winning/losing.
 *  - lockout:  the HOT HERO DIED mid-chain and the fight carried on without it.
 *    hotHeroId is never cleared in that case, so no further chain can fire for
 *    the rest of the fight. This is the asymmetry a long fuse is exposed to and
 *    a short one mostly isn't — see this file's header, assumption 1.
 * A hero dying on the same tick the fight resolves is NOT a lockout: nothing
 * was locked out, the fight was already over. */
export type ChainEndCause = "miss" | "capped" | "noTarget" | "fightEnd" | "lockout";

export const CHAIN_END_CAUSES: ChainEndCause[] = ["miss", "capped", "noTarget", "fightEnd", "lockout"];

export interface ChainOutcomeRow {
  profileId: string;
  label: string;
  /** Whether this profile's payoff unit is HP RESTORED rather than damage — a
   * healer's chain repeats a heal (fight.ts's resolveChainHit). Never compare a
   * healer row's payoff against an attacker row's; the units differ. */
  healer: boolean;
  chains: number;
  /** Chains that fired and landed ZERO bonus hits — the first continuation roll
   * failed. Structural, not bad luck: shortFuseSteep's first roll is 0.60 vs
   * longFuseFlat's 0.78. */
  duds: number;
  backfires: number;
  sumLength: number;
  /** chainEnd.totalDamage on non-backfire chains — what the chain ACTUALLY
   * bought, against the analytic target the profile promises. */
  sumRealizedGood: number;
  sumRealizedBackfire: number;
  /** Sum of the magnitudes the chain's hits were INTENDED to land, recomputed
   * per hit with fight.ts's own exported chainAttackMagnitude. Intended minus
   * realized is overkill spilled off the end of the target side
   * (applyDamageFrom returns `applied`, capped by that side's remaining total
   * HP, and the event records the capped figure). Attackers only — a chain
   * heal's shortfall is the heal clamp and the target's missing HP, not
   * overkill. */
  sumIntendedGood: number;
  sumIntendedBackfire: number;
  /** The ANALYTIC expected gross magnitude of each fired chain, summed — the
   * yardstick realized damage is measured against.
   *
   * Deliberately NOT heroes.ts's CHAIN_EV_TARGET_DAMAGE (76): that is the
   * expected NET value, gross minus a symmetric backfire's harm
   * (expectedNetChainUnits' `(1 - (1+harmWeight)*b)` factor). Dividing
   * non-backfire realized damage by a NET target overstates the shortfall, and
   * by a different factor per hero — Rook's backfire chance is 18% against
   * Bracer's 7.75%, so the same shape would score differently on the two. This
   * accumulates each chain's own E[gross] instead, from the profile the chain
   * actually fired under and the firing hero's own stats, so pooling across
   * heroes and profiles stays exact. */
  sumAnalyticGrossGood: number;
  sumAnalyticGrossBackfire: number;
  /** chainEnd.t - chainStart.t, summed: how long a chain occupies the fight. */
  sumWallClockSec: number;
  /** Fight seconds left after the chain ended, summed — the window over which
   * an early payoff's tempo advantage can compound (header assumption 2). */
  sumSecondsRemainingAfterEnd: number;
  causes: Record<ChainEndCause, number>;
  /** Seconds between the hot hero's death and the fight's end, summed over
   * lockout chains — the span during which no chain could fire at all. */
  sumLockedOutSec: number;
  killsGood: number;
  /** Player bodies killed BY a backfiring chain. Permanent for the run, which
   * is the cost harmWeight=1 does not price (header assumption 3). */
  deathsFromBackfire: number;
}

interface OpenChain {
  profileId: string;
  label: string;
  heroId: string;
  backfire: boolean;
  startT: number;
  intended: number;
  healer: boolean;
}

export interface ChainOutcomeReport {
  rows: ChainOutcomeRow[];
  /** Wiring check, same discipline as heroChain.ts's chainStartCount/
   * chainEndCount: every chainStart must pair with exactly one chainEnd. */
  chainStartCount: number;
  chainEndCount: number;
}

function emptyRow(profileId: string, label: string, healer: boolean): ChainOutcomeRow {
  return {
    profileId,
    label,
    healer,
    chains: 0,
    duds: 0,
    backfires: 0,
    sumLength: 0,
    sumRealizedGood: 0,
    sumRealizedBackfire: 0,
    sumIntendedGood: 0,
    sumIntendedBackfire: 0,
    sumAnalyticGrossGood: 0,
    sumAnalyticGrossBackfire: 0,
    sumWallClockSec: 0,
    sumSecondsRemainingAfterEnd: 0,
    causes: { miss: 0, capped: 0, noTarget: 0, fightEnd: 0, lockout: 0 },
    sumLockedOutSec: 0,
    killsGood: 0,
    deathsFromBackfire: 0,
  };
}

/** The magnitude one attacker chain hit was INTENDED to land, before
 * applyDamageFrom truncates it against the target side's remaining HP. Rebuilt
 * from the same inputs fight.ts's resolveChainPlan uses (the hero's own damage /
 * chainAffinity / chainMagnitudeTarget, and the profile the chain actually
 * fired under) rather than re-deriving the formula — chainAttackMagnitude and
 * chainMagnitudeScaleAbsolute are the sim's own exports.
 *
 * Assumes the measured arms transform chainProfile ONLY, never damage /
 * chainAffinity / chainMagnitudeTarget — true of every arm in shapeVerdict.ts.
 * An arm that scaled chainMagnitudeTarget (chainLeverage.ts's Block 1 magnitude
 * arms) would need its factor applied here too; that report does not use this
 * aggregator. */
function intendedHitMagnitude(cfg: FightConfig, profileId: string, heroBaseId: string, hitIndex: number): number {
  const profile = PROFILE_BY_ID[profileId];
  const hero = HERO_BY_ID[heroBaseId];
  if (!profile || !hero || hero.healPerBeat) return 0;
  const backfireChance = backfireChanceFor(cfg, hero.chainAffinity);
  const scale = chainMagnitudeScaleAbsolute(profile, backfireChance, hero.damage, hero.chainMagnitudeTarget);
  return chainAttackMagnitude(cfg, profile, hero.damage, scale, hitIndex);
}

/** E[gross magnitude of one fired chain] for this (profile, hero) pair, in real
 * damage rather than escalation units: sum over n of P(chain reaches hit n) x
 * the magnitude hit n would land. Uses the sim's own reach probabilities and
 * magnitude formula, so it is the exact analytic counterpart of what the fight
 * records — see sumAnalyticGrossGood's docstring for why the NET target is the
 * wrong yardstick here. Attackers only (0 for a healer, whose chain heal is
 * clamped per hit against the target's own body). Memoized: the same handful of
 * (profile, hero) pairs recur across every chain in a sweep. */
const analyticGrossCache: Record<string, number> = {};
function analyticGrossPerChain(cfg: FightConfig, profileId: string, heroBaseId: string): number {
  const key = `${profileId}|${heroBaseId}`;
  const cached = analyticGrossCache[key];
  if (cached !== undefined) return cached;
  const profile = PROFILE_BY_ID[profileId];
  const hero = HERO_BY_ID[heroBaseId];
  let total = 0;
  if (profile && hero && !hero.healPerBeat) {
    const reach = chainReachProbabilities(profile);
    for (let n = 1; n <= profile.maxHits; n++) {
      total += (reach[n - 1] ?? 0) * intendedHitMagnitude(cfg, profileId, heroBaseId, n);
    }
  }
  analyticGrossCache[key] = total;
  return total;
}

export class ChainOutcomeAggregator {
  private rows: Record<string, ChainOutcomeRow> = {};
  private starts = 0;
  private ends = 0;
  private cfg: RunConfig;

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
  }

  add(fr: FightResult): void {
    // Player deaths and when they happened — needed to tell a lockout from an
    // ordinary fightEnd close-out. Enemy heroDowns are ignored: only a PLAYER
    // hero can be the hot hero.
    const downT: Record<string, number> = {};
    for (const e of fr.events) {
      if (e.type === "heroDown" && e.side === "player" && downT[e.heroId] === undefined) downT[e.heroId] = e.t;
    }
    const endT = fr.durationSec;

    let open: OpenChain | null = null;
    for (const e of fr.events) {
      if (e.type === "chainStart") {
        this.starts++;
        const heroBase = baseHeroId(e.heroId);
        open = {
          profileId: e.shape.profileId,
          label: e.shape.label,
          heroId: e.heroId,
          backfire: e.backfire,
          startT: e.t,
          intended: 0,
          healer: Boolean(HERO_BY_ID[heroBase]?.healPerBeat),
        };
        continue;
      }
      if (e.type === "chainHit") {
        if (open) {
          open.intended += intendedHitMagnitude(this.cfg.fight, open.profileId, baseHeroId(open.heroId), e.hitIndex);
        }
        continue;
      }
      if (e.type !== "chainEnd") continue;
      this.ends++;
      const key = open?.profileId ?? "unknown";
      const row = (this.rows[key] ??= emptyRow(key, open?.label ?? e.label, open?.healer ?? false));
      row.chains++;
      row.sumLength += e.chainLength;
      if (e.chainLength === 0) row.duds++;
      if (open) row.sumWallClockSec += e.t - open.startT;
      row.sumSecondsRemainingAfterEnd += Math.max(0, endT - e.t);
      const analyticGross = open ? analyticGrossPerChain(this.cfg.fight, open.profileId, baseHeroId(open.heroId)) : 0;
      if (e.backfire) {
        row.backfires++;
        row.sumRealizedBackfire += e.totalDamage;
        row.sumIntendedBackfire += open?.intended ?? 0;
        row.sumAnalyticGrossBackfire += analyticGross;
        row.deathsFromBackfire += e.killedIds.length;
      } else {
        row.sumRealizedGood += e.totalDamage;
        row.sumIntendedGood += open?.intended ?? 0;
        row.sumAnalyticGrossGood += analyticGross;
        row.killsGood += e.killedIds.length;
      }
      const heroDownT = open ? downT[open.heroId] : undefined;
      const lockedOut = e.reason === "fightEnd" && heroDownT !== undefined && heroDownT < endT;
      const cause: ChainEndCause = lockedOut ? "lockout" : e.reason;
      row.causes[cause]++;
      if (lockedOut && heroDownT !== undefined) row.sumLockedOutSec += endT - heroDownT;
      open = null;
    }
  }

  addRun(fightResults: FightResult[]): void {
    for (const fr of fightResults) this.add(fr);
  }

  finalize(): ChainOutcomeReport {
    return {
      rows: Object.values(this.rows).sort((a, b) => a.profileId.localeCompare(b.profileId)),
      chainStartCount: this.starts,
      chainEndCount: this.ends,
    };
  }
}

/** Sums a set of rows into one — used to pool the two burster profiles (or the
 * two grinder profiles) into a single side of the comparison. profileId/label
 * become the caller's pooled name. Refuses to mix healer and attacker rows: the
 * payoff units differ (damage vs HP restored). */
export function poolRows(rows: ChainOutcomeRow[], profileId: string, label: string): ChainOutcomeRow {
  if (rows.some((r) => r.healer) && rows.some((r) => !r.healer)) {
    throw new Error(`poolRows(${profileId}): refusing to pool healer and attacker rows — payoff units differ`);
  }
  const out = emptyRow(profileId, label, rows.some((r) => r.healer));
  for (const r of rows) {
    out.chains += r.chains;
    out.duds += r.duds;
    out.backfires += r.backfires;
    out.sumLength += r.sumLength;
    out.sumRealizedGood += r.sumRealizedGood;
    out.sumRealizedBackfire += r.sumRealizedBackfire;
    out.sumIntendedGood += r.sumIntendedGood;
    out.sumIntendedBackfire += r.sumIntendedBackfire;
    out.sumAnalyticGrossGood += r.sumAnalyticGrossGood;
    out.sumAnalyticGrossBackfire += r.sumAnalyticGrossBackfire;
    out.sumWallClockSec += r.sumWallClockSec;
    out.sumSecondsRemainingAfterEnd += r.sumSecondsRemainingAfterEnd;
    out.sumLockedOutSec += r.sumLockedOutSec;
    out.killsGood += r.killsGood;
    out.deathsFromBackfire += r.deathsFromBackfire;
    for (const c of CHAIN_END_CAUSES) out.causes[c] += r.causes[c];
  }
  return out;
}

/** Per-chain derived figures — every denominator stated, so a row with few
 * chains can't quietly read as a precise number. `evRealization` is the
 * headline: realized payoff against what this row's chains were analytically
 * expected to gross (sumAnalyticGrossGood — see its docstring for why the NET
 * target would be the wrong yardstick). */
export function chainOutcomeStats(row: ChainOutcomeRow) {
  const good = row.chains - row.backfires;
  const per = (x: number, d: number) => (d > 0 ? x / d : 0);
  return {
    chains: row.chains,
    dudRate: per(row.duds, row.chains),
    backfireRate: per(row.backfires, row.chains),
    meanLength: per(row.sumLength, row.chains),
    meanRealizedGood: per(row.sumRealizedGood, good),
    meanIntendedGood: per(row.sumIntendedGood, good),
    meanAnalyticGrossGood: per(row.sumAnalyticGrossGood, good),
    /** Realized damage / analytically expected gross damage, over non-backfire
     * chains. 1.0 means the shape delivers exactly what the math priced it at;
     * below 1.0 means the live fight is taking a cut the analytic EV can't see
     * (overkill spill, a chain cut short, or a lockout). */
    evRealization: row.sumAnalyticGrossGood > 0 ? row.sumRealizedGood / row.sumAnalyticGrossGood : 0,
    /** Fraction of intended damage spilled past the target side's last body. */
    spillFraction: row.sumIntendedGood > 0 ? 1 - row.sumRealizedGood / row.sumIntendedGood : 0,
    meanWallClockSec: per(row.sumWallClockSec, row.chains),
    meanSecondsRemainingAfterEnd: per(row.sumSecondsRemainingAfterEnd, row.chains),
    lockoutRate: per(row.causes.lockout, row.chains),
    meanLockedOutSec: per(row.sumLockedOutSec, row.causes.lockout),
    cutShortRate: per(row.causes.fightEnd + row.causes.lockout, row.chains),
    killsPerGoodChain: per(row.killsGood, good),
    deathsPerBackfire: per(row.deathsFromBackfire, row.backfires),
  };
}

export function formatChainOutcomeRow(row: ChainOutcomeRow, indent = "    "): string {
  const s = chainOutcomeStats(row);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const name = row.profileId === row.label ? row.label : `${row.label} (${row.profileId})`;
  return [
    `${indent}${name}  chains=${s.chains}${row.healer ? "  [healer: payoff is HP restored]" : ""}`,
    `${indent}  realized/good chain:  ${s.meanRealizedGood.toFixed(1)} vs analytic E[gross] ` +
      `${s.meanAnalyticGrossGood.toFixed(1)} -> EV realization ${pct(s.evRealization)}`,
    `${indent}  intended/good chain:  ${s.meanIntendedGood.toFixed(1)}  (spilled past last body: ${pct(s.spillFraction)})`,
    `${indent}  length:               mean ${s.meanLength.toFixed(2)} hits, duds ${pct(s.dudRate)}, ` +
      `wall-clock ${s.meanWallClockSec.toFixed(2)}s`,
    `${indent}  fight left after end: ${s.meanSecondsRemainingAfterEnd.toFixed(2)}s`,
    `${indent}  ended by:             ` +
      CHAIN_END_CAUSES.map((c) => `${c}=${pct(row.chains > 0 ? row.causes[c] / row.chains : 0)}`).join("  "),
    `${indent}  lockout:              ${pct(s.lockoutRate)} of chains, mean ${s.meanLockedOutSec.toFixed(1)}s ` +
      `with the chain system dead`,
    `${indent}  backfire:             ${pct(s.backfireRate)} of chains, ${s.deathsPerBackfire.toFixed(2)} player ` +
      `deaths per backfire`,
    `${indent}  kills/good chain:     ${s.killsPerGoodChain.toFixed(2)}`,
  ].join("\n");
}
