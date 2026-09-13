/**
 * Ranks EVERY input to a fight's outcome on one shared scale, at both the
 * single-fight level and the whole-run level — the question underneath four
 * failed chain-identity levers (payoff size, backfire risk, chain shape,
 * chain targeting): each one changed something that may simply not be among
 * the things that decide a fight. Nothing in the repo had ever measured that
 * directly; every prior batch/*Verdict.ts file asked "does THIS ONE lever
 * work" against its own bar, with no shared scale to compare against.
 *
 * This is a REPORT, not a check — same discipline every prior batch/*Verdict
 * file established: it answers an open question rather than pinning a
 * known-good value, so it stays out of `npm run check` (wired as
 * `npm run measure:deciding-factors`). Once a factor's place in the ranking
 * points at a real next step, promote ONE narrow invariant into
 * checks/chaindist.ts, same as every prior pass.
 *
 * Companion, not a duplicate, of `batch/chainProof.ts` (built the same day, a
 * different Claude session, Tu's separate and narrower ask: statistically
 * prove three specific STATE.md claims about the chain mechanic). Two of
 * this file's "dice" rows are CITED from chainProof.ts rather than
 * re-measured — see the CITED FROM CHAINPROOF section below for the exact
 * numbers and their caveats. Everything else here is new.
 *
 * Seed block 1_000_000-1_499_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999,
 * batch/chainLeverage.ts's 300_000-399_999 plus its own 700_000+ scratch
 * counter, the retired batch/enrageLeverage.ts's 400_000-419_999,
 * batch/shapeVerdict.ts's 500_000-599_999, batch/targetingVerdict.ts's
 * 600_000-699_999, and batch/backfireRisk.ts's 800_000-899_999 — batch/
 * chainProof.ts's 900_000-999_999 is now ALSO taken, confirmed directly with
 * that session rather than assumed). This file's own scratch counter for
 * oracleFieldPick's rollouts (not a pinned reproducible sequence, same
 * convention as chainLeverage.ts's 700_000+) starts at 1_800_000. Allocation:
 *   Preamble (identity/share/knobs/band):  1_000_000 .. 1_009_999
 *   Block 1 (HP sampling + 11x3 census):   1_010_000 .. 1_039_999
 *   Block 2 (7 factors x 11 encounters):   1_050_000 .. 1_199_999
 *   Block 3 (run-level factors + field
 *     pick + coin spend + recovery):       1_250_000 .. 1_299_999
 *   Block 4 (the four dead levers, fresh): 1_350_000 .. 1_399_999
 * Free: 1_040_000-1_049_999, 1_200_000-1_249_999, 1_300_000-1_349_999,
 * 1_400_000-1_499_999 (plenty of slack — this file ranks many factors, not
 * one, so generous per-block room was chosen over tight packing).
 *
 * Same honest limitation as every prior report: runFight/runRun share one
 * Rng across whatever they simulate, so two arms differing in ANY way
 * diverge their dice from that point onward. Every number below is a
 * POPULATION comparison over identical seed sequences, never a claim about
 * what one specific seed "would have done" under the road not taken.
 *
 * A second, sharper limitation specific to THIS file: every factor below is
 * measured ONE AT A TIME, poles swung with everything else held at its
 * shipped default. Factors interact (a chain that never fires can't
 * backfire either), so the swings printed here will not sum to the whole —
 * this ranks which inputs matter most, it does not split the outcome into
 * shares that add to 100%.
 *
 * Block 2's single-fight cells run at whichever HP level Block 1's own
 * sampling found LATE-run heroes actually carry into a fight (not a guess —
 * read off real 5-fight runs' own fight-summary HP figures) — a factor
 * measured on a fight nobody can lose reads as zero no matter how strong it
 * is, and fights 1-4 are close to risk-free for a well-rounded draft.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type FightConfig, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { DEFAULT_DRAFT_ROSTER_IDS, DEFAULT_PLAYER_ROSTER_IDS, PLAYER_HERO_POOL, makePlayerSide } from "../sim/heroes.js";
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
import { printArm, printDetectability, runArm, stdev } from "./arm.js";

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
const BLOCK = (args.block as "0" | "1" | "2" | "3" | "4" | "5" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

function withFightConfig(overrides: Partial<FightConfig>): RunConfig {
  return { ...cfg, fight: { ...cfg.fight, ...overrides } };
}
function withRunConfig(overrides: Partial<RunConfig>): RunConfig {
  return { ...cfg, ...overrides };
}

/** Effect sizes captured by whichever blocks ran, for Block 5 to convert into
 * "runs needed to notice" — module scope so Block 5 can read them regardless
 * of which earlier blocks executed in this same process. */
