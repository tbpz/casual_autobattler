/**
 * Regression pins for two representative comps, both PRD tables zeroed so
 * the pure-combat trajectory is isolated from the two dice layered on top
 * of it (ignition and chain).
 *
 * A per-hero CHARGE meter accrues from doing the job a hero was picked for
 * (see config.ts's FightConfig docstring) and fires deterministically the
 * instant it crosses chargeThreshold (2026-08-14 chain rebuild — no
 * separate roll). Charge is reachable on a WINNING path too (a dealer's
 * `dealt` keeps accruing whether or not the tank ever wavers), so "does a
 * chain ever fire" and "does the tank ever break" are independent facts.
 * This file pins:
 *  1. a comfortable, tanked comp — the tank line holds the entire fight (its
 *     job is being done), charge accrues at all (a dealer's own job accrues
 *     regardless of how the tank is doing, demonstrating the two are
 *     independent), and — the persistence property this whole rebuild is
 *     built on — carrying that charge into a SECOND fight (same convention
 *     roster.ts's applyFightResultToRoster uses) does eventually cross
 *     chargeThreshold and fire. A single ~20s fight alone is NOT expected to
 *     cross (chargeThreshold is deliberately sized for the run's arc, not
 *     one fight — see config.ts's docstring), so this checks two fights
 *     instead of one, exactly the shape a real run produces.
 *  2. a tankless comp — dip is recorded from the first tick (no line to
 *     hold, same semantics the old gate's "no living tank" clause had), and
 *     the wind-up actually fires within the fight — the mechanism that's
 *     supposed to make fragility cost something is live, not theoretical.
 *
 * As before, exact event *timing* is not independently hand-derivable
 * (support healing and weighted-random enemy/wind-up targeting both consume
 * the RNG stream) — what's pinned is the *shape*.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makeEnemySide } from "../sim/run.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  const ok = condition;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
}

const cfg = {
  ...DEFAULT_RUN_CONFIG,
  // Zeroed so the pure-combat trajectory is isolated: a chain that fires
  // never continues past its first roll (2026-08-14 chain rebuild — no more
  // ignitionChanceByAttemptsSinceIgnition to zero, since firing itself is
  // deterministic now, not a roll).
  //
  // chainContinuationScale: 0 (2026-08-20, per-hero-profile pass) added
  // alongside chainChanceByHitsSoFar — once a hero's continuation odds can
  // come from its OWN profile instead of this global table, zeroing only the
  // global table stops being enough to disable continuation; the scale is
  // a hard global damper applied on top of whichever table's chosen (see
  // config.ts's FightConfig docstring), so it keeps this override working
  // even once per-hero profiles are authored.
  fight: { ...DEFAULT_RUN_CONFIG.fight, chainChanceByHitsSoFar: [0], chainContinuationScale: 0 },
};

// --- Comfortable comp: bracer+rook+cairn, the default roster. The tank's
// job (holding the line) and the dealer's job (accruing charge) are
// independent now — both should hold true in the same fight.
//
// Seed moved 1 -> 3 (2026-09-20 difficulty pass — see DECISIONS.md this
// date and sim/encounters.ts's own top comment): Pack (fight index 0) had
// its damage raised x1.6 as part of giving every encounter, not just the
// finale, real stakes — measured at n=300, this exact comp now dips (its
// tank line breaks) against Pack 36.7% of the time, up from ~0% before the
// pass. Seed 1 lands in that 36.7%, which would make "tank line never
// breaks" a false invariant, not a representative illustration. Seed 3 is
// one of the ~63% where it still holds clean, which is what this specific
// check exists to demonstrate (that holding the line and accruing charge
// are independent mechanics) — the POPULATION-level dip rate for this draft
// is chaindist.ts's job (its "default draft (always-heal): dip rate"
// check), not this file's; a dip is now a normal, expected, non-guaranteed
// outcome for this comp here, not a bug if a future reader hits it on a
// different seed.
{
  const setup = { player: makePlayerSide(["bracer", "rook", "cairn"]), enemy: makeEnemySide(cfg, 0) };
  const result = runFight(setup, cfg.fight, new Rng(3), 3);

  check("comfortable comp: tank line never breaks", !result.events.some((e) => e.type === "tankBreak"));
  check("comfortable comp: no dip recorded", !result.dipOccurred);
  check("comfortable comp: some hero's charge accrues at all", result.finalPlayerHeroes.some((h) => h.charge > 0));
  check("comfortable comp: wins by wipe", result.outcome === "win" && result.endReason === "wipe");

  // Persistence check (2026-08-14 chain rebuild): carry each hero's final
  // charge into a second fight, same as roster.ts's applyFightResultToRoster
  // does for a real run — the property that makes charge a run-long resource
  // rather than a per-fight roll is that it eventually crosses and fires
  // even though no single fight does on its own. Second-fight seed moved
  // 2 -> 4 to follow the seed-1-to-3 move above.
  const carriedPlayer = {
    heroes: result.finalPlayerHeroes.map((snap, i) => ({ ...setup.player.heroes[i]!, charge: snap.charge })),
    dpsBonus: setup.player.dpsBonus,
  };
  const secondSetup = { player: carriedPlayer, enemy: makeEnemySide(cfg, 0) };
  const secondResult = runFight(secondSetup, cfg.fight, new Rng(4), 4);
  check(
    "comfortable comp: charge carried into a second fight eventually fires a chain",
    secondResult.events.some((e) => e.type === "chainStart"),
  );
}

// --- Tankless comp: vex+rook+ward — no line to hold, so dip is automatic
// from tick 1 (same semantics the old gate's "no living tank" clause had).
// The wind-up should fire at least once in any fight that runs past
// windupIntervalSec + windupTelegraphSec — the mechanism that's supposed to
// make fragility cost something needs to actually be live.
//
// 2026-08-09 (encounter-table pass): pitted against fight index 4
// (Champion), not 0 — fight 0 is now "Pack" (sim/encounters.ts), which has
// no bruiser at all by design (the whole point of that encounter is "many
// bodies, no telegraphed spike"), so it can never fire a wind-up. Champion
// keeps the pre-pass "1 bruiser + grunts" shape this test needs.
{
  const setup = { player: makePlayerSide(["vex", "rook", "ward"]), enemy: makeEnemySide(cfg, 4) };
  const result = runFight(setup, cfg.fight, new Rng(12), 12);

  check("tankless comp: dip recorded from the start", result.dipOccurred);
  check("tankless comp: at least one wind-up fires", result.events.some((e) => e.type === "windupStart"));
}

if (failed) {
  console.error("\nbeatsheet check FAILED");
  process.exit(1);
} else {
  console.log("\nbeatsheet check passed");
}
