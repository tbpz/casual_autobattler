import { runSim } from "../sim/engine";
import { loadMap } from "../sim/map";
import type { Hex } from "../sim/hex";
import type { SimResult } from "../sim/events";
import type { UnitDef } from "../sim/types";
import testMap1 from "../maps/test-map-1.json";
import { TEST_ROSTER_1 } from "../maps/test-roster-1";

function interpAxial(a: Hex, b: Hex, t: number): { q: number; r: number } {
  return { q: a.q + (b.q - a.q) * t, r: a.r + (b.r - a.r) * t };
}

/** Hex-distance formula generalized to fractional axial coordinates. */
function axialDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Asserts every unit's rendered (interpolated) position moves continuously tick-to-tick:
 * never more than one hex-step's worth of distance per tick, except across the unit's own
 * death tick. This is a regression guard for the commit-and-reserve movement rewrite in
 * sim/engine.ts — the render used to snap a mid-step unit back to its pre-step hex
 * whenever the step was interrupted (entering attack range, destination hex contested,
 * retargeting). If this check ever fails again, that class of bug is back.
 */
export function checkContinuity(result: SimResult, unitDefs: readonly UnitDef[]): string[] {
  const moveSpeedById = new Map(unitDefs.map((u) => [u.id, u.moveSpeed] as const));
  const tickSeconds =
    result.snapshots.length > 1 ? result.snapshots[1].timeSeconds - result.snapshots[0].timeSeconds : 0;
  const EPSILON = 0.05; // float slack, well under one hex step

  const deathTick = new Map<string, number>();
  for (const e of result.events) {
    if (e.type === "death") deathTick.set(e.unitId, e.tick);
  }

  const failures: string[] = [];
  const lastPos = new Map<string, { q: number; r: number }>();

  for (const snapshot of result.snapshots) {
    for (const u of snapshot.units) {
      const pos = interpAxial(u.fromHex, u.toHex, u.moveT);
      const prev = lastPos.get(u.id);
      if (prev !== undefined) {
        const dist = axialDistance(prev, pos);
        const maxStep = (moveSpeedById.get(u.id) ?? 0) * tickSeconds + EPSILON;
        const diedThisTick = deathTick.get(u.id) === snapshot.tick;
        if (dist > maxStep && !diedThisTick) {
          failures.push(
            `tick ${snapshot.tick}: ${u.id} jumped ${dist.toFixed(2)} hexes in one tick (max expected ${maxStep.toFixed(2)})`,
          );
        }
      }
      lastPos.set(u.id, pos);
    }
  }
  return failures;
}

function main(): void {
  const map = loadMap(testMap1);
  const result = runSim(map, TEST_ROSTER_1, 42);
  const failures = checkContinuity(result, TEST_ROSTER_1);

  if (failures.length > 0) {
    console.error(`CONTINUITY CHECK FAILED (${failures.length} violation(s)):`);
    for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`continuity check: PASS — ${result.snapshots.length} ticks, no position jumps`);
  }
}

main();