const effectSizes: { label: string; p1: number; p2: number }[] = [];
interface FightLevelRanking {
  factor: string;
  poolSpreadPt: number;
  worstEncounterSpreadPt: number;
}
interface RunLevelRanking {
  factor: string;
  deltaPt: number;
  cited?: boolean;
}
const RANKING_FIGHT_LEVEL: FightLevelRanking[] = [];
const RANKING_RUN_LEVEL: RunLevelRanking[] = [];

// =========================================================================
// PREAMBLE — self-verification. Aborts the sweep if any check fails, same
// discipline every prior batch/*Verdict.ts file established.
// =========================================================================

function verifyEnemyTargetModeDefaultIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  const explicitCfg = withFightConfig({ enemyTargetMode: "weighted" });
  for (let i = 0; i < 8; i++) {
    const seed = 1_000_000 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const explicit = runRun(explicitCfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    if (JSON.stringify(base) !== JSON.stringify(explicit)) {
      console.error(`FAIL: enemyTargetMode="weighted" (explicit) diverged from the default at seed ${seed}`);
      return false;
    }
  }
  console.log('PASS: enemyTargetMode="weighted" (explicit) is byte-identical to the default, over 8 seeds');
  return true;
}

/** "The Wall" (ENCOUNTERS[1]) — one bruiser, tank vs everyone else, a long
 * enough grind for hits-taken shares to converge. Measures each player
 * hero's share of hits taken, aggregated over many isolated fights, under
 * each targeting mode — the round-robin exists ONLY to hold this share
 * steady while removing the dice, so this is the one check that actually
 * proves it does. */
function measureHitShare(mode: "weighted" | "weightedRoundRobin", seedBase: number, n: number): Record<string, number> {
  const fightCfg = withFightConfig({ enemyTargetMode: mode });
  const totals: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const player = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
    const result = runFight({ player, enemy: makeEncounterEnemySide(fightCfg, 0, 1) }, fightCfg.fight, new Rng(seed), seed);
    for (const h of result.finalPlayerHeroes) {
      const id = baseHeroId(h.id);
      totals[id] = (totals[id] ?? 0) + h.hitsTaken;
    }
  }
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  const shares: Record<string, number> = {};
  for (const [id, v] of Object.entries(totals)) shares[id] = grand > 0 ? v / grand : 0;
  return shares;
}

function verifyRoundRobinPreservesShare(): boolean {
  const n = 300;
  const weighted = measureHitShare("weighted", 1_000_100, n);
  const roundRobin = measureHitShare("weightedRoundRobin", 1_000_400, n);
  let ok = true;
  for (const id of new Set([...Object.keys(weighted), ...Object.keys(roundRobin)])) {
    const w = weighted[id] ?? 0;
    const r = roundRobin[id] ?? 0;
    const withinTol = Math.abs(w - r) <= 0.03;
    if (!withinTol) ok = false;
    console.log(
      `  ${id.padEnd(8)} weighted share=${(w * 100).toFixed(1)}%  round-robin share=${(r * 100).toFixed(1)}%  ${withinTol ? "OK" : "OUT OF TOLERANCE"}`,
    );
  }
  console.log(`${ok ? "PASS" : "FAIL"}: weightedRoundRobin preserves each hero's long-run hits-taken share within 3pt`);
  return ok;
}

/** Every knob this file sweeps actually moves the quantity it claims to —
 * without this, a null result in a later block could be "the knob is a
 * silent no-op" in disguise (this repo has shipped that mistake once
 * already — see config.ts's healMaxFractionOfTargetMaxHp history). */
