/**
 * Regression test that the sim IS the document: reproduces FIGHT_SCRIPT.md
 * §3's worked check (a full 3-hero squad, fight 1, no cascade) to within
 * tick-discretization tolerance.
 *
 *   t=8:  player ~62%, enemy ~76%
 *   gate opens ~14.0-15.0s
 *   t=16: player ~35%, enemy ~52%
 *   t=30: both ~10%
 *
 * Ignition is suppressed (chain/ignition chances zeroed) so the pure-combat
 * trajectory is isolated from the two dice layered on top of it.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSide } from "../sim/types.js";
import type { TickSnapshot } from "../sim/events.js";

let failed = false;

function approx(name: string, actual: number, expected: number, tolerance: number): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${actual.toFixed(3)}, expected ${expected} +/- ${tolerance}`);
  if (!ok) failed = true;
}

function between(name: string, actual: number, lo: number, hi: number): void {
  const ok = actual >= lo && actual <= hi;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${actual.toFixed(3)}, expected in [${lo}, ${hi}]`);
  if (!ok) failed = true;
}

const cfg = { ...DEFAULT_RUN_CONFIG.fight, ignitionChanceByFightsSince: [0], chainChanceByHitsSoFar: [0] };
const setup = {
  player: makeSide(DEFAULT_RUN_CONFIG.playerN, cfg.heroMaxHp, "p"),
  enemy: makeSide(DEFAULT_RUN_CONFIG.enemyN, DEFAULT_RUN_CONFIG.enemyHpFight1 / DEFAULT_RUN_CONFIG.enemyN, "e"),
  fightsSinceIgnition: 0,
};
const result = runFight(setup, cfg, new Rng(1), 1);

function snapshotAt(t: number): TickSnapshot {
  const snap = result.snapshots.find((s) => Math.abs(s.t - t) < 1e-6);
  if (!snap) throw new Error(`no snapshot at t=${t}`);
  return snap;
}

const s8 = snapshotAt(8);
approx("t=8 player fraction", s8.playerHp / s8.playerMaxHp, 0.62, 0.02);
approx("t=8 enemy fraction", s8.enemyHp / s8.enemyMaxHp, 0.76, 0.02);

const gateEvent = result.events.find((e) => e.type === "gateOpen");
if (!gateEvent) {
  console.log("FAIL: gate never opened");
  failed = true;
} else {
  between("gate-open time", gateEvent.t, 14.0, 15.0);
}

const s16 = snapshotAt(16);
approx("t=16 player fraction", s16.playerHp / s16.playerMaxHp, 0.35, 0.02);
approx("t=16 enemy fraction", s16.enemyHp / s16.enemyMaxHp, 0.52, 0.02);

const s30 = snapshotAt(30);
approx("t=30 player fraction", s30.playerHp / s30.playerMaxHp, 0.1, 0.02);
approx("t=30 enemy fraction", s30.enemyHp / s30.enemyMaxHp, 0.1, 0.02);

if (failed) {
  console.error("\nbeatsheet check FAILED");
  process.exit(1);
} else {
  console.log("\nbeatsheet check passed");
}
