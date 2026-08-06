import type { Rng } from "./rng.js";
import type { DeathPolicy, EnemyArchetype, RunConfig } from "./config.js";
import type { FightSetup, HeroState, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import { runFight } from "./fight.js";
import type { FightResult } from "./events.js";

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
  livingHeroesAfter: number;
  playerHpAfter: number;
  playerMaxHpAfter: number;
}

export interface RunResult {
  seed: number;
  fights: FightSummary[];
  /** Full per-fight records, for a UI to replay any fight in the run. */
  fightResults: FightResult[];
  outcome: "complete" | "over";
  fightsWon: number;
  finalCoin: number;
}

/**
 * The per-fight step logic, factored out so both the headless batch runner
 * (runRun, below — a fixed policy decides synchronously) and an interactive
 * UI (render/runSession.ts — waits for a real player tap) drive the exact
 * same rules rather than two copies that could drift apart.
 */

/** Scales only HP with the difficulty ramp, not damage — a later fight is a
 * longer grind, not a harder-hitting one. Scaling both compounds far faster:
 * enemy dps rising alongside enemy HP means the player pool drains faster
 * *and* takes longer to return the favor, at the same time. Measured via the
 * batch harness during the 2026-08-04 legibility rewrite: scaling both at
 * 1.08 collapsed win rate from ~100% (fights 1-2) to ~13% (fight 3). */
function scaledArchetype(def: EnemyArchetype, rampFactor: number, fightIndex: number): EnemyArchetype {
  const scale = Math.pow(rampFactor, fightIndex);
  return { ...def, maxHp: def.maxHp * scale };
}

/** Builds the enemy side for a fight: one bruiser (front, the dip's visible
 * cause) plus (n-1) grunts, both archetypes scaled by the difficulty ramp.
 * Bruiser leads the roster so the player's front-targeting attacks (fight.ts)
 * reliably hit it first — the "kill the big one, the dip ends" causal story. */
export function makeEnemySide(cfg: RunConfig, fightIndex: number): SideState {
  const bruiser = scaledArchetype(cfg.bruiser, cfg.difficultyRampFactor, fightIndex);
  const grunt = scaledArchetype(cfg.grunt, cfg.difficultyRampFactor, fightIndex);
  // Every enemy shares an attackIntervalSec within its archetype, so without
  // a phase offset the grunts would all beat on the identical tick — the
  // same collision problem heroes.ts's makeHeroState fixes for the player
  // side (2026-08-06). Bruiser gets phase 0 (front, fires first); grunts
  // spread across the remaining slots.
  const heroes: HeroState[] = [
    {
      id: "e0_bruiser",
      name: `${bruiser.namePrefix}`,
      role: "bruiser",
      maxHp: bruiser.maxHp,
      hp: bruiser.maxHp,
      alive: true,
      damage: bruiser.damage,
      attackIntervalSec: bruiser.attackIntervalSec,
      nextAttackT: bruiser.attackIntervalSec,
      dealt: 0,
      soaked: 0,
      restored: 0,
      hitsTaken: 0,
      holding: false,
    },
  ];
  for (let i = 1; i < cfg.enemyN; i++) {
    const phase = i / cfg.enemyN;
    heroes.push({
      id: `e${i}_grunt`,
      name: `${grunt.namePrefix} ${i}`,
      role: "grunt",
      maxHp: grunt.maxHp,
      hp: grunt.maxHp,
      alive: true,
      damage: grunt.damage,
      attackIntervalSec: grunt.attackIntervalSec,
      nextAttackT: grunt.attackIntervalSec * (1 - phase * 0.8),
      dealt: 0,
      soaked: 0,
      restored: 0,
      hitsTaken: 0,
      holding: false,
    });
  }
  return { heroes, dpsBonus: 0 };
}

/** Folds a fight's outcome into the persisted player roster: HP and alive
 * flags come from the fight, then deathPolicy decides whether a downed hero
 * stays down (only called after a WIN — a loss ends the run before this runs,
 * so "downAtFightEnd" and "onlyOnLoss" only differ in what a win leaves behind). */
export function applyFightResultToPlayer(
  player: SideState,
  result: FightResult,
  deathPolicy: DeathPolicy,
): SideState {
  const finalById = new Map(result.finalPlayerHeroes.map((h) => [h.id, h]));
  let heroes: HeroState[] = player.heroes.map((h) => {
    const final = finalById.get(h.id);
    if (!final) return h;
    return { ...h, hp: final.hp, alive: final.alive };
  });
  heroes =
    deathPolicy === "downAtFightEnd"
      ? heroes.filter((h) => h.alive)
      : heroes.map((h) => (h.alive ? h : { ...h, hp: h.maxHp, alive: true }));
  return { heroes, dpsBonus: player.dpsBonus };
}

export function healFlat(side: SideState, amount: number): SideState {
  return { ...side, heroes: side.heroes.map((h) => ({ ...h, hp: Math.min(h.maxHp, h.hp + amount) })) };
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

export function summarizeLoss(fightIndex: number, result: FightResult, playerMaxHp: number): FightSummary {
  return {
    fightIndex,
    outcome: "loss",
    ignited: result.ignited,
    chainLength: result.chainLength,
    coinAwarded: 0,
    spend: "skip",
    livingHeroesAfter: 0,
    playerHpAfter: 0,
    playerMaxHpAfter: playerMaxHp,
  };
}

export function summarizeWin(
  fightIndex: number,
  result: FightResult,
  coinAwarded: number,
  spend: SpendChoice,
  player: SideState,
): FightSummary {
  return {
    fightIndex,
    outcome: "win",
    ignited: result.ignited,
    chainLength: result.chainLength,
    coinAwarded,
    spend,
    livingHeroesAfter: player.heroes.filter((h) => h.alive).length,
    playerHpAfter: sideHp(player),
    playerMaxHpAfter: sideMaxHp(player),
  };
}

/** Runs one full 5-fight run to completion. Pure given (cfg, rng, policy, player). */
export function runRun(cfg: RunConfig, rng: Rng, policy: RunPolicy, seed: number, initialPlayer: SideState): RunResult {
  let player = initialPlayer;
  let fightsSinceIgnition = 0;
  let coin = 0;

  const fights: FightSummary[] = [];
  const fightResults: FightResult[] = [];

  for (let i = 0; i < cfg.fightsPerRun; i++) {
    const enemy = makeEnemySide(cfg, i);

    const setup: FightSetup = { player, enemy, fightsSinceIgnition };
    const result = runFight(setup, cfg.fight, rng, seed);
    fightResults.push(result);

    if (result.outcome === "loss") {
      fights.push(summarizeLoss(i, result, sideMaxHp(player)));
      return { seed, fights, fightResults, outcome: "over", fightsWon: i, finalCoin: 0 };
    }

    fightsSinceIgnition = result.ignited ? 0 : fightsSinceIgnition + 1;

    const coinAwarded = coinAwardFor(cfg, result);
    coin += coinAwarded;

    player = applyFightResultToPlayer(player, result, cfg.deathPolicy);
    player = healFlat(player, cfg.autoRecoverHp);

    const choice = policy({ coin, player });
    const applied = applySpend(cfg, player, coin, choice);
    player = applied.player;
    coin = applied.coin;

    fights.push(summarizeWin(i, result, coinAwarded, applied.spend, player));
  }

  return { seed, fights, fightResults, outcome: "complete", fightsWon: cfg.fightsPerRun, finalCoin: coin };
}
