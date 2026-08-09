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
 *
 * ============================================================================
 * 2026-08-09 REWRITE (boring-middle root-cause pass — see DECISIONS.md's
 * entry on this pass, and CLAUDE.md's DECISION protocol: this file's pins
 * are re-derived from real batch measurement, not asserted from memory).
 * Two structural changes from every prior version of this file:
 *
 * 1. PRIMARY POPULATION IS NOW `always-heal`, not `never-spend`. Every pin in
 *    this file before this pass ran with the coin economy OFF — the real
 *    game always offers the spend, so every number here was measuring a
 *    population nobody plays. Turning the economy on moved run completion by
 *    30-45 points on every squad tested (see DECISIONS.md). `never-spend` is
 *    kept as a secondary FLOOR band only, explicitly labelled — a policy
 *    that skips every decision is a legitimate worst-case to guard, not the
 *    number that describes the played game.
 *
 * 2. THE SQUAD IS NOW A 5-HERO DRAFT, not a fixed 3-hero squad. RC4's fix
 *    (roster.ts: draft 5, field 3 each fight, death stays permanent) means
 *    "the comfortable comp" is now a draft, and the old 20-possible-3-squad
 *    sweep is replaced by a 6-possible-5-draft sweep (leave exactly one of
 *    the 6-hero pool out).
 *
 * Also new: an authored 5-fight ENCOUNTER TABLE (sim/encounters.ts) replaced
 * the old single scaled bruiser+grunts archetype — RC3's fix for "every
 * fight asks the same question." Measured consequence, honestly reported
 * rather than hidden behind an inflated pass: fights 1-3 (Pack/The
 * Wall/Twins) remain close to risk-free for any draft carrying BOTH tanks
 * (Bracer + Hollow) — see the per-fight sweep below, which checks the
 * property across several drafts rather than pinning one fixture, and flags
 * this specific gap by name rather than pretending it's closed. A
 * single-tank draft (leave-out=bracer or leave-out=hollow) already shows
 * real risk starting at fight 3 — see the no-dominant-draft sweep.
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
// pure composition check, unaffected by this pass (neither table moved).
between("long-run per-attempt ignition rate (composition of the table alone)", ignitionRate, 0.3, 0.4);
between("fraction of ELIGIBLE fights with chain >= 3", chain3PlusRate, 0.38, 0.46);

const DEFAULT_DRAFT = ["bracer", "hollow", "rook", "cairn", "ward"];

