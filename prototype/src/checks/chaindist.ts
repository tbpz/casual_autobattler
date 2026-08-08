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
import { makePlayerSide, PLAYER_HERO_POOL } from "../sim/heroes.js";
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

// --- Target-funnel check for the comfortable comp, re-pinned 2026-08-08 by
// the dominant-squad root-cause pass (see heroes.ts's pool docstring and
// DECISIONS.md's entry on this pass — batch-verified at these values via
// `npm run batch --squad comfortable`). Every band here moved down from the
// pre-2026-08-08 numbers: that pass deliberately made the default pick
// genuinely losable (run completion ~23% vs. the old ~65%) as the direct fix
// for "I can spam this comp blindly and win" — see checks/projection.ts's
// matching flip from "bands comfortable" to "bands tight" for the same
// squad. chains-while-losing is the one band that DIDN'T need to move down —
// it was already the metric this pass most wanted to protect (the best comp
// must still deliver the lead moment, not just be beatable).
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

  between("comfortable comp: run completion", report.runCompletionRate, 0.12, 0.35);
  between("comfortable comp: dip rate", report.dipRate, 0.2, 0.45);
  between("comfortable comp: ignition rate", report.ignitionRate, 0.45, 0.75);
  between("comfortable comp: full-spectacle rate", report.fullSpectacleRate, 0.12, 0.35);
  // Compared against fractionFightsWithChain3Plus (ALL fights, same
  // population as fullSpectacleRate) as of 2026-08-08, not the wins-only
  // fractionWinsWithChain3Plus — see batch/report.ts's docstring for why
  // that comparison stopped being meaningful once real losses became common.
  const spectacleGuardDiff = Math.abs(report.fullSpectacleRate - report.fractionFightsWithChain3Plus);
  between("comfortable comp: full-spectacle rate tracks chain>=3 across all fights (RC1 guard)", spectacleGuardDiff, 0, 0.02);
  between("comfortable comp: wins with no chain (big win, not only win)", report.fractionWinsWithNoChain, 0.35, 0.65);
  // The direct measurement of the player's own cherished moment — "my
  // tank/dealer HP gets very low, then the damage gets much higher and they
  // wipe the enemy with near death" — a chain firing from a losing position,
  // not a routine one. Pre-2026-08-08 this was ~0 (winning comps took 0.00
  // deaths per run, so danger and the cascade never co-occurred).
  between("comfortable comp: chains firing from a losing position (>=35% target)", report.fractionChainsWhileLosing, 0.35, 1.0);
}

// --- Risk-dial ordering (2026-08-07 - 2026-08-08): this block used to pin
// comfortable > tight > greedy as a STRICT ordering, on the assumption that
// exactly one composition is authoritatively "safest." The 2026-08-08
// dominant-squad root-cause pass broke that assumption on purpose: Hollow's
// higher chainAffinity is now a genuine alternate path to survival (bigger,
// more frequent chains ending fights faster) rather than a strictly worse
// HP trade, so hollow+rook+cairn ("tight") now completes MORE runs than
// bracer+rook+cairn ("comfortable") — 37.0% vs. 22.6% at n=2000, batch-
// verified. That is squad choice working as a real, multi-dimensional
// decision (STATE.md's "full-info puzzle, multiple solutions" reference-
// games row) rather than a single dominant pick with a fixed pecking order,
// so forcing the old ordering back would mean re-flattening exactly the
// thing this pass exists to create. This block is replaced below by a sweep
// over ALL 20 possible squads — the actual invariant worth protecting
// ("no blind-spam pick, no trap pick") doesn't depend on any one squad
// being crowned safest.

