/**
 * Answers Tu's report (2026-08-22 — see the "validate the feeling" plan and
 * DECISIONS.md): "the chain mechanic has very little impact on in-game
 * strategic decision — I don't feel it differs much when choosing heroes."
 * Nothing else in the repo separates the three candidate explanations (the
 * lever genuinely doesn't move outcomes / it moves outcomes but is invisible
 * / it moves outcomes but the effect is too small to feel without playing a
 * lot) — this file builds that measurement.
 *
 * This is a REPORT, not a check — same discipline batch/affinity.ts
 * established: it answers an open question rather than pinning a known-good
 * value, so it stays out of `npm run check` (wired as `npm run
 * measure:chain-leverage`). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every prior pass.
 *
 * Seed block 300_000-399_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599 and batch/affinity.ts's 200_000-239_999 —
 * see both files' own headers). Allocation within the block:
 *   Block 1 (ablation ladder):        300_000 + 1500          -> 301_499
 *   Block 2 (profile swap):           310_000 + 1500          -> 311_499
 *   Block 3 (conditional leverage):   320_000 .. 346_399       (11x4 x 600)
 *   Block 4 field-pick arms:          350_000 + 200            -> 350_199
 *   Block 4 draft sweep:              360_000 + 600 x 6 drafts -> 363_599
 *   Preamble self-verification:       390_000 + 25             -> 390_024
 * Block 4's ORACLE ROLLOUT seeds (internal to oracleFieldPick, used only to
 * average many single-fight outcomes per candidate field pick, not a pinned
 * reproducible sequence the way the above are) draw from a disjoint scratch
 * counter starting at 700_000 — noted here, not reserved for anyone else to
 * avoid, since nothing needs to reproduce a specific rollout.
 *
 * Same honest limitation as affinity.ts: runFight/runRun's Rng is shared
 * across whatever they simulate, so two arms that differ in ANY way (roster
 * transform, field pick, encounter) diverge their dice from that point
 * onward. Every block below is a POPULATION comparison (many seeds,
 * aggregated), never a claim about what one specific seed "would have done"
 * under the road not taken.
 */
import { Rng } from "../sim/rng.js";
import {
  DEFAULT_RUN_CONFIG,
  type RunConfig,
  type FightConfig,
  type ChainProfile,
} from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import {
  CHAIN_PROFILES,
  DEFAULT_DRAFT_ROSTER_IDS,
  PLAYER_HERO_POOL,
  makePlayerSide,
} from "../sim/heroes.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { ENCOUNTERS, makeEncounterEnemySide } from "../sim/encounters.js";
import { makePolicy, runRun } from "../sim/run.js";
import {
  defaultFieldPick,
  fieldSquad,
  livingRosterHeroes,
  type FieldPick,
  type FieldPickContext,
  type RosterState,
} from "../sim/roster.js";
import { baseHeroId } from "./heroChain.js";
import { runArm, printArm, type ArmResult } from "./arm.js";

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
// --quick divides every block's n by this factor — for fast local iteration
// on the harness itself, NOT for trusting the printed numbers. Real answers
// need the full n's below.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "5" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

/** Effect sizes captured by whichever blocks actually ran, for Block 5 to
 * convert into "runs needed to notice" — see that block's own header. Module
 * scope (not local to each `if`) so Block 5 can read them regardless of
 * which earlier blocks executed in this same process. */
const effectSizes: { label: string; p1: number; p2: number }[] = [];
const ATTACKER_PROFILE_ENTRIES: [string, ChainProfile][] = [
  ["longFuseFlat (\"long fuse\")", CHAIN_PROFILES.longFuseFlat],
  ["shortFuseSteep (\"short fuse\")", CHAIN_PROFILES.shortFuseSteep],
  ["longFuseSteep (\"back-loaded\")", CHAIN_PROFILES.longFuseSteep],
  ["shortFuseFlat (\"front-loaded\")", CHAIN_PROFILES.shortFuseFlat],
];

function withFightConfig(overrides: Partial<FightConfig>): RunConfig {
  return { ...cfg, fight: { ...cfg.fight, ...overrides } };
}

// --- Roster transforms — harness-side only, never touches sim/heroes.ts.
// Same convention as affinity.ts's scaleAffinity/flattenAffinity: fieldSquad
// copies {...h}, cloneHeroes spreads, applyFightResultToRoster rebuilds from
// the roster hero, so an override here persists for the whole run with no
// leakage back into PLAYER_HERO_POOL. -------------------------------------

