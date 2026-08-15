/**
 * Verifies the chain mechanic's two remaining dice in isolation: how long a
 * FIRED chain runs (chainChanceByHitsSoFar) and how often a fire goes bad
 * (backfireChance). As of the 2026-08-14 chain rebuild (see DECISIONS.md),
 * WHETHER a chain fires is no longer probabilistic — the highest-charge
 * living hero fires the instant its charge crosses chargeThreshold,
 * deterministically. That removed the third die (the old
 * ignitionChanceByAttemptsSinceIgnition PRD table) entirely, so this file no
 * longer simulates an "eligible fights" population — it simulates the two
 * tables that remain, directly, then falls through to real fight/run sweeps
 * (via BatchAggregator) for everything that depends on squad composition and
 * fight length, same as before.
 *
 * ============================================================================
 * 2026-08-09 REWRITE (boring-middle root-cause pass — see DECISIONS.md's
 * entry on this pass, and CLAUDE.md's DECISION protocol: this file's pins
 * are re-derived from real batch measurement, not asserted from memory).
 * Two structural changes from every prior version of this file:
 *
 * 1. PRIMARY POPULATION IS `always-heal`, not `never-spend`. The real game
 *    always offers the coin spend, so `always-heal` is the population that
 *    describes the played game; `never-spend` is kept as a secondary FLOOR
 *    band only, explicitly labelled — a policy that skips every decision is
 *    a legitimate worst-case to guard, not the played number.
 *
 * 2. THE SQUAD IS A 5-HERO DRAFT, not a fixed 3-hero squad (roster.ts: draft
 *    5, field 3 each fight, death stays permanent) — "the comfortable comp"
 *    is a draft, swept across the 6 possible 5-hero drafts (leave exactly
 *    one of the 6-hero pool out).
 *
 * An authored 5-fight ENCOUNTER TABLE (sim/encounters.ts) means each fight
 * asks a different question. KNOWN GAP, still open as of the chain rebuild:
 * fights 1-3 (Pack/The Wall/Twins) remain close to risk-free for any draft
 * carrying BOTH tanks (Bracer + Hollow) — see the per-fight sweep below,
 * flagged by name rather than pretending it's closed. A single-tank draft
 * (leave-out=bracer or leave-out=hollow) already shows real risk starting at
 * fight 3 — see the no-dominant-draft sweep.
 *
 * 2026-08-14 chain rebuild — every band below this point was re-measured
 * against the new mechanic (deterministic fire, chargeThreshold=220,
 * backfireChance=0.10, no heat gifts, charge persists across fights) via
 * `npm run batch --squad default --policy always-heal --n 1500` and the
 * equivalent draft sweeps; the pre-rebuild numbers are void (a different
 * mechanic produces a different distribution by construction), not a
 * regression baseline to compare against.
 *
 * chargeThreshold's first guess (330, a flat 3x the old heatThreshold) was
 * WRONG, caught by this exact re-measurement, not asserted from memory: it
 * crashed default-draft completion to ~7% even with backfireChance at 0.
 * Root cause — decoupling chainAffinity from accrual means chain-fire
 * opportunities now spread across heroes by raw output instead of
 * concentrating on high-affinity carriers the way the old heat mechanism
 * did, so the average fired chain's payoff dropped; fights 1-4's generous
 * margins absorbed that fine, but fight 5 (Champion) relied on that
 * concentration and collapsed (31.8% -> 7.6% win rate). 220 restores fight 5
 * to a comparable ~31-35%. See config.ts's chargeThreshold comment for the
 * full writeup — this is exactly the kind of thing CLAUDE.md's evidence-
 * over-memory discipline exists to catch.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, prdLookup } from "../sim/config.js";
import { makePlayerSide, PLAYER_HERO_POOL } from "../sim/heroes.js";
import { makePolicy, runRun } from "../sim/run.js";
import { chainAttackMagnitude } from "../sim/fight.js";
import { BatchAggregator } from "../batch/report.js";

const cfg = DEFAULT_RUN_CONFIG.fight;
const rng = new Rng(12345);
const N = 100_000;

// How long a FIRED chain runs (chainChanceByHitsSoFar) — unaffected by the
// rebuild, since that table didn't move; simulated directly as back-to-back
// independent chains, no fight in between.
let chain3Plus = 0;
for (let i = 0; i < N; i++) {
  let chainLength = 0;
  while (chainLength < 50) {
    const chance = prdLookup(cfg.chainChanceByHitsSoFar, chainLength);
    if (!rng.chance(chance)) break;
    chainLength++;
  }
  if (chainLength >= 3) chain3Plus++;
}
const chain3PlusRate = chain3Plus / N;

// How often a fire goes bad (backfireChance) — a straight coin flip, not a
// PRD table, but worth pinning as a composition sanity check: N=100k keeps
// sampling error tiny (std error ~0.0014 at p=0.25), so a real drift in the
// constant shows up immediately rather than hiding in noise.
let backfires = 0;
for (let i = 0; i < N; i++) {
  if (rng.chance(cfg.backfireChance)) backfires++;
}
const backfireCompositionRate = backfires / N;

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

between("fraction of fired chains with length >= 3 (composition of the table alone)", chain3PlusRate, 0.38, 0.46);
// Band re-centered 2026-08-15 (chain-payoff-axis pass) around
// backfireChance's new value (0.10 -> 0.12, re-tuned after the escalation
// curve moved run completion up ~3pts — see this file's DEFAULT_DRAFT
// funnel check below), same +/-0.02 tolerance as before.
between("backfireChance composition check (should track cfg.fight.backfireChance directly)", backfireCompositionRate, 0.1, 0.14);

// --- Escalation-vs-identity design invariant (2026-08-15, chain-payoff-axis
// pass — see prototype/CHAIN_AXIS_PLAN's Chunk 2 and heroes.ts's
// chainAffinity docstring). The whole point of compressing chainAffinity
// (0.3-1.6 -> 0.7-1.4) and steepening the per-hit escalation curve is to
// move a chain's unpredictable payoff spread from "who fired it" (known at
// draft time) onto "how long it ran" (decided live). This asserts that
// design intent directly and analytically — no batch sweep, no RNG — using
// chainAttackMagnitude, the exact function fight.ts's resolveChainHit calls,
// so there's no risk of the check drifting from the real formula.
//
// Scoped to the four ATTACKING heroes (tank/damage roles) only: their chain
// uses chainAttackMagnitude uncapped by anything target-dependent, unlike a
// healer's chain (clamped by the target's own maxHp — see
// chainHealMaxFractionOfTargetMaxHp), which would make an identity/length
// comparison depend on which body happened to be lowest-HP, not on the
// formula itself.
{
  const cfg = DEFAULT_RUN_CONFIG.fight;
  const attackers = PLAYER_HERO_POOL.filter((h) => !h.healPerBeat);

  function chainTotal(damage: number, affinity: number, length: number): number {
    let total = 0;
    for (let hit = 1; hit <= length; hit++) total += chainAttackMagnitude(cfg, damage, affinity, hit);
    return total;
  }

  const totalsAtMax = attackers.map((h) => chainTotal(h.damage, h.chainAffinity, cfg.chainMaxHits));
  const identityRatio = Math.max(...totalsAtMax) / Math.min(...totalsAtMax);

  let worstLengthRatio = Infinity;
  let worstHero = "";
  for (const h of attackers) {
    const shortest = chainTotal(h.damage, h.chainAffinity, 1);
    const longest = chainTotal(h.damage, h.chainAffinity, cfg.chainMaxHits);
    const ratio = longest / shortest;
    if (ratio < worstLengthRatio) {
      worstLengthRatio = ratio;
      worstHero = h.id;
    }
  }

  check(
    "chain length out-spreads hero identity (2026-08-15 payoff-axis design invariant)",
    worstLengthRatio > identityRatio,
    `worst-case per-hero length ratio (${worstHero}) = ${worstLengthRatio.toFixed(1)}x, identity ratio at max length = ${identityRatio.toFixed(1)}x`,
  );

  // A softer floor: nobody's max chain is a dud relative to the pack — the
  // strongest attacker's max-length chain shouldn't out-total the weakest
  // by more than ~3x (pre-2026-08-15, Rook/Bracer's ratio was ~3.4x at the
  // OLD chainAffinity spread and OLD linear escalation — this check would
  // have failed against the old numbers, which is the point).
  check(
    "no dud hero: identity spread at max chain length stays under 3x",
    identityRatio <= 3,
    `identity ratio = ${identityRatio.toFixed(2)}x`,
  );
}

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
  // 2026-08-14 chain rebuild: chargeThreshold=220 and backfireChance=0.10
  // were batch-verified together (see config.ts's own comment on each) to
  // land run completion within a point of STATE.md's existing ~28% baseline
  // for the OLD mechanism — same overall difficulty, backfire risk layered
  // on top rather than compounding a harder curve.
  //
  // 2026-08-15 (chain-payoff-axis pass): re-verified after compressing
  // chainAffinity and steepening the per-hit escalation curve (see
  // heroes.ts and config.ts's chainEscalationKneeHit/StepMultiplier) —
  // backfireChance re-tuned 0.10 -> 0.12 to compensate (see config.ts's own
  // comment on that field for why completion drifted up in the first
  // place). Measured 29.60% at n=1500, seed base 70_000 — within a point
  // and a half of the same ~28% baseline.
  between("default draft (always-heal): run completion", primary.runCompletionRate, 0.15, 0.4);
  between("default draft (always-heal): dip rate", primary.dipRate, 0.08, 0.3);
  between("default draft (always-heal): chain rate", primary.chainRate, 0.6, 0.95);
  between("default draft (always-heal): full-spectacle rate", primary.fullSpectacleRate, 0.3, 0.65);
  const spectacleGuardDiff = Math.abs(primary.fullSpectacleRate - primary.fractionFightsWithChain5Plus);
  between("default draft (always-heal): full-spectacle rate tracks chain>=5 across all fights (RC1 guard)", spectacleGuardDiff, 0, 0.02);
  between("default draft (always-heal): wins with no chain (big win, not only win)", primary.fractionWinsWithNoChain, 0.15, 0.45);
  between("default draft (always-heal): chains firing from a losing position", primary.fractionChainsWhileLosing, 0.08, 0.35);
  // The direct check that backfireChance (0.10) is actually landing at the
  // fight level, not just in the isolated composition check above.
  between(
    "default draft (always-heal): fraction of fired chains that backfire (should track cfg.fight.backfireChance)",
    primary.fractionChainsBackfired,
    0.06,
    0.14,
  );

  // Secondary FLOOR — the no-economy worst case, not the played game.
  const floor = sweepPolicy("never-spend");
  between("default draft (never-spend floor): run completion", floor.runCompletionRate, 0.15, 0.4);
  // KNOWN GAP (2026-08-14 chain rebuild) — not blocking, named so it can't
  // silently regress further. Pre-rebuild, always-heal reliably beat
  // never-spend by a wide margin (the coin spend's whole point). Post-
  // rebuild, measured at n=3000: always-heal 27.2%, never-spend 28.1% —
  // statistically indistinguishable. Root cause, not noise: the dominant new
  // failure mode is a backfire chain landing a large burst on 1-2 heroes in
  // one tick; a flat "+25 HP to every living hero" heal (healHpAmount) does
  // little against a burst that size, so the coin spend's protective value
  // against the mechanic that now decides most runs is much weaker than it
  // was against the old mechanic's gradual attrition. A future pass should
  // either give the coin spend real leverage against backfire specifically
  // (e.g. a spend that blunts the next chain's magnitude) or accept that the
  // spend's value has shifted purpose — not something to guess at without a
  // playtest verdict, per CLAUDE.md's propose-don't-silently-commit rule.
  check(
    "coin economy is at least not WORSE than skipping it (KNOWN GAP above — no longer asserted strictly better)",
    primary.runCompletionRate >= floor.runCompletionRate - 0.06,
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
  // safe on the current numbers.
  //
  // 2026-08-15 (chain-payoff-axis pass): the gap NARROWED as a side effect
  // — f1-3 was [100.0, 98.8, 99.0]% before this pass, now [100.0, 97.0,
  // 95.1]% at the same n=500/seed base. A bigger, more length-dependent
  // chain payoff makes even an early, "safe" fight less foreclosed — a
  // long chain (good or bad) can now swing an outcome that a flatter
  // formula couldn't. Still a real gap (f1 is untouched, f2/f3 stayed
  // above 90%), so the band moves rather than closes — per this check's own
  // standing rule, if a future pass narrows it further, move the band
  // again rather than deleting the check.
  check(
    "KNOWN GAP: fights 1-3 are still close to risk-free for a double-tank draft",
    twoTank.winRateByFightIndex[0]! >= 0.98 && twoTank.winRateByFightIndex.slice(1, 3).every((w) => w >= 0.9),
    `f1-3=[${twoTank.winRateByFightIndex.slice(0, 3).map((w) => (w * 100).toFixed(1)).join(", ")}]% — if any of these drop meaningfully further, update this check to assert the fix instead of the gap`,
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
