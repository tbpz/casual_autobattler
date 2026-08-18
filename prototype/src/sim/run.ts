import type { Rng } from "./rng.js";
import type { RunConfig } from "./config.js";
import type { FightSetup, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import { runFight } from "./fight.js";
import type { FightResult } from "./events.js";
import {
  applyFightResultToRoster,
  canFieldSquad,
  defaultFieldPick,
  fieldSquad,
  type FieldPick,
  type RosterState,
} from "./roster.js";
import { encounterOrderFor, makeEncounterEnemySide } from "./encounters.js";

export type SpendChoice = "heal" | "upgrade" | "skip";

/** Decides the run's one coin-spend decision point. The batch harness passes
 * a fixed policy; the UI passes the player's tap. Costs are checked by the
 * caller — a policy that asks for something unaffordable falls back to
 * "skip", so every policy has a working accept-default. */
export type RunPolicy = (state: { coin: number; player: SideState }) => SpendChoice;

export function makePolicy(
  name: "never-spend" | "always-heal" | "always-upgrade",
  cfg: RunConfig,
): RunPolicy {
  switch (name) {
    case "never-spend":
      return () => "skip";
    case "always-heal":
      return (s) => (s.coin >= cfg.healCoinCost ? "heal" : "skip");
    case "always-upgrade":
      return (s) => (s.coin >= cfg.upgradeCoinCost ? "upgrade" : "skip");
  }
}

export interface FightSummary {
  fightIndex: number;
  outcome: "win" | "loss";
  ignited: boolean;
  chainLength: number;
  coinAwarded: number;
  spend: SpendChoice;
  /** Living ROSTER heroes after this fight (2026-08-09 roster/bench pass —
   * out of cfg.rosterSize, not cfg.playerN), the run-wide "how much of my
   * draft is left" figure, not just this fight's fielded-3 survival. */
  livingHeroesAfter: number;
  /** Roster-wide HP (bench included). */
  playerHpAfter: number;
  playerMaxHpAfter: number;
  /** Which roster members were fielded for this specific fight — the UI
   * needs this to show "who fought" distinct from "who's in the draft." */
  fieldedIds: string[];
}

export interface RunResult {
  seed: number;
  fights: FightSummary[];
  /** Full per-fight records, for a UI to replay any fight in the run. */
  fightResults: FightResult[];
  outcome: "complete" | "over";
  /** Why the run ended early — undefined when outcome is "complete".
   * 2026-08-09 (roster/bench pass): a run can now end two structurally
   * different ways — a fight lost outright, or the living roster falling
   * below playerN so the NEXT fight can't even be fielded — and they read
   * very differently to a player, so the UI/report should be able to tell
   * them apart rather than lumping both under "over". */
  overReason?: "loss" | "rosterExhausted";
  fightsWon: number;
  finalCoin: number;
}

/**
 * The per-fight step logic, factored out so both the headless batch runner
 * (runRun, below — a fixed policy decides synchronously) and an interactive
 * UI (render/runSession.ts — waits for a real player tap) drive the exact
 * same rules rather than two copies that could drift apart.
 */

// makeEnemySide: RE-EXPORTED from sim/encounters.ts (2026-08-09,
// encounter-table pass — see that file's top docstring for why the old
// single-scaled-archetype builder was replaced). Kept under this name so
// every existing call site (batch/cli.ts, checks/*, render/*) needed no
// changes — only the implementation moved.
export { makeEncounterEnemySide as makeEnemySide } from "./encounters.js";

// applyFightResultToPlayer and healFraction (2026-08-09, roster/bench pass):
// REMOVED — see config.ts's DeathPolicy-removal docstring and roster.ts's
// applyFightResultToRoster, which now does both jobs at once (fold in the
// fight's HP/alive AND apply the fielded-vs-benched recovery split) since
// the two can no longer be separated once recovery depends on which roster
// members were actually fielded.

/** Flat coin-spend heal (choice "heal" — see applySpend below): +amount HP
 * to every LIVING roster hero, bench included. Guards on `alive` (2026-08-09
 * roster/bench pass): a permanently-dead hero is now kept in the roster
 * array (not spliced out — see roster.ts) so a field-pick screen can show
 * "Cairn has fallen," so this must skip it explicitly or it would silently
 * un-zero a corpse's hp while leaving alive:false, a contradictory state. */
export function healFlat(side: SideState, amount: number): SideState {
  return {
    ...side,
    heroes: side.heroes.map((h) => (h.alive ? { ...h, hp: Math.min(h.maxHp, h.hp + amount) } : h)),
  };
}

export function coinAwardFor(cfg: RunConfig, result: FightResult): number {
  return cfg.coinPerWin + (result.ignited ? cfg.coinBonusOnIgnition : 0);
}

/** Applies a chosen spend (falling back to "skip" if unaffordable — the
 * working accept-default every policy and every UI tap gets for free). */
export function applySpend(
  cfg: RunConfig,
  player: SideState,
  coin: number,
  choice: SpendChoice,
): { player: SideState; coin: number; spend: SpendChoice } {
  if (choice === "heal" && coin >= cfg.healCoinCost) {
    return { player: healFlat(player, cfg.healHpAmount), coin: coin - cfg.healCoinCost, spend: "heal" };
  }
  if (choice === "upgrade" && coin >= cfg.upgradeCoinCost) {
    return {
      player: { ...player, dpsBonus: player.dpsBonus + cfg.upgradeDpsBonus },
      coin: coin - cfg.upgradeCoinCost,
      spend: "upgrade",
    };
  }
  return { player, coin, spend: "skip" };
}

export function summarizeLoss(fightIndex: number, result: FightResult, rosterMaxHpAtStart: number, fieldedIds: string[]): FightSummary {
  return {
    fightIndex,
    outcome: "loss",
    ignited: result.ignited,
    chainLength: result.chainLength,
    coinAwarded: 0,
    spend: "skip",
    livingHeroesAfter: 0,
    playerHpAfter: 0,
    playerMaxHpAfter: rosterMaxHpAtStart,
    fieldedIds,
  };
}

export function summarizeWin(
  fightIndex: number,
  result: FightResult,
  coinAwarded: number,
  spend: SpendChoice,
  roster: RosterState,
  fieldedIds: string[],
): FightSummary {
  return {
    fightIndex,
    outcome: "win",
    ignited: result.ignited,
    chainLength: result.chainLength,
    coinAwarded,
    spend,
    livingHeroesAfter: roster.heroes.filter((h) => h.alive).length,
    playerHpAfter: sideHp(roster),
    playerMaxHpAfter: sideMaxHp(roster),
    fieldedIds,
  };
}

export interface RunOptions {
  /** Overrides the accept-default fielding (roster.ts's defaultFieldPick) —
   * added for the affinity-measurement harness (batch/affinity.ts) so a
   * sweep can ask "what if fielding favored chainAffinity/charge instead."
   * MUST be pure and MUST NOT consume `rng`: doing so would shift the fight
   * RNG stream and break every seed-pinned check in checks/. No Rng is
   * passed into a FieldPick, so the type itself makes that constraint
   * unrepresentable rather than relying on a comment alone. */
  fieldPick?: FieldPick;
}

/** Runs one full 5-fight run to completion. Pure given (cfg, rng, policy,
 * initialRoster, opts). 2026-08-09 (roster/bench pass): initialRoster can be
 * any size >= cfg.playerN — passing exactly cfg.playerN ids degrades
 * gracefully to "no bench" (every fight fields the whole roster), which is
 * how the old downAtFightEnd model's behavior is still reachable for
 * comparison. Each fight fields the ACCEPT-DEFAULT pick (roster.ts's
 * defaultFieldPick) unless opts.fieldPick overrides it — this is the
 * headless/batch driver, which has always measured the accept-default path
 * by default (same convention as the coin-spend `policy` argument); an
 * interactive UI drives the equivalent steps itself (see
 * render/runSession.ts) so a real player can override the fielding choice. */
export function runRun(
  cfg: RunConfig,
  rng: Rng,
  policy: RunPolicy,
  seed: number,
  initialRoster: RosterState,
  opts?: RunOptions,
): RunResult {
  const fieldPick = opts?.fieldPick ?? defaultFieldPick;
  let roster = initialRoster;
  let coin = 0;

  const fights: FightSummary[] = [];
  const fightResults: FightResult[] = [];
  // 2026-08-15 (encounter-deck pass): the headless driver draws the same
  // fight order an interactive run would (render/runSession.ts) — see
  // encounterOrderFor's own docstring for why this uses a separate RNG
  // stream, keyed off the same seed — so a batch sweep measures the real
  // drawn distribution, not the old fixed 5-fight sequence.
  const encounterOrder = encounterOrderFor(seed, cfg.fightsPerRun);

  for (let i = 0; i < cfg.fightsPerRun; i++) {
    if (!canFieldSquad(roster, cfg.playerN)) {
      return { seed, fights, fightResults, outcome: "over", overReason: "rosterExhausted", fightsWon: i, finalCoin: 0 };
    }

    const fieldedIds = fieldPick(roster, cfg.playerN, { fightIndex: i, encounterIndex: encounterOrder[i]! });
    const player = fieldSquad(roster, fieldedIds);
    const enemy = makeEncounterEnemySide(cfg, i, encounterOrder[i]);

    const setup: FightSetup = { player, enemy };
    const result = runFight(setup, cfg.fight, rng, seed);
    fightResults.push(result);

    if (result.outcome === "loss") {
      fights.push(summarizeLoss(i, result, sideMaxHp(roster), fieldedIds));
      return { seed, fights, fightResults, outcome: "over", overReason: "loss", fightsWon: i, finalCoin: 0 };
    }

    const coinAwarded = coinAwardFor(cfg, result);
    coin += coinAwarded;

    roster = applyFightResultToRoster(roster, player, result, cfg);

    const choice = policy({ coin, player: roster });
    const applied = applySpend(cfg, roster, coin, choice);
    roster = applied.player;
    coin = applied.coin;

    fights.push(summarizeWin(i, result, coinAwarded, applied.spend, roster, fieldedIds));
  }

  return { seed, fights, fightResults, outcome: "complete", fightsWon: cfg.fightsPerRun, finalCoin: coin };
}
