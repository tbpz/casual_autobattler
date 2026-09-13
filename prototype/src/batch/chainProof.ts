/**
 * Answers three claims STATE.md currently rests on "played-verified" (Tu
 * watched them happen, rather than measuring them) — Tu asked for statistical
 * proof of all three, against pass/fail bars written down before the run:
 *
 *   1. Chains change fight outcomes.
 *   2. "Chain length is the loudest dice" — the chain causes more
 *      fight-to-fight spread than per-hit damage variance, the backfire
 *      coin, or the encounter draw.
 *   3. "A backfire can create a losing position outright."
 *
 * This is a DIFFERENT question from the four prior batch/*Verdict.ts passes
 * (affinity, chainLeverage's shape blocks, shapeVerdict, targetingVerdict,
 * backfireRisk) — those all asked "is one hero's chain worth picking over
 * another's," and all four failed. This asks "does the mechanic do anything
 * at all." A large effect here is expected, not suspicious.
 *
 * Claim 1's only prior measurement (chainLeverage.ts Block 1, 2026-08-23:
 * chains off crater run completion 22.1% -> 0.0%) is STALE — CLOCK/WOUNDED
 * were removed 2026-08-27, the chain lockout was fixed, overkill spill became
 * a switch, and chain targeting Phase 1 landed. Block 1 below re-measures it.
 * Claims 2 and 3 have never been measured before this file.
 *
 * This is a REPORT, not a check — same discipline every prior batch/*Verdict
 * file established: it answers an open question rather than pinning a
 * known-good value, so it stays out of `npm run check` (wired as
 * `npm run measure:chain-proof`). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every prior pass.
 *
 * Seed block 900_000-999_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999,
 * batch/chainLeverage.ts's 300_000-399_999 plus its own 700_000+ scratch
 * counter, the retired batch/enrageLeverage.ts's 400_000-419_999,
 * batch/shapeVerdict.ts's 500_000-599_999, batch/targetingVerdict.ts's
 * 600_000-699_999, and batch/backfireRisk.ts's 800_000-899_999). Allocation
 * within the block:
 *   Preamble (identity/forceBackfire/dial):    990_000 + 25*2 + 300*2 -> 990_649
 *   Preamble (baseline band, FIXED n, never
 *     divided by QUICK_DIVISOR — see that
 *     check's own docstring):                  991_000 + 1500        -> 992_499
 *   Block 1 (claim 1, full runs):     900_000 + 1500              -> 901_499
 *   Block 2 (variance decomposition): 910_000 .. 936_399           (11 x 4 x 600)
 *   Block 3 per-encounter:            940_000 .. 966_399           (11 x 2 x 2 x 600)
 *   Block 3 full runs:                970_000 + 1500 x 2 arms      -> 972_999
 * Free: 903_000-909_999, 937_000-939_999, 967_000-969_999, 973_000-989_999,
 * 992_500-999_999.
 *
 * Same honest limitation as every other report in this directory: runFight/
 * runRun share one Rng across whatever they simulate, so two arms differing
 * in ANY way diverge their dice from that point onward. Every comparison
 * below is a POPULATION comparison over identical seed sequences (or, for
 * Block 2's between-deck read, identical seeds grouped after the fact), never
 * a claim about what one specific seed "would have done" under the road not
 * taken.
 *
 * Known weakness, stated here rather than discovered later: Block 2's
 * chain-length freeze holds the ANALYTIC expected chain value constant (the
 * equal-EV machinery, chainMagnitudeScaleAbsolute, rescales magnitude
 * automatically once continuation changes). shapeVerdict.ts measured the
 * live fight paying out only ~50% of analytic expected value, shape-
 * dependently — so analytic mean-preservation is not realized
 * mean-preservation. That is exactly what this file's mean-shift honesty
 * guard exists to catch: any frozen arm whose own mean completion moves more
 * than a few points is reported INCONCLUSIVE, not read as a pure variance
 * result.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, chainContinuationChance, type FightConfig, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { DEFAULT_DRAFT_ROSTER_IDS, PLAYER_HERO_POOL, makePlayerSide } from "../sim/heroes.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { ENCOUNTERS, encounterOrderFor, makeEncounterEnemySide } from "../sim/encounters.js";
import { makePolicy, runRun } from "../sim/run.js";
import type { RosterState } from "../sim/roster.js";
import { baseHeroId } from "./heroChain.js";
import { runArm, printArm, printDetectability, mean, stdev, type ArmResult } from "./arm.js";
import { ChainOutcomeAggregator, chainOutcomeStats } from "./chainOutcomes.js";

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
// --quick divides every block's n — for fast local iteration on the harness
// itself, NOT for trusting the printed numbers. shapeVerdict.ts recorded a
// case where n=75 pointed the opposite way to the n=1500 truth; this rig has
// no reason to be more forgiving.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

function withFightConfig(overrides: Partial<FightConfig>): RunConfig {
  return { ...cfg, fight: { ...cfg.fight, ...overrides } };
}

/** Effect sizes captured by whichever blocks ran, for Block 4 to convert into
 * "runs needed to notice" — module scope so Block 4 can read them regardless
 * of which earlier blocks executed in this same process. */
