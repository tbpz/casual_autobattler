/**
 * Answers Tu's report (2026-08-27): "burster feels like the obviously better
 * pick than grinder — is that right or wrong?"
 *
 * The naive answer is "they're equal by construction": the 2026-08-20 pass makes
 * every attacker's chain converge on the same expected NET value
 * (heroes.ts's CHAIN_EV_TARGET_DAMAGE = 76, via config.ts's
 * chainMagnitudeScaleAbsolute). That answer is not safe. The analytic EV assumes
 * a chain always runs to its natural stochastic end, that damage now is worth
 * the same as damage later, and that a backfire costs exactly what an equal
 * payoff gains — and the live sim violates all three (see chainOutcomes.ts's
 * header for the three mechanisms and where each lives in fight.ts). So burster
 * has real, unpriced routes to being genuinely better, and grinder has two of
 * its own (burster spills overkill, and duds 40% of the time against long
 * fuse's 22%).
 *
 * "Burster vs grinder" splits on FUSE LENGTH here — Tu's own read, and the same
 * definition the retired batch/enrageLeverage.ts used:
 *     burster = shortFuseSteep ("short fuse", Hollow) + shortFuseFlat ("front-loaded", Vex)
 *     grinder = longFuseFlat   ("long fuse",  Bracer) + longFuseSteep ("back-loaded",  Rook)
 *
 * This is a REPORT, not a check — same discipline batch/affinity.ts established
 * and chainLeverage.ts followed: it answers an open question rather than pinning
 * a known-good value, so it stays out of `npm run check` (wired as
 * `npm run measure:shape-verdict`). Once an answer is in, promote ONE narrow
 * invariant into checks/chaindist.ts, same as every prior pass.
 *
 * Changes no sim behaviour: every number below comes from FightResult.events,
 * which the renderer already reads.
 *
 * VERDICT THRESHOLDS ARE PRE-REGISTERED (see VERDICT_BAR_PT below and Block 3's
 * printed table) — written before the numbers existed, so the output can't be
 * read to confirm whichever way it lands.
 *
 * Seed block 500_000-599_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999,
 * batch/chainLeverage.ts's 300_000-399_999, and the retired
 * batch/enrageLeverage.ts's 400_000-419_999). Allocation within the block:
 *   Preamble self-verification:        590_000 + 25            -> 590_024
 *   Block 2 (shape-isolated fights):   500_000 .. 552_799       (11x4x2 x 600)
 *   Block 3 burst/grind run pair:      560_000 + 1500 x 2       -> 562_999
 *
 * What this file deliberately does NOT rebuild: the fully-confounded read where
 * stats AND shape move together (fielding Hollow/Vex over Bracer/Rook) is
 * already available from `npm run batch --squad burst` (batch/cli.ts's presets).
 * Every arm here holds stats fixed and moves chainProfile only, so a delta is
 * attributable to shape.
 *
 * Same honest limitation as affinity.ts/chainLeverage.ts: runFight/runRun share
 * one Rng across whatever they simulate, so two arms differing in ANY way
 * diverge their dice from that point onward. Every comparison below is a
 * POPULATION comparison over identical seed sequences, never a claim about what
 * one specific seed "would have done" under the road not taken.
 */
import { Rng } from "../sim/rng.js";
import {
  DEFAULT_RUN_CONFIG,
  backfireChanceFor,
  chainLengthDistribution,
  chainMagnitudeScaleAbsolute,
  chainEscalationFactorFromProfile,
  expectedChainUnits,
  expectedNetChainUnits,
  type ChainProfile,
  type RunConfig,
} from "../sim/config.js";
import { chainAttackMagnitude, runFight } from "../sim/fight.js";
import {
  CHAIN_EV_TARGET_DAMAGE,
  CHAIN_PROFILES,
  DEFAULT_DRAFT_ROSTER_IDS,
  PLAYER_HERO_POOL,
  makePlayerSide,
} from "../sim/heroes.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { ENCOUNTERS, makeEncounterEnemySide } from "../sim/encounters.js";
import { makePolicy, runRun } from "../sim/run.js";
import type { RosterState } from "../sim/roster.js";
import { baseHeroId } from "./heroChain.js";
import { runArm, printArm, printDetectability, mean, type ArmResult } from "./arm.js";
import {
  ChainOutcomeAggregator,
  chainOutcomeStats,
  formatChainOutcomeRow,
  poolRows,
  type ChainOutcomeRow,
} from "./chainOutcomes.js";

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
// itself, NOT for trusting the printed numbers. Real answers need the full n's.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "all") ?? "all";

