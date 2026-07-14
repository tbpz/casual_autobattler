import "./style.css";
import { ATTEMPTS_PER_ROUND, RunController } from "./game/runController";
import { effectiveDamage, effectiveMaxHp, type HeroInstance } from "./game/hero";
import type { DraftOffer } from "./game/draft";
import { summarizeAttribution } from "./game/attribution";
import { loadMap } from "./sim/map";
import type { SimResult } from "./sim/events";
import type { Role } from "./sim/types";
import { ArenaRenderer } from "./render/arenaRenderer";
import { Playback } from "./render/playback";
import { mountPlaybackControls } from "./render/mountPlaybackControls";
import { TILE_PALETTE, cssColor } from "./render/palette";

const appEl = document.querySelector<HTMLDivElement>("#app")!;
const controller = new RunController();

type UiScreen = "build" | "watching" | "result";
let uiScreen: UiScreen = "build";
let pendingResult: SimResult | null = null;

function roleLabel(role: Role): string {
  return role === "melee_tank" ? "Tank" : "Archer";
}

function heroSummary(h: HeroInstance): string {
  return `${h.name} (${roleLabel(h.role)}, ${effectiveMaxHp(h)}hp / ${effectiveDamage(h)}dmg)`;
}

function legendMarkup(): string {
  const swatches = Object.values(TILE_PALETTE)
    .map(
      (entry) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${cssColor(entry.color)}"></span>${entry.label}</span>`,
    )
    .join("");
  return `<div id="legend">${swatches}</div>`;
}

function render(): void {
  if (uiScreen === "build") renderBuildScreen();
  else if (uiScreen === "watching" && pendingResult !== null) void renderWatchScreen(pendingResult);
  else renderResultScreen();
}

function renderBuildScreen(): void {
  const state = controller.state;
  const round = controller.currentRound;

  // Picking a hero already in another slot moves them here (see RunController.assign) —
  // every slot's dropdown lists the full bench, not just heroes not yet placed.
  const slotRows = round.playerSlots.map((slot) => {
    const selectedId = state.assignment[slot.id] ?? "";
    const options = ['<option value="">-- empty --</option>'].concat(
      state.bench.map((h) => `<option value="${h.id}" ${h.id === selectedId ? "selected" : ""}>${heroSummary(h)}</option>`),
    );
    return `
      <div class="slot-row">
        <label>${slot.label}</label>
        <select data-slot="${slot.id}">${options.join("")}</select>
      </div>
    `;
  }).join("");

  appEl.innerHTML = `
    <div id="root">
      <h1>${round.name}${round.isFinal ? " (Final)" : ""}</h1>
      <p class="briefing">${round.briefing}</p>
      <p class="meta">Attempts left this round: ${state.attemptsLeft} / ${ATTEMPTS_PER_ROUND}</p>
      <div id="build-slots">${slotRows}</div>
      <button id="btn-fight" ${controller.canStartFight() ? "" : "disabled"}>Fight!</button>
      ${controller.canStartFight() ? "" : '<p class="hint">Assign a hero to every slot to fight.</p>'}
    </div>
  `;

  appEl.querySelectorAll<HTMLSelectElement>("select[data-slot]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const slotId = sel.dataset.slot!;
      controller.assign(slotId, sel.value === "" ? null : sel.value);
      renderBuildScreen();
    });
  });

  appEl.querySelector<HTMLButtonElement>("#btn-fight")!.addEventListener("click", () => {
    pendingResult = controller.runFight();
    uiScreen = "watching";
    render();
  });
}

