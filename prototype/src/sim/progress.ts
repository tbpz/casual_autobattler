import type { ChainEffect, RunConfig } from "./config.js";
import type { CardId } from "./cards/index.js";
import type { PlayerRole } from "./roles.js";
import { PLAYER_ROLES, ROLE_POOL, ROLE_UPGRADE_POOL } from "./roles.js";
import { Rng } from "./rng.js";

/** The stream a run draws its role upgrade options from — derived from the run
 * seed but separate from the fight stream and the offer stream, so having
 * options at all moved neither sequence. The headless driver and the
 * interactive session both use it, so one seed means one set of options. */
export function upgradeRngFor(seed: number): Rng {
  return new Rng((seed ^ 0x7c1a5d93) >>> 0);
}

/** The stream a run draws its relic choices from (and a Mercenary's role) —
 * its own, like upgradeRngFor, so offering relics moved neither the fight nor
 * the offer sequence. */
export function relicRngFor(seed: number): Rng {
  return new Rng((seed ^ 0x2f6b9d11) >>> 0);
}

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
  /** Squad-wide cards held (2026-09-30; sim/cards/index.ts), oldest first,
   * at most cfg.cardCap. Handed to the fight in FightSetup.cards. */
  cards: CardId[];
  /** Chain abilities the player has been shown — every role's base ability
   * from the start, plus any ability a "chainGain" offer has put on screen
   * (taken or not). A payoff card is only offered once every mark it reads
   * comes from these (sim/offers.ts), so the player has met a mark before a
   * card that pays off on it asks them to judge it. */
  introduced: ChainEffect[];
  /** 2026-10-01 (roles branch): the abilities this run may offer each role,
   * drawn once at run start from sim/roles.ts's ROLE_UPGRADE_POOL
   * (drawUpgradeOptions). A "chainGain" offer only ever names one of these, so
   * two runs push the same role toward different builds. */
  upgradeOptions: Record<PlayerRole, ChainEffect[]>;
  /** 2026-10-01: the relic picked as the round 1 reward (sim/relics.ts), held
   * from then on and never in the card list — so it takes no card slot and can't be dropped.
   * Undefined until the pick is made. */
  relic?: CardId;
}

/** Every card the run holds that a fight or a "what makes this mark" question
 * should count: the relic first (so its listeners run first), then the held
 * cards in the order they were taken. */
export function heldCards(progress: RunProgress): CardId[] {
  return progress.relic ? [progress.relic, ...progress.cards] : progress.cards;
}

/** Draws `cfg.upgradeOptionsPerRole` of each role's upgrade pool for one run,
 * kept in pool order so a role's options read the same way every time. Pulls
 * from its own `rng` — callers hand it a stream of its own (not the fight's or
 * the offer draw's), so adding the draw moved neither. */
export function drawUpgradeOptions(rng: Rng, cfg: RunConfig): Record<PlayerRole, ChainEffect[]> {
  const options = {} as Record<PlayerRole, ChainEffect[]>;
  for (const role of PLAYER_ROLES) {
    const pool = ROLE_UPGRADE_POOL[role];
    const left = [...pool];
    const picked: ChainEffect[] = [];
    while (picked.length < cfg.upgradeOptionsPerRole && left.length > 0) {
      picked.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
    }
    options[role] = pool.filter((e) => picked.includes(e));
  }
  return options;
}

/** A fresh run's progress. With an `upgradeRng` the role upgrade options are
 * drawn from it; without one (the lab, the batch `fight` command and most
 * checks, which have no run to vary) each role simply gets the first
 * `cfg.upgradeOptionsPerRole` entries of its pool. */
export function makeInitialProgress(cfg: RunConfig, upgradeRng?: Rng): RunProgress {
  const chain = {} as Record<PlayerRole, RoleProgress>;
  const bonus = {} as Record<PlayerRole, StatBonus>;
  const upgradeOptions = {} as Record<PlayerRole, ChainEffect[]>;
  const drawn = upgradeRng ? drawUpgradeOptions(upgradeRng, cfg) : undefined;
  for (const role of PLAYER_ROLES) {
    chain[role] = { effects: [ROLE_POOL[role].baseChain], level: 1 };
    bonus[role] = { maxHp: 0, damage: 0 };
    upgradeOptions[role] = drawn ? drawn[role] : ROLE_UPGRADE_POOL[role].slice(0, cfg.upgradeOptionsPerRole);
  }
  return {
    slots: cfg.startingSlots,
    chain,
    bonus,
    cards: [],
    introduced: PLAYER_ROLES.map((r) => ROLE_POOL[r].baseChain),
    upgradeOptions,
  };
}

/** A role's "stronger" upgrade count as a display-facing badge (2026-09-23,
 * "never the word level" — see DECISIONS.md). `level` starts at 1 (a no-op
 * multiplier, see fight.ts's escalatedMagnitude), so the badge is how many
 * times a "chainLevel" offer has actually been taken. 0 means never taken —
 * callers should hide the badge entirely rather than show "+0". */
export function chainStrongerCount(progress: RunProgress, role: PlayerRole): number {
  return progress.chain[role].level - 1;
}