function verifyKnobsAreLive(): boolean {
  const n = 300;
  let ok = true;

  {
    const highCfg = withFightConfig({ chargeThreshold: 1_000_000_000 });
    let ignitions = 0;
    for (let i = 0; i < n; i++) {
      const seed = 1_001_000 + i;
      const player = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
      const result = runFight({ player, enemy: makeEncounterEnemySide(highCfg, 0, 0) }, highCfg.fight, new Rng(seed), seed);
      if (result.ignited) ignitions++;
    }
    const rate = ignitions / n;
    const cellOk = rate <= 0.02;
    ok = ok && cellOk;
    console.log(`  chargeThreshold=1e9: ignition rate ${(rate * 100).toFixed(1)}% (want <=2%) ${cellOk ? "OK" : "OUT OF TOLERANCE"}`);
  }

  {
    const meanFiredLength = (fightCfg: RunConfig, seedBase: number): number => {
      let sum = 0;
      let fired = 0;
      for (let i = 0; i < n; i++) {
        const seed = seedBase + i;
        const side = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
        const player: SideState = {
          ...side,
          heroes: side.heroes.map((h) => (baseHeroId(h.id) === "rook" ? { ...h, charge: fightCfg.fight.chargeThreshold - 1 } : h)),
        };
        const result = runFight({ player, enemy: makeEncounterEnemySide(fightCfg, 0, 0) }, fightCfg.fight, new Rng(seed), seed);
        if (result.ignited) {
          sum += result.chainLength;
          fired++;
        }
      }
      return fired > 0 ? sum / fired : 0;
    };
    const lowLen = meanFiredLength(withFightConfig({ chainContinuationScale: 0 }), 1_001_500);
    const highLen = meanFiredLength(withFightConfig({ chainContinuationScale: 10 }), 1_002_000);
    const cellOk = lowLen <= 0.5 && highLen >= 5;
    ok = ok && cellOk;
    console.log(
      `  chainContinuationScale=0: mean fired length=${lowLen.toFixed(2)} (want <=0.5); ` +
        `=10: mean fired length=${highLen.toFixed(2)} (want >=5) ${cellOk ? "OK" : "OUT OF TOLERANCE"}`,
    );
  }

  {
    const hpFracStdev = (fightCfg: RunConfig, seedBase: number): number => {
      const fracs: number[] = [];
      for (let i = 0; i < n; i++) {
        const seed = seedBase + i;
        const player = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
        const result = runFight({ player, enemy: makeEncounterEnemySide(fightCfg, 0, 0) }, fightCfg.fight, new Rng(seed), seed);
        const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
        const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
        fracs.push(maxHp > 0 ? hp / maxHp : 0);
      }
      return stdev(fracs);
    };
    const lowStdev = hpFracStdev(withFightConfig({ damageVariance: 0 }), 1_002_500);
    const highStdev = hpFracStdev(withFightConfig({ damageVariance: 0.25 }), 1_003_000);
    const cellOk = highStdev > lowStdev;
    ok = ok && cellOk;
    console.log(`  damageVariance=0: hp-frac stdev=${lowStdev.toFixed(4)}; =0.25: hp-frac stdev=${highStdev.toFixed(4)} ${cellOk ? "OK" : "OUT OF TOLERANCE"}`);
  }

  {
    const meanWindupHit = (fightCfg: RunConfig, seedBase: number): number => {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        const seed = seedBase + i;
        const player = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
        const result = runFight({ player, enemy: makeEncounterEnemySide(fightCfg, 0, 1) }, fightCfg.fight, new Rng(seed), seed);
        for (const e of result.events) if (e.type === "windupHit") { sum += e.damage; count++; }
      }
      return count > 0 ? sum / count : 0;
    };
    const lowMean = meanWindupHit(withFightConfig({ windupDamageMultiplier: 1 }), 1_003_500);
    const highMean = meanWindupHit(withFightConfig({ windupDamageMultiplier: 2 }), 1_004_000);
    const cellOk = highMean > lowMean * 1.5;
    ok = ok && cellOk;
    console.log(`  windupDamageMultiplier=1: mean windup hit=${lowMean.toFixed(1)}; =2: mean windup hit=${highMean.toFixed(1)} ${cellOk ? "OK" : "OUT OF TOLERANCE"}`);
  }

  console.log(`${ok ? "PASS" : "FAIL"}: every knob this file sweeps actually moves its own quantity`);
  return ok;
}

/** Fixed at n=1500, NOT divided by QUICK_DIVISOR — a --quick preamble check
 * must never be able to fail on ordinary sampling noise (same convention as
 * chainProof.ts's/backfireRisk.ts's own fixed-n preamble checks). */
