import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import type { FightSetup, SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makeStartingRoster } from "../sim/roles.js";
import { encounterAt } from "../sim/encounters.js";
import { drawRoundEncounters, roundDef, roundEnemySide } from "../sim/rounds.js";
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
import { heldCards, makeInitialProgress, relicRngFor, upgradeRngFor, type RunProgress } from "../sim/progress.js";
import { applyRelicStart, drawRelicChoices } from "../sim/relics.js";
import { applyOffer, drawOffers, noteIntroduced, type Offer } from "../sim/offers.js";
import type { CardId } from "../sim/cards/index.js";
import { summarizeLoss, summarizeWin, type RoundSummary } from "../sim/run.js";

/**
 * Drives a run one round at a time, waiting for real player taps on both
 * decision points — which units fill this round's squad, and which of the 3
 * offers to take after a win — instead of a synchronous policy function.
 * Reuses the exact per-round step logic sim/run.ts's headless runRun uses
 * (roster.ts's helpers, sim/offers.ts's drawOffers/applyOffer), so the UI and
 * the batch harness can never drift apart on the rules — only on *when* each
 * decision resolves and *who* (a real player vs. the accept-default) makes
 * it.
 */
export class RunSession {
  private cfg: RunConfig;
  private rng: Rng;
  private offerRng: Rng;
  private relicRng: Rng;
  private seedValue: number;
  private roster: RosterState;
  private progressValue: RunProgress;
  private roundIndex = 0;
  private fieldedThisRound: string[] = [];
  /** This run's drawn round-by-round encounter shapes — indices into
   * sim/encounters.ts's ENCOUNTERS, one per round. Built once at
   * construction from the run's own seed via a separate RNG stream (see
   * sim/rounds.ts's drawRoundEncounters docstring). */
  private roundOrder: number[];

  rounds: RoundSummary[] = [];
  /** Every round played this run, in order. */
  fightResults: FightResult[] = [];
  lastFightResult: FightResult | null = null;
  /** The projection computed just before the round just resolved was
   * played — stashed here so the post-round recap can compare projected vs.
   * actual in the same units the round screen showed. */
  lastProjection: Projection | null = null;
  /** The offers drawn for the round just won, pending the player's pick. */
  pendingOffers: Offer[] = [];
  status: "in-progress" | "complete" | "over" = "in-progress";
  overReason: "loss" | "rosterExhausted" | null = null;
  /** The three relics offered at run start (2026-10-01; sim/relics.ts). The
   * run waits for pickRelic before its first round. */
  relicChoices: CardId[];

  constructor(cfg: RunConfig, seed: number) {
    this.cfg = cfg;
    this.seedValue = seed;
    this.rng = new Rng(seed);
    this.offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
    this.progressValue = makeInitialProgress(cfg, upgradeRngFor(seed));
    this.roster = makeStartingRoster(this.progressValue.bonus);
    this.roundOrder = drawRoundEncounters(seed, cfg.roundsPerRun);
    this.relicRng = relicRngFor(seed);
    this.relicChoices = drawRelicChoices(this.relicRng);
  }

  get progress(): RunProgress {
    return this.progressValue;
  }

  /** Takes the start-of-run relic. Called once, before the first round; a
   * second call is ignored so a double-tap can't swap it. Mercenary also
   * adds its fourth unit to the roster. */
  pickRelic(id: CardId): void {
    if (this.progressValue.relic || !this.relicChoices.includes(id)) return;
    const started = applyRelicStart(this.progressValue, this.roster, id, this.relicRng);
    this.progressValue = started.progress;
    this.roster = started.roster;
  }

  get currentRoundIndex(): number {
    return this.roundIndex;
  }

  get seed(): number {
    return this.seedValue;
  }

  /** This round's drawn ENCOUNTERS index — what actually gets fought. */
  get currentEncounterIndex(): number {
    return this.roundOrder[this.roundIndex] ?? this.roundIndex;
  }

  get currentEncounterName(): string {
    return encounterAt(this.currentEncounterIndex)?.name ?? "Unknown";
  }

  get currentEncounterBlurb(): string {
    return encounterAt(this.currentEncounterIndex)?.blurb ?? "";
  }

