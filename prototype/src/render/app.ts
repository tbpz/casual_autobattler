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
import { downloadRunLog } from "../log/download.js";

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

/** The seed corner badge, present on every screen, with an "export" link that
 * downloads the run so far as JSON (log/runLog.ts). Each click writes every
 * round played to that point, so the last file from a run is the full record. */
function appendSeedBadge(root: HTMLElement, session: RunSession): void {
  const badge = document.createElement("div");
  badge.className = "seed-badge";
  badge.textContent = `seed ${session.seed} · `;
  const exportLink = document.createElement("a");
  exportLink.className = "export-log-link";
  exportLink.href = "#";
  exportLink.textContent = "export";
  exportLink.addEventListener("click", (e) => {
    e.preventDefault();
    downloadRunLog(session, cfg);
  });
  badge.appendChild(exportLink);
  root.appendChild(badge);
}

export function mountApp(root: HTMLElement): void {
  let session: RunSession;
  let playback: Playback | null = null;
  // The player's squad-mix pick for the round about to be played.
  let pendingFieldedIds: string[] = [];

  // The round 1 reward (2026-10-01): pick a relic. No row is pre-selected.
  function showRelicScreen(): void {
    renderRelicScreen(root, session.relicChoices, (id) => {
      session.pickRelic(id);
      afterRoundResolved();
    });
    appendSeedBadge(root, session);
  }

  function startNewRun(): void {
    const seed = pinnedSeed !== null && pinnedSeed !== "" ? Number(pinnedSeed) : Math.floor(Math.random() * 1_000_000_000);
    session = new RunSession(cfg, seed);
    // A run opens straight on its first fight (2026-10-01); the relic pick is that
    // fight's reward.
    showRoundScreen();
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
    );
    appendSeedBadge(root, session);
  }

  function showRunComplete(): void {
    renderRunCompleteScreen(root, session.rounds.length, startNewRun);
    appendSeedBadge(root, session);
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
      session.defaultFielding,
      (fieldedIds) => {
        pendingFieldedIds = fieldedIds;
        playCurrentFight();
      },
    );
    appendSeedBadge(root, session);
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
      () => onFightEnd(result, view),
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
    appendSeedBadge(root, session);
  }

  function onFightEnd(result: ReturnType<RunSession["playNextRound"]>, view: FightView): void {
    // The overlay (VICTORY/DEFEAT) only shows after the last hit lands and the
    // last body falls, so the pause starts from when it appears, not from now.
    view.onResolveShown(() => {
      setTimeout(() => {
        if (session.status === "over") {
          showRunOver();
          return;
        }
        renderRoundRecap(root, session.currentRoundIndex, result, session.lastProjection, showReward, testMode);
        appendSeedBadge(root, session);
      }, 900);
    });
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
    renderOfferScreen(root, session.pendingOffers, session.progress.cards, cfg.cardCap, onOfferChosen);
    appendSeedBadge(root, session);
  }

  function onOfferChosen(offer: Offer | null, dropCardId?: CardId): void {
    session.resolveOffer(offer, dropCardId);
    afterRoundResolved();
  }

  // The step after a win's reward (an offer or the relic) has been applied.
  function afterRoundResolved(): void {
    if (session.status === "complete") {
      showRunComplete();
      return;
    }
    // A WIN can still end the run here — the roster falling below
    // progress.slots living units means the NEXT round can't even be
    // fielded. Distinct from a round LOSS, which onFightEnd already caught
    // before the offer screen was ever shown.
    if (session.status === "over") {
      showRunOver();
      return;
    }
    showRoundScreen();
  }

  startNewRun();
}