const cfg: RunConfig = DEFAULT_RUN_CONFIG;
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

/** The pre-registered bar. A completion/win-rate margin below this counts as
 * "no edge" regardless of which side it favours — chosen to match the 5-point
 * bar chainLeverage.ts's Blocks 1-3 already use, so verdicts across the two
 * reports are on the same scale. */
const VERDICT_BAR_PT = 5;
/** Paired-significance bar, same convention as affinity.ts/chainLeverage.ts. */
const VERDICT_BAR_Z = 2;

// --- The burster/grinder split (fuse length) ----------------------------------

const BURSTER_PROFILES: ChainProfile[] = [CHAIN_PROFILES.shortFuseSteep, CHAIN_PROFILES.shortFuseFlat];
const GRINDER_PROFILES: ChainProfile[] = [CHAIN_PROFILES.longFuseFlat, CHAIN_PROFILES.longFuseSteep];
const BURSTER_IDS = new Set(BURSTER_PROFILES.map((p) => p.id));
const ATTACKER_PROFILES: ChainProfile[] = [...BURSTER_PROFILES, ...GRINDER_PROFILES];
/** Which side of the split a profile id sits on — the one place the definition
 * lives, so no block can drift onto its own grouping. */
function sideOf(profileId: string): "burster" | "grinder" {
  return BURSTER_IDS.has(profileId) ? "burster" : "grinder";
}

/** The distinct profile ids behind a pooled row, for its printed name. Deduped:
 * Block 2 pools one row per encounter, so the raw list repeats each id 11
 * times. */
function pooledName(rows: ChainOutcomeRow[]): string {
  return [...new Set(rows.map((r) => r.profileId))].join("+");
}

const effectSizes: { label: string; p1: number; p2: number }[] = [];

// --- Self-verification preamble — abort the sweep if either fails -------------

function identityProfileTransform(roster: RosterState): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainProfile: h.chainProfile })) };
}

function verifySelfProfileTransformIsInert(): boolean {
  const policy = makePolicy("always-heal", cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 590_000 + i;
    const base = runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const transformed = runRun(
      cfg,
      new Rng(seed),
      policy,
      seed,
      identityProfileTransform(makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)),
    );
    if (JSON.stringify(base.fights) !== JSON.stringify(transformed.fights)) {
      console.error(
        `FAIL: a chainProfile transform mapping each hero to its OWN profile diverged from no transform at seed ${seed}`,
      );
      return false;
    }
  }
  console.log(
    "PASS: a chainProfile transform that maps each hero to its own profile is byte-identical to no transform, over 25 seeds",
  );
  return true;
}

/** Every chainStart must pair with exactly one chainEnd, or the decomposition
 * below is silently dropping or double-counting chains. Checked on the same 25
 * baseline runs the transform guard already simulates. */
