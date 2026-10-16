/**
 * Fatigue (2026-09-30 — see DECISIONS.md's "Fatigue replaces per-role backfire
 * odds"). Pins the rules the design depends on: the backfire curve is shallow
 * up to the sweet spot and steep after it, tiers map where they should, fatigue
 * makes a chain stronger and longer, the roster moves it up for a fielded unit
 * and down for a benched one and keeps it in range, a Rest card cuts it, and
 * the offer safety net forces a Rest card when no fresh unit is left to field.
 *
 * Whether the curve's PEAK lands in the middle (the point of "push or rest") is
 * a batch measurement, not something to assert here — read the "by fatigue
 * tier" line of `npm run batch`.
 */
import { Rng } from "../sim/rng.js";
import {
  DEFAULT_RUN_CONFIG,
  backfireChanceFor,
  chainContinuationChance,
  fatigueMagnitudeMult,
  fatigueTier,
} from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeInitialProgress } from "../sim/progress.js";
import { makeStartingRoster } from "../sim/roles.js";
import { applyFightResultToRoster, fieldSquad } from "../sim/roster.js";
import { makeEnemySide } from "../sim/run.js";
import { applyOffer, drawOffers } from "../sim/offers.js";
import { TUNED_UNDER, deadFace, eyeSvg, squadFace, villainFace, type FaceTier } from "../render/faces.js";
import { UNIT_NAMES, makeSquadFromRoles, nameUnits } from "../sim/roles.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;
const fc = run.fight;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// --- The backfire curve.
{
  check("curve: a fresh unit sits at backfireAtFresh", near(backfireChanceFor(fc, 0), fc.backfireAtFresh));
  check("curve: the sweet spot sits at backfireAtSweetSpot", near(backfireChanceFor(fc, fc.fatigueSweetSpot), fc.backfireAtSweetSpot));
  check("curve: max fatigue sits at backfireAtBreaking", near(backfireChanceFor(fc, fc.fatigueMax), fc.backfireAtBreaking));
  check("curve: out-of-range fatigue clamps to the anchors", near(backfireChanceFor(fc, -50), fc.backfireAtFresh) && near(backfireChanceFor(fc, fc.fatigueMax * 3), fc.backfireAtBreaking));

  let monotonic = true;
  for (let f = 1; f <= fc.fatigueMax; f++) if (backfireChanceFor(fc, f) < backfireChanceFor(fc, f - 1)) monotonic = false;
  check("curve: backfire chance never falls as fatigue rises", monotonic);

  const before = (backfireChanceFor(fc, fc.fatigueSweetSpot) - backfireChanceFor(fc, 0)) / fc.fatigueSweetSpot;
  const after = (backfireChanceFor(fc, fc.fatigueMax) - backfireChanceFor(fc, fc.fatigueSweetSpot)) / (fc.fatigueMax - fc.fatigueSweetSpot);
  check("curve: steeper after the sweet spot than before it", after > before * 2, `slope ${before.toFixed(4)} -> ${after.toFixed(4)} per point`);
}

// --- Tiers.
{
  const [worn, frayed, breaking] = fc.fatigueTierFloors;
  check(
    "tiers: each floor starts its tier and the point below belongs to the one before",
    fatigueTier(fc, 0) === "fresh" &&
      fatigueTier(fc, worn - 1) === "fresh" &&
      fatigueTier(fc, worn) === "worn" &&
      fatigueTier(fc, frayed - 1) === "worn" &&
      fatigueTier(fc, frayed) === "frayed" &&
      fatigueTier(fc, breaking - 1) === "frayed" &&
      fatigueTier(fc, breaking) === "breaking" &&
      fatigueTier(fc, fc.fatigueMax) === "breaking",
  );
}

