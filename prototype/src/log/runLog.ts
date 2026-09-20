/**
 * Builds the export log's file shape from a RunSession — pure (no DOM, no
 * Node): log/download.ts is the only part of this feature that touches the
 * browser, and tools/readLog.ts reads the JSON this produces back in Node,
 * so nothing here may depend on either environment.
 *
 * Deliberately NOT included: FightResult.snapshots (~600 per-tick readings
 * per fight — see decided.ts's header for why the ground truth they carry is
 * read at export time but never itself written out). Everything else the
 * game saw is here: the full event list per fight, the roster/enemy/coin
 * state before and after, the pre-fight projection, and enough of the
 * fielded squad's starting HP/charge to re-run the same round with a
 * different pick (tools/readLog.ts's what-if sweep).
 */
import type { RunConfig } from "../sim/config.js";
import type { HeroState, SideState } from "../sim/types.js";
import { encounterAt } from "../sim/encounters.js";
import type { RunSession, RoundLog } from "../render/runSession.js";
import { summarizeFight, type DecidedSummary } from "./decided.js";

export const RUN_LOG_SCHEMA_VERSION = 1;

/** A hero as it stood at some instant — the pre-fight roster reading, not
 * fight.ts's full HeroState (nextAttackT, windup targeting, etc. are
 * per-fight transient state, meaningless before the fight starts). */
export interface HeroReading {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  charge: number;
  chainEffect?: string;
}

function readHero(h: HeroState): HeroReading {
  return { id: h.id, name: h.name, role: h.role, hp: h.hp, maxHp: h.maxHp, alive: h.alive, charge: h.charge, chainEffect: h.chainEffect };
}

function readRoster(side: SideState): { heroes: HeroReading[]; dpsBonus: number } {
  return { heroes: side.heroes.map(readHero), dpsBonus: side.dpsBonus };
}

export interface EnemyReading {
  name: string | null;
  blurb: string | null;
  tier: "early" | "mid" | "finale" | null;
  bodies: HeroReading[];
}

function readEnemy(encounterIndex: number, enemy: SideState): EnemyReading {
  const def = encounterAt(encounterIndex);
  return {
    name: def?.name ?? null,
    blurb: def?.blurb ?? null,
    tier: def?.tier ?? null,
    bodies: enemy.heroes.map(readHero),
  };
}

/** Enough of the fielded squad's pre-fight state to re-run this exact round
 * with a different pick — see lab/labFight.ts's LabSetup, which this maps
 * onto almost field-for-field. Percent, not absolute, because LabSetup's own
 * chargePercents/hpPercents are percent-of-that-slot's-own-maxHp — the same
 * convention this file's replay block uses so tools/readLog.ts can hand
 * these straight to buildLabFightSetup with no conversion. */
export interface ReplaySeed {
  heroIds: string[];
  hpPercents: number[];
  chargePercents: number[];
  encounterIndex: number;
  rampIndex: number;
  dpsBonus: number;
}

function buildReplaySeed(cfg: RunConfig, round: RoundLog): ReplaySeed {
  const byId = new Map(round.rosterBefore.heroes.map((h) => [h.id, h]));
  const fielded = round.fieldedIds.map((id) => byId.get(id)).filter((h): h is HeroState => !!h);
  return {
    heroIds: fielded.map((h) => h.id.replace(/^p\d+_/, "")),
    hpPercents: fielded.map((h) => (h.maxHp > 0 ? Math.round((h.hp / h.maxHp) * 100) : 0)),
    chargePercents: fielded.map((h) => Math.round((h.charge / cfg.fight.chargeThreshold) * 100)),
    encounterIndex: round.encounterIndex,
    rampIndex: round.fightIndex,
    dpsBonus: round.rosterBefore.dpsBonus,
  };
}

export interface RoundEntry {
  fightIndex: number;
  before: { roster: { heroes: HeroReading[]; dpsBonus: number }; coin: number };
  enemy: EnemyReading;
  pick: { fieldedIds: string[]; defaultFieldedIds: string[]; projection: unknown };
  fight: {
    seed: number;
    events: unknown[];
    outcome: "win" | "loss";
    endReason: string;
    durationSec: number;
    ignited: boolean;
    chainLength: number;
    dipOccurred: boolean;
  };
  after: { roster: { heroes: HeroReading[]; dpsBonus: number } | null; coin: number; coinAwarded: number; spend: string | null };
  decided: DecidedSummary;
  replay: ReplaySeed;
}

export interface RunLogFile {
  about: {
    generatedAt: string;
    schemaVersion: number;
    runConfig: RunConfig;
  };
  run: {
    seed: number;
    draftIds: string[];
    encounterOrder: { index: number; name: string | null }[];
    status: "in-progress" | "complete" | "over";
    overReason: "loss" | "rosterExhausted" | null;
  };
  rounds: RoundEntry[];
}

export function buildRunLog(session: RunSession, cfg: RunConfig): RunLogFile {
  const rounds: RoundEntry[] = session.roundLogs.map((round) => ({
    fightIndex: round.fightIndex,
    before: { roster: readRoster(round.rosterBefore), coin: round.coinBefore },
    enemy: readEnemy(round.encounterIndex, round.enemyBefore),
    pick: { fieldedIds: round.fieldedIds, defaultFieldedIds: round.defaultFieldedIds, projection: round.projection },
    fight: {
      seed: round.fightResult.seed,
      events: round.fightResult.events,
      outcome: round.fightResult.outcome,
      endReason: round.fightResult.endReason,
      durationSec: round.fightResult.durationSec,
      ignited: round.fightResult.ignited,
      chainLength: round.fightResult.chainLength,
      dipOccurred: round.fightResult.dipOccurred,
    },
    after: {
      roster: round.rosterAfter ? readRoster(round.rosterAfter) : null,
      coin: round.coinAfter,
      coinAwarded: round.coinAwarded,
      spend: round.spend,
    },
    decided: summarizeFight(round.fightResult),
    replay: buildReplaySeed(cfg, round),
  }));

  return {
    about: {
      generatedAt: new Date().toISOString(),
      schemaVersion: RUN_LOG_SCHEMA_VERSION,
      runConfig: cfg,
    },
    run: {
      seed: session.seed,
      draftIds: session.draftIds,
      encounterOrder: session.encounterOrderFull.map((index) => ({ index, name: encounterAt(index)?.name ?? null })),
      status: session.status,
      overReason: session.overReason,
    },
    rounds,
  };
}
