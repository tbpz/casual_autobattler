/**
 * Answers the question CHAIN_SHAPE_TARGETING_PLAN.md's §4 gate poses: does
 * replacing chain SHAPE (when damage arrives) with chain TARGETING (where it
 * goes) actually create a real pick-time axis, or does it fail the same way
 * shape did?
 *
 * The pre-registered bar (§4, and DECISIONS.md's 2026-09-02 entry):
 *   - per encounter, the gap between the best targeting rule and the worst
 *     must be >= 15 win-rate points (or, on an encounter too easy for win
 *     rate to move at all, >= 10 points of HP-left-at-end);
 *   - pooled across the whole 11-encounter pool, no rule may average more
 *     than 5 points better than another — a real per-fight axis, not a
 *     hidden dominance ladder.
 * Both halves have to hold. Spread without a flat average is a dominance
 * ladder; a flat average without spread is chain shape again.
 *
 * This is a REPORT, not a check — same discipline batch/shapeVerdict.ts and
 * batch/chainLeverage.ts already established: it answers an open question
 * rather than pinning a known-good value, so it stays out of `npm run check`
 * (wired as `npm run measure:targeting`).
 *
 * Seed block 600_000-699_999 is reserved for this file (disjoint from
 * checks/chaindist.ts's <=93_599, batch/affinity.ts's 200_000-239_999,
 * batch/chainLeverage.ts's 300_000-399_999, the retired
 * batch/enrageLeverage.ts's 400_000-419_999, and batch/shapeVerdict.ts's
 * 500_000-599_999). Allocation within the block:
 *   Preamble self-verification:      690_000 + 25*3           -> 690_074
 *   Block 2 (per-encounter matrix):  600_000 .. 679_199        (11 x 6 x 2 x 600)
 *   Block 3 (full-run arms):         680_000 + 1500 x 4        -> 685_999
 *
 * Same honest limitation as every other report in this directory: runFight/
 * runRun share one Rng across whatever they simulate, so two arms differing
 * in ANY way diverge their dice from that point onward. Every comparison
 * below is a POPULATION comparison over identical seed sequences, never a
 * claim about what one specific seed "would have done" under the road not
 * taken. Turning chainTargetingEnabled on also means a backfire stops
 * consuming the RNG stream via pickWeightedTargetId for every rule but
 * "front" (fight.ts's pickChainTargetId) — one more reason arms compare
 * statistically, not seed-by-seed.
 */
