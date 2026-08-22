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

/**
 * Attribution self-test instrumentation (prototype/ATTRIBUTION_TEST.md) —
 * two URL params, both no-ops when absent so ordinary play is unaffected:
 *  - ?seed=N pins the run seed (otherwise random, as before) and displays it
 *    in a corner badge on every screen, so a fight worth arguing about can be
 *    reproduced exactly (checks/determinism.ts already guarantees same
 *    seed -> same event log).
 *  - ?test=1 flips runScreens.ts's recap panels to hold their reveal behind
 *    a button, so moment ③ of the fight card (write your own cause before
 *    seeing the game's) isn't contaminated by reading the recap first.
 */
const urlParams = new URLSearchParams(location.search);
const testMode = urlParams.get("test") === "1";
const pinnedSeed = urlParams.get("seed");

function appendSeedBadge(root: HTMLElement, seed: number): void {
  const badge = document.createElement("div");
  badge.className = "seed-badge";
  badge.textContent = `seed ${seed}`;
  root.appendChild(badge);
}

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
    const seed = pinnedSeed !== null && pinnedSeed !== "" ? Number(pinnedSeed) : Math.floor(Math.random() * 1_000_000_000);
    renderSquadPickScreen(root, cfg, (draftIds) => {
      session = new RunSession(cfg, seed, draftIds);
      showFieldPickScreen();
    });
    appendSeedBadge(root, seed);
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
    appendSeedBadge(root, session.seed);
  }

  function showPreFightScreen(): void {
    const player = fieldSquad(session.currentRoster, pendingFieldedIds);
    renderPreFightScreen(root, cfg, session.currentFightIndex, session.currentEncounterIndex, player, playCurrentFight);
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
    const result = session.playNextFight(pendingFieldedIds);

    playback = new Playback(
      result,
      (snapshot, events) => view.render(snapshot, events),
      () => onFightEnd(result),
      cfg.fight.chainEscalationKneeHit,
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
          testMode,
        );
        appendSeedBadge(root, session.seed);
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
        testMode,
      );
      appendSeedBadge(root, session.seed);
    }, 900);
  }

  function onSpendChoice(choice: SpendChoice): void {
    session.resolveSpend(choice);
    if (session.status === "complete") {
      renderRunCompleteScreen(root, session.coinBalance, startNewRun);
      appendSeedBadge(root, session.seed);
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
        testMode,
      );
      appendSeedBadge(root, session.seed);
      return;
    }
    showFieldPickScreen();
  }

  startNewRun();
}
