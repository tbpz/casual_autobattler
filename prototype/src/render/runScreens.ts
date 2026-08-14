import type { RunConfig } from "../sim/config.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import type { SpendChoice } from "../sim/run.js";
import type { Projection } from "../sim/projection.js";
import type { RunSession } from "./runSession.js";

/** The per-hero job lines (soaked/dealt/restored) plus a projected-vs-actual
 * spare-time line — the surprise-carrier "bigger than I expected" needs a
 * concrete baseline to be bigger than (2026-08-06, see DECISIONS.md's
 * "squad pick is the risk dial" entry).
 *
 * 2026-08-14: the chain used to be reported as a "(chained ×N)" parenthetical
 * appended to EVERY damage-dealing hero's line whenever the fight ignited —
 * not just the hero who actually chained, since the condition only checked
 * result.ignited/result.chainLength, both fight-wide, not per-hero. A squad
 * with two damage dealers would see both credited with the same chain. See
 * chainRecapLine below for the dedicated, correctly-attributed replacement. */
function fightRecap(result: FightResult): string[] {
  const lines: string[] = [];
  for (const hero of result.finalPlayerHeroes) {
    if (hero.role === "tank" && hero.soaked > 0) {
      const brokeNote = !hero.holding && hero.alive ? " — line broke" : "";
      lines.push(`${hero.name} soaked ${Math.round(hero.soaked)} across ${hero.hitsTaken} hits${brokeNote}.`);
    } else if (hero.role === "support" && hero.restored > 0) {
      lines.push(`${hero.name} restored ${Math.round(hero.restored)}.`);
    } else if (hero.dealt > 0) {
      lines.push(`${hero.name} dealt ${Math.round(hero.dealt)}.`);
    }
  }
  return lines;
}

/** The chain's own attributed line — picks the chainEnd matching
 * result.chainLength (the fight's longest chain, ties broken by first
 * occurrence) and the chainStart that fired it, so the line reads like a
 * moment ("Rook ignited at 14s and chained ×5 for 187 — took down 1 enemy")
 * rather than a bare stat. `backfire` rides along so the caller can recolor
 * the whole line red instead of the chain's gold (see .recap-chain.backfire
 * in style.css) — a backfire is still a moment worth naming, just not a win. */
function chainRecapLine(result: FightResult): { text: string; backfire: boolean } | null {
  if (!result.ignited || result.chainLength === 0) return null;
  const chainEnd = result.events.find(
    (e): e is Extract<FightEvent, { type: "chainEnd" }> => e.type === "chainEnd" && e.chainLength === result.chainLength,
  );
  if (!chainEnd) return null;
  let startT: number | undefined;
  for (const e of result.events) {
    if (e.type === "chainStart" && e.heroId === chainEnd.heroId && e.backfire === chainEnd.backfire && e.t <= chainEnd.t) {
      startT = e.t;
    }
  }
  const name = result.finalPlayerHeroes.find((h) => h.id === chainEnd.heroId)?.name ?? chainEnd.heroId;
  const atNote = startT !== undefined ? ` at ${Math.round(startT)}s` : "";
  const verb = chainEnd.backfire ? "backfired" : "ignited";
  const killNote =
    chainEnd.killedIds.length > 0
      ? ` — took down ${chainEnd.killedIds.length === 1 ? "one enemy" : `${chainEnd.killedIds.length} enemies`}`
      : "";
  const text = `${name} ${verb}${atNote} and chained ×${chainEnd.chainLength} for ${Math.round(chainEnd.totalDamage)}${killNote}.`;
  return { text, backfire: chainEnd.backfire };
}

/** When a fight never saw a chain fire, names whoever's bar got closest
 * instead of total silence — the closest thing to an explanation a
 * chain-free fight can offer. 2026-08-14 chain rebuild: also doubles as a
 * heads-up for what's carrying forward, since charge persists into the next
 * fight rather than resetting (see sim/types.ts's HeroState.charge). */
function noChainRecapLine(result: FightResult): string | null {
  if (result.ignited) return null; // covered by chainRecapLine and the tag below
  let closest: FightResult["finalPlayerHeroes"][number] | undefined;
  for (const h of result.finalPlayerHeroes) {
    if (!closest || h.charge > closest.charge) closest = h;
  }
  if (!closest || closest.charge <= 0) return null;
  return `${closest.name} is closest to a chain — carries into the next fight.`;
}

/** projected-vs-actual line: same units as the pre-fight screen's verdict,
 * so the comparison is legible without re-deriving anything. */