import { Rng } from "../sim/rng.js";
import {
  DEFAULT_RUN_CONFIG,
  backfireChanceFor,
  chainMagnitudeScaleAbsolute,
  type ChainProfile,
  type ChainTargeting,
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
import { ChainOutcomeAggregator, chainOutcomeStats, type ChainOutcomeRow } from "./chainOutcomes.js";

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
// itself, NOT for trusting the printed numbers. Real answers need the full
// n's; at n=75 the shape-verdict measurement pointed the opposite way to the
// truth, and this rig has no reason to be more forgiving.
const QUICK_DIVISOR = args.quick ? 20 : 1;
const BLOCK = (args.block as "1" | "2" | "3" | "4" | "all") ?? "all";

const cfgOff: RunConfig = DEFAULT_RUN_CONFIG;
const cfgOn: RunConfig = { ...DEFAULT_RUN_CONFIG, fight: { ...DEFAULT_RUN_CONFIG.fight, chainTargetingEnabled: true } };
const HEALER_IDS = new Set(PLAYER_HERO_POOL.filter((h) => h.healPerBeat).map((h) => h.id));

/** Per-encounter bar: best rule minus worst rule. Read in win-rate points on
 * an encounter where today's win rate falls in [10%,90%]; read as HP-left
 * points (0-100 scale) everywhere else, since win rate is pinned near 100%
 * on fights 1-4 and literally cannot move by 15 points there (§4's gate,
 * pre-registered before Block 2 runs). */
const PER_ENCOUNTER_BAR_PT = 15;
const PER_ENCOUNTER_HP_BAR_PT = 10;
/** Pooled across the whole encounter pool: no rule may average more than
 * this many points better than another, win rate or HP-left. A flat
 * pool-wide average with real per-encounter spread is the whole point —
 * see this file's header. */
const POOLWIDE_BAR_PT = 5;
/** Q8's pre-registered floor, checked in Block 1 before Block 2 is read
 * (see the "Q8 ordering rule" print below): if spread converts less than
 * this fraction of a full chain into its own labelled-best encounters
 * (Pack, Ambush), that is a tuning fault in Bracer's curve, not a verdict
 * on targeting, and Block 2's per-encounter bar would report the wrong
 * thing. */
const Q8_MIN_SPREAD_CONVERSION = 0.4;

const ATTACKER_RULES: Exclude<ChainTargeting, "front" | "triage">[] = ["spread", "focus", "siege", "execute"];
/** The five chainTargetingEnabled columns Block 2 sweeps, "front" included
 * as the in-system control (today's rule, but with overkill-spill also
 * switched off — see config.ts's chainHitSpills, which couples spill to
 * chainTargetingEnabled globally, not per-rule). "today" (cfgOff) is a SIXTH,
 * separate column — see runBlock2Cell's caller. */
const ON_RULES: ChainTargeting[] = ["front", ...ATTACKER_RULES];

const effectSizes: { label: string; p1: number; p2: number }[] = [];

// --- Self-verification preamble — abort the sweep if any fails ----------------

/** A roster transform that maps each hero's chainTargeting to its OWN rule —
 * proves the rig's transform hook is inert, the same proof shapeVerdict.ts's
 * verifySelfProfileTransformIsInert makes for chainProfile. Run under cfgOn:
 * this is what makes any Block 2/3 delta attributable to the rule swap alone. */
function identityTargetingTransform(roster: RosterState): RosterState {
  return { ...roster, heroes: roster.heroes.map((h) => ({ ...h, chainTargeting: h.chainTargeting })) };
}

function verifySelfTargetingTransformIsInert(): boolean {
  const policy = makePolicy("always-heal", cfgOn);
  for (let i = 0; i < 25; i++) {
    const seed = 690_000 + i;
    const base = runRun(cfgOn, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    const transformed = runRun(
      cfgOn,
      new Rng(seed),
      policy,
      seed,
      identityTargetingTransform(makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)),
    );
    if (JSON.stringify(base.fights) !== JSON.stringify(transformed.fights)) {
      console.error(
        `FAIL: a chainTargeting transform mapping each hero to its OWN rule diverged from no transform at seed ${seed}`,
      );
      return false;
    }
  }
  console.log(
    "PASS: a chainTargeting transform that maps each hero to its own rule is byte-identical to no transform, over 25 seeds",
  );
  return true;
}

/** With the flag OFF, no chainHit may ever carry targetId: null — the whiff
 * path belongs entirely to the four new rules, none of which chainOff can
 * reach (resolveChainPlan forces "front"/"triage"). This is the in-file half
 * of the byte-identical-when-off proof; the stronger half (a full event-log
 * diff against the pre-Phase-1 commit) was run once by hand, outside this
 * rig — see the Phase 1 commit message. */
function verifyWhiffDeadWhenOff(): boolean {
  const policy = makePolicy("always-heal", cfgOff);
  for (let i = 0; i < 25; i++) {
    const seed = 690_100 + i;
    const result = runRun(cfgOff, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    for (const fr of result.fightResults) {
      for (const e of fr.events) {
        if (e.type === "chainHit" && e.targetId === null) {
          console.error(`FAIL: a chainHit with targetId: null occurred with chainTargetingEnabled: false, seed ${seed}`);
          return false;
        }
      }
    }
  }
  console.log("PASS: no chain hit whiffs with chainTargetingEnabled: false, over 25 seeds — the flag-off path never reaches it");
  return true;
}

/** The counterpart to the check above: with the flag ON, the whiff path must
 * actually be reachable, or the rig would be measuring rules that never do
 * anything different from front-most. */
function verifyWhiffLiveWhenOn(): boolean {
  const policy = makePolicy("always-heal", cfgOn);
  let sawWhiff = false;
  for (let i = 0; i < 25 && !sawWhiff; i++) {
    const seed = 690_200 + i;
    const result = runRun(cfgOn, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS));
    for (const fr of result.fightResults) {
      for (const e of fr.events) {
        if (e.type === "chainHit" && e.targetId === null) {
          sawWhiff = true;
          break;
        }
      }
      if (sawWhiff) break;
    }
  }
  console.log(
    `${sawWhiff ? "PASS" : "FAIL"}: at least one chain hit whiffs with chainTargetingEnabled: true, within 25 seeds`,
  );
  return sawWhiff;
}

/** Every chainStart must pair with exactly one chainEnd under targeting too —
 * same wiring check shapeVerdict.ts runs for shape. */
function verifyChainOutcomeWiring(): boolean {
  const policy = makePolicy("always-heal", cfgOn);
  const agg = new ChainOutcomeAggregator(cfgOn);
  for (let i = 0; i < 25; i++) {
    const seed = 690_000 + i;
    agg.addRun(runRun(cfgOn, new Rng(seed), policy, seed, makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS)).fightResults);
  }
  const { chainStartCount, chainEndCount } = agg.finalize();
  const ok = chainStartCount === chainEndCount && chainStartCount > 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}: chainOutcomes pairs every chainStart with exactly one chainEnd under targeting — ` +
      `${chainStartCount} starts, ${chainEndCount} ends`,
  );
  return ok;
}

let block3BaselineArm: ArmResult | undefined;

/** cfgOff must still reproduce checks/chaindist.ts's pinned band — the
 * flag-off arm is the control every other arm in Block 3 is read against. */
function verifyBaselineMatchesChaindistBand(): boolean {
  const seeds = Array.from({ length: Math.max(1, Math.round(1500 / QUICK_DIVISOR)) }, (_, i) => 680_000 + i);
  block3BaselineArm = runArm(`today (shipped, targeting off) n=${seeds.length}`, cfgOff, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  const rate = block3BaselineArm.report.runCompletionRate;
  const ok = rate >= 0.15 && rate <= 0.4;
  console.log(
    `${ok ? "PASS" : "FAIL"}: baseline arm (targeting off) reproduces checks/chaindist.ts's pinned default-draft ` +
      `completion band [15%,40%] — got ${(rate * 100).toFixed(1)}%`,
  );
  return ok;
}

