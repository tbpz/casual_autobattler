/**
 * Fight-sim state types. A "side" is a list of heroes — no hardcoded slots,
 * so squad size N stays a parameter (FIGHT_SCRIPT.md "parameterized" section).
 * Heroes are ordered front-to-back; a normal attack targets the front-most
 * living hero on the opposing side (see fight.ts's targeting helpers).
 */

export type Role = "tank" | "damage" | "support" | "bruiser" | "grunt";

export interface HeroState {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  hp: number;
  /** Set the instant hp hits 0 mid-fight. Whether this becomes a permanent
   * run-level death is decided by RunConfig.deathPolicy, not here. */
  alive: boolean;
  /** Damage dealt by this hero's normal attack. Support heroes still carry a
   * (small) damage value but act as a healer on their beat instead — see
   * fight.ts's performHeroAction. */
  damage: number;
  /** Seconds between this hero's attack/heal beats. */
  attackIntervalSec: number;
  /** Sim-clock time (seconds) of this hero's next beat. */
  nextAttackT: number;
  /** If set, this hero heals its lowest-HP living ally on its beat instead
   * of attacking — the mechanism for a rising meter the player can attribute
   * to a specific body. */
  healPerBeat?: number;

  /** Per-fight job counters (2026-08-06 legibility pass) — zeroed at fight
   * start by cloneHeroes, never carried between fights. These are the
   * readout the player's squad plan is judged against: did the tank soak,
   * did the dealer deal, did the healer restore. See fightView.ts. */
  dealt: number;
  soaked: number;
  restored: number;
  hitsTaken: number;
  /** True while a tank is still holding aggro (above tankBreakFraction of
   * its own maxHp). Always false for non-tank roles. Drives both the
   * enemy's targeting weight (fight.ts) and the "broken" visual tell. */
  holding: boolean;
}

export interface SideState {
  heroes: HeroState[];
  /** Flat bonus added to every living hero's attack damage, accumulated from
   * run-level upgrades (coin sink B). Applied only to the player side; 0 for
   * enemies. */
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

/** A fight's starting setup. Both sides carry whatever HP/deaths attrition left them with. */
export interface FightSetup {
  player: SideState;
  enemy: SideState;
  /** Fights since the player side last ignited, going into this fight (PRD counter). */
  fightsSinceIgnition: number;
}
