import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, type RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { DEFAULT_DRAFT_ROSTER_IDS, makePlayerSide } from "../sim/heroes.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import { makeEnemySide, makePolicy, runRun, type RunResult } from "../sim/run.js";
import { BatchAggregator, formatReport } from "./report.js";

/** Named FIELDED squads (exactly 3) for the `fight` subcommand's --squad —
 * an isolated single fight, no roster/attrition involved. A literal
 * comma-separated hero id list also works. */
const SQUAD_PRESETS: Record<string, string[]> = {
  comfortable: ["bracer", "rook", "cairn"],
  tight: ["hollow", "rook", "cairn"],
  greedy: ["vex", "rook", "hollow"],
};

/** Named DRAFT rosters (5 of 6) for `run`/`batch` — 2026-08-09 roster/bench
 * pass. Each leaves a different hero on the bench from the start, so the
 * three presets exercise a different starting shape rather than just a
 * different fielded triple. */
const DRAFT_PRESETS: Record<string, string[]> = {
  // Leaves Vex out — the accept-default draft (see heroes.ts).
  default: DEFAULT_DRAFT_ROSTER_IDS,
  // Leaves Cairn out — no pure-healer safety net available at all, Ward is
  // the only support in the draft.
  burst: ["bracer", "hollow", "rook", "vex", "ward"],
  // Leaves Bracer out — only one tank (Hollow) in the whole draft, so a
  // Hollow death mid-run forces a tankless fielding for good.
  thin: ["hollow", "rook", "vex", "cairn", "ward"],
};

function resolveSquad(arg: string | undefined, presets: Record<string, string[]>): string[] | undefined {
  if (!arg) return undefined;
  if (presets[arg]) return presets[arg];
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
    case "heatFull":
      return `[t=${t}] ${e.heroId} is HOT (heat threshold crossed) — ignition roll follows`;
    case "ignitionRoll":
      return `[t=${t}] ignition roll (${e.heroId}): ${e.fired ? "FIRED, goes hot" : "fizzled"}`;
    case "heatGift":
      return `[t=${t}] ${e.fromId} gifts ${e.amount.toFixed(1)} heat -> ${e.toId}`;
    case "chainHit":
      return `[t=${t}] chain hit #${e.hitIndex}: ${e.damage} dmg -> ${e.targetId}`;
    case "chainEnd":
      return `[t=${t}] ${e.heroId}'s chain ends, length=${e.chainLength}, total=${e.totalDamage}${e.killedIds.length ? `, killed=${e.killedIds.join(",")}` : ""}`;
    case "heroDown":
      return `[t=${t}] ${e.side} hero ${e.heroId} falls`;
    case "tankBreak":
      return `[t=${t}] ${e.side} tank ${e.heroId} BREAKS — line is down`;
    case "tankRecover":
      return `[t=${t}] ${e.side} tank ${e.heroId} recovers — holding again`;
    case "windupStart":
      return `[t=${t}] bruiser winds up on ${e.targetId ?? "?"} — fires at t=${e.fireT.toFixed(2)}`;
    case "windupHit":
      return `[t=${t}] bruiser SLAMS ${e.targetId}: ${e.damage} dmg`;
    case "enrageStart":
      return `[t=${t}] enemy enrage begins`;
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
    .map((h) => `${h.name}(${h.role}) dealt=${h.dealt} soaked=${h.soaked} restored=${h.restored} hits=${h.hitsTaken} heat=${h.heat.toFixed(0)}`)
    .join("  "));
}

function printRunSummary(result: RunResult): void {
  console.log(`\n--- run (seed=${result.seed}) ---`);
  for (const f of result.fights) {
    console.log(
      `  fight ${f.fightIndex + 1}: ${f.outcome.toUpperCase()} | fielded=${f.fieldedIds.join("+")} | ignited=${f.ignited} | chain=${f.chainLength} | ` +
        `coin+${f.coinAwarded} | spend=${f.spend} | roster-living=${f.livingHeroesAfter} | ` +
        `HP=${f.playerHpAfter.toFixed(0)}/${f.playerMaxHpAfter.toFixed(0)}`,
    );
  }
  const overNote = result.overReason ? ` (${result.overReason})` : "";
  console.log(`run outcome: ${result.outcome.toUpperCase()}${overNote} (${result.fightsWon}/5 won, ${result.finalCoin} coin left)`);
}

