import type { Rng } from "./rng.js";
import type { DeathPolicy, RunConfig } from "./config.js";
import type { FightSetup, HeroState, SideState } from "./types.js";
import { makeSide, sideHp, sideMaxHp } from "./types.js";
import { runFight } from "./fight.js";
import type { FightResult } from "./events.js";

export type SpendChoice = "heal" | "upgrade" | "skip";

/** Decides the run's one coin-spend decision point. The batch harness passes
 * a fixed policy; the UI passes the player's tap. Costs are checked by the
 * caller (run.ts) — a policy that asks for something unaffordable falls back
 * to "skip", so every policy has a working accept-default. */
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

function makeEnemySide(n: number, totalHp: number): SideState {
  const per = totalHp / n;
  const heroes: HeroState[] = [];
  for (let i = 0; i < n; i++) {
    heroes.push({ id: `e${i}`, maxHp: per, hp: per, alive: true });
  }
  return { heroes, dpsBonus: 0 };
}

/** Folds a fight's outcome into the persisted player roster: HP and alive
 * flags come from the fight, then deathPolicy decides whether a downed hero
 * stays down (only called after a WIN — a loss ends the run before this runs,
 * so "downAtFightEnd" and "onlyOnLoss" only differ in what a win leaves behind). */
function applyFightResultToPlayer(
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

function healFlat(side: SideState, amount: number): SideState {
  return { ...side, heroes: side.heroes.map((h) => ({ ...h, hp: Math.min(h.maxHp, h.hp + amount) })) };
}

/** Runs one full 5-fight run to completion. Pure given (cfg, rng, policy). */
export function runRun(cfg: RunConfig, rng: Rng, policy: RunPolicy, seed: number): RunResult {
  let player = makeSide(cfg.playerN, cfg.fight.heroMaxHp, "p");
  let fightsSinceIgnition = 0;
  let coin = 0;

  const fights: FightSummary[] = [];
  const fightResults: FightResult[] = [];

  for (let i = 0; i < cfg.fightsPerRun; i++) {
    const enemyTotalHp = cfg.enemyHpFight1 * Math.pow(cfg.difficultyRampFactor, i);
    const enemy = makeEnemySide(cfg.enemyN, enemyTotalHp);

    const setup: FightSetup = { player, enemy, fightsSinceIgnition };
    const result = runFight(setup, cfg.fight, rng, seed);
    fightResults.push(result);

    if (result.outcome === "loss") {
      fights.push({
        fightIndex: i,
        outcome: "loss",
        ignited: result.ignited,
        chainLength: result.chainLength,
        coinAwarded: 0,
        spend: "skip",
        livingHeroesAfter: 0,
        playerHpAfter: 0,
        playerMaxHpAfter: sideMaxHp(player),
      });
      return { seed, fights, fightResults, outcome: "over", fightsWon: i, finalCoin: 0 };
    }

    fightsSinceIgnition = result.ignited ? 0 : fightsSinceIgnition + 1;

    const coinAwarded = cfg.coinPerWin + (result.ignited ? cfg.coinBonusOnIgnition : 0);
    coin += coinAwarded;

    player = applyFightResultToPlayer(player, result, cfg.deathPolicy);
    player = healFlat(player, cfg.autoRecoverHp);

    const choice = policy({ coin, player });
    let spend: SpendChoice = "skip";
    if (choice === "heal" && coin >= cfg.healCoinCost) {
      coin -= cfg.healCoinCost;
      player = healFlat(player, cfg.healHpAmount);
      spend = "heal";
    } else if (choice === "upgrade" && coin >= cfg.upgradeCoinCost) {
      coin -= cfg.upgradeCoinCost;
      player = { ...player, dpsBonus: player.dpsBonus + cfg.upgradeDpsBonus };
      spend = "upgrade";
    }

    fights.push({
      fightIndex: i,
      outcome: "win",
      ignited: result.ignited,
      chainLength: result.chainLength,
      coinAwarded,
      spend,
      livingHeroesAfter: player.heroes.filter((h) => h.alive).length,
      playerHpAfter: sideHp(player),
      playerMaxHpAfter: sideMaxHp(player),
    });
  }

  return { seed, fights, fightResults, outcome: "complete", fightsWon: cfg.fightsPerRun, finalCoin: coin };
}