function scaleMagnitudeTarget(roster: RosterState, factor: number): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => ({
      ...h,
      chainMagnitudeTarget: (h.chainMagnitudeTarget ?? 0) * factor,
    })),
  };
}

function withProfile(roster: RosterState, profile: ChainProfile): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainProfile: profile })) };
}

function identityProfileTransform(roster: RosterState): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainProfile: h.chainProfile })) };
}

// Scrambled assignment (2b): rotates the shipped attacker/healer profile
// assignment for DEFAULT_DRAFT_ROSTER_IDS (bracer/hollow/rook/cairn/ward —
// the accept-default draft, no Vex) so each hero fires under a shape it was
// NOT authored with, one rotation step within its own kind (attacker shapes
// rotate among attackers, healer shapes among healers) so the arm stays a
// fair "same shapes, different owner" test rather than a magnitude-target
// mismatch.
const SCRAMBLE_PROFILE_BY_ID: Record<string, ChainProfile> = {
  bracer: CHAIN_PROFILES.longFuseSteep, // shipped: rook's
  hollow: CHAIN_PROFILES.longFuseFlat, // shipped: bracer's
  rook: CHAIN_PROFILES.shortFuseSteep, // shipped: hollow's
  cairn: CHAIN_PROFILES.healerHybrid, // shipped: ward's
  ward: CHAIN_PROFILES.healerSteady, // shipped: cairn's
};
function scrambleProfiles(roster: RosterState): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => {
      const profile = SCRAMBLE_PROFILE_BY_ID[baseHeroId(h.id)];
      return profile ? { ...h, chainProfile: profile } : h;
    }),
  };
}

// --- Self-verification preamble — abort the sweep if either fails --------

function verifySelfProfileTransformIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 390_000 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const transformed = runRun(
      cfg,
      new Rng(seed),
      policy,
      seed,
      identityProfileTransform(makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)),
    );
    if (JSON.stringify(base.fights) !== JSON.stringify(transformed.fights)) {
      console.error(`FAIL: a chainProfile transform mapping each hero to its OWN profile diverged from no transform at seed ${seed}`);
      return false;
    }
  }
  console.log("PASS: a chainProfile transform that maps each hero to its own profile is byte-identical to no transform, over 25 seeds");
  return true;
}

let block1BaselineArm: ArmResult | undefined;

