import { canAttack, effectiveRange, findNearestEnemy, incomingDamageMultiplier } from "./combat";
import type { SimEvent, SimResult, TickSnapshot, UnitSnapshot } from "./events";
import { hexKey, type Hex } from "./hex";
import type { GameMap } from "./map";
import { findPath } from "./pathing";
import type { Team, UnitDef, UnitState } from "./types";
import { unitStateFromDef } from "./types";

export const TICK_RATE = 20; // ticks per second
const DT = 1 / TICK_RATE;
const MAX_TICKS = TICK_RATE * 60; // 60s stalemate cap -> declare a draw

/**
 * A unit is either at rest (`destHex === null`, free to re-target/attack/start a new
 * step) or committed to a single hex-step (`destHex` set). Committed steps always run
 * to completion once started — interruptions (target died, back in range) are only
 * applied at rest. This is what keeps the rendered position continuous: a step is
 * never abandoned partway, so the render never has to snap a unit back to its
 * pre-step hex.
 */
interface MovingUnit extends UnitState {
  destHex: Hex | null;
  moveT: number;
}

function toMovingUnit(u: UnitState): MovingUnit {
  return { ...u, destHex: null, moveT: 0 };
}

function teamAlive(units: readonly UnitState[], team: Team): boolean {
  return units.some((u) => u.alive && u.team === team);
}

/**
 * Runs a full fight to completion, deterministically, given the same map/units/seed.
 * Pure function over its inputs: no wall-clock time, no external randomness.
 *
 * `seed` is not yet consumed by any combat logic (variance injectors are deferred,
 * OQ-8) but is threaded into the result so callers and future RNG-driven behavior
 * share one seed of record.
 */
export function runSim(map: GameMap, unitDefs: readonly UnitDef[], seed: number): SimResult {
  const units: MovingUnit[] = unitDefs
    .map(unitStateFromDef)
    .map(toMovingUnit)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const snapshots: TickSnapshot[] = [];
  const events: SimEvent[] = [];

  let winner: Team | "draw" = "draw";
  let tick = 0;

  for (; tick <= MAX_TICKS; tick++) {
    const playerAlive = teamAlive(units, "player");
    const enemyAlive = teamAlive(units, "enemy");
    if (!playerAlive || !enemyAlive) {
      winner = playerAlive ? "player" : enemyAlive ? "enemy" : "draw";
      break;
    }

    // Occupancy includes both units' current hexes and the destinations units mid-step
    // have already committed to, so two units can never be routed onto the same hex.
    const occupied = new Set<string>();
    for (const u of units) {
      if (!u.alive) continue;
      occupied.add(hexKey(u.hex));
      if (u.destHex !== null) occupied.add(hexKey(u.destHex));
    }

    const frameSnapshots: UnitSnapshot[] = [];

    for (const unit of units) {
      if (!unit.alive) continue;

      unit.attackCooldown = Math.max(0, unit.attackCooldown - DT);

      let fromHex = unit.hex;
      let toHex = unit.hex;
      let moveT = 0;

      if (unit.destHex !== null) {
        // Mid-step: finish arriving before re-deciding anything. This is what
        // prevents the render from ever snapping a unit back to its pre-step hex.
        fromHex = unit.hex;
        toHex = unit.destHex;
        unit.moveT += unit.moveSpeed * DT;
        if (unit.moveT >= 1) {
          occupied.delete(hexKey(unit.hex));
          unit.hex = unit.destHex;
          unit.destHex = null;
          unit.moveT = 0;
          occupied.add(hexKey(unit.hex));
          fromHex = unit.hex;
          toHex = unit.hex;
        } else {
          moveT = unit.moveT;
        }
      } else {
        let target = unit.targetId !== null ? units.find((u) => u.id === unit.targetId) ?? null : null;
        if (target === null || !target.alive) {
          target = findNearestEnemy(unit, units);
          unit.targetId = target?.id ?? null;
        }

        if (target !== null) {
          if (canAttack(unit, target, map)) {
            if (unit.attackCooldown <= 0) {
              // Elevation-adjusted (DECISIONS 2026-07-15): a unit standing on highground
              // takes more damage, not just deals more — the reported `damage` is the
              // dealt amount so the on-body tracer shows the real (bigger) hit, not the
              // attacker's base stat, keeping the exposure legible.
              const damage = Math.round(unit.damage * incomingDamageMultiplier(target, map));
              target.hp = Math.max(0, target.hp - damage);
              unit.attackCooldown = 1 / unit.attackSpeed;
              events.push({
                type: "attack",
                tick,
                attackerId: unit.id,
                targetId: target.id,
                damage,
                targetHpAfter: target.hp,
              });
              if (target.hp <= 0 && target.alive) {
                target.alive = false;
                occupied.delete(hexKey(target.hex));
                events.push({ type: "death", tick, unitId: target.id, killedBy: unit.id });
              }
            }
          } else {
            const unitOccupied = new Set(occupied);
            unitOccupied.delete(hexKey(unit.hex));
            const path = findPath(map, unit.hex, target.hex, unitOccupied);

            if (path !== null && path.length > 1) {
              const nextHex = path[1];
              const nextKey = hexKey(nextHex);
              if (!occupied.has(nextKey)) {
                unit.destHex = nextHex;
                occupied.add(nextKey);
                fromHex = unit.hex;
                toHex = unit.destHex;
                unit.moveT += unit.moveSpeed * DT;
                if (unit.moveT >= 1) {
                  occupied.delete(hexKey(unit.hex));
                  unit.hex = unit.destHex;
                  unit.destHex = null;
                  unit.moveT = 0;
                  occupied.add(hexKey(unit.hex));
                  fromHex = unit.hex;
                  toHex = unit.hex;
                } else {
                  moveT = unit.moveT;
                }
              }
            }
          }
        }
      }

      frameSnapshots.push({
        id: unit.id,
        team: unit.team,
        role: unit.role,
        hp: unit.hp,
        maxHp: unit.maxHp,
        alive: unit.alive,
        fromHex,
        toHex,
        moveT,
        targetId: unit.targetId,
        // Elevation-adjusted, not the base stat — this is what the range-ring telegraph
        // draws, and a hidden bonus would make the highground threat unreadable.
        range: effectiveRange(unit, map),
      });
    }

    snapshots.push({ tick, timeSeconds: tick * DT, units: frameSnapshots });
  }

  events.push({ type: "end", tick, winner });

  return { seed, mapId: map.id, winner, ticks: tick, snapshots, events };
}
