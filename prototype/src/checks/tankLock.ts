/**
 * Normal enemy hits lock on the first living tank until it dies (2026-10-17,
 * playtest: "I had a tank but the backline still got hit"). Only an enemy with
 * `reachesBackline` (Ambush Raiders, Vanguard Outriders, Executioner Guards)
 * may slip past it with a normal hit, and slams keep their own targeting.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { ENCOUNTERS } from "../sim/encounters.js";
import { makeSquadFromRoles } from "../sim/roles.js";
import { makeEnemySide } from "../sim/run.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const cfg = DEFAULT_RUN_CONFIG;
const indexOf = (name: string): number => ENCOUNTERS.findIndex((e) => e.name === name);

/** Runs one fight against `encounter` with a tank too big to die; returns the normal hits and slams by who they landed on. */
function runVs(encounter: string, seed: number) {
  const player = makeSquadFromRoles(["tank", "damage", "support"]);
  const tank = player.heroes.find((h) => h.role === "tank")!;
  tank.maxHp = 100_000;
  tank.hp = 100_000;
  const enemy = makeEnemySide(cfg, 0, indexOf(encounter));
  const result = runFight({ player, enemy }, cfg.fight, new Rng(seed), seed);
  const playerIds = new Set(player.heroes.map((h) => h.id));
  const normal = result.events.filter((e) => e.type === "attack" && e.side === "enemy" && playerIds.has(e.targetId));
  const slams = result.events.filter((e) => e.type === "windupHit" && playerIds.has(e.targetId));
  return {
    tankId: tank.id,
    normalOffTank: normal.filter((e) => e.type === "attack" && e.targetId !== tank.id).length,
    normalTotal: normal.length,
    slamOffTank: slams.filter((e) => e.type === "windupHit" && e.targetId !== tank.id).length,
    slamTotal: slams.length,
  };
}

for (const name of ["Pack", "The Wall", "Twins", "Duelist"]) {
  let offTank = 0;
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = runVs(name, seed);
    offTank += r.normalOffTank;
    total += r.normalTotal;
  }
  check(`${name}: every normal hit lands on the tank while it lives`, total > 0 && offTank === 0, `${offTank} of ${total} off the tank`);
}

for (const name of ["Ambush", "Vanguard", "Executioner"]) {
  let offTank = 0;
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = runVs(name, seed);
    offTank += r.normalOffTank;
    total += r.normalTotal;
  }
  check(`${name}: some normal hits slip past the tank`, offTank > 0, `${offTank} of ${total} off the tank`);
}

// Slams are untouched: against the Executioner (aims at the weakest unit) they must still land off the tank.
{
  let slamOff = 0;
  for (let seed = 1; seed <= 20; seed++) slamOff += runVs("Executioner", seed).slamOffTank;
  check("Executioner: slams still land on units behind the tank", slamOff > 0, `${slamOff} off the tank`);
}

if (failed) {
  console.log("\ntank-lock check FAILED");
  process.exit(1);
}
console.log("\ntank-lock check passed");
