import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { SpendChoice } from "../sim/run.js";
import { FightView } from "./fightView.js";
import { Playback } from "./playback.js";
import { RunSession } from "./runSession.js";
import { renderRunCompleteScreen, renderRunOverScreen, renderSpendScreen } from "./runScreens.js";

const cfg = DEFAULT_RUN_CONFIG;

export function mountApp(root: HTMLElement): void {
  let session: RunSession;
  let playback: Playback | null = null;

  function startNewRun(): void {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    session = new RunSession(cfg, seed);
    showReadyScreen();
  }

  function showReadyScreen(): void {
    root.innerHTML = "";
    const wrap = document.createElement("div");
    const label = document.createElement("p");
    label.className = "fight-clock";
    label.textContent = `Fight ${session.currentFightIndex + 1} of ${cfg.fightsPerRun}`;
    wrap.appendChild(label);

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";
    playBtn.style.display = "block";
    playBtn.style.margin = "0 auto";
    playBtn.addEventListener("click", playCurrentFight);
    wrap.appendChild(playBtn);

    root.appendChild(wrap);
  }

  function playCurrentFight(): void {
    root.innerHTML = "";
    const fightContainer = document.createElement("div");
    root.appendChild(fightContainer);

    const controls = document.createElement("div");
    controls.className = "controls";
    root.appendChild(controls);

    const view = new FightView(fightContainer, cfg.playerN, cfg.enemyN);
    const result = session.playNextFight();

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
        renderRunOverScreen(root, session.fights.length, startNewRun);
        return;
      }
      renderSpendScreen(
        root,
        cfg,
        session,
        session.currentFightIndex,
        session.pendingCoinAwarded,
        result.ignited,
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
    showReadyScreen();
  }

  startNewRun();
}
