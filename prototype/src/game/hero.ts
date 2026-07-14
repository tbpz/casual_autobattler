import type { Hex } from "../sim/hex";
import type { Role, Team, UnitDef } from "../sim/types";

/** A hero as it exists in the pool — fixed identity and base stats. */
export interface HeroDef {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly baseMaxHp: number;
  readonly baseDamage: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly attackSpeed: number;
}

/**
 * A hero as it exists on a bench, with whatever it earned this run via the draft.
 * Persists per-individual-hero across rounds within a run; resets to a fresh
 * HeroDef-derived instance on a new run.
 */
export interface HeroInstance extends HeroDef {
  readonly hpBonusPct: number;
  readonly dmgBonusPct: number;
}

export function toHeroInstance(def: HeroDef): HeroInstance {
  return { ...def, hpBonusPct: 0, dmgBonusPct: 0 };
}

export function effectiveMaxHp(hero: HeroInstance): number {
  return Math.round(hero.baseMaxHp * (1 + hero.hpBonusPct));
}

export function effectiveDamage(hero: HeroInstance): number {
  return Math.round(hero.baseDamage * (1 + hero.dmgBonusPct));
}

export function effectiveUnitDef(hero: HeroInstance, team: Team, startHex: Hex): UnitDef {
  return {
    id: hero.id,
    team,
    role: hero.role,
    startHex,
    maxHp: effectiveMaxHp(hero),
    damage: effectiveDamage(hero),
    range: hero.range,
    moveSpeed: hero.moveSpeed,
    attackSpeed: hero.attackSpeed,
  };
}
