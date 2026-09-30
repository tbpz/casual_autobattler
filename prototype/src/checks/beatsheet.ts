/**
 * Regression pins for two representative squads, both PRD tables zeroed so
 * the pure-combat trajectory is isolated from the two dice layered on top
 * of it (ignition and chain).
 *
 * A per-unit CHARGE meter accrues from doing the job a unit was picked for
 * (see config.ts's FightConfig docstring) and fires deterministically the
 * instant it crosses chargeThreshold — no separate roll. Charge is
 * reachable on a WINNING path too (a dealer's `dealt` keeps accruing
 * whether or not the tank ever wavers), so "does a chain ever fire" and
 * "does the tank ever break" are independent facts. This file pins:
 *  1. a comfortable, tanked squad (tank+damage+support) — the tank line
 *     holds the entire fight, charge accrues at all, and a chain fires within
 *     that first fight (charge starts at zero every fight).
 *  2. a tankless squad (damage+damage+support) — dip is recorded from the
 *     first tick, and the wind-up actually fires within the fight.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles } from "../sim/roles.js";
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
  // never continues past its first roll.
  fight: { ...DEFAULT_RUN_CONFIG.fight, chainChanceByHitsSoFar: [0], chainContinuationScale: 0 },
};

// --- Comfortable squad: tank+damage+support, the default starting roster.
// The tank's job (holding the line) and the dealer's job (accruing charge)
// are independent — both should hold true in the same fight.
{
  const setup = { player: makeSquadFromRoles(["tank", "damage", "support"]), enemy: makeEnemySide(cfg, 0, 0) };
  const result = runFight(setup, cfg.fight, new Rng(3), 3);

  check("comfortable squad: tank line never breaks", !result.events.some((e) => e.type === "tankBreak"));
  check("comfortable squad: no dip recorded", !result.dipOccurred);
  check("comfortable squad: some unit's charge accrues at all", result.finalPlayerHeroes.some((h) => h.charge > 0));
  check("comfortable squad: wins by wipe", result.outcome === "win" && result.endReason === "wipe");

  // Charge resets every fight (DECISIONS.md 2026-09-30 "Chains fire every
  // fight"), so a chain has to happen inside the first fight, from a cold
  // start, or it does not happen at all.
  check("comfortable squad: a chain fires in its first fight, from zero charge", result.events.some((e) => e.type === "chainStart"));
}

// --- Tankless squad: damage+damage+support — no line to hold, so dip is
// automatic from tick 1. The wind-up should fire at least once in any fight
// that runs past windupIntervalSec + windupTelegraphSec — the mechanism
// that's supposed to make fragility cost something needs to actually be
// live. Pitted against encounter index 4 (Champion), which has a bruiser —
// index 0 (Pack) has none by design.
{
  const setup = { player: makeSquadFromRoles(["damage", "damage", "support"]), enemy: makeEnemySide(cfg, 0, 4) };
  const result = runFight(setup, cfg.fight, new Rng(12), 12);

  check("tankless squad: dip recorded from the start", result.dipOccurred);
  check("tankless squad: at least one wind-up fires", result.events.some((e) => e.type === "windupStart"));
}

if (failed) {
  console.error("\nbeatsheet check FAILED");
  process.exit(1);
} else {
  console.log("\nbeatsheet check passed");
}