/** Every pool healer authors "triage" and every pool attacker authors
 * something else — resolveChainPlan trusts this (it only forces "triage" on
 * a healer, never checks it), so an author who gave a healer a non-triage
 * rule would have it silently ignored rather than flagged. Static, no
 * simulation. */
function verifyAuthoringSanity(): boolean {
  let ok = true;
  for (const h of PLAYER_HERO_POOL) {
    const shouldBeTriage = Boolean(h.healPerBeat);
    const isTriage = h.chainTargeting === "triage";
    if (shouldBeTriage !== isTriage) {
      console.error(`FAIL: ${h.name} is ${shouldBeTriage ? "a healer without" : "an attacker with"} chainTargeting: "triage"`);
      ok = false;
    }
  }
  console.log(`${ok ? "PASS" : "FAIL"}: every pool healer authors "triage", every attacker authors a real rule`);
  return ok;
}

const preambleOk =
  verifySelfTargetingTransformIsInert() &&
  verifyWhiffDeadWhenOff() &&
  verifyWhiffLiveWhenOn() &&
  verifyChainOutcomeWiring() &&
  verifyBaselineMatchesChaindistBand() &&
  verifyAuthoringSanity();
if (!preambleOk) {
  console.error("\ntargeting-verdict sweep ABORTED — self-verification failed, arms below would not be measuring what they claim");
  process.exit(1);
}
console.log("");

// =========================================================================
// BLOCK 1 — The analytic ledger. No simulation: walks each rule against each
// encounter's static enemy HP vector (bruisers first, then grunts — the same
// order fight.ts's frontMostAliveId/applyDamageFrom consume) and a full-fuse
// escalating hit schedule, deterministically. This is where Q8's claim gets
// checked BEFORE Block 2 runs — see the banner below.
// =========================================================================

/** A fixed reference attacker so rules compare without a hero confound:
 * damage 6 at chainAffinity 1.0 — the same pool-agnostic anchor
 * shapeVerdict.ts's Block 1 uses. */
const REF_DAMAGE = 6;
const REF_AFFINITY = 1.0;

function magnitudeSchedule(profile: ChainProfile, damage: number, affinity: number, target: number): number[] {
  const backfire = backfireChanceFor(cfgOn.fight, affinity);
  const scale = chainMagnitudeScaleAbsolute(profile, backfire, damage, target);
  const out: number[] = [];
  for (let n = 1; n <= profile.maxHits; n++) out.push(chainAttackMagnitude(cfgOn.fight, profile, damage, scale, n));
  return out;
}

interface LedgerResult {
  realized: number;
  wasted: number;
  kills: number;
  whiffs: number;
  hitsLanded: number;
}

/** Deterministic, no-RNG walk of one targeting rule against a static body-HP
 * vector and a full escalating hit schedule — the arithmetic counterpart of
 * fight.ts's resolveChainHit, minus the RNG-gated continuation roll (every
 * hit in the schedule is assumed to fire) and minus any interaction with the
 * hero's own normal attacks (see Block 2's note on why this is an upper
 * bound, not a prediction). Overkill never spills (matches
 * chainHitSpills(cfg) once chainTargetingEnabled is true). */
