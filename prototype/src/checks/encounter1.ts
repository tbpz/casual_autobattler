import { runSim } from "../sim/engine";
import { loadMap } from "../sim/map";
import type { UnitDef } from "../sim/types";
import { ROUNDS } from "../game/rounds";
import { toHeroInstance, effectiveUnitDef, type HeroInstance } from "../game/hero";
import { HERO_POOL } from "../game/roster";
import { summarizeAttribution } from "../game/attribution";

/**
 * The 4-point authoring test (DECISIONS 2026-07-14) for Round 1 — "The Overlook", Phase 3's
 * first authored encounter. Runs the real sim against the real round definition, the same
 * way the game itself would, so this is a check on the shipped encounter, not a model of it.
 *
 * Round 1's whole roster is exactly 5 starter heroes (2 tanks, 3 archers) into 5 fixed
 * slots (2 in the flank lane, 3 in the center lane — see game/rounds.ts). Because every
 * slot must be filled, the only real lever is *which* hero goes in which lane, which
 * collapses to 3 structurally distinct role splits:
 *   - both tanks flank, all 3 archers center      (the naive "obvious" split — tanks up front)
 *   - both archers-pair flank, tanks+1 archer center
 *   - one tank + one archer flank, one tank + two archers center
 */

const LESSON =
  "A tank blocking a chokepoint is backed by archers on high ground behind it — the archers " +
  "threaten the whole approach. Send your fragile ranged units through the flank gap (which " +
  "stays outside the archers' sightline until it closes in); don't march them down the center " +
  "lane where the archers can see them the whole way.";

const round = ROUNDS[0];
const map = loadMap(round.mapRaw);

function hero(id: string): HeroInstance {
  return toHeroInstance(HERO_POOL.find((h) => h.id === id)!);
}

const garrick = hero("garrick");
const osric = hero("osric");
const lyra = hero("lyra");
const sable = hero("sable");
const wren = hero("wren");

type Assignment = Readonly<Record<string, HeroInstance>>;

function buildUnits(assignment: Assignment): UnitDef[] {
  const player = round.playerSlots.map((slot) => effectiveUnitDef(assignment[slot.id], "player", slot.hex));
  return [...player, ...round.enemyRoster];
}

function fight(assignment: Assignment) {
  const units = buildUnits(assignment);
  const result = runSim(map, units, round.seed);
  return { result, units, summary: summarizeAttribution(result, units) };
}

// (2) The naive deathball: tanks instinctively sent up front (the flank lane), leaving all
// 3 fragile archers to march down the exposed center lane in full view of the enemy's
// highground archers for most of the approach.
const deathball = fight({
  "front-top": garrick,
  "back-top": osric,
  "front-mid": lyra,
  "front-bottom": sable,
  "back-bottom": wren,
});

// (3) Two distinct winning setups — different levers, not flavors of one:
//   Setup A commits BOTH archer-pair units to the flank, betting on avoiding exposure
//   entirely and letting the two tanks (120hp each) eat the chokepoint fire.
//   Setup B commits only ONE tank to the flank (escorting a lone archer around), keeping
//   a tank at the chokepoint while still sending most of the ranged squad through center —
//   a hedge rather than a full commitment to the flank.
const setupA_bothArchersFlank = fight({
  "front-top": lyra,
  "back-top": sable,
  "front-mid": garrick,
  "front-bottom": osric,
  "back-bottom": wren,
});

const setupB_oneTankEscort = fight({
  "front-top": garrick,
  "back-top": lyra,
  "front-mid": osric,
  "front-bottom": sable,
  "back-bottom": wren,
});

const failures: string[] = [];

function check(condition: boolean, description: string): void {
  console.log(`${condition ? "PASS" : "FAIL"} — ${description}`);
  if (!condition) failures.push(description);
}

console.log(`Round: ${round.name}`);
console.log(`(1) Lesson: ${LESSON}\n`);

check(deathball.result.winner === "enemy", "(2) the naive deathball loses");
console.log(`    ${deathball.summary.headline}`);

const dominant = deathball.summary.playerDeathsByKillerRole[0];
check(
  dominant !== undefined && dominant.role === "ranged_archer" && dominant.share >= 0.5,
  "(4) the deathball's loss has one dominant, readable cause (enemy archers responsible for >=50% of losses)",
);

check(setupA_bothArchersFlank.result.winner === "player", "(3a) setup A (both archers flank) wins");
console.log(`    ${setupA_bothArchersFlank.summary.headline}`);

check(setupB_oneTankEscort.result.winner === "player", "(3b) setup B (one tank escorts a flanker) wins");
console.log(`    ${setupB_oneTankEscort.summary.headline}`);

check(
  setupA_bothArchersFlank.summary.playerDeaths.length !== setupB_oneTankEscort.summary.playerDeaths.length,
  "(3c) setup A and setup B are genuinely different outcomes, not the same win replayed (different losses taken)",
);

if (failures.length > 0) {
  console.error(`\nENCOUNTER #1 AUTHORING TEST FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log("\nENCOUNTER #1 AUTHORING TEST: PASS — all 4 points hold.");
}
