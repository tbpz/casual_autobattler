import { chainEffectChip, chainEffectLines, type FatigueTier, type MarkId } from "../sim/config.js";
import { MARK_WORDS } from "../sim/cards/index.js";
import { chainAnswersSlam, chainVsEncounterLine } from "../sim/projection.js";

export { chainAnswersSlam, chainEffectChip, chainEffectLines, chainVsEncounterLine };

/** How many of a unit's fatigue pips are lit at each tier (DECISIONS.md
 * 2026-09-30, "Fatigue shows as tier pips beside each unit"). Fresh still
 * lights one, so the stack never reads as empty. */
export const FATIGUE_TIER_PIPS: Record<FatigueTier, number> = { fresh: 1, worn: 2, frayed: 3, breaking: 4 };

/** Total pips in the stack — one per tier. */
export const FATIGUE_PIP_COUNT = 4;

const MARK_ORDER = Object.keys(MARK_WORDS) as MarkId[];
// One pass over every mark's word forms, so a span already inserted is never
// scanned again (its own class name holds a mark word).
const MARK_WORD_RE = new RegExp(`\\b(?:${MARK_ORDER.map((m) => `(${MARK_WORDS[m]})`).join("|")})\\b`, "gi");

/** Card text with each mark word coloured where it sits (2026-10-02, replaces
 * the "reads / makes" chip lines — design/canvas/OfferAfter.dc.html). Card text
 * holds no markup, so it runs on the raw string. */
export function markWordsHtml(text: string): string {
  return text.replace(MARK_WORD_RE, (match, ...groups: unknown[]) => {
    const mark = MARK_ORDER[groups.findIndex((g) => typeof g === "string")]!;
    return `<span class="mark-word mark-${mark}">${match}</span>`;
  });
}

/** A unit's fatigue as a stack of pips, lit from the bottom up to its tier
 * (design/canvas/FatiguePips.dc.html). Drawn beside a round-screen token and
 * a fight-screen body; style.css colours the lit pips off the tier class. A
 * string, not an element, because roundScreen.ts builds tokens with innerHTML
 * and this file stays free of DOM so checks/fatigue.ts can import it. */
export function fatiguePipsHtml(tier: FatigueTier): string {
  const lit = FATIGUE_TIER_PIPS[tier];
  let pips = "";
  // DOM order runs top to bottom, so the highest pip comes first and is the
  // last one to light.
  for (let i = FATIGUE_PIP_COUNT; i >= 1; i--) pips += `<span class="fatigue-pip${i <= lit ? " lit" : ""}"></span>`;
  return `<div class="fatigue-pips tier-${tier}" title="fatigue: ${tier}">${pips}</div>`;
}
