/**
 * Every card in the pool fires (2026-10-01 — see sim/cards/defs/). For each
 * card, one small scenario sets up what it reads and asserts a `cardTriggered`
 * for it appears. Some cards need a particular moment (a slam, a death, a
 * thaw), so a scenario tries a handful of encounters and seeds and passes on
 * the first that triggers — what it pins is "this card is reachable and does
 * something", the gap that left Deep freeze, Spread and Open wound nearly dead
 * before (STATE.md's old Next-up #2), not a rate.
 *
 * Every unit starts at full charge so chains fire at once; each scenario names
 * the abilities its units carry and any extra cards that must be held.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { ChainEffect } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide, makeOfferPolicy, runRun } from "../sim/run.js";
import { RunSession } from "../render/runSession.js";
import { CARD_DEFS, CARD_IDS, duoUnlocked } from "../sim/cards/index.js";
import type { CardId } from "../sim/cards/index.js";
import type { FightResult } from "../sim/events.js";
import { Rng as RelicRng } from "../sim/rng.js";
import { makeInitialProgress, heldCards } from "../sim/progress.js";
import { applyRelic, drawRelicChoices } from "../sim/relics.js";
import { makeStartingRoster } from "../sim/roles.js";
import { RELIC_IDS } from "../sim/cards/index.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;

interface Scenario {
  /** Extra cards held besides the one under test. */
  with?: CardId[];
  effects?: Partial<Record<PlayerRole, ChainEffect[]>>;
  /** Chain level per role (mark stacks per rung). */
  level?: Partial<Record<PlayerRole, number>>;
  backfire?: "always" | "never";
}

/** Rounds and encounters to try, early to late: some cards need a bruiser's
 * slam, or enough pressure that a unit falls. */
const TRIES: [round: number, enc: number][] = [[0, 0], [3, 2], [6, 1], [9, 3], [12, 0], [15, 2], [18, 1]];

function play(card: CardId, s: Scenario, round: number, enc: number, seed: number): FightResult {
  const player = makeSquadFromRoles(["tank", "damage", "support"]);
  for (const h of player.heroes) {
    h.charge = run.fight.chargeThreshold;
    const e = s.effects?.[h.role as PlayerRole];
    if (e) h.chainEffects = e;
    const lv = s.level?.[h.role as PlayerRole];
    if (lv) h.chainLevel = lv;
  }
  const cfg = { ...run.fight, forceBackfire: s.backfire ?? "never", chainChanceByHitsSoFar: [1] };
  return runFight({ player, enemy: makeEnemySide(run, round, enc), cards: [...(s.with ?? []), card] }, cfg, new Rng(seed), seed);
}

function triggers(result: FightResult, card: CardId): number {
  return result.events.filter((e) => e.type === "cardTriggered" && e.card === card).length;
}

/** The first (round, encounter, seed) in which `card` fires, or null. */
function find(card: CardId, s: Scenario): string | null {
  for (const [round, enc] of TRIES) {
    for (let seed = 1; seed <= 6; seed++) {
      if (triggers(play(card, s, round, enc, seed), card) > 0) return `r${round}/e${enc}/s${seed}`;
    }
  }
  return null;
}

const freezeTank: Scenario = { effects: { tank: ["guard", "stun"] } };
const burner: Scenario = { effects: { damage: ["expose", "scorch"] } };
const shielded: Scenario = { effects: { tank: ["guard", "brace"], support: ["mend", "ward"] } };

const SCENARIOS: Partial<Record<CardId, Scenario>> = {
  // ✦ exposed
  hunterMark: {},
  weakSpot: {},
  crack: { level: { damage: 3 } },
  layBare: {},
  // ❄ frozen
  coldSnap: { backfire: "always" },
  brittle: freezeTank,
  frostbite: freezeTank,
  permafrost: freezeTank,
  // ♨ burn
  kindling: {},
  inferno: burner,
  smoke: burner,
  wildfire: burner,
  // ⛊ shield
  overflow: { effects: { support: ["mend", "ward"] } },
  shieldBash: shielded,
  shatterguard: shielded,
  // general
  momentum: {},
  secondWind: {},
  ironHide: {},
  bloodlust: {},
  // duos: their parts are held; the scenario feeds them
  fortress: { with: ["bulwark"], effects: { tank: ["guard"], support: ["mend", "ward"] } },
  thermalShock: { with: ["shatter"], effects: { tank: ["guard", "stun"], damage: ["expose", "scorch"] } },
  killingFrost: { with: ["execute", "deepFreeze"], effects: { tank: ["guard", "stun"] } },
  cinderShield: { with: ["spikedShield"], effects: { tank: ["guard", "brace"], support: ["mend", "ward"], damage: ["expose", "scorch"] } },
  glass: { with: ["weakSpot", "brittle"], effects: { tank: ["guard", "stun"] } },
  phoenix: { with: ["secondWind"], effects: { support: ["mend"] } },
  // relics
  emberHeart: { backfire: "always" },
  frostCrown: {},
  huntersEye: {},
  bastion: {},
  restless: {},
};