function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = Array.from({ length: 1500 }, (_, i) => 1_004_500 + i);
  const arm = runArm(`preamble baseline n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = arm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm reproduces checks/chaindist.ts's pinned default-draft completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

const preambleOk =
  verifyEnemyTargetModeDefaultIsInert() &&
  verifyRoundRobinPreservesShare() &&
  verifyKnobsAreLive() &&
  verifyBaselineMatchesChaindistBand();
if (!preambleOk) {
  console.error("\ndeciding-factors sweep ABORTED — self-verification failed, blocks below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// Carried-in HP levels — sampled from real 5-fight runs, not guessed. "mid"
// is the median roster HP fraction entering fight 3 (index 2); "late" is the
// same for the finale (index 4). Always computed, regardless of --block, so
// Block 2 can pick its working HP level even when run standalone.
// =========================================================================

let MID_HP_FRACTION = 0.7;
let LATE_HP_FRACTION = 0.5;

function sampleCarriedHpFractions(): void {
  const n = Math.max(50, Math.round(600 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 1_006_000 + i);
  const policy = makePolicy("always-heal", cfg);
  const midFracs: number[] = [];
  const lateFracs: number[] = [];
  for (const seed of seeds) {
    const result = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const enteringFight2 = result.fights[1]; // after fight index 1 == entering fight index 2
    if (enteringFight2 && enteringFight2.outcome === "win" && enteringFight2.playerMaxHpAfter > 0) {
      midFracs.push(enteringFight2.playerHpAfter / enteringFight2.playerMaxHpAfter);
    }
    const enteringFight4 = result.fights[3]; // after fight index 3 == entering fight index 4 (finale)
    if (enteringFight4 && enteringFight4.outcome === "win" && enteringFight4.playerMaxHpAfter > 0) {
      lateFracs.push(enteringFight4.playerHpAfter / enteringFight4.playerMaxHpAfter);
    }
  }
  midFracs.sort((a, b) => a - b);
  lateFracs.sort((a, b) => a - b);
  if (midFracs.length > 0) MID_HP_FRACTION = midFracs[Math.floor(midFracs.length / 2)]!;
  if (lateFracs.length > 0) LATE_HP_FRACTION = lateFracs[Math.floor(lateFracs.length / 2)]!;
  console.log(
    `Sampled from ${seeds.length} real 5-fight runs (roster-wide HP, bench included): median fraction entering fight 3 ` +
      `(mid) = ${(MID_HP_FRACTION * 100).toFixed(1)}% (n=${midFracs.length} runs that reached it); entering fight 5/finale ` +
      `(late) = ${(LATE_HP_FRACTION * 100).toFixed(1)}% (n=${lateFracs.length}).\n`,
  );
}
sampleCarriedHpFractions();

// =========================================================================
// BLOCK 1 — which fights can actually be lost, at all. Must come first: a
// factor measured on a fight nobody can lose reads as zero no matter how
// strong it is, and four flat prior results are explained at once if this
// count turns out small.
// =========================================================================

function scaledSquad(hpFraction: number, chargeOverrides?: Record<string, number>): SideState {
  const side = makePlayerSide(DEFAULT_PLAYER_ROSTER_IDS);
  return {
    ...side,
    heroes: side.heroes.map((h) => {
      const base = baseHeroId(h.id);
      const charge = chargeOverrides?.[base] ?? h.charge;
      return { ...h, hp: h.maxHp * hpFraction, charge };
    }),
  };
}

interface FactorCell {
  winRate: number;
  meanHpFrac: number;
}

function runFactorCell(
  fightCfg: RunConfig,
  encounterIdx: number,
  hpFraction: number,
  chargeOverrides: Record<string, number> | undefined,
  seedBase: number,
  n: number,
): FactorCell {
  let wins = 0;
  let sumHpFrac = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const player = scaledSquad(hpFraction, chargeOverrides);
    const setup: FightSetup = { player, enemy: makeEncounterEnemySide(fightCfg, 0, encounterIdx) };
    const result = runFight(setup, fightCfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    sumHpFrac += maxHp > 0 ? hp / maxHp : 0;
  }
  return { winRate: wins / n, meanHpFrac: sumHpFrac / n };
}

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — which of the 11 encounters can actually be lost? ==========\n");
  console.log(
    "  Accept-default squad (bracer/rook/cairn), charge=0 at fight start (natural play, no carried-charge\n" +
      "  confound), three HP levels. SETTLED = win rate >90% or <10%; a factor can only decide a fight that\n" +
      "  is not settled.\n",
  );
  const n = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  const levels: { name: string; frac: number }[] = [
    { name: "full", frac: 1.0 },
    { name: "mid", frac: MID_HP_FRACTION },
    { name: "late", frac: LATE_HP_FRACTION },
  ];
  let seedBase = 1_010_000;
  for (const level of levels) {
    console.log(`  -- HP level: ${level.name} (${(level.frac * 100).toFixed(1)}%) --`);
    let inDoubt = 0;
    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const cell = runFactorCell(cfg, ei, level.frac, undefined, seedBase, n);
      seedBase += n;
      const settled = cell.winRate > 0.9 || cell.winRate < 0.1;
      if (!settled) inDoubt++;
      console.log(
        `    ${ENCOUNTERS[ei]!.name.padEnd(14)} win rate=${(cell.winRate * 100).toFixed(1)}%  ${settled ? "SETTLED" : "IN DOUBT"}`,
      );
    }
    console.log(`  ${inDoubt} of ${ENCOUNTERS.length} encounters in doubt at ${level.name} HP.\n`);
  }
  console.log(
    "  READ: fights measured settled here explain why a lever tested only against them reads as flat —\n" +
      "  the question exists on paper but never costs anything. Block 2 below runs at the LATE HP level\n" +
      "  (what a real finale is actually fought at) so its factor comparisons land on whatever room to\n" +
      "  matter this census found.\n",
  );
}

// =========================================================================
// BLOCK 2 — rank the factors at the level of ONE fight. Every factor below
// is a dice roll or leftover state, not a player choice inside a single
// fight (the one player choice that lives here — which 3 of 5 to field — is
// measured at the run level in Block 3 instead, via oracleFieldPick, since a
// single isolated fight can't price the cross-fight cost of a bad pick).
// =========================================================================

interface FactorPole {
  label: string;
  fightCfg: RunConfig;
  chargeOverrides?: Record<string, number>;
}

function runFactorSweep(factorLabel: string, poles: [FactorPole, FactorPole], hpFraction: number, seedBase: number, n: number): void {
  console.log(`  -- ${factorLabel} (HP level ${(hpFraction * 100).toFixed(1)}%) --`);
  console.log("  encounter".padEnd(16) + poles.map((p) => p.label.padStart(14)).join("") + "   winSpread   hpSpread");
  let sb = seedBase;
  let poolSumA = 0;
  let poolSumB = 0;
  let worstSpreadPt = 0;
  for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
    const cellA = runFactorCell(poles[0].fightCfg, ei, hpFraction, poles[0].chargeOverrides, sb, n);
    sb += n;
    const cellB = runFactorCell(poles[1].fightCfg, ei, hpFraction, poles[1].chargeOverrides, sb, n);
    sb += n;
    poolSumA += cellA.winRate;
    poolSumB += cellB.winRate;
    const winSpreadPt = Math.abs(cellA.winRate - cellB.winRate) * 100;
    const hpSpreadPt = Math.abs(cellA.meanHpFrac - cellB.meanHpFrac) * 100;
    worstSpreadPt = Math.max(worstSpreadPt, winSpreadPt, hpSpreadPt);
    console.log(
      `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
        `${(cellA.winRate * 100).toFixed(0)}%`.padStart(14) +
        `${(cellB.winRate * 100).toFixed(0)}%`.padStart(14) +
        `   ${winSpreadPt.toFixed(1).padStart(7)}pt   ${hpSpreadPt.toFixed(1).padStart(5)}pt`,
    );
  }
  const poolMeanA = (poolSumA / ENCOUNTERS.length) * 100;
  const poolMeanB = (poolSumB / ENCOUNTERS.length) * 100;
  const poolSpreadPt = Math.abs(poolMeanA - poolMeanB);
  console.log(
    `  pool-wide mean win rate: ${poles[0].label}=${poolMeanA.toFixed(1)}%  ${poles[1].label}=${poolMeanB.toFixed(1)}%  ` +
      `(spread ${poolSpreadPt.toFixed(1)}pt)   worst single encounter: ${worstSpreadPt.toFixed(1)}pt\n`,
  );
  RANKING_FIGHT_LEVEL.push({ factor: factorLabel, poolSpreadPt, worstEncounterSpreadPt: worstSpreadPt });
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — fight-level factor ranking (dice and leftover state) ==========\n");
  const n = Math.max(20, Math.round(300 / QUICK_DIVISOR));
  const hpFraction = LATE_HP_FRACTION;
  const rookThreshold = cfg.fight.chargeThreshold - 1;

  runFactorSweep(
    "whether a chain fires before the fight ends",
    [
      { label: "never fires", fightCfg: withFightConfig({ chargeThreshold: 1_000_000_000 }) },
      { label: "fires at t~0", fightCfg: cfg, chargeOverrides: { rook: rookThreshold } },
    ],
    hpFraction,
    1_050_000,
    n,
  );

  runFactorSweep(
    "which way a fired chain aims",
    [
      { label: "never backfires", fightCfg: withFightConfig({ forceBackfire: "never" }), chargeOverrides: { rook: rookThreshold } },
      { label: "always backfires", fightCfg: withFightConfig({ forceBackfire: "always" }), chargeOverrides: { rook: rookThreshold } },
    ],
    hpFraction,
    1_073_000,
    n,
  );

  runFactorSweep(
    "how long a fired chain runs",
    [
      { label: "always 1 hit", fightCfg: withFightConfig({ chainContinuationScale: 0 }), chargeOverrides: { rook: rookThreshold } },
      { label: "always the cap", fightCfg: withFightConfig({ chainContinuationScale: 10 }), chargeOverrides: { rook: rookThreshold } },
    ],
    hpFraction,
    1_096_000,
    n,
  );

  runFactorSweep(
    "per-hit damage variance",
    [
      { label: "off (0)", fightCfg: withFightConfig({ damageVariance: 0 }) },
      { label: "shipped (±25%)", fightCfg: withFightConfig({ damageVariance: 0.25 }) },
    ],
    hpFraction,
    1_119_000,
    n,
  );

  runFactorSweep(
    "who the enemy happens to hit",
    [
      { label: "dice (shipped)", fightCfg: withFightConfig({ enemyTargetMode: "weighted" }) },
      { label: "steady", fightCfg: withFightConfig({ enemyTargetMode: "weightedRoundRobin" }) },
    ],
    hpFraction,
    1_142_000,
    n,
  );

  runFactorSweep(
    "the wind-up spike",
    [
      { label: "ordinary hit (1x)", fightCfg: withFightConfig({ windupDamageMultiplier: 1 }) },
      { label: "shipped (2x)", fightCfg: withFightConfig({ windupDamageMultiplier: 2 }) },
    ],
    hpFraction,
    1_165_000,
    n,
  );

  runFactorSweep(
    "carried-in charge",
    [
      { label: "empty (0)", fightCfg: cfg },
      { label: "near firing", fightCfg: cfg, chargeOverrides: { rook: rookThreshold } },
    ],
    hpFraction,
    1_188_000,
    n,
  );

  console.log(
    "  Two more fight-level factors are read off OTHER data rather than swept here — see the write-up:\n" +
      "  carried-in HP (Block 1's own full/mid/late spread) and which encounter got drawn (the spread\n" +
      "  ACROSS Block 1's 11 rows, at a single HP level).\n",
  );
}

