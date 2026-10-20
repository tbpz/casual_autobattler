import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import type { ArmyKind, FightSetup, HeroKind, SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makeStartingRoster, nameUnits } from "../sim/roles.js";
import { encounterAt } from "../sim/encounters.js";
import { drawRoundEncounters, roundDef, roundEnemySide } from "../sim/rounds.js";
import { runFight } from "../sim/fight.js";
import type { FightResult } from "../sim/events.js";
import { project, type Projection } from "../sim/projection.js";
import {
  applyFightResultToRoster,
  canFieldSquad,
  carryOverFieldPick,
  carryOverWithGaps,
  fieldSquad,
  livingRosterHeroes,
  type RosterState,
} from "../sim/roster.js";
import { heldCards, makeInitialProgress, relicRngFor, upgradeRngFor, type RunProgress } from "../sim/progress.js";
import { applyRelic, drawRelicChoices } from "../sim/relics.js";
import { applyOffer, drawOffers, noteIntroduced, type Offer } from "../sim/offers.js";
import type { CardId } from "../sim/cards/index.js";
import { summarizeLoss, summarizeWin, type RoundSummary } from "../sim/run.js";
import { applyMerge, mergeCandidates, type MergeOption } from "../sim/heroes.js";
import { makeArmyRoster } from "../sim/armies.js";

/** A fielded unit as it stood going into a round — the readings an export log
 * needs, not the fight's full HeroState (windup targeting and the like are
 * per-fight transient state). */
export interface UnitReading {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  fatigue: number;
  chainEffects: string[];
  chainLevel: number;
  /** Which merge hero this is (2026-10-20), null for a basic unit. */
  hero: string | null;
  /** Which army unit this is (2026-10-20), null for a plain unit. */
  unit: string | null;
}

/** Everything the export log (log/runLog.ts) needs to know about one round,
 * written as the round happens: the state going in, the fight, and the reward
 * taken after it. The reward fields stay empty for a lost round (no offer is
 * ever shown after a loss). */
