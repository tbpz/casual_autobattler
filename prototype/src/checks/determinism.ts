/**
 * Same seed -> identical event log, at both fight and run level. This is the
 * property everything else (the batch harness, "reproduce a specific chain
 * while tuning") depends on.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makePolicy, makeEnemySide, runRun } from "../sim/run.js";

let failed = false;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failed = true;
  }
}

const cfg = DEFAULT_RUN_CONFIG;

// Fight-level determinism.
const seed = 42;
const setup = { player: makePlayerSide(), enemy: makeEnemySide(cfg, 0) };
const fightA = runFight(setup, cfg.fight, new Rng(seed), seed);
const fightB = runFight(setup, cfg.fight, new Rng(seed), seed);
check("fight: same seed -> identical event log", JSON.stringify(fightA.events) === JSON.stringify(fightB.events));
check("fight: same seed -> identical outcome", fightA.outcome === fightB.outcome && fightA.chainLength === fightB.chainLength);

// Different seeds should (almost certainly) diverge, as a sanity check that
// the RNG is actually being consumed — normal combat alone (damage variance,
// weighted targeting) already draws heavily from the stream every fight, so
// no special setup is needed to force it (2026-08-14 chain rebuild: the old
// "high attemptsSinceIgnition" setup this used to need no longer applies —
// there's no per-attempt PRD counter to bias anymore). Check several pairs
// rather than trusting one.
let sawDivergence = false;
for (let i = 0; i < 10; i++) {
  const a = runFight(setup, cfg.fight, new Rng(1000 + i), 1000 + i);
  const b = runFight(setup, cfg.fight, new Rng(2000 + i), 2000 + i);
  if (JSON.stringify(a.events) !== JSON.stringify(b.events)) {
    sawDivergence = true;
    break;
  }
}
check("fight: different seeds -> at least one pair diverges", sawDivergence);

// Run-level determinism.
const policy = makePolicy("always-heal", cfg);
const runA = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide());
const runB = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide());
check(
  "run: same seed -> identical fight-by-fight summary",
  JSON.stringify(runA.fights) === JSON.stringify(runB.fights),
);
check("run: same seed -> identical outcome", runA.outcome === runB.outcome && runA.finalCoin === runB.finalCoin);

if (failed) {
  console.error("\ndeterminism check FAILED");
  process.exit(1);
} else {
  console.log("\ndeterminism check passed");
}
