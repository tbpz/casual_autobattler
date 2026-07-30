import type { RunConfig } from "../sim/config.js";
import type { SpendChoice } from "../sim/run.js";
import type { RunSession } from "./runSession.js";

/** After a won fight: coin awarded, the run's one decision point (heal /
 * upgrade / skip), with skip as a working accept-default. */
export function renderSpendScreen(
  container: HTMLElement,
  cfg: RunConfig,
  session: RunSession,
  fightIndex: number,
  coinAwarded: number,
  ignited: boolean,
  onChoose: (choice: SpendChoice) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";

  const h1 = document.createElement("h1");
  h1.textContent = `Fight ${fightIndex + 1} — Victory`;
  screen.appendChild(h1);

  if (ignited) {
    const tag = document.createElement("p");
    tag.textContent = "The chain ignited this fight — bonus coin.";
    screen.appendChild(tag);
  }

  const coinRow = document.createElement("p");
  coinRow.innerHTML = `+<span class="coin">${coinAwarded} coin</span> — balance: <span class="coin">${session.coinBalance}</span>`;
  screen.appendChild(coinRow);

  const hp = session.playerHp;
  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  statRow.innerHTML = `<span>Squad</span><span>${session.livingHeroes} living, ${Math.round(hp.hp)}/${Math.round(hp.maxHp)} HP</span>`;
  screen.appendChild(statRow);

  const choices = document.createElement("div");
  choices.className = "spend-choices";

  const healBtn = makeChoiceButton(
    "Heal now",
    `${cfg.healCoinCost} coin -> +${cfg.healHpAmount} HP`,
    session.canAfford("heal"),
    () => onChoose("heal"),
  );
  const upgradeBtn = makeChoiceButton(
    "Bank upgrade",
    `${cfg.upgradeCoinCost} coin -> +${cfg.upgradeDpsBonus} dmg/sec, rest of run`,
    session.canAfford("upgrade"),
    () => onChoose("upgrade"),
  );
  const skipBtn = makeChoiceButton("Skip", "Keep the coin, no spend", true, () => onChoose("skip"));

  choices.appendChild(healBtn);
  choices.appendChild(upgradeBtn);
  choices.appendChild(skipBtn);
  screen.appendChild(choices);

  container.appendChild(screen);
}

export function renderRunOverScreen(container: HTMLElement, fightsWon: number, onRetry: () => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  screen.innerHTML = `<h1>Run over</h1><p>Your squad ran out of living heroes after ${fightsWon} win${fightsWon === 1 ? "" : "s"}. All coin is lost.</p>`;
  const retry = document.createElement("button");
  retry.textContent = "New run";
  retry.addEventListener("click", onRetry);
  screen.appendChild(retry);
  container.appendChild(screen);
}

export function renderRunCompleteScreen(container: HTMLElement, finalCoin: number, onRetry: () => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  screen.innerHTML = `<h1>Run complete</h1><p>All 5 fights won. Final coin: <span class="coin">${finalCoin}</span>.</p>`;
  const retry = document.createElement("button");
  retry.textContent = "New run";
  retry.addEventListener("click", onRetry);
  screen.appendChild(retry);
  container.appendChild(screen);
}

function makeChoiceButton(title: string, detail: string, enabled: boolean, onClick: () => void): HTMLElement {
  const btn = document.createElement("button");
  btn.innerHTML = `<span class="title">${title}</span><span class="detail">${detail}</span>`;
  btn.disabled = !enabled;
  btn.addEventListener("click", onClick);
  return btn;
}