function verifyChainOutcomeWiring(): boolean {
  const policy = makePolicy("always-heal", cfg);
  const agg = new ChainOutcomeAggregator(cfg);
  for (let i = 0; i < 25; i++) {
    const seed = 590_000 + i;
    agg.addRun(runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)).fightResults);
  }
  const { chainStartCount, chainEndCount } = agg.finalize();
  const ok = chainStartCount === chainEndCount && chainStartCount > 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}: chainOutcomes pairs every chainStart with exactly one chainEnd — ` +
      `${chainStartCount} starts, ${chainEndCount} ends`,
  );
  return ok;
}

let block3BaselineArm: ArmResult | undefined;

function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = Array.from({ length: Math.max(1, Math.round(1500 / QUICK_DIVISOR)) }, (_, i) => 560_000 + i);
  block3BaselineArm = runArm(`shipped assignment n=${seeds.length}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = block3BaselineArm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm (shipped profiles) reproduces checks/chaindist.ts's pinned default-draft ` +
      `completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

if (!verifySelfProfileTransformIsInert() || !verifyChainOutcomeWiring() || !verifyBaselineMatchesChaindistBand()) {
  console.error("\nshape-verdict sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — The analytic ledger. No simulation: pure config.ts math, printed
// so "equal EV on paper" is visible rather than assumed, and so the
// CONCENTRATION asymmetry the equal-EV pass necessarily creates is quantified.
// If Blocks 2-4 find no outcome edge, this block is the standing explanation
// for why burster nonetheless FEELS bigger.
// =========================================================================

/** A fixed reference attacker so shapes compare without a hero confound:
 * damage 6 (Rook's/Hollow's stat) at chainAffinity 1.0 — the exact anchor
 * config.ts's backfireChanceFor and chainMagnitudeScaleFor already use, so this
 * is the pool-agnostic reference, not a hero. */
const REF_DAMAGE = 6;
const REF_AFFINITY = 1.0;

function printAnalyticLedger(profile: ChainProfile, damage: number, affinity: number, target: number, indent: string): void {
  const backfire = backfireChanceFor(cfg.fight, affinity);
  const gross = expectedChainUnits(profile);
  const net = expectedNetChainUnits(profile, backfire);
  const scale = chainMagnitudeScaleAbsolute(profile, backfire, damage, target);
  const dist = chainLengthDistribution(profile);
  const schedule: number[] = [];
  for (let n = 1; n <= profile.maxHits; n++) {
    schedule.push(chainAttackMagnitude(cfg.fight, profile, damage, scale, n));
  }
  const meanLength = dist.reduce((s, p, k) => s + p * k, 0);
  // E[realized] under the analytic model: sum over n of P(reach n) * magnitude(n).
  // Printed so the SIM's realized figure in Blocks 2-3 has an analytic
  // counterpart to be compared against, rather than only the net target.
  let expectedGrossDamage = 0;
  for (let n = 1; n <= profile.maxHits; n++) {
    const reachN = dist.slice(n).reduce((s, p) => s + p, 0);
    expectedGrossDamage += reachN * (schedule[n - 1] ?? 0);
  }
  console.log(
    `${indent}${profile.label.padEnd(13)} (${profile.id.padEnd(14)}) [${sideOf(profile.id)}]\n` +
      `${indent}  fuse ${String(profile.maxHits).padStart(2)} hits, knee ${profile.escalationKneeHit}, step x${profile.escalationStepMultiplier}\n` +
      `${indent}  EV units:      gross ${gross.toFixed(2)}  net ${net.toFixed(2)}  (backfire ${(backfire * 100).toFixed(1)}%)\n` +
      `${indent}  magnitudeScale ${scale.toFixed(3)}  -> per-hit: ${schedule.join(", ")}\n` +
      `${indent}  biggest hit    ${Math.max(...schedule)}  |  E[gross damage per fired chain] ${expectedGrossDamage.toFixed(1)}\n` +
      `${indent}  dud rate       ${((dist[0] ?? 0) * 100).toFixed(1)}%  |  mean length ${meanLength.toFixed(2)} hits`,
  );
}

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — analytic ledger: what the equal-EV math promises, and what it costs ==========\n");
  console.log(
    `  Every attacker profile is normalized to the SAME expected net value (${CHAIN_EV_TARGET_DAMAGE} damage), so a\n` +
      `  shorter fuse must land BIGGER individual hits to get there. That is not a side effect — it is\n` +
      `  forced by the normalization, and it is the concentration/legibility asymmetry a player sees.\n`,
  );

  console.log(`  -- reference attacker (damage ${REF_DAMAGE}, chainAffinity ${REF_AFFINITY.toFixed(1)}) — shapes without a hero confound --`);
  for (const profile of ATTACKER_PROFILES) {
    printAnalyticLedger(profile, REF_DAMAGE, REF_AFFINITY, CHAIN_EV_TARGET_DAMAGE, "  ");
  }

  console.log(`\n  -- as shipped, per hero (its own damage/chainAffinity/chainMagnitudeTarget) --`);
  for (const hero of PLAYER_HERO_POOL) {
    const baseStat = hero.healPerBeat ?? hero.damage;
    const backfire = backfireChanceFor(cfg.fight, hero.chainAffinity);
    const scale = chainMagnitudeScaleAbsolute(hero.chainProfile, backfire, baseStat, hero.chainMagnitudeTarget);
    const biggest = Math.round(
      baseStat *
        cfg.fight.chainHitMultiplier *
        chainEscalationFactorFromProfile(hero.chainProfile, hero.chainProfile.maxHits) *
        scale,
    );
    const dist = chainLengthDistribution(hero.chainProfile);
    const side = hero.healPerBeat ? "healer" : sideOf(hero.chainProfile.id);
    console.log(
      `    ${hero.name.padEnd(7)} ${hero.chainProfile.label.padEnd(13)} [${side.padEnd(7)}] ` +
        `target ${hero.chainMagnitudeTarget}  biggest hit ${String(biggest).padStart(4)}  ` +
        `dud ${((dist[0] ?? 0) * 100).toFixed(1)}%  net EV units ${expectedNetChainUnits(hero.chainProfile, backfire).toFixed(2)}`,
    );
  }

  const burstBiggest = Math.max(
    ...BURSTER_PROFILES.map((p) => {
      const s = chainMagnitudeScaleAbsolute(p, backfireChanceFor(cfg.fight, REF_AFFINITY), REF_DAMAGE, CHAIN_EV_TARGET_DAMAGE);
      return chainAttackMagnitude(cfg.fight, p, REF_DAMAGE, s, p.maxHits);
    }),
  );
  const grindBiggest = Math.max(
    ...GRINDER_PROFILES.map((p) => {
      const s = chainMagnitudeScaleAbsolute(p, backfireChanceFor(cfg.fight, REF_AFFINITY), REF_DAMAGE, CHAIN_EV_TARGET_DAMAGE);
      return chainAttackMagnitude(cfg.fight, p, REF_DAMAGE, s, p.maxHits);
    }),
  );
  const burstDud = mean(BURSTER_PROFILES.map((p) => chainLengthDistribution(p)[0] ?? 0));
  const grindDud = mean(GRINDER_PROFILES.map((p) => chainLengthDistribution(p)[0] ?? 0));
  console.log(
    `\n  READ: on identical expected value, burster's biggest single hit is ${burstBiggest} vs grinder's ${grindBiggest} ` +
      `(${(burstBiggest / Math.max(1, grindBiggest)).toFixed(2)}x),\n` +
      `  and burster duds ${(burstDud * 100).toFixed(1)}% of the time vs grinder's ${(grindDud * 100).toFixed(1)}%. ` +
      `Burster is louder AND more often nothing —\n  both by construction. If Blocks 2-4 find no outcome edge, THIS is what the feeling is tracking.\n`,
  );
}

