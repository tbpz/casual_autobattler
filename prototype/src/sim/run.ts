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
import { drawRoundEncounters, roundEnemySide } from "./rounds.js";
import { makeStartingRoster } from "./roles.js";
import { heldCards, makeInitialProgress, relicRngFor, upgradeRngFor, type RunProgress } from "./progress.js";
import { applyRelicStart, drawRelicChoices } from "./relics.js";
import type { CardId } from "./cards/index.js";
import { applyOffer, defaultCardDrop, drawOffers, noteIntroduced, type Offer } from "./offers.js";

export { roundEnemySide as makeEnemySide } from "./rounds.js";

/** Decides which of the 3 drawn offers to take (sim/offers.ts). The batch
 * harness passes a fixed policy; the UI passes the player's tap. */
export type OfferPolicy = (offers: Offer[], progress: RunProgress, roster: SideState) => Offer;

/** Priority order for the "greedy" policy below: survive first (bring back
 * the fallen, patch up), then get stronger (a role-wide chain level is the
 * biggest single lever), then widen the roster, then diversify. Not a claim
 * about optimal play — a fixed, reproducible stand-in for "a player who
 * triages sensibly," used by the headless batch/check population. */
const GREEDY_KIND_PRIORITY: Record<Offer["kind"], number> = {
  revive: 100,
  heal: 90,
  chainLevel: 70,
  statHp: 60,
  recruit: 50,
  slot: 40,
  chainGain: 30,
  statDamage: 20,
  // Payoff cards (2026-09-30): kept just under "slot" so the greedy
  // baseline population still grows its squad (checks/runShape.ts asserts
  // it). The "build" policy below is the one that chases payoffs.
  card: 35,
  // Rest (2026-09-30): the base is what a barely-worn unit's Rest is worth.
  // restRank below lifts it above everything except revive once the unit it
  // would rest is properly worn.
  rest: 10,
};

/** A unit this worn is worth resting: the greedy stand-in for a player who
 * notices a Frayed unit. A plain number rather than the config's sweet spot
 * because an OfferPolicy is handed no config. */
const GREEDY_REST_FATIGUE = 50;

/** Rest ranks by how worn the unit it would rest is — see GREEDY_REST_FATIGUE. */
function restRank(offer: Offer, roster: SideState): number {
  const unit = roster.heroes.find((h) => h.id === offer.unitId);
  return unit && unit.fatigue >= GREEDY_REST_FATIGUE ? 95 : GREEDY_KIND_PRIORITY.rest;
}

function greedyRank(offer: Offer, roster: SideState): number {
  return offer.kind === "rest" ? restRank(offer, roster) : GREEDY_KIND_PRIORITY[offer.kind];
}

export type OfferPolicyName = "first" | "random" | "greedy" | "build";

export function makeOfferPolicy(name: OfferPolicyName, rng?: Rng): OfferPolicy {
  switch (name) {
    case "first":
      return (offers) => offers[0]!;
    case "random":
      return (offers) => offers[Math.floor((rng?.next() ?? Math.random()) * offers.length)]!;
    case "greedy":
      return (offers, _progress, roster) =>
        [...offers].sort((a, b) => greedyRank(b, roster) - greedyRank(a, roster))[0]!;
    case "build":
      // Greedy, except survival first, then the chain "+N", then any payoff
      // card that connects to what the squad can make, then an ability gain
      // (2026-09-30) — a stand-in for a player who takes the greedy power
      // picks AND assembles a build, for measuring what payoffs add ON TOP of
      // greedy. Freeze/Scorch/Ward gains rank above the plain stat cards
      // because they are the only sources of Frozen/Burn/Shield-on-all.
      return (offers, _progress, roster) => {
        const rank = (o: Offer): number =>
          o.kind === "revive" || o.kind === "heal"
            ? 1000 + GREEDY_KIND_PRIORITY[o.kind]
            : o.kind === "rest" && restRank(o, roster) > GREEDY_KIND_PRIORITY.rest
              ? 1000 + restRank(o, roster)
              : o.kind === "chainLevel"
                ? 600
                : o.kind === "card" && o.connects
                  ? 500
                  : o.kind === "chainGain"
                    ? 450
                    : greedyRank(o, roster);
        return [...offers].sort((a, b) => rank(b) - rank(a))[0]!;
      };
  }
}

export interface RoundSummary {
  roundIndex: number;
  outcome: "win" | "loss";
  ignited: boolean;
  chainLength: number;
  /** The offer taken after this round's win, null for a loss (no offer is
   * ever shown after a loss) — see sim/offers.ts's Offer. */
  offerTaken: Offer | null;
  /** Living ROSTER units after this round (out of the full roster, not just
   * this round's fielded squad) — the run-wide "how much of my roster is
   * left" figure. */
  livingHeroesAfter: number;
  /** Roster-wide HP (bench included). */
  playerHpAfter: number;
  playerMaxHpAfter: number;
  /** Which roster members were fielded for this specific round — the UI
   * needs this to show "who fought" distinct from "who's on the roster." */
  fieldedIds: string[];
}

export interface RunResult {
  seed: number;
  rounds: RoundSummary[];
  /** Full per-round records, for a UI to replay any round in the run. */
  fightResults: FightResult[];
  outcome: "complete" | "over";
  /** Why the run ended early — undefined when outcome is "complete". A run
   * can end two structurally different ways — a round lost outright, or the
   * living roster falling below progress.slots so the NEXT round can't even
   * be fielded — and they read very differently to a player. */
  overReason?: "loss" | "rosterExhausted";
  roundsWon: number;
  finalProgress: RunProgress;
  /** The cards held (relic first) going into each round that was fought, by
   * round index — what a pair-synergy analysis needs to know about every fight
   * (2026-10-01), since the final hand says little about the fights before it. */
  heldByRound: CardId[][];
}

