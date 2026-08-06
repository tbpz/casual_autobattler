import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type DeathPolicy, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import { makeEnemySide, makePolicy, runRun, type RunResult } from "../sim/run.js";
import { BatchAggregator, formatReport } from "./report.js";

/** Named squads for --squad, for comparing how the risk dial (DECISIONS.md
 * 2026-08-06 "squad pick is the risk dial") actually plays out across the
 * comfortable/tight/greedy spectrum, side by side, from real batch data
 * rather than hand-reasoning about the stat blocks. A literal comma-
 * separated hero id list (e.g. "vex,rook,hollow") also works. */
const SQUAD_PRESETS: Record<string, string[]> = {
  comfortable: ["bracer", "rook", "cairn"],
  tight: ["hollow", "rook", "cairn"],
  greedy: ["vex", "rook", "ward"],
};

function resolveSquad(arg: string | undefined): string[] | undefined {
  if (!arg) return undefined;
  if (SQUAD_PRESETS[arg]) return SQUAD_PRESETS[arg];
  return arg.split(",");
}

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
    case "tankBreak":
      return `[t=${t}] ${e.side} tank ${e.heroId} BREAKS — line is down`;
    case "tankRecover":
      return `[t=${t}] ${e.side} tank ${e.heroId} recovers — holding again`;
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
    .map((h) => `${h.name}(${h.role}) dealt=${h.dealt} soaked=${h.soaked} restored=${h.restored} hits=${h.hitsTaken}`)
    .join("  "));
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

function runBatch(
  cfg: RunConfig,
  policyName: "never-spend" | "always-heal" | "always-upgrade",
  n: number,
  baseSeed: number,
  squad: string[] | undefined,
) {
  const policy = makePolicy(policyName, cfg);
  const agg = new BatchAggregator(cfg);
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    agg.add(runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(squad)));
  }
  const squadLabel = squad ? ` squad=${squad.join("+")}` : "";
  console.log(formatReport(agg.finalize(), `policy=${policyName} deathPolicy=${cfg.deathPolicy}${squadLabel}`));
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgs(rest);
const seed = args.seed ? Number(args.seed) : 1;
const n = args.n ? Number(args.n) : 1000;
const deathPolicy = (args.death as DeathPolicy) ?? DEFAULT_RUN_CONFIG.deathPolicy;
const cfg: RunConfig = { ...DEFAULT_RUN_CONFIG, deathPolicy };
const squad = resolveSquad(args.squad);

switch (cmd) {
  case "fight": {
    const setup = {
      player: makePlayerSide(squad),
      enemy: makeEnemySide(cfg, 0),
      fightsSinceIgnition: args.fightsSince ? Number(args.fightsSince) : 0,
    };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    printFightLog(result, "single fight");
    break;
  }
  case "run": {
    const policyName = (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "never-spend";
    const result = runRun(cfg, new Rng(seed), makePolicy(policyName, cfg), seed, makePlayerSide(squad));
    printRunSummary(result);
    break;
  }
  case "batch": {
    if (args.squad && !SQUAD_PRESETS[args.squad]) {
      // A literal hero-id list with no --policy given: run just that one combo.
      runBatch(cfg, (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "never-spend", n, seed, squad);
    } else if (args.policy || args.squad) {
      runBatch(cfg, (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "never-spend", n, seed, squad);
    } else {
      // Default: the full matrix — 3 policies x 2 death policies x 3 named
      // squads (comfortable/tight/greedy), so the risk dial's effect on
      // run-completion is visible side by side rather than assumed.
      const policies = ["never-spend", "always-heal", "always-upgrade"] as const;
      const deathPolicies: DeathPolicy[] = ["downAtFightEnd", "onlyOnLoss"];
      for (const dp of deathPolicies) {
        for (const p of policies) {
          for (const squadName of Object.keys(SQUAD_PRESETS)) {
            runBatch({ ...DEFAULT_RUN_CONFIG, deathPolicy: dp }, p, n, seed, SQUAD_PRESETS[squadName]);
          }
        }
      }
    }
    break;
  }
  default:
    console.error(
      `Usage: tsx src/batch/cli.ts <fight|run|batch> [--seed N] [--n N] [--policy name] [--death downAtFightEnd|onlyOnLoss] [--squad comfortable|tight|greedy|id,id,id]`,
    );
    process.exit(1);
}
