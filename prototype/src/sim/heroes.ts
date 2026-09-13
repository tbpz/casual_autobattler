import type { ChainEffect } from "./config.js";
import type { HeroState, Role, SideState } from "./types.js";

/**
 * The single source of hero definitions — the squad-pick screen, the
 * pre-fight read, the headless batch harness, and the CLI all build player
 * sides from this pool so they can never drift onto different stat blocks.
 */
export interface HeroDef {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  healPerBeat?: number;
  /** See types.ts's HeroState docstring — Ward's hybrid identity. */
  attacksWhileHealing?: boolean;
  /** See types.ts's HeroState docstring — the volatility lever: higher
   * affinity means a bigger backfire chance (config.ts's backfireChanceFor).
   * Unrelated to the chain's effect or magnitude — see chainEffect below. */
  chainAffinity: number;
  /** This hero's chain EFFECT (2026-09-13, "a hero's chain names its own
   * enemy" rebuild — see config.ts's ChainEffect). The mechanical identity
   * lever: heroes differ in WHAT the chain does, not in how big a number it
   * produces or how its odds are shaped — see this file's top docstring for
   * the full table of who does what and what it answers. */
  chainEffect: ChainEffect;
  /** One line for the squad-pick screen — what picking this hero buys you,
   * beyond its raw numbers. */
  identity: string;
}

/**
 * Per-hero chain EFFECT (2026-09-13, "a hero's chain names its own enemy"
 * rebuild — see DECISIONS.md). Replaces the 2026-08-20 per-hero ChainProfile
 * (shape) and 2026-09-02 ChainTargeting (aim) passes wholesale — both of
 * those were still one effect (an escalating hit or heal) described by a
 * number, and a number describing your own hero has no enemy on the other
 * side of it to be weak to. A player was found unable to form a memory of
 * "long fuse, flat growth" because nothing in the world answers a fuse
 * length; "reduce armor" works precisely because armor is a thing the ENEMY
 * has.
 *
 * Every hero now differs in WHAT its chain does, and each effect is named for
 * the enemy it answers:
 *
 *   Hero    Effect         Answers
 *   ------  -------------  --------------------------------------------
 *   Vex     strikeAll      a crowd — hits every living enemy at once
 *   Rook    poundBiggest   one huge body — keeps pounding the biggest
 *   Bracer  guard          anything that winds up — takes the hit instead
 *   Hollow  stun           a spike that needs cancelling, or a fast attacker
 *   Cairn   mendAll        steady chip damage from many small hits
 *   Ward    mendOne        a threat that hunts one hero to kill it
 *
 * All six escalate on the SAME curve (config.ts's chainEscalationFactor) and
 * the same continuation table (chainChanceByHitsSoFar) — heroes no longer
 * carry their own fuse length or steepness. The run still escalates and still
 * carries the same surprise (it might be 2 rungs, might be 7); it just
 * carries a verb now instead of a bare number. See config.ts's ChainEffect
 * and FightConfig's chainStrikeAllBase/chainPoundBase/chainMendAllBase/
 * chainMendOneBase/chainStunBaseSec/chainGuardBaseSec for the per-effect base
 * magnitudes, and fight.ts's resolveChainHit for the switch that reads them.
 *
 * `chainAffinity` is untouched by this pass — it is still purely the
 * volatility lever (config.ts's backfireChanceFor): how likely this hero's
 * chain is to backfire, nothing about what it does or how big it is.
 */
export const PLAYER_HERO_POOL: HeroDef[] = [
  {
    id: "bracer", name: "Bracer", role: "tank", maxHp: 195, damage: 7, attackIntervalSec: 1.4,
    chainAffinity: 0.75,
    chainEffect: "guard",
    identity: "Its chain covers the squad — the enemy's next telegraphed hit lands on Bracer instead. Bring it against anything that winds up.",
  },
  {
    id: "hollow", name: "Hollow", role: "tank", maxHp: 180, damage: 6, attackIntervalSec: 1.1,
    chainAffinity: 1.3,
    chainEffect: "stun",
    identity: "Its chain freezes an enemy solid, cancelling a wind-up in progress. Bring it against a spike you need cancelled, or anything fast.",
  },
  {
    id: "rook", name: "Rook", role: "damage", maxHp: 85, damage: 6, attackIntervalSec: 0.9,
    chainAffinity: 1.4,
    chainEffect: "poundBiggest",
    identity: "Its chain keeps pounding the single biggest body on the field. Bring it against one huge enemy — highest backfire risk in the pool to match.",
  },
  {
    id: "vex", name: "Vex", role: "damage", maxHp: 70, damage: 11, attackIntervalSec: 1.5,
    chainAffinity: 1.0,
    chainEffect: "strikeAll",
    identity: "Its chain hits every living enemy at once. Bring it against a crowd — a lone tough body barely notices.",
  },
  {
    id: "cairn", name: "Cairn", role: "support", maxHp: 110, damage: 1, attackIntervalSec: 1.2, healPerBeat: 7,
    chainAffinity: 0.7,
    chainEffect: "mendAll",
    identity: "Its chain heals the whole squad at once. Bring it against steady chip damage from many small hits — lowest backfire risk in the pool.",
  },
  {
    id: "ward", name: "Ward", role: "support", maxHp: 92, damage: 3, attackIntervalSec: 1.0, healPerBeat: 3,
    attacksWhileHealing: true, chainAffinity: 1.15,
    chainEffect: "mendOne",
    identity: "Its chain pours everything into your worst-hurt hero. Bring it when the enemy is hunting one hero to kill it.",
  },
];