const effectSizes: { label: string; p1: number; p2: number }[] = [];

// --- Pre-registered bars, written down before any block below runs --------

/** Claim 1: chains off must move run completion by at least this many
 * points to count as load-bearing — chainLeverage.ts Block 1's original bar,
 * kept identical so the stale 2026-08-23 number and this re-measurement sit
 * on one scale. */
const CLAIM1_COMPLETION_BAR_PT = 5;
/** Claim 1 secondary: fight 5 (Champion, the finale) win rate must drop by
 * at least this many points with chains off. */
const CLAIM1_FIGHT5_BAR_PT = 10;

/** Claim 2: the chain-frozen arm's variance drop must beat the next-largest
 * source's drop by at least this multiple to count as "the loudest dice" —
 * a clear ranking, not a photo finish. No precedent exists for this number;
 * it is this file's own strawman. */
const CLAIM2_LOUDEST_MULTIPLE = 1.5;
/** Claim 2 honesty guard: a frozen arm whose OWN mean completion moves more
 * than this many points cannot have its variance drop read as a clean
 * result — a mean shift compresses spread mechanically (a run pinned near 0
 * or 5 fights won has less room to vary), so that arm is reported
 * INCONCLUSIVE instead of PASS/FAIL. */
const CLAIM2_MEAN_SHIFT_GUARD_PT = 5;

/** Claim 3: forced-backfire vs forced-payoff, per encounter — targetingVerdict.ts's
 * bars, verbatim, same eligibility split (win-rate points where the fight is
 * movable, HP-left points where fights 1-4 pin near 100% and literally
 * cannot move 15 points). */
const CLAIM3_PER_ENCOUNTER_WINRATE_BAR_PT = 15;
const CLAIM3_PER_ENCOUNTER_HP_BAR_PT = 10;
const CLAIM3_MIN_ENCOUNTERS_CLEARING_BAR = 3;
/** Claim 3, run level. */
const CLAIM3_COMPLETION_BAR_PT = 5;

// --- Self-verification preamble — abort the sweep if any fails ------------

function identityTransform(roster: RosterState): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainEffect: h.chainEffect })) };
}

function verifyIdentityTransformIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 990_000 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const transformed = runRun(cfg, new Rng(seed), policy, seed, identityTransform(makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)));
    if (JSON.stringify(base.fights) !== JSON.stringify(transformed.fights)) {
      console.error(`FAIL: an identity chainEffect transform diverged from no transform at seed ${seed}`);
      return false;
    }
  }
  console.log("PASS: an identity chainEffect transform is byte-identical to no transform, over 25 seeds");
  return true;
}