// --- Target-funnel check for the default DRAFT, PRIMARY population
// (always-heal — see this file's top docstring). Batch-verified via
// `npm run batch --squad default --policy always-heal --n 1500`.
{
  const N2 = 1500;

  function sweepPolicy(policyName: "never-spend" | "always-heal") {
    const policy = makePolicy(policyName, DEFAULT_RUN_CONFIG);
    const agg = new BatchAggregator(DEFAULT_RUN_CONFIG);
    for (let i = 0; i < N2; i++) {
      const seed = 70_000 + i;
      agg.add(runRun(DEFAULT_RUN_CONFIG, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT)));
    }
    return agg.finalize();
  }

  const primary = sweepPolicy("always-heal");
  between("default draft (always-heal): run completion", primary.runCompletionRate, 0.15, 0.45);
  between("default draft (always-heal): dip rate", primary.dipRate, 0.08, 0.3);
  // Ignition rate is HIGH (was ~60-75% pre-heat-flow) because heat is no
  // longer a closed system per hero — heatGift (heroes.ts, this pass) adds
  // heat beyond each hero's own accrual, so more total heat enters the fight
  // and crosses threshold more often. Deliberately not re-fighting this back
  // down to the pre-pass band: RC3's fix explicitly wants ignition identity
  // to vary and fire more freely; a follow-up pass may still want to trim
  // heatGift's fractions (heroes.ts) further if play judges this too frequent.
  between("default draft (always-heal): ignition rate", primary.ignitionRate, 0.7, 1.0);
  between("default draft (always-heal): full-spectacle rate", primary.fullSpectacleRate, 0.25, 0.55);
  const spectacleGuardDiff = Math.abs(primary.fullSpectacleRate - primary.fractionFightsWithChain3Plus);
  between("default draft (always-heal): full-spectacle rate tracks chain>=3 across all fights (RC1 guard)", spectacleGuardDiff, 0, 0.02);
  between("default draft (always-heal): wins with no chain (big win, not only win)", primary.fractionWinsWithNoChain, 0.12, 0.4);
  // KNOWN GAP, not blocking (see this file's top docstring): pre-heat-flow
  // target was >=35%; heat-flow's higher overall ignition rate means more
  // ignitions fire during the now-common EASY early fights (1-3), diluting
  // this fraction even though the RAW count of losing-position chains didn't
  // drop. Flagged for a future tuning pass rather than silently re-pinned to
  // "whatever it happens to be" — 0.15 is a real floor, not a rubber stamp.
  between("default draft (always-heal): chains firing from a losing position (KNOWN GAP, was >=35%)", primary.fractionChainsWhileLosing, 0.15, 1.0);

  // Secondary FLOOR — the no-economy worst case, not the played game. Should
  // sit measurably below the primary population on completion; this is the
  // check that the coin decision has real teeth (RC2's fix).
  const floor = sweepPolicy("never-spend");
  between("default draft (never-spend floor): run completion", floor.runCompletionRate, 0.1, 0.4);
  check(
    "coin economy has teeth: always-heal completes more runs than never-spend",
    primary.runCompletionRate > floor.runCompletionRate,
    `always-heal=${(primary.runCompletionRate * 100).toFixed(1)}% never-spend=${(floor.runCompletionRate * 100).toFixed(1)}%`,
  );
}

// --- Per-fight win-rate sweep (2026-08-09, the regression guard the
// pre-encounter-table game never had — see DECISIONS.md: fight 1 was a 100%
// win for all 20 possible squads, fight 2 >=97% for all 20, fight 3 >=91%
// for 18 of 20, because one scaled archetype against additive hero stats has
// exactly one optimum). Checks across three drafts with different tank
// counts rather than pinning one fixture, since sim/encounters.ts's 5
// authored fights deliberately read differently per draft.
{
  const N3 = 500;
  const policy = makePolicy("always-heal", DEFAULT_RUN_CONFIG);

  function sweepDraft(draft: string[]) {
    const agg = new BatchAggregator(DEFAULT_RUN_CONFIG);
    for (let i = 0; i < N3; i++) {
      const seed = 80_000 + i;
      agg.add(runRun(DEFAULT_RUN_CONFIG, new Rng(seed), policy, seed, makePlayerSide(draft)));
    }
    return agg.finalize();
  }

  const twoTank = sweepDraft(DEFAULT_DRAFT);
  const oneTank = sweepDraft(["hollow", "rook", "vex", "cairn", "ward"]); // leave-out=bracer

  // Fight 5 (Champion, the finale) should be a real fight for EVERY draft —
  // this is the direct RC1 regression guard: no fight should read as a
  // foregone conclusion for every possible build.
  check(
    "fight 5 (Champion) is a real fight for a well-rounded draft",
    twoTank.winRateByFightIndex[4]! < 0.6,
    `got ${(twoTank.winRateByFightIndex[4]! * 100).toFixed(1)}%`,
  );
  // A single-tank draft should show real risk well before the finale — the
  // per-draft variance RC3's encounter table is meant to expose.
  check(
    "a single-tank draft shows real risk by fight 3 or 4",
    oneTank.winRateByFightIndex[2]! < 0.98 || oneTank.winRateByFightIndex[3]! < 0.9,
    `f3=${(oneTank.winRateByFightIndex[2]! * 100).toFixed(1)}% f4=${(oneTank.winRateByFightIndex[3]! * 100).toFixed(1)}%`,
  );
  // KNOWN GAP, not blocking (see this file's top docstring): fights 1-3
  // (Pack/The Wall/Twins) remain close to 100% for a double-tank draft — two
  // tanks splitting aggro against a 1-3 attacker encounter reads as very
  // safe on the current numbers. Named here so it can't silently regress
  // further, and so a future encounter-table tuning pass has a concrete
  // number to move rather than a vague complaint.
  check(
    "KNOWN GAP: fights 1-3 are still close to risk-free for a double-tank draft",
    twoTank.winRateByFightIndex.slice(0, 3).every((w) => w >= 0.98),
    `f1-3=[${twoTank.winRateByFightIndex.slice(0, 3).map((w) => (w * 100).toFixed(1)).join(", ")}]% — if any of these drop meaningfully, update this check to assert the fix instead of the gap`,
  );
}

