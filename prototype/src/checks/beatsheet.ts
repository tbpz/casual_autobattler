/**
 * Regression pins for two representative comps, both PRD tables zeroed so
 * the pure-combat trajectory is isolated from the two dice layered on top
 * of it (ignition and chain).
 *
 * Inverted 2026-08-06 (see DECISIONS.md's "jeopardy no longer mandatory"
 * entry). The pre-2026-08-06 version of this file pinned "the gate must
 * open — jeopardy is mandatory every fight" and had to hand-pick seed 8
 * specifically because the gate happened to open there (a comment on that
 * version noted 4 of the first 10 seeds tried never crossed the threshold
 * at all). That was the bug, not a fact to defend: a comp built to be safe
 * should be ABLE to win with no dip, no gate, and no ignition roll — and
 * usually does. This file pins one seed of the comfortable comp doing
 * exactly that, and one seed of an under-tanked comp reliably dipping
 * instead, as the funnel's two anchor points.
 *
 * As in the pre-2026-08-06 version, exact event *timing* is not
 * independently hand-derivable (support healing and weighted-random enemy
 * targeting both consume the RNG stream, so precisely which beat a
 * transition lands on moves seed to seed) — what's pinned is the *shape*:
 * whether a dip/gate happens at all, and their relative order when they do.
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
  fight: { ...DEFAULT_RUN_CONFIG.fight, ignitionChanceByFightsSince: [0], chainChanceByHitsSoFar: [0] },
};

// --- Comfortable comp: bracer+rook+cairn, the default roster. Batch-verified
// (npm run batch --squad comfortable) dip rate ~27% at these constants, so
// "never dips" is a per-seed fact, not a guarantee — seed 1 is one of the
// ~73% of fights that doesn't, chosen for that reason, not because it's
// special.
{
  const setup = { player: makePlayerSide(["bracer", "rook", "cairn"]), enemy: makeEnemySide(cfg, 0), fightsSinceIgnition: 0 };
  const result = runFight(setup, cfg.fight, new Rng(1), 1);

  check("comfortable comp: tank line never breaks", !result.events.some((e) => e.type === "tankBreak"));
  check("comfortable comp: gate never opens", !result.events.some((e) => e.type === "gateOpen"));
  check("comfortable comp: no dip recorded", !result.dipOccurred);
  check("comfortable comp: wins by wipe", result.outcome === "win" && result.endReason === "wipe");
}

// --- Under-tanked comp: hollow (the weaker of the two tanks) + rook + ward
// (the weaker healer, half of Cairn's heal-per-beat) — a tank with thin
// support. npm run batch --squad hollow,rook,ward reports ~66% dip rate
// averaged across a full run's 5 (difficulty-ramped) fights; fight 1 alone,
// against the unscaled fight-0 enemy this check uses, dips less often —
// seeds 1-15 scanned, seed 12 picked as one of the fight-1 seeds that does.
{
  const setup = { player: makePlayerSide(["hollow", "rook", "ward"]), enemy: makeEnemySide(cfg, 0), fightsSinceIgnition: 0 };
  const result = runFight(setup, cfg.fight, new Rng(12), 12);

  const breakEvent = result.events.find((e) => e.type === "tankBreak");
  const gateEvent = result.events.find((e) => e.type === "gateOpen");
  check("under-tanked comp: tank line breaks", !!breakEvent);
  check("under-tanked comp: gate opens", !!gateEvent);
  if (breakEvent && gateEvent) {
    check("under-tanked comp: tank breaks before the gate opens", breakEvent.t <= gateEvent.t, `break=${breakEvent.t} gate=${gateEvent.t}`);
  }
  check("under-tanked comp: dip recorded", result.dipOccurred);
}

if (failed) {
  console.error("\nbeatsheet check FAILED");
  process.exit(1);
} else {
  console.log("\nbeatsheet check passed");
}
