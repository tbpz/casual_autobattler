/**
 * The round screen's starting squad (DECISIONS.md 2026-10-16, "A dead unit's slot stays empty"). Run with `npm run check:squadpick`.
 *
 *  - Last round's living squad stays, and a slot whose unit DIED stays empty, so the pick can be shorter than the slot count.
 *  - A slot that has just appeared from a reward fills the way the default pick fills it.
 *  - With no history (round 1) the pick is the full default one.
 *  - The headless sim and the batch bot are unchanged: defaultFieldPick and carryOverFieldPick still always fill.
 *  - A recruit or the Mercenary is named the moment it joins, from the run seed, with no repeats.
 */
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { makeInitialProgress } from "../sim/progress.js";
import { makeStartingRoster, makeUnitState, UNIT_NAMES } from "../sim/roles.js";
import { carryOverFieldPick, carryOverWithGaps, defaultFieldPick } from "../sim/roster.js";
import { RunSession } from "../render/runSession.js";

let failed = false;
function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const cfg = DEFAULT_RUN_CONFIG;
const progress = makeInitialProgress(cfg);

function rosterOf(extra: number) {
  const roster = makeStartingRoster(progress.bonus);
  for (let i = 0; i < extra; i++) roster.heroes.push(makeUnitState("damage", i + 2, `u${roster.heroes.length}_damage`, progress.bonus.damage));
  return roster;
}

// --- round 1: no history, a full default pick.
{
  const roster = rosterOf(0);
  const pick = carryOverWithGaps(roster, 3, []);
  check("round 1: the pick fills every slot", pick.length === 3 && new Set(pick).size === 3);
  check("round 1: it is the default pick", JSON.stringify(pick) === JSON.stringify(defaultFieldPick(roster, 3)));
}

// --- everyone lived: the squad stays exactly as it was, with no gap.
{
  const roster = rosterOf(2);
  const previous = roster.heroes.slice(0, 3).map((h) => h.id);
  check("all alive: last round's squad stays as it was", JSON.stringify(carryOverWithGaps(roster, 3, previous)) === JSON.stringify(previous));
}

// --- a fielded unit died: its slot stays empty, nobody is swapped in.
{
  const roster = rosterOf(2);
  const previous = roster.heroes.slice(0, 3).map((h) => h.id);
  roster.heroes[1]!.alive = false;
  const pick = carryOverWithGaps(roster, 3, previous);
  check("a death: the squad is one short", pick.length === 2);
  check("a death: the dead unit is not in it", !pick.includes(roster.heroes[1]!.id));
  check("a death: nobody was swapped in", pick.every((id) => previous.includes(id)));
  check("a death: the old pick would have filled it (so the change is real)", carryOverFieldPick(roster, 3, previous).length === 3);
}

// --- two deaths: two gaps.
{
  const roster = rosterOf(3);
  const previous = roster.heroes.slice(0, 3).map((h) => h.id);
  roster.heroes[0]!.alive = false;
  roster.heroes[2]!.alive = false;
  check("two deaths: two gaps", carryOverWithGaps(roster, 3, previous).length === 1);
}

// --- a slot that has just appeared fills itself; a death in the same round still leaves its gap.
{
  const roster = rosterOf(3);
  const previous = roster.heroes.slice(0, 3).map((h) => h.id);
  const grown = carryOverWithGaps(roster, 4, previous);
  check("a new slot: it fills, and the old squad stays", grown.length === 4 && previous.every((id) => grown.includes(id)));
  roster.heroes[1]!.alive = false;
  const both = carryOverWithGaps(roster, 4, previous);
  check("a new slot and a death: the new slot fills, the dead unit's slot stays empty", both.length === 3 && !both.includes(roster.heroes[1]!.id));
}

// --- names: a recruit and the Mercenary are named from the run seed, never twice.
{
  const run = (seed: number) => {
    const s = new RunSession(cfg, seed);
    return s.currentRoster.heroes.map((h) => h.name);
  };
  check("names: a session names its starting units from the pool", run(5).every((n) => UNIT_NAMES.includes(n)));
  check("names: a seed replays the same names", JSON.stringify(run(5)) === JSON.stringify(run(5)));
  const s = new RunSession(cfg, 9);
  s.playNextRound();
  if (s.status === "in-progress" && s.awaitingRelic) {
    const merc = s.relicChoices.find((id) => id === "mercenary");
    if (merc) {
      s.pickRelic(merc);
      const names = s.currentRoster.heroes.map((h) => h.name);
      check("names: the Mercenary gets a name of its own, with no repeat", names.every((n) => UNIT_NAMES.includes(n)) && new Set(names).size === names.length);
    }
  }
}

if (failed) {
  console.log("squad-pick check FAILED");
  process.exit(1);
}
console.log("squad-pick check passed");
