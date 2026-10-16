import { chainEffectChip, chainEffectLines, type MarkId } from "../sim/config.js";
import { MARK_WORDS } from "../sim/cards/index.js";
import { chainAnswersSlam, chainVsEncounterLine } from "../sim/projection.js";

export { chainAnswersSlam, chainEffectChip, chainEffectLines, chainVsEncounterLine };

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
