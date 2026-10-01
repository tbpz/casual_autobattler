import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { Offer } from "../sim/offers.js";
import type { CardId } from "../sim/cards/index.js";
import { FightView } from "./fightView.js";
import { Playback } from "./playback.js";
import { RunSession } from "./runSession.js";
import { renderRunCompleteScreen, renderRunOverScreen, renderRoundRecap } from "./runScreens.js";
import { renderRoundScreen } from "./roundScreen.js";
import { renderOfferScreen } from "./offerScreen.js";
import { renderRelicScreen } from "./relicScreen.js";
import { renderCollectionScreen } from "./collectionScreen.js";
import {
  loadCollection,
  recordRelic,
  recordRunEnded,
  recordSeen,
  recordTaken,
  saveCollection,
  type Collection,
  type StorageLike,
} from "../sim/collection.js";

const cfg = DEFAULT_RUN_CONFIG;

/**
 * Attribution self-test instrumentation (archive/ATTRIBUTION_TEST.md) —
 * two URL params, both no-ops when absent so ordinary play is unaffected:
 *  - ?seed=N pins the run seed (otherwise random, as before) and displays it
 *    in a corner badge on every screen, so a fight worth arguing about can be
 *    reproduced exactly (checks/determinism.ts already guarantees same
 *    seed -> same event log).
 *  - ?test=1 flips runScreens.ts's recap panel to hold its reveal behind
 *    a button, so a written cause isn't contaminated by reading the recap
 *    first.
 */
const urlParams = new URLSearchParams(location.search);
const testMode = urlParams.get("test") === "1";
const pinnedSeed = urlParams.get("seed");

/** The seed corner badge, present on every screen. */
function appendSeedBadge(root: HTMLElement, seed: number): void {
  const badge = document.createElement("div");
  badge.className = "seed-badge";
  badge.textContent = `seed ${seed}`;
  root.appendChild(badge);
}