// --- Every card in the registry has a scenario or a reason not to.
{
  const already = new Set<CardId>(["execute", "punish", "shatter", "deepFreeze", "spread", "openWound", "spikedShield", "bulwark"]);
  const missing = CARD_IDS.filter((id) => !SCENARIOS[id] && !already.has(id) && id !== "aegis" && id !== "mercenary");
  check("every new card has a scenario here", missing.length === 0, missing.join(","));
}

for (const [id, scenario] of Object.entries(SCENARIOS) as [CardId, Scenario][]) {
  const where = find(id, scenario);
  check(`${CARD_DEFS[id].title}: it fires in a forced scenario`, where !== null, where ?? "never fired in any try");
}

// --- Aegis is a passive rule with no trigger of its own: it lifts the Shield cap.
{
  const peak = (cards: CardId[]): number => {
    const player = makeSquadFromRoles(["tank", "damage", "support"]);
    for (const h of player.heroes) h.charge = run.fight.chargeThreshold;
    player.heroes.find((h) => h.role === "tank")!.chainEffects = ["brace"];
    for (const h of player.heroes) if (h.role !== "tank") h.chainEffects = ["ward"];
    const enemy = makeEnemySide(run, 0, 0);
    for (const h of enemy.heroes) h.nextAttackT = 1000;
    const cfg = { ...run.fight, forceBackfire: "never" as const, chainChanceByHitsSoFar: [1] };
    const result = runFight({ player, enemy, cards }, cfg, new Rng(3), 3);
    const tank = player.heroes.find((h) => h.role === "tank")!;
    let best = 0;
    for (const s of result.snapshots) for (const h of s.playerHeroes) if (h.id === tank.id) best = Math.max(best, h.marks.shield / h.maxHp);
    return best;
  };
  const without = peak([]);
  const withAegis = peak(["aegis"]);
  check("Aegis: without it a tank's Shield stops at the base cap", without <= run.fight.shieldCapFractionOfMaxHp + 1e-9, `${without.toFixed(2)}`);
  check("Aegis: with it the Shield goes past the base cap", withAegis > run.fight.shieldCapFractionOfMaxHp + 0.01, `${withAegis.toFixed(2)}`);
}

// --- Relics: the round 1 reward, a pick of one from three, held outside the card list.
{
  const choices = drawRelicChoices(new RelicRng(5));
  check("relic: three distinct choices are drawn, all relics", choices.length === 3 && new Set(choices).size === 3 && choices.every((c) => RELIC_IDS.includes(c)));
  const seen = new Set<string>();
  for (let s = 1; s <= 40; s++) for (const c of drawRelicChoices(new RelicRng(s))) seen.add(c);
  check("relic: across seeds every relic comes up", seen.size === RELIC_IDS.length, `${seen.size} of ${RELIC_IDS.length}`);

  const progress = makeInitialProgress(run);
  const roster = makeStartingRoster(progress.bonus);
  const taken = applyRelic(progress, roster, "bastion", new RelicRng(1));
  check("relic: taking one sets progress.relic and leaves the card list empty", taken.progress.relic === "bastion" && taken.progress.cards.length === 0);
  check("relic: heldCards puts the relic first, ahead of the cards", heldCards({ ...taken.progress, cards: ["execute"] })[0] === "bastion");
  check("relic: a non-Mercenary relic leaves the roster alone", taken.roster.heroes.length === roster.heroes.length);

  const merc = applyRelic(progress, roster, "mercenary", new RelicRng(1));
  check("relic: Mercenary adds a fourth unit", merc.roster.heroes.length === roster.heroes.length + 1);
  const ids = merc.roster.heroes.map((h) => h.id);
  check("relic: the Mercenary has an id of its own", new Set(ids).size === ids.length);
  let threw = false;
  try {
    applyRelic(progress, roster, "execute", new RelicRng(1));
  } catch {
    threw = true;
  }
  check("relic: an ordinary card cannot be taken as a relic", threw);
}

