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
}

export const PLAYER_HERO_POOL: HeroDef[] = [
  { id: "bracer", name: "Bracer", role: "tank", maxHp: 180, damage: 3, attackIntervalSec: 1 },
  { id: "hollow", name: "Hollow", role: "tank", maxHp: 150, damage: 4, attackIntervalSec: 1 },
  { id: "spark", name: "Spark", role: "damage", maxHp: 70, damage: 7, attackIntervalSec: 1 },
  { id: "vex", name: "Vex", role: "damage", maxHp: 60, damage: 9, attackIntervalSec: 1 },
  { id: "ward", name: "Ward", role: "support", maxHp: 90, damage: 2, attackIntervalSec: 1, healPerBeat: 6 },
  { id: "cairn", name: "Cairn", role: "support", maxHp: 100, damage: 2, attackIntervalSec: 1, healPerBeat: 6 },
];

/** The working accept-default squad — one tank, one damage, one support. */
export const DEFAULT_PLAYER_ROSTER_IDS = ["bracer", "spark", "ward"];

const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

export function findHeroDef(id: string): HeroDef {
  const def = PLAYER_HERO_POOL.find((h) => h.id === id);
  if (!def) throw new Error(`unknown hero id: ${id}`);
  return def;
}

export function makeHeroState(def: HeroDef, instanceId: string): HeroState {
  return {
    id: instanceId,
    name: def.name,
    role: def.role,
    maxHp: def.maxHp,
    hp: def.maxHp,
    alive: true,
    damage: def.damage,
    attackIntervalSec: def.attackIntervalSec,
    nextAttackT: def.attackIntervalSec,
    healPerBeat: def.healPerBeat,
  };
}

/** Builds the player SideState from chosen hero ids, sorted tank-first so the
 * tank draws the front-row visual slot (targeting itself is weighted-random —
 * see fight.ts — not positional, but the front row is still where a tank
 * "belongs" on screen). */
export function makePlayerSide(heroIds: string[] = DEFAULT_PLAYER_ROSTER_IDS, dpsBonus = 0): SideState {
  const heroes = heroIds
    .map((id, i) => makeHeroState(findHeroDef(id), `p${i}_${id}`))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus };
}