export interface RoundLog {
  roundIndex: number;
  kind: string;
  encounterIndex: number;
  encounterName: string;
  fieldedIds: string[];
  defaultFieldedIds: string[];
  squad: UnitReading[];
  /** A copy, taken before the fight: the relic, held cards, per-role abilities
   * and levels, stat bonus and slots the run carried into this round. */
  progressBefore: RunProgress;
  projection: Projection;
  fightResult: FightResult;
  relicChoices: CardId[] | null;
  relicTaken: CardId | null;
  offersShown: Offer[];
  offerTaken: Offer | null;
  droppedCard: CardId | null;
  /** The heroes the roster could merge on a mini-boss win (empty on every other round), and the one taken. */
  mergeChoices: HeroKind[];
  mergeTaken: HeroKind | null;
}

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
  /** One entry per round played, in order — what the export log is built from. */
  roundLogs: RoundLog[] = [];
  lastFightResult: FightResult | null = null;
  /** The projection computed just before the round just resolved was
   * played — stashed here so the post-round recap can compare projected vs.
   * actual in the same units the round screen showed. */
  lastProjection: Projection | null = null;
  /** The offers drawn for the round just won, pending the player's pick. */
  pendingOffers: Offer[] = [];
  status: "in-progress" | "complete" | "over" = "in-progress";
  overReason: "loss" | "rosterExhausted" | null = null;
  /** The three relics on offer as the round 1 reward (2026-10-01;
   * sim/relics.ts). */
  relicChoices: CardId[];
  /** True after a win in cfg.relicRound, while the relic pick is the reward the
   * run is waiting on. False when that win left too few units to field a squad:
   * there is nothing to pick, and resolveOffer(null) ends the run. */
  awaitingRelic = false;
  /** The merges on offer after a mini-boss win (2026-10-20; sim/heroes.ts's mergeCandidates), while the pick is
   * the reward the run is waiting on. Empty on every other round. The round's offers are already drawn into
   * pendingOffers and show if the player says "not now" (resolveMerge(null)). */
  mergeChoices: MergeOption[] = [];
  awaitingMerge = false;

  /** `army` is the army picked before round 1 (sim/armies.ts); undefined plays the plain squad (dev links, checks). */
  constructor(cfg: RunConfig, seed: number, army?: ArmyKind) {
    this.cfg = cfg;
    this.seedValue = seed;
    this.rng = new Rng(seed);
    this.offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
    this.progressValue = makeInitialProgress(cfg, upgradeRngFor(seed), army);
    this.roster = this.withNames(army ? makeArmyRoster(army, this.progressValue.bonus) : makeStartingRoster(this.progressValue.bonus, cfg.startingPerRole));
    this.roundOrder = drawRoundEncounters(seed, cfg.roundsPerRun);
    this.relicRng = relicRngFor(seed);
    this.relicChoices = drawRelicChoices(this.relicRng);
  }

  /** Gives any unit that still has a role-label name a name of its own (sim/roles.ts nameUnits),
   * drawn from the run seed, so a recruit is named the moment it joins. */
  private withNames(roster: RosterState): RosterState {
    const heroes = nameUnits(roster.heroes, this.seedValue);
    return heroes === roster.heroes ? roster : { ...roster, heroes };
  }

  get progress(): RunProgress {
    return this.progressValue;
  }

  /** Takes the relic that is the reward for the relic round's win, and ends
   * that round. Ignored unless a pick is pending, so a double-tap can't take
   * a second one. */
  pickRelic(id: CardId): void {
    if (!this.awaitingRelic || !this.relicChoices.includes(id)) return;
    const applied = applyRelic(this.progressValue, this.roster, id, this.cfg);
    this.progressValue = applied.progress;
    this.roster = this.withNames(applied.roster);
    this.awaitingRelic = false;
    const log = this.roundLogs[this.roundLogs.length - 1];
    if (log) {
      log.relicChoices = [...this.relicChoices];
      log.relicTaken = id;
    }
    this.finishRound(null, id);
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
    return carryOverFieldPick(this.roster, this.progressValue.slots, this.fieldedThisRound);
  }

  /** The round screen's starting pick: last round's living squad, with a slot left EMPTY where a
   * unit died (DECISIONS.md 2026-10-16), so it can be shorter than the slot count. The player
   * fills each gap on the squad screen before Fight is allowed. */
  get defaultPickWithGaps(): string[] {
    return carryOverWithGaps(this.roster, this.progressValue.slots, this.fieldedThisRound);
  }

  /** The ids fielded in the round just played (empty before round 1), for the "X fell last round" line. */
  get lastFielded(): string[] {
    return this.fieldedThisRound;
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
    // Read before fieldedThisRound is overwritten: the round log records what
    // the screen pre-ticked, which depends on last round's squad.
    const defaultIds = this.defaultFielding;
    const ids = fieldedIds ?? defaultIds;
    this.fieldedThisRound = ids;
    const player = fieldSquad(this.roster, ids, this.progressValue);
    const enemy = roundEnemySide(this.cfg, this.roundIndex, this.currentEncounterIndex);
    // Computed BEFORE runFight so the recap compares against what was
    // actually shown on the round screen, not a value derived after the
    // fact from the outcome.
    this.lastProjection = project(player, enemy, this.cfg.fight);
    // Read before runFight, in case the fight touches the squad it was handed.
    const squad: UnitReading[] = player.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      role: h.role,
      hp: h.hp,
      maxHp: h.maxHp,
      fatigue: h.fatigue,
      chainEffects: [...(h.chainEffects ?? [])],
      chainLevel: h.chainLevel ?? 1,
      hero: h.hero ?? null,
      unit: h.kind ?? null,
    }));
    const progressBefore = structuredClone(this.progressValue);
    const setup: FightSetup = { player, enemy, cards: heldCards(this.progressValue) };
    const result = runFight(setup, this.cfg.fight, this.rng, this.seedValue);
    this.lastFightResult = result;
    this.fightResults.push(result);
    this.roundLogs.push({
      roundIndex: this.roundIndex,
      kind: this.currentRoundKind,
      encounterIndex: this.currentEncounterIndex,
      encounterName: this.currentEncounterName,
      fieldedIds: [...ids],
      defaultFieldedIds: defaultIds,
      squad,
      progressBefore,
      projection: this.lastProjection,
      fightResult: result,
      relicChoices: null,
      relicTaken: null,
      offersShown: [],
      offerTaken: null,
      droppedCard: null,
      mergeChoices: [],
      mergeTaken: null,
    });

    if (result.outcome === "loss") {
      this.rounds.push(summarizeLoss(this.roundIndex, result, sideMaxHp(this.roster), ids));
      this.status = "over";
      this.overReason = "loss";
      return result;
    }

    this.roster = applyFightResultToRoster(this.roster, player, result, this.cfg);
    // The relic round's reward is the relic pick, not offers (2026-10-01).
    if (this.roundIndex === this.cfg.relicRound) {
      this.pendingOffers = [];
      this.awaitingRelic = this.canFieldNextRound;
      return result;
    }
    // The final round's win ends the run — no offers to pick from.
    if (this.roundIndex === this.cfg.roundsPerRun - 1) {
      this.pendingOffers = [];
      return result;
    }
    // Drawn either way, so a seed keeps its offer stream whether or not a merge is taken.
    this.pendingOffers = drawOffers(this.offerRng, this.progressValue, this.roster, this.cfg, this.roundIndex);
    // A mini-boss win offers a merge first (2026-10-20). The offers wait, and count as shown only if the
    // player says "not now" — the same rule as sim/run.ts's runRun.
    if (roundDef(this.roundIndex).kind === "miniboss") {
      const candidates = mergeCandidates(this.progressValue, this.roster, this.cfg);
      if (candidates.length > 0) {
        this.mergeChoices = candidates;
        this.awaitingMerge = true;
        this.roundLogs[this.roundLogs.length - 1]!.mergeChoices = candidates.map((c) => c.kind);
        return result;
      }
    }
    this.progressValue = noteIntroduced(this.progressValue, this.pendingOffers);
    this.roundLogs[this.roundLogs.length - 1]!.offersShown = [...this.pendingOffers];
    return result;
  }

  /** Takes the merge picked after a mini-boss win (its three units leave, the hero joins) and ends the round, or,
   * with null ("not now"), leaves the round's normal offers to be shown. Ignored unless a merge is pending. */
  resolveMerge(kind: HeroKind | null): void {
    if (!this.awaitingMerge) return;
    const chosen = kind ? this.mergeChoices.find((c) => c.kind === kind) : undefined;
    if (kind && !chosen) return;
    this.awaitingMerge = false;
    this.mergeChoices = [];
    const log = this.roundLogs[this.roundLogs.length - 1];
    if (chosen) {
      this.roster = this.withNames(applyMerge(this.progressValue, this.roster, chosen));
      this.pendingOffers = [];
      if (log) log.mergeTaken = chosen.kind;
      this.finishRound(null, undefined, chosen.kind);
      return;
    }
    this.progressValue = noteIntroduced(this.progressValue, this.pendingOffers);
    if (log) log.offersShown = [...this.pendingOffers];
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
      this.roster = this.withNames(applied.roster);
      const log = this.roundLogs[this.roundLogs.length - 1];
      if (log) {
        log.offerTaken = offer;
        log.droppedCard = dropCardId ?? null;
      }
    }
    this.pendingOffers = [];
    return this.finishRound(offer);
  }

  /** Closes the round just won — records its summary, then advances to the
   * next round, or to run-complete or run-over. Shared by resolveOffer and
   * pickRelic. */
  private finishRound(offer: Offer | null, relicTaken?: CardId, mergeTaken?: HeroKind): RoundSummary {
    const result = this.lastFightResult;
    if (!result) throw new Error("finishRound called before playNextRound");
    const summary = summarizeWin(this.roundIndex, result, offer, this.roster, this.fieldedThisRound, relicTaken, mergeTaken);
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
