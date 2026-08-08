/**
 * Regression pins for two representative comps, both PRD tables zeroed so
 * the pure-combat trajectory is isolated from the two dice layered on top
 * of it (ignition and chain).
 *
 * Rewritten 2026-08-07 for the fight causality rebuild (see DECISIONS.md's
 * "fight causality rebuild" entry): the old pity-gate — ignition only
 * reachable once the tank line had broken and the pool had fallen below a
 * fraction of its start — is gone, replaced by a per-hero HEAT meter that
 * accrues from doing the job a hero was picked for (see config.ts's
 * FightConfig docstring). Heat is now reachable on a WINNING path too (a
 * dealer's `dealt` keeps accruing whether or not the tank ever wavers), so
 * "does heat ever cross" and "does the tank ever break" are independent
 * facts, unlike the old gate where they were the same fact. This file pins:
 *  1. a comfortable, tanked comp — the tank line holds the entire fight
 *     (its job is being done), AND heat still crosses given enough fight
 *     duration (a dealer's own job accrues regardless of how the tank is
 *     doing) — demonstrating the two are no longer coupled.
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
  fight: { ...DEFAULT_RUN_CONFIG.fight, ignitionChanceByAttemptsSinceIgnition: [0], chainChanceByHitsSoFar: [0] },
};

// --- Comfortable comp: bracer+rook+cairn, the default roster. The tank's
// job (holding the line) and the dealer's job (accruing heat) are
// independent now — both should hold true in the same fight.
{
  const setup = { player: makePlayerSide(["bracer", "rook", "cairn"]), enemy: makeEnemySide(cfg, 0), attemptsSinceIgnition: 0 };
  const result = runFight(setup, cfg.fight, new Rng(1), 1);

  check("comfortable comp: tank line never breaks", !result.events.some((e) => e.type === "tankBreak"));
  check("comfortable comp: no dip recorded", !result.dipOccurred);
  check(
    "comfortable comp: heat still crosses given enough fight duration",
    result.events.some((e) => e.type === "heatFull"),
  );
  check("comfortable comp: wins by wipe", result.outcome === "win" && result.endReason === "wipe");
}

// --- Tankless comp: vex+rook+ward — no line to hold, so dip is automatic
// from tick 1 (same semantics the old gate's "no living tank" clause had).
// The wind-up should fire at least once in any fight that runs past
// windupIntervalSec + windupTelegraphSec — the mechanism that's supposed to
// make fragility cost something needs to actually be live.
{
  const setup = { player: makePlayerSide(["vex", "rook", "ward"]), enemy: makeEnemySide(cfg, 0), attemptsSinceIgnition: 0 };
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
