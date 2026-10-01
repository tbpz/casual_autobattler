import type { FightEvent, FightResult } from "../sim/events.js";
import type { Projection } from "../sim/projection.js";
import { CARD_DEFS, type CardId } from "../sim/cards/index.js";

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
 * chain-free fight can offer. Charge resets every fight, so this says nothing
 * about the next one. */
function noChainRecapLine(result: FightResult): string | null {
  if (result.ignited) return null; // covered by chainRecapLine and the tag below
  let closest: FightResult["finalPlayerHeroes"][number] | undefined;
  for (const h of result.finalPlayerHeroes) {
    if (!closest || h.charge > closest.charge) closest = h;
  }
  if (!closest || closest.charge <= 0) return null;
  return `${closest.name} came closest to a chain.`;
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
  return `Cards: ${parts.join(" · ")}`;
}

/** Wraps the game's own explanation (recap lines, chain/miss tag, and in
 * test mode the full answer key) behind a "Show what happened" button when
 * testMode is set — the attribution self-test's moment ③ requires writing a
 * cause BEFORE seeing the game's, and painting the recap immediately (the
 * ordinary-play behavior) would contaminate that. Returns the container to
 * append recap content into; ordinary play (testMode false) returns it
 * already visible and unwrapped, so this is a no-op outside test mode. */
function makeRevealContainer(screen: HTMLElement, testMode: boolean): HTMLElement {
  const revealContainer = document.createElement("div");
  revealContainer.className = "reveal-container";
  if (!testMode) {
    screen.appendChild(revealContainer);
    return revealContainer;
  }
  revealContainer.classList.add("hidden");
  const revealBtn = document.createElement("button");
  revealBtn.className = "reveal-btn";
  revealBtn.textContent = "Show what happened";
  revealBtn.addEventListener("click", () => {
    revealContainer.classList.remove("hidden");
    revealBtn.remove();
  });
  screen.appendChild(revealBtn);
  screen.appendChild(revealContainer);
  return revealContainer;
}

function appendAnswerKey(revealContainer: HTMLElement, result: FightResult): void {
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

/** After a won round: what the chain did (or didn't) — the offer screen
 * (render/offerScreen.ts) is what follows this, not this file's job. Called
 * by app.ts right before showing the offer screen so the player sees the
 * recap of what just happened before being asked to pick a reward. */
export function renderRoundRecap(
  container: HTMLElement,
  roundIndex: number,
  result: FightResult,
  projection: Projection | null,
  onContinue: () => void,
  testMode = false,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";

  const h1 = document.createElement("h1");
  h1.textContent = `Round ${roundIndex + 1} — Victory`;
  screen.appendChild(h1);

  // 2026-08-20 (attribution-test instrumentation — see makeRevealContainer's
  // docstring): in test mode, everything the game claims about WHY this
  // round went the way it did sits behind a reveal button, so the player
  // writes their own cause first before reading this and rationalizing
  // backwards.
  const revealContainer = makeRevealContainer(screen, testMode);

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
  revealContainer.appendChild(recap);

  if (result.ignited) {
    const chainLine = chainRecapLine(result);
    const tag = document.createElement("p");
    tag.className = chainLine?.backfire ? "recap-chain backfire" : "recap-chain";
    tag.textContent = chainLine?.text ?? "A chain fired this round.";
    revealContainer.appendChild(tag);
  } else {
    const missLine = noChainRecapLine(result);
    if (missLine) {
      const tag = document.createElement("p");
      tag.className = "recap-miss";
      tag.textContent = missLine;
      revealContainer.appendChild(tag);
    }
  }

  const cardsLine = cardsRecapLine(result);
  if (cardsLine) {
    const tag = document.createElement("p");
    tag.className = "recap-cards";
    tag.textContent = cardsLine;
    revealContainer.appendChild(tag);
  }

  if (testMode) appendAnswerKey(revealContainer, result);

  const continueBtn = document.createElement("button");
  continueBtn.className = "play-btn";
  continueBtn.textContent = "Continue";
  continueBtn.addEventListener("click", onContinue);
  screen.appendChild(continueBtn);

  container.appendChild(screen);
}

/** A run can now end two structurally
 * different ways (see sim/run.ts's RunResult.overReason) — a fight LOST
 * outright, or the living roster falling below cfg.playerN so the next
 * fight can't even be fielded. They read very differently to a player
 * ("we got wiped" vs. "we ran out of people to send"), so the copy splits
 * on it rather than lumping both under one generic message.
 *
 * 2026-08-15: on a "loss" over-reason, `lastFightResult`/`lastProjection`
 * are the fight that was actually lost — RunSession.playNextFight stashes
 * both before it can know the outcome, so they're populated the same way a
 * won fight's spend screen already gets them. Reused here via the same
 * fightRecap/chainRecapLine/noChainRecapLine/spareLine helpers so a lost
 * run explains itself instead of ending on one flat sentence — the
 * loser-friendly pattern this project's research on run-to-run thinness
 * named directly. Not shown for "rosterExhausted": that reason follows a
 * WIN (the last fight's own recap already played on its spend screen), so
 * there's nothing to explain about the roster running dry beyond the
 * existing sentence. */
export function renderRunOverScreen(
  container: HTMLElement,
  fightsWon: number,
  overReason: "loss" | "rosterExhausted" | null,
  lastFightResult: FightResult | null,
  lastProjection: Projection | null,
  onRetry: () => void,
  testMode = false,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  const wonNote = `after ${fightsWon} win${fightsWon === 1 ? "" : "s"}`;
  const body =
    overReason === "rosterExhausted"
      ? `Your roster couldn't field a full squad ${wonNote} — too many fallen.`
      : `Your fielded squad was wiped ${wonNote}.`;
  screen.innerHTML = `<h1>Run over</h1><p>${body}</p>`;

  if (overReason === "loss" && lastFightResult) {
    // 2026-08-20 (attribution-test instrumentation) — same reveal-behind-a-
    // button treatment as the round recap, see makeRevealContainer.
    const revealContainer = makeRevealContainer(screen, testMode);

    const recap = document.createElement("div");
    recap.className = "recap";
    for (const line of fightRecap(lastFightResult)) {
      const p = document.createElement("p");
      p.textContent = line;
      recap.appendChild(p);
    }
    const spare = document.createElement("p");
    spare.className = "recap-spare";
    spare.textContent = spareLine(lastFightResult, lastProjection);
    recap.appendChild(spare);
    revealContainer.appendChild(recap);

    if (lastFightResult.ignited) {
      const chainLine = chainRecapLine(lastFightResult);
      if (chainLine) {
        const tag = document.createElement("p");
        tag.className = chainLine.backfire ? "recap-chain backfire" : "recap-chain";
        tag.textContent = chainLine.text;
        revealContainer.appendChild(tag);
      }
    } else {
      const missLine = noChainRecapLine(lastFightResult);
      if (missLine) {
        const tag = document.createElement("p");
        tag.className = "recap-miss";
        tag.textContent = missLine;
        revealContainer.appendChild(tag);
      }
    }

    if (testMode) appendAnswerKey(revealContainer, lastFightResult);
  }

  const retry = document.createElement("button");
  retry.textContent = "New run";
  retry.addEventListener("click", onRetry);
  screen.appendChild(retry);
  container.appendChild(screen);
}

export function renderRunCompleteScreen(container: HTMLElement, roundsPlayed: number, onRetry: () => void): void {
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
