// The game terms a first-time player can tap for an explainer card (canvas 3.1–3.11, DECISIONS.md 2026-10-11).
// A tappable term is bold, coloured and dotted-underlined (`.term.tap`); inside a card it stays coloured but is not tappable.
// DOM-free: every export is data or a string.

export type TermId =
  | "slam"
  | "guard"
  | "mend"
  | "expose"
  | "exposed"
  | "frozen"
  | "burn"
  | "shield"
  | "chain"
  | "backfire"
  | "fatigue";

export const TERM_IDS: TermId[] = ["slam", "guard", "mend", "expose", "exposed", "frozen", "burn", "shield", "chain", "backfire", "fatigue"];

/** The colour class a term's word wears; `""` is the shared term green. Backfire and Fatigue use the warning orange. */
const TERM_CLASS: Record<TermId, string> = {
  slam: "",
  guard: "",
  mend: "",
  expose: "",
  exposed: "exposed",
  frozen: "frozen",
  burn: "burn",
  shield: "shield",
  chain: "",
  backfire: "danger",
  fatigue: "danger",
};

/** One term word as markup. `tap` makes it a button-like target carrying `data-term`. */
export function termSpan(id: TermId, text: string, tap = true): string {
  const cls = ["term", TERM_CLASS[id], tap ? "tap" : ""].filter(Boolean).join(" ");
  return `<span class="${cls}"${tap ? ` data-term="${id}"` : ""}>${text}</span>`;
}

/** Words in a plain sentence that are terms, and which term each opens. Order matters: longer forms first. */
const TERM_WORDS: Array<[RegExp, TermId]> = [
  [/\bslams?\b/gi, "slam"],
  [/\bexposed\b/gi, "exposed"],
  [/\bexposes\b/gi, "exposed"],
  [/\bshields?\b/gi, "shield"],
];

/** Wraps the term words of a plain sentence (an encounter blurb) so they can be tapped. Text holds no markup. */
export function termifyText(text: string, tap = true): string {
  const marks: string[] = [];
  let out = text;
  for (const [re, id] of TERM_WORDS) {
    out = out.replace(re, (m) => {
      marks.push(termSpan(id, m, tap));
      return `\u0000${marks.length - 1}\u0000`;
    });
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => marks[Number(i)]!);
}

/** Pulls the term out of a tapped element, if it is one. */
export function termFromTarget(target: EventTarget | null): TermId | null {
  const el = (target as HTMLElement | null)?.closest?.("[data-term]") as HTMLElement | null;
  const id = el?.dataset.term as TermId | undefined;
  return id && TERM_IDS.includes(id) ? id : null;
}