function walkRule(rule: ChainTargeting, bodyHpsIn: number[], schedule: number[]): LedgerResult {
  const hp = [...bodyHpsIn];
  let realized = 0;
  let wasted = 0;
  let kills = 0;
  let whiffs = 0;
  let hitsLanded = 0;
  const struck = new Set<number>();
  let lockedIdx: number | null = null;
  if (rule === "focus") lockedIdx = hp.findIndex((h) => h > 0);
  if (rule === "execute") {
    let best = -1;
    for (let i = 0; i < hp.length; i++) if (hp[i]! > 0 && (best < 0 || hp[i]! < hp[best]!)) best = i;
    lockedIdx = best >= 0 ? best : null;
  }
  for (const magnitude of schedule) {
    let idx: number | null = null;
    if (rule === "front") {
      idx = hp.findIndex((h) => h > 0);
      idx = idx < 0 ? null : idx;
    } else if (rule === "spread") {
      idx = hp.findIndex((h, i) => h > 0 && !struck.has(i));
      idx = idx < 0 ? null : idx;
    } else if (rule === "focus" || rule === "execute") {
      idx = lockedIdx !== null && hp[lockedIdx]! > 0 ? lockedIdx : null;
    } else if (rule === "siege") {
      let best = -1;
      for (let i = 0; i < hp.length; i++) if (hp[i]! > 0 && (best < 0 || hp[i]! > hp[best]!)) best = i;
      idx = best >= 0 ? best : null;
    }
    if (idx === null) {
      whiffs++;
      wasted += magnitude;
      continue;
    }
    hitsLanded++;
    const applied = Math.min(hp[idx]!, magnitude);
    realized += applied;
    wasted += magnitude - applied;
    hp[idx]! -= applied;
    if (hp[idx]! <= 0) kills++;
    struck.add(idx);
  }
  return { realized, wasted, kills, whiffs, hitsLanded };
}

