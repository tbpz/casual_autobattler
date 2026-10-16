import type { FightEvent, FightResult } from "../sim/events.js";
import { CARD_DEFS, type CardId } from "../sim/cards/index.js";

/** id -> display name, built from whichever snapshot/result data is on hand
 * (2026-08-20, attribution-test instrumentation — see fullAnswerKey below).
 * result.finalPlayerHeroes only covers the player side; the last snapshot's
 * playerHeroes+enemyHeroes covers both, which fullAnswerKey needs since a
 * heroDown event can name either side. */
function nameLookup(result: FightResult): Map<string, string> {
  const names = new Map<string, string>();
  const last = result.snapshots[result.snapshots.length - 1];
  if (last) {
    for (const h of [...last.playerHeroes, ...last.enemyHeroes]) names.set(h.id, h.name);
  }
  for (const h of result.finalPlayerHeroes) names.set(h.id, h.name);
  return names;
}

/** Every chain this fight fired (not just the longest — chainRecapLine only
 * ever reports one), plus every death, in order — the answer key the
 * attribution self-test (archive/ATTRIBUTION_TEST.md) scores a written
 * cause against. Pairs each chainStart with the next chainEnd sharing its
 * heroId and backfire flag (chain state is per-hero and never overlaps
 * itself — see fight.ts — so this pairing can't cross-match two different
 * chains). Test-mode only; not shown during ordinary play. */
function fullAnswerKey(result: FightResult): string[] {
  const names = nameLookup(result);
  const heroName = (id: string) => names.get(id) ?? id;
  const lines: string[] = [];

  const starts = result.events.filter((e): e is Extract<FightEvent, { type: "chainStart" }> => e.type === "chainStart");
  const ends = result.events.filter((e): e is Extract<FightEvent, { type: "chainEnd" }> => e.type === "chainEnd");
  const usedEnds = new Set<number>();
  for (const start of starts) {
    const endIdx = ends.findIndex(
      (e, i) => !usedEnds.has(i) && e.heroId === start.heroId && e.backfire === start.backfire && e.t >= start.t,
    );
    const verbPrefix = start.backfire ? "backfired" : "chained";
    if (endIdx < 0) {
      lines.push(`${Math.round(start.t)}s — ${heroName(start.heroId)} ${verbPrefix} (${start.effects.join("+")}) — unresolved`);
      continue;
    }
    usedEnds.add(endIdx);
    const end = ends[endIdx]!;
    const killNote = end.killedIds.length > 0 ? `, killed ${end.killedIds.map(heroName).join(", ")}` : "";
    lines.push(
      `${Math.round(start.t)}s — ${heroName(start.heroId)} ${verbPrefix} ×${end.chainLength} (${end.effects.join("+")}) for ${Math.round(end.totalDamage)}${killNote} [${end.reason}]`,
    );
  }

  const deaths = result.events.filter((e): e is Extract<FightEvent, { type: "heroDown" }> => e.type === "heroDown");
  for (const d of deaths) {
    lines.push(`${Math.round(d.t)}s — ${heroName(d.heroId)} (${d.side}) fell`);
  }

  const cards = cardsRecapLine(result);
  if (cards) lines.push(cards);

  return lines.length > 0 ? lines : ["No chain fired, nobody fell."];
}

/** One line naming which cards fired this fight and how often, and — where a
 * card was set off by another — which one (2026-10-01): "Brittle ×3 (after
 * Shatterguard ×2) · Execute ×1". Undefined when no card fired. This is the
 * written half of the cascade the fight view shows on the bodies. */
function cardsRecapLine(result: FightResult): string | undefined {
  const counts = new Map<CardId, number>();
  const causes = new Map<CardId, Map<CardId, number>>();
  for (const e of result.events) {
    if (e.type !== "cardTriggered") continue;
    counts.set(e.card, (counts.get(e.card) ?? 0) + 1);
    if (e.causeCard) {
      const byCause = causes.get(e.card) ?? new Map<CardId, number>();
      byCause.set(e.causeCard, (byCause.get(e.causeCard) ?? 0) + 1);
      causes.set(e.card, byCause);
    }
  }
  if (counts.size === 0) return undefined;
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([card, n]) => {
      const byCause = causes.get(card);
      const after = byCause
        ? ` (after ${[...byCause.entries()].sort((a, b) => b[1] - a[1]).map(([c, m]) => `${CARD_DEFS[c].title} ×${m}`).join(", ")})`
        : "";
      return `${CARD_DEFS[card].title} ×${n}${after}`;
    });
  return `Upgrades: ${parts.join(" · ")}`;
}

export function appendAnswerKey(revealContainer: HTMLElement, result: FightResult): void {
  const answerKey = document.createElement("div");
  answerKey.className = "answer-key";
  const title = document.createElement("p");
  title.className = "answer-key-title";
  title.textContent = "Full chain / death log:";
  answerKey.appendChild(title);
  for (const line of fullAnswerKey(result)) {
    const p = document.createElement("p");
    p.textContent = line;
    answerKey.appendChild(p);
  }
  revealContainer.appendChild(answerKey);
}

export function renderRunCompleteScreen(
  container: HTMLElement,
  roundsPlayed: number,
  onRetry: () => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  screen.innerHTML = `<h1>Run complete</h1><p>All ${roundsPlayed} rounds won.</p>`;
  const retry = document.createElement("button");
  retry.textContent = "New run";
  retry.addEventListener("click", onRetry);
  screen.appendChild(retry);
  container.appendChild(screen);
}
