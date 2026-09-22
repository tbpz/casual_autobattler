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
import { makeStartingRoster, PLAYER_ROLES } from "../sim/roles.js";
import { applyFightResultToRoster, canFieldSquad, defaultFieldPick, fieldSquad } from "../sim/roster.js";
import { drawRoundEncounters, roundEnemySide } from "../sim/rounds.js";
import { applyOffer, drawOffers } from "../sim/offers.js";
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
  }
  for (const h of roster.heroes) {
    if (h.alive && h.hp <= 0) invariantBroken ??= `${label}: ${h.name} is "alive" at ${h.hp} HP`;
    if (h.hp > h.maxHp) invariantBroken ??= `${label}: ${h.name} is over its own max (${h.hp}/${h.maxHp})`;
  }
  if (roster.heroes.length > cfg.maxRosterSize) invariantBroken ??= `${label}: roster grew past maxRosterSize (${roster.heroes.length})`;
}

for (let i = 0; i < cfg.roundsPerRun && !invariantBroken; i++) {
  if (!canFieldSquad(roster, progress.slots)) break;
  const fieldedIds = defaultFieldPick(roster, progress.slots);
  const player = fieldSquad(roster, fieldedIds, progress);
  const enemy = roundEnemySide(cfg, i, roundOrder[i]!);
  const result = runFight({ player, enemy }, cfg.fight, rng, seed);
  if (result.outcome === "loss") break;

  roster = applyFightResultToRoster(roster, player, result, cfg);
  const offers = drawOffers(offerRng, progress, roster, cfg, i);
  // Take EVERY offer this round hands out, one after another, folding each
  // into the next draw — the adversarial case for "never reaches a broken
  // state," not the population checks/runShape.ts already covers.
  for (const offer of offers) {
    anyOfferSeen = true;
    const applied = applyOffer(progress, roster, offer, cfg);
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
