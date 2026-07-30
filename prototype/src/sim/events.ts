/**
 * The sim -> render contract. fight.ts runs a fight to completion and emits
 * this once; render/playback.ts only ever replays it on wall-clock, never
 * re-simulates (the record-then-replay split carried over conceptually from
 * the old prototype's sim/engine.ts + render/playback.ts).
 */

export type Side = "player" | "enemy";

export type FightEvent =
  | { type: "gateOpen"; t: number }
  | { type: "ignitionRoll"; t: number; fired: boolean; heroId: string | null }
  | { type: "chainHit"; t: number; hitIndex: number; damage: number; targetId: string }
  | { type: "chainEnd"; t: number; chainLength: number }
  | { type: "heroDown"; t: number; side: Side; heroId: string }
  | { type: "resolve"; t: number; outcome: "win" | "loss"; reason: "wipe" | "timer" };

/** A per-hero HP reading at one instant, for body rendering. */
export interface HeroSnapshot {
  id: string;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface TickSnapshot {
  t: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerHeroes: HeroSnapshot[];
  enemyHeroes: HeroSnapshot[];
  /** The hero currently hot (mid-chain), if any — drives the chain's visual tell. */
  hotHeroId: string | null;
}

export interface FightResult {
  seed: number;
  events: FightEvent[];
  snapshots: TickSnapshot[];
  outcome: "win" | "loss";
  endReason: "wipe" | "timer";
  ignited: boolean;
  chainLength: number;
  durationSec: number;
  /** Final per-hero HP, for the run wrapper to carry forward as attrition. */
  finalPlayerHeroes: HeroSnapshot[];
}
