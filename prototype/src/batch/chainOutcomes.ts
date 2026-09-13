/**
 * Per-chain outcome decomposition — what a fired chain actually delivered,
 * decomposed off the live event stream rather than trusted from a design
 * intent (2026-08-27, "is burster obviously better than grinder" pass;
 * carried forward through the 2026-09-13 "a hero's chain names its own
 * enemy" rebuild — see DECISIONS.md).
 *
 * Three things the live sim can cut a chain short on, which this file
 * measures directly off events rather than assuming away:
 *   1. a chain always runs to its natural stochastic end — it doesn't; the hot
 *      hero can die mid-chain, to its own backfire or to an enemy hit, cutting
 *      the chain short right there (fight.ts's chainEnd reason "sourceDied" —
 *      2026-08-29, Phase 0 lockout fix: before that fix the fight's per-hero
 *      loop skipped dead heroes, hotHeroId was never cleared, and NO other
 *      hero could fire again for the rest of that fight either; this file
 *      still counts the cut-short chain as a "lockout" below, since losing
 *      whatever hits would have followed is the part that survived the fix),
 *      or the fight can end under it;
 *   2. damage now is worth the same as damage later — it isn't; a kill removes
 *      an enemy's DPS for whatever fight remains;
 *   3. a chain hit's escalated ("intended") magnitude can exceed what actually
 *      landed — applyDamageFrom clamps a damage hit against the target side's
 *      remaining HP (an attack effect) or a heal hit against its own clamp
 *      (config.ts's chainHealMaxFractionOfTargetMaxHp) — so "intended" and
 *      "realized" (chainHit.amount) genuinely differ.
 * This file measures all three off the event stream, so a win-rate delta
 * between two effects (or two encounters) arrives with its mechanism
 * attached instead of as a bare number.
 *
 * 2026-09-13 rebuild: rows now key on the chain's own EFFECT (config.ts's
 * ChainEffect, carried on chainStart/chainEnd), not a profile id — there is
 * no more per-hero shape or equal-EV target to validate a realized number
 * against, so the old analytic-gross/EV-realization figures (which existed
 * specifically to check the old equal-EV promise) are gone. What "intended
 * vs realized" still measures: how much of a chain's escalated magnitude
 * actually landed, read straight off chainHit.intended/amount — true for
 * every effect, healer or attacker alike, no per-hero lookup needed.
 *
 * Same incremental contract as report.ts's BatchAggregator and heroChain.ts's
 * HeroChainAggregator — add() one FightResult at a time and never retain them
 * (see report.ts's own docstring for the heap blowup that forced that
 * discipline).
 *
 * Reads nothing the renderer doesn't already have, and changes no sim
 * behaviour: this is pure measurement over FightResult.events.
 */
import type { ChainEffect, RunConfig } from "../sim/config.js";
import type { FightResult } from "../sim/events.js";

/** Why a chain stopped. `reason` on the chainEnd event has five values
 * (fight.ts's three emission sites); this renames "sourceDied" to "lockout" —
 * kept as its own cause, under its pre-2026-08-29 name, so historical
 * measurement runs stay comparable:
 *  - fightEnd: the FIGHT ended while the chain was still live (a win by wipe
 *    mid-chain, or the failsafe) — the chain was cut short by winning/losing.
 *  - lockout:  the HOT HERO DIED mid-chain (fight.ts's "sourceDied") and the
 *    fight carried on without it — the chain loses whatever hits would have
 *    followed. This is the asymmetry a long chain is exposed to and a short
 *    one mostly isn't — see this file's header, assumption 1.
 * A hero dying on the same tick the fight resolves is reported as "fightEnd",
 * not "lockout": nothing was cut short, the fight was already over (see
 * fight.ts's post-loop sweep, gated on `!outcome`). */
export type ChainEndCause = "miss" | "capped" | "noTarget" | "fightEnd" | "lockout";

export const CHAIN_END_CAUSES: ChainEndCause[] = ["miss", "capped", "noTarget", "fightEnd", "lockout"];

/** mendAll/mendOne repeat a heal, not an attack — their payoff unit is HP
 * restored, never comparable to a damage row. */
function isHealEffect(effect: ChainEffect): boolean {
  return effect === "mendAll" || effect === "mendOne";
}

export interface ChainOutcomeRow {
  effect: ChainEffect;
  /** Whether this effect's payoff unit is HP RESTORED rather than damage —
   * never compare a healer row's payoff against an attacker row's. */
  healer: boolean;
  chains: number;
  /** Chains that fired and landed ZERO bonus hits — the first continuation
   * roll failed. Every hero now shares one continuation table (2026-09-13
   * rebuild), so this rate is the same across effects by construction; kept
   * per-row anyway so a harness-side override (chainContinuationScale, a
   * forced hero) still measures correctly rather than being assumed. */
  duds: number;
  backfires: number;
  sumLength: number;
  /** chainEnd.totalDamage (or total HP restored, for a heal effect) on
   * non-backfire chains — what the chain ACTUALLY delivered. */
  sumRealizedGood: number;
  sumRealizedBackfire: number;
  /** Sum of chainHit.intended — what each hit was escalated to before any
   * clamp (applyDamageFrom's side-HP clamp for a damage effect, the heal cap
   * for a heal effect). intended minus realized is what a hit lost to that
   * clamp, read straight off the event stream — true for every effect. */
  sumIntendedGood: number;
  sumIntendedBackfire: number;
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
  /** Player bodies killed BY a backfiring chain. Permanent for the run. */
  deathsFromBackfire: number;
}

