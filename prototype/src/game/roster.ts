import { toHeroInstance, type HeroDef, type HeroInstance } from "./hero";

const TANK_TEMPLATE = {
  role: "melee_tank" as const,
  baseMaxHp: 120,
  baseDamage: 12,
  range: 1,
  moveSpeed: 2,
  attackSpeed: 1,
};

const ARCHER_TEMPLATE = {
  role: "ranged_archer" as const,
  baseMaxHp: 60,
  baseDamage: 8,
  range: 3,
  moveSpeed: 2,
  attackSpeed: 1.2,
};

/** Every hero that can ever appear on a bench, starter or recruitable. OQ-14 provisional: ~6-8 total. */
export const HERO_POOL: readonly HeroDef[] = [
  { id: "garrick", name: "Garrick", ...TANK_TEMPLATE },
  { id: "osric", name: "Osric", ...TANK_TEMPLATE },
  { id: "lyra", name: "Lyra", ...ARCHER_TEMPLATE },
  { id: "sable", name: "Sable", ...ARCHER_TEMPLATE },
  { id: "wren", name: "Wren", ...ARCHER_TEMPLATE },
  { id: "dorn", name: "Dorn", ...TANK_TEMPLATE },
  { id: "isolde", name: "Isolde", ...ARCHER_TEMPLATE },
];

/** The fixed default starter squad every run begins with (STATE.md: "fixed default starter squad"). */
const STARTER_IDS: readonly string[] = ["garrick", "osric", "lyra", "sable", "wren"];

export function createDefaultBench(): HeroInstance[] {
  return HERO_POOL.filter((h) => STARTER_IDS.includes(h.id)).map(toHeroInstance);
}

/** Heroes not currently on the bench — the recruit pool for draft offers. */
export function recruitablePool(bench: readonly HeroInstance[]): HeroDef[] {
  const benchIds = new Set(bench.map((h) => h.id));
  return HERO_POOL.filter((h) => !benchIds.has(h.id));
}

export function findHeroDef(id: string): HeroDef | undefined {
  return HERO_POOL.find((h) => h.id === id);
}
