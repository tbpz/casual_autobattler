import type { CardId } from "../sim/cards/index.js";
import { CARD_DEFS, MARK_CHIP } from "../sim/cards/index.js";

/**
 * 2026-10-01 (the build-depth plan, "G. a pick at the start of the run"). The
 * first screen of a run: three relics, pick one. Each is a small rule-bender
 * held all run (sim/relics.ts), so it points the run at a build before the first
 * fight. Reuses the offer screen's row frame (style.css's .offer-row) so a relic
 * reads as the same kind of choice as the picks that follow, and — like those —
 * no row is dressed up to look like the right answer.
 */
export function renderRelicScreen(
  container: HTMLElement,
  choices: CardId[],
  onChoose: (id: CardId) => void,
  onCollection?: () => void,
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
    const makes = def.makes.length
      ? `<span class="offer-reads">makes ${def.makes.map((m) => `<span class="mark-chip">${MARK_CHIP[m].icon} ${MARK_CHIP[m].word}</span>`).join("")}</span>`
      : "";
    const btn = document.createElement("button");
    btn.className = "offer-row cat-reaction";
    btn.innerHTML =
      `<span class="offer-rail"><span class="offer-rail-icon">${def.icon}</span><span class="offer-rail-word">RELIC</span></span>` +
      `<span class="offer-body">` +
      `<span class="offer-head"><span class="offer-headline">${def.title}</span></span>` +
      `<span class="offer-detail">${def.detail}</span>` +
      makes +
      `</span>`;
    btn.addEventListener("click", () => onChoose(id));
    rows.appendChild(btn);
  }
  screen.appendChild(rows);

  if (onCollection) {
    const collection = document.createElement("button");
    collection.className = "offer-back";
    collection.textContent = "Collection";
    collection.addEventListener("click", onCollection);
    screen.appendChild(collection);
  }
}