/** cfg.forceBackfire unset must reproduce today's build exactly — the
 * byte-identical A/B this field's docstring (config.ts) promises. */
function verifyForceBackfireUnsetIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  const forcedUndefinedCfg: RunConfig = { ...cfg, fight: { ...cfg.fight, forceBackfire: undefined } };
  for (let i = 0; i < 25; i++) {
    const seed = 990_100 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const explicit = runRun(forcedUndefinedCfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    if (JSON.stringify(base.fights) !== JSON.stringify(explicit.fights)) {
      console.error(`FAIL: forceBackfire: undefined diverged from no field at all, seed ${seed}`);
      return false;
    }
  }
  console.log("PASS: forceBackfire: undefined is byte-identical to the field not existing, over 25 seeds");
  return true;
}

/** The dial actually moves the backfire rate to ~100%/~0% — without this, a
 * null result in Block 3 could be "nothing happened" in disguise. Fixed
 * n=300, NOT quick-divided, same convention as backfireRisk.ts's own
 * dial-is-live check. */
function verifyForceBackfireDialIsLive(): boolean {
  const n = 300;
  let ok = true;
  for (const forced of ["always", "never"] as const) {
    const forcedCfg = withFightConfig({ forceBackfire: forced });
    const agg = new ChainOutcomeAggregator(forcedCfg);
    for (let i = 0; i < n; i++) {
      const seed = 990_200 + (forced === "always" ? 0 : n) + i;
      const side = makePlayerSide(["bracer", "rook", "cairn"]);
      const player: SideState = {
        ...side,
        heroes: side.heroes.map((h) => (baseHeroId(h.id) === "rook" ? { ...h, charge: forcedCfg.fight.chargeThreshold - 1 } : h)),
      };
      const result = runFight({ player, enemy: makeEncounterEnemySide(forcedCfg, 0, 0) }, forcedCfg.fight, new Rng(seed), seed);
      agg.add(result);
    }
    const rows = agg.finalize().rows.filter((r) => !r.healer);
    const measured = rows.reduce((s, r) => s + r.backfires, 0) / Math.max(1, rows.reduce((s, r) => s + r.chains, 0));
    const expected = forced === "always" ? 1 : 0;
    const withinTol = Math.abs(measured - expected) <= 0.03;
    if (!withinTol) ok = false;
    console.log(`  forceBackfire="${forced}": measured backfire rate ${(measured * 100).toFixed(1)}% ${withinTol ? "OK" : "OUT OF TOLERANCE"}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}: forceBackfire dial moves the measured rate to ~100%/~0% within 3pt`);
  return ok;
}

let block1BaselineArm: ArmResult | undefined;

/** Fixed at n=1500, NOT divided by QUICK_DIVISOR — same convention as
 * verifyForceBackfireDialIsLive's fixed n=300. A --quick preamble check must
 * never be able to fail on ordinary sampling noise; at n=75 this band check
 * has been observed to land outside [15%,40%] by chance alone, which would
 * abort the ENTIRE --quick smoke test rather than validate it. Deliberately
 * does not feed block1BaselineArm's cache (Block 1 below runs its own arm at
 * block1Seeds()'s — possibly quick-divided — n): this check exists only to
 * gate the sweep, not to save Block 1 a re-simulation. */
function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = Array.from({ length: 1500 }, (_, i) => 991_000 + i);
  const arm = runArm(`preamble baseline n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = arm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm reproduces checks/chaindist.ts's pinned default-draft completion band ` +
      `[15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

function block1Seeds(): number[] {
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  return Array.from({ length: n }, (_, i) => 900_000 + i);
}

const preambleOk =
  verifyIdentityTransformIsInert() &&
  verifyForceBackfireUnsetIsInert() &&
  verifyForceBackfireDialIsLive() &&
  verifyBaselineMatchesChaindistBand();
if (!preambleOk) {
  console.error("\nchain-proof sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — CLAIM 1: chains off vs baseline, full runs, identical seeds.
// Re-measures chainLeverage.ts's stale 2026-08-23 result (chains off:
// 22.1% -> 0.0%) against a fresh build.
// =========================================================================

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — CLAIM 1: does the chain mechanic change fight outcomes at all? ==========\n");
  const seeds = block1Seeds();
  const baseline = runArm(`baseline n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  block1BaselineArm = baseline;
  printArm(baseline, undefined, HEALER_IDS);

  const chainOffCfg = withFightConfig({ chainContinuationScale: 0 });
  const chainOff = runArm(`chain OFF (continuation scale=0) n=${seeds.length}`, chainOffCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(chainOff, baseline, HEALER_IDS);

  const completionDeltaPt = (baseline.report.runCompletionRate - chainOff.report.runCompletionRate) * 100;
  const fight5DeltaPt = (baseline.report.winRateByFightIndex[4]! - chainOff.report.winRateByFightIndex[4]!) * 100;
  const passes = completionDeltaPt >= CLAIM1_COMPLETION_BAR_PT;
  console.log(
    `  VERDICT (bar: >=${CLAIM1_COMPLETION_BAR_PT}pt completion): chain OFF moves completion by ${completionDeltaPt.toFixed(1)}pt, ` +
      `fight-5 win rate by ${fight5DeltaPt.toFixed(1)}pt (secondary bar >=${CLAIM1_FIGHT5_BAR_PT}pt) -> ` +
      `${passes ? "PASS — the mechanic IS load-bearing." : "FAIL — below the bar."}\n`,
  );

  effectSizes.push(
    { label: "Claim 1: chain OFF vs baseline (completion)", p1: baseline.report.runCompletionRate, p2: chainOff.report.runCompletionRate },
    { label: "Claim 1: chain OFF vs baseline (fight 5 win rate)", p1: baseline.report.winRateByFightIndex[4]!, p2: chainOff.report.winRateByFightIndex[4]! },
  );
}

// =========================================================================
// BLOCK 2 — CLAIM 2: variance decomposition. Isolated single fights (not full
// runs — a run averages five fights' worth of spread away), fixed squad
// bracer/rook/cairn, firing hero (Rook) preloaded to chargeThreshold-1 so its
// chain reliably fires, fightIndex=0 so no difficulty ramp confounds cells,
// n=600/cell across all 11 encounters — the established cell shape from
// targetingVerdict.ts/backfireRisk.ts. Primary metric: standard deviation of
// player HP-fraction-remaining, continuous and free of win rate's
// floor/ceiling compression.
//
// Three dice are frozen by config/roster override; the fourth (encounter
// draw) is read observationally off Block 1's own baseline runs, grouped by
// the deck encounterOrderFor(seed, 5) handed them — no sim change needed,
// since encounterOrderFor already draws from its own separate RNG stream.
// =========================================================================

const FIRING_SQUAD = ["bracer", "rook", "cairn"];
const FIRING_HERO_BASE_ID = "rook";

/** E[chain length] under cfg's own shared continuation table — every hero
 * reads the same table since the 2026-09-13 rebuild (no more per-hero
 * profile), so there is exactly one mean length to compute, not one per
 * hero. Same reach-probability-sum-equals-mean trick the old per-profile
 * version used, just off cfg.chainChanceByHitsSoFar directly via
 * chainContinuationChance. */
function meanChainLength(fightCfg: FightConfig): number {
  let reach = 1;
  let sum = 0;
  for (let n = 1; n <= fightCfg.chainMaxHits; n++) {
    reach *= chainContinuationChance(fightCfg, n - 1);
    sum += reach; // P(length >= n) summed over n = E[length]
  }
  return sum;
}

/** Freezes chain LENGTH to a deterministic value (cfg's own rounded analytic
 * mean length) at the CONFIG level — chainChanceByHitsSoFar: [1] makes every
 * continuation roll succeed (prdLookup clamps to the last entry), so the
 * chain runs to exactly chainMaxHits every time and stops there via fight.ts's
 * own cap check, never a further roll. No roster transform needed (2026-09-13
 * rebuild): length is a shared cfg property now, not a per-hero one. */
function freezeChainLengthCfg(fightCfg: RunConfig): RunConfig {
  const fixedLength = Math.max(1, Math.round(meanChainLength(fightCfg.fight)));
  return { ...fightCfg, fight: { ...fightCfg.fight, chainChanceByHitsSoFar: [1], chainMaxHits: fixedLength } };
}

interface DiceCell {
  hpFracs: number[];
}

function runDiceCell(fightCfg: RunConfig, transform: ((r: RosterState) => RosterState) | undefined, encounterIdx: number, seedBase: number, n: number): DiceCell {
  const hpFracs: number[] = [];
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    let side = makePlayerSide(FIRING_SQUAD);
    if (transform) side = transform(side) as SideState;
    const player: SideState = {
      ...side,
      heroes: side.heroes.map((h) => (baseHeroId(h.id) === FIRING_HERO_BASE_ID ? { ...h, charge: fightCfg.fight.chargeThreshold - 1 } : h)),
    };
    const setup: FightSetup = { player, enemy: makeEncounterEnemySide(fightCfg, 0, encounterIdx) };
    const result = runFight(setup, fightCfg.fight, new Rng(seed), seed);
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    hpFracs.push(maxHp > 0 ? hp / maxHp : 0);
  }
  return { hpFracs };
}

interface DiceArm {
  label: string;
  allHpFracs: number[];
  meanCompletionDeltaPt: number;
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — CLAIM 2: is chain length the loudest dice? (variance decomposition) ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));

  function runDiceArm(label: string, fightCfg: RunConfig, transform: ((r: RosterState) => RosterState) | undefined, seedBase: number): DiceArm {
    const allHpFracs: number[] = [];
    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const cell = runDiceCell(fightCfg, transform, ei, seedBase + ei * cellN, cellN);
      allHpFracs.push(...cell.hpFracs);
    }
    return { label, allHpFracs, meanCompletionDeltaPt: 0 };
  }

  const baselineDice = runDiceArm("baseline (nothing frozen)", cfg, undefined, 910_000);
  const baselineSpread = stdev(baselineDice.allHpFracs);
  console.log(`  baseline: stdev(hp-frac remaining) = ${baselineSpread.toFixed(4)}, mean = ${mean(baselineDice.allHpFracs).toFixed(4)}\n`);

  const arms: { key: string; label: string; fightCfg: RunConfig; transform?: (r: RosterState) => RosterState; seedBase: number }[] = [
    { key: "length", label: "chain LENGTH frozen (deterministic mean length)", fightCfg: freezeChainLengthCfg(cfg), seedBase: 918_000 },
    { key: "backfire", label: "backfire coin frozen (chance=0)", fightCfg: withFightConfig({ backfireChanceBase: 0, backfireChanceAffinitySlope: 0 }), seedBase: 926_000 },
    { key: "damage", label: "per-hit damage variance frozen (damageVariance=0)", fightCfg: withFightConfig({ damageVariance: 0 }), seedBase: 934_000 },
  ];

  const results: { key: string; label: string; spread: number; meanShiftPt: number; drop: number }[] = [];
  for (const arm of arms) {
    const measured = runDiceArm(arm.label, arm.fightCfg, arm.transform, arm.seedBase);
    const spread = stdev(measured.allHpFracs);
    const meanShiftPt = (mean(measured.allHpFracs) - mean(baselineDice.allHpFracs)) * 100;
    const drop = baselineSpread - spread;
    const inconclusive = Math.abs(meanShiftPt) > CLAIM2_MEAN_SHIFT_GUARD_PT;
    console.log(
      `  ${arm.label}\n    stdev = ${spread.toFixed(4)}  drop vs baseline = ${drop.toFixed(4)}  ` +
        `mean HP-frac shift = ${meanShiftPt >= 0 ? "+" : ""}${meanShiftPt.toFixed(1)}pt ` +
        `${inconclusive ? `(INCONCLUSIVE — exceeds the ${CLAIM2_MEAN_SHIFT_GUARD_PT}pt honesty guard, a mean shift can compress spread mechanically)` : "(clean read)"}\n`,
    );
    results.push({ key: arm.key, label: arm.label, spread, meanShiftPt, drop: inconclusive ? Number.NaN : drop });
  }

  // Encounter draw: read observationally off Block 1's own baseline runs (no
  // new simulation). Grouped by the FINALE draw only (Champion vs Vanguard —
  // encounterOrderFor's own tier math: 2 finale encounters, 1 drawn per run),
  // not the full 5-encounter deck. The full deck has 3P2 x 6P2 x 2 = 360
  // distinct combinations — with 1500 seeds that is ~4 seeds/deck, too sparse
  // for a between/within split. The finale split is exactly 2 buckets, well
  // powered at this n, and is the deck slot every prior chain-shape/targeting
  // pass already found concentrates most of the game's swing (see
  // CHAIN_SHAPE_LEVERAGE_FINDINGS.md's Block 1/3).
  console.log("  -- encounter draw (measured observationally off Block 1's baseline runs, grouped by finale drawn) --");
  if (block1BaselineArm) {
    const seeds = block1Seeds();
    const byFinale = new Map<string, number[]>();
    seeds.forEach((seed, i) => {
      const deck = encounterOrderFor(seed, cfg.fightsPerRun);
      const finaleName = ENCOUNTERS[deck[deck.length - 1]!]!.name;
      if (!byFinale.has(finaleName)) byFinale.set(finaleName, []);
      byFinale.get(finaleName)!.push(block1BaselineArm!.fightsWon[i]!);
    });
    const bucketMeans = [...byFinale.values()].map((xs) => mean(xs));
    const betweenFinaleSpread = bucketMeans.length > 1 ? stdev(bucketMeans) : 0;
    const withinFinaleSpread = mean([...byFinale.values()].map((xs) => stdev(xs)));
    for (const [name, xs] of byFinale) console.log(`    ${name.padEnd(10)} n=${xs.length}  mean fightsWon=${mean(xs).toFixed(3)}  stdev=${stdev(xs).toFixed(3)}`);
    console.log(
      `    between-finale stdev of mean fightsWon = ${betweenFinaleSpread.toFixed(4)}, ` +
        `mean within-finale stdev of fightsWon = ${withinFinaleSpread.toFixed(4)}.\n` +
        `    (fightsWon-based, not directly comparable to the hp-frac stdevs above — different unit, reported ` +
        `alongside rather than ranked against them numerically. Also narrower than the other three dice: it only\n` +
        `    isolates the finale-slot draw, not every encounter in the deck.)\n`,
    );
  } else {
    console.log("    (Block 1 did not run this invocation — re-run with --block all to get this reading)\n");
  }

  const valid = results.filter((r) => !Number.isNaN(r.drop));
  const ranked = [...valid].sort((a, b) => b.drop - a.drop);
  console.log("  -- ranking by variance drop (clean reads only) --");
  for (const r of ranked) console.log(`    ${r.key.padEnd(10)} drop=${r.drop.toFixed(4)}`);
  if (ranked.length >= 2) {
    const [loudest, second] = ranked;
    const multiple = second!.drop > 0 ? loudest!.drop / second!.drop : Number.POSITIVE_INFINITY;
    const isChain = loudest!.key === "length";
    const passes = isChain && multiple >= CLAIM2_LOUDEST_MULTIPLE;
    console.log(
      `\n  VERDICT (bar: chain length's drop >= ${CLAIM2_LOUDEST_MULTIPLE}x the next-largest clean drop): ` +
        `loudest = "${loudest!.key}" at ${multiple === Number.POSITIVE_INFINITY ? "inf" : multiple.toFixed(2)}x the runner-up -> ` +
        `${passes ? "PASS — chain length is the loudest dice." : isChain ? "FAIL — chain length is loudest but not by enough." : "FAIL — chain length is not even the loudest."}\n`,
    );
  } else {
    console.log("\n  VERDICT: fewer than two clean reads survived the honesty guard — cannot rank. See INCONCLUSIVE arms above.\n");
  }
}

