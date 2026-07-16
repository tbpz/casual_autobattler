import { loadMap } from "../sim/map";
import { findPath } from "../sim/pathing";
import { ROUNDS } from "../game/rounds";

/**
 * Legality check for each round's authored deploy zone (DECISIONS 2026-07-15): every zone
 * hex must actually be a legal, reachable start position — in-bounds, passable, not
 * highground (the default posture: elevation is contested during the fight, not started
 * on) — and the zone as a whole must not be walled off from the enemy side, or "free
 * placement within the zone" would let the player author an unwinnable or unreachable
 * setup by construction.
 */

const failures: string[] = [];

function check(condition: boolean, description: string): void {
  console.log(`${condition ? "PASS" : "FAIL"} — ${description}`);
  if (!condition) failures.push(description);
}

for (const round of ROUNDS) {
  console.log(`\n${round.name}:`);
  const map = loadMap(round.mapRaw);

  check(round.deployZone.length > 0, "deploy zone is non-empty");
  check(
    round.deployZone.length >= round.fieldSize,
    `deploy zone has room for all ${round.fieldSize} fielded heroes (has ${round.deployZone.length} legal hexes)`,
  );

  const allInBounds = round.deployZone.every((h) => map.isInBounds(h));
  check(allInBounds, "every deploy-zone hex is in-bounds");

  const allPassable = round.deployZone.every((h) => map.isPassable(h));
  check(allPassable, "every deploy-zone hex is passable (no walls)");

  const noHighground = round.deployZone.every((h) => map.tileAt(h)?.type !== "highground");
  check(noHighground, "no deploy-zone hex is highground (contested during the fight, not a free start)");

  const enemyHex = round.enemyRoster[0]?.startHex;
  const zoneHasPathToEnemy =
    enemyHex !== undefined && round.deployZone.some((h) => findPath(map, h, enemyHex) !== null);
  check(zoneHasPathToEnemy, "at least one deploy-zone hex has a path to the enemy (zone isn't walled off)");
}

if (failures.length > 0) {
  console.error(`\nDEPLOY ZONE CHECK FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log("\nDEPLOY ZONE CHECK: PASS — every round's zone is legal and reachable.");
}
