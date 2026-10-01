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
import { makeEnemySide } from "../sim/run.js";
import { CARD_DEFS, CARD_IDS, duoUnlocked } from "../sim/cards/index.js";
import type { CardId } from "../sim/cards/index.js";
import type { FightResult } from "../sim/events.js";
import { Rng as RelicRng } from "../sim/rng.js";
import { makeInitialProgress, heldCards } from "../sim/progress.js";
import { applyRelicStart, drawRelicChoices } from "../sim/relics.js";
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

// --- Relics: a start-of-run pick of one from three, held outside the card list.
{
  const choices = drawRelicChoices(new RelicRng(5));
  check("relic: three distinct choices are drawn, all relics", choices.length === 3 && new Set(choices).size === 3 && choices.every((c) => RELIC_IDS.includes(c)));
  const seen = new Set<string>();
  for (let s = 1; s <= 40; s++) for (const c of drawRelicChoices(new RelicRng(s))) seen.add(c);
  check("relic: across seeds every relic comes up", seen.size === RELIC_IDS.length, `${seen.size} of ${RELIC_IDS.length}`);

  const progress = makeInitialProgress(run);
  const roster = makeStartingRoster(progress.bonus);
  const taken = applyRelicStart(progress, roster, "bastion", new RelicRng(1));
  check("relic: taking one sets progress.relic and leaves the card list empty", taken.progress.relic === "bastion" && taken.progress.cards.length === 0);
  check("relic: heldCards puts the relic first, ahead of the cards", heldCards({ ...taken.progress, cards: ["execute"] })[0] === "bastion");
  check("relic: a non-Mercenary relic leaves the roster alone", taken.roster.heroes.length === roster.heroes.length);

  const merc = applyRelicStart(progress, roster, "mercenary", new RelicRng(1));
  check("relic: Mercenary adds a fourth unit", merc.roster.heroes.length === roster.heroes.length + 1);
  const ids = merc.roster.heroes.map((h) => h.id);
  check("relic: the Mercenary has an id of its own", new Set(ids).size === ids.length);
  let threw = false;
  try {
    applyRelicStart(progress, roster, "execute", new RelicRng(1));
  } catch {
    threw = true;
  }
  check("relic: an ordinary card cannot be taken as a relic", threw);
}

// --- Duos are only unlocked by their parts.
{
  check("duo: Fortress needs Bulwark held and Ward in the squad", !duoUnlocked("fortress", ["ward"], []) && !duoUnlocked("fortress", [], ["bulwark"]) && duoUnlocked("fortress", ["ward"], ["bulwark"]));
  check("duo: Thermal shock needs Shatter and something that makes burn", !duoUnlocked("thermalShock", ["scorch"], []) && !duoUnlocked("thermalShock", ["expose"], ["shatter"]) && duoUnlocked("thermalShock", ["scorch"], ["shatter"]));
  check("duo: a held card that makes burn counts (Kindling feeds Thermal shock)", duoUnlocked("thermalShock", ["expose"], ["shatter", "kindling"]));
  check("duo: a bridge only counts when fed — Frostbite without frozen makes no burn", !duoUnlocked("thermalShock", ["expose"], ["shatter", "frostbite"]));
}

if (failed) process.exit(1);