function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = block1Seeds();
  block1BaselineArm = runArm(`baseline 1x n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = block1BaselineArm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm (1x magnitude, shipped profiles) reproduces checks/chaindist.ts's pinned ` +
      `default-draft completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

function block1Seeds(): number[] {
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  return Array.from({ length: n }, (_, i) => 300_000 + i);
}

if (!verifySelfProfileTransformIsInert() || !verifyBaselineMatchesChaindistBand()) {
  console.error("\nchain-leverage sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — Ablation ladder: is the chain mechanic load-bearing at all?
// Default draft, default fielding, always-heal, IDENTICAL seeds across arms
// (same convention as affinity.ts Block B).
// =========================================================================

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — ablation ladder (is the mechanic load-bearing?) ==========\n");
  const seeds = block1Seeds();
  const baseline = block1BaselineArm ?? runArm(`baseline 1x n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(baseline, undefined, HEALER_IDS);

  const chainOffCfg = withFightConfig({ chainContinuationScale: 0 });
  const chainOff = runArm(`chain OFF (continuation scale=0) n=${seeds.length}`, chainOffCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(chainOff, baseline, HEALER_IDS);

  const backfireOffCfg = withFightConfig({ backfireChanceBase: 0, backfireChanceAffinitySlope: 0 });
  const backfireOff = runArm(`backfire OFF n=${seeds.length}`, backfireOffCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(backfireOff, baseline, HEALER_IDS);

  const magnitudeArms: Record<number, ArmResult> = {};
  for (const factor of [0.5, 2.0]) {
    const arm = runArm(
      `magnitude ${factor}x n=${seeds.length}`,
      cfg,
      DEFAULT_DRAFT_ROSTER_IDS,
      seeds,
      undefined,
      (r) => scaleMagnitudeTarget(r, factor),
    );
    printArm(arm, baseline, HEALER_IDS);
    magnitudeArms[factor] = arm;
  }

  const offVsOnDelta = Math.abs(baseline.report.runCompletionRate - chainOff.report.runCompletionRate) * 100;
  console.log(
    `  READ: chain OFF vs baseline moves completion by ${offVsOnDelta.toFixed(1)} points. ` +
      `${offVsOnDelta < 5 ? "Below the 5-point bar — the mechanic is NOT load-bearing on this measure." : "Above the 5-point bar — the mechanic IS load-bearing."}\n`,
  );

  effectSizes.push(
    { label: "Block 1: chain OFF vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: chainOff.report.runCompletionRate },
    { label: "Block 1: backfire OFF vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: backfireOff.report.runCompletionRate },
    { label: "Block 1: magnitude 0.5x vs 2x (completion)", p1: magnitudeArms[0.5]!.report.runCompletionRate, p2: magnitudeArms[2.0]!.report.runCompletionRate },
  );
}

// =========================================================================
// BLOCK 2 — Profile swap: the direct test of "does which hero I pick change
// what the chain does for me." Stats held exactly fixed; only chainProfile
// varies. Default draft, IDENTICAL seeds across arms.
// =========================================================================

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — profile swap (shape held fixed per arm, stats untouched) ==========\n");
  console.log(
    "  Caveat: monoculture arms force EVERY hero, healers included, onto one of the FOUR ATTACKER\n" +
      "  shapes — each hero's own chainMagnitudeTarget (76 attacker / 28 healer) is untouched, so the\n" +
      "  analytic equal-EV guarantee (chaindist.ts's Block A) still holds on paper, but an attacker's\n" +
      "  steep escalation on a healer's small healPerBeat can push a late hit into\n" +
      "  chainHealMaxFractionOfTargetMaxHp's clamp, silently under-realizing that EV in the live sim.\n" +
      "  Any spread this block finds may partly reflect that clamp interaction, not shape alone.\n",
  );
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 310_000 + i);

  const shipped = runArm(`shipped assignment n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(shipped, undefined, HEALER_IDS);

  const monocultureArms: ArmResult[] = [];
  for (const [label, profile] of ATTACKER_PROFILE_ENTRIES) {
    const arm = runArm(`monoculture ${label} n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) => withProfile(r, profile));
    printArm(arm, shipped, HEALER_IDS);
    monocultureArms.push(arm);
  }

  const scrambled = runArm(`scrambled assignment n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, scrambleProfiles);
  printArm(scrambled, shipped, HEALER_IDS);

  const monoRates = monocultureArms.map((a) => a.report.runCompletionRate);
  const maxMonoRate = Math.max(...monoRates);
  const minMonoRate = Math.min(...monoRates);
  const monoSpread = (maxMonoRate - minMonoRate) * 100;
  const scrambledDelta = Math.abs(scrambled.report.runCompletionRate - shipped.report.runCompletionRate) * 100;
  console.log(
    `  READ: monoculture spread = ${monoSpread.toFixed(1)} points. scrambled vs shipped = ${scrambledDelta.toFixed(1)} points. ` +
      `${monoSpread < 5 && scrambledDelta < 5 ? "Both flat — chain shape is outcome-neutral on the mean, as designed (equal-EV normalization)." : "A real gap exists — shape carries an unconditional edge the equal-EV math didn't price."}\n`,
  );

  effectSizes.push(
    { label: "Block 2: best vs worst monoculture profile (completion)", p1: maxMonoRate, p2: minMonoRate },
    { label: "Block 2: scrambled vs shipped profile assignment (completion)", p1: scrambled.report.runCompletionRate, p2: shipped.report.runCompletionRate },
  );
}

// =========================================================================
// BLOCK 3 — Conditional leverage: is a shape better against a SPECIFIC
// encounter? Isolated single fights (not full runs — a single fight rarely
// accrues enough charge to fire on its own, per checks/chaindist.ts's top
// docstring), with the firing hero's charge preloaded so its chain fires
// almost immediately. Tank and support start at 0 charge as normal — this
// isolates ONE hero's shape, not "a chain-heavy fight in general."
// =========================================================================

const FIRING_SQUAD = ["bracer", "rook", "cairn"]; // tank / damage (varies) / support
const FIRING_HERO_BASE_ID = "rook";

function preloadedFiringSquad(profile: ChainProfile): SideState {
  const side = makePlayerSide(FIRING_SQUAD);
  return {
    ...side,
    heroes: side.heroes.map((h) =>
      baseHeroId(h.id) === FIRING_HERO_BASE_ID
        ? { ...h, chainProfile: profile, charge: cfg.fight.chargeThreshold - 1 }
        : h,
    ),
  };
}

interface Block3Result {
  matrix: number[][]; // [encounterIdx][profileIdx] win rate
  fireRates: number[][];
}

function runBlock3(cellN: number): Block3Result {
  const matrix: number[][] = [];
  const fireRates: number[][] = [];
  let seedBase = 320_000;
  for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
    const row: number[] = [];
    const fireRow: number[] = [];
    for (const [, profile] of ATTACKER_PROFILE_ENTRIES) {
      let wins = 0;
      let fired = 0;
      for (let i = 0; i < cellN; i++) {
        const seed = seedBase + i;
        const setup: FightSetup = {
          player: preloadedFiringSquad(profile),
          enemy: makeEncounterEnemySide(cfg, 0, ei), // fightIndex=0: no difficulty ramp confound across rows
        };
        const result = runFight(setup, cfg.fight, new Rng(seed), seed);
        if (result.outcome === "win") wins++;
        if (result.ignited) fired++;
      }
      seedBase += cellN;
      row.push(wins / cellN);
      fireRow.push(fired / cellN);
    }
    matrix.push(row);
    fireRates.push(fireRow);
  }
  return { matrix, fireRates };
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — conditional leverage: encounter x shape win-rate matrix ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  console.log(
    `  Firing hero: Rook (damage), preloaded to charge=chargeThreshold-1 so its chain fires almost\n` +
      `  immediately; Bracer/Cairn start at 0 charge as normal. Isolates ONE shape's effect on ONE\n` +
      `  fight, not "a chain-heavy fight in general." n=${cellN}/cell, seeds from 320_000.\n`,
  );

  const { matrix, fireRates } = runBlock3(cellN);

  const header = "  encounter".padEnd(16) + ATTACKER_PROFILE_ENTRIES.map(([l]) => l.split(" ")[0]!.padStart(16)).join("") + "   spread";
  console.log(header);
  let worstFireRate = 1;
  let maxSpread = 0;
  let maxSpreadEncounter = "";
  for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
    const row = matrix[ei]!;
    const spread = (Math.max(...row) - Math.min(...row)) * 100;
    if (spread > maxSpread) {
      maxSpread = spread;
      maxSpreadEncounter = ENCOUNTERS[ei]!.name;
    }
    for (const f of fireRates[ei]!) worstFireRate = Math.min(worstFireRate, f);
    console.log(
      `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
        row.map((w) => `${(w * 100).toFixed(1)}%`.padStart(16)).join("") +
        `   ${spread.toFixed(1)}pt`,
    );
  }
  console.log("");
  console.log(
    `  fire-rate sanity: lowest cell fired ${(worstFireRate * 100).toFixed(1)}% of the time (want >=95% — a matrix\n` +
      `  built from fights where nothing fired would be flat for the wrong reason).`,
  );
  console.log(
    `  READ: largest row spread is ${maxSpread.toFixed(1)} points, at "${maxSpreadEncounter}". ` +
      `${maxSpread < 5 ? "Flat everywhere — no per-encounter strategy to teach; the lever does not exist." : `Real spread at "${maxSpreadEncounter}" — that's the cell worth playing next (Phase 2 gate).`}\n`,
  );

  let bestRow = matrix[0]!;
  for (const row of matrix) {
    if (Math.max(...row) - Math.min(...row) > Math.max(...bestRow) - Math.min(...bestRow)) bestRow = row;
  }
  effectSizes.push({
    label: `Block 3: best vs worst shape at "${maxSpreadEncounter}" (win rate)`,
    p1: Math.max(...bestRow),
    p2: Math.min(...bestRow),
  });
}

// =========================================================================
// BLOCK 4 — Decision headroom: oracle vs default vs pessimal field pick, and
// a re-report of the draft-side headroom checks/chaindist.ts already
// measures, so every lever's ceiling sits in one place.
// =========================================================================

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  function helper(start: number, combo: T[]): void {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]!);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

/** A field-pick "strategist," not a clairvoyant: at each fight, evaluates
 * every C(roster,fieldSize) combination by `rollouts` independent single-
 * fight simulations (a disjoint scratch seed range, not the run's own rng —
 * FieldPick has no rng parameter, so this can't shift the real run's dice by
 * construction) and picks the combo with the best (or worst) mean win rate.
 * Measures the headroom available to a perfect FIELDING STRATEGY, not
 * perfect prescience of that run's actual dice. */
function oracleFieldPick(direction: "best" | "worst", rollouts: number): FieldPick {
  let scratchSeed = 700_000;
  return (roster: RosterState, fieldSize: number, ctx: FieldPickContext): string[] => {
    const living = livingRosterHeroes(roster);
    if (living.length <= fieldSize) return defaultFieldPick(roster, fieldSize);
    const combos = combinations(living.map((h) => h.id), fieldSize);
    let bestIds = combos[0]!;
    let bestScore = direction === "best" ? -Infinity : Infinity;
    for (const ids of combos) {
      const fielded = fieldSquad(roster, ids);
      const enemy = makeEncounterEnemySide(cfg, ctx.fightIndex, ctx.encounterIndex);
      let wins = 0;
      for (let r = 0; r < rollouts; r++) {
        const seed = scratchSeed++;
        const result = runFight({ player: fielded, enemy }, cfg.fight, new Rng(seed), seed);
        if (result.outcome === "win") wins++;
      }
      const score = wins / rollouts;
      const better = direction === "best" ? score > bestScore : score < bestScore;
      if (better) {
        bestScore = score;
        bestIds = ids;
      }
    }
    return bestIds;
  };
}

function block4FieldPickHeadroom(n: number): void {
  console.log("---- L2/L3 field-pick headroom: oracle (k=3 rollouts/combo) vs default vs pessimal ----\n");
  console.log(
    "  Caveat: the oracle's rollouts use their own scratch Rng (disjoint from the run's) — it measures\n" +
      "  the headroom of a perfect fielding STRATEGY across the population, not perfect prescience of any\n" +
      "  one run's real dice. It ALSO has no role floor (unlike defaultFieldPick) — it searches every\n" +
      "  living C(roster,3) combo by raw this-fight win probability from k=3 rollouts, which is both a\n" +
      "  noisy estimate AND myopic (blind to which body losing this fight costs the rest of the run). If\n" +
      "  oracle-best scores BELOW default, that is itself a finding, not a bug: it means naive per-fight\n" +
      "  win-maximization, ignoring cross-fight attrition and role balance, is not strictly better than\n" +
      "  the shipped heuristic.\n",
  );
  const seeds = Array.from({ length: n }, (_, i) => 350_000 + i);
  const def = runArm(`L2/L3 default field pick n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(def);
  const best = runArm(`L2/L3 oracle-best field pick n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, oracleFieldPick("best", 3));
  printArm(best, def);
  const worst = runArm(`L2/L3 oracle-worst field pick n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, oracleFieldPick("worst", 3));
  printArm(worst, def);

  const headroom = (best.report.runCompletionRate - worst.report.runCompletionRate) * 100;
  const noiseSD = Math.sqrt((def.report.runCompletionRate * (1 - def.report.runCompletionRate)) / n) * 100;
  console.log(
    `  READ: oracle-best minus oracle-worst = ${headroom.toFixed(1)} points of completion. Seed-to-seed\n` +
      `  binomial noise SD at n=${n} is ~${noiseSD.toFixed(1)} points. ` +
      `${headroom < 3 * noiseSD ? "Headroom barely clears the noise floor — no UI can make this feel meaningful until the numbers move." : "Headroom clears the noise floor — a real ceiling exists for a field-pick strategy to reach for."}\n`,
  );

  effectSizes.push(
    { label: "Block 4: L2/L3 oracle-best vs default field pick (completion)", p1: best.report.runCompletionRate, p2: def.report.runCompletionRate },
    { label: "Block 4: L2/L3 oracle-best vs oracle-worst field pick (completion)", p1: best.report.runCompletionRate, p2: worst.report.runCompletionRate },
  );
}

function block4DraftHeadroom(n: number): void {
  console.log("---- L1 draft headroom (re-reporting checks/chaindist.ts's 6-draft sweep) ----\n");
  const policy = makePolicy("always-heal", cfg);
  let seedBase = 360_000;
  let maxRate = 0;
  let maxDraft = "";
  let minRate = 1;
  let minDraft = "";
  for (const leaveOut of PLAYER_HERO_POOL.map((h) => h.id)) {
    const draft = PLAYER_HERO_POOL.map((h) => h.id).filter((id) => id !== leaveOut);
    let completed = 0;
    for (let i = 0; i < n; i++) {
      const seed = seedBase + i;
      const result = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(draft));
      if (result.outcome === "complete") completed++;
    }
    seedBase += n;
    const rate = completed / n;
    console.log(`  leave-out=${leaveOut.padEnd(8)} completion=${(rate * 100).toFixed(1)}%`);
    if (rate > maxRate) {
      maxRate = rate;
      maxDraft = leaveOut;
    }
    if (rate < minRate) {
      minRate = rate;
      minDraft = leaveOut;
    }
  }
  console.log(
    `\n  READ: max (leave-out=${maxDraft}) minus min (leave-out=${minDraft}) = ${((maxRate - minRate) * 100).toFixed(1)} points ` +
      `— includes the known extreme-risk single-tank drafts (see checks/chaindist.ts).\n`,
  );

  effectSizes.push({ label: `Block 4: L1 draft max (${maxDraft}) vs min (${minDraft}) (completion)`, p1: maxRate, p2: minRate });
}

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — decision headroom (oracle vs default vs pessimal, per lever) ==========\n");
  const n4 = Math.max(20, Math.round(200 / QUICK_DIVISOR));
  block4FieldPickHeadroom(n4);
  const nDraft = Math.max(50, Math.round(600 / QUICK_DIVISOR));
  block4DraftHeadroom(nDraft);
}