if (BLOCK === "1" || BLOCK === "all") {
  console.log("========== BLOCK 1 — analytic ledger: what each rule can realise on paper, encounter by encounter ==========\n");
  console.log(
    `  No simulation — a rule walked deterministically against each encounter's static enemy HP vector and a\n` +
      `  FULL-length escalating hit schedule (every hit assumed to fire). Upper bound, not a prediction: it omits\n` +
      `  the firing hero's own normal attacks, which routinely kill a focus/execute lock before the chain gets\n` +
      `  there (see Block 2's note). Reference attacker: damage ${REF_DAMAGE}, chainAffinity ${REF_AFFINITY.toFixed(1)}.\n`,
  );

  // Bracer's own shipped curve (longFuseFlat) is what Q8 is actually about —
  // the reference-attacker schedule above uses a different profile
  // (whichever ATTACKER_RULES maps to on the reference), so compute Bracer's
  // real schedule separately.
  const bracer = PLAYER_HERO_POOL.find((h) => h.id === "bracer")!;
  const bracerSchedule = magnitudeSchedule(bracer.chainProfile, bracer.damage, bracer.chainAffinity, bracer.chainMagnitudeTarget);
  const bracerScheduleSum = bracerSchedule.reduce((a, b) => a + b, 0);

  let q8Ok = true;
  const q8Rows: string[] = [];
  for (const targetName of ["Pack", "Ambush"]) {
    const ei = ENCOUNTERS.findIndex((e) => e.name === targetName);
    if (ei < 0) continue;
    const bodies = makeEncounterEnemySide(cfgOn, 0, ei).heroes.map((h) => h.maxHp);
    const res = walkRule("spread", bodies, bracerSchedule);
    const conversion = res.realized / bracerScheduleSum;
    q8Rows.push(
      `    Bracer/spread into ${targetName}: realises ${res.realized.toFixed(0)} of ${bracerScheduleSum.toFixed(0)} ` +
        `(${(conversion * 100).toFixed(1)}%), kills ${res.kills}/${bodies.length}, whiffs ${res.whiffs}`,
    );
    if (conversion < Q8_MIN_SPREAD_CONVERSION) q8Ok = false;
  }
  console.log(`  -- Q8: does spread convert enough of Bracer's own chain into its labelled-best fights? --`);
  console.log(q8Rows.join("\n") + "\n");
  if (!q8Ok) {
    console.log(
      `  *** Q8 ORDERING BANNER ***\n` +
        `  Spread converts less than ${(Q8_MIN_SPREAD_CONVERSION * 100).toFixed(0)}% of Bracer's chain into its own\n` +
        `  labelled-best encounter(s). That is a tuning fault in Bracer's curve, not a verdict on targeting —\n` +
        `  Block 2's ${PER_ENCOUNTER_BAR_PT}-point gate will report this fault as an answer about targeting unless\n` +
        `  it is fixed or explicitly accepted first. Read this banner before reading Block 2.\n`,
    );
  } else {
    console.log(`  Q8 clears the ${(Q8_MIN_SPREAD_CONVERSION * 100).toFixed(0)}% floor — Block 2's gate is safe to read at face value.\n`);
  }

  console.log(`  -- reference attacker, per rule x per encounter (realised / wasted / kills / whiffs) --`);
  const header = "  encounter".padEnd(16) + ATTACKER_RULES.map((r) => r.padStart(13)).join("");
  console.log(header);
  for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
    const bodies = makeEncounterEnemySide(cfgOn, 0, ei).heroes.map((h) => h.maxHp);
    const cells = ATTACKER_RULES.map((rule) => {
      const schedule = magnitudeSchedule(CHAIN_PROFILES.longFuseSteep, REF_DAMAGE, REF_AFFINITY, CHAIN_EV_TARGET_DAMAGE);
      return walkRule(rule, bodies, schedule);
    });
    console.log(
      `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
        cells.map((c) => `${c.realized.toFixed(0)}/${c.wasted.toFixed(0)}/${c.kills}/${c.whiffs}`.padStart(13)).join(""),
    );
  }
  console.log("");
}

// =========================================================================
// BLOCK 2 — every rule against every fight. Extends shapeVerdict.ts's Block
// 2 rig exactly: one hero's TARGETING (not chainProfile) is the only thing
// that varies, its charge is preloaded so the chain reliably fires,
// fightIndex=0 so no difficulty ramp confounds rows, and every cell runs the
// identical seed sequence.
//
// Six columns per encounter x fire-timing: "today" (chainTargetingEnabled
// off — Rook's rule is forced to "front" regardless of what's authored, and
// overkill still spills) plus five chainTargetingEnabled-on columns —
// "front" (the in-system control: same target pick as today, but overkill
// no longer spills, since chainHitSpills couples spill to the flag globally,
// not per rule) and the four new rules. Comparing "today" to "front" isolates
// the spill change by itself; comparing "front" to the other four isolates
// the rule change by itself.
// =========================================================================

const FIRING_SQUAD = ["bracer", "rook", "cairn"]; // tank / damage (rule varies) / support
const FIRING_HERO_BASE_ID = "rook";

const FIRE_TIMINGS = [
  { id: "immediate", label: "fires at t~0", startCharge: cfgOn.fight.chargeThreshold - 1 },
  { id: "midFight", label: "fires mid-fight", startCharge: Math.round(cfgOn.fight.chargeThreshold * 0.6) },
];

function preloadedFiringSquad(targeting: ChainTargeting | null, startCharge: number): SideState {
  const side = makePlayerSide(FIRING_SQUAD);
  return {
    ...side,
    heroes: side.heroes.map((h) =>
      baseHeroId(h.id) === FIRING_HERO_BASE_ID
        ? { ...h, chainTargeting: targeting ?? h.chainTargeting, charge: startCharge }
        : h,
    ),
  };
}

interface Block2Cell {
  winRate: number;
  fireRate: number;
  row: ChainOutcomeRow | undefined;
  meanPlayerHpFrac: number;
  meanDurationSec: number;
  /** Fraction of the FIRING hero's own chain hits (identified by sourceId,
   * not by profileId — several heroes can share a chain shape) that whiffed.
   * A metric this rig owns rather than one redefined on chainOutcomes.ts —
   * see fight.ts's Phase 1 commit and this file's header on why an
   * all-whiff chain isn't a "dud" and a whiff isn't "spill" in the existing
   * aggregator's sense. */
  whiffRate: number;
}

function runBlock2Cell(
  encounterIdx: number,
  cfg: RunConfig,
  targeting: ChainTargeting | null,
  startCharge: number,
  seedBase: number,
  n: number,
): Block2Cell {
  const agg = new ChainOutcomeAggregator(cfg);
  let wins = 0;
  let fired = 0;
  let sumHpFrac = 0;
  let sumDurationSec = 0;
  let hits = 0;
  let whiffs = 0;
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const player = preloadedFiringSquad(targeting, startCharge);
    const firingId = player.heroes.find((h) => baseHeroId(h.id) === FIRING_HERO_BASE_ID)!.id;
    const setup: FightSetup = { player, enemy: makeEncounterEnemySide(cfg, 0, encounterIdx) };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    if (result.outcome === "win") wins++;
    if (result.ignited) fired++;
    const maxHp = result.finalPlayerHeroes.reduce((s, h) => s + h.maxHp, 0);
    const hp = result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0);
    sumHpFrac += maxHp > 0 ? hp / maxHp : 0;
    sumDurationSec += result.durationSec;
    for (const e of result.events) {
      if (e.type === "chainHit" && e.sourceId === firingId) {
        hits++;
        if (e.targetId === null) whiffs++;
      }
    }
    agg.add(result);
  }
  const firingHeroDef = PLAYER_HERO_POOL.find((h) => h.id === FIRING_HERO_BASE_ID)!;
  const rows = agg.finalize().rows.filter((r) => r.profileId === firingHeroDef.chainProfile.id);
  return {
    winRate: wins / n,
    fireRate: fired / n,
    row: rows[0],
    meanPlayerHpFrac: sumHpFrac / n,
    meanDurationSec: sumDurationSec / n,
    whiffRate: hits > 0 ? whiffs / hits : 0,
  };
}

if (BLOCK === "2" || BLOCK === "all") {
  console.log("========== BLOCK 2 — every rule against every fight: encounter x rule x fire-timing, one hero's rule only ==========\n");
  const cellN = Math.max(20, Math.round(600 / QUICK_DIVISOR));
  console.log(
    `  Firing hero: Rook (damage; chainProfile/damage/chainAffinity held fixed — only chainTargeting moves).\n` +
      `  Bracer/Cairn start at 0 charge as normal, so this isolates ONE hero's rule rather than "a chain-heavy\n` +
      `  fight in general." n=${cellN}/cell, seeds from 600_000.\n`,
  );

  let seedBase = 600_000;
  const pooledWinRateByRule: Record<string, number[]> = {};
  let worstFireRate = 1;

  for (const timing of FIRE_TIMINGS) {
    console.log(`  -- fire timing: ${timing.label} (start charge ${timing.startCharge}/${cfgOn.fight.chargeThreshold}) --\n`);
    const header = "  encounter".padEnd(16) + "today".padStart(9) + ON_RULES.map((r) => r.padStart(9)).join("") + "  eligible  gate";
    console.log(header);

    for (let ei = 0; ei < ENCOUNTERS.length; ei++) {
      const todayCell = runBlock2Cell(ei, cfgOff, null, timing.startCharge, seedBase, cellN);
      seedBase += cellN;
      const onCells = ON_RULES.map((rule) => {
        const cell = runBlock2Cell(ei, cfgOn, rule, timing.startCharge, seedBase, cellN);
        seedBase += cellN;
        return { rule, cell };
      });
      for (const { cell } of onCells) worstFireRate = Math.min(worstFireRate, cell.fireRate);
      worstFireRate = Math.min(worstFireRate, todayCell.fireRate);

      for (const { rule, cell } of onCells) {
        (pooledWinRateByRule[rule] ??= []).push(cell.winRate);
      }

      const winRates = onCells.map((c) => c.cell.winRate);
      const hpFracs = onCells.map((c) => c.cell.meanPlayerHpFrac);
      const winSpreadPt = (Math.max(...winRates) - Math.min(...winRates)) * 100;
      const hpSpreadPt = (Math.max(...hpFracs) - Math.min(...hpFracs)) * 100;
      const eligible = todayCell.winRate > 0.1 && todayCell.winRate < 0.9;
      const spreadPt = eligible ? winSpreadPt : hpSpreadPt;
      const bar = eligible ? PER_ENCOUNTER_BAR_PT : PER_ENCOUNTER_HP_BAR_PT;
      const clears = spreadPt >= bar;
      console.log(
        `  ${ENCOUNTERS[ei]!.name.padEnd(14)}` +
          `${(todayCell.winRate * 100).toFixed(0)}%`.padStart(9) +
          onCells.map((c) => `${(c.cell.winRate * 100).toFixed(0)}%`.padStart(9)).join("") +
          `  ${eligible ? "winRate " : "hpLeft  "}` +
          `${clears ? "PASS" : "FAIL"} (${spreadPt.toFixed(1)}pt vs ${bar}pt)`,
      );
      console.log(
        `  ${"hp%/dur/whiff%".padEnd(14)}` +
          " ".repeat(9) +
          onCells
            .map(
              (c) =>
                `${(c.cell.meanPlayerHpFrac * 100).toFixed(0)}/${c.cell.meanDurationSec.toFixed(0)}/${(c.cell.whiffRate * 100).toFixed(0)}`.padStart(9),
            )
            .join(""),
      );
    }
    console.log("");
  }

  console.log(
    `  fire-rate sanity: lowest cell fired ${(worstFireRate * 100).toFixed(1)}% of the time ` +
      `(want >=95% — a flat matrix built from\n  fights where nothing fired would be flat for the wrong reason).\n`,
  );

  console.log(`  -- pool-wide mean win rate per rule, across all 11 encounters x 2 timings --`);
  const poolMeans = ON_RULES.map((rule) => ({ rule, mean: mean(pooledWinRateByRule[rule] ?? []) }));
  for (const { rule, mean: m } of poolMeans) console.log(`    ${rule.padEnd(8)} ${(m * 100).toFixed(1)}%`);
  const poolSpreadPt = (Math.max(...poolMeans.map((p) => p.mean)) - Math.min(...poolMeans.map((p) => p.mean))) * 100;
  console.log(
    `\n  POOL-WIDE SPREAD: ${poolSpreadPt.toFixed(1)}pt (bar: <=${POOLWIDE_BAR_PT}pt) — ` +
      `${poolSpreadPt <= POOLWIDE_BAR_PT ? "PASS, no rule is simply better over a run" : "FAIL, one rule dominates pool-wide — Q5 arriving early"}\n`,
  );

  effectSizes.push({
    label: "Block 2: pool-wide widest-vs-narrowest rule (win rate)",
    p1: Math.max(...poolMeans.map((p) => p.mean)),
    p2: Math.min(...poolMeans.map((p) => p.mean)),
  });
}

