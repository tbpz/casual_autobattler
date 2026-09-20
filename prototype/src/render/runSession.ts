import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makePlayerSide, DEFAULT_DRAFT_ROSTER_IDS } from "../sim/heroes.js";
import { encounterAt, encounterOrderFor } from "../sim/encounters.js";
import { runFight } from "../sim/fight.js";
import type { FightResult } from "../sim/events.js";
import { project, type Projection } from "../sim/projection.js";
import {
  applyFightResultToRoster,
  canFieldSquad,
  defaultFieldPick,
  fieldSquad,
  livingRosterHeroes,
  type RosterState,
} from "../sim/roster.js";
import {
  applySpend,
  coinAwardFor,
  makeEnemySide,
  summarizeLoss,
  summarizeWin,
  type FightSummary,
  type SpendChoice,
} from "../sim/run.js";

/** One fight's full context, for the export log (log/runLog.ts) — a superset
 * of FightSummary that also carries what the roster/enemy/projection looked
 * like BEFORE the fight, and the roster after the (optional) spend. Pushed
 * once per fight in playNextFight; the post-spend fields (spend/coinAfter/
 * rosterAfter) start out mirroring the pre-spend state and are patched in
 * place by resolveSpend — a LOSS never calls resolveSpend, so its entry
 * keeps spend: null permanently, which is itself the correct signal (no
 * spend decision was ever reached). */
export interface RoundLog {
  fightIndex: number;
  encounterIndex: number;
  encounterName: string | null;
  rosterBefore: RosterState;
  coinBefore: number;
  defaultFieldedIds: string[];
  fieldedIds: string[];
  enemyBefore: SideState;
  projection: Projection;
  fightResult: FightResult;
  outcome: "win" | "loss";
  spend: SpendChoice | null;
  coinAwarded: number;
  coinAfter: number;
  rosterAfter: RosterState | null;
}

/**
 * Drives a run one fight at a time, waiting for real player taps on both
 * decision points — which 3 of the living roster to field, and the
 * coin-spend choice — instead of a synchronous policy function. Reuses the
 * exact per-fight step logic sim/run.ts and sim/roster.ts's headless runRun
 * uses (see those files' helpers), so the UI and the batch harness can never
 * drift apart on the rules — only on *when* each decision resolves and
 * *who* (a real player vs. the accept-default) makes it.
 *
 * 2026-08-09 (roster/bench pass — see config.ts's DeathPolicy-removal
 * docstring): the roster (up to cfg.rosterSize, drafted once at run start)
 * is now wider than what's fielded each fight (cfg.playerN) — see
 * sim/roster.ts's top docstring for why.
 */
export class RunSession {
  private cfg: RunConfig;
  private rng: Rng;
  private seedValue: number;
  private roster: RosterState;
  private coin = 0;
  private fightIndex = 0;
  private fieldedThisFight: string[] = [];
  /** This run's drawn fight order (2026-08-15, encounter-deck pass) — indices
   * into sim/encounters.ts's ENCOUNTERS, one per fight. Built once at
   * construction from the run's own seed via a separate RNG stream (see
   * encounterOrderFor's docstring), so it's stable for the whole run and
   * reproducible from the seed alone, same as every other run-level draw. */
  private encounterOrder: number[];
  private draftIdsValue: string[];

  fights: FightSummary[] = [];
  /** Every fight played this run, in order — unlike lastFightResult (kept
   * for the existing single-fight-replay call sites), this never overwrites,
   * so the export log (log/runLog.ts) can write out the whole run, not just
   * whichever fight resolved most recently. */
  fightResults: FightResult[] = [];
  /** Full per-fight context, one entry per fight played — see RoundLog's own
   * docstring. Export-log-only; nothing in the render layer reads this. */
  roundLogs: RoundLog[] = [];
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
  /** Set only when status is "over" — see sim/run.ts's RunResult.overReason
   * for why a run can now end two structurally different ways. */
  overReason: "loss" | "rosterExhausted" | null = null;

