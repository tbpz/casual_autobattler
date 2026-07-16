import { runSim } from "../sim/engine";
import type { SimResult } from "../sim/events";
import { hexEquals, type Hex } from "../sim/hex";
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
  /** Fielded heroes and where they stand — hex placement within the round's authored deploy zone (DECISIONS 2026-07-15). */
  readonly placements: Readonly<Record<string, Hex>>;
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
    placements: {},
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

  private isLegalHex(target: Hex): boolean {
    return this.currentRound.deployZone.some((h) => hexEquals(h, target));
  }

  /**
   * Places (or moves) a fielded hero onto a legal deploy-zone hex. Dropping onto a hex that's
   * already occupied swaps — the occupant takes the mover's old hex if it had one, otherwise
   * (the mover came straight from the bench tray) the occupant is bumped back to the tray.
   * Retries deliberately keep the previous placement (see `retry`) so the player can move a
   * hero between attempts, not re-place all five.
   */
  placeHero(heroId: string, targetHex: Hex): void {
    const round = this.currentRound;
    if (!this.isLegalHex(targetHex)) return;

    const placements: Record<string, Hex> = { ...this.state.placements };
    const previousHex = placements[heroId];
    const alreadyPlaced = previousHex !== undefined;
    if (!alreadyPlaced && Object.keys(placements).length >= round.fieldSize) return;

    const occupantId = Object.keys(placements).find(
      (id) => id !== heroId && hexEquals(placements[id], targetHex),
    );
    if (occupantId !== undefined) {
      if (previousHex !== undefined) placements[occupantId] = previousHex;
      else delete placements[occupantId];
    }

    placements[heroId] = targetHex;
    this.state = { ...this.state, placements };
  }

  /** Returns a fielded hero to the bench tray. */
  unplaceHero(heroId: string): void {
    const placements = { ...this.state.placements };
    delete placements[heroId];
    this.state = { ...this.state, placements };
  }

  private get fieldedHeroIds(): string[] {
    return Object.keys(this.state.placements);
  }

  canStartFight(): boolean {
    return this.fieldedHeroIds.length === this.currentRound.fieldSize;
  }

  private buildPlayerRoster(): UnitDef[] {
    return Object.entries(this.state.placements).map(([heroId, hex]) => {
      const hero = this.state.bench.find((h) => h.id === heroId);
      if (hero === undefined) throw new Error(`Placement references unknown hero ${heroId}`);
      return effectiveUnitDef(hero, "player", hex);
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
      placements: {},
      status: "build",
    };
  }
}