async function renderWatchScreen(result: SimResult): Promise<void> {
  const round = controller.currentRound;
  appEl.innerHTML = `
    <div id="root">
      <h1>${round.name} — Watch</h1>
      <div id="canvas-container"></div>
      ${legendMarkup()}
      <div id="controls">
        <button id="btn-restart" title="Restart">⏮</button>
        <button id="btn-step-back" title="Step back">⏪</button>
        <button id="btn-play-pause" title="Play/Pause">▶ Play</button>
        <button id="btn-step-fwd" title="Step forward">⏩</button>
        <select id="speed-select">
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
        </select>
        <input type="range" id="scrubber" min="0" max="0" value="0" />
        <span id="tick-label">tick 0 / 0</span>
      </div>
      <div id="telegraphs">
        <label><input type="checkbox" id="toggle-range" /> Range rings</label>
        <label><input type="checkbox" id="toggle-aggro" checked /> Aggro lines</label>
      </div>
      <div id="winner-banner"></div>
      <button id="btn-continue">Continue ▶</button>
    </div>
  `;

  const canvasContainer = appEl.querySelector<HTMLDivElement>("#canvas-container")!;
  const map = loadMap(round.mapRaw);
  const renderer = await ArenaRenderer.create(canvasContainer, map);
  const playback = new Playback(renderer, result);
  mountPlaybackControls(appEl, renderer, playback);
  playback.play();

  appEl.querySelector<HTMLButtonElement>("#btn-continue")!.addEventListener("click", () => {
    uiScreen = "result";
    render();
  });
}

function attributionMarkup(): string {
  const state = controller.state;
  if (state.lastResult === null || state.lastUnits === null) return "";
  const summary = summarizeAttribution(state.lastResult, state.lastUnits);

  const lines: string[] = [];
  if (summary.firstPlayerDeath !== null) {
    lines.push(`First loss: your ${roleLabel(summary.firstPlayerDeath.role)} at tick ${summary.firstPlayerDeath.tick}.`);
  }
  for (const share of summary.playerDeathsByKillerRole) {
    lines.push(`Enemy ${roleLabel(share.role)}s: ${share.count}/${summary.playerDeaths.length} of your losses (${Math.round(share.share * 100)}%).`);
  }
  for (const share of summary.enemyDeathsByKillerRole) {
    lines.push(`Your ${roleLabel(share.role)}s: ${share.count}/${summary.enemyDeaths.length} enemy kills (${Math.round(share.share * 100)}%).`);
  }

  return `
    <div id="attribution">
      <p class="headline">${summary.headline}</p>
      ${lines.length > 0 ? `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}
    </div>
  `;
}

function renderResultScreen(): void {
  const state = controller.state;
  let body = "";

  if (state.status === "won") {
    body = `
      <h1>Victory!</h1>
      ${attributionMarkup()}
      <p class="meta">Choose one:</p>
      <div id="draft-offers">
        ${state.draftOffers.map((o, i) => `<button class="draft-offer" data-idx="${i}">${o.label}</button>`).join("")}
      </div>
    `;
  } else if (state.status === "lost") {
    body = `
      <h1>Defeat</h1>
      ${attributionMarkup()}
      <p class="meta">Attempts left: ${state.attemptsLeft} / ${ATTEMPTS_PER_ROUND}</p>
      <button id="btn-retry">Diagnose &amp; Retry</button>
    `;
  } else if (state.status === "run_over") {
    body = `
      <h1>Run Over</h1>
      <p class="meta">Out of attempts on ${controller.currentRound.name}.</p>
      <button id="btn-new-run">New Run</button>
    `;
  } else if (state.status === "run_complete") {
    body = `
      <h1>Run Complete!</h1>
      <p class="meta">You beat the final round. Well fought.</p>
      <button id="btn-new-run">New Run</button>
    `;
  }

  appEl.innerHTML = `<div id="root">${body}</div>`;

  if (state.status === "won") {
    appEl.querySelectorAll<HTMLButtonElement>(".draft-offer").forEach((btn) => {
      btn.addEventListener("click", () => {
        const offer: DraftOffer = state.draftOffers[Number(btn.dataset.idx)];
        controller.chooseDraftOffer(offer);
        uiScreen = controller.state.status === "build" ? "build" : "result";
        render();
      });
    });
  } else if (state.status === "lost") {
    appEl.querySelector<HTMLButtonElement>("#btn-retry")!.addEventListener("click", () => {
      controller.retry();
      uiScreen = "build";
      render();
    });
  } else {
    appEl.querySelector<HTMLButtonElement>("#btn-new-run")?.addEventListener("click", () => {
      controller.newRun();
      uiScreen = "build";
      render();
    });
  }
}

render();
