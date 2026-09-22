import type { ChainEffect, RunConfig } from "./config.js";
import type { PlayerRole } from "./roles.js";
import { PLAYER_ROLES, ROLE_POOL } from "./roles.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). What a
 * run carries forward that ISN'T a specific unit's own HP/charge (that's
 * still on the roster's SideState, see roster.ts) — the role-wide upgrades
 * Tu asked for: "chain upgrades belong to the role, not to one unit. Upgrade
 * 'Tank chain' once and every tank you have, plus every tank you recruit
 * later, has it."
 *
 * Read by sim/roster.ts's stampProgressOntoSquad (applies chain/level to a
 * fielded squad every round) and sim/roles.ts's makeUnitState (bakes the
 * stat bonus into a freshly-recruited unit). Written by sim/offers.ts's
 * applyOffer — the only place this is ever mutated (a fresh copy, not
 * in-place, so both the headless run driver and the interactive UI can
 * treat it as ordinary immutable state).
 */
export interface RoleProgress {
  effect: ChainEffect;
  /** Multiplies this role's chain rung magnitude/duration — see
   * fight.ts's escalatedMagnitude/escalatedDurationSec and
   * config.ts's chainLevelStep/chainLevelCap. */
  level: number;
}

export interface StatBonus {
  maxHp: number;
  damage: number;
}

export interface RunProgress {
  /** Units fielded per round — starts at cfg.startingSlots, grows via the
   * "slot" offer, capped at cfg.maxSlots. */
  slots: number;
  chain: Record<PlayerRole, RoleProgress>;
  bonus: Record<PlayerRole, StatBonus>;
}

export function makeInitialProgress(cfg: RunConfig): RunProgress {
  const chain = {} as Record<PlayerRole, RoleProgress>;
  const bonus = {} as Record<PlayerRole, StatBonus>;
  for (const role of PLAYER_ROLES) {
    chain[role] = { effect: ROLE_POOL[role].baseChain, level: 1 };
    bonus[role] = { maxHp: 0, damage: 0 };
  }
  return { slots: cfg.startingSlots, chain, bonus };
}

/** A role's current chain level as a display-facing multiplier note — used
 * by offer copy ("Tank chain — level 2 -> 3") and the round screen. */
export function chainLevelLabel(progress: RunProgress, role: PlayerRole): string {
  return `level ${progress.chain[role].level}`;
}
