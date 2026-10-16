import { CARD_DEFS, type CardId } from "../sim/cards/index.js";
import { markWordsHtml } from "./heroPickShared.js";
import { esc } from "./roundParts.js";

/**
 * Upgrades (canvas 6.1 to 6.3, DECISIONS.md 2026-10-16). "Upgrade" is the player-facing word for what the code calls a card
 * (CARD_DEFS, cardCap, sim/cards stay as they are). One upgrade is drawn the same everywhere: a round emblem, a ring in its
 * mark colour around its glyph, the relic's ring gold. The pick screen, the round screen's upgrades section, the run-over
 * build row and the drop step all draw it from here, so the one you pick is the one you meet next round.
 *
 * The section (canvas 6.4C): its own box below the squad box, no title and no RELIC tag. The relic on the left, a divider,
 * then the upgrades, and the count (n of the cap, the relic not counted) as a small legend on the box's top edge. Three
 * upgrades or fewer all show; more shows the two newest and a dashed "+N All ›" cell that opens the full list.
 */

/** A card's emblem colour: the mark it makes, else the mark it reads, else the mark a duo needs; a general card is grey. */
function upgradeColor(id: CardId): string {
  const def = CARD_DEFS[id];
  const mark = def.makes[0] ?? def.reads[0] ?? def.needs?.marks?.[0];
  return mark ? `var(--mark-${mark})` : "#c7cad6";
}

export function isRelic(id: CardId): boolean {
  return CARD_DEFS[id].kind === "relic";
}

/** The glyph with U+FE0E, so a symbol that has a colour emoji form (❄ ☠ ⚡) takes the ring's colour instead. */
export function emblemHtml(id: CardId, size = 34): string {
  const def = CARD_DEFS[id];
  return `<span class="up-emblem${isRelic(id) ? " relic" : ""}" style="--em:${upgradeColor(id)};--sz:${size}px">${esc(def.icon)}︎</span>`;
}

/** An emblem with its name under it. A button when it can be tapped. */
export function upgradeCellHtml(id: CardId, tap = false): string {
  const tag = tap ? 'button type="button"' : "div";
  const end = tap ? "button" : "div";
  return `<${tag} class="up-cell" data-card="${id}">${emblemHtml(id)}<span class="up-name">${esc(CARD_DEFS[id].title)}</span></${end}>`;
}

/** Upgrades shown before the section folds the rest into "+N All ›". */
export const SECTION_CELLS = 3;

/** Which upgrades the section shows: three or fewer all show; more shows the two newest and counts the rest. */
export function sectionPlan(cards: CardId[]): { shown: CardId[]; hidden: number } {
  if (cards.length <= SECTION_CELLS) return { shown: [...cards], hidden: 0 };
  return { shown: cards.slice(-2), hidden: cards.length - 2 };
}

const NONE_YET = `<div class="up-cell up-none"><span class="up-emblem none" style="--sz:34px">–</span><span class="up-name">None yet</span></div>`;

/** The relic, a divider, then the upgrades. Shared by the round section and the pick screen's held row. */
function cellsHtml(relic: CardId | undefined, cards: CardId[], tap: boolean): string {
  const { shown, hidden } = sectionPlan(cards);
  const side =
    cards.length === 0
      ? NONE_YET
      : shown.map((id) => upgradeCellHtml(id, tap)).join("") +
        (hidden > 0
          ? `<button type="button" class="up-cell up-more"><span class="up-emblem more" style="--sz:34px">+${hidden}</span><span class="up-name">All ›</span></button>`
          : "");
  return `${relic ? upgradeCellHtml(relic, tap) + `<span class="up-divider"></span>` : ""}${side}`;
}

function wire(root: HTMLElement, relic: CardId | undefined, cards: CardId[], cap: number, onCell?: (id: CardId, el: HTMLElement) => void): void {
  if (onCell) {
    root.querySelectorAll<HTMLElement>(".up-cell[data-card]").forEach((el) => el.addEventListener("click", () => onCell(el.dataset.card as CardId, el)));
  }
  root.querySelector(".up-more")?.addEventListener("click", () => openUpgradesSheet(relic, cards, cap));
}

export interface SectionOpts {
  relic?: CardId;
  cards: CardId[];
  cap: number;
  /** Tapping a cell (the round screen says what it does); absent means cells are not buttons. */
  onCell?: (id: CardId, el: HTMLElement) => void;
}

/** The round screen's upgrades section: its own box below the squad box, no title, the count on the box's top edge. */
export function upgradesSection(opts: SectionOpts): HTMLElement {
  const root = document.createElement("div");
  root.className = "up-box";
  root.innerHTML = `<span class="up-legend">${opts.cards.length}/${opts.cap}</span><div class="up-row">${cellsHtml(opts.relic, opts.cards, !!opts.onCell)}</div>`;
  wire(root, opts.relic, opts.cards, opts.cap, opts.onCell);
  return root;
}

/** The pick screen's "what you already have": the same row under a small title, the same legend count. */
export function upgradesHeld(opts: Omit<SectionOpts, "onCell">): HTMLElement {
  const root = document.createElement("div");
  root.className = "up-box held";
  root.innerHTML = `<span class="up-legend">${opts.cards.length}/${opts.cap}</span><div class="up-title">YOUR UPGRADES</div><div class="up-row">${cellsHtml(opts.relic, opts.cards, false)}</div>`;
  wire(root, opts.relic, opts.cards, opts.cap, undefined);
  return root;
}

/** The run-over build row: the same cells, no count, wrapping when there are many. */
export function upgradesBuildHtml(relic: CardId | undefined, cards: CardId[]): string {
  return `${relic ? upgradeCellHtml(relic) + `<span class="up-divider"></span>` : ""}${cards.map((id) => upgradeCellHtml(id)).join("")}`;
}

/**
 * The full list as a bottom sheet (canvas 6.2): the relic, a box that says how many upgrades you hold and what happens when you are
 * full (a new upgrade means dropping one of these), then every upgrade with its text. Closes on ✕ or a tap outside.
 */
export function openUpgradesSheet(relic: CardId | undefined, cards: CardId[], cap: number): void {
  const row = (id: CardId): string =>
    `<div class="up-sheet-row">${emblemHtml(id, 32)}<div class="up-sheet-main"><div class="up-sheet-name">${esc(CARD_DEFS[id].title)}${
      isRelic(id) ? `<span class="up-sheet-tag">RELIC</span>` : ""
    }</div><div class="up-sheet-text">${markWordsHtml(esc(CARD_DEFS[id].detail))}</div></div></div>`;
  const full = cards.length >= cap;
  const rule = full
    ? `<b>UPGRADES · FULL</b><span>${cards.length}/${cap}</span><p>You can hold ${cap} upgrades; the relic does not count. Taking a new upgrade now means dropping one of these.</p>`
    : `<b>UPGRADES</b><span>${cards.length}/${cap}</span><p>You can hold ${cap} upgrades; the relic does not count. When you are full, taking a new upgrade means dropping one of these.</p>`;
  const overlay = document.createElement("div");
  overlay.className = "up-sheet-overlay";
  overlay.innerHTML =
    `<div class="up-sheet"><div class="up-sheet-grab"></div>` +
    `<div class="up-sheet-head"><b>YOUR UPGRADES</b><i class="up-sheet-x" data-close>✕</i></div>` +
    (relic ? row(relic) : "") +
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
