/**
 * Fight-sim state types. A "side" is a list of heroes — no hardcoded slots,
 * so squad size N stays a parameter (FIGHT_SCRIPT.md "parameterized" section).
 * Heroes are ordered front-to-back; damage absorbs front-most-living-first
 * (see config.ts's note on reading #1).
 */

export interface HeroState {
  id: string;
  maxHp: number;
  hp: number;
  /** Set the instant hp hits 0 mid-fight. Whether this becomes a permanent
   * run-level death is decided by RunConfig.deathPolicy, not here. */
  alive: boolean;
}

export interface SideState {
  heroes: HeroState[];
  /** Per-hero flat DPS bonus accumulated from run-level upgrades (coin sink B).
   * Applied only to the player side; 0 for enemies. */
  dpsBonus: number;
}

export function sideMaxHp(side: SideState): number {
  return side.heroes.reduce((sum, h) => sum + h.maxHp, 0);
}

export function sideHp(side: SideState): number {
  return side.heroes.reduce((sum, h) => sum + h.hp, 0);
}

export function sideLivingCount(side: SideState): number {
  return side.heroes.filter((h) => h.alive).length;
}

export function makeSide(n: number, heroMaxHp: number, idPrefix: string, dpsBonus = 0): SideState {
  const heroes: HeroState[] = [];
  for (let i = 0; i < n; i++) {
    heroes.push({ id: `${idPrefix}${i}`, maxHp: heroMaxHp, hp: heroMaxHp, alive: true });
  }
  return { heroes, dpsBonus };
}

/** A fight's starting setup. Both sides carry whatever HP/deaths attrition left them with. */
export interface FightSetup {
  player: SideState;
  enemy: SideState;
  /** Fights since the player side last ignited, going into this fight (PRD counter). */
  fightsSinceIgnition: number;
}
