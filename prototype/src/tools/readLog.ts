/**
 * Reads one export-log file (render/app.ts's "export" link, log/download.ts)
 * and prints it: the `decided` block already written into the file, a
 * ground-truth cross-check against it, and a what-if sweep — for each fielded
 * hero, what a benched alternative would have won at, run N times fresh so
 * "would Hollow have won?" gets an honest rate instead of one seed's answer.
 *
 * Usage: npm run readlog -- <file.json> [--sweep-n 300] [--no-sweep]
 */
import { readFileSync } from "node:fs";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "../sim/config.js";
import { buildLabFightSetup, type LabSetup } from "../lab/labFight.js";
import { runFight } from "../sim/fight.js";
import { Rng } from "../sim/rng.js";
import type { RunLogFile, RoundEntry, HeroReading } from "../log/runLog.js";
import type { DecidedSummary } from "../log/decided.js";

function parseArgs(argv: string[]): { file?: string; sweepN: number; sweep: boolean } {
  let file: string | undefined;
  let sweepN = 300;
  let sweep = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sweep-n") {
      sweepN = Number(argv[++i] ?? 300);
    } else if (a === "--no-sweep") {
      sweep = false;
    } else if (a && !a.startsWith("--") && !file) {
      file = a;
    }
  }
  return { file, sweepN, sweep };
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}

function fmt(n: number): string {
  return Math.abs(n) < 0.05 ? "0" : n.toFixed(1);
}

/** Loose equality — decided.ts's own header explains the two known,
 * legitimate reasons this can differ from fight.ts's ground truth (a
 * backfired damage chain, or overkill spilling onto a second body the event
 * log doesn't name): neither is a bug, so an exact match isn't the bar. */
function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.02);
}

function crossCheck(decided: DecidedSummary): string[] {
  const warnings: string[] = [];
  for (const h of decided.heroes) {
    // A backfired damage chain still credits the FIRING hero's own dealt
    // counter in fight.ts (resolveChainHit's damage branches have no
    // !backfire guard, unlike the heal branches) even though this file
    // deliberately excludes backfire damage from damageDealtChain (it
    // benefited nobody — see damageTakenChainBackfire on the target
    // instead). A hero whose chain backfired will legitimately mismatch
    // here; that's expected, not a bug — the note below just says so rather
    // than staying silent about a real, known gap between "dealt" and
    // "dealt on purpose."
    const splitDealt = h.damageDealtOrdinary + h.damageDealtChain + h.damageDealtSlam;
    if (!closeEnough(splitDealt, h.groundTruth.dealt)) {
      warnings.push(
        `  ! ${h.name}: ordinary+chain+slam dealt (${fmt(splitDealt)}) doesn't match fight.ts's own dealt total (${fmt(h.groundTruth.dealt)}) — expected if a damage chain backfired this fight, otherwise decided.ts's split is wrong`,
      );
    }
    const splitTaken = h.damageTakenOrdinary + h.damageTakenChainDirect + h.damageTakenSlam + h.damageTakenChainBackfire;
    if (!closeEnough(splitTaken, h.groundTruth.soaked)) {
      warnings.push(
        `  ! ${h.name}: ordinary+chain+slam taken (${fmt(splitTaken)}) doesn't match fight.ts's own soaked total (${fmt(h.groundTruth.soaked)}) — expected if an overkill spilled onto/off of this body this fight (decided.ts's header), otherwise decided.ts's split is wrong`,
      );
    }
    if (!closeEnough(h.healingGiven, h.groundTruth.restored)) {
      warnings.push(`  ! ${h.name}: healingGiven (${fmt(h.healingGiven)}) doesn't match fight.ts's own restored total (${fmt(h.groundTruth.restored)})`);
    }
  }
  return warnings;
}

function printDecided(decided: DecidedSummary): void {
  const contributors = decided.heroes.filter(
    (h) => h.damageDealtOrdinary + h.damageDealtChain + h.damageDealtSlam > 0 || h.damageTakenOrdinary + h.damageTakenSlam > 0,
  );
  console.log("  per-hero:");
  for (const h of contributors) {
    const dealt = h.damageDealtOrdinary + h.damageDealtChain + h.damageDealtSlam;
    const taken = h.damageTakenOrdinary + h.damageTakenChainDirect + h.damageTakenSlam + h.damageTakenChainBackfire;
    const deadNote = h.died ? ` [fell @${h.diedAtSec?.toFixed(1)}s]` : "";
    console.log(
      `    ${h.name} (${h.side}/${h.role}): dealt ${fmt(dealt)} (ordinary ${fmt(h.damageDealtOrdinary)} + chain ${fmt(h.damageDealtChain)} + slam ${fmt(h.damageDealtSlam)}), ` +
        `took ${fmt(taken)} (ordinary ${fmt(h.damageTakenOrdinary)} + chain ${fmt(h.damageTakenChainDirect)} + slam ${fmt(h.damageTakenSlam)} + backfire ${fmt(h.damageTakenChainBackfire)}), ` +
        `healed ${fmt(h.healingGiven)}${deadNote}`,
    );
  }

  if (decided.chains.length > 0) {
    console.log("  chains:");
    for (const c of decided.chains) {
      const killNote = c.killedIds.length > 0 ? `, killed ${c.killedIds.length}` : "";
      const wasteNote = c.wastedDamage > 0 ? `, wasted ${fmt(c.wastedDamage)}` : "";
      console.log(
        `    ${c.startSec.toFixed(1)}s ${c.heroName} ${c.backfire ? "BACKFIRE" : "chain"} (${c.effect}) x${c.length} — ` +
          `dmg ${fmt(c.totalDamage)}${c.totalStunSec > 0 ? `, stun ${c.totalStunSec.toFixed(1)}s` : ""}${c.totalGuardCharges > 0 ? `, guard+${c.totalGuardCharges}` : ""}${killNote}${wasteNote} [${c.reason}]`,
      );
    }
  }

  const s = decided.slams;
  if (s.landed > 0) {
    console.log(
      `  slams: ${s.landed} landed, ${fmt(s.totalDamage)} dmg (guard redirected ${s.guardRedirects}, guard backfired ${s.guardBackfireRedirects}, retargeted on death ${s.retargetedOnDeath})`,
    );
  }

  console.log(
    `  low point: ${pct(decided.lowestPlayerHpFraction.fraction)} team HP @${decided.lowestPlayerHpFraction.atSec.toFixed(1)}s — ended at ${pct(decided.endPlayerHpFraction)}`,
  );
  if (decided.topEnemyDamageDealers.length > 0) {
    console.log("  top damage into the enemy: " + decided.topEnemyDamageDealers.map((c) => `${c.name} (${fmt(c.amount)})`).join(", "));
  }
  if (decided.topPlayerDamageTakenSources.length > 0) {
    console.log("  top damage into you: " + decided.topPlayerDamageTakenSources.map((c) => `${c.name} (${fmt(c.amount)})`).join(", "));
  }

  for (const w of crossCheck(decided)) console.log(w);
}

