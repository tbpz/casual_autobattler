import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { SpendChoice } from "../sim/run.js";
import { fieldSquad } from "../sim/roster.js";
import { FightView } from "./fightView.js";
import { Playback } from "./playback.js";
import { RunSession } from "./runSession.js";
import { renderRunCompleteScreen, renderRunOverScreen, renderSpendScreen } from "./runScreens.js";
import { renderSquadPickScreen } from "./squadPickScreen.js";
import { renderFieldPickScreen } from "./fieldPickScreen.js";
import { renderPreFightScreen } from "./preFightScreen.js";

const cfg = DEFAULT_RUN_CONFIG;

export function mountApp(root: HTMLElement): void {
  let session: RunSession;
  let playback: Playback | null = null;
  // The player's field pick for the fight about to be played — set by
  // fieldPickScreen, consumed by both the pre-fight preview and
  // playCurrentFight (2026-08-09 roster/bench pass: fielding is now its own
  // per-fight decision, made before the pre-fight read, not derived from a
  // fixed 3-hero squad).
  let pendingFieldedIds: string[] = [];

  function startNewRun(): void {
    renderSquadPickScreen(root, cfg, (draftIds) => {
      const seed = Math.floor(Math.random() * 1_000_000_000);
      session = new RunSession(cfg, seed, draftIds);
      showFieldPickScreen();
    });
  }

  function showFieldPickScreen(): void {
    renderFieldPickScreen(
      root,
      cfg,
      session.currentFightIndex,
      session.currentEncounterIndex,
      session.currentRoster,
      session.currentEncounterName,
      session.currentEncounterBlurb,
      (fieldedIds) => {
        pendingFieldedIds = fieldedIds;
        showPreFightScreen();
      },
    );
  }

  function showPreFightScreen(): void {
    const player = fieldSquad(session.currentRoster, pendingFieldedIds);
    renderPreFightScreen(root, cfg, session.currentFightIndex, session.currentEncounterIndex, player, playCurrentFight);
  }

  function playCurrentFight(): void {
    root.innerHTML = "";
    const fightContainer = document.createElement("div");
    root.appendChild(fightContainer);

    const controls = document.createElement("div");
    controls.className = "controls";
    root.appendChild(controls);

    const view = new FightView(fightContainer, cfg.fight);
    const result = session.playNextFight(pendingFieldedIds);

    playback = new Playback(
      result,
      (snapshot, events) => view.render(snapshot, events),
      () => onFightEnd(result),
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
  }

  function onFightEnd(result: ReturnType<RunSession["playNextFight"]>): void {
    // Small pause so the resolve overlay (VICTORY/DEFEAT) is actually seen
    // before the screen changes underneath it.
    setTimeout(() => {
      if (session.status === "over") {
        renderRunOverScreen(
          root,
          session.fights.length,
          session.overReason,
          session.lastFightResult,
          session.lastProjection,
          startNewRun,
        );
        return;
      }
      renderSpendScreen(
        root,
        cfg,
        session,
        session.currentFightIndex,
        session.pendingCoinAwarded,
        result,
        session.lastProjection,
        onSpendChoice,
      );
    }, 900);
  }

  function onSpendChoice(choice: SpendChoice): void {
    session.resolveSpend(choice);
    if (session.status === "complete") {
      renderRunCompleteScreen(root, session.coinBalance, startNewRun);
      return;
    }
    // 2026-08-09 (roster/bench pass): a WIN can still end the run here — the
    // roster falling below cfg.playerN living heroes means the NEXT fight
    // can't even be fielded (RunSession.resolveSpend sets this the same way
    // sim/run.ts's runRun does). Distinct from a fight LOSS, which
    // onFightEnd already caught before the spend screen was ever shown.
    if (session.status === "over") {
      renderRunOverScreen(
        root,
        session.fights.length,
        session.overReason,
        session.lastFightResult,
        session.lastProjection,
        startNewRun,
      );
      return;
    }
    showFieldPickScreen();
  }

  startNewRun();
}
