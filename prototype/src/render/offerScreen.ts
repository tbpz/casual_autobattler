import type { Offer } from "../sim/offers.js";
import type { PayoffId } from "../sim/payoffs.js";
import { MARK_CHIP, PAYOFF_DEFS } from "../sim/payoffs.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). Three
 * cards after a win — the direct replacement for the old coin spend (heal /
 * bank upgrade / skip, the same three every time). Tu's ask: "Should be
 * just 3 upgraded choice per round." No skip: the pool is filtered to what's
 * actually useful right now (sim/offers.ts's drawOffers), so there's always
 * a real pick.
 *
 * 2026-09-30 (marks and payoffs): a payoff card shows the marks it reads and
 * a "connects" highlight when the squad can already make one. At the payoff
 * cap, taking one opens a second step that asks which held card to drop.
 */
export function renderOfferScreen(
  container: HTMLElement,
  offers: Offer[],
  held: PayoffId[],
  cap: number,
  onChoose: (offer: Offer, dropPayoffId?: PayoffId) => void,
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
      heldLine.textContent = `Your cards (${held.length}/${cap}): ${held.map((id) => PAYOFF_DEFS[id].title).join(", ")}`;
      screen.appendChild(heldLine);
    }

    const choices = document.createElement("div");
    choices.className = "spend-choices offer-choices";
    for (const offer of offers) {
      const btn = document.createElement("button");
      const isPayoff = offer.kind === "payoff" && offer.payoff !== undefined;
      if (isPayoff) btn.classList.add("payoff-offer");
      if (isPayoff && offer.connects) btn.classList.add("connects");

      let extra = "";
      if (isPayoff) {
        const reads = PAYOFF_DEFS[offer.payoff!].reads
          .map((m) => `<span class="mark-chip mark-${m}">${MARK_CHIP[m].icon} ${MARK_CHIP[m].word}</span>`)
          .join("");
        const atCap = held.length >= cap;
        extra =
          `<span class="offer-reads">reads ${reads}</span>` +
          (offer.connects ? `<span class="offer-connects">★ connects to your squad</span>` : "") +
          (atCap ? `<span class="offer-replaces">replaces one of your cards</span>` : "");
      }
      btn.innerHTML = `<span class="title">${offer.title}</span><span class="detail">${offer.detail}</span>${extra}`;
      btn.addEventListener("click", () => {
        if (isPayoff && held.length >= cap) renderDrop(offer);
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
    choices.className = "spend-choices offer-choices";
    for (const id of held) {
      const btn = document.createElement("button");
      btn.classList.add("payoff-offer");
      btn.innerHTML = `<span class="title">Drop ${PAYOFF_DEFS[id].title}</span><span class="detail">${PAYOFF_DEFS[id].detail}</span>`;
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
