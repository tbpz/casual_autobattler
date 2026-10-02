/**
 * sim/offers.ts's applyOffer is pure and every offer the pool can draw
 * actually applies cleanly — a run that takes EVERY offer it's ever shown
 * (not just the first, unlike checks/runShape.ts's population) must never
 * reach a broken state: no negative slots, no "living" unit at 0 HP, no
 * chain level past its cap, no maxHp/damage bonus applied twice for the
 * same offer.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { makeInitialProgress } from "../sim/progress.js";
import { makeStartingRoster, PLAYER_ROLES, ROLE_POOL } from "../sim/roles.js";
import { applyFightResultToRoster, canFieldSquad, defaultFieldPick, fieldSquad } from "../sim/roster.js";
import { drawRoundEncounters, roundEnemySide } from "../sim/rounds.js";
import { applyOffer, defaultCardDrop, drawOffers, noteIntroduced, squadChainEffects } from "../sim/offers.js";
import { CARD_DEFS, duoUnlocked, marksMadeBy } from "../sim/cards/index.js";
import { runFight } from "../sim/fight.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const cfg = DEFAULT_RUN_CONFIG;
const seed = 12_345;
const rng = new Rng(seed);
const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
const roundOrder = drawRoundEncounters(seed, cfg.roundsPerRun);

let progress = makeInitialProgress(cfg);
let roster = makeStartingRoster(progress.bonus);
let invariantBroken: string | null = null;
let anyOfferSeen = false;

function checkInvariants(label: string): void {
  if (progress.slots < 1 || progress.slots > cfg.maxSlots) invariantBroken ??= `${label}: slots out of range (${progress.slots})`;
  for (const role of PLAYER_ROLES) {
    if (progress.chain[role].level < 1 || progress.chain[role].level > cfg.chainLevelCap) {
      invariantBroken ??= `${label}: ${role} chain level out of range (${progress.chain[role].level})`;
    }
    // 2026-09-29 (add-don't-swap — see DECISIONS.md): a "chainGain" offer
    // must never be offered twice for the same ability, and the base
    // ability (index 0) must never be displaced.
    const effects = progress.chain[role].effects;
    if (new Set(effects).size !== effects.length) {
      invariantBroken ??= `${label}: ${role} chain has a duplicate ability (${effects.join(",")})`;
    }
    if (effects[0] !== ROLE_POOL[role].baseChain) {
      invariantBroken ??= `${label}: ${role} chain lost its base ability (${effects.join(",")})`;
    }
  }
  for (const h of roster.heroes) {
    if (h.alive && h.hp <= 0) invariantBroken ??= `${label}: ${h.name} is "alive" at ${h.hp} HP`;
    if (h.hp > h.maxHp) invariantBroken ??= `${label}: ${h.name} is over its own max (${h.hp}/${h.maxHp})`;
    // 2026-09-30 (fatigue): whatever offers and fights do to a unit, its
    // fatigue stays inside [0, fatigueMax].
    if (h.fatigue < 0 || h.fatigue > cfg.fight.fatigueMax) invariantBroken ??= `${label}: ${h.name} fatigue out of range (${h.fatigue})`;
  }
  // 2026-09-30 (marks and payoffs): the payoff list never passes its cap and
  // never holds a card twice.
  if (progress.cards.length > cfg.cardCap) invariantBroken ??= `${label}: payoffs past the cap (${progress.cards.length})`;
  if (new Set(progress.cards).size !== progress.cards.length) {
    invariantBroken ??= `${label}: a payoff card is held twice (${progress.cards.join(",")})`;
  }
  if (roster.heroes.length > cfg.maxRosterSize) invariantBroken ??= `${label}: roster grew past maxRosterSize (${roster.heroes.length})`;
}

for (let i = 0; i < cfg.roundsPerRun && !invariantBroken; i++) {
  if (!canFieldSquad(roster, progress.slots)) break;
  const fieldedIds = defaultFieldPick(roster, progress.slots);
  const player = fieldSquad(roster, fieldedIds, progress);
  const enemy = roundEnemySide(cfg, i, roundOrder[i]!);
  const result = runFight({ player, enemy, cards: progress.cards }, cfg.fight, rng, seed);
  if (result.outcome === "loss") break;

  roster = applyFightResultToRoster(roster, player, result, cfg);
  const offers = drawOffers(offerRng, progress, roster, cfg, i);
  // 2026-09-30 (introduce a mark before its payoff): a drawn payoff card may
  // only read marks the player has already met, via progress.introduced as it
  // stood BEFORE this draw's own ability offers are noted.
  // A mark a held card lays counts as met too (2026-10-01): the card's own
  // text names it (coloured since 2026-10-02), e.g. "the front enemy becomes
  // exposed".
  const met = marksMadeBy(progress.introduced, progress.cards);
  for (const offer of offers) {
    if (offer.kind !== "card") continue;
    const def = CARD_DEFS[offer.card!];
    if (def.kind === "duo") {
      // A duo is gated by its parts, not by marks: it may only be offered with
      // every part in hand.
      if (!duoUnlocked(offer.card!, squadChainEffects(progress, roster), progress.cards)) {
        invariantBroken ??= `round ${i + 1}: duo "${offer.title}" offered without its parts`;
      }
      continue;
    }
    const unmet = def.reads.filter((mark) => !met.has(mark));
    if (unmet.length > 0) {
      invariantBroken ??= `round ${i + 1}: card "${offer.title}" offered before ${unmet.join(",")} was introduced`;
    }
  }
  progress = noteIntroduced(progress, offers);
  // Take EVERY offer this round hands out, one after another, folding each
  // into the next draw — the adversarial case for "never reaches a broken
  // state," not the population checks/runShape.ts already covers.
  for (const offer of offers) {
    anyOfferSeen = true;
    const applied = applyOffer(progress, roster, offer, cfg, defaultCardDrop(progress, roster, offer, cfg));
    progress = applied.progress;
    roster = applied.roster;
    checkInvariants(`round ${i + 1}, offer "${offer.title}"`);
    if (invariantBroken) break;
  }
}

check("at least one offer was drawn and applied over the run", anyOfferSeen);
check("no invariant broke across the whole run", invariantBroken === null, invariantBroken ?? "");

if (failed) {
  console.error("\noffers check FAILED");
  process.exit(1);
} else {
  console.log("\noffers check passed");
}