// =========================================================================
// BLOCK 2 — Shape-isolated, single fights. Extends chainLeverage.ts's Block 3
// rig: one hero's chainProfile is the ONLY thing that varies, its charge is
// preloaded so the chain reliably fires, fightIndex=0 so no difficulty ramp
// confounds rows, and every cell runs the identical seed sequence.
//
// Two additions over that block: a second FIRE-TIMING arm (the chain fires
// mid-fight rather than at t=0, which is where a front-loaded shape's tempo
// advantage would have to show up), and the chainOutcomes decomposition per
// cell, so a margin arrives with its mechanism attached.
// =========================================================================

const FIRING_SQUAD = ["bracer", "rook", "cairn"]; // tank / damage (shape varies) / support
const FIRING_HERO_BASE_ID = "rook";

/** Fire timings, as a fraction of chargeThreshold the firing hero starts at.
 * "immediate" reproduces chainLeverage.ts's Block 3 exactly (threshold-1, fires
 * on the first eligible tick). "midFight" starts the hero low enough that it
 * has to earn the rest in combat, so the chain lands against an already-hurt
 * enemy with less fight left to spend the payoff in. */
const FIRE_TIMINGS = [
  { id: "immediate", label: "fires at t~0", startCharge: cfg.fight.chargeThreshold - 1 },
  { id: "midFight", label: "fires mid-fight", startCharge: Math.round(cfg.fight.chargeThreshold * 0.6) },
];