// --- Fatigue makes chains stronger and longer.
{
  check("boost: fresh is exactly 1x", near(fatigueMagnitudeMult(fc, 0), 1));
  check("boost: max fatigue adds fatigueMagnitudeBonus", near(fatigueMagnitudeMult(fc, fc.fatigueMax), 1 + fc.fatigueMagnitudeBonus));
  check("boost: a fresh unit gets the plain continuation table", near(chainContinuationChance(fc, 1, 0), chainContinuationChance(fc, 1)));
  check("boost: a worn unit's chain is likelier to continue", chainContinuationChance(fc, 1, fc.fatigueMax / 2) > chainContinuationChance(fc, 1, 0));

  const firstHit = (fatigue: number) => {
    const player = makeSquadFromRoles(["damage"]);
    const unit = player.heroes[0]!;
    unit.charge = fc.chargeThreshold;
    unit.fatigue = fatigue;
    // Every continuation roll passes, so the first rung always lands and the
    // only thing that differs between the two fights is the unit's fatigue.
    const result = runFight(
      { player, enemy: makeEnemySide(run, 0, 0) },
      { ...fc, forceBackfire: "never", chainChanceByHitsSoFar: [1] },
      new Rng(7),
      7,
    );
    const hit = result.events.find((e) => e.type === "chainHit");
    return hit?.type === "chainHit" ? hit.damage : 0;
  };
  const fresh = firstHit(0);
  const worn = firstHit(fc.fatigueMax);
  check("boost: a max-fatigue unit's first rung hits harder than a fresh unit's", worn > fresh && fresh > 0, `${fresh} -> ${worn}`);
}

