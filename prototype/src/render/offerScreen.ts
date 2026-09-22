import type { Offer } from "../sim/offers.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). Three
 * cards after a win — the direct replacement for the old coin spend (heal /
 * bank upgrade / skip, the same three every time). Tu's ask: "Should be
 * just 3 upgraded choice per round." No skip: the pool is filtered to what's
 * actually useful right now (sim/offers.ts's drawOffers), so there's always
 * a real pick.
 */
export function renderOfferScreen(container: HTMLElement, offers: Offer[], onChoose: (offer: Offer) => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";

  const h1 = document.createElement("h1");
  h1.textContent = "Victory — pick one";
  screen.appendChild(h1);

  const choices = document.createElement("div");
  choices.className = "spend-choices offer-choices";
  for (const offer of offers) {
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="title">${offer.title}</span><span class="detail">${offer.detail}</span>`;
    btn.addEventListener("click", () => onChoose(offer));
    choices.appendChild(btn);
  }
  screen.appendChild(choices);

  container.appendChild(screen);
}
