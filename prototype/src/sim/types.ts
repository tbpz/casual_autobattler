import type { Hex } from "./hex";

export type TileType = "open" | "wall" | "highground" | "cover";

export interface Tile {
  readonly hex: Hex;
  readonly type: TileType;
}

/** Impassable to movement and blocks line-of-sight. */
export function isBlocking(type: TileType): boolean {
  return type === "wall";
}

/** Blocks line-of-sight but not movement (e.g. tall grass, rubble). */
export function isVisionBlocking(type: TileType): boolean {
  return type === "wall" || type === "cover";
}

export interface MapDef {
  readonly id: string;
  readonly name: string;
  readonly tiles: readonly Tile[];
}

export type Team = "player" | "enemy";

export type Role = "melee_tank" | "ranged_archer";

export interface UnitDef {
  readonly id: string;
  readonly team: Team;
  readonly role: Role;
  readonly startHex: Hex;
  readonly maxHp: number;
  readonly damage: number;
  /** Attack range in hex steps. 1 = melee. */
  readonly range: number;
  /** Hexes moved per second. */
  readonly moveSpeed: number;
  /** Attacks per second. */
  readonly attackSpeed: number;
}

export interface UnitState {
  readonly id: string;
  readonly team: Team;
  readonly role: Role;
  hex: Hex;
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly attackSpeed: number;
  /** Cooldown remaining before this unit can attack again, in seconds. */
  attackCooldown: number;
  targetId: string | null;
  alive: boolean;
}

export function unitStateFromDef(def: UnitDef): UnitState {
  return {
    id: def.id,
    team: def.team,
    role: def.role,
    hex: def.startHex,
    hp: def.maxHp,
    maxHp: def.maxHp,
    damage: def.damage,
    range: def.range,
    moveSpeed: def.moveSpeed,
    attackSpeed: def.attackSpeed,
    attackCooldown: 0,
    targetId: null,
    alive: true,
  };
}