// =========================================================================
// BLOCK 5 — Perceptibility: how many runs would a human need to reliably
// notice each measured effect? Pure arithmetic on Blocks 1-4's own numbers;
// no new simulation. Two-proportion power calc (alpha=0.05 two-sided, 80%
// power) — a conservative TWO-SAMPLE estimate; the real game's paired
// same-seed comparisons (McNemar, printed above) need somewhat fewer, but
// this stays a defensible upper bound without assuming a specific pairing.
// =========================================================================

const Z_ALPHA_2 = 1.959964; // alpha=0.05, two-sided
const Z_BETA = 0.8416212; // 80% power

function runsToDetect(p1: number, p2: number): number {
  const diff = p1 - p2;
  if (Math.abs(diff) < 1e-9) return Infinity;
  const variance = p1 * (1 - p1) + p2 * (1 - p2);
  return Math.ceil(((Z_ALPHA_2 + Z_BETA) ** 2 * variance) / (diff * diff));
}

// Assumption, stated plainly: a played run (5 fights, watched, plus pick
// screens) takes roughly 4 minutes. This is a strawman for converting "runs
// needed" into "hours needed" — see STATE.md/ATTRIBUTION_TEST.md for the
// actual per-fight pacing this is estimating from.
const ASSUMED_MINUTES_PER_RUN = 4;

function printDetectability(label: string, p1: number, p2: number): void {
  const n = runsToDetect(p1, p2);
  const hours = (n * ASSUMED_MINUTES_PER_RUN) / 60;
  const nStr = Number.isFinite(n) ? n.toLocaleString() : "infinite (no measured difference)";
  const hoursStr = Number.isFinite(n) ? `~${hours < 1 ? hours.toFixed(2) : Math.round(hours).toLocaleString()}h` : "n/a";
  console.log(
    `  ${label}: ${(Math.abs(p1 - p2) * 100).toFixed(1)}pt delta -> ${nStr} runs to detect at 80% power -> ${hoursStr} ` +
      `(at ${ASSUMED_MINUTES_PER_RUN} min/run)`,
  );
}

if (BLOCK === "5" || BLOCK === "all") {
  console.log("========== BLOCK 5 — perceptibility: runs needed to notice each effect ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so Blocks 1-4's effect sizes are available)\n");
  } else {
    console.log(`  Two-proportion power estimate (alpha=0.05 two-sided, 80% power), converted to hours at\n`);
    console.log(`  an assumed ${ASSUMED_MINUTES_PER_RUN} min/run. This is what answers "or have I not played enough?" directly.\n`);
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("chain-leverage sweep complete.");
