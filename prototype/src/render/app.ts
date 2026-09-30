import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { Offer } from "../sim/offers.js";
import type { PayoffId } from "../sim/payoffs.js";
import { FightView } from "./fightView.js";
import { Playback } from "./playback.js";
import { RunSession } from "./runSession.js";
import { renderRunCompleteScreen, renderRunOverScreen, renderRoundRecap } from "./runScreens.js";
import { renderRoundScreen } from "./roundScreen.js";
import { renderOfferScreen } from "./offerScreen.js";

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

  function startNewRun(): void {
    const seed = pinnedSeed !== null && pinnedSeed !== "" ? Number(pinnedSeed) : Math.floor(Math.random() * 1_000_000_000);
    session = new RunSession(cfg, seed);
    showRoundScreen();
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
        renderRunOverScreen(
          root,
          session.rounds.length,
          session.overReason,
          session.lastFightResult,
          session.lastProjection,
          startNewRun,
          testMode,
        );
        appendSeedBadge(root, session.seed);
        return;
      }
      renderRoundRecap(root, session.currentRoundIndex, result, session.lastProjection, showOfferScreen, testMode);
      appendSeedBadge(root, session.seed);
    }, 900);
  }

  function showOfferScreen(): void {
    if (session.pendingOffers.length === 0) {
      onOfferChosen(null);
      return;
    }
    renderOfferScreen(root, session.pendingOffers, session.progress.payoffs, cfg.payoffCap, onOfferChosen);
    appendSeedBadge(root, session.seed);
  }

  function onOfferChosen(offer: Offer | null, dropPayoffId?: PayoffId): void {
    session.resolveOffer(offer, dropPayoffId);
    if (session.status === "complete") {
      renderRunCompleteScreen(root, session.rounds.length, startNewRun);
      appendSeedBadge(root, session.seed);
      return;
    }
    // A WIN can still end the run here — the roster falling below
    // progress.slots living units means the NEXT round can't even be
    // fielded. Distinct from a round LOSS, which onFightEnd already caught
    // before the offer screen was ever shown.
    if (session.status === "over") {
      renderRunOverScreen(
        root,
        session.rounds.length,
        session.overReason,
        session.lastFightResult,
        session.lastProjection,
        startNewRun,
        testMode,
      );
      appendSeedBadge(root, session.seed);
      return;
    }
    showRoundScreen();
  }

  startNewRun();
}