function preloadedFiringSquad(profile: ChainProfile, startCharge: number): SideState {
  const side = makePlayerSide(FIRING_SQUAD);
  return {
    ...side,
    heroes: side.heroes.map((h) =>
      baseHeroId(h.id) === FIRING_HERO_BASE_ID ? { ...h, chainProfile: profile, charge: startCharge } : h,
    ),
  };
}

interface Block2Cell {
  winRate: number;
  fireRate: number;
  row: ChainOutcomeRow | undefined;
}

function runBlock2Cell(encounterIdx: number, profile: ChainProfile, startCharge: number, seedBase: number, n: number): Block2Cell {
  const agg = new ChainOutcomeAggregator(cfg);
  let wins = 0;
  let fired = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const setup: FightSetup = {
      player: preloadedFiringSquad(profile, startCharge),
      enemy: makeEncounterEnemySide(cfg, 0, encounterIdx),
    };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    if (result.ignited) fired++;
    agg.add(result);
  }
  const rows = agg.finalize().rows.filter((r) => r.profileId === profile.id);
  return { winRate: wins / n, fireRate: fired / n, row: rows[0] };
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — shape-isolated: encounter x shape x fire-timing, one hero's profile only ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  console.log(
    `  Firing hero: Rook (damage). Bracer/Cairn start at 0 charge as normal, so this isolates ONE\n` +
      `  hero's shape rather than "a chain-heavy fight in general." n=${cellN}/cell, seeds from 500_000.\n`,
  );

  let seedBase = 500_000;
  const pooledByTiming: Record<string, { burster: ChainOutcomeRow[]; grinder: ChainOutcomeRow[] }> = {};
  const marginsByTiming: Record<string, { burst: number; grind: number }> = {};
  let worstFireRate = 1;

  for (const timing of FIRE_TIMINGS) {
    console.log(`  -- fire timing: ${timing.label} (start charge ${timing.startCharge}/${cfg.fight.chargeThreshold}) --\n`);
    const header =
      "  encounter".padEnd(16) + ATTACKER_PROFILES.map((p) => p.label.padStart(15)).join("") + "   burst-grind";
    console.log(header);

    const pooled = { burster: [] as ChainOutcomeRow[], grinder: [] as ChainOutcomeRow[] };
    const burstRates: number[] = [];
    const grindRates: number[] = [];

    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const cells = ATTACKER_PROFILES.map((profile) => {
        const cell = runBlock2Cell(ei, profile, timing.startCharge, seedBase, cellN);
        seedBase += cellN;
        return { profile, cell };
      });
      for (const { profile, cell } of cells) {
        worstFireRate = Math.min(worstFireRate, cell.fireRate);
        if (cell.row) pooled[sideOf(profile.id)].push(cell.row);
      }
      const burst = mean(cells.filter((c) => sideOf(c.profile.id) === "burster").map((c) => c.cell.winRate));
      const grind = mean(cells.filter((c) => sideOf(c.profile.id) === "grinder").map((c) => c.cell.winRate));
      burstRates.push(burst);
      grindRates.push(grind);
      const margin = (burst - grind) * 100;
      console.log(
        `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
          cells.map((c) => `${(c.cell.winRate * 100).toFixed(1)}%`.padStart(15)).join("") +
          `   ${margin >= 0 ? "+" : ""}${margin.toFixed(1)}pt`,
      );
    }

    const burstPooled = mean(burstRates);
    const grindPooled = mean(grindRates);
    marginsByTiming[timing.id] = { burst: burstPooled, grind: grindPooled };
    pooledByTiming[timing.id] = pooled;
    const margin = (burstPooled - grindPooled) * 100;
    console.log(
      `\n  READ (${timing.label}): pooled burster ${(burstPooled * 100).toFixed(1)}% vs grinder ${(grindPooled * 100).toFixed(1)}% ` +
        `= ${margin >= 0 ? "+" : ""}${margin.toFixed(1)}pt for ${margin >= 0 ? "burster" : "grinder"}.\n`,
    );

    console.log(`  -- mechanism decomposition, pooled by fuse length (${timing.label}) --`);
    for (const side of ["burster", "grinder"] as const) {
      const rows = pooledByTiming[timing.id]![side];
      if (rows.length === 0) continue;
      console.log(formatChainOutcomeRow(poolRows(rows, pooledName(rows), side), "    "));
    }
    console.log("");

    effectSizes.push({
      label: `Block 2 (${timing.label}): pooled burster vs grinder (single-fight win rate)`,
      p1: burstPooled,
      p2: grindPooled,
    });
  }

  console.log(
    `  fire-rate sanity: lowest cell fired ${(worstFireRate * 100).toFixed(1)}% of the time ` +
      `(want >=95% — a flat matrix built from\n  fights where nothing fired would be flat for the wrong reason).\n`,
  );

  // The tempo question, stated as a comparison rather than left implicit: if
  // front-loading is worth more than the equal-EV math prices, the burster
  // margin should GROW when the chain has less fight left to spend itself in.
  const immediate = marginsByTiming.immediate;
  const midFight = marginsByTiming.midFight;
  if (immediate && midFight) {
    const m1 = (immediate.burst - immediate.grind) * 100;
    const m2 = (midFight.burst - midFight.grind) * 100;
    console.log(
      `  READ (tempo): burster's margin is ${m1 >= 0 ? "+" : ""}${m1.toFixed(1)}pt when the chain fires at t~0 and ` +
        `${m2 >= 0 ? "+" : ""}${m2.toFixed(1)}pt when it fires mid-fight\n  (delta ${(m2 - m1 >= 0 ? "+" : "")}${(m2 - m1).toFixed(1)}pt). ` +
        `${Math.abs(m2 - m1) < VERDICT_BAR_PT ? "Fire timing does not change which shape wins — front-loading is not buying tempo here." : "Fire timing DOES change the margin — front-loading's value depends on how much fight is left."}\n`,
    );
  }
}

