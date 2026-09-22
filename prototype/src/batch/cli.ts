import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeInitialProgress } from "../sim/progress.js";
import { makeStartingRoster, PLAYER_ROLES, type PlayerRole } from "../sim/roles.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import { makeEnemySide, makeOfferPolicy, runRun, type RunResult } from "../sim/run.js";
import { BatchAggregator, formatReport } from "./report.js";
import { runLabFight, type LabSetup } from "../lab/labFight.js";

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

function formatEvent(e: FightEvent): string {
  const t = e.t.toFixed(2).padStart(5);
  switch (e.type) {
    case "attack":
      return `[t=${t}] ${e.side} ${e.attackerId} attacks ${e.targetId}: ${e.damage} dmg`;
    case "heal":
      return `[t=${t}] ${e.side} ${e.healerId} heals ${e.targetId}: +${e.amount}`;
    case "chainStart":
      return `[t=${t}] ${e.heroId} ${e.backfire ? "BACKFIRES" : "IGNITES"} (charge threshold crossed)`;
    case "chainHit":
      return e.targetId === null
        ? `[t=${t}] chain hit #${e.hitIndex} (${e.kind}${e.backfire ? ", backfire" : ""}) from ${e.sourceId}: whiffed (${e.intended} wasted)`
        : `[t=${t}] chain hit #${e.hitIndex} (${e.kind}${e.backfire ? ", backfire" : ""}) from ${e.sourceId}: ${e.damage} -> ${e.targetId}`;
    case "chainEnd":
      return `[t=${t}] ${e.heroId}'s ${e.backfire ? "backfire" : "chain"} ends (${e.reason}), length=${e.chainLength}, total=${e.totalDamage}${e.killedIds.length ? `, killed=${e.killedIds.join(",")}` : ""}`;
    case "heroDown":
      return `[t=${t}] ${e.side} hero ${e.heroId} falls`;
    case "tankBreak":
      return `[t=${t}] ${e.side} tank ${e.heroId} BREAKS — line is down`;
    case "tankRecover":
      return `[t=${t}] ${e.side} tank ${e.heroId} recovers — holding again`;
    case "windupStart":
      return `[t=${t}] ${e.sourceId} winds up on ${e.targetId ?? "?"} — fires at t=${e.fireT.toFixed(2)}`;
    case "windupHit":
      return `[t=${t}] ${e.sourceId} SLAMS ${e.targetId}: ${e.damage} dmg${e.redirect ? ` (redirect: ${e.redirect}, was ${e.originalTargetId})` : ""}`;
    case "resolve":
      return `[t=${t}] RESOLVE: ${e.outcome.toUpperCase()} (${e.reason})`;
  }
}

function printFightLog(result: FightResult, label: string): void {
  console.log(`\n--- ${label} (seed=${result.seed}) ---`);
  for (const e of result.events) console.log(formatEvent(e));
  console.log(
    `final: player ${result.finalPlayerHeroes.reduce((s, h) => s + h.hp, 0).toFixed(1)} HP | ` +
      `outcome=${result.outcome} | ignited=${result.ignited} | chainLength=${result.chainLength} | ` +
      `duration=${result.durationSec.toFixed(2)}s | dip=${result.dipOccurred}`,
  );
  console.log("  per-hero: " + result.finalPlayerHeroes
    .map((h) => `${h.name}(${h.role}) dealt=${h.dealt} soaked=${h.soaked} restored=${h.restored} hits=${h.hitsTaken} charge=${h.charge.toFixed(0)}`)
    .join("  "));
}

function printRunSummary(result: RunResult): void {
  console.log(`\n--- run (seed=${result.seed}) ---`);
  for (const f of result.rounds) {
    console.log(
      `  round ${f.roundIndex + 1}: ${f.outcome.toUpperCase()} | fielded=${f.fieldedIds.join("+")} | ignited=${f.ignited} | chain=${f.chainLength} | ` +
        `offer=${f.offerTaken?.title ?? "-"} | roster-living=${f.livingHeroesAfter} | ` +
        `HP=${f.playerHpAfter.toFixed(0)}/${f.playerMaxHpAfter.toFixed(0)}`,
    );
  }
  const overNote = result.overReason ? ` (${result.overReason})` : "";
  console.log(
    `run outcome: ${result.outcome.toUpperCase()}${overNote} (${result.roundsWon}/${DEFAULT_RUN_CONFIG.roundsPerRun} won, ` +
      `final slots ${result.finalProgress.slots})`,
  );
}

function runBatch(cfg: RunConfig, offerPolicyName: "first" | "random" | "greedy", n: number, baseSeed: number): void {
  const agg = new BatchAggregator(cfg);
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
    agg.add(runRun(cfg, new Rng(seed), offerRng, makeOfferPolicy(offerPolicyName, offerRng), seed));
  }
  console.log(formatReport(agg.finalize(), `offerPolicy=${offerPolicyName}`));
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgs(rest);
const seed = args.seed ? Number(args.seed) : 1;
const n = args.n ? Number(args.n) : 1000;
const cfg: RunConfig = DEFAULT_RUN_CONFIG;

switch (cmd) {
  case "fight": {
    // A single ad-hoc fight against round 0's shape — the starting 3-unit
    // squad (one Tank, one Damage, one Healer), no roster/attrition involved.
    const progress = makeInitialProgress(cfg);
    const setup = { player: makeStartingRoster(progress.bonus), enemy: makeEnemySide(cfg, 0, 0) };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    printFightLog(result, "single fight");
    break;
  }
  case "lab": {
    // The lab's own headless entry point (prototype/src/lab/labFight.ts) —
    // exercises the exact setup path the UI's ?lab=1 screen uses.
    // --roles/--charge are positional-paired: chargePercents[i] belongs to
    // roles[i]. Each role entry is "tank", "damage", or "support".
    const roles = (args.roles ? args.roles.split(",") : ["tank", "damage", "support"]) as PlayerRole[];
    for (const r of roles) {
      if (!PLAYER_ROLES.includes(r)) throw new Error(`unknown role "${r}" — expected tank, damage, or support`);
    }
    const chargePercents = args.charge ? args.charge.split(",").map(Number) : roles.map(() => 0);
    const encounterIndex = args.encounter ? Number(args.encounter) : 0;
    const rampIndex = args.ramp ? Number(args.ramp) : 0;
    const labSetup: LabSetup = { roles, chargePercents, encounterIndex, rampIndex, seed };
    const result = runLabFight(labSetup, cfg);
    printFightLog(result, "lab fight");
    break;
  }
  case "run": {
    // A full roundsPerRun-round run. --offers picks the headless offer
    // policy: "first" (always the first drawn offer) or "random".
    const offerPolicyName = (args.offers as "first" | "random" | "greedy") ?? "first";
    const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
    const result = runRun(cfg, new Rng(seed), offerRng, makeOfferPolicy(offerPolicyName, offerRng), seed);
    printRunSummary(result);
    break;
  }
  case "batch": {
    const offerPolicyName = (args.offers as "first" | "random" | "greedy") ?? "first";
    runBatch(cfg, offerPolicyName, n, seed);
    break;
  }
  default:
    console.error(
      `Usage: tsx src/batch/cli.ts <fight|lab|run|batch> [--seed N] [--n N] [--offers first|random]\n` +
        `  lab: --roles tank,damage,support --charge pct,pct,pct --encounter N --ramp N --seed N`,
    );
    process.exit(1);
}