// =========================================================================
// BLOCK 3 — rank the same kind of factors across a whole 5-fight run, plus
// the three player choices that only exist at this level (draft, field
// pick, coin spend) and the two recovery knobs that decide how much of
// carried-in HP a player choice actually controls.
// =========================================================================

function compareRunLevel(factorLabel: string, poleALabel: string, poleACfg: RunConfig, poleBLabel: string, poleBCfg: RunConfig, seeds: number[]): void {
  console.log(`  -- ${factorLabel}: ${poleALabel} vs ${poleBLabel} --\n`);
  const armA = runArm(`${factorLabel}: ${poleALabel} n=${seeds.length}`, poleACfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(armA, undefined, HEALER_IDS);
  const armB = runArm(`${factorLabel}: ${poleBLabel} n=${seeds.length}`, poleBCfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(armB, armA, HEALER_IDS);
  const deltaPt = Math.abs(armA.report.runCompletionRate - armB.report.runCompletionRate) * 100;
  RANKING_RUN_LEVEL.push({ factor: factorLabel, deltaPt });
  effectSizes.push({ label: `${factorLabel} (run completion)`, p1: armA.report.runCompletionRate, p2: armB.report.runCompletionRate });
}

// oracleFieldPick / combinations — copied from chainLeverage.ts's Block 4
// rather than imported (that file executes its own sweep at module load —
// importing it would run someone else's report as a side effect). Own
// scratch counter (never a pinned reproducible sequence, same convention as
// chainLeverage.ts's own 700_000+): starts at 1_800_000, disjoint from
// chainLeverage's 700_000+ range.
let fieldPickScratchSeed = 1_800_000;
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
function oracleFieldPick(direction: "best" | "worst", rollouts: number): FieldPick {
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
        const seed = fieldPickScratchSeed++;
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

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — run-level factor ranking ==========\n");
  const n = Math.max(50, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 1_250_000 + i);

  compareRunLevel("whether a chain can ever fire", "never", withFightConfig({ chargeThreshold: 1_000_000_000 }), "shipped", cfg, seeds);
  compareRunLevel("how long a fired chain runs", "always 1 hit", withFightConfig({ chainContinuationScale: 0 }), "always the cap", withFightConfig({ chainContinuationScale: 10 }), seeds);
  compareRunLevel("per-hit damage variance", "off (0)", withFightConfig({ damageVariance: 0 }), "shipped (±25%)", withFightConfig({ damageVariance: 0.25 }), seeds);
  compareRunLevel("who the enemy happens to hit", "dice (shipped)", withFightConfig({ enemyTargetMode: "weighted" }), "steady", withFightConfig({ enemyTargetMode: "weightedRoundRobin" }), seeds);
  compareRunLevel("the wind-up spike", "ordinary hit (1x)", withFightConfig({ windupDamageMultiplier: 1 }), "shipped (2x)", withFightConfig({ windupDamageMultiplier: 2 }), seeds);

  console.log("  -- player choice: coin spend --\n");
  const skipArm = runArm(`coin spend: never-spend n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, undefined, "never-spend");
  printArm(skipArm, undefined, HEALER_IDS);
  const healArm = runArm(`coin spend: always-heal n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, undefined, "always-heal");
  printArm(healArm, skipArm, HEALER_IDS);
  const upgradeArm = runArm(`coin spend: always-upgrade n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, undefined, "always-upgrade");
  printArm(upgradeArm, skipArm, HEALER_IDS);
  const coinBest = Math.max(healArm.report.runCompletionRate, upgradeArm.report.runCompletionRate);
  const coinDeltaPt = Math.abs(coinBest - skipArm.report.runCompletionRate) * 100;
  RANKING_RUN_LEVEL.push({ factor: "player choice: coin spend (best policy vs never-spend)", deltaPt: coinDeltaPt });
  effectSizes.push({ label: "Coin spend: best policy vs never-spend (run completion)", p1: coinBest, p2: skipArm.report.runCompletionRate });

  console.log("  -- carried-in HP: how generous fight-to-fight recovery is --\n");
  const stingyRecovery = withRunConfig({ autoRecoverFraction: 0.1, benchedRecoverFraction: 0.2 });
  const generousRecovery = withRunConfig({ autoRecoverFraction: 0.5, benchedRecoverFraction: 0.7 });
  compareRunLevel("carried-in HP (recovery generosity)", "stingy", stingyRecovery, "generous", generousRecovery, seeds);

  console.log("  -- player choice: field pick (which 3 of 5 to field each fight) --\n");
  const n4 = Math.max(20, Math.round(200 / QUICK_DIVISOR));
  const seeds4 = Array.from({ length: n4 }, (_, i) => 1_290_000 + i);
  const defArm = runArm(`field pick: default n=${n4}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds4);
  printArm(defArm, undefined, HEALER_IDS);
  const bestArm = runArm(`field pick: oracle-best n=${n4}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds4, oracleFieldPick("best", 3));
  printArm(bestArm, defArm, HEALER_IDS);
  const worstArm = runArm(`field pick: oracle-worst n=${n4}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds4, oracleFieldPick("worst", 3));
  printArm(worstArm, defArm, HEALER_IDS);
  const fieldPickDeltaPt = Math.abs(bestArm.report.runCompletionRate - worstArm.report.runCompletionRate) * 100;
  RANKING_RUN_LEVEL.push({ factor: "player choice: field pick (oracle-best vs oracle-worst)", deltaPt: fieldPickDeltaPt });
  effectSizes.push({ label: "Field pick: oracle-best vs oracle-worst (run completion)", p1: bestArm.report.runCompletionRate, p2: worstArm.report.runCompletionRate });

  console.log(
    "  -- player choice: draft (which 5 of 6 to keep) --\n" +
      "  Not re-simulated here: read directly from THIS SESSION's `npm run check:chaindist` output, which\n" +
      "  already runs the full leave-one-out sweep at a pinned n as part of its own regression band. Max\n" +
      '  completion (leave-out="rook") = 32.83%; min (leave-out="hollow") = 15.7%. See that check\'s own\n' +
      "  printed lines for the other four drafts; re-run it to refresh these numbers if config changes.\n",
  );
  RANKING_RUN_LEVEL.push({ factor: "player choice: draft (leave-one-out spread, cited from npm run check:chaindist)", deltaPt: 32.83 - 15.7, cited: true });
}

// =========================================================================
// BLOCK 4 — three of the four already-failed chain-identity levers no
// longer exist to re-measure. 2026-09-13 ("a hero's chain names its own
// enemy" rebuild — see DECISIONS.md): payoff size (chainMagnitudeTarget),
// chain shape (ChainProfile/CHAIN_PROFILES), and chain targeting
// (ChainTargeting/chainTargetingEnabled) were deleted outright, replaced by
// per-hero ChainEffect — heroes differ by WHAT their chain does, not by a
// bigger/smaller/differently-shaped/differently-aimed number. There is
// nothing left of those three to swing a knob on. Backfire-risk
// differentiation (chainAffinity -> backfireChanceFor) is untouched by that
// rebuild and still exists, so it's the one re-measured below.
// =========================================================================

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — the one still-live dead lever, re-measured fresh ==========\n");
  const n = Math.max(50, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 1_350_000 + i);
  const baseline = runArm(`baseline n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(baseline, undefined, HEALER_IDS);

  const noRiskDiff = runArm(`dead lever, backfire risk flattened n=${n}`, withFightConfig({ backfireChanceAffinitySlope: 0 }), DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(noRiskDiff, baseline, HEALER_IDS);
  const riskDeltaPt = Math.abs(noRiskDiff.report.runCompletionRate - baseline.report.runCompletionRate) * 100;
  RANKING_RUN_LEVEL.push({ factor: "dead lever: backfire risk differentiation removed", deltaPt: riskDeltaPt });
  effectSizes.push({ label: "Dead lever: backfire risk differentiation removed (run completion)", p1: baseline.report.runCompletionRate, p2: noRiskDiff.report.runCompletionRate });

  console.log(
    "  payoff size, chain shape, and chain targeting are gone from the codebase entirely (2026-09-13 rebuild) —\n" +
      "  nothing left to re-swing. Their last-measured swings (13.2pt, 0.6pt, 8.8pt) stand as historical record\n" +
      "  only; see DECISIONS.md and STATE.md for the rebuild that superseded them.\n",
  );

  console.log(
    "  -- two more dice, CITED from batch/chainProof.ts rather than re-run here (confirmed with that\n" +
      "  session directly — see this file's header) --\n" +
      "  whether the chain mechanic exists at all: chains off costs 33pt of run completion (Claim 1, PASS).\n" +
      "  which way a fired chain aims, at RUN level: forced-backfire-vs-forced-payoff costs 42pt of run\n" +
      "  completion, 631/1500 same-seed pairs flip from completing to not (Claim 3, PASS). Claim 2 (is chain\n" +
      "  length the loudest dice) did NOT get a clean answer — see chainProof.ts's own header for the two\n" +
      "  confounds found, and Block 2/3 above's own chain-length rows for an independent, differently-built\n" +
      "  read that does not share those confounds (chainContinuationScale bypasses the equal-EV rescale\n" +
      "  entirely — see this file's header).\n",
  );
  RANKING_RUN_LEVEL.push({ factor: "dice: whether the chain mechanic exists at all (cited from chainProof.ts)", deltaPt: 33, cited: true });
  RANKING_RUN_LEVEL.push({ factor: "dice: which way a fired chain aims, run level (cited from chainProof.ts)", deltaPt: 42, cited: true });
}

// =========================================================================
// BLOCK 5 — the combined rankings, and perceptibility for everything
// independently measured above.
// =========================================================================

if (BLOCK === "5" || BLOCK === "all") {
  console.log("========== BLOCK 5 — the rankings ==========\n");

  if (RANKING_FIGHT_LEVEL.length > 0) {
    console.log("  -- fight-level ranking, by pool-wide spread (Block 2) --\n");
    const sorted = [...RANKING_FIGHT_LEVEL].sort((a, b) => b.poolSpreadPt - a.poolSpreadPt);
    for (const r of sorted) {
      console.log(`    ${r.poolSpreadPt.toFixed(1).padStart(6)}pt pool-wide  (worst encounter ${r.worstEncounterSpreadPt.toFixed(1)}pt)  ${r.factor}`);
    }
    console.log("");
  } else {
    console.log("  (fight-level ranking empty — run with --block all, or --block 2, first)\n");
  }

  if (RANKING_RUN_LEVEL.length > 0) {
    console.log("  -- run-level ranking, by completion-point swing (Blocks 3-4, plus citations) --\n");
    const sorted = [...RANKING_RUN_LEVEL].sort((a, b) => b.deltaPt - a.deltaPt);
    for (const r of sorted) {
      console.log(`    ${r.deltaPt.toFixed(1).padStart(6)}pt  ${r.cited ? "[cited]  " : "[measured]"} ${r.factor}`);
    }
    console.log("");
  } else {
    console.log("  (run-level ranking empty — run with --block all, or --block 3/4, first)\n");
  }

  if (effectSizes.length > 0) {
    console.log("  -- perceptibility: runs needed to notice each independently-measured effect --\n");
    console.log("  Two-proportion power estimate (alpha=0.05 two-sided, 80% power) — see arm.ts's runsToDetect.");
    console.log("  Cited (not independently measured) rows above are excluded — see chainProof.ts's own Block 4.\n");
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("deciding-factors sweep complete.");