  constructor(cfg: RunConfig, seed: number, draftIds?: string[]) {
    this.cfg = cfg;
    this.seedValue = seed;
    this.rng = new Rng(seed);
    this.draftIdsValue = draftIds ?? DEFAULT_DRAFT_ROSTER_IDS;
    this.roster = makePlayerSide(this.draftIdsValue);
    this.encounterOrder = encounterOrderFor(seed, cfg.fightsPerRun);
  }

  /** The 5 hero ids drafted at run start (2026-09-20, export-log instrumentation)
   * — render-facing so the export log can record the draft itself, not just
   * the roster it produced. */
  get draftIds(): string[] {
    return this.draftIdsValue;
  }

  /** This run's full drawn fight order (2026-09-20, export-log instrumentation)
   * — a copy, so a caller can't mutate the session's own array. See
   * currentEncounterIndex for the single-fight lookup this backs. */
  get encounterOrderFull(): number[] {
    return [...this.encounterOrder];
  }

  get currentFightIndex(): number {
    return this.fightIndex;
  }

  /** This run's own seed (2026-08-20, attribution-test instrumentation) —
   * render-facing so app.ts's seed badge can display it and a specific fight
   * can be reproduced via ?seed=N. See prototype/ATTRIBUTION_TEST.md. */
  get seed(): number {
    return this.seedValue;
  }

  /** This fight's drawn ENCOUNTERS index — what actually gets fought, as
   * opposed to currentFightIndex (which only drives the difficulty ramp now
   * — see sim/encounters.ts's makeEncounterEnemySide). */
  get currentEncounterIndex(): number {
    return this.encounterOrder[this.fightIndex] ?? this.fightIndex;
  }

  get currentEncounterName(): string | null {
    return encounterAt(this.currentEncounterIndex)?.name ?? null;
  }

  get currentEncounterBlurb(): string | null {
    return encounterAt(this.currentEncounterIndex)?.blurb ?? null;
  }

  get coinBalance(): number {
    return this.coin;
  }

  /** Living ROSTER heroes (out of cfg.rosterSize) — the run-wide "how much
   * of my draft is left" figure. */
  get livingHeroes(): number {
    return livingRosterHeroes(this.roster).length;
  }

  get playerHp(): { hp: number; maxHp: number } {
    return { hp: sideHp(this.roster), maxHp: sideMaxHp(this.roster) };
  }

  /** The full roster (living and permanently-dead members both — see
   * roster.ts), for the field-pick screen. */
  get currentRoster(): RosterState {
    return this.roster;
  }

  /** The accept-default fielding for the upcoming fight — pre-checked on
   * the field-pick screen so the minimum path stays Play -> watch -> Play. */
  get defaultFielding(): string[] {
    return defaultFieldPick(this.roster, this.cfg.playerN);
  }

  /** Whether the roster can even field a full squad for the next fight —
   * false means the run is over before a fight is even offered (see
   * sim/run.ts's runRun, which checks this the same way). */
  get canFieldNextFight(): boolean {
    return canFieldSquad(this.roster, this.cfg.playerN);
  }

  /** The current FIELDED side, once playNextFight has been called for this
   * fight — for the pre-fight screen's preview. Falls back to the default
   * fielding preview before a fight has actually been played. */
  get currentPlayerSide(): SideState {
    const ids = this.fieldedThisFight.length > 0 ? this.fieldedThisFight : this.defaultFielding;
    return fieldSquad(this.roster, ids);
  }

