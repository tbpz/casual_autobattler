import type { CardId } from "../sim/cards/index.js";
import { CARD_DEFS } from "../sim/cards/index.js";
import { markWordsHtml } from "./heroPickShared.js";

/**
 * 2026-10-01 (the build-depth plan, "G. a pick at the start of the run", moved by
 * DECISIONS.md's relic-timing entries). The reward for winning round 1: three
 * relics, pick one. Each is a small rule-bender held for the rest of the run
 * (sim/relics.ts), so it points the run at a build once the player has seen a
 * fight. Reuses the offer screen's row frame (style.css's .offer-row) so a relic
 * reads as the same kind of choice as the picks that follow, and — like those —
 * no row is dressed up or pre-selected as the right answer.
 */
export function renderRelicScreen(
  container: HTMLElement,
  choices: CardId[],
  onChoose: (id: CardId) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  container.appendChild(screen);

  const h1 = document.createElement("h1");
  h1.textContent = "Choose a relic";
  screen.appendChild(h1);

  const sub = document.createElement("div");
  sub.className = "offer-held";
  sub.textContent = "It stays with you for the whole run.";
  screen.appendChild(sub);

  const rows = document.createElement("div");
  rows.className = "offer-rows";
  for (const id of choices) {
    const def = CARD_DEFS[id];
    const btn = document.createElement("button");
    btn.className = "offer-row cat-reaction";
    btn.innerHTML =
      `<span class="offer-rail"><span class="offer-rail-icon">${def.icon}</span><span class="offer-rail-word">RELIC</span></span>` +
      `<span class="offer-body">` +
      `<span class="offer-head"><span class="offer-headline">${def.title}</span></span>` +
      `<span class="offer-detail">${markWordsHtml(def.detail)}</span>` +
      `</span>`;
    btn.addEventListener("click", () => onChoose(id));
    rows.appendChild(btn);
  }
  screen.appendChild(rows);

}
