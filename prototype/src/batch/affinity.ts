/**
 * Answers the question STATE.md/DECISIONS.md's attribution investigation
 * (2026-08-19) left open: "does drafting/fielding high-chainAffinity heroes
 * actually win more, or is the appeal purely visual?" Nothing else in the
 * repo measures this — see the plan this file implements
 * (analyze-the-root-cause-wobbly-flute) for the full root-cause writeup.
 *
 * This is a REPORT, not a check: it answers an open question rather than
 * pinning a known-good value, so it deliberately lives outside `npm run
 * check` (see package.json — wired as `npm run measure:affinity`, not added
 * to the `check` script chain). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every other pass in this repo.
 *
 * Seed block 200_000-239_999 is reserved for this file. Existing checks use:
 *   checks/chaindist.ts:  50_000+300, 70_000+1500(x2 policies), 80_000+500(x2),
 *                         90_000 stepping 600 (x6 drafts) -> tops out at 93_599
 * Do not reuse seeds below 200_000 here, and do not let a future check reuse
 * seeds in [200_000, 240_000) without updating this comment.
 *
 * Honest limitation, printed with every paired comparison: runRun shares ONE
 * Rng across the whole run, so a different fielding choice diverges the
 * COMBAT dice from fight 1's first roll onward. The pairing across arms is
 * "same seed -> same encounter draw, same starting roster" (encounterOrderFor
 * is keyed on `seed` alone, independent of fielding — see sim/encounters.ts),
 * NOT "same dice." McNemar's test on paired win/loss outcomes remains valid
 * under this design; it just doesn't get the full variance reduction a truly
 * shared-dice pairing would.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "../sim/config.js";
import {
  DEFAULT_DRAFT_ROSTER_IDS,
  makePlayerSide,
  PLAYER_HERO_POOL,
} from "../sim/heroes.js";
import { makePolicy, runRun, type RunResult } from "../sim/run.js";
import { defaultFieldPick, type FieldPick, type RosterState } from "../sim/roster.js";
import type { HeroState } from "../sim/types.js";
import { BatchAggregator, formatReport } from "./report.js";
import { HeroChainAggregator, formatHeroChainReport } from "./heroChain.js";
import { FIELD_POLICIES, rankedFieldPick, scoreHpFraction } from "./fieldPolicies.js";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const N = args.n ? Number(args.n) : 1500;
const BLOCK = (args.block as "A" | "B" | "C" | "all") ?? "all";
const POLICY_NAME = "always-heal" as const;

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));
const BURST_DRAFT = ["bracer", "hollow", "rook", "vex", "ward"]; // the only draft containing Vex

// --- Stats -------------------------------------------------------------

function mcnemar(a: boolean[], b: boolean[]): { onlyA: number; onlyB: number; z: number } {
  let onlyA = 0;
  let onlyB = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && !b[i]) onlyA++;
    else if (!a[i] && b[i]) onlyB++;
  }
  const z = onlyA + onlyB > 0 ? (onlyA - onlyB) / Math.sqrt(onlyA + onlyB) : 0;
  return { onlyA, onlyB, z };
}

function mean(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

// --- Roster transforms for Block B (the affinity dial) -----------------
// Harness-side only — never edits sim/heroes.ts. chainAffinity survives the
// whole run: fieldSquad copies {...h}, cloneHeroes spreads, and
// applyFightResultToRoster (roster.ts:121) rebuilds from the roster hero, so
// an override here persists for every fight with no leakage back into
// PLAYER_HERO_POOL.

function scaleAffinity(roster: RosterState, factor: number): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainAffinity: h.chainAffinity * factor })) };
}

function flattenAffinity(roster: RosterState, value: number): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainAffinity: value })) };
}

// --- One arm: N runs of the same draft/fieldPick/roster-transform over a
// fixed seed sequence, returning everything a comparison needs. ----------

interface ArmResult {
  label: string;
  report: ReturnType<BatchAggregator["finalize"]>;
  heroReport: ReturnType<HeroChainAggregator["finalize"]>;
  completed: boolean[];
  fightsWon: number[];
}

function runArm(
  label: string,
  runCfg: RunConfig,
  draftIds: string[],
  seeds: number[],
  fieldPick?: FieldPick,
  transformRoster?: (r: RosterState) => RosterState,
): ArmResult {
  const policy = makePolicy(POLICY_NAME, runCfg);
  const agg = new BatchAggregator(runCfg);
  const heroAgg = new HeroChainAggregator();
  const completed: boolean[] = [];
  const fightsWon: number[] = [];

  for (const seed of seeds) {
    let roster: RosterState = makePlayerSide(draftIds);
    if (transformRoster) roster = transformRoster(roster);
    const result: RunResult = runRun(runCfg, new Rng(seed), policy, seed, roster, fieldPick ? { fieldPick } : undefined);
    agg.add(result);
    heroAgg.add(result, draftIds);
    completed.push(result.outcome === "complete");
    fightsWon.push(result.fightsWon);
  }

  return { label, report: agg.finalize(), heroReport: heroAgg.finalize(), completed, fightsWon };
}

function printArm(arm: ArmResult, baseline?: ArmResult): void {
  console.log(formatReport(arm.report, arm.label));
  console.log(`  mean fights won:       ${mean(arm.fightsWon).toFixed(3)}`);
  console.log(`  f5 win rate:           ${(arm.report.winRateByFightIndex[4]! * 100).toFixed(1)}%`);
  if (baseline) {
    const mfwDelta = mean(arm.fightsWon) - mean(baseline.fightsWon);
    const complDelta = (arm.report.runCompletionRate - baseline.report.runCompletionRate) * 100;
    const { onlyA, onlyB, z } = mcnemar(arm.completed, baseline.completed);
    console.log(
      `  vs ${baseline.label}: completion ${complDelta >= 0 ? "+" : ""}${complDelta.toFixed(1)}pt, ` +
        `mean fights won ${mfwDelta >= 0 ? "+" : ""}${mfwDelta.toFixed(3)}, ` +
        `McNemar onlyThis=${onlyA} onlyBaseline=${onlyB} z=${z.toFixed(2)}`,
    );
  }
  console.log(formatHeroChainReport(arm.heroReport, arm.label, HEALER_IDS));
  console.log("");
}

// --- Self-verification preamble — abort the sweep if either fails ------

function verifyRoleFloorMatchesDefault(): boolean {
  const rng = new Rng(999_999);
  const hpFractionFieldPick = rankedFieldPick(scoreHpFraction, { roleFloor: true });
  for (let trial = 0; trial < 500; trial++) {
    const roster = makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS);
    const heroes: HeroState[] = roster.heroes.map((h) => {
      const alive = rng.chance(0.8);
      return { ...h, alive, hp: alive ? h.maxHp * (0.1 + rng.next() * 0.9) : 0 };
    });
    const synthetic: RosterState = { ...roster, heroes };
    const a = defaultFieldPick(synthetic, cfg.playerN).join(",");
    const b = hpFractionFieldPick(synthetic, cfg.playerN, { fightIndex: 0, encounterIndex: 0 }).join(",");
    if (a !== b) {
      console.error(`FAIL: rankedFieldPick(scoreHpFraction, roleFloor) diverged from defaultFieldPick on trial ${trial}`);
      console.error(`  default: ${a}`);
      console.error(`  ranked:  ${b}`);
      return false;
    }
  }
  console.log("PASS: rankedFieldPick(scoreHpFraction, roleFloor) matches defaultFieldPick over 500 synthetic rosters");
  return true;
}

function verifyDefaultOptIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 500_000 + i; // well clear of every reserved range
    const implicit = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide());
    const explicit = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(), { fieldPick: defaultFieldPick });
    if (JSON.stringify(implicit.fights) !== JSON.stringify(explicit.fights)) {
      console.error(`FAIL: runRun with no opts diverged from opts.fieldPick=defaultFieldPick at seed ${seed}`);
      return false;
    }
  }
  console.log("PASS: runRun(no opts) === runRun(opts.fieldPick=defaultFieldPick) over 25 seeds");
  return true;
}

if (!verifyRoleFloorMatchesDefault() || !verifyDefaultOptIsInert()) {
  console.error("\naffinity sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// --- Block B — the affinity dial (causal; run first) --------------------
// Draft fixed, default fielding, identical seeds across scales. Answers
// "does the LEVEL matter" (B1-B5) and "does the SPREAD between heroes
// matter" (B6, flattened, vs B3, unflattened, both mean-1.0-ish).

if (BLOCK === "B" || BLOCK === "all") {
  console.log("========== BLOCK B — affinity dial (draft=default, fielding=default) ==========\n");
  const seeds = Array.from({ length: N }, (_, i) => 220_000 + i);
  const b3 = runArm(`B3 scale=1.0x n=${N}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) => scaleAffinity(r, 1.0));
  printArm(b3);
  const scales = [0.6, 0.8, 1.2, 1.4];
  for (const scale of scales) {
    const arm = runArm(`B scale=${scale}x n=${N}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) => scaleAffinity(r, scale));
    printArm(arm, b3);
  }
  const b6 = runArm(`B6 flattened=1.0 n=${N}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) => flattenAffinity(r, 1.0));
  console.log("  B6 vs B3 isolates the SPREAD-between-heroes question (Tu's actual complaint) from the LEVEL question above:");
  printArm(b6, b3);
}

// --- Block A — fielding policy (draft fixed = default) ------------------

if (BLOCK === "A" || BLOCK === "all") {
  console.log("========== BLOCK A — fielding policy (draft=default) ==========\n");
  const seeds = Array.from({ length: N }, (_, i) => 200_000 + i);
  const a1 = runArm(`A1 defaultFieldPick n=${N}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(a1);
  const namedArms: [string, string][] = [
    ["A2 affinityFloor", "affinityFloor"],
    ["A3 affinityNaive (secondary)", "affinityNaive"],
    ["A4 chargeFloor", "chargeFloor"],
    ["A5 chainCoefficientFloor", "chainCoefficientFloor"],
  ];
  for (const [label, key] of namedArms) {
    const arm = runArm(`${label} n=${N}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, FIELD_POLICIES[key]);
    printArm(arm, a1);
  }

  console.log("---- robustness repeat on the burst draft (the only draft containing Vex) ----\n");
  const burstSeeds = Array.from({ length: N }, (_, i) => 210_000 + i);
  const burstA1 = runArm(`A1(burst) defaultFieldPick n=${N}`, cfg, BURST_DRAFT, burstSeeds);
  printArm(burstA1);
  for (const [label, key] of [["A2(burst) affinityFloor", "affinityFloor"], ["A4(burst) chargeFloor", "chargeFloor"]] as [string, string][]) {
    const arm = runArm(`${label} n=${N}`, cfg, BURST_DRAFT, burstSeeds, FIELD_POLICIES[key]);
    printArm(arm, burstA1);
  }
}

// --- Block C — draft side, no fielding confound --------------------------
// rosterSize=3 (no bench) so defaultFieldPick trivially fields all three
// every fight — fielding policy is definitionally irrelevant here, isolating
// the draft. Confound acknowledged: swapping a role's member also swaps
// maxHp/damage, not just affinity — Block B, not this block, is what answers
// the headline question in isolation.

if (BLOCK === "C" || BLOCK === "all") {
  console.log("========== BLOCK C — draft-side matched pairs (3-hero squads, no bench) ==========\n");
  const cfg3: RunConfig = { ...cfg, rosterSize: 3 };
  const tanks = ["bracer", "hollow"];
  const damage = ["rook", "vex"];
  const support = ["cairn", "ward"];
  let seedBase = 230_000;
  const arms: Record<string, ArmResult> = {};
  for (const t of tanks) {
    for (const d of damage) {
      for (const s of support) {
        const key = `${t}+${d}+${s}`;
        const squad = [t, d, s];
        const seeds = Array.from({ length: N }, (_, i) => seedBase + i);
        seedBase += N;
        const arm = runArm(`C ${key} n=${N}`, cfg3, squad, seeds);
        arms[key] = arm;
        console.log(
          `  ${key.padEnd(20)} completion=${(arm.report.runCompletionRate * 100).toFixed(1)}%  ` +
            `meanFightsWon=${mean(arm.fightsWon).toFixed(3)}`,
        );
      }
    }
  }
  console.log("\n  ---- 12 matched-pair contrasts (swap one role, hold the other two) ----");
  function contrast(a: string, b: string): void {
    const A = arms[a]!;
    const B = arms[b]!;
    const complDelta = (A.report.runCompletionRate - B.report.runCompletionRate) * 100;
    const mfwDelta = mean(A.fightsWon) - mean(B.fightsWon);
    console.log(
      `  ${a} vs ${b}: completion ${complDelta >= 0 ? "+" : ""}${complDelta.toFixed(1)}pt, ` +
        `meanFightsWon ${mfwDelta >= 0 ? "+" : ""}${mfwDelta.toFixed(3)}`,
    );
  }
  for (const d of damage) {
    for (const s of support) {
      contrast(`hollow+${d}+${s}`, `bracer+${d}+${s}`); // tank swap: 1.3 vs 0.75 affinity
    }
  }
  for (const t of tanks) {
    for (const s of support) {
      contrast(`${t}+rook+${s}`, `${t}+vex+${s}`); // damage swap: 1.4 vs 1.0 affinity
    }
  }
  for (const t of tanks) {
    for (const d of damage) {
      contrast(`${t}+${d}+ward`, `${t}+${d}+cairn`); // support swap: 1.15 vs 0.7 affinity
    }
  }
  console.log("");
}

console.log("affinity sweep complete.");