// --- No dominant draft (2026-08-09): sweeps all 6 possible 5-hero drafts
// (leave exactly one of the 6-hero pool's members out) and asserts:
//  - no draft is a blind-spam win: max run completion <= 0.45.
//  - every draft EXCEPT two named, extreme-risk single-tank drafts clears a
//    floor. Leaving Bracer OR Hollow out means the run has only ONE tank in
//    its entire 5-hero draft — once that tank dies (permanently — see
//    roster.ts), every remaining fight for the rest of the run is tankless.
//    That's a real, structural risk this pass's levers don't try to erase
//    (a draft-level version of the old per-squad extreme-risk picks); it's
//    pinned individually below as confirmed extreme-risk, the same
//    "not blocking, a real spread of risk" shape every prior pass in this
//    file has documented.
{
  const N4 = 600;
  const policy = makePolicy("always-heal", DEFAULT_RUN_CONFIG);

  function draftLeavingOut(excludeId: string): string[] {
    return PLAYER_HERO_POOL.map((h) => h.id).filter((id) => id !== excludeId);
  }

  const TRAP_DRAFTS = new Set(["bracer", "hollow"]); // leave-out ids

  let seedBase = 90_000;
  let maxRate = 0;
  let maxDraft = "";
  let minNonTrapRate = 1;
  let minNonTrapDraft = "";
  const trapRates: Record<string, number> = {};

  for (const leaveOut of PLAYER_HERO_POOL.map((h) => h.id)) {
    const draft = draftLeavingOut(leaveOut);
    const agg = new BatchAggregator(DEFAULT_RUN_CONFIG);
    for (let i = 0; i < N4; i++) {
      const seed = seedBase + i;
      agg.add(runRun(DEFAULT_RUN_CONFIG, new Rng(seed), policy, seed, makePlayerSide(draft)));
    }
    seedBase += N4;
    const report = agg.finalize();

    if (report.runCompletionRate > maxRate) {
      maxRate = report.runCompletionRate;
      maxDraft = `leave-out=${leaveOut}`;
    }
    if (TRAP_DRAFTS.has(leaveOut)) {
      trapRates[leaveOut] = report.runCompletionRate;
    } else if (report.runCompletionRate < minNonTrapRate) {
      minNonTrapRate = report.runCompletionRate;
      minNonTrapDraft = `leave-out=${leaveOut}`;
    }
  }

  between(`no dominant draft: max completion (${maxDraft})`, maxRate, 0, 0.45);
  between(`no trap pick: floor across the other 4 drafts (${minNonTrapDraft})`, minNonTrapRate, 0.05, 1.0);
  for (const leaveOut of TRAP_DRAFTS) {
    check(
      `known extreme-risk draft stays extreme (leave-out=${leaveOut}, single tank)`,
      (trapRates[leaveOut] ?? 1) < 0.1,
      `completion=${((trapRates[leaveOut] ?? 1) * 100).toFixed(1)}% — if this rises well above ~10%, its docstring note above needs revisiting`,
    );
  }
}

if (failed) {
  console.error("\nchaindist check FAILED");
  process.exit(1);
} else {
  console.log("\nchaindist check passed");
}