  /** Runs the next fight with the given fielded ids (defaults to the
   * accept-default fielding) and returns its result for the FightView to
   * replay. Does NOT advance fightIndex or apply the spend — call
   * resolveSpend() after the player (or the accept-default) decides. */
  playNextFight(fieldedIds?: string[]): FightResult {
    const ids = fieldedIds ?? this.defaultFielding;
    const defaultIds = this.defaultFielding;
    this.fieldedThisFight = ids;
    // Both captured BEFORE the fight/roster update below, for the export
    // log's RoundLog.rosterBefore/coinBefore — roster.ts's helpers never
    // mutate in place (applyFightResultToRoster returns a new object), so
    // holding this reference is safe; it won't change out from under us.
    const rosterBefore = this.roster;
    const coinBefore = this.coin;
    const player = fieldSquad(this.roster, ids);
    const enemy = makeEnemySide(this.cfg, this.fightIndex, this.currentEncounterIndex);
    // Computed BEFORE runFight so the recap compares against what was
    // actually shown on the pre-fight screen, not a value derived after the
    // fact from the outcome.
    this.lastProjection = project(player, enemy, this.cfg.fight);
    const setup: FightSetup = { player, enemy };
    const result = runFight(setup, this.cfg.fight, this.rng, this.seedValue);
    this.lastFightResult = result;
    this.fightResults.push(result);

    if (result.outcome === "loss") {
      this.fights.push(summarizeLoss(this.fightIndex, result, sideMaxHp(this.roster), ids));
      this.roundLogs.push({
        fightIndex: this.fightIndex,
        encounterIndex: this.currentEncounterIndex,
        encounterName: this.currentEncounterName,
        rosterBefore,
        coinBefore,
        defaultFieldedIds: defaultIds,
        fieldedIds: ids,
        enemyBefore: enemy,
        projection: this.lastProjection,
        fightResult: result,
        outcome: "loss",
        spend: null,
        coinAwarded: 0,
        coinAfter: coinBefore,
        rosterAfter: null,
      });
      this.status = "over";
      this.overReason = "loss";
      return result;
    }

    this.pendingCoinAwarded = coinAwardFor(this.cfg, result);
    this.roster = applyFightResultToRoster(this.roster, player, result, this.cfg);
    this.coin += this.pendingCoinAwarded;
    // spend/coinAfter/rosterAfter start out pre-spend and get patched in
    // place by resolveSpend, once the spend choice actually resolves.
    this.roundLogs.push({
      fightIndex: this.fightIndex,
      encounterIndex: this.currentEncounterIndex,
      encounterName: this.currentEncounterName,
      rosterBefore,
      coinBefore,
      defaultFieldedIds: defaultIds,
      fieldedIds: ids,
      enemyBefore: enemy,
      projection: this.lastProjection,
      fightResult: result,
      outcome: "win",
      spend: null,
      coinAwarded: this.pendingCoinAwarded,
      coinAfter: this.coin,
      rosterAfter: this.roster,
    });
    return result;
  }

  /** Applies the player's (or the default "skip") spend choice for the fight
   * that just resolved, then advances to the next fight or run-complete (or
   * run-over, if the roster can no longer field a full squad). */
  resolveSpend(choice: SpendChoice): FightSummary {
    const applied = applySpend(this.cfg, this.roster, this.coin, choice);
    this.roster = applied.player;
    this.coin = applied.coin;

    const result = this.lastFightResult;
    if (!result) throw new Error("resolveSpend called before playNextFight");
    const summary = summarizeWin(this.fightIndex, result, this.pendingCoinAwarded, applied.spend, this.roster, this.fieldedThisFight);
    this.fights.push(summary);

    const round = this.roundLogs[this.roundLogs.length - 1];
    if (round && round.fightIndex === this.fightIndex) {
      round.spend = applied.spend;
      round.coinAfter = this.coin;
      round.rosterAfter = this.roster;
    }

    this.fightIndex++;
    if (this.fightIndex >= this.cfg.fightsPerRun) {
      this.status = "complete";
    } else if (!this.canFieldNextFight) {
      this.status = "over";
      this.overReason = "rosterExhausted";
    }
    return summary;
  }

  canAfford(choice: SpendChoice): boolean {
    if (choice === "heal") return this.coin >= this.cfg.healCoinCost;
    if (choice === "upgrade") return this.coin >= this.cfg.upgradeCoinCost;
    return true;
  }
}