export function mountApp(root: HTMLElement): void {
  let session: RunSession;
  let playback: Playback | null = null;
  // The player's squad-mix pick for the round about to be played.
  let pendingFieldedIds: string[] = [];

  // What the player has met across runs (2026-10-01; sim/collection.ts), kept in
  // localStorage. Storage can be missing or refuse (a private window), so it is
  // reached through a function that may return undefined, and a run plays the
  // same either way.
  const storage = (): StorageLike | undefined => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  };
  let collection: Collection = loadCollection(storage());
  function remember(next: Collection): void {
    collection = next;
    saveCollection(next, storage());
  }

  // The round 1 reward (2026-10-01): pick a relic. No row is pre-selected, and the
  // Collection button only shows once a run has ended — before that it is empty.
  function showRelicScreen(): void {
    renderRelicScreen(
      root,
      session.relicChoices,
      (id) => {
        remember(recordRelic(collection, id));
        session.pickRelic(id);
        afterRoundResolved();
      },
      collection.runsEnded > 0 ? () => renderCollectionScreen(root, collection, showRelicScreen) : undefined,
    );
    appendSeedBadge(root, session.seed);
  }

  function startNewRun(): void {
    const seed = pinnedSeed !== null && pinnedSeed !== "" ? Number(pinnedSeed) : Math.floor(Math.random() * 1_000_000_000);
    session = new RunSession(cfg, seed);
    // A run opens straight on its first fight (2026-10-01); the relic pick is that
    // fight's reward.
    showRoundScreen();
  }

  // The two ways a run ends. Each records the ended run once, then shows its
  // screen; the screen's Collection button comes back to the same screen.
  function endRun(how: "over" | "complete"): void {
    remember(recordRunEnded(collection));
    if (how === "over") showRunOver();
    else showRunComplete();
  }

  function showRunOver(): void {
    renderRunOverScreen(
      root,
      session.rounds.length,
      session.overReason,
      session.lastFightResult,
      session.lastProjection,
      startNewRun,
      testMode,
      () => renderCollectionScreen(root, collection, showRunOver),
    );
    appendSeedBadge(root, session.seed);
  }

  function showRunComplete(): void {
    renderRunCompleteScreen(root, session.rounds.length, startNewRun, () => renderCollectionScreen(root, collection, showRunComplete));
    appendSeedBadge(root, session.seed);
  }

  function showRoundScreen(): void {
    renderRoundScreen(
      root,
      cfg,
      session.currentRoundIndex,
      session.currentEncounterIndex,
      session.currentRoster,
      session.progress,
      session.currentEncounterName,
      session.currentEncounterBlurb,
      session.currentRoundKind,
      (fieldedIds) => {
        pendingFieldedIds = fieldedIds;
        playCurrentFight();
      },
    );
    appendSeedBadge(root, session.seed);
  }

  function playCurrentFight(): void {
    root.innerHTML = "";
    const fightContainer = document.createElement("div");
    root.appendChild(fightContainer);

    const controls = document.createElement("div");
    controls.className = "controls";
    root.appendChild(controls);

    const view = new FightView(fightContainer, cfg.fight);
    const result = session.playNextRound(pendingFieldedIds);

    playback = new Playback(
      result,
      (snapshot, events) => view.render(snapshot, events),
      () => onFightEnd(result),
      cfg.fight.chainFullTellThreshold,
      (simT) => view.renderFrame(simT),
    );

    const pauseBtn = document.createElement("button");
    pauseBtn.textContent = "Pause";
    pauseBtn.addEventListener("click", () => {
      if (!playback) return;
      if (playback.isPaused) {
        playback.play();
        pauseBtn.textContent = "Pause";
      } else {
        playback.pause();
        pauseBtn.textContent = "Resume";
      }
    });
    const stepBtn = document.createElement("button");
    stepBtn.textContent = "Step";
    stepBtn.addEventListener("click", () => playback?.step());

    controls.appendChild(pauseBtn);
    controls.appendChild(stepBtn);

    playback.play();
    appendSeedBadge(root, session.seed);
  }

  function onFightEnd(result: ReturnType<RunSession["playNextRound"]>): void {
    // Small pause so the resolve overlay (VICTORY/DEFEAT) is actually seen
    // before the screen changes underneath it.
    setTimeout(() => {
      if (session.status === "over") {
        endRun("over");
        return;
      }
      renderRoundRecap(root, session.currentRoundIndex, result, session.lastProjection, showReward, testMode);
      appendSeedBadge(root, session.seed);
    }, 900);
  }

  // After a win's recap: the relic pick on the relic round, the normal offers on
  // every other. A relic round that left too few units to field has neither: it
  // falls through to the offer path with nothing to show, which ends the run.
  function showReward(): void {
    if (session.awaitingRelic) showRelicScreen();
    else showOfferScreen();
  }

  function showOfferScreen(): void {
    if (session.pendingOffers.length === 0) {
      onOfferChosen(null);
      return;
    }
    // Every card put on screen counts as met, taken or not.
    remember(recordSeen(collection, session.pendingOffers.flatMap((o) => (o.kind === "card" && o.card ? [o.card] : []))));
    renderOfferScreen(root, session.pendingOffers, session.progress.cards, cfg.cardCap, onOfferChosen);
    appendSeedBadge(root, session.seed);
  }

  function onOfferChosen(offer: Offer | null, dropCardId?: CardId): void {
    if (offer?.kind === "card" && offer.card) remember(recordTaken(collection, offer.card));
    session.resolveOffer(offer, dropCardId);
    afterRoundResolved();
  }

  // The step after a win's reward (an offer or the relic) has been applied.
  function afterRoundResolved(): void {
    if (session.status === "complete") {
      endRun("complete");
      return;
    }
    // A WIN can still end the run here — the roster falling below
    // progress.slots living units means the NEXT round can't even be
    // fielded. Distinct from a round LOSS, which onFightEnd already caught
    // before the offer screen was ever shown.
    if (session.status === "over") {
      endRun("over");
      return;
    }
    showRoundScreen();
  }

  startNewRun();
}