// =========================================================================
// BLOCK 3 — CLAIM 3: forced backfire vs forced payoff. Same firing squad and
// preload as Block 2, both fire timings from targetingVerdict.ts/
// backfireRisk.ts's convention (immediate at chargeThreshold-1, mid-fight at
// chargeThreshold*0.6), n=600/cell across all 11 encounters, plus a full-run
// arm and an explicit flip count (payoff-forced wins, backfire-forced loses,
// same pair) — the literal reading of "a backfire can create a losing
// position outright."
// =========================================================================

const FIRE_TIMINGS = [
  { id: "immediate", label: "fires at t~0", startCharge: cfg.fight.chargeThreshold - 1 },
  { id: "midFight", label: "fires mid-fight", startCharge: Math.round(cfg.fight.chargeThreshold * 0.6) },
];

interface Block3Cell {
  winRate: number;
  meanHpFrac: number;
}

function runBlock3Cell(fightCfg: RunConfig, encounterIdx: number, startCharge: number, seedBase: number, n: number): Block3Cell {
  let wins = 0;
  let sumHpFrac = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const side = makePlayerSide(FIRING_SQUAD);
    const player: SideState = {
      ...side,
      heroes: side.heroes.map((h) => (baseHeroId(h.id) === FIRING_HERO_BASE_ID ? { ...h, charge: startCharge } : h)),
    };
    const setup: FightSetup = { player, enemy: makeEncounterEnemySide(fightCfg, 0, encounterIdx) };
    const result = runFight(setup, fightCfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    sumHpFrac += maxHp > 0 ? hp / maxHp : 0;
  }
  return { winRate: wins / n, meanHpFrac: sumHpFrac / n };
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — CLAIM 3: can a backfire create a losing position outright? ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  const neverCfg = withFightConfig({ forceBackfire: "never" });
  const alwaysCfg = withFightConfig({ forceBackfire: "always" });

  let encountersClearingBar = 0;
  for (const timing of FIRE_TIMINGS) {
    console.log(`  -- fire timing: ${timing.label} (start charge ${timing.startCharge}/${cfg.fight.chargeThreshold}) --\n`);
    console.log("  encounter".padEnd(16) + "payoff".padStart(9) + "backfire".padStart(10) + "  eligible  gate");
    let seedBase = 940_000 + (timing.id === "midFight" ? 13_200 : 0);
    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const payoffCell = runBlock3Cell(neverCfg, ei, timing.startCharge, seedBase, cellN);
      const backfireCell = runBlock3Cell(alwaysCfg, ei, timing.startCharge, seedBase, cellN);
      seedBase += cellN;
      const eligible = payoffCell.winRate > 0.1 && payoffCell.winRate < 0.9;
      const winSpreadPt = (payoffCell.winRate - backfireCell.winRate) * 100;
      const hpSpreadPt = (payoffCell.meanHpFrac - backfireCell.meanHpFrac) * 100;
      const spreadPt = eligible ? winSpreadPt : hpSpreadPt;
      const bar = eligible ? CLAIM3_PER_ENCOUNTER_WINRATE_BAR_PT : CLAIM3_PER_ENCOUNTER_HP_BAR_PT;
      const clears = spreadPt >= bar;
      if (clears) encountersClearingBar++;
      console.log(
        `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
          `${(payoffCell.winRate * 100).toFixed(0)}%`.padStart(9) +
          `${(backfireCell.winRate * 100).toFixed(0)}%`.padStart(10) +
          `  ${eligible ? "winRate " : "hpLeft  "}` +
          `${clears ? "PASS" : "FAIL"} (${spreadPt.toFixed(1)}pt vs ${bar}pt)`,
      );
    }
    console.log("");
  }
  console.log(
    `  VERDICT (bar: >=${CLAIM3_MIN_ENCOUNTERS_CLEARING_BAR} encounter/timing cells clear their gate): ` +
      `${encountersClearingBar} of ${ENCOUNTERS.length * FIRE_TIMINGS.length} cells cleared -> ` +
      `${encountersClearingBar >= CLAIM3_MIN_ENCOUNTERS_CLEARING_BAR ? "PASS" : "FAIL"}\n`,
  );

  console.log("  -- full runs: forced payoff vs forced backfire on every fired chain --\n");
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 970_000 + i);
  const payoffArm = runArm(`forced payoff n=${n}`, neverCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(payoffArm, undefined, HEALER_IDS);
  const backfireArm = runArm(`forced backfire n=${n}`, alwaysCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(backfireArm, payoffArm, HEALER_IDS);

  const flips = payoffArm.completed.filter((won, i) => won && !backfireArm.completed[i]).length;
  const reverseFlips = backfireArm.completed.filter((won, i) => won && !payoffArm.completed[i]).length;
  console.log(
    `  FLIP COUNT (the literal "backfire creates a losing position" reading): ${flips} of ${n} same-seed pairs go from\n` +
      `  COMPLETE (forced payoff) to NOT COMPLETE (forced backfire); ${reverseFlips} go the other way.\n`,
  );

  const runCompletionDeltaPt = (payoffArm.report.runCompletionRate - backfireArm.report.runCompletionRate) * 100;
  const passes = runCompletionDeltaPt >= CLAIM3_COMPLETION_BAR_PT;
  console.log(
    `  RUN-LEVEL VERDICT (bar: >=${CLAIM3_COMPLETION_BAR_PT}pt completion): forced backfire costs ${runCompletionDeltaPt.toFixed(1)}pt of ` +
      `run completion vs forced payoff -> ${passes ? "PASS" : "FAIL"}\n`,
  );

  const attackerRows = backfireArm.chainOutcomes.rows.filter((r) => !r.healer);
  if (attackerRows.length > 0) {
    const pooled = attackerRows.reduce((acc, r) => ({ chains: acc.chains + r.chains, deaths: acc.deaths + r.deathsFromBackfire }), { chains: 0, deaths: 0 });
    console.log(`  deaths per forced backfire (pooled attacker rows): ${(pooled.deaths / Math.max(1, pooled.chains)).toFixed(3)}\n`);
    for (const row of attackerRows) {
      const stats = chainOutcomeStats(row);
      console.log(`    ${row.effect.padEnd(13)} chains=${stats.chains}  deaths/backfire=${stats.deathsPerBackfire.toFixed(3)}`);
    }
    console.log("");
  }

  effectSizes.push(
    { label: "Claim 3: forced backfire vs forced payoff (run completion)", p1: payoffArm.report.runCompletionRate, p2: backfireArm.report.runCompletionRate },
    { label: "Claim 3: forced backfire vs forced payoff (fight 5 win rate)", p1: payoffArm.report.winRateByFightIndex[4]!, p2: backfireArm.report.winRateByFightIndex[4]! },
  );
}

// =========================================================================
// BLOCK 4 — Perceptibility. Pure arithmetic on Blocks 1/3's own numbers; no
// new simulation. (Block 2's variance decomposition has no proportion to
// feed this — spread, not a win/loss rate.)
// =========================================================================

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — perceptibility: runs needed to notice each measured effect ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so earlier blocks' effect sizes are available)\n");
  } else {
    console.log("  Two-proportion power estimate (alpha=0.05 two-sided, 80% power) — see arm.ts's runsToDetect.\n");
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("chain-proof sweep complete.");
