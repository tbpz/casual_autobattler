/**
 * Builds the export log's file shape from a RunSession — pure (no DOM, no
 * Node): log/download.ts is the only part that touches the browser.
 *
 * 2026-10-02: rewritten against the roles/cards/relics run. The first export
 * log (2026-09-20) was deleted with the roles rebuild because it was built on
 * named heroes and coin; this one carries what a build question needs — the
 * relic, held cards, each role's abilities going into every round, the offers
 * shown and taken, and per fight the chains, card triggers and per-unit
 * damage/soak/heal.
 *
 * The full event list is kept for each fight; the tick snapshots (~600 per
 * fight) are left out — they are what would make the file huge, and every
 * reading worth having is already summed below.
 */
import type { RunConfig } from "../sim/config.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import type { RunProgress } from "../sim/progress.js";
import type { RunSession, RoundLog, UnitReading } from "../render/runSession.js";

export const RUN_LOG_SCHEMA_VERSION = 2;

export interface ChainSummary {
  t: number;
  heroId: string;
  effects: string[];
  backfire: boolean;
  length: number;
  totalDamage: number;
  totalStunSec: number;
  killedIds: string[];
  reason: string;
}

export interface CardTriggerSummary {
  count: number;
  /** Sum of each trigger's `amount` — damage, stacks or shield, depending on the card. */
  amount: number;
  maxDepth: number;
}

export interface UnitFightSummary {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  dealt: number;
  soaked: number;
  restored: number;
  hitsTaken: number;
  backfires: number;
  fatigue: number;
}

export interface FightSummary {
  outcome: "win" | "loss";
  endReason: string;
  durationSec: number;
  ignited: boolean;
  chainLength: number;
  dipOccurred: boolean;
  chains: ChainSummary[];
  cardTriggers: Record<string, CardTriggerSummary>;
  units: UnitFightSummary[];
  burnDamage: { onEnemy: number; onPlayer: number };
  shieldAbsorbed: { onEnemy: number; onPlayer: number };
  slams: { total: number; byRedirect: Record<string, number> };
}

/** Sums one fight's events into the readings the log leads with. Exported for
 * the check, which compares it against the raw events. */
export function summarizeFight(result: FightResult): FightSummary {
  const chains: ChainSummary[] = [];
  const cardTriggers: Record<string, CardTriggerSummary> = {};
  const burnDamage = { onEnemy: 0, onPlayer: 0 };
  const shieldAbsorbed = { onEnemy: 0, onPlayer: 0 };
  const slams = { total: 0, byRedirect: {} as Record<string, number> };

  for (const e of result.events as FightEvent[]) {
    switch (e.type) {
      case "chainEnd":
        chains.push({
          t: e.t,
          heroId: e.heroId,
          effects: [...e.effects],
          backfire: e.backfire,
          length: e.chainLength,
          totalDamage: e.totalDamage,
          totalStunSec: e.totalStunSec,
          killedIds: [...e.killedIds],
          reason: e.reason,
        });
        break;
      case "cardTriggered": {
        const c = (cardTriggers[e.card] ??= { count: 0, amount: 0, maxDepth: 0 });
        c.count++;
        c.amount += e.amount;
        c.maxDepth = Math.max(c.maxDepth, e.depth);
        break;
      }
      case "burnTick":
        burnDamage[e.side === "enemy" ? "onEnemy" : "onPlayer"] += e.amount;
        break;
      case "shieldAbsorb":
        shieldAbsorbed[e.side === "enemy" ? "onEnemy" : "onPlayer"] += e.amount;
        break;
      case "windupHit": {
        slams.total++;
        const key = e.redirect ?? "none";
        slams.byRedirect[key] = (slams.byRedirect[key] ?? 0) + 1;
        break;
      }
      default:
        break;
    }
  }

  return {
    outcome: result.outcome,
    endReason: result.endReason,
    durationSec: result.durationSec,
    ignited: result.ignited,
    chainLength: result.chainLength,
    dipOccurred: result.dipOccurred,
    chains,
    cardTriggers,
    units: result.finalPlayerHeroes.map((h) => ({
      id: h.id,
      name: h.name,
      role: h.role,
      hp: h.hp,
      maxHp: h.maxHp,
      alive: h.alive,
      dealt: h.dealt,
      soaked: h.soaked,
      restored: h.restored,
      hitsTaken: h.hitsTaken,
      backfires: h.backfires,
      fatigue: h.fatigue,
    })),
    burnDamage,
    shieldAbsorbed,
    slams,
  };
}

/** What the run carried into a round, trimmed to what a build question reads. */
function goingIn(p: RunProgress) {
  return {
    relic: p.relic ?? null,
    cards: [...p.cards],
    chain: Object.fromEntries(Object.entries(p.chain).map(([role, c]) => [role, { effects: [...c.effects], level: c.level }])),
    bonus: p.bonus,
    slots: p.slots,
  };
}

export interface RoundEntry {
  roundIndex: number;
  kind: string;
  encounter: { index: number; name: string };
  squad: UnitReading[];
  fieldedIds: string[];
  defaultFieldedIds: string[];
  goingIn: ReturnType<typeof goingIn>;
  projection: unknown;
  fight: FightSummary & { events: FightEvent[] };
  reward: {
    relicChoices: string[] | null;
    relicTaken: string | null;
    offersShown: unknown[];
    offerTaken: unknown | null;
    droppedCard: string | null;
  };
}

export interface RunLogFile {
  about: { generatedAt: string; schemaVersion: number; runConfig: RunConfig };
  run: {
    seed: number;
    status: "in-progress" | "complete" | "over";
    overReason: "loss" | "rosterExhausted" | null;
    roundsWon: number;
    relic: string | null;
    upgradeOptions: RunProgress["upgradeOptions"];
    finalProgress: ReturnType<typeof goingIn>;
  };
  rounds: RoundEntry[];
}

function roundEntry(r: RoundLog): RoundEntry {
  return {
    roundIndex: r.roundIndex,
    kind: r.kind,
    encounter: { index: r.encounterIndex, name: r.encounterName },
    squad: r.squad,
    fieldedIds: r.fieldedIds,
    defaultFieldedIds: r.defaultFieldedIds,
    goingIn: goingIn(r.progressBefore),
    projection: r.projection,
    fight: { ...summarizeFight(r.fightResult), events: r.fightResult.events },
    reward: {
      relicChoices: r.relicChoices,
      relicTaken: r.relicTaken,
      offersShown: r.offersShown,
      offerTaken: r.offerTaken,
      droppedCard: r.droppedCard,
    },
  };
}

export function buildRunLog(session: RunSession, cfg: RunConfig): RunLogFile {
  return {
    about: { generatedAt: new Date().toISOString(), schemaVersion: RUN_LOG_SCHEMA_VERSION, runConfig: cfg },
    run: {
      seed: session.seed,
      status: session.status,
      overReason: session.overReason,
      roundsWon: session.rounds.filter((r) => r.outcome === "win").length,
      relic: session.progress.relic ?? null,
      upgradeOptions: session.progress.upgradeOptions,
      finalProgress: goingIn(session.progress),
    },
    rounds: session.roundLogs.map(roundEntry),
  };
}