// =========================================================================
// BLOCK 3 — Pick-level, full runs. The one number that answers "would always
// picking burster win more RUNS." Holds every hero's stats fixed and moves only
// each non-healer's chainProfile, so the draft and the encounters are identical
// across arms and the delta is shape's alone. Re-runs the paired arms the
// retired batch/enrageLeverage.ts built, now under the post-CLOCK/WOUNDED-
// removal config, with the decomposition and permanent-death cost attached.
// =========================================================================

// The default draft's three non-healer heroes; cairn/ward keep their own healer
// profiles, since a fuse-length axis on HEAL chains is not what "burster vs
// grinder" means. Same shape as chainLeverage.ts's SCRAMBLE_PROFILE_BY_ID (two
// profiles spread across three heroes) — and identical to the assignment the
// retired enrageLeverage.ts used, so the two reports' numbers stay comparable.
const BURST_PROFILE_BY_ID: Record<string, ChainProfile> = {
  bracer: CHAIN_PROFILES.shortFuseSteep,
  hollow: CHAIN_PROFILES.shortFuseSteep,
  rook: CHAIN_PROFILES.shortFuseFlat,
};
const GRIND_PROFILE_BY_ID: Record<string, ChainProfile> = {
  bracer: CHAIN_PROFILES.longFuseFlat,
  hollow: CHAIN_PROFILES.longFuseFlat,
  rook: CHAIN_PROFILES.longFuseSteep,
};

