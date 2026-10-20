import type { ChainEffect } from "./config.js";
import type { HeroState, Role, SideState } from "./types.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). Replaces
 * heroes.ts's six named heroes (Bracer, Hollow, Rook, Vex, Cairn, Ward)
 * wholesale: the run-start draft asked the player to judge six invented
 * names, each carrying stats and a chain effect, before a single enemy had
 * been seen — work with no way to be evaluated yet. A player now starts with
 * three UNITS named by role — Tank, Damage, Healer, the words everyone
 * already knows — and earns everything else (a chain upgrade, another unit,
 * a stat bump) as the run goes, via sim/offers.ts.
 *
 * A role's three base numbers below are carried over from whichever named
 * hero anchored that archetype (Bracer/Rook/Cairn), so nothing needed a
 * from-scratch retune. A role's BASE chain effect is exactly the identity
 * that hero carried; the three effects the other three heroes carried
 * (Hollow's stun, Vex's scorch, Ward's ward — formerly strikeAll and mendAll) are what a "chainGain"
 * offer (sim/offers.ts) lets a role grow INTO — added alongside the base
 * ability, never swapped for it (2026-09-29, add-don't-swap — see
 * DECISIONS.md) — Tu's own ask: "there's a chance user can upgrade the chain
 * ability as Hollow or Bracer is having now for their tanker."
 */
export type PlayerRole = "tank" | "damage" | "support";

export const PLAYER_ROLES: PlayerRole[] = ["tank", "damage", "support"];

/** Plain-English label for a role — "Healer" rather than the internal
 * "support" (kept as the Role id so fight.ts's role-keyed logic, e.g.
 * healPerBeat/tank-holding, doesn't need to change at all). */
export const ROLE_LABEL: Record<PlayerRole, string> = {
  tank: "Tank",
  damage: "Damage",
  support: "Healer",
};

/** What a role's chain can grow INTO via a "chainGain" offer (sim/offers.ts) —
 * the role's upgrade pool, added to its ability list (never replacing the
 * base). 2026-10-01 (roles branch): was one fixed upgrade per role
 * (ROLE_CHAIN_UPGRADE); now three, of which a run draws some as that role's
 * options (sim/progress.ts's drawUpgradeOptions) and a role may hold at most
 * cfg.maxUpgradesPerRole. Every role's pool reaches three different marks, so a
 * shield Tank or a burn Healer is a real route. The first entry is the old
 * single upgrade. */
export const ROLE_UPGRADE_POOL: Record<PlayerRole, ChainEffect[]> = {
  tank: ["stun", "brace", "quake"],
  damage: ["scorch", "frostbolt", "siphon"],
  support: ["ward", "cauterize", "chill"],
};

export interface RoleDef {
  role: PlayerRole;
  label: string;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  healPerBeat?: number;
  /** This role's chain's first ability — always index 0 of its ability
   * list, before any "chainGain" offer adds another — see config.ts's
   * ChainEffect. */
  baseChain: ChainEffect;
}

/** The three roles' base stat blocks — strawmen carried over from the
 * heroes they replace (heroes.ts's history, before this pass): Tank from
 * Bracer, Damage from Rook, Healer from Cairn. Meant to move by playing, same
 * convention as every number in config.ts. */
export const ROLE_POOL: Record<PlayerRole, RoleDef> = {
  tank: {
    role: "tank", label: ROLE_LABEL.tank, maxHp: 190, damage: 7, attackIntervalSec: 1.3, baseChain: "guard",
  },
  damage: {
    role: "damage", label: ROLE_LABEL.damage, maxHp: 80, damage: 8, attackIntervalSec: 1.1, baseChain: "expose",
  },
  support: {
    role: "support", label: ROLE_LABEL.support, maxHp: 100, damage: 2, attackIntervalSec: 1.1, healPerBeat: 6, baseChain: "mend",
  },
};

/** Tank -> damage -> support fielding/render priority — same convention the
 * old heroes.ts pool used, kept over the "support" role id and extended with
 * the two enemy roles so a mixed sort never throws on an undefined key. */
export const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

export function findRoleDef(role: PlayerRole): RoleDef {
  return ROLE_POOL[role];
}

/** Builds a fresh, full-health unit of `role`. `ordinal` (1-based) is baked
 * into its display name ("Tank 2") at creation time and never recomputed —
 * a fallen "Tank 1" stays "Tank 1" even after a new tank is recruited, same
 * convention as the id below. `bonus` is the run's earned stat bonus for
 * this role (sim/progress.ts's RunProgress.bonus) — baked in once, here, so
 * a later bonus increase (see roster.ts's applyStatBonus) only has to touch
 * EXISTING units, not recompute every unit's stats from scratch. */
export function makeUnitState(role: PlayerRole, ordinal: number, instanceId: string, bonus: { maxHp: number; damage: number }): HeroState {
  const def = ROLE_POOL[role];
  const maxHp = def.maxHp + bonus.maxHp;
  return {
    id: instanceId,
    name: `${def.label} ${ordinal}`,
    role: def.role,
    maxHp,
    hp: maxHp,
    alive: true,
    damage: def.damage + bonus.damage,
    attackIntervalSec: def.attackIntervalSec,
    nextAttackT: def.attackIntervalSec,
    healPerBeat: def.healPerBeat,
    fatigue: 0,
    backfires: 0,
    // Stamped fresh from RunProgress at squad-build time (roster.ts's
    // stampProgressOntoSquad) — the value baked in here is only a sane
    // default for a unit that's never actually fielded before that stamp
    // runs (e.g. a freshly-recruited unit shown on the round screen).
    chainEffects: [def.baseChain],
    chainLevel: 1,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
    charge: 0,
  };
}

/** Builds the starting roster — one Tank, one Damage, one Healer first, then
 * the same three again for each extra round of `perRole` (a run starts with 2 of
 * each, cfg.startingPerRole; a bare call keeps the plain trio). The trio keeps
 * the ids `u0_tank`, `u1_damage`, `u2_support`, and ids stay unique because
 * every id starts with the unit's place in the list. */
export function makeStartingRoster(bonus: Record<PlayerRole, { maxHp: number; damage: number }>, perRole = 1): SideState {
  const heroes: HeroState[] = [];
  for (let n = 1; n <= perRole; n++) {
    for (const role of PLAYER_ROLES) heroes.push(makeUnitState(role, n, `u${heroes.length}_${role}`, bonus[role]));
  }
  return { heroes, dpsBonus: 0 };
}

/** Builds an arbitrary squad from a list of roles (duplicates allowed),
 * sorted tank-first — for the lab, the batch CLI, and checks/*, which all
 * want a one-off squad outside a real run's roster/progress. Every unit
 * gets a fresh, unbonused stat block (no RunProgress involved). */
export function makeSquadFromRoles(roles: PlayerRole[]): SideState {
  const zero = { maxHp: 0, damage: 0 };
  const heroes = roles
    .map((role, i) => makeUnitState(role, i + 1, `u${i}_${role}`, zero))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus: 0 };
}