// =========================================================================
// BLOCK 3 — full runs, four arms. Holds every hero's stats fixed and moves
// only each attacker's chainTargeting (healers stay on triage), so the draft
// and the encounter sequence are identical across arms and the delta is
// targeting's alone.
//
// Four arms, not the three the implementation plan first sketched: "targeting
// on" and "front-most everywhere" both change TWO things relative to today —
// the rule AND whether overkill spills (chainHitSpills couples spill to
// chainTargetingEnabled globally) — so neither alone can say which change did
// the work. The fourth arm isolates the spill change by itself.
// =========================================================================

const SHIPPED_TARGETING_BY_ID: Record<string, ChainTargeting> = Object.fromEntries(
  PLAYER_HERO_POOL.filter((h) => !h.healPerBeat).map((h) => [h.id, h.chainTargeting]),
);
const FRONT_EVERYWHERE_BY_ID: Record<string, ChainTargeting> = Object.fromEntries(
  PLAYER_HERO_POOL.filter((h) => !h.healPerBeat).map((h) => [h.id, "front" as ChainTargeting]),
);

function withTargeting(roster: RosterState, byId: Record<string, ChainTargeting>): RosterState {
  return {
    ...roster,
    heroes: roster.heroes.map((h) => {
      const targeting = byId[baseHeroId(h.id)];
      return targeting ? { ...h, chainTargeting: targeting } : h;
    }),
  };
}

