/**
 * Answers the question the 2026-09-20 attribution playtest raised: across
 * ALL 20 possible 3-hero squads, does an encounter actually put anything at
 * risk, or does every squad just win it? Every number the difficulty pass
 * (DECISIONS.md, this date) used to retune sim/encounters.ts came from
 * throwaway one-off scripts — this file exists so that measurement is
 * repeatable instead of re-typed from memory every time an encounter's
 * numbers move.
 *
 * This is a REPORT, not a check — same discipline every batch/*Verdict.ts
 * and batch/*Proof.ts file in this directory establishes: it answers an open
 * question rather than pinning a known-good value, so it stays out of
 * `npm run check` (wired as `npm run measure:encounters`). The one number
 * that DOES get pinned once an encounter's numbers settle
 * (checks/chaindist.ts's twoTank.winRateByFightIndex gap and the default-
 * draft run-completion band) is re-derived by hand from this file's output,
 * per CLAUDE.md's evidence-over-memory discipline — never asserted here.
 *
 * Two blocks:
 *   --block matrix (default): per-encounter x per-squad win rate at ramp 0,
 *     full HP, zero starting charge — isolates "can this encounter be lost
 *     at all," independent of run-level attrition or the difficulty ramp.
 *   --block run: a real 5-fight run (DEFAULT_DRAFT_ROSTER_IDS, always-heal,
 *     the encounter draw, the ramp) — where losses land by fight index and
 *     by encounter, which the matrix block alone can't show (a fight that
 *     only ever shows up as fight 5 is harder than the same numbers would be
 *     as fight 1, since the roster arrives attrited).
 *   --block all runs both.
 *
 * Seed block 1_500_000-1_599_999 is reserved for this file (the next free
 * range after batch/decidingFactors.ts's 1_000_000-1_499_999 — see that
 * file's own header for the full prior allocation list). Allocation:
 *   Block matrix: 1_500_000 .. 1_509_999  (encounter e's block starts at
 *     1_500_000 + e*10_000 — 11 encounters need 110,000 of this range, so
 *     the true span is 1_500_000..1_609_999; the header total above is
 *     rounded down for readability). EVERY squad within one encounter's
 *     block draws the SAME n seeds (seedBase..seedBase+n-1) — the paired-arm
 *     convention batch/arm.ts's header describes — not a running counter, so
 *     a squad's win rate moves only because of what it fielded, not because
 *     of which seed slice it happened to land on.
 *   Block run:    1_700_000 .. 1_799_999  (--n real runs, default 800;
 *     moved up from the matrix block's true span above)
 *
 * Same honest limitation as every prior report in this directory: runRun
 * shares one Rng across the whole run, so a change to one encounter's
 * numbers shifts every downstream roll for seeds drawn after it fires —
 * every figure below is a POPULATION comparison over a seed range, never a
 * claim about what one specific seed "would have done" under a different
 * config.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { PLAYER_HERO_POOL, DEFAULT_DRAFT_ROSTER_IDS, makePlayerSide } from "../sim/heroes.js";
import { ENCOUNTERS, encounterOrderFor } from "../sim/encounters.js";
import { runLabFight } from "../lab/labFight.js";
import { makePolicy, runRun } from "../sim/run.js";

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
const block = args.block ?? "all";
const cfg = DEFAULT_RUN_CONFIG;

/** All 20 possible 3-hero squads (6 choose 3) — the same population the
 * 2026-09-20 attribution playtest and every prior lab-mode measurement in
 * this pass's DECISIONS.md entry swept. */
function allSquads(): string[][] {
  const ids = PLAYER_HERO_POOL.map((h) => h.id);
  const squads: string[][] = [];
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      for (let c = b + 1; c < ids.length; c++) {
        squads.push([ids[a]!, ids[b]!, ids[c]!]);
      }
    }
  }
  return squads;
}

interface SquadCell {
  squad: string[];
  winRate: number;
}

interface EncounterMatrixRow {
  name: string;
  avgWinRate: number;
  bestSquad: SquadCell;
  worstSquad: SquadCell;
  healthLeftOnWin: number;
  costAHeroOnWin: number;
  squadsInMidBand: number;
}

