import type { HeroKind } from "../sim/types.js";
import type { RosterState } from "../sim/roster.js";
import { HERO_POOL, HERO_TEXT, ingredientNames, isFrontRow, makeHeroState, type MergeOption } from "../sim/heroes.js";
import { esc } from "./roundParts.js";
import { squadFace } from "./faces.js";
import { GOLD, crownOnBody, fangsHtml, unitBodyBg, unitMainHex } from "./heroLook.js";
import { heroTermsHtml, joinNames, recipeHtml } from "./heroText.js";

/**
 * The merge pick (2026-10-20; DECISIONS.md 2026-10-19): the reward for beating a mini-boss. One row per hero the roster can make right now,
 * with the three units the game would use, and "Not now" for the usual offers instead. It reuses the offer rows' frame (.offer-row, the same
 * classes as render/offerScreen.ts), with a gold rail: the hero's own body, wearing its recipe and a crown, over the word HERO.
 * No row is pre-selected, and one tap commits, same as the offer screen.
 */
export function renderMergeScreen(
  container: HTMLElement,
  roster: RosterState,
  options: MergeOption[],
  onChoose: (kind: HeroKind | null) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  container.appendChild(screen);

  const h1 = document.createElement("h1");
  h1.textContent = "Mini-boss down — make a hero";
  screen.appendChild(h1);

  const intro = document.createElement("p");
  intro.className = "merge-intro";
  intro.textContent = "Three of your units merge into one hero and leave the squad. The hero takes one slot.";
  screen.appendChild(intro);

  const rows = document.createElement("div");
  rows.className = "offer-rows";
  for (const option of options) {
    const def = HERO_POOL[option.kind];
    const text = HERO_TEXT[option.kind];
    const hero = makeHeroState(option.kind, { maxHp: 0, damage: 0 });
    const front = isFrontRow(hero);
    const body =
      `<span class="merge-body" style="background:${unitBodyBg(hero)}">` +
      squadFace(unitMainHex(hero), "fresh", 40) +
      fangsHtml(hero) +
      crownOnBody(40) +
      `</span>`;
    const btn = document.createElement("button");
    btn.className = "offer-row cat-squad merge-row";
    btn.style.setProperty("--cat", GOLD);
    btn.dataset.hero = option.kind;
    btn.innerHTML =
      `<span class="offer-rail">${body}<span class="offer-rail-word">HERO</span></span>` +
      `<span class="offer-body">` +
      `<span class="offer-head"><span class="offer-headline">${esc(def.name)}</span><span class="offer-role merge-row-tag">${front ? "FRONT" : "BACK"}</span></span>` +
      `<span class="offer-title">${recipeHtml(option.kind)}</span>` +
      `<span class="offer-detail"><b class="merge-label" style="color:${GOLD}">GIFT · ${esc(text.giftName)}</b> ${heroTermsHtml(text.giftHead, false)}</span>` +
      `<span class="offer-detail"><b class="merge-label">SKILL · ${esc(text.skillName)}</b> ${heroTermsHtml(text.skillHead, false)}</span>` +
      `<span class="offer-with">↳ uses ${esc(joinNames(ingredientNames(roster, option)))}</span>` +
      `</span>`;
    btn.addEventListener("click", () => onChoose(option.kind));
    rows.appendChild(btn);
  }
  screen.appendChild(rows);

  const notNow = document.createElement("button");
  notNow.className = "offer-back";
  notNow.textContent = "Not now — take the usual offers";
  notNow.addEventListener("click", () => onChoose(null));
  screen.appendChild(notNow);
}