function attackerRows(arm: ArmResult): ChainOutcomeRow[] {
  return arm.chainOutcomes.rows.filter((r) => !r.healer);
}

if (BLOCK === "3" || BLOCK === "all") {
  console.log("========== BLOCK 3 — full runs: today vs targeting-on vs front-everywhere vs spill-off-only ==========\n");
  const n = Math.max(1, Math.round(1500 / QUICK_DIVISOR));
  const seeds = Array.from({ length: n }, (_, i) => 680_000 + i);
  console.log(
    `  Default draft, always-heal, identical seeds. Only chainTargetingEnabled and each attacker's chainTargeting\n` +
      `  change between arms — every stat, the draft, the fielding heuristic and the encounter sequence are held\n` +
      `  fixed. n=${n} runs/arm, seeds from 680_000.\n`,
  );

  const today = block3BaselineArm ?? runArm(`today n=${n}`, cfgOff, DEFAULT_DRAFT_ROSTER_IDS, seeds);
  printArm(today, undefined, HEALER_IDS);

  const targetingOn = runArm(`targeting on n=${n}`, cfgOn, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withTargeting(r, SHIPPED_TARGETING_BY_ID),
  );
  printArm(targetingOn, today, HEALER_IDS);

  const frontEverywhere = runArm(`front-everywhere n=${n}`, cfgOn, DEFAULT_DRAFT_ROSTER_IDS, seeds, undefined, (r) =>
    withTargeting(r, FRONT_EVERYWHERE_BY_ID),
  );
  printArm(frontEverywhere, today, HEALER_IDS);

  const spillOffOnly = runArm(
    `spill-off-only n=${n}`,
    { ...cfgOff, fight: { ...cfgOff.fight, chainHitSpillsOverkill: false } },
    DEFAULT_DRAFT_ROSTER_IDS,
    seeds,
  );
  printArm(spillOffOnly, today, HEALER_IDS);

  console.log("  -- deaths per backfire, PER RULE (siege re-picks every hit and does not carry focus/execute's one-death guarantee) --");
  for (const rule of ATTACKER_RULES) {
    const rows = attackerRows(targetingOn).filter((r) => {
      // Rows key on chainProfile id (the fuse shape), not the targeting rule
      // — but each rule is assigned to exactly one shipped hero with a
      // distinct profile, so filtering by that hero's profile id isolates
      // this rule's chains within the targetingOn arm.
      const hero = PLAYER_HERO_POOL.find((h) => h.chainTargeting === rule);
      return hero && r.profileId === hero.chainProfile.id;
    });
    if (rows.length === 0) continue;
    const stats = chainOutcomeStats(rows[0]!);
    console.log(`    ${rule.padEnd(8)} deaths/backfire=${stats.deathsPerBackfire.toFixed(2)}  backfireRate=${(stats.backfireRate * 100).toFixed(1)}%  chains=${stats.chains}`);
  }
  console.log("");

  console.log("  -- mechanism decomposition, attacker chains only (healer rows excluded: HP-restored units) --");
  for (const [label, arm] of [
    ["targeting on", targetingOn],
    ["front-everywhere", frontEverywhere],
  ] as [string, ArmResult][]) {
    const rows = attackerRows(arm);
    if (rows.length === 0) continue;
    console.log(`    == ${label} ==`);
    for (const row of rows) {
      const stats = chainOutcomeStats(row);
      console.log(
        `      ${row.label.padEnd(13)} chains=${stats.chains}  evReal=${(stats.evRealization * 100).toFixed(1)}%  ` +
          `spill=${(stats.spillFraction * 100).toFixed(1)}%  cutShort=${(stats.cutShortRate * 100).toFixed(1)}%  ` +
          `lockout=${(stats.lockoutRate * 100).toFixed(1)}%  deaths/backfire=${stats.deathsPerBackfire.toFixed(2)}`,
      );
    }
  }
  console.log("");

  // --- The verdict, against the bars set before any of this ran. ------------
  // Read INVERTED relative to shapeVerdict.ts's Block 3: two arms landing
  // WITHIN the bar of each other is the PASS here ("no rule is simply better
  // over a run"), not a null result — see this file's header.
  console.log(`  ===== VERDICT (pool-wide bar pre-registered at <=${POOLWIDE_BAR_PT}pt completion) =====\n`);
  for (const [label, arm] of [
    ["targeting on vs today", targetingOn],
    ["front-everywhere vs today", frontEverywhere],
    ["spill-off-only vs today", spillOffOnly],
  ] as [string, ArmResult][]) {
    const marginPt = (arm.report.runCompletionRate - today.report.runCompletionRate) * 100;
    const onlyThis = arm.completed.filter((c, i) => c && !today.completed[i]).length;
    const onlyToday = today.completed.filter((c, i) => c && !arm.completed[i]).length;
    const z = onlyThis + onlyToday > 0 ? (onlyThis - onlyToday) / Math.sqrt(onlyThis + onlyToday) : 0;
    const passes = Math.abs(marginPt) <= POOLWIDE_BAR_PT;
    console.log(
      `    ${label.padEnd(28)} ${(arm.report.runCompletionRate * 100).toFixed(1)}% vs ${(today.report.runCompletionRate * 100).toFixed(1)}% ` +
        `= ${marginPt >= 0 ? "+" : ""}${marginPt.toFixed(1)}pt, z=${z.toFixed(2)} -> ${passes ? "PASS (flat)" : "FAIL (one side dominates)"}`,
    );
  }
  console.log("");

  effectSizes.push(
    { label: "Block 3: targeting-on vs today (run completion)", p1: targetingOn.report.runCompletionRate, p2: today.report.runCompletionRate },
    { label: "Block 3: targeting-on vs today (fight 5 win rate)", p1: targetingOn.report.winRateByFightIndex[4]!, p2: today.report.winRateByFightIndex[4]! },
  );
}

// =========================================================================
// BLOCK 4 — Perceptibility. Pure arithmetic on Blocks 2-3's own numbers; no
// new simulation.
// =========================================================================

if (BLOCK === "4" || BLOCK === "all") {
  console.log("========== BLOCK 4 — perceptibility: runs needed to notice the widest rule-vs-rule margin ==========\n");
  if (effectSizes.length === 0) {
    console.log("  (nothing to report — run with --block all so Blocks 2-3's effect sizes are available)\n");
  } else {
    console.log("  Two-proportion power estimate (alpha=0.05 two-sided, 80% power) — see arm.ts's runsToDetect.\n");
    for (const { label, p1, p2 } of effectSizes) printDetectability(label, p1, p2);
    console.log("");
  }
}

console.log("targeting-verdict sweep complete.");
