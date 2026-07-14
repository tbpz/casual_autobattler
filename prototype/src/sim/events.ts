import type { Hex } from "./hex";
import type { Role, Team } from "./types";

/**
 * The sim/skin output contract. The render layer (Phase 1) consumes only these two
 * shapes — it never reaches into engine internals. Snapshots drive interpolated motion;
 * events drive hit feedback, death animation, and the post-fight recap (attribution, OQ-7).
 */

export interface UnitSnapshot {
  readonly id: string;
  readonly team: Team;
  readonly role: Role;
  readonly hp: number;
  readonly maxHp: number;
  readonly alive: boolean;
  /** Hex the unit is moving from this tick (equals `toHex` when stationary). */
  readonly fromHex: Hex;
  /** Hex the unit is moving to this tick (equals `fromHex` when stationary). */
  readonly toHex: Hex;
  /** Progress from fromHex to toHex, 0..1. Render lerps between them using this. */
  readonly moveT: number;
  /** Current aggro target, if any — drives the on-demand aggro-line telegraph. */
  readonly targetId: string | null;
  /** Effective attack range in hex steps (elevation-adjusted) — drives the on-demand range-ring telegraph. */
  readonly range: number;
}

export interface TickSnapshot {
  readonly tick: number;
  readonly timeSeconds: number;
  readonly units: readonly UnitSnapshot[];
}

export type SimEvent =
  | { readonly type: "attack"; readonly tick: number; readonly attackerId: string; readonly targetId: string; readonly damage: number; readonly targetHpAfter: number }
  | { readonly type: "death"; readonly tick: number; readonly unitId: string; readonly killedBy: string }
  | { readonly type: "end"; readonly tick: number; readonly winner: Team | "draw" };

export interface SimResult {
  readonly seed: number;
  readonly mapId: string;
  readonly winner: Team | "draw";
  readonly ticks: number;
  readonly snapshots: readonly TickSnapshot[];
  readonly events: readonly SimEvent[];
}
