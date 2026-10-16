import type { RunConfig } from "../sim/config.js";
import { CARD_DEFS } from "../sim/cards/index.js";
import type { RunSession } from "./runSession.js";
import { bestMoment, momentHtml, type BestMoment } from "./fightSummary.js";
import { DEAD_BODY, villainFace } from "./faces.js";
import { esc, roundStripHtml } from "./roundParts.js";
import { appendAnswerKey } from "./runScreens.js";

/**
 * The run-over screen (canvas 7.1, DECISIONS.md 2026-10-16), reached from the defeat overlay's Continue. Leads with how close it
 * was (the enemy still standing with the most HP: its face, its bar, "Still standing with N HP left"), then the run's best moment,
 * the relic and cards held, and the fallen squad. One action: Try again. It replaces the old text screen with its per-unit recap
 * and spare-seconds line. The other ending (too many units fell to fill the slots, which follows a win) is the same screen with
 * its own headline and no SO CLOSE block.
 */
export function renderRunOverScreen(container: HTMLElement, cfg: RunConfig, session: RunSession, onRetry: () => void, testMode = false): void {
  container.innerHTML = "";
  const exhausted = session.overReason === "rosterExhausted";
  const roundNumber = session.currentRoundIndex + 1;

  // ---------- the enemy still standing, if the run ended in a loss ----------
  const last = session.lastFightResult;
  const final = last?.snapshots[last.snapshots.length - 1];
  const standing = !exhausted && final ? final.enemyHeroes.filter((h) => h.alive).sort((a, b) => b.hp - a.hp)[0] : undefined;
  const headline = exhausted
    ? "No one left to send: too many units fell."
    : `Your squad fell to ${esc(session.currentEncounterName)} in round ${roundNumber}.`;
  const soClose = standing
    ? `<div class="ro-close"><div class="ro-sec" style="color:#ff8c8c">SO CLOSE</div><div class="ro-closerow"><div class="ro-boss" style="${standing.role === "bruiser" ? "background:#b23b3b;box-shadow:0 0 10px 2px rgba(178,59,59,.5)" : "background:#ff5d5d"}">${villainFace(56, standing.role === "bruiser" ? 1.35 : 1)}</div><div class="ro-closemain"><div class="ro-closehead"><span class="ro-closename">${esc(standing.name)}</span><span class="ro-closehp">${Math.round(standing.hp)}/${Math.round(standing.maxHp)}</span></div><div class="ro-closebar"><div style="width:${standing.maxHp > 0 ? ((standing.hp / standing.maxHp) * 100).toFixed(1) : 0}%"></div></div><div class="ro-closeline">Still standing with <b>${Math.round(standing.hp)} HP</b> left.</div></div></div></div>`
    : "";

  // ---------- the best moment across the whole run ----------
  let best: { moment: BestMoment; round: number } | null = null;
  session.fightResults.forEach((r, i) => {
    const m = bestMoment(r);
    if (m && (!best || m.hits > best.moment.hits || (m.hits === best.moment.hits && m.amount > best.moment.amount))) best = { moment: m, round: i + 1 };
  });
  const bestBlock = best
    ? `<div class="ro-block"><div class="ro-sec">BEST MOMENT OF THE RUN</div><div class="ro-moment">${momentHtml((best as { moment: BestMoment }).moment, `round ${(best as { round: number }).round}`)}</div></div>`
    : "";

  // ---------- the build and the squad ----------
  const progress = session.progress;
  const relic = progress.relic ? `<span class="ro-chip relic">${esc(CARD_DEFS[progress.relic].title)}</span>` : "";
  const cards = progress.cards.map((id) => `<span class="ro-chip">${esc(CARD_DEFS[id].title)}</span>`).join("");
  const build = relic || cards ? `<div class="ro-block"><div class="ro-sec">YOUR BUILD</div><div class="ro-chips">${relic}${cards}</div></div>` : "";

  const byId = new Map(session.currentRoster.heroes.map((h) => [h.id, h]));
  const squadIds = session.lastFielded.length > 0 ? session.lastFielded : session.currentRoster.heroes.map((h) => h.id);
  const squad = squadIds
    .map((id) => byId.get(id))
    .filter((h): h is NonNullable<typeof h> => !!h)
    .map((h) => `<div class="ro-unit"><div class="ro-dot" style="background:${DEAD_BODY}"><div class="ro-x">✕</div></div><div class="ro-unitname">${esc(h.name)}</div></div>`)
    .join("");

  const screen = document.createElement("div");
  screen.className = "fo-card ro-card";
  screen.innerHTML = `
    <div class="ro-top"><div class="ro-title">RUN OVER</div><div class="ro-sub">${headline}</div></div>
    <div class="ro-strip">${roundStripHtml(cfg, roundNumber)}</div>
    ${soClose}
    ${bestBlock}
    ${build}
    <div class="ro-block"><div class="ro-sec">YOUR SQUAD</div><div class="ro-squad">${squad}</div></div>
    <button type="button" class="ro-again">Try again</button>`;
  screen.querySelector(".ro-again")!.addEventListener("click", onRetry);
  container.appendChild(screen);
  if (testMode && last) appendAnswerKey(screen, last);
}
