import { hexDistance } from "./hex";
import type { GameMap } from "./map";
import type { UnitState } from "./types";

/** Nearest living enemy by hex distance; ties broken by unit id for determinism. */
export function findNearestEnemy<T extends UnitState>(unit: T, units: readonly T[]): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const other of units) {
    if (!other.alive || other.team === unit.team) continue;
    const d = hexDistance(unit.hex, other.hex);
    if (d < bestDist || (d === bestDist && best !== null && other.id < best.id)) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Elevation carries the "high-ground archers" threat primitive (DECISIONS 2026-07-14):
 * a ranged unit standing on a `highground` tile threatens further than its base range.
 * Melee gets nothing from it — the bonus only matters to units that already fight at range,
 * which is what makes elevation a lever the player can also seize, not just a stat the
 * enemy owns.
 */
const HIGHGROUND_RANGE_BONUS = 1;

/**
 * Elevation is a bet, not a free upside (DECISIONS 2026-07-15): the same tile that grants
 * reach also makes its occupant a more exposed target. Applied to whoever is STANDING on
 * highground when hit, regardless of role or who's attacking — this is what keeps the tile
 * self-balancing on every map without per-encounter authoring. Value is a tuning dial.
 */
const HIGHGROUND_EXPOSURE = 0.25;

export function effectiveRange(unit: UnitState, map: GameMap): number {
  if (unit.range <= 1) return unit.range;
  const tile = map.tileAt(unit.hex);
  const onHighground = tile !== undefined && tile.type === "highground";
  return unit.range + (onHighground ? HIGHGROUND_RANGE_BONUS : 0);
}

/** Damage multiplier for a unit standing on highground when it takes a hit. */
export function incomingDamageMultiplier(target: UnitState, map: GameMap): number {
  const tile = map.tileAt(target.hex);
  const onHighground = tile !== undefined && tile.type === "highground";
  return onHighground ? 1 + HIGHGROUND_EXPOSURE : 1;
}

/** In range (elevation-adjusted) and, for ranged units, unobstructed. Melee (range 1) does not require LOS through walls, since adjacency implies it. */
export function canAttack(attacker: UnitState, target: UnitState, map: GameMap): boolean {
  const d = hexDistance(attacker.hex, target.hex);
  if (d > effectiveRange(attacker, map)) return false;
  if (attacker.range === 1) return true;
  return map.hasLineOfSight(attacker.hex, target.hex);
}
