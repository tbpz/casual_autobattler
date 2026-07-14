import type { ArenaRenderer } from "./arenaRenderer";
import type { Playback } from "./playback";

/**
 * Wires the standard play/pause/step/speed/scrub/telegraph controls (expected to exist
 * as elements with these IDs inside `root`) to a Playback + ArenaRenderer pair, and
 * starts the render ticker. Extracted because every screen that watches a fight needs
 * this identical wiring.
 */
export function mountPlaybackControls(root: ParentNode, renderer: ArenaRenderer, playback: Playback): void {
  const playPauseBtn = root.querySelector<HTMLButtonElement>("#btn-play-pause")!;
  const restartBtn = root.querySelector<HTMLButtonElement>("#btn-restart")!;
  const stepBackBtn = root.querySelector<HTMLButtonElement>("#btn-step-back")!;
  const stepFwdBtn = root.querySelector<HTMLButtonElement>("#btn-step-fwd")!;
  const speedSelect = root.querySelector<HTMLSelectElement>("#speed-select")!;
  const scrubber = root.querySelector<HTMLInputElement>("#scrubber")!;
  const tickLabel = root.querySelector<HTMLSpanElement>("#tick-label")!;
  const rangeToggle = root.querySelector<HTMLInputElement>("#toggle-range")!;
  const aggroToggle = root.querySelector<HTMLInputElement>("#toggle-aggro")!;
  const winnerBanner = root.querySelector<HTMLDivElement>("#winner-banner")!;

  scrubber.max = String(playback.totalTicks - 1);

  playback.onTickChange = (index, total) => {
    scrubber.value = String(index);
    tickLabel.textContent = `tick ${index} / ${total - 1}`;
  };
  // Playback renders its initial tick during construction, before this callback existed —
  // reflect that first frame in the UI now instead of waiting for the next tick change.
  playback.onTickChange(playback.currentIndex, playback.totalTicks);

  playback.onEnd = (winner) => {
    playPauseBtn.textContent = "▶ Play";
    winnerBanner.textContent = winner === "draw" ? "Draw — stalemate." : `${winner === "player" ? "Victory" : "Defeat"} — winner: ${winner}`;
    winnerBanner.className = winner === "player" ? "win" : winner === "enemy" ? "loss" : "draw";
  };

  playPauseBtn.addEventListener("click", () => {
    playback.toggle();
    playPauseBtn.textContent = playback.isPlaying ? "⏸ Pause" : "▶ Play";
    if (playback.isPlaying) winnerBanner.textContent = "";
  });
  restartBtn.addEventListener("click", () => {
    playback.restart();
    playPauseBtn.textContent = "▶ Play";
    winnerBanner.textContent = "";
  });
  stepBackBtn.addEventListener("click", () => {
    playback.step(-1);
    playPauseBtn.textContent = "▶ Play";
  });
  stepFwdBtn.addEventListener("click", () => {
    playback.step(1);
    playPauseBtn.textContent = "▶ Play";
  });
  speedSelect.addEventListener("change", () => {
    playback.setSpeed(Number(speedSelect.value));
  });
  scrubber.addEventListener("input", () => {
    const target = Number(scrubber.value);
    playback.pause();
    playback.seek(target);
    playPauseBtn.textContent = "▶ Play";
  });
  rangeToggle.addEventListener("change", () => {
    renderer.showRangeRings = rangeToggle.checked;
    playback.seek(playback.currentIndex);
  });
  aggroToggle.addEventListener("change", () => {
    renderer.showAggroLines = aggroToggle.checked;
    playback.seek(playback.currentIndex);
  });

  renderer.app.ticker.add((ticker) => {
    playback.update(ticker.deltaMS / 1000);
  });
}