function runBatch(
  cfg: RunConfig,
  policyName: "never-spend" | "always-heal" | "always-upgrade",
  n: number,
  baseSeed: number,
  roster: string[] | undefined,
) {
  const policy = makePolicy(policyName, cfg);
  const agg = new BatchAggregator(cfg);
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    agg.add(runRun(cfg, new Rng(seed), policy, seed, makePlayerSide(roster ?? DEFAULT_DRAFT_ROSTER_IDS)));
  }
  const rosterLabel = ` roster=${(roster ?? DEFAULT_DRAFT_ROSTER_IDS).join("+")}`;
  console.log(formatReport(agg.finalize(), `policy=${policyName}${rosterLabel}`));
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgs(rest);
const seed = args.seed ? Number(args.seed) : 1;
const n = args.n ? Number(args.n) : 1000;
const cfg: RunConfig = DEFAULT_RUN_CONFIG;

switch (cmd) {
  case "fight": {
    // A single ad-hoc fight, no roster/attrition — --squad takes exactly
    // cfg.playerN (3) ids (or a named SQUAD_PRESETS entry).
    const squad = resolveSquad(args.squad, SQUAD_PRESETS);
    const setup = {
      player: makePlayerSide(squad),
      enemy: makeEnemySide(cfg, 0),
      attemptsSinceIgnition: args.attemptsSince ? Number(args.attemptsSince) : 0,
    };
    const result = runFight(setup, cfg.fight, new Rng(seed), seed);
    printFightLog(result, "single fight");
    break;
  }
  case "run": {
    // A full 5-fight run. --squad now takes a DRAFT (any length >=
    // cfg.playerN — passing exactly 3 degrades to "no bench," the pre-
    // 2026-08-09 shape) or a DRAFT_PRESETS name; defaults to the accept-
    // default 5-hero draft.
    const roster = resolveSquad(args.squad, DRAFT_PRESETS);
    const policyName = (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "always-heal";
    const result = runRun(cfg, new Rng(seed), makePolicy(policyName, cfg), seed, makePlayerSide(roster ?? DEFAULT_DRAFT_ROSTER_IDS));
    printRunSummary(result);
    break;
  }
  case "batch": {
    if (args.squad || args.policy) {
      // 2026-08-09 fix: this used to silently default an unspecified
      // --policy to "never-spend" for any --squad investigation — every
      // per-roster number anyone pulled this way (including the balance
      // pins in checks/chaindist.ts before this pass) was therefore
      // measuring a population that never plays the coin economy the real
      // game always offers. Default to "always-heal" instead — the
      // played-game population — and pass --policy never-spend explicitly
      // to get the no-economy floor.
      const roster = resolveSquad(args.squad, DRAFT_PRESETS);
      runBatch(cfg, (args.policy as "never-spend" | "always-heal" | "always-upgrade") ?? "always-heal", n, seed, roster);
    } else {
      // Default: the full matrix — 3 policies x 3 named draft rosters, so
      // the coin economy's and the starting draft's effect on run
      // completion are visible side by side rather than assumed.
      const policies = ["never-spend", "always-heal", "always-upgrade"] as const;
      for (const p of policies) {
        for (const rosterName of Object.keys(DRAFT_PRESETS)) {
          runBatch(cfg, p, n, seed, DRAFT_PRESETS[rosterName]);
        }
      }
    }
    break;
  }
  default:
    console.error(
      `Usage: tsx src/batch/cli.ts <fight|run|batch> [--seed N] [--n N] [--policy name] [--squad comfortable|tight|greedy|default|burst|thin|id,id,id...] [--attemptsSince N]`,
    );
    process.exit(1);
}
