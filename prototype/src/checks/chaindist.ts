/**
 * Verifies the two PRD tables' composition in isolation, ASSUMING ignition
 * eligibility is always reached (i.e. every simulated "fight" here gets an
 * ignition roll) — a pure regression pin on the tables themselves, not a
 * claim about how often a real fight actually ignites or shows the full
 * chain>=3 spectacle. As of 2026-08-07 (see DECISIONS.md's "fight causality
 * rebuild" entry) eligibility is a per-hero heat meter, not a gate — the
 * real overall-fight rates depend on squad composition and fight length,
 * which is what `npm run batch -- --squad <name>`'s dipRate / ignitionRate /
 * fullSpectacleRate report, and is the number to check against the target
 * funnel in DECISIONS.md, not this file.
 *
 * Runs the two PRD tables directly (not full fight sims) over 100k simulated
 * "fights," since the claim is about the tables' composition, not combat
 * timing.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, prdLookup } from "../sim/config.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makePolicy, runRun } from "../sim/run.js";
import { BatchAggregator } from "../batch/report.js";

const cfg = DEFAULT_RUN_CONFIG.fight;
const rng = new Rng(12345);
const N = 100_000;

let ignitions = 0;
let chain3Plus = 0;
let attemptsSinceIgnition = 0;

for (let i = 0; i < N; i++) {
  const ignitionChance = prdLookup(cfg.ignitionChanceByAttemptsSinceIgnition, attemptsSinceIgnition);
  const fired = rng.chance(ignitionChance);
  if (!fired) {
    attemptsSinceIgnition++;
    continue;
  }
  ignitions++;
  attemptsSinceIgnition = 0;

  let chainLength = 0;
  while (chainLength < 50) {
    const chance = prdLookup(cfg.chainChanceByHitsSoFar, chainLength);
    if (!rng.chance(chance)) break;
    chainLength++;
  }
  if (chainLength >= 3) chain3Plus++;
}

const ignitionRate = ignitions / N;
// Pre-existing bug fixed 2026-08-08: this used to divide by N (total
// attempts) rather than `ignitions`, so despite the label "fraction of
// ELIGIBLE fights with chain >= 3" it was actually measuring
// ignitionRate * (conditional chain>=3 rate) — a figure that moves whenever
// the ignition table changes, even though chainChanceByHitsSoFar (the thing
// this line claims to isolate) never did. Dividing by `ignitions` is what
// the comment always said it should do.
const chain3PlusRate = ignitions > 0 ? chain3Plus / ignitions : 0;

let failed = false;

function between(name: string, actual: number, lo: number, hi: number): void {
  const ok = actual >= lo && actual <= hi;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${(actual * 100).toFixed(2)}%, expected in [${lo * 100}%, ${hi * 100}%]`);
  if (!ok) failed = true;
}

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

// These describe the PRD tables themselves (config.ts's
// ignitionChanceByAttemptsSinceIgnition / chainChanceByHitsSoFar), simulated
// here as back-to-back independent attempts with no fight in between — a
// pure composition check, not a claim about real fight-to-fight cadence.
// The ignition-rate band dropped sharply from the pre-2026-08-08 [0.55,0.65]
// because that table's index-0 entry dropped 0.5 -> 0.2 (see config.ts):
// attempts are now repeatable within a fight, so a lower per-attempt floor
// is what keeps one dangerous fight from being ~guaranteed to ignite on its
// first heat-cross. chain3PlusRate is untouched by the 2026-08-08 rebuild —
// chainChanceByHitsSoFar didn't move.
between("long-run per-attempt ignition rate (composition of the table alone)", ignitionRate, 0.3, 0.4);
between("fraction of ELIGIBLE fights with chain >= 3", chain3PlusRate, 0.38, 0.46);

// --- Target-funnel check for the comfortable comp, retuned 2026-08-08 for
// the "cascade is steerable + squad choice can lose" rebuild (see
// DECISIONS.md's housekeeping note — batch-verified at these values via
// `npm run batch --squad comfortable`). Bands moved again from the
// pre-2026-08-08 numbers because run completion is no longer ~100% for
// every squad by construction (see config.ts's difficultyRampFactor/
// difficultyDamageRampFactor and sim/run.ts's healFraction) — a comp can now
// actually lose, so dip rate, ignition rate, and "wins with no chain" all
// shift with it.
// Known open gap (2026-08-08, same shape as the pre-2026-08-06 "tight isn't
// reliably riskier than comfortable" gap this file used to document):
// bracer+vex+cairn and vex+cairn+ward stay near-100% run completion
// regardless of how hard the ramp is pushed — a fast kill + a real tank +
// real healing has no weakness on any axis the current ramp can reach (see
// scaledArchetype's docstring). Not blocking; a target for hero-stat-level
// tuning, not a global-ramp one.
{
  const cfg2 = DEFAULT_RUN_CONFIG;
  const policy = makePolicy("never-spend", cfg2);
  const agg = new BatchAggregator(cfg2);
  const N2 = 2000;
  for (let i = 0; i < N2; i++) {
    const seed = 50_000 + i;
    agg.add(runRun(cfg2, new Rng(seed), policy, seed, makePlayerSide(["bracer", "rook", "cairn"])));
  }
  const report = agg.finalize();

  between("comfortable comp: run completion", report.runCompletionRate, 0.5, 0.8);
  between("comfortable comp: dip rate", report.dipRate, 0.1, 0.35);
  between("comfortable comp: ignition rate", report.ignitionRate, 0.7, 0.92);
  between("comfortable comp: full-spectacle rate", report.fullSpectacleRate, 0.2, 0.45);
  // Compared against fractionFightsWithChain3Plus (ALL fights, same
  // population as fullSpectacleRate) as of 2026-08-08, not the wins-only
  // fractionWinsWithChain3Plus — see batch/report.ts's docstring for why
  // that comparison stopped being meaningful once real losses became common.
  const spectacleGuardDiff = Math.abs(report.fullSpectacleRate - report.fractionFightsWithChain3Plus);
  between("comfortable comp: full-spectacle rate tracks chain>=3 across all fights (RC1 guard)", spectacleGuardDiff, 0, 0.02);
  between("comfortable comp: wins with no chain (big win, not only win)", report.fractionWinsWithNoChain, 0.2, 0.45);
  // The direct measurement of the player's own cherished moment — "my
  // tank/dealer HP gets very low, then the damage gets much higher and they
  // wipe the enemy with near death" — a chain firing from a losing position,
  // not a routine one. Pre-2026-08-08 this was ~0 (winning comps took 0.00
  // deaths per run, so danger and the cascade never co-occurred).
  between("comfortable comp: chains firing from a losing position (>=35% target)", report.fractionChainsWhileLosing, 0.35, 1.0);
}

// --- Risk-dial ordering (2026-08-07): run completion should spread
// meaningfully by squad choice — the direct fix for the bug that started
// this rebuild (three squads within 5 points of each other, batch-verified
// 2026-08-07 against the STATE.md replay). Not a strict monotonic ordering
// pin (tight vs. greedy's relative order is itself an open question, same
// as the pre-existing tuning gap noted above) — just that comfortable is
// clearly safest and both alternatives clearly cost something.
{
  const cfg3 = DEFAULT_RUN_CONFIG;
  const policy = makePolicy("never-spend", cfg3);
  const N3 = 2000;

  function completionRateFor(squad: string[], seedBase: number): number {
    const agg = new BatchAggregator(cfg3);
    for (let i = 0; i < N3; i++) {
      const seed = seedBase + i;
      agg.add(runRun(cfg3, new Rng(seed), policy, seed, makePlayerSide(squad)));
    }
    return agg.finalize().runCompletionRate;
  }

  const comfortableRate = completionRateFor(["bracer", "rook", "cairn"], 60_000);
  const tightRate = completionRateFor(["hollow", "rook", "cairn"], 70_000);
  // vex+rook+hollow, not vex+rook+ward (2026-08-08) — see batch/cli.ts's
  // SQUAD_PRESETS comment: Ward's attacksWhileHealing made the old greedy
  // preset nearly as safe as comfortable. This has no healer at all.
  const greedyRate = completionRateFor(["vex", "rook", "hollow"], 80_000);

  check(
    "risk dial: comfortable completes runs more often than tight",
    comfortableRate > tightRate,
    `comfortable=${(comfortableRate * 100).toFixed(1)}% tight=${(tightRate * 100).toFixed(1)}%`,
  );
  check(
    "risk dial: comfortable completes runs more often than greedy",
    comfortableRate > greedyRate,
    `comfortable=${(comfortableRate * 100).toFixed(1)}% greedy=${(greedyRate * 100).toFixed(1)}%`,
  );
  check(
    "risk dial: comfortable's margin over the riskier squads is real, not noise",
    comfortableRate - Math.max(tightRate, greedyRate) > 0.15,
    `comfortable=${(comfortableRate * 100).toFixed(1)}% best-of-rest=${(Math.max(tightRate, greedyRate) * 100).toFixed(1)}%`,
  );
}

if (failed) {
  console.error("\nchaindist check FAILED");
  process.exit(1);
} else {
  console.log("\nchaindist check passed");
}
