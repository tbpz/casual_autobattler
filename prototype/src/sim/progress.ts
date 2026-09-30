import type { ChainEffect, RunConfig } from "./config.js";
import type { PayoffId } from "./payoffs.js";
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
  /** 2026-09-29 (add-don't-swap pass — see DECISIONS.md): every ability this
   * role's chain has picked up, base ability first (index 0). A "chainGain"
   * offer appends to this list; it's never replaced. */
  effects: ChainEffect[];
  /** 1 + this role's chain "+N" count. Each level above 1 leaves one extra
   * mark stack per rung (and longer Freeze) — see fight.ts's markStacks and
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
  /** Squad-wide payoff cards held (2026-09-30; sim/payoffs.ts), oldest first,
   * at most cfg.payoffCap. Handed to the fight in FightSetup.payoffs. */
  payoffs: PayoffId[];
  /** Chain abilities the player has been shown — every role's base ability
   * from the start, plus any ability a "chainGain" offer has put on screen
   * (taken or not). A payoff card is only offered once every mark it reads
   * comes from these (sim/offers.ts), so the player has met a mark before a
   * card that pays off on it asks them to judge it. */
  introduced: ChainEffect[];
}

export function makeInitialProgress(cfg: RunConfig): RunProgress {
  const chain = {} as Record<PlayerRole, RoleProgress>;
  const bonus = {} as Record<PlayerRole, StatBonus>;
  for (const role of PLAYER_ROLES) {
    chain[role] = { effects: [ROLE_POOL[role].baseChain], level: 1 };
    bonus[role] = { maxHp: 0, damage: 0 };
  }
  return { slots: cfg.startingSlots, chain, bonus, payoffs: [], introduced: PLAYER_ROLES.map((r) => ROLE_POOL[r].baseChain) };
}

/** A role's "stronger" upgrade count as a display-facing badge (2026-09-23,
 * "never the word level" — see DECISIONS.md). `level` starts at 1 (a no-op
 * multiplier, see fight.ts's escalatedMagnitude), so the badge is how many
 * times a "chainLevel" offer has actually been taken. 0 means never taken —
 * callers should hide the badge entirely rather than show "+0". */
export function chainStrongerCount(progress: RunProgress, role: PlayerRole): number {
  return progress.chain[role].level - 1;
}
