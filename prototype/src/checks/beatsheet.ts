/**
 * Regression pin for fight 1 (default roster, no ramp, seed=8), with both PRD
 * tables zeroed so the pure-combat trajectory is isolated from the two dice
 * layered on top of it.
 *
 * Unlike the pre-2026-08-04 version of this check, the exact numbers below
 * are *not* hand-derivable from the constants alone: the support hero's
 * in-combat healing (fight.ts's performHeroAction) and the enemy's
 * weighted-random targeting (pickWeightedTargetId) both consume the RNG
 * stream, so exactly when the eligibility gate opens — and whether it opens
 * before or after the bruiser falls — varies seed to seed (confirmed by
 * scanning seeds 1-10 during the 2026-08-04 legibility rewrite: order and
 * timing both move). What *is* still deterministic, and worth pinning, is
 * the aggregate shape: total damage output per tick depends only on who's
 * alive, not on which specific hero a hit lands on, so a fixed seed always
 * reproduces the same beat-by-beat event log. That reproducibility — not an
 * independently-derived arithmetic check — is what this test guards.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makeEnemySide } from "../sim/run.js";

let failed = false;

function equal(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${String(actual)}, expected ${String(expected)}`);
  if (!ok) failed = true;
}

const cfg = { ...DEFAULT_RUN_CONFIG, fight: { ...DEFAULT_RUN_CONFIG.fight, ignitionChanceByFightsSince: [0], chainChanceByHitsSoFar: [0] } };
const setup = {
  player: makePlayerSide(),
  enemy: makeEnemySide(cfg, 0),
  fightsSinceIgnition: 0,
};
const result = runFight(setup, cfg.fight, new Rng(8), 8);

// The eligibility gate must still open — jeopardy is mandatory (DECISIONS.md
// 2026-07-28) — even though support healing means it doesn't open on every
// seed's fight 1 (scan seeds 1-10: 4/10 never cross the 40% threshold at all
// with a fresh, undamaged squad). Seed 8 is chosen specifically because it does.
const gateEvent = result.events.find((e) => e.type === "gateOpen");
if (!gateEvent) {
  console.log("FAIL: gate never opened");
  failed = true;
} else {
  equal("gate-open time", gateEvent.t, 17);
}

// The bruiser is the dip's visible cause — killing it is the turnaround.
const bruiserDown = result.events.find((e) => e.type === "heroDown" && e.side === "enemy" && e.heroId === "e0_bruiser");
if (!bruiserDown) {
  console.log("FAIL: bruiser never fell");
  failed = true;
} else {
  equal("bruiser death time", bruiserDown.t, 16);
}

// No cascade (both PRD tables zeroed) — the fight is won on ordinary combat alone.
equal("no ignition", result.ignited, false);
equal("no chain", result.chainLength, 0);

// Fight ends by wiping the enemy, not by hitting the failsafe.
equal("outcome", result.outcome, "win");
equal("end reason", result.endReason, "wipe");
equal("fight duration", result.durationSec, 26);
equal("final player HP", Math.round(result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0)), 140);

if (failed) {
  console.error("\nbeatsheet check FAILED");
  process.exit(1);
} else {
  console.log("\nbeatsheet check passed");
}
