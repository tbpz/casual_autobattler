import { runSim } from "../sim/engine";
import type { SimResult } from "../sim/events";
import { loadMap } from "../sim/map";
import type { UnitDef } from "../sim/types";
import { applyDraftOffer, generateDraftOffers, type DraftOffer } from "./draft";
import { effectiveUnitDef, type HeroInstance } from "./hero";
import { ROUNDS, type RoundDef } from "./rounds";
import { createDefaultBench } from "./roster";

export const ATTEMPTS_PER_ROUND = 3;

export type RunStatus = "build" | "won" | "lost" | "run_over" | "run_complete";

export interface RunState {
  readonly bench: readonly HeroInstance[];
  readonly roundIndex: number;
  readonly attemptsLeft: number;
  readonly assignment: Readonly<Record<string, string | null>>;
  readonly status: RunStatus;
  readonly lastResult: SimResult | null;
  /** The exact unit list (player + enemy) that produced `lastResult` — attribution needs role/team context the result alone doesn't carry once units die out of the snapshots. */
  readonly lastUnits: readonly UnitDef[] | null;
  readonly draftOffers: readonly DraftOffer[];
}

function freshRunState(): RunState {
  return {
    bench: createDefaultBench(),
    roundIndex: 0,
    attemptsLeft: ATTEMPTS_PER_ROUND,
    assignment: {},
    status: "build",
    lastResult: null,
    lastUnits: null,
    draftOffers: [],
  };
}

/**
 * Owns run state and the transitions between BUILD -> WATCH -> WIN?/LOSE -> DRAFT/RETRY
 * from STATE.md's game loop. `runFight` runs the (headless, deterministic) sim to
 * completion synchronously; the caller is responsible for animating playback of the
 * returned SimResult before showing the result screen — this class has no opinion
 * about presentation timing.
 */
export class RunController {
  state: RunState = freshRunState();

  newRun(): void {
    this.state = freshRunState();
  }

  get currentRound(): RoundDef {
    return ROUNDS[this.state.roundIndex];
  }

  /** Assigns a hero to a slot, auto-vacating any other slot that already held them (swap semantics) — retries deliberately keep the previous placement so the player can move a hero, not re-pick all five. */
  assign(slotId: string, heroId: string | null): void {
    const assignment: Record<string, string | null> = { ...this.state.assignment };
    if (heroId !== null) {
      for (const sid of Object.keys(assignment)) {
        if (sid !== slotId && assignment[sid] === heroId) assignment[sid] = null;
      }
    }
    assignment[slotId] = heroId;
    this.state = { ...this.state, assignment };
  }

  private get fieldedHeroIds(): string[] {
    return Object.values(this.state.assignment).filter((id): id is string => id !== null);
  }

  canStartFight(): boolean {
    const ids = this.fieldedHeroIds;
    return ids.length === this.currentRound.playerSlots.length && new Set(ids).size === ids.length;
  }

  private buildPlayerRoster(): UnitDef[] {
    return this.currentRound.playerSlots.map((slot) => {
      const heroId = this.state.assignment[slot.id];
      const hero = this.state.bench.find((h) => h.id === heroId);
      if (hero === undefined) throw new Error(`Slot ${slot.id} has no hero assigned`);
      return effectiveUnitDef(hero, "player", slot.hex);
    });
  }

  runFight(): SimResult {
    const round = this.currentRound;
    const map = loadMap(round.mapRaw);
    const units = [...this.buildPlayerRoster(), ...round.enemyRoster];
    const result = runSim(map, units, round.seed);

    const attemptsLeft = this.state.attemptsLeft - 1;
    if (result.winner === "player") {
      this.state = {
        ...this.state,
        attemptsLeft,
        lastResult: result,
        lastUnits: units,
        status: "won",
        draftOffers: generateDraftOffers(this.state.bench),
      };
    } else {
      this.state = {
        ...this.state,
        attemptsLeft,
        lastResult: result,
        lastUnits: units,
        status: attemptsLeft <= 0 ? "run_over" : "lost",
      };
    }
    return result;
  }

  retry(): void {
    this.state = { ...this.state, status: "build" };
  }

  chooseDraftOffer(offer: DraftOffer): void {
    const bench = applyDraftOffer(this.state.bench, offer);
    const nextRoundIndex = this.state.roundIndex + 1;

    if (nextRoundIndex >= ROUNDS.length) {
      this.state = { ...this.state, bench, status: "run_complete" };
      return;
    }

    this.state = {
      ...this.state,
      bench,
      roundIndex: nextRoundIndex,
      attemptsLeft: ATTEMPTS_PER_ROUND,
      assignment: {},
      status: "build",
    };
  }
}
