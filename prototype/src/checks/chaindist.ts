/**
 * Verifies the two PRD tables' composition in isolation, ASSUMING the
 * eligibility gate is always open (i.e. every simulated "fight" here gets an
 * ignition roll) — a pure regression pin on the tables themselves, not a
 * claim about how often a real fight actually ignites or shows the full
 * chain>=3 spectacle. As of 2026-08-06 (see DECISIONS.md's "jeopardy no
 * longer mandatory" entry) the gate itself is only reachable from a broken
 * tank line, so the real overall-fight rates depend heavily on squad
 * composition — that's what `npm run batch -- --squad <name>`'s dipRate /
 * ignitionRate / fullSpectacleRate report, and is the number to check
 * against the target funnel in DECISIONS.md, not this file.
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
let fightsSinceIgnition = 0;

for (let i = 0; i < N; i++) {
  const ignitionChance = prdLookup(cfg.ignitionChanceByFightsSince, fightsSinceIgnition);
  const fired = rng.chance(ignitionChance);
  if (!fired) {
    fightsSinceIgnition++;
    continue;
  }
  ignitions++;
  fightsSinceIgnition = 0;

  let chainLength = 0;
  while (chainLength < 50) {
    const chance = prdLookup(cfg.chainChanceByHitsSoFar, chainLength);
    if (!rng.chance(chance)) break;
    chainLength++;
  }
  if (chainLength >= 3) chain3Plus++;
}

const ignitionRate = ignitions / N;
const chain3PlusRate = chain3Plus / N;

let failed = false;

function between(name: string, actual: number, lo: number, hi: number): void {
  const ok = actual >= lo && actual <= hi;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${(actual * 100).toFixed(2)}%, expected in [${lo * 100}%, ${hi * 100}%]`);
  if (!ok) failed = true;
}

// Bands retuned 2026-08-06 for the new PRD tables (config.ts's
// ignitionChanceByFightsSince / chainChanceByHitsSoFar). These are higher
// than the real overall-fight rates on purpose — this metric assumes the
// gate is always open, which it now rarely is for a comfortable comp (see
// this file's docstring).
between("long-run ignition rate (gate assumed always open)", ignitionRate, 0.55, 0.65);
between("fraction of ELIGIBLE fights with chain >= 3", chain3PlusRate, 0.2, 0.3);

// --- Target-funnel check for the comfortable comp (2026-08-06), and the
// RC1 regression guard: full-spectacle rate must track wins-with-chain>=3,
// not the ignition rate (which is what the pre-2026-08-06 build got wrong —
// see DECISIONS.md's "spectacle gated on payoff" entry, batch-verified at
// the time as ignition 64.65% vs chain>=3 7.30%).
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

  between("comfortable comp: dip rate", report.dipRate, 0.15, 0.4);
  between("comfortable comp: ignition rate", report.ignitionRate, 0.1, 0.3);
  between("comfortable comp: full-spectacle rate", report.fullSpectacleRate, 0.03, 0.12);
  const spectacleGuardDiff = Math.abs(report.fullSpectacleRate - report.fractionWinsWithChain3Plus);
  between("comfortable comp: full-spectacle rate tracks wins-with-chain>=3 (RC1 guard)", spectacleGuardDiff, 0, 0.02);
  between("comfortable comp: wins with no chain (big win, not only win)", report.fractionWinsWithNoChain, 0.75, 1.0);
}

if (failed) {
  console.error("\nchaindist check FAILED");
  process.exit(1);
} else {
  console.log("\nchaindist check passed");
}