/** The highest/lowest chainAffinity in the pool — used by fightView.ts's
 * ignition-burst visual scale to size the ignition tell's intensity to how
 * volatile the firing hero is. Unaffected by the 2026-09-13 chain-effect
 * rebuild — chainAffinity was already, and remains, volatility only. */
export const MAX_CHAIN_AFFINITY = Math.max(...PLAYER_HERO_POOL.map((h) => h.chainAffinity));
/** The lowest chainAffinity in the pool — paired with MAX_CHAIN_AFFINITY so
 * the renderer can normalize an ignition tell's intensity to "how loud is
 * this hero's ignition, relative to the pool's range" without importing the
 * whole pool (see render/fightView.ts's showChainStart). */
export const MIN_CHAIN_AFFINITY = Math.min(...PLAYER_HERO_POOL.map((h) => h.chainAffinity));

/** The working accept-default FIELDED squad — the comfortable comp: one
 * tank, one damage, one support, none of them the greedy pick in their role.
 * Still used by the ad-hoc single-fight CLI paths (batch/cli.ts's `fight`
 * subcommand) and by checks that test one fight in isolation, outside the
 * run-level roster below. */
export const DEFAULT_PLAYER_ROSTER_IDS = ["bracer", "rook", "cairn"];

/** The working accept-default DRAFT (2026-08-09 roster/bench pass — see
 * roster.ts and config.ts's rosterSize): 5 of the pool's 6, leaving Vex
 * (the explosive-burst outlier) as the one hero a player has to actively
 * choose to bring in rather than getting for free. */
export const DEFAULT_DRAFT_ROSTER_IDS = ["bracer", "hollow", "rook", "cairn", "ward"];

/** Tank -> damage -> support fielding priority — exported for roster.ts's
 * defaultFieldPick (the accept-default fielding order) as well as
 * makePlayerSide's own sort below, so the two never drift apart. */
export const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

export function findHeroDef(id: string): HeroDef {
  const def = PLAYER_HERO_POOL.find((h) => h.id === id);
  if (!def) throw new Error(`unknown hero id: ${id}`);
  return def;
}

export function makeHeroState(def: HeroDef, instanceId: string, phase = 0): HeroState {
  return {
    id: instanceId,
    name: def.name,
    role: def.role,
    maxHp: def.maxHp,
    hp: def.maxHp,
    alive: true,
    damage: def.damage,
    attackIntervalSec: def.attackIntervalSec,
    // phase in [0,1) spreads a side's first beats across one interval so
    // same-cadence heroes don't all act on the identical tick (2026-08-06 —
    // see DECISIONS.md's per-hero-bars entry for why simultaneous beats were
    // a legibility problem: six lunges/flinches firing in the same 250ms).
    nextAttackT: def.attackIntervalSec * (1 - phase * 0.8),
    healPerBeat: def.healPerBeat,
    attacksWhileHealing: def.attacksWhileHealing,
    chainAffinity: def.chainAffinity,
    chainEffect: def.chainEffect,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
    charge: 0,
  };
}

/** Builds the player SideState from chosen hero ids, sorted tank-first so the
 * tank draws the front-row visual slot (targeting itself is weighted-random —
 * see fight.ts — not positional, but the front row is still where a tank
 * "belongs" on screen). */
export function makePlayerSide(heroIds: string[] = DEFAULT_PLAYER_ROSTER_IDS, dpsBonus = 0): SideState {
  const heroes = heroIds
    .map((id, i) => makeHeroState(findHeroDef(id), `p${i}_${id}`, i / heroIds.length))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus };
}
