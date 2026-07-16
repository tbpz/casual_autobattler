import { runSim } from "../sim/engine";
import { loadMap, offsetToAxial, type RawMapDef } from "../sim/map";
import type { SimEvent } from "../sim/events";
import type { UnitDef } from "../sim/types";

/**
 * Regression + design check for elevation risk/reward (DECISIONS 2026-07-15): standing on
 * highground must grant +range but also take +damage — never pure upside. Two archers face
 * off at exact range (no movement, so combat starts tick 0 and stays isolated from pathing).
 * The only variable between the two runs is whether the defender's tile is highground.
 */

const ATTACKER_HEX = offsetToAxial(0, 0);
const DEFENDER_HEX = offsetToAxial(3, 0); // hex distance 3 == archer's base range, so neither unit ever needs to move

function mapRaw(defenderOnHighground: boolean): RawMapDef {
  return {
    id: defenderOnHighground ? "elevation-test-highground" : "elevation-test-open",
    name: "Elevation test",
    width: 5,
    height: 1,
    overrides: defenderOnHighground ? [{ col: 3, row: 0, type: "highground" }] : [],
  };
}

function units(): UnitDef[] {
  return [
    {
      id: "atk",
      team: "enemy",
      role: "ranged_archer",
      startHex: ATTACKER_HEX,
      maxHp: 999, // never dies mid-test — keeps the run isolated to the defender's exposure
      damage: 8,
      range: 3,
      moveSpeed: 2,
      attackSpeed: 1.2,
    },
    {
      id: "def",
      team: "player",
      role: "ranged_archer",
      startHex: DEFENDER_HEX,
      maxHp: 60,
      damage: 8,
      range: 3,
      moveSpeed: 2,
      attackSpeed: 1.2,
    },
  ];
}

function hitsAgainst(events: readonly SimEvent[], targetId: string): number[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: "attack" }> => e.type === "attack" && e.targetId === targetId)
    .map((e) => e.damage);
}

function deathTick(events: readonly SimEvent[], unitId: string): number | null {
  const e = events.find((ev): ev is Extract<SimEvent, { type: "death" }> => ev.type === "death" && ev.unitId === unitId);
  return e?.tick ?? null;
}

const openMap = loadMap(mapRaw(false));
const highgroundMap = loadMap(mapRaw(true));

const openResult = runSim(openMap, units(), 7);
const highgroundResult = runSim(highgroundMap, units(), 7);
const highgroundResultRerun = runSim(highgroundMap, units(), 7);

const failures: string[] = [];

function check(condition: boolean, description: string): void {
  console.log(`${condition ? "PASS" : "FAIL"} — ${description}`);
  if (!condition) failures.push(description);
}

const openHits = hitsAgainst(openResult.events, "def");
const highgroundHits = hitsAgainst(highgroundResult.events, "def");

check(openHits.length > 0 && openHits.every((d) => d === 8), "open ground: defender takes base damage (8) per hit, no exposure bonus");
check(
  highgroundHits.length > 0 && highgroundHits.every((d) => d === 10),
  "highground: defender takes +25% damage per hit (10, not 8) — the exposure side of the elevation bet",
);

const openDeath = deathTick(openResult.events, "def");
const highgroundDeath = deathTick(highgroundResult.events, "def");
check(
  openDeath !== null && highgroundDeath !== null && highgroundDeath < openDeath,
  `highground defender dies faster (tick ${highgroundDeath}) than open-ground defender (tick ${openDeath}) despite identical stats and distance — same reach, more risk`,
);

check(
  JSON.stringify(highgroundResult.events) === JSON.stringify(highgroundResultRerun.events),
  "same seed -> byte-identical event log (determinism preserved with the exposure multiplier in place)",
);

if (failures.length > 0) {
  console.error(`\nELEVATION CHECK FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log("\nELEVATION CHECK: PASS — highground is a reach-for-risk bet, not a free upside.");
}