  get currentRoundKind() {
    return roundDef(this.roundIndex).kind;
  }

  /** Living ROSTER units (bench included) — the run-wide "how much of my
   * roster is left" figure. */
  get livingHeroes(): number {
    return livingRosterHeroes(this.roster).length;
  }

  get playerHp(): { hp: number; maxHp: number } {
    return { hp: sideHp(this.roster), maxHp: sideMaxHp(this.roster) };
  }

  /** The full roster (living and permanently-dead members both), for the
   * round screen. */
  get currentRoster(): RosterState {
    return this.roster;
  }

  /** The accept-default squad-mix pick — pre-checked on the round screen so
   * the minimum path stays Play -> watch -> Play. */
  get defaultFielding(): string[] {
    return defaultFieldPick(this.roster, this.progressValue.slots);
  }

  /** Whether the roster can even field a full squad for the next round. */
  get canFieldNextRound(): boolean {
    return canFieldSquad(this.roster, this.progressValue.slots);
  }

  /** The current FIELDED side, once playNextRound has been called for this
   * round — for a preview. Falls back to the default fielding before a
   * round has actually been played. */
  get currentPlayerSide(): SideState {
    const ids = this.fieldedThisRound.length > 0 ? this.fieldedThisRound : this.defaultFielding;
    return fieldSquad(this.roster, ids, this.progressValue);
  }

  /** Runs the next round with the given fielded ids (defaults to the
   * accept-default fielding) and returns its result for the FightView to
   * replay. On a win, draws this round's offers into pendingOffers but does
   * NOT apply one — call resolveOffer() once the player (or the
   * accept-default) picks. */
  playNextRound(fieldedIds?: string[]): FightResult {
    const ids = fieldedIds ?? this.defaultFielding;
    this.fieldedThisRound = ids;
    const player = fieldSquad(this.roster, ids, this.progressValue);
    const enemy = roundEnemySide(this.cfg, this.roundIndex, this.currentEncounterIndex);
    // Computed BEFORE runFight so the recap compares against what was
    // actually shown on the round screen, not a value derived after the
    // fact from the outcome.
    this.lastProjection = project(player, enemy, this.cfg.fight);
    const setup: FightSetup = { player, enemy, cards: heldCards(this.progressValue) };
    const result = runFight(setup, this.cfg.fight, this.rng, this.seedValue);
    this.lastFightResult = result;
    this.fightResults.push(result);

    if (result.outcome === "loss") {
      this.rounds.push(summarizeLoss(this.roundIndex, result, sideMaxHp(this.roster), ids));
      this.status = "over";
      this.overReason = "loss";
      return result;
    }

    this.roster = applyFightResultToRoster(this.roster, player, result, this.cfg);
    this.pendingOffers = drawOffers(this.offerRng, this.progressValue, this.roster, this.cfg, this.roundIndex);
    this.progressValue = noteIntroduced(this.progressValue, this.pendingOffers);
    return result;
  }

  /** Applies the player's (or the default) offer pick for the round that
   * just resolved, then advances to the next round or run-complete (or
   * run-over, if the roster can no longer field a full squad). Offers are
   * always non-empty here (drawOffers falls back to whatever's eligible),
   * except in the degenerate case where nothing at all is eligible — that
   * round simply advances with no change. */
  resolveOffer(offer: Offer | null, dropCardId?: CardId): RoundSummary {
    if (offer) {
      const applied = applyOffer(this.progressValue, this.roster, offer, this.cfg, dropCardId);
      this.progressValue = applied.progress;
      this.roster = applied.roster;
    }
    this.pendingOffers = [];

    const result = this.lastFightResult;
    if (!result) throw new Error("resolveOffer called before playNextRound");
    const summary = summarizeWin(this.roundIndex, result, offer, this.roster, this.fieldedThisRound);
    this.rounds.push(summary);

    this.roundIndex++;
    if (this.roundIndex >= this.cfg.roundsPerRun) {
      this.status = "complete";
    } else if (!this.canFieldNextRound) {
      this.status = "over";
      this.overReason = "rosterExhausted";
    }
    return summary;
  }
}
