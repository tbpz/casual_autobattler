import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type DeathPolicy, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSide } from "../sim/types.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import { makePolicy, runRun, type RunResult } from "../sim/run.js";
import { BatchAggregator, formatReport } from "./report.js";

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
    case "gateOpen":
      return `[t=${t}] gate opens (eligibility reached)`;
    case "ignitionRoll":
      return `[t=${t}] ignition roll: ${e.fired ? `FIRED, hero ${e.heroId} goes hot` : "fizzled"}`;
    case "chainHit":
      return `[t=${t}] chain hit #${e.hitIndex}: ${e.damage} dmg -> ${e.targetId}`;
    case "chainEnd":
      return `[t=${t}] chain ends, length=${e.chainLength}`;
    case "heroDown":
      return `[t=${t}] ${e.side} hero ${e.heroId} falls`;
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
      `duration=${result.durationSec.toFixed(2)}s`,
  );
}

function printRunSummary(result: RunResult): void {
  console.log(`\n--- run (seed=${result.seed}) ---`);
  for (const f of result.fights) {
    console.log(
      `  fight ${f.fightIndex + 1}: ${f.outcome.toUpperCase()} | ignited=${f.ignited} | chain=${f.chainLength} | ` +
        `coin+${f.coinAwarded} | spend=${f.spend} | living=${f.livingHeroesAfter} | ` +
        `HP=${f.playerHpAfter.toFixed(0)}/${f.playerMaxHpAfter.toFixed(0)}`,
    );
  }
  console.log(`run outcome: ${result.outcome.toUpperCase()} (${result.fightsWon}/5 won, ${result.finalCoin} coin left)`);
}

function runBatch(cfg: RunConfig, policyName: "never-spend" | "always-heal" | "always-upgrade", n: number, baseSeed: number) {
  const policy = makePolicy(policyName, cfg);
  const agg = new BatchAggregator(cfg);
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    agg.add(runRun(cfg, new Rng(seed), policy, seed));
  }
  console.log(formatReport(agg.finalize(), `policy=${policyName} deathPolicy=${cfg.deathPolicy}`));
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgs(rest);
const seed = args.seed ? Number(args.seed) : 1;
const n = args.n ? Number(args.n) : 1000;
const deathPolicy = (args.death as DeathPolicy) ?? DEFAULT_RUN_CONFIG.deathPolicy;
const cfg: RunConfig = { ...DEFAULT_RUN_CONFIG, deathPolicy };

switch (cmd) {
  case "fight": {
    const setup = {
      player: makeSide(cfg.playerN, cfg.fight.heroMaxHp, "p"),
      enemy: makeSide(cfg.enemyN, cfg.enemyHpFight1 / cfg.enemyN, "e"),
      fightsSinceIgnition: args.fightsSince ? Number(args.fightsSince) : 0,
    };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    printFightLog(result, "single fight");
    break;
  }
  case "run": {
    const policyName = (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "never-spend";
    const result = runRun(cfg, new Rng(seed), makePolicy(policyName, cfg), seed);
    printRunSummary(result);
    break;
  }
  case "batch": {
    if (args.policy) {
      runBatch(cfg, args.policy as "never-spend" | "always-heal" | "always-upgrade", n, seed);
    } else {
      // Default: the full matrix — 3 policies x 2 death policies.
      const policies = ["never-spend", "always-heal", "always-upgrade"] as const;
      const deathPolicies: DeathPolicy[] = ["downAtFightEnd", "onlyOnLoss"];
      for (const dp of deathPolicies) {
        for (const p of policies) {
          runBatch({ ...DEFAULT_RUN_CONFIG, deathPolicy: dp }, p, n, seed);
        }
      }
    }
    break;
  }
  default:
    console.error(`Usage: tsx src/batch/cli.ts <fight|run|batch> [--seed N] [--n N] [--policy name] [--death downAtFightEnd|onlyOnLoss]`);
    process.exit(1);
}