/**
 * Units have names of their own (DECISIONS.md 2026-10-16): a short name drawn
 * from this pool, seeded from the run seed and the unit's place in the roster,
 * so a seed replays the same names. The draw is a pure hash — it never touches
 * the fight RNG or any other stream, so no batch number moves. Lab, batch and
 * check squads (makeSquadFromRoles) keep the role labels.
 */
export const UNIT_NAMES: readonly string[] = [
  "Bram", "Ivy", "Sol", "Rex", "Moss", "Kit", "Wren", "Olo", "Mira", "Dax", "Pip", "Juno",
  "Finn", "Tamsin", "Orin", "Lark", "Brix", "Nell", "Cato", "Vesper", "Hale", "Odette", "Rook", "Sable",
];

/** A role-label name as makeUnitState builds it ("Tank 2"), i.e. not yet given a name of its own. The army titles
 * (sim/armies.ts, "Wolf 2") are spelled out here too: armies.ts imports this file, so this one cannot import them. */
const ROLE_LABEL_NAME = /^(Tank|Damage|Healer|Bone Knight|Wraith|Bone Priest|Bear|Wolf|Stag) \d+$/;

function nameHash(seed: number, index: number): number {
  let h = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Gives every unit still named from its role label a name from UNIT_NAMES. Units that
 * already have one keep it, and a name is never used twice in one roster. Returns the
 * same array when there is nothing to rename. */
export function nameUnits(heroes: HeroState[], seed: number): HeroState[] {
  if (!heroes.some((h) => ROLE_LABEL_NAME.test(h.name))) return heroes;
  const taken = new Set(heroes.filter((h) => !ROLE_LABEL_NAME.test(h.name)).map((h) => h.name));
  return heroes.map((h, i) => {
    if (!ROLE_LABEL_NAME.test(h.name)) return h;
    const start = nameHash(seed, i) % UNIT_NAMES.length;
    for (let k = 0; k < UNIT_NAMES.length; k++) {
      const name = UNIT_NAMES[(start + k) % UNIT_NAMES.length]!;
      if (!taken.has(name)) {
        taken.add(name);
        return { ...h, name };
      }
    }
    return h;
  });
}