/** Runs one encounter against all 20 squads, at ramp 0, full HP, zero
 * starting charge (isolates the encounter's own shape from run-level
 * attrition and the difficulty ramp — see this file's header).
 *
 * Every squad draws from the SAME `n`-seed sequence (seedBase..seedBase+n-1)
 * — the paired-arm convention batch/arm.ts's own header describes ("every
 * report in this repo that compares arms builds on the same shape so numbers
 * stay comparable side by side"), not a running counter that hands each
 * squad a disjoint seed block. A running counter adds cross-squad seed noise
 * on top of the real squad-to-squad difference this table exists to show;
 * reusing the same n seeds for all 20 squads means a squad's win rate only
 * moves because of what it actually fielded. */
function measureEncounter(encounterIndex: number, n: number, seedBase: number): EncounterMatrixRow {
  const squads = allSquads();
  const name = ENCOUNTERS[encounterIndex]!.name;
  const cells: SquadCell[] = [];
  let healthFracSum = 0;
  let winsCounted = 0;
  let winsCostingHero = 0;

  for (const squad of squads) {
    let wins = 0;
    for (let k = 0; k < n; k++) {
      const seed = seedBase + k;
      const result = runLabFight(
        { heroIds: squad, chargePercents: squad.map(() => 0), encounterIndex, rampIndex: 0, seed },
        cfg,
      );
      if (result.outcome === "win") {
        wins++;
        const heroes = result.finalPlayerHeroes;
        const curHp = heroes.reduce((t, h) => t + Math.max(0, h.hp), 0);
        const maxHp = heroes.reduce((t, h) => t + h.maxHp, 0);
        if (maxHp > 0) healthFracSum += curHp / maxHp;
        if (heroes.some((h) => !h.alive)) winsCostingHero++;
        winsCounted++;
      }
    }
    cells.push({ squad, winRate: wins / n });
  }

  const sorted = [...cells].sort((a, b) => b.winRate - a.winRate);
  const avgWinRate = cells.reduce((t, c) => t + c.winRate, 0) / cells.length;
  const squadsInMidBand = cells.filter((c) => c.winRate >= 0.4 && c.winRate <= 0.9).length;

  return {
    name,
    avgWinRate,
    bestSquad: sorted[0]!,
    worstSquad: sorted[sorted.length - 1]!,
    healthLeftOnWin: winsCounted > 0 ? healthFracSum / winsCounted : 0,
    costAHeroOnWin: winsCounted > 0 ? winsCostingHero / winsCounted : 0,
    squadsInMidBand,
  };
}

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function runMatrixBlock(): void {
  const n = args.n ? Number(args.n) : 25;
  console.log(`\n=== Block matrix: all 20 squads x all 11 encounters, n=${n} each, ramp 0, full HP, 0% charge ===\n`);
  console.log(
    "encounter".padEnd(14) +
      "avgWR".padStart(7) +
      "  best".padStart(7) +
      " worst".padStart(7) +
      "  hpLeft".padStart(9) +
      "  costAHero".padStart(11) +
      "  mid(40-90%)".padStart(13),
  );
  const targetsMissed: string[] = [];
  for (let e = 0; e < ENCOUNTERS.length; e++) {
    // Each encounter gets its own 10,000-wide seed block (1_500_000 + e *
    // 10_000) so blocks never overlap even at n up to 10,000 — well beyond
    // any n this file would realistically be asked to run — but every squad
    // WITHIN that block draws the same n seeds (see measureEncounter).
    const row = measureEncounter(e, n, 1_500_000 + e * 10_000);
    console.log(
      row.name.padEnd(14) +
        fmtPct(row.avgWinRate).padStart(7) +
        fmtPct(row.bestSquad.winRate).padStart(7) +
        fmtPct(row.worstSquad.winRate).padStart(7) +
        fmtPct(row.healthLeftOnWin).padStart(9) +
        fmtPct(row.costAHeroOnWin).padStart(11) +
        `${row.squadsInMidBand}/20`.padStart(13),
    );
    // Targets from the difficulty-pass plan: worst squad <=30%, avg 55-90%,
    // health left 20-40%, cost-a-hero >=15%. Avg floor is 55%, not the
    // plan's original 65% — Champion, this pass's own reference fight, reads
    // ~59% at a stable n (n=150; an early n=25 read of 65% was seed noise,
    // see its own entry above), so a 65% floor would flag the reference
    // fight itself. Anvil is a documented exception (see DECISIONS.md) — its
    // authored shape, not its numbers, is why it can't be brought into band;
    // flagged, not silently excluded.
    const misses: string[] = [];
    if (row.worstSquad.winRate > 0.3) misses.push(`worst squad ${fmtPct(row.worstSquad.winRate)} > 30%`);
    if (row.avgWinRate < 0.55 || row.avgWinRate > 0.9) misses.push(`avg ${fmtPct(row.avgWinRate)} outside 55-90%`);
    if (row.healthLeftOnWin < 0.2 || row.healthLeftOnWin > 0.4) misses.push(`hp left ${fmtPct(row.healthLeftOnWin)} outside 20-40%`);
    if (misses.length > 0) targetsMissed.push(`  ${row.name}: ${misses.join("; ")}`);
  }
  if (targetsMissed.length > 0) {
    console.log("\nOff the difficulty-pass targets:");
    console.log(targetsMissed.join("\n"));
  } else {
    console.log("\nEvery encounter is inside the difficulty-pass targets.");
  }
}