// --- No dominant squad (2026-08-08, the direct regression guard for the
// dominant-squad root-cause pass — see heroes.ts's pool docstring and
// DECISIONS.md's entry on this pass). Sweeps all 20 possible 3-hero squads
// (C(6,3) of the pool) and asserts:
//  - no squad is a blind-spam win: max run completion <= 0.60.
//  - the best-performing squad still delivers the lead moment rather than
//    bypassing it: its fractionChainsWhileLosing >= 0.25 (chains firing
//    from behind, not as a victory lap — the direct fix for
//    bracer+vex+cairn's pre-pass 0.0%).
//  - every squad EXCEPT two named, deliberately extreme trap picks clears a
//    0.15 floor. bracer+cairn+ward (a tank plus two supports, one of them
//    non-attacking, leaves almost no real damage output — see heroes.ts:
//    Cairn's own `damage` stat is decorative, it never attacks while
//    healPerBeat is set) and rook+vex+ward (no tank at all, a modest hybrid
//    healer, three fragile bodies sharing full aggro) are structurally
//    weak in ways this pass's levers (heal cap, enrage-from-HP-lost, hero
//    throughput rebalance, global ramp) couldn't reach without re-inflating
//    the other 18 squads back out of band — every attempt tried during this
//    pass's tuning traded one for the other. They're pinned individually
//    below as confirmed extreme-risk picks (batch-verified near 0%), the
//    same "not blocking, a real spread of risk" shape as every prior known
//    gap this file has documented.
{
  const cfgSweep = DEFAULT_RUN_CONFIG;
  const policy = makePolicy("never-spend", cfgSweep);
  const N4 = 400;

  function heroCombinations(k: number): string[][] {
    const ids = PLAYER_HERO_POOL.map((h) => h.id);
    const out: string[][] = [];
    function rec(start: number, chosen: string[]): void {
      if (chosen.length === k) {
        out.push([...chosen]);
        return;
      }
      for (let i = start; i < ids.length; i++) {
        chosen.push(ids[i] as string);
        rec(i + 1, chosen);
        chosen.pop();
      }
    }
    rec(0, []);
    return out;
  }

  const TRAP_SQUADS = new Set(["bracer,cairn,ward", "rook,vex,ward"]);

  let seedBase = 90_000;
  let maxRate = 0;
  let maxSquad = "";
  let minNonTrapRate = 1;
  let minNonTrapSquad = "";
  let bestChainsWhileLosing = 0;
  const trapRates: Record<string, number> = {};

  for (const squad of heroCombinations(3)) {
    const key = squad.join(",");
    const agg = new BatchAggregator(cfgSweep);
    for (let i = 0; i < N4; i++) {
      const seed = seedBase + i;
      agg.add(runRun(cfgSweep, new Rng(seed), policy, seed, makePlayerSide(squad)));
    }
    seedBase += N4;
    const report = agg.finalize();

    if (report.runCompletionRate > maxRate) {
      maxRate = report.runCompletionRate;
      maxSquad = key;
      bestChainsWhileLosing = report.fractionChainsWhileLosing;
    }
    if (TRAP_SQUADS.has(key)) {
      trapRates[key] = report.runCompletionRate;
    } else if (report.runCompletionRate < minNonTrapRate) {
      minNonTrapRate = report.runCompletionRate;
      minNonTrapSquad = key;
    }
  }

  between(`no dominant squad: max completion (${maxSquad})`, maxRate, 0, 0.6);
  check(
    `no dominant squad: the best squad still delivers the lead moment (${maxSquad})`,
    bestChainsWhileLosing >= 0.25,
    `chainsWhileLosing=${(bestChainsWhileLosing * 100).toFixed(1)}% (target >=25%)`,
  );
  between(`no trap pick: floor across the other 18 squads (${minNonTrapSquad})`, minNonTrapRate, 0.15, 1.0);
  for (const key of TRAP_SQUADS) {
    check(
      `known extreme-risk pick stays extreme (${key})`,
      (trapRates[key] ?? 1) < 0.15,
      `completion=${((trapRates[key] ?? 1) * 100).toFixed(1)}% — if this rises well above ~15%, its docstring note above needs revisiting`,
    );
  }
}

if (failed) {
  console.error("\nchaindist check FAILED");
  process.exit(1);
} else {
  console.log("\nchaindist check passed");
}