function spareLine(result: FightResult, projection: Projection | null): string {
  if (!projection) return result.outcome === "win" ? "Won this fight." : "Lost this fight.";
  const actualOutcome = result.outcome === "win" ? "Won" : "Lost";
  const actualSpareSec = projection.killSec - result.durationSec;
  const spareWord = actualSpareSec >= 0 ? "to spare" : "short";
  return `${actualOutcome} with ${Math.abs(Math.round(actualSpareSec))}s ${spareWord}.   (projected ${Math.abs(Math.round(projection.spareSec))}s ${projection.spareSec >= 0 ? "to spare" : "short"})`;
}

/** After a won fight: what the chain did (or didn't), coin awarded, the
 * run's one decision point (heal / upgrade / skip), with skip as a working
 * accept-default. */
export function renderSpendScreen(
  container: HTMLElement,
  cfg: RunConfig,
  session: RunSession,
  fightIndex: number,
  coinAwarded: number,
  result: FightResult,
  projection: Projection | null,
  onChoose: (choice: SpendChoice) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";

  const h1 = document.createElement("h1");
  h1.textContent = `Fight ${fightIndex + 1} — Victory`;
  screen.appendChild(h1);

  const recap = document.createElement("div");
  recap.className = "recap";
  for (const line of fightRecap(result)) {
    const p = document.createElement("p");
    p.textContent = line;
    recap.appendChild(p);
  }
  const spare = document.createElement("p");
  spare.className = "recap-spare";
  spare.textContent = spareLine(result, projection);
  recap.appendChild(spare);
  screen.appendChild(recap);

  if (result.ignited) {
    const chainLine = chainRecapLine(result);
    const tag = document.createElement("p");
    tag.className = chainLine?.backfire ? "recap-chain backfire" : "recap-chain";
    tag.textContent = `${chainLine?.text ?? "A chain fired this fight."} — bonus coin.`;
    screen.appendChild(tag);
  } else {
    const missLine = noChainRecapLine(result);
    if (missLine) {
      const tag = document.createElement("p");
      tag.className = "recap-miss";
      tag.textContent = missLine;
      screen.appendChild(tag);
    }
  }

  const coinRow = document.createElement("p");
  coinRow.innerHTML = `+<span class="coin">${coinAwarded} coin</span> — balance: <span class="coin">${session.coinBalance}</span>`;
  screen.appendChild(coinRow);

  // 2026-08-09 (roster/bench pass): both figures are roster-wide (bench
  // included) — see RunSession's livingHeroes/playerHp getters — since
  // that's the run-wide "how are we doing" reading, not just this fight's
  // fielded-3 recap (already shown above).
  const hp = session.playerHp;
  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  statRow.innerHTML = `<span>Roster</span><span>${session.livingHeroes} living, ${Math.round(hp.hp)}/${Math.round(hp.maxHp)} HP</span>`;
  screen.appendChild(statRow);

  const choices = document.createElement("div");
  choices.className = "spend-choices";

  const healBtn = makeChoiceButton(
    "Heal now",
    // 2026-08-09 fix: this claimed "+${healHpAmount} HP" like a single grant;
    // healFlat (sim/run.ts) actually applies it to every living hero.
    `${cfg.healCoinCost} coin -> +${cfg.healHpAmount} HP to each living hero`,
    session.canAfford("heal"),
    () => onChoose("heal"),
  );
  const upgradeBtn = makeChoiceButton(
    "Bank upgrade",
    // 2026-08-09 fix: this said "dmg/sec"; applySpend (sim/run.ts) adds a
    // flat dpsBonus per ATTACK (fight.ts's performHeroAction), not per
    // second — actual DPS gain varies by attacker cadence.
    `${cfg.upgradeCoinCost} coin -> +${cfg.upgradeDpsBonus} dmg per attack, rest of run`,
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

/** 2026-08-09 (roster/bench pass): a run can now end two structurally
 * different ways (see sim/run.ts's RunResult.overReason) — a fight LOST
 * outright, or the living roster falling below cfg.playerN so the next
 * fight can't even be fielded. They read very differently to a player
 * ("we got wiped" vs. "we ran out of people to send"), so the copy splits
 * on it rather than lumping both under one generic message. */
export function renderRunOverScreen(
  container: HTMLElement,
  fightsWon: number,
  overReason: "loss" | "rosterExhausted" | null,
  onRetry: () => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  const wonNote = `after ${fightsWon} win${fightsWon === 1 ? "" : "s"}`;
  const body =
    overReason === "rosterExhausted"
      ? `Your roster couldn't field a full squad ${wonNote} — too many fallen. All coin is lost.`
      : `Your fielded squad was wiped ${wonNote}. All coin is lost.`;
  screen.innerHTML = `<h1>Run over</h1><p>${body}</p>`;
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
