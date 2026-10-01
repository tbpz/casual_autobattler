import { CARD_DEFS, DUO_IDS, MARK_CHIP, POOL_CARD_IDS, RELIC_IDS } from "../sim/cards/index.js";
import type { CardId } from "../sim/cards/index.js";
import type { MarkId } from "../sim/config.js";
import type { Collection } from "../sim/collection.js";
import { chainEffectChip } from "../sim/config.js";

/**
 * 2026-10-01 (the build-depth plan, "E. duo cards ... with a collection screen").
 * Every card, relic and duo in the game, split by what the player has met. A card
 * never offered is a dim "?"; one seen shows its name and text; one taken is
 * marked. A duo not yet found is a silhouette that still names the parts it
 * needs, so "I want Fortress" has somewhere to start.
 */
export function renderCollectionScreen(container: HTMLElement, collection: Collection, onBack: () => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen collection-screen";
  container.appendChild(screen);

  const h1 = document.createElement("h1");
  h1.textContent = "Collection";
  screen.appendChild(h1);

  const total = POOL_CARD_IDS.length + DUO_IDS.length + RELIC_IDS.length;
  const met = [...POOL_CARD_IDS, ...DUO_IDS, ...RELIC_IDS].filter((id) => collection.seen.includes(id) || collection.relics.includes(id)).length;
  const sub = document.createElement("div");
  sub.className = "offer-held";
  sub.textContent = `${met} of ${total} met`;
  screen.appendChild(sub);

  const chips = (marks: readonly MarkId[]): string =>
    marks.map((m) => `<span class="mark-chip">${MARK_CHIP[m].icon} ${MARK_CHIP[m].word}</span>`).join("");

  const section = (title: string, ids: readonly CardId[], state: (id: CardId) => "unknown" | "seen" | "taken"): void => {
    const h2 = document.createElement("h2");
    h2.className = "collection-heading";
    h2.textContent = title;
    screen.appendChild(h2);
    const grid = document.createElement("div");
    grid.className = "collection-grid";
    for (const id of ids) {
      const def = CARD_DEFS[id];
      const s = state(id);
      const cell = document.createElement("div");
      cell.className = `collection-cell collection-${s}${def.kind === "duo" ? " collection-duo" : ""}`;
      if (s === "unknown") {
        // A silhouette: no name, no text — but a duo still shows its parts, and
        // that is the whole point of it.
        const parts =
          def.kind === "duo" && def.needs
            ? [
                ...(def.needs.cards ?? []).map((c) => CARD_DEFS[c].title),
                ...(def.needs.effects ?? []).map((e) => chainEffectChip(e).word),
                ...(def.needs.marks ?? []).map((m) => MARK_CHIP[m].word),
              ].join(" + ")
            : "";
        cell.innerHTML =
          `<span class="collection-icon">?</span>` +
          `<span class="collection-name">${def.kind === "duo" ? "Hidden duo" : "Not met yet"}</span>` +
          (parts ? `<span class="collection-needs">needs ${parts}</span>` : "");
      } else {
        cell.innerHTML =
          `<span class="collection-icon">${def.icon}</span>` +
          `<span class="collection-name">${def.title}${s === "taken" ? " ✓" : ""}</span>` +
          `<span class="collection-text">${def.detail}</span>` +
          (def.reads.length > 0 ? `<span class="offer-reads">reads ${chips(def.reads)}</span>` : "") +
          (def.makes.length > 0 ? `<span class="offer-reads">makes ${chips(def.makes)}</span>` : "");
      }
      grid.appendChild(cell);
    }
    screen.appendChild(grid);
  };

  const cardState = (id: CardId): "unknown" | "seen" | "taken" =>
    collection.taken.includes(id) ? "taken" : collection.seen.includes(id) ? "seen" : "unknown";
  section("Duos", DUO_IDS, cardState);
  section("Relics", RELIC_IDS, (id) => (collection.relics.includes(id) ? "taken" : "unknown"));
  section("Cards", POOL_CARD_IDS, cardState);

  const back = document.createElement("button");
  back.className = "offer-back";
  back.textContent = "← Back";
  back.addEventListener("click", onBack);
  screen.appendChild(back);
}
