import { runSim } from "./sim/engine";
import { loadMap } from "./sim/map";
import type { SimResult } from "./sim/events";
import testMap1 from "./maps/test-map-1.json";
import { TEST_ROSTER_1 } from "./maps/test-roster-1";

function describeResult(result: SimResult): string {
  const lines: string[] = [];
  lines.push(`seed=${result.seed} map=${result.mapId} winner=${result.winner} ticks=${result.ticks}`);
  for (const event of result.events) {
    switch (event.type) {
      case "attack":
        lines.push(`  [t${event.tick}] ${event.attackerId} -> ${event.targetId} for ${event.damage} (hp left: ${event.targetHpAfter})`);
        break;
      case "death":
        lines.push(`  [t${event.tick}] ${event.unitId} died, killed by ${event.killedBy}`);
        break;
      case "end":
        lines.push(`  [t${event.tick}] FIGHT OVER — winner: ${event.winner}`);
        break;
    }
  }
  return lines.join("\n");
}

function serializeForComparison(result: SimResult): string {
  // Compare on events only: snapshots are large and events already fully determine outcome.
  return JSON.stringify(result.events);
}

function main(): void {
  const map = loadMap(testMap1);
  const seed = 42;

  const resultA = runSim(map, TEST_ROSTER_1, seed);
  console.log(describeResult(resultA));

  const resultB = runSim(map, TEST_ROSTER_1, seed);
  const identical = serializeForComparison(resultA) === serializeForComparison(resultB);
  console.log(`\ndeterminism check (same seed, re-run): ${identical ? "PASS — identical event log" : "FAIL — logs diverged"}`);

  if (!identical) {
    process.exitCode = 1;
  }
}

main();
