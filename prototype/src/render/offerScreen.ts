import type { Offer, OfferKind } from "../sim/offers.js";
import type { CardId } from "../sim/cards/index.js";
import { CARD_DEFS } from "../sim/cards/index.js";
import type { PlayerRole } from "../sim/roles.js";
import { ROLE_LABEL } from "../sim/roles.js";
import { markWordsHtml } from "./heroPickShared.js";
import { ROLE_CSS_VAR } from "./roundScreen.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). Three
 * cards after a win — the direct replacement for the old coin spend (heal /
 * bank upgrade / skip, the same three every time). Tu's ask: "Should be
 * just 3 upgraded choice per round." No skip: the pool is filtered to what's
 * actually useful right now (sim/offers.ts's drawOffers), so there's always
 * a real pick.
 *
 * 2026-09-30 (marks and payoffs): at the payoff cap, taking a card opens a
 * second step that asks which held card to drop. A mark word in a card's text
 * is coloured where it sits (2026-10-02; the old "reads / makes" chip lines
 * are gone).
 *
 * 2026-09-30 (offer screen redesign — design/canvas/OfferAfter.dc.html): every
 * offer is a full-width row with the SAME frame, so no kind looks like the
 * right answer (the old gold border + glow + "★ connects" made payoff cards
 * win by looks alone). A left rail names the category, a pill names the role,
 * the big line is the change, and a quiet "↳" line links an offer to what the
 * run already holds — on any kind, not just payoffs.
 */

type CategoryKey = "chain" | "stats" | "squad" | "recovery" | "reaction";

// U+FE0E asks for the plain-text glyph: ⛓ and ⚡ otherwise render as colour
// emoji, which ignore the rail colour (the ⚡ came out orange — a gold lure).
const CATEGORY: Record<CategoryKey, { icon: string; word: string }> = {
  chain: { icon: "⛓︎", word: "CHAIN" },
  stats: { icon: "▲", word: "STATS" },
  squad: { icon: "⊕", word: "SQUAD" },
  recovery: { icon: "✚", word: "RECOVERY" },
  reaction: { icon: "⚡︎", word: "REACTION" },
};

const KIND_CATEGORY: Record<OfferKind, CategoryKey> = {
  chainLevel: "chain",
  chainGain: "chain",
  statHp: "stats",
  statDamage: "stats",
  recruit: "squad",
  slot: "squad",
  heal: "recovery",
  revive: "recovery",
  rest: "recovery",
  card: "reaction",
};

interface RowParts {
  category: CategoryKey;
  headline: string;
  /** Omitted when it would repeat the headline (a payoff card's name). */
  title?: string;
  detail: string;
  role?: PlayerRole;
  /** A card offer only — the card, so the row can show its own icon. */
  card?: CardId;
  worksWith?: string;
  replaces?: boolean;
}

function rowHtml(p: RowParts): string {
  const cat = CATEGORY[p.category];
  const pill = p.role
    ? `<span class="offer-role" style="--role-color: var(${ROLE_CSS_VAR[p.role]})">${ROLE_LABEL[p.role]}</span>`
    : `<span class="offer-role offer-role-all">All</span>`;
  const def = p.card ? CARD_DEFS[p.card] : undefined;
  // A card carries its own glyph in the rail (so a card can be told from the
  // next one at a glance, and recalled next run), and a duo says so.
  const railIcon = def ? def.icon : cat.icon;
  const railWord = def ? (def.kind === "duo" ? "DUO" : "CARD") : cat.word;
  // A card's headline is its name, left plain; a chain offer's headline is the
  // ability it adds ("New: ❄ freeze"), so a mark word in it is coloured too.
  const headline = p.card ? p.headline : markWordsHtml(p.headline);
  return (
    `<span class="offer-rail"><span class="offer-rail-icon">${railIcon}</span><span class="offer-rail-word">${railWord}</span></span>` +
    `<span class="offer-body">` +
    `<span class="offer-head"><span class="offer-headline">${headline}</span>${pill}</span>` +
    (p.title ? `<span class="offer-title">${p.title}</span>` : "") +
    `<span class="offer-detail">${markWordsHtml(p.detail)}</span>` +
    (p.worksWith ? `<span class="offer-with">↳ ${p.worksWith}</span>` : "") +
    (p.replaces ? `<span class="offer-replaces">replaces one of your cards</span>` : "") +
    `</span>`
  );
}

export function renderOfferScreen(
  container: HTMLElement,
  offers: Offer[],
  held: CardId[],
  cap: number,
  onChoose: (offer: Offer, dropCardId?: CardId) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  container.appendChild(screen);

  function renderPick(): void {
    screen.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = "Victory — pick one";
    screen.appendChild(h1);

    if (held.length > 0) {
      const heldLine = document.createElement("div");
      heldLine.className = "offer-held";
      heldLine.textContent = `Your cards (${held.length}/${cap}): ${held.map((id) => CARD_DEFS[id].title).join(", ")}`;
      screen.appendChild(heldLine);
    }

    const choices = document.createElement("div");
    choices.className = "offer-rows";
    for (const offer of offers) {
      const btn = document.createElement("button");
      btn.className = `offer-row cat-${KIND_CATEGORY[offer.kind]}`;
      const isCard = offer.kind === "card" && offer.card !== undefined;
      btn.innerHTML = rowHtml({
        category: KIND_CATEGORY[offer.kind],
        headline: offer.headline,
        title: offer.title === offer.headline ? undefined : offer.title,
        detail: offer.detail,
        role: offer.role,
        card: isCard ? offer.card : undefined,
        worksWith: offer.worksWith,
        replaces: isCard && held.length >= cap,
      });
      btn.addEventListener("click", () => {
        if (isCard && held.length >= cap) renderDrop(offer);
        else onChoose(offer);
      });
      choices.appendChild(btn);
    }
    screen.appendChild(choices);
  }

  function renderDrop(offer: Offer): void {
    screen.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = `Drop one to take ${offer.title}`;
    screen.appendChild(h1);

    const choices = document.createElement("div");
    choices.className = "offer-rows";
    for (const id of held) {
      const btn = document.createElement("button");
      btn.className = "offer-row cat-reaction";
      btn.innerHTML = rowHtml({
        category: "reaction",
        headline: `Drop ${CARD_DEFS[id].title}`,
        detail: CARD_DEFS[id].detail,
        card: id,
      });
      btn.addEventListener("click", () => onChoose(offer, id));
      choices.appendChild(btn);
    }
    screen.appendChild(choices);

    const back = document.createElement("button");
    back.className = "offer-back";
    back.textContent = "← Back";
    back.addEventListener("click", renderPick);
    screen.appendChild(back);
  }

  renderPick();
}
