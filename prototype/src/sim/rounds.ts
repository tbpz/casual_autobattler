/**
 * The run's 20 rounds (2026-09-23, roles/rounds rebuild — see DECISIONS.md
 * and STATE.md): replaces the old fixed 5-fight run wholesale. Enemies get
 * gradually stronger, in both stats and abilities; rounds 7 and 14 are
 * mini-bosses, round 20 is the boss, and a handful of rounds scattered
 * through are filler — weaker, quicker, still pay out an offer. This is what
 * Tu asked for directly: "enemies should getting stronger gradually... there
 * might be some key rounds with the mini boss and boss with strong stats and
 * strong ability. While there are some filler round where players fight
 * enemies with lower difficulty to farm some necessary upgrades."
 *
 * This file owns the round-by-round shape; sim/encounters.ts owns the enemy
 * SHAPES a round draws from (which kind of round a shape can fill is
 * EncounterDef.kind, in that file).
 */
import { Rng } from "./rng.js";
import type { FightConfig, RunConfig } from "./config.js";
import type { SideState } from "./types.js";
import { buildEnemySide, encounterAt, encounterIndicesOfKind, type EncounterDef, type EncounterKind } from "./encounters.js";

export interface RoundDef {
  kind: EncounterKind;
  /** Base HP/damage scale at this round — climbs across the run. Multiplied
   * further by kind (see KIND_SCALE_MULTIPLIER below) so a mini-boss/boss
   * round hits harder than a normal round landing at the same point in the
   * curve, and a filler round hits softer. */
  hpScale: number;
  damageScale: number;
}

/** Extra multiplier stacked on top of a round's own hpScale/damageScale by
 * its kind — a mini-boss/boss round is a real step up from the round before
 * it, a filler round is genuinely easier, not just "the same fight, cheaper
 * decoration." */
const KIND_SCALE_MULTIPLIER: Record<EncounterKind, { hp: number; damage: number }> = {
  filler: { hp: 0.6, damage: 0.6 },
  normal: { hp: 0.95, damage: 0.95 },
  miniboss: { hp: 1.05, damage: 1.02 },
  boss: { hp: 1.1, damage: 1.05 },
};

/** 20 rounds, hand-authored (not a formula) so the shape is something Tu can
 * read and edit directly — see CLAUDE.md's "STATE names where a piece
 * stands and points; it never paraphrases behaviour" for why this table,
 * not a paragraph, is the source of truth. Mini-bosses at 7 and 14, boss at
 * 20; fillers scattered through (1, 4, 8, 11, 15, 19) so there's regularly a
 * lighter round to farm an offer on. hpScale/damageScale climb linearly
 * before the kind multiplier above is applied — a first-pass strawman, same
 * convention as every number in config.ts. */
export const ROUND_PLAN: RoundDef[] = Array.from({ length: 20 }, (_, i) => {
  const round = i + 1;
  const kind: EncounterKind =
    round === 20 ? "boss" : round === 7 || round === 14 ? "miniboss" : [1, 4, 8, 11, 15, 19].includes(round) ? "filler" : "normal";
  return { kind, hpScale: 1 + i * 0.012, damageScale: 1 + i * 0.008 };
});

export function roundKindLabel(kind: EncounterKind): string {
  switch (kind) {
    case "filler": return "Filler round";
    case "normal": return "Round";
    case "miniboss": return "Mini-boss";
    case "boss": return "Boss";
  }
}

function shuffledIndices(rng: Rng, indices: number[]): number[] {
  const arr = [...indices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Samples one index per round from `pool`, reshuffling and continuing once
 * the pool is exhausted (rather than repeating in a fixed cycle) so the same
 * shape doesn't always reappear at the same distance. */
function sampleWithoutReplacement(rng: Rng, pool: number[], count: number): number[] {
  if (pool.length === 0 || count <= 0) return [];
  const result: number[] = [];
  let remaining: number[] = [];
  while (result.length < count) {
    if (remaining.length === 0) remaining = shuffledIndices(rng, pool);
    result.push(remaining.pop()!);
  }
  return result;
}

/** Draws this run's round-by-round encounter shapes: one ENCOUNTERS index
 * per round, matching that round's own ROUND_PLAN kind. Uses a SEPARATE
 * `Rng(seed ^ 0x9e3779b9)`, not the run's own fight stream — drawing from
 * the shared stream would shift every downstream roll (damage variance,
 * targeting, chain/backfire) and make a seed's fights incomparable to a
 * batch measured before this changed. */
export function drawRoundEncounters(seed: number, roundsPerRun: number): number[] {
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  const plan = ROUND_PLAN.slice(0, roundsPerRun);
  const byKind = new Map<EncounterKind, number[]>();
  for (const kind of ["filler", "normal", "miniboss", "boss"] as EncounterKind[]) {
    byKind.set(kind, encounterIndicesOfKind(kind));
  }
  const countByKind = new Map<EncounterKind, number>();
  for (const r of plan) countByKind.set(r.kind, (countByKind.get(r.kind) ?? 0) + 1);

  const drawnByKind = new Map<EncounterKind, number[]>();
  for (const [kind, count] of countByKind) {
    drawnByKind.set(kind, sampleWithoutReplacement(rng, byKind.get(kind) ?? [], count));
  }
  const cursor = new Map<EncounterKind, number>();
  return plan.map((r) => {
    const i = cursor.get(r.kind) ?? 0;
    cursor.set(r.kind, i + 1);
    return drawnByKind.get(r.kind)![i]!;
  });
}

export function roundDef(roundIndex: number): RoundDef {
  return ROUND_PLAN[Math.min(roundIndex, ROUND_PLAN.length - 1)]!;
}

export function encounterFor(encounterIndex: number): EncounterDef {
  const encounter = encounterAt(encounterIndex);
  if (!encounter) throw new Error(`no encounter authored at index ${encounterIndex}`);
  return encounter;
}

/** Builds the enemy SideState for one round: this round's authored shape,
 * scaled by ROUND_PLAN's own curve times its kind's extra multiplier. */
export function roundEnemySide(cfg: RunConfig, roundIndex: number, encounterIndex: number): SideState {
  const round = roundDef(roundIndex);
  const encounter = encounterFor(encounterIndex);
  const mult = KIND_SCALE_MULTIPLIER[round.kind];
  return buildEnemySide(
    cfg.fight as FightConfig,
    encounter,
    round.hpScale * mult.hp,
    round.damageScale * mult.damage,
  );
}