/**
 * The per-round step logic, factored out so both the headless batch runner
 * (runRun, below — a fixed policy decides synchronously) and an interactive
 * UI (render/runSession.ts — waits for a real player tap) drive the exact
 * same rules rather than two copies that could drift apart.
 */

export function summarizeLoss(roundIndex: number, result: FightResult, rosterMaxHpAtStart: number, fieldedIds: string[]): RoundSummary {
  return {
    roundIndex,
    outcome: "loss",
    ignited: result.ignited,
    chainLength: result.chainLength,
    offerTaken: null,
    livingHeroesAfter: 0,
    playerHpAfter: 0,
    playerMaxHpAfter: rosterMaxHpAtStart,
    fieldedIds,
  };
}

export function summarizeWin(
  roundIndex: number,
  result: FightResult,
  offerTaken: Offer | null,
  roster: RosterState,
  fieldedIds: string[],
): RoundSummary {
  return {
    roundIndex,
    outcome: "win",
    ignited: result.ignited,
    chainLength: result.chainLength,
    offerTaken,
    livingHeroesAfter: roster.heroes.filter((h) => h.alive).length,
    playerHpAfter: sideHp(roster),
    playerMaxHpAfter: sideMaxHp(roster),
    fieldedIds,
  };
}

export interface RunOptions {
  /** Overrides the accept-default fielding (roster.ts's defaultFieldPick).
   * MUST be pure and MUST NOT consume `rng`: doing so would shift the fight
   * RNG stream and break every seed-pinned check in checks/. */
  fieldPick?: FieldPick;
  /** Picks the run's starting relic from the three drawn (sim/relics.ts).
   * Default: the first drawn, which is itself a seeded random draw. `null`
   * starts the run with no relic at all — for checks that want to isolate the
   * rest. */
  startPick?: ((choices: CardId[]) => CardId) | null;
}

/** Runs one full `cfg.roundsPerRun`-round run to completion. Pure given
 * (cfg, rng, offerRng, offerPolicy, seed, opts). Each round fields the
 * ACCEPT-DEFAULT pick (roster.ts's defaultFieldPick) unless
 * opts.fieldPick overrides it — this is the headless/batch driver; an
 * interactive UI drives the equivalent steps itself (see
 * render/runSession.ts) so a real player can override the fielding choice. */
export function runRun(
  cfg: RunConfig,
  rng: Rng,
  offerRng: Rng,
  offerPolicy: OfferPolicy,
  seed: number,
  opts?: RunOptions,
): RunResult {
  const fieldPick = opts?.fieldPick ?? defaultFieldPick;
  let progress = makeInitialProgress(cfg, upgradeRngFor(seed));
  let roster: RosterState = makeStartingRoster(progress.bonus);

  // The start-of-run relic (2026-10-01): three drawn from the run's own relic
  // stream, one picked, applied before round 1.
  if (opts?.startPick !== null) {
    const relicRng = relicRngFor(seed);
    const choices = drawRelicChoices(relicRng);
    const started = applyRelicStart(progress, roster, (opts?.startPick ?? ((c) => c[0]!))(choices), relicRng);
    progress = started.progress;
    roster = started.roster;
  }

  const rounds: RoundSummary[] = [];
  const fightResults: FightResult[] = [];
  const roundOrder = drawRoundEncounters(seed, cfg.roundsPerRun);
  const heldByRound: CardId[][] = [];

  for (let i = 0; i < cfg.roundsPerRun; i++) {
    if (!canFieldSquad(roster, progress.slots)) {
      return { seed, rounds, fightResults, outcome: "over", overReason: "rosterExhausted", roundsWon: i, finalProgress: progress, heldByRound };
    }

    const fieldedIds = fieldPick(roster, progress.slots, { fightIndex: i, encounterIndex: roundOrder[i]! });
    const player = fieldSquad(roster, fieldedIds, progress);
    const enemy = roundEnemySide(cfg, i, roundOrder[i]!);

    heldByRound.push([...heldCards(progress)]);
    const setup: FightSetup = { player, enemy, cards: heldCards(progress) };
    const result = runFight(setup, cfg.fight, rng, seed);
    fightResults.push(result);

    if (result.outcome === "loss") {
      rounds.push(summarizeLoss(i, result, sideMaxHp(roster), fieldedIds));
      return { seed, rounds, fightResults, outcome: "over", overReason: "loss", roundsWon: i, finalProgress: progress, heldByRound };
    }

    roster = applyFightResultToRoster(roster, player, result, cfg);

    const offers = drawOffers(offerRng, progress, roster, cfg, i);
    progress = noteIntroduced(progress, offers);
    let offerTaken: Offer | null = null;
    if (offers.length > 0) {
      offerTaken = offerPolicy(offers, progress, roster);
      const applied = applyOffer(progress, roster, offerTaken, cfg, defaultCardDrop(progress, roster, offerTaken, cfg));
      progress = applied.progress;
      roster = applied.roster;
    }

    rounds.push(summarizeWin(i, result, offerTaken, roster, fieldedIds));
  }

  return { seed, rounds, fightResults, outcome: "complete", roundsWon: cfg.roundsPerRun, finalProgress: progress, heldByRound };
}