// --- The faces show the tier: lids drop, a rim appears, and small bodies get the size-tuned eye.
{
  const tiers: FaceTier[] = ["fresh", "worn", "frayed", "breaking"];
  const tank = "#ffb454";
  check("faces: every tier draws an svg", tiers.every((t) => squadFace(tank, t, 52).startsWith("<svg")));
  const noIds = (svg: string) => svg.replace(/e\d+(-1|1)/g, "e");
  check("faces: the four tiers draw four different faces", new Set(tiers.map((t) => noIds(squadFace(tank, t, 52)))).size === 4);
  check("faces: Frayed and Breaking carry a rim, Fresh and Worn do not", ["frayed", "breaking"].every((t) => /#e8913c|#ff4d4d/.test(squadFace(tank, t as FaceTier, 52))) && !/#e8913c|#ff4d4d/.test(squadFace(tank, "fresh", 52) + squadFace(tank, "worn", 52)));
  check(
    "faces: under TUNED_UNDER the size-tuned eye is used, at TUNED_UNDER the plain one",
    /rx="16.5"/.test(squadFace(tank, "worn", TUNED_UNDER - 1)) && /rx="13"/.test(squadFace(tank, "worn", TUNED_UNDER)),
  );
  check("faces: an unknown tier throws", (() => { try { eyeSvg(tank, "rested" as FaceTier, 52, "plain"); return false; } catch { return true; } })());
  check("faces: clip ids stay unique across faces", (() => { const a = squadFace(tank, "fresh", 52), b = squadFace(tank, "fresh", 52); return a.match(/id="(e\d+)/)![1] !== b.match(/id="(e\d+)/)![1]; })());
  check("faces: villain and fallen faces draw", villainFace(34).startsWith("<svg") && villainFace(56, 1.35).includes("clipPath") && deadFace().includes("M23 37"));
}

// --- Unit names: drawn from the pool, seeded, never repeated in one roster, role labels left alone elsewhere.
{
  const progress = makeInitialProgress(run);
  const named = (seed: number) => nameUnits(makeStartingRoster(progress.bonus).heroes, seed).map((h) => h.name);
  check("names: a seed replays the same names", JSON.stringify(named(7)) === JSON.stringify(named(7)));
  check("names: every starting unit gets a pool name", named(7).every((n) => UNIT_NAMES.includes(n)));
  check("names: no name twice in a roster", new Set(named(7)).size === named(7).length);
  check("names: different seeds give different names", new Set([1, 2, 3, 4, 5, 6].map((s) => named(s).join())).size > 1);
  check("names: a named unit keeps its name", (() => { const once = nameUnits(makeStartingRoster(progress.bonus).heroes, 9); return nameUnits(once, 123) === once; })());
  check("names: a check squad keeps the role labels", makeSquadFromRoles(["tank", "damage"]).heroes.every((h) => /^(Tank|Damage|Healer) \d+$/.test(h.name)));
}

// --- The roster moves fatigue and keeps it in range.
{
  const progress = makeInitialProgress(run);
  const roster = makeStartingRoster(progress.bonus);
  const fieldedIds = roster.heroes.slice(0, 2).map((h) => h.id);
  const benchedId = roster.heroes[2]!.id;
  roster.heroes.forEach((h) => (h.fatigue = 50));

  const fielded = fieldSquad(roster, fieldedIds, progress);
  const result = runFight({ player: fielded, enemy: makeEnemySide(run, 0, 0) }, fc, new Rng(3), 3);
  const after = applyFightResultToRoster(roster, fielded, result, run);
  const byId = new Map(after.heroes.map((h) => [h.id, h]));

  check("roster: a fielded unit gains fatigue", fieldedIds.every((id) => byId.get(id)!.fatigue > 50));
  check("roster: a benched unit sheds exactly fatigueBenchRest", near(byId.get(benchedId)!.fatigue, 50 - run.fatigueBenchRest));

  const pinned = makeStartingRoster(progress.bonus);
  pinned.heroes.forEach((h) => (h.fatigue = fc.fatigueMax));
  const pinnedFielded = fieldSquad(pinned, pinned.heroes.map((h) => h.id), progress);
  const pinnedAfter = applyFightResultToRoster(
    pinned,
    pinnedFielded,
    runFight({ player: pinnedFielded, enemy: makeEnemySide(run, 0, 0) }, fc, new Rng(3), 3),
    run,
  );
  check("roster: fatigue never passes fatigueMax", pinnedAfter.heroes.every((h) => h.fatigue <= fc.fatigueMax));

  const rested = { ...roster, heroes: roster.heroes.map((h) => ({ ...h, fatigue: 0 })) };
  const restedAfter = applyFightResultToRoster(rested, fieldSquad(rested, fieldedIds, progress), result, run);
  check("roster: fatigue never goes below 0", restedAfter.heroes.every((h) => h.fatigue >= 0));
}

// --- The Rest card and its safety net.
{
  const progress = makeInitialProgress(run);
  const worn = makeStartingRoster(progress.bonus);
  worn.heroes[0]!.fatigue = 80;
  worn.heroes[1]!.fatigue = 30;

  const applied = applyOffer(
    progress,
    worn,
    { kind: "rest", unitId: worn.heroes[0]!.id, headline: "", title: "", detail: "" },
    run,
  );
  const target = applied.roster.heroes[0]!;
  check("rest: the card cuts exactly restFatigueCut off its unit", near(target.fatigue, 80 - run.restFatigueCut));
  check("rest: it leaves the other units alone", near(applied.roster.heroes[1]!.fatigue, 30));

  const almostFresh = makeStartingRoster(progress.bonus);
  almostFresh.heroes[0]!.fatigue = 10;
  const floored = applyOffer(progress, almostFresh, { kind: "rest", unitId: almostFresh.heroes[0]!.id, headline: "", title: "", detail: "" }, run);
  check("rest: it cannot take a unit below 0", floored.roster.heroes[0]!.fatigue === 0);

  // Safety net: every fieldable unit past the sweet spot -> a Rest is on offer, always.
  const allWorn = makeStartingRoster(progress.bonus);
  allWorn.heroes.forEach((h) => (h.fatigue = run.fight.fatigueSweetSpot + 10));
  let alwaysOffered = true;
  for (let seed = 1; seed <= 200; seed++) {
    const offers = drawOffers(new Rng(seed), progress, allWorn, run, 5);
    if (!offers.some((o) => o.kind === "rest")) alwaysOffered = false;
  }
  check("safety net: a Rest is offered whenever every fieldable unit is past the sweet spot", alwaysOffered);

  // ...and not forced when a fresh unit exists to rotate in.
  const oneFresh = makeStartingRoster(progress.bonus);
  oneFresh.heroes.forEach((h) => (h.fatigue = run.fight.fatigueSweetSpot + 10));
  const freshUnit = { ...oneFresh.heroes[0]!, id: "spare_fresh", fatigue: 0 };
  const withSpare = { ...oneFresh, heroes: [...oneFresh.heroes.slice(1), freshUnit, oneFresh.heroes[0]!] };
  const wide = { ...progress, slots: 1 };
  let forcedWithSpare = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (drawOffers(new Rng(seed), wide, withSpare, run, 5).some((o) => o.kind === "rest")) forcedWithSpare++;
  }
  check("safety net: with a fresh unit to field, a Rest is not forced every time", forcedWithSpare < 200, `${forcedWithSpare}/200`);

  // A fresh roster has nothing to rest.
  const fresh = makeStartingRoster(progress.bonus);
  const noRest = Array.from({ length: 100 }, (_, i) => drawOffers(new Rng(i + 1), progress, fresh, run, 5)).every((offers) =>
    offers.every((o) => o.kind !== "rest"),
  );
  check("rest: never offered when nobody is fatigued", noRest);
}

if (failed) {
  console.error("\nfatigue check FAILED");
  process.exit(1);
} else {
  console.log("\nfatigue check passed");
}