function winRateOf(setup: Omit<LabSetup, "seed">, cfg: RunConfig, n: number, seedBase: number): number {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const result = runFight(buildLabFightSetup({ ...setup, seed: seedBase + i }, cfg), cfg.fight, new Rng(seedBase + i), seedBase + i);
    if (result.outcome === "win") wins++;
  }
  return wins / n;
}

function benchCandidates(before: { heroes: HeroReading[] }, fieldedIds: string[]): HeroReading[] {
  const fielded = new Set(fieldedIds);
  return before.heroes.filter((h) => h.alive && !fielded.has(h.id));
}

function runSweep(round: RoundEntry, cfg: RunConfig, n: number): void {
  const replay = round.replay;
  const bench = benchCandidates(round.before.roster, round.pick.fieldedIds);
  if (bench.length === 0) {
    console.log("  what-if: no living bench this fight — nothing to swap in.");
    return;
  }
  // Seed block reserved for this tool (disjoint from every batch/checks
  // range documented in decidingFactors.ts) — not a pinned reproducible
  // sequence, just a scratch offset per round so two rounds in one run don't
  // reuse identical dice.
  const seedBase = 5_000_000 + round.fightIndex * 100_000;
  console.log("  what-if (each re-run " + n + "x, same starting HP/charge):");
  const baseline = winRateOf(
    { heroIds: replay.heroIds, hpPercents: replay.hpPercents, chargePercents: replay.chargePercents, encounterIndex: replay.encounterIndex, rampIndex: replay.rampIndex, dpsBonus: replay.dpsBonus },
    cfg,
    n,
    seedBase,
  );
  console.log(`    what you did (${replay.heroIds.join("+")}): ${pct(baseline)}`);

  let seedOffset = seedBase + n;
  for (let slot = 0; slot < replay.heroIds.length; slot++) {
    for (const candidate of bench) {
      const candidateId = candidate.id.replace(/^p\d+_/, "");
      const variantIds = [...replay.heroIds];
      variantIds[slot] = candidateId;
      const variantHp = [...replay.hpPercents];
      variantHp[slot] = candidate.maxHp > 0 ? Math.round((candidate.hp / candidate.maxHp) * 100) : 0;
      const variantCharge = [...replay.chargePercents];
      variantCharge[slot] = Math.round((candidate.charge / cfg.fight.chargeThreshold) * 100);
      const rate = winRateOf(
        { heroIds: variantIds, hpPercents: variantHp, chargePercents: variantCharge, encounterIndex: replay.encounterIndex, rampIndex: replay.rampIndex, dpsBonus: replay.dpsBonus },
        cfg,
        n,
        seedOffset,
      );
      seedOffset += n;
      const delta = rate - baseline;
      const arrow = delta > 0.02 ? "better" : delta < -0.02 ? "worse" : "~same";
      console.log(`    ${replay.heroIds[slot]} -> ${candidateId}: ${pct(rate)} (${arrow})`);
    }
  }
}

function main(): void {
  const { file, sweepN, sweep } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error("usage: npm run readlog -- <file.json> [--sweep-n 300] [--no-sweep]");
    process.exit(1);
  }
  const raw = readFileSync(file, "utf-8");
  const log = JSON.parse(raw) as RunLogFile;
  const cfg: RunConfig = log.about.runConfig ?? DEFAULT_RUN_CONFIG;

  console.log(`run seed=${log.run.seed} draft=${log.run.draftIds.join("+")} status=${log.run.status}${log.run.overReason ? ` (${log.run.overReason})` : ""}`);
  console.log(`written ${log.about.generatedAt}, schema v${log.about.schemaVersion}, ${log.rounds.length} round(s) in this file`);

  let wins = 0;
  for (const round of log.rounds) {
    console.log(`\n--- fight ${round.fightIndex + 1}: ${round.enemy.name ?? "?"} — ${round.fight.outcome.toUpperCase()} ---`);
    console.log(`  ${round.enemy.blurb ?? ""}`);
    console.log(`  fielded: ${round.pick.fieldedIds.join(", ")}${round.pick.fieldedIds.join() === round.pick.defaultFieldedIds.join() ? " (accept-default)" : ""}`);
    if (round.fight.outcome === "win") wins++;
    printDecided(round.decided);
    if (sweep) runSweep(round, cfg, sweepN);
  }

  console.log(`\nrun roll-up: ${wins}/${log.rounds.length} fights won in this file, status=${log.run.status}`);
}

main();