// --- The relic is round 1's reward (DECISIONS.md, 2026-10-01): the run opens on a
// fight, the win's reward is the relic and not offers, and a win that leaves too
// few units to field gets nothing and ends the run.
{
  const batchRun = (seed: number, opts?: Parameters<typeof runRun>[5]) =>
    runRun(run, new Rng(seed), new Rng((seed ^ 0x51ed270b) >>> 0), makeOfferPolicy("build"), seed, opts);
  const SEEDS = 600;
  let fieldable: ReturnType<typeof batchRun> | undefined;
  let stranded: ReturnType<typeof batchRun> | undefined;
  let strandedWithRelic = 0;
  let strandedNotOver = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = batchRun(seed);
    if (r.rounds[0]!.outcome !== "win") continue;
    if (r.rounds[0]!.relicTaken) fieldable ??= r;
    else {
      stranded ??= r;
      if (r.finalProgress.relic) strandedWithRelic++;
      if (r.outcome !== "over" || r.overReason !== "rosterExhausted" || r.roundsWon !== 1) strandedNotOver++;
    }
  }
  check("opening: a round 1 win takes a relic and no offer", !!fieldable && fieldable.rounds[0]!.offerTaken === null && !!fieldable.finalProgress.relic);
  check("opening: round 1 is fought with no relic held, round 2 with it first", !!fieldable && fieldable.heldByRound[0]!.length === 0 && fieldable.heldByRound[1]![0] === fieldable.rounds[0]!.relicTaken);
  check("opening: round 2's win is back to the normal offers", !!fieldable && fieldable.rounds[1] !== undefined && (fieldable.rounds[1].outcome === "loss" || fieldable.rounds[1].offerTaken !== null));
  check("opening: a round 1 win that strands the roster exists in the seed range", !!stranded, `${SEEDS} seeds`);
  check("opening: a stranded win gets no relic and ends the run as rosterExhausted", strandedWithRelic === 0 && strandedNotOver === 0);

  const none = fieldable ? batchRun(fieldable.seed, { relicPick: null }) : undefined;
  check("opening: relicPick null takes no relic and still gives no round 1 offer", !!none && none.finalProgress.relic === undefined && none.rounds[0]!.offerTaken === null && none.rounds[0]!.relicTaken === undefined);

  // The interactive session follows the same rule as the batch driver.
  let sessionOk = false;
  let doubleTapIgnored = false;
  let strandedSessionOk = false;
  let sawStranded = false;
  let parity = true;
  for (let seed = 1; seed <= SEEDS && !(sessionOk && sawStranded); seed++) {
    const s = new RunSession(run, seed);
    const result = s.playNextRound();
    if (result.outcome !== "win") continue;
    if (s.awaitingRelic) {
      if (sessionOk) continue;
      const choices = s.relicChoices;
      const noOffers = s.pendingOffers.length === 0;
      s.pickRelic(choices[0]!);
      const took = s.progress.relic === choices[0] && s.currentRoundIndex === 1 && !s.awaitingRelic;
      s.pickRelic(choices[1]!);
      doubleTapIgnored = s.progress.relic === choices[0];
      sessionOk = noOffers && took;
      const b = batchRun(seed);
      if (b.rounds[0]!.relicTaken !== choices[0]) parity = false;
    } else if (!sawStranded) {
      sawStranded = true;
      s.pickRelic(s.relicChoices[0]!);
      strandedSessionOk = s.progress.relic === undefined && s.pendingOffers.length === 0;
      s.resolveOffer(null);
      strandedSessionOk &&= s.status === "over" && s.overReason === "rosterExhausted";
    }
  }
  check("session: after a round 1 win it waits on the relic, with no offers, and the pick advances the run", sessionOk);
  check("session: a second relic pick is ignored", doubleTapIgnored);
  check("session: a stranded round 1 win offers no relic and ends the run", sawStranded && strandedSessionOk);
  check("session: the relic taken matches the batch driver's for the same seed", parity);
}

// --- Duos are only unlocked by their parts.
{
  check("duo: Fortress needs Bulwark held and Ward in the squad", !duoUnlocked("fortress", ["ward"], []) && !duoUnlocked("fortress", [], ["bulwark"]) && duoUnlocked("fortress", ["ward"], ["bulwark"]));
  check("duo: Thermal shock needs Shatter and something that makes burn", !duoUnlocked("thermalShock", ["scorch"], []) && !duoUnlocked("thermalShock", ["expose"], ["shatter"]) && duoUnlocked("thermalShock", ["scorch"], ["shatter"]));
  check("duo: a held card that makes burn counts (Kindling feeds Thermal shock)", duoUnlocked("thermalShock", ["expose"], ["shatter", "kindling"]));
  check("duo: a bridge only counts when fed — Frostbite without frozen makes no burn", !duoUnlocked("thermalShock", ["expose"], ["shatter", "frostbite"]));
}

if (failed) process.exit(1);
