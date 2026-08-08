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
  /** See types.ts's HeroState docstring — the squad-pick cascade lever. */
  chainAffinity: number;
  /** One line for the squad-pick screen — what picking this hero buys you,
   * beyond its raw numbers. */
  identity: string;
}

/**
 * Re-cut 2026-08-08 (player verdict: the pool was a dominance ladder, not a
 * set of tradeoffs — Vex out-DPSed Rook for near-free, any comp with both
 * Cairn and Ward lost 100% of the time since two non-attacking supports is a
 * guaranteed loss, and squad choice barely moved the cascade's odds at all).
 * Each role's pair now trades on a DIFFERENT axis so no hero dominates every
 * axis, and every hero carries a visible `chainAffinity` — the lever that
 * makes "who I pick" answer "how am I going for the cascade," the way
 * picking a Dota item build does:
 *  - tank: Bracer is the wall (low affinity, rarely chains); Hollow is
 *    fragile but chains hard (high affinity) — a real HP-for-ceiling trade.
 *  - damage: Rook is the heat engine — frequent, modest chains (highest
 *    affinity in the pool, on a small damage stat); Vex is burst — rare but
 *    enormous chains (high damage, moderate affinity). Rook no longer loses
 *    to Vex on every axis; they're different bets.
 *  - support: Cairn is the pure safety net (lowest affinity — it almost
 *    never chains, by design); Ward now attacks AND heals on the same beat
 *    (attacksWhileHealing) so a two-support comp is no longer an automatic
 *    loss, and Ward's own moderate affinity gives the healing-forward comp a
 *    real, if modest, shot at the cascade too.
 * Values are strawmen for the batch harness (npm run batch --squad <combo>)
 * to move, same as everywhere else in this file. See DECISIONS.md's
 * housekeeping note for the 2026-08-07 heat rebuild this pool sits on top of.
 *
 * Known open tuning gap (2026-08-08, same shape as the earlier hollow/bracer
 * gap this docstring used to carry): bracer+vex+cairn and vex+cairn+ward —
 * the safest tank, the highest-damage dealer, and a real healer, together —
 * stay near-100% run completion in the batch harness regardless of how hard
 * config.ts's difficultyRampFactor/difficultyDamageRampFactor are pushed.
 * The reason is structural, not a tuning miss: Vex kills so fast that few
 * enemy attacks land at all, so neither an HP ramp (more total exposure
 * time) nor a damage ramp (harder per-hit) has much to bite into. This comp
 * has no weakness on any axis a global ramp can reach — fixing it needs a
 * hero-stat-level change (e.g. a real cost on Vex, or a cap on how much
 * burst a healer can out-sustain), not another global-ramp pass. Not
 * blocking: every other comp, including the default roster, shows a real
 * spread of risk (see `npm run batch` with no args for the full matrix).
 */
export const PLAYER_HERO_POOL: HeroDef[] = [
  {
    id: "bracer", name: "Bracer", role: "tank", maxHp: 280, damage: 5, attackIntervalSec: 1.4,
    chainAffinity: 0.4, identity: "The wall. Steady, unglamorous, rarely chains.",
  },
  {
    id: "hollow", name: "Hollow", role: "tank", maxHp: 130, damage: 6, attackIntervalSec: 1.1,
    chainAffinity: 1.4, identity: "Fragile — but chains hard when it connects.",
  },
  {
    id: "rook", name: "Rook", role: "damage", maxHp: 85, damage: 6, attackIntervalSec: 0.9,
    chainAffinity: 1.6, identity: "The heat engine. Frequent, modest chains.",
  },
  {
    id: "vex", name: "Vex", role: "damage", maxHp: 45, damage: 12, attackIntervalSec: 0.7,
    chainAffinity: 0.9, identity: "Explosive burst. Rare, enormous chains.",
  },
  {
    id: "cairn", name: "Cairn", role: "support", maxHp: 110, damage: 1, attackIntervalSec: 1.2, healPerBeat: 7,
    chainAffinity: 0.3, identity: "The safety net. Almost never chains.",
  },
  {
    id: "ward", name: "Ward", role: "support", maxHp: 75, damage: 3, attackIntervalSec: 1.0, healPerBeat: 4,
    attacksWhileHealing: true, chainAffinity: 1.1, identity: "Heals AND swings — a hybrid pick.",
  },
];

/** The highest chainAffinity in the pool — squadPickScreen normalizes its
 * pip display against this so the pips stay correct if the pool changes. */
export const MAX_CHAIN_AFFINITY = Math.max(...PLAYER_HERO_POOL.map((h) => h.chainAffinity));

/** The working accept-default squad — the comfortable comp: one tank, one
 * damage, one support, none of them the greedy pick in their role. */
export const DEFAULT_PLAYER_ROSTER_IDS = ["bracer", "rook", "cairn"];

const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

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
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
    heat: 0,
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