function withShapeProfiles(roster: RosterState, byId: Record<string, ChainProfile>): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => {
      const profile = byId[baseHeroId(h.id)];
      return profile ? { ...h, chainProfile: profile } : h;
    }),
  };
}

function attackerRows(arm: ArmResult): ChainOutcomeRow[] {
  return arm.chainOutcomes.rows.filter((r) => !r.healer);
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — pick-level: burst-leaning vs grind-leaning draft, full runs ==========\n");
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 560_000 + i);
  console.log(
    `  Default draft, always-heal, identical seeds. Only the three non-healers' chainProfile changes —\n` +
      `  every stat, the draft, the fielding heuristic and the encounter sequence are held fixed.\n` +
      `  n=${n} runs/arm, seeds from 560_000.\n`,
  );

  const shipped = block3BaselineArm ?? runArm(`shipped assignment n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(shipped, undefined, HEALER_IDS);

  const burst = runArm(`burst-leaning n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withShapeProfiles(r, BURST_PROFILE_BY_ID),
  );
  printArm(burst, shipped, HEALER_IDS);

  const grind = runArm(`grind-leaning n=${n}`, cfg, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withShapeProfiles(r, GRIND_PROFILE_BY_ID),
  );
  printArm(grind, shipped, HEALER_IDS);
  printArm(grind, burst, undefined);

  console.log("  -- mechanism decomposition, attacker chains only (healer rows excluded: HP-restored units) --");
  for (const [label, arm] of [
    ["burst-leaning", burst],
    ["grind-leaning", grind],
  ] as [string, ArmResult][]) {
    const rows = attackerRows(arm);
    if (rows.length === 0) continue;
    console.log(`    == ${label} ==`);
    console.log(formatChainOutcomeRow(poolRows(rows, pooledName(rows), label), "    "));
  }
  console.log("");

  const burstStats = chainOutcomeStats(poolRows(attackerRows(burst), "burster", "burster"));
  const grindStats = chainOutcomeStats(poolRows(attackerRows(grind), "grinder", "grinder"));

  console.log(
    `  -- the three things the equal-EV math cannot see --\n` +
      `    EV realization (realized / analytic E[gross]):  burster ${(burstStats.evRealization * 100).toFixed(1)}%  ` +
      `grinder ${(grindStats.evRealization * 100).toFixed(1)}%\n` +
      `    overkill spilled past the last body:      burster ${(burstStats.spillFraction * 100).toFixed(1)}%  ` +
      `grinder ${(grindStats.spillFraction * 100).toFixed(1)}%\n` +
      `    chains cut short (fight end or lockout):  burster ${(burstStats.cutShortRate * 100).toFixed(1)}%  ` +
      `grinder ${(grindStats.cutShortRate * 100).toFixed(1)}%\n` +
      `    hot-hero-death LOCKOUT rate:              burster ${(burstStats.lockoutRate * 100).toFixed(1)}%  ` +
      `grinder ${(grindStats.lockoutRate * 100).toFixed(1)}%  ` +
      `(mean ${burstStats.meanLockedOutSec.toFixed(1)}s / ${grindStats.meanLockedOutSec.toFixed(1)}s dead)\n` +
      `    player deaths per backfire:               burster ${burstStats.deathsPerBackfire.toFixed(2)}  ` +
      `grinder ${grindStats.deathsPerBackfire.toFixed(2)}  (permanent for the run)\n` +
      `    deaths/run overall:                       burster ${burst.report.meanDeathsPerRun.toFixed(2)}  ` +
      `grinder ${grind.report.meanDeathsPerRun.toFixed(2)}\n` +
      `    mean fight duration:                      burster ${burst.report.meanFightDurationSec.toFixed(2)}s  ` +
      `grinder ${grind.report.meanFightDurationSec.toFixed(2)}s\n`,
  );

  // --- The verdict, against the bar set before any of this ran. -------------
  const marginPt = (burst.report.runCompletionRate - grind.report.runCompletionRate) * 100;
  const onlyBurst = burst.completed.filter((c, i) => c && !grind.completed[i]).length;
  const onlyGrind = grind.completed.filter((c, i) => c && !burst.completed[i]).length;
  const z = onlyBurst + onlyGrind > 0 ? (onlyBurst - onlyGrind) / Math.sqrt(onlyBurst + onlyGrind) : 0;

  console.log(`  ===== VERDICT (bar pre-registered at ${VERDICT_BAR_PT}pt completion and |z|>=${VERDICT_BAR_Z}) =====\n`);
  console.log(
    `    burst-leaning ${(burst.report.runCompletionRate * 100).toFixed(1)}% vs grind-leaning ` +
      `${(grind.report.runCompletionRate * 100).toFixed(1)}% run completion\n` +
      `    margin ${marginPt >= 0 ? "+" : ""}${marginPt.toFixed(1)}pt for ${marginPt >= 0 ? "burster" : "grinder"}, ` +
      `McNemar onlyBurst=${onlyBurst} onlyGrind=${onlyGrind} z=${z.toFixed(2)}\n`,
  );
  const clearsBar = Math.abs(marginPt) >= VERDICT_BAR_PT;
  const clearsZ = Math.abs(z) >= VERDICT_BAR_Z;
  if (clearsBar && clearsZ && marginPt > 0) {
    console.log(
      `    -> "burster is obviously better" is RIGHT. The equal-EV normalization is incomplete;\n` +
        `       the decomposition above names which unpriced mechanism is paying for it.\n`,
    );
  } else if (clearsBar && clearsZ && marginPt < 0) {
    console.log(
      `    -> "burster is obviously better" is WRONG, AND REVERSED — grinder wins on outcomes.\n` +
        `       Burster is a trap (duds and concentrated backfire); that is a thing to teach, not to fix.\n`,
    );
  } else if (clearsBar) {
    // Deliberately NOT folded into the "outcome-equivalent" branch: a margin
    // past the bar whose paired test hasn't caught up is an UNDERPOWERED
    // measurement, not a null result. Expected on --quick (n=75); at the full
    // n=1500 a margin this size clears |z|>=2 comfortably, so seeing this on a
    // full run means the margin is genuinely marginal.
    console.log(
      `    -> INCONCLUSIVE at this n: the margin clears the ${VERDICT_BAR_PT}pt bar but the paired test does not\n` +
        `       reach |z|>=${VERDICT_BAR_Z} (${Math.abs(z).toFixed(2)}). Underpowered, not equivalent — re-run without --quick before\n` +
        `       reading a verdict off this.\n`,
    );
  } else {
    console.log(
      `    -> "burster is obviously better" is WRONG ON WIN RATE — the shapes are outcome-equivalent\n` +
        `       within the bar. The feeling is tracking Block 1's concentration asymmetry (louder hits,\n` +
        `       more duds), not outcomes. Chain shape needs a CONDITIONAL price, not a rebalance.\n`,
    );
  }

  effectSizes.push(
    {
      label: "Block 3: burst-leaning vs grind-leaning (run completion)",
      p1: burst.report.runCompletionRate,
      p2: grind.report.runCompletionRate,
    },
    {
      label: "Block 3: burst-leaning vs grind-leaning (fight 5 win rate)",
      p1: burst.report.winRateByFightIndex[4]!,
      p2: grind.report.winRateByFightIndex[4]!,
    },
  );
}

// =========================================================================
// BLOCK 4 — Perceptibility. Pure arithmetic on Blocks 2-3's own numbers; no
// new simulation. This is what separates "the feeling tracks a real edge" from
// "the feeling tracks something other than the win rate": if the margin needs
// hundreds of runs to notice, it is not what Tu felt after a dozen.
// =========================================================================

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — perceptibility: runs needed to notice the burster/grinder margin ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so Blocks 2-3's effect sizes are available)\n");
  } else {
    console.log("  Two-proportion power estimate (alpha=0.05 two-sided, 80% power) — see arm.ts's runsToDetect.\n");
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("shape-verdict sweep complete.");
