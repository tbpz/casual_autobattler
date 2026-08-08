import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makePlayerSide } from "../sim/heroes.js";
import { runFight } from "../sim/fight.js";
import type { FightResult } from "../sim/events.js";
import { project, type Projection } from "../sim/projection.js";
import {
  applyFightResultToPlayer,
  applySpend,
  coinAwardFor,
  healFraction,
  makeEnemySide,
  summarizeLoss,
  summarizeWin,
  type FightSummary,
  type SpendChoice,
} from "../sim/run.js";

/**
 * Drives a run one fight at a time, waiting for a real player tap on the
 * coin-spend decision instead of a synchronous policy function. Reuses the
 * exact per-fight step logic sim/run.ts's headless runRun uses (see that
 * file's helpers), so the UI and the batch harness can never drift apart on
 * the rules — only on *when* the spend decision resolves.
 */
export class RunSession {
  private cfg: RunConfig;
  private rng: Rng;
  private seed: number;
  private player: SideState;
  private attemptsSinceIgnition = 0;
  private coin = 0;
  private fightIndex = 0;

  fights: FightSummary[] = [];
  lastFightResult: FightResult | null = null;
  /** The projection computed just before the fight just resolved was run —
   * stashed here so the post-fight recap (runScreens.ts's fightRecap) can
   * compare projected vs. actual in the same units the pre-fight screen
   * showed. See DECISIONS.md's 2026-08-06 "squad pick is the risk dial"
   * entry. */
  lastProjection: Projection | null = null;
  /** Coin earned by the fight just resolved, pending the spend decision. */
  pendingCoinAwarded = 0;
  status: "in-progress" | "complete" | "over" = "in-progress";

  constructor(cfg: RunConfig, seed: number, heroIds?: string[]) {
    this.cfg = cfg;
    this.seed = seed;
    this.rng = new Rng(seed);
    this.player = makePlayerSide(heroIds);
  }

  get currentFightIndex(): number {
    return this.fightIndex;
  }

  get coinBalance(): number {
    return this.coin;
  }

  get livingHeroes(): number {
    return this.player.heroes.filter((h) => h.alive).length;
  }

  get playerHp(): { hp: number; maxHp: number } {
    return { hp: sideHp(this.player), maxHp: sideMaxHp(this.player) };
  }

  /** The current player roster, for the pre-fight screen's preview. */
  get currentPlayerSide(): SideState {
    return this.player;
  }

  /** Runs the next fight and returns its result for the FightView to replay.
   * Does NOT advance fightIndex or apply the spend — call resolveSpend()
   * after the player (or the accept-default) decides. */
  playNextFight(): FightResult {
    const enemy = makeEnemySide(this.cfg, this.fightIndex);
    // Computed BEFORE runFight so the recap compares against what was
    // actually shown on the pre-fight screen, not a value derived after the
    // fact from the outcome.
    this.lastProjection = project(this.player, enemy, this.cfg.fight);
    const setup: FightSetup = { player: this.player, enemy, attemptsSinceIgnition: this.attemptsSinceIgnition };
    const result = runFight(setup, this.cfg.fight, this.rng, this.seed);
    this.lastFightResult = result;

    if (result.outcome === "loss") {
      this.fights.push(summarizeLoss(this.fightIndex, result, sideMaxHp(this.player)));
      this.status = "over";
      return result;
    }

    // See sim/run.ts's runRun for why this carries the sim's own final
    // counter forward rather than re-deriving it from result.ignited.
    this.attemptsSinceIgnition = result.attemptsSinceIgnition;
    this.pendingCoinAwarded = coinAwardFor(this.cfg, result);
    this.player = applyFightResultToPlayer(this.player, result, this.cfg.deathPolicy);
    this.player = healFraction(this.player, this.cfg.autoRecoverFraction);
    this.coin += this.pendingCoinAwarded;
    return result;
  }

  /** Applies the player's (or the default "skip") spend choice for the fight
   * that just resolved, then advances to the next fight or run-complete. */
  resolveSpend(choice: SpendChoice): FightSummary {
    const applied = applySpend(this.cfg, this.player, this.coin, choice);
    this.player = applied.player;
    this.coin = applied.coin;

    const result = this.lastFightResult;
    if (!result) throw new Error("resolveSpend called before playNextFight");
    const summary = summarizeWin(this.fightIndex, result, this.pendingCoinAwarded, applied.spend, this.player);
    this.fights.push(summary);

    this.fightIndex++;
    if (this.fightIndex >= this.cfg.fightsPerRun) {
      this.status = "complete";
    }
    return summary;
  }

  canAfford(choice: SpendChoice): boolean {
    if (choice === "heal") return this.coin >= this.cfg.healCoinCost;
    if (choice === "upgrade") return this.coin >= this.cfg.upgradeCoinCost;
    return true;
  }
}
