// Merge-hero wording as markup, shared by the merge pick, the fighter popup and the hero cards (2026-10-20). The words themselves are
// sim/heroes.ts's HERO_TEXT; here `{shield}` and `{slam}` become the usual term marks and a recipe becomes coloured role words.

import type { HeroKind } from "../sim/types.js";
import { HERO_POOL } from "../sim/heroes.js";
import { ROLE_LABEL } from "../sim/roles.js";
import { termSpan } from "./terms.js";
import { esc } from "./roundParts.js";
import { GOLD } from "./heroLook.js";

const PIECE_HEX = { tank: "#ffb454", damage: "#b98cff", support: "#6ee7a0" } as const;

/** Escapes a HERO_TEXT sentence and turns its `{shield}` and `{slam}` tokens into term marks. `tap` makes them tappable (popups) or plain (cards). */
export function heroTermsHtml(text: string, tap: boolean): string {
  return esc(text)
    .replace(/\{shield\}/g, termSpan("shield", "shield", tap))
    .replace(/\{slam\}/g, termSpan("slam", "slam", tap));
}

/** "Tank + Tank + Damage" with each role word in its own colour. */
export function recipeHtml(kind: HeroKind): string {
  return HERO_POOL[kind].recipe
    .map((r) => `<span style="color:${PIECE_HEX[r]};font-weight:800">${ROLE_LABEL[r]}</span>`)
    .join(' <span style="color:#8a8fa3">+</span> ');
}

/** "Bram, Rex and Ivy". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export { GOLD };
