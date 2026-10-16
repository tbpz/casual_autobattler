import { CARD_DEFS, type CardId } from "../sim/cards/index.js";
import { markWordsHtml } from "./heroPickShared.js";
import { esc } from "./roundParts.js";

/**
 * Runes (canvas 6.1 to 6.3, DECISIONS.md 2026-10-16). "Rune" is the player-facing word for what the code calls a card or a relic
 * (CARD_DEFS, cardCap, sim/cards and sim/relics stay as they are). A relic is only the first rune the run hands out, so it is drawn
 * like any other: one round emblem, a ring in its mark colour around its glyph. The pick screen, the round screen's runes section,
 * the run-over build row and the drop step all draw it from here, so the one you pick is the one you meet next round.
 *
 * The section (canvas 6.4C, label 6.5C): its own box below the squad box. A title row (RUNES, with the count n of the cap, the
 * first rune included, at its right), then every rune held, in the order taken. Three runes or fewer all show; more shows the
 * two newest and a dashed "+N All ›" cell that opens the full list.
 */

/** A card's emblem colour: the mark it makes, else the mark it reads, else the mark a duo needs; a general card is grey. */
function upgradeColor(id: CardId): string {
  const def = CARD_DEFS[id];
  const mark = def.makes[0] ?? def.reads[0] ?? def.needs?.marks?.[0];
  return mark ? `var(--mark-${mark})` : "#c7cad6";
}

/** The glyph with U+FE0E, so a symbol that has a colour emoji form (❄ ☠ ⚡) takes the ring's colour instead. */
export function emblemHtml(id: CardId, size = 34): string {
  const def = CARD_DEFS[id];
  return `<span class="up-emblem" style="--em:${upgradeColor(id)};--sz:${size}px">${esc(def.icon)}︎</span>`;
}

/** An emblem with its name under it. A button when it can be tapped. */
export function upgradeCellHtml(id: CardId, tap = false): string {
  const tag = tap ? 'button type="button"' : "div";
  const end = tap ? "button" : "div";
  return `<${tag} class="up-cell" data-card="${id}">${emblemHtml(id)}<span class="up-name">${esc(CARD_DEFS[id].title)}</span></${end}>`;
}

/** Runes shown before the section folds the rest into "+N All ›". */
export const SECTION_CELLS = 3;

/** Which runes the section shows: three or fewer all show; more shows the two newest and counts the rest. */
export function sectionPlan(cards: CardId[]): { shown: CardId[]; hidden: number } {
  if (cards.length <= SECTION_CELLS) return { shown: [...cards], hidden: 0 };
  return { shown: cards.slice(-2), hidden: cards.length - 2 };
}

const NONE_YET = `<div class="up-cell up-none"><span class="up-emblem none" style="--sz:34px">–</span><span class="up-name">None yet</span></div>`;

/** The held runes as cells. Shared by the round section. */
function cellsHtml(cards: CardId[], tap: boolean): string {
  const { shown, hidden } = sectionPlan(cards);
  if (cards.length === 0) return NONE_YET;
  return (
    shown.map((id) => upgradeCellHtml(id, tap)).join("") +
    (hidden > 0
      ? `<button type="button" class="up-cell up-more"><span class="up-emblem more" style="--sz:34px">+${hidden}</span><span class="up-name">All ›</span></button>`
      : "")
  );
}

function wire(root: HTMLElement, cards: CardId[], cap: number, onCell?: (id: CardId, el: HTMLElement) => void): void {
  if (onCell) {
    root.querySelectorAll<HTMLElement>(".up-cell[data-card]").forEach((el) => el.addEventListener("click", () => onCell(el.dataset.card as CardId, el)));
  }
  root.querySelector(".up-more")?.addEventListener("click", () => openRunesSheet(cards, cap));
}

export interface SectionOpts {
  /** Every rune held, the first one included (sim/progress.ts's heldCards). */
  cards: CardId[];
  cap: number;
  /** Tapping a cell (the round screen says what it does); absent means cells are not buttons. */
  onCell?: (id: CardId, el: HTMLElement) => void;
}

/** The round screen's runes section: its own box below the squad box, a RUNES title row with the count at its right. */
export function upgradesSection(opts: SectionOpts): HTMLElement {
  const root = document.createElement("div");
  root.className = "up-box";
  root.innerHTML = `<div class="up-head"><span class="up-title">RUNES</span><span class="up-count">${opts.cards.length}/${opts.cap}</span></div><div class="up-row">${cellsHtml(opts.cards, !!opts.onCell)}</div>`;
  wire(root, opts.cards, opts.cap, opts.onCell);
  return root;
}

/** The run-over build row: the same cells, no count, wrapping when there are many. */
export function upgradesBuildHtml(cards: CardId[]): string {
  return cards.map((id) => upgradeCellHtml(id)).join("");
}

/**
 * The full list as a bottom sheet (canvas 6.2): a box that says how many runes you hold and what happens when you are full (a new
 * rune means dropping one of these), then every rune with its text. Closes on ✕ or a tap outside.
 */
export function openRunesSheet(cards: CardId[], cap: number): void {
  const row = (id: CardId): string =>
    `<div class="up-sheet-row">${emblemHtml(id, 32)}<div class="up-sheet-main"><div class="up-sheet-name">${esc(CARD_DEFS[id].title)}</div><div class="up-sheet-text">${markWordsHtml(esc(CARD_DEFS[id].detail))}</div></div></div>`;
  const full = cards.length >= cap;
  const rule = full
    ? `<b>RUNES · FULL</b><span>${cards.length}/${cap}</span><p>You can hold ${cap} runes. Taking a new one now means dropping one of these.</p>`
    : `<b>RUNES</b><span>${cards.length}/${cap}</span><p>You can hold ${cap} runes. When you are full, taking a new one means dropping one of these.</p>`;
  const overlay = document.createElement("div");
  overlay.className = "up-sheet-overlay";
  overlay.innerHTML =
    `<div class="up-sheet"><div class="up-sheet-grab"></div>` +
    `<div class="up-sheet-head"><b>YOUR RUNES</b><i class="up-sheet-x" data-close>✕</i></div>` +
    `<div class="up-sheet-rule${full ? " full" : ""}">${rule}</div>` +
    cards.map(row).join("") +
    `</div>`;
  const close = (): void => overlay.remove();
  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay || t.closest("[data-close]")) close();
  });
  document.body.appendChild(overlay);
}
