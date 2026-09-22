/**
 * Same seed -> identical event log, at both fight and run level. This is the
 * property everything else (the batch harness, "reproduce a specific chain
 * while tuning") depends on.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeInitialProgress } from "../sim/progress.js";
import { makeStartingRoster } from "../sim/roles.js";
import { makeOfferPolicy, makeEnemySide, runRun } from "../sim/run.js";
import { defaultFieldPick } from "../sim/roster.js";
import { drawRoundEncounters } from "../sim/rounds.js";
import { runLabFight, type LabSetup } from "../lab/labFight.js";

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
const progress = makeInitialProgress(cfg);
const setup = { player: makeStartingRoster(progress.bonus), enemy: makeEnemySide(cfg, 0, 0) };
const fightA = runFight(setup, cfg.fight, new Rng(seed), seed);
const fightB = runFight(setup, cfg.fight, new Rng(seed), seed);
check("fight: same seed -> identical event log", JSON.stringify(fightA.events) === JSON.stringify(fightB.events));
check("fight: same seed -> identical outcome", fightA.outcome === fightB.outcome && fightA.chainLength === fightB.chainLength);

// Different seeds should (almost certainly) diverge, as a sanity check that
// the RNG is actually being consumed.
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
function offerPolicyAndRng(runSeed: number) {
  const offerRng = new Rng((runSeed ^ 0x51ed270b) >>> 0);
  return { offerRng, policy: makeOfferPolicy("first") };
}
const armA = offerPolicyAndRng(seed);
const runA = runRun(cfg, new Rng(seed), armA.offerRng, armA.policy, seed);
const armB = offerPolicyAndRng(seed);
const runB = runRun(cfg, new Rng(seed), armB.offerRng, armB.policy, seed);
check("run: same seed -> identical round-by-round summary", JSON.stringify(runA.rounds) === JSON.stringify(runB.rounds));
check("run: same seed -> identical outcome", runA.outcome === runB.outcome && runA.roundsWon === runB.roundsWon);

// An explicit opts.fieldPick=defaultFieldPick must produce byte-identical
// output to passing no opts at all, or every measurement arm built on this
// override is invalid.
const armC = offerPolicyAndRng(seed);
const runC = runRun(cfg, new Rng(seed), armC.offerRng, armC.policy, seed, { fieldPick: defaultFieldPick });
check(
  "run: explicit opts.fieldPick=defaultFieldPick matches the implicit default",
  JSON.stringify(runA.rounds) === JSON.stringify(runC.rounds),
);

// Round-order determinism (sim/rounds.ts's drawRoundEncounters) — the draw
// is state runRun and RunSession both depend on, so it needs its own direct
// pin rather than relying only on the run-level checks above to catch a
// regression indirectly.
const orderA = drawRoundEncounters(seed, cfg.roundsPerRun);
const orderB = drawRoundEncounters(seed, cfg.roundsPerRun);
check("round order: same seed -> identical draw", JSON.stringify(orderA) === JSON.stringify(orderB));
check("round order: draws roundsPerRun indices", orderA.length === cfg.roundsPerRun);

let orderDivergence = false;
for (let i = 0; i < 10; i++) {
  const a = drawRoundEncounters(1000 + i, cfg.roundsPerRun);
  const b = drawRoundEncounters(2000 + i, cfg.roundsPerRun);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    orderDivergence = true;
    break;
  }
}
check("round order: different seeds -> at least one pair diverges", orderDivergence);

// Lab-mode determinism (prototype/src/lab/labFight.ts): the lab builds its
// own FightSetup from a LabSetup and runs a fresh Rng(setup.seed) per call
// (unlike the real run, which shares one Rng stream across the whole run) —
// this pins that the lab's own setup layer is exactly as reproducible as
// every other runFight call site above.
const labSetup: LabSetup = { roles: ["damage", "tank", "support"], chargePercents: [99, 0, 0], encounterIndex: 3, rampIndex: 0, seed };
const labA = runLabFight(labSetup, cfg);
const labB = runLabFight(labSetup, cfg);
check("lab: same LabSetup -> identical event log", JSON.stringify(labA.events) === JSON.stringify(labB.events));

if (failed) {
  console.error("\ndeterminism check FAILED");
  process.exit(1);
} else {
  console.log("\ndeterminism check passed");
}