function runRunBlock(): void {
  const n = args.n ? Number(args.n) : 800;
  console.log(`\n=== Block run: ${n} real 5-fight runs, DEFAULT_DRAFT_ROSTER_IDS, always-heal ===\n`);
  const policy = makePolicy("always-heal", cfg);
  let completed = 0;
  const lossesByFightIndex = new Array(cfg.fightsPerRun).fill(0) as number[];
  const seenByEncounter: Record<string, number> = {};
  const lostByEncounter: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const seed = 1_700_000 + i;
    const roster = makePlayerSide(DEFAULT_DRAFT_ROSTER_IDS);
    const result = runRun(cfg, new Rng(seed), policy, seed, roster);
    if (result.outcome === "complete") completed++;
    const order = encounterOrderFor(seed, cfg.fightsPerRun);
    result.fights.forEach((f, i2) => {
      const name = ENCOUNTERS[order[i2]!]!.name;
      seenByEncounter[name] = (seenByEncounter[name] ?? 0) + 1;
      if (f.outcome === "loss") {
        lossesByFightIndex[i2] = (lossesByFightIndex[i2] ?? 0) + 1;
        lostByEncounter[name] = (lostByEncounter[name] ?? 0) + 1;
      }
    });
  }

  const totalLosses = Object.values(lostByEncounter).reduce((a, b) => a + b, 0);
  console.log(`run completion: ${fmtPct(completed / n)}  (target 17-22% — unchanged on purpose, see DECISIONS.md)`);
  console.log(`losses by fight number: ${lossesByFightIndex.join(" / ")}`);
  console.log(`  (target: fight 5 holds under half of all losses)\n`);
  console.log("encounter          seen   lost   lossRate   shareOfAllLosses");
  const names = Object.keys(seenByEncounter).sort((a, b) => (lostByEncounter[b] ?? 0) - (lostByEncounter[a] ?? 0));
  for (const name of names) {
    const seen = seenByEncounter[name]!;
    const lost = lostByEncounter[name] ?? 0;
    console.log(
      name.padEnd(16) +
        String(seen).padStart(6) +
        String(lost).padStart(7) +
        fmtPct(lost / seen).padStart(11) +
        (totalLosses > 0 ? fmtPct(lost / totalLosses).padStart(18) : "n/a".padStart(18)),
    );
  }
  const topShare = names.length > 0 ? (lostByEncounter[names[0]!] ?? 0) / Math.max(totalLosses, 1) : 0;
  console.log(`\nbiggest single encounter's share of all losses: ${fmtPct(topShare)}  (target: <=30%)`);
}

if (block === "matrix" || block === "all") runMatrixBlock();
if (block === "run" || block === "all") runRunBlock();