interface OpenChain {
  effect: ChainEffect;
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

function emptyRow(effect: ChainEffect): ChainOutcomeRow {
  return {
    effect,
    healer: isHealEffect(effect),
    chains: 0,
    duds: 0,
    backfires: 0,
    sumLength: 0,
    sumRealizedGood: 0,
    sumRealizedBackfire: 0,
    sumIntendedGood: 0,
    sumIntendedBackfire: 0,
    sumWallClockSec: 0,
    sumSecondsRemainingAfterEnd: 0,
    causes: { miss: 0, capped: 0, noTarget: 0, fightEnd: 0, lockout: 0 },
    sumLockedOutSec: 0,
    killsGood: 0,
    deathsFromBackfire: 0,
  };
}

export class ChainOutcomeAggregator {
  private rows: Partial<Record<ChainEffect, ChainOutcomeRow>> = {};
  private starts = 0;
  private ends = 0;

  // cfg is accepted for interface parity with the other batch aggregators
  // (report.ts's BatchAggregator, heroChain.ts's HeroChainAggregator all take
  // the run config their construction site already has in hand) — this file
  // reads nothing off it directly.
  constructor(_cfg: RunConfig) {}

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
        open = {
          effect: e.effect,
          heroId: e.heroId,
          backfire: e.backfire,
          startT: e.t,
          intended: 0,
          healer: isHealEffect(e.effect),
        };
        continue;
      }
      if (e.type === "chainHit") {
        if (open) open.intended += e.intended;
        continue;
      }
      if (e.type !== "chainEnd") continue;
      this.ends++;
      const effect = open?.effect ?? e.effect;
      const row = (this.rows[effect] ??= emptyRow(effect));
      row.chains++;
      row.sumLength += e.chainLength;
      if (e.chainLength === 0) row.duds++;
      if (open) row.sumWallClockSec += e.t - open.startT;
      row.sumSecondsRemainingAfterEnd += Math.max(0, endT - e.t);
      if (e.backfire) {
        row.backfires++;
        row.sumRealizedBackfire += e.totalDamage;
        row.sumIntendedBackfire += open?.intended ?? 0;
        row.deathsFromBackfire += e.killedIds.length;
      } else {
        row.sumRealizedGood += e.totalDamage;
        row.sumIntendedGood += open?.intended ?? 0;
        row.killsGood += e.killedIds.length;
      }
      const heroDownT = open ? downT[open.heroId] : undefined;
      // "sourceDied" IS the real reason as of the 2026-08-29 lockout fix — no
      // more deriving it from a timestamp comparison (see this file's
      // ChainEndCause docstring for why it keeps the "lockout" name here).
      const cause: ChainEndCause = e.reason === "sourceDied" ? "lockout" : e.reason;
      row.causes[cause]++;
      if (cause === "lockout" && heroDownT !== undefined) row.sumLockedOutSec += endT - heroDownT;
      open = null;
    }
  }

  addRun(fightResults: FightResult[]): void {
    for (const fr of fightResults) this.add(fr);
  }

  finalize(): ChainOutcomeReport {
    return {
      rows: Object.values(this.rows).sort((a, b) => a.effect.localeCompare(b.effect)),
      chainStartCount: this.starts,
      chainEndCount: this.ends,
    };
  }
}

/** Sums a set of rows into one — used to pool related effects (e.g. every
 * damage effect) into a single side of a comparison. Refuses to mix healer
 * and attacker rows: the payoff units differ (damage vs HP restored). */
export function poolRows(rows: ChainOutcomeRow[], effect: ChainEffect): ChainOutcomeRow {
  if (rows.some((r) => r.healer) && rows.some((r) => !r.healer)) {
    throw new Error(`poolRows(${effect}): refusing to pool healer and attacker rows — payoff units differ`);
  }
  const out = emptyRow(effect);
  for (const r of rows) {
    out.chains += r.chains;
    out.duds += r.duds;
    out.backfires += r.backfires;
    out.sumLength += r.sumLength;
    out.sumRealizedGood += r.sumRealizedGood;
    out.sumRealizedBackfire += r.sumRealizedBackfire;
    out.sumIntendedGood += r.sumIntendedGood;
    out.sumIntendedBackfire += r.sumIntendedBackfire;
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
 * chains can't quietly read as a precise number. */
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
    /** Fraction of intended magnitude that never landed — clamped away by
     * applyDamageFrom's side-HP limit (a damage effect) or the heal cap (a
     * heal effect). */
    shortfallFraction: row.sumIntendedGood > 0 ? 1 - row.sumRealizedGood / row.sumIntendedGood : 0,
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
  return [
    `${indent}${row.effect}  chains=${s.chains}${row.healer ? "  [healer: payoff is HP restored]" : ""}`,
    `${indent}  realized/good chain:  ${s.meanRealizedGood.toFixed(1)} vs intended ${s.meanIntendedGood.toFixed(1)} ` +
      `(shortfall: ${pct(s.shortfallFraction)})`,
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
