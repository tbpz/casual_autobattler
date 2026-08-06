/**
 * The sim -> render contract. fight.ts runs a fight to completion and emits
 * this once; render/playback.ts only ever replays it on wall-clock, never
 * re-simulates (the record-then-replay split carried over conceptually from
 * the old prototype's sim/engine.ts + render/playback.ts).
 */
import type { Role } from "./types.js";

export type Side = "player" | "enemy";

export type FightEvent =
  | { type: "attack"; t: number; side: Side; attackerId: string; targetId: string; damage: number }
  | { type: "heal"; t: number; side: Side; healerId: string; targetId: string; amount: number }
  | { type: "gateOpen"; t: number }
  | { type: "ignitionRoll"; t: number; fired: boolean; heroId: string | null }
  | { type: "chainHit"; t: number; hitIndex: number; damage: number; targetId: string }
  | { type: "chainEnd"; t: number; chainLength: number }
  | { type: "heroDown"; t: number; side: Side; heroId: string }
  | { type: "tankBreak"; t: number; side: Side; heroId: string }
  | { type: "tankRecover"; t: number; side: Side; heroId: string }
  | { type: "resolve"; t: number; outcome: "win" | "loss"; reason: "wipe" | "failsafe" };

/** A per-hero HP reading at one instant, for body rendering. */
export interface HeroSnapshot {
  id: string;
  name: string;
  role: Role;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Job counters as of this instant — see types.ts's HeroState docstring. */
  dealt: number;
  soaked: number;
  restored: number;
  hitsTaken: number;
  /** Tank-only: still holding aggro (not broken). Always false off-role. */
  holding: boolean;
}

export interface TickSnapshot {
  t: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerHeroes: HeroSnapshot[];
  enemyHeroes: HeroSnapshot[];
  /** The hero currently hot (mid-chain), if any. Sim-facing truth, consumed
   * by checks/batch — the renderer reads visibleChainHeroId instead, so a
   * chain that hasn't yet earned its tell (see chainTellThreshold) never
   * glows. */
  hotHeroId: string | null;
  /** Whether the eligibility gate (stage 1, deterministic) has opened yet.
   * Sim-facing truth only, as of 2026-08-06 — the gate no longer has a
   * dedicated visual (see DECISIONS.md's "jeopardy no longer mandatory"). */
  gateOpen: boolean;
  /** Render-facing chain state (2026-08-06): non-null only once the current
   * chain has landed cfg.chainTellThreshold+ hits, so a fizzled 0/1-length
   * chain never triggers the glow/callout tell. See DECISIONS.md's
   * "spectacle gated on payoff" entry. */
  visibleChainHeroId: string | null;
  visibleChainLength: number;
}

export interface FightResult {
  seed: number;
  events: FightEvent[];
  snapshots: TickSnapshot[];
  outcome: "win" | "loss";
  endReason: "wipe" | "failsafe";
  ignited: boolean;
  chainLength: number;
  durationSec: number;
  /** Final per-hero HP, for the run wrapper to carry forward as attrition. */
  finalPlayerHeroes: HeroSnapshot[];
  /** True if the player's tank line ever broke, or the gate opened with no
   * living tank — i.e. this fight had a real dip. See DECISIONS.md
   * 2026-08-06 and batch/report.ts's dipRate metric. */
  dipOccurred: boolean;
}
