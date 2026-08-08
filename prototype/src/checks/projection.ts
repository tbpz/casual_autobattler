/**
 * Sanity-checks sim/projection.ts's mechanism: that a comp with a tank
 * projected to comfortably outlast the fight bands "comfortable"; that a
 * tankless comp never does (living dangerously by construction, however
 * fast it kills); that a clearly under-powered comp bands "losing"; and that
 * killSec roughly matches an actual runFight's duration when variance is
 * zeroed (so the projection reads the same physics the sim implements, not
 * a divergent approximation).
 *
 * Also asserts the default roster (DEFAULT_PLAYER_ROSTER_IDS) bands
 * "comfortable" against fight 0 — the numeric target of the 2026-08-06
 * tuning pass (see DECISIONS.md's "squad pick is the risk dial" entry and
 * config.ts's tankBreakFraction/tankRecoverFraction comments for how it got
 * there; batch-verified dip rate ~27% via `npm run batch --squad comfortable`).
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makeEnemySide } from "../sim/run.js";
import { project } from "../sim/projection.js";

let failed = false;

function check(name: string, condition: boolean, detail: string): void {
  if (condition) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name} — ${detail}`);
    failed = true;
  }
}

const cfg = DEFAULT_RUN_CONFIG;
const enemy = makeEnemySide(cfg, 0);

const wellBuffered = project(makePlayerSide(["hollow", "vex", "cairn"]), enemy, cfg.fight);
check(
  "a tank projected to outlast the fight bands comfortable",
  wellBuffered.band === "comfortable",
  `got ${wellBuffered.band} (tankHolds=${wellBuffered.tankHoldsSec?.toFixed(1)} kill=${wellBuffered.killSec.toFixed(1)})`,
);

const tankless = project(makePlayerSide(["vex", "rook", "cairn"]), enemy, cfg.fight);
check(
  "a tankless comp never bands comfortable, however fast it kills",
  tankless.band !== "comfortable",
  `got ${tankless.band} (margin=${tankless.margin.toFixed(2)})`,
);

const defaultRoster = project(makePlayerSide(), enemy, cfg.fight);
check(
  "the default roster bands comfortable against fight 0",
  defaultRoster.band === "comfortable",
  `got ${defaultRoster.band} (tankHolds=${defaultRoster.tankHoldsSec?.toFixed(1)} kill=${defaultRoster.killSec.toFixed(1)})`,
);

// bracer+rook+ward isn't underpowered against fight 0's enemy (retuned
// 2026-08-06 — Bracer's damage/HP buff pushed it comfortably above margin 1
// there); pit it against fight 10's difficulty-ramped enemy instead, where
// enemy HP has scaled up but the comp's own kill speed hasn't.
const underpoweredEnemy = makeEnemySide(cfg, 10);
const underpowered = project(makePlayerSide(["bracer", "rook", "ward"]), underpoweredEnemy, cfg.fight);
check(
  "a comp with margin < 1 bands losing",
  underpowered.band === "losing",
  `got ${underpowered.band} (margin=${underpowered.margin.toFixed(2)})`,
);

// killSec should roughly predict actual fight duration once variance and
// both PRD tables are zeroed out, isolating the mean-value trajectory.
const zeroedCfg = { ...cfg.fight, damageVariance: 0, ignitionChanceByAttemptsSinceIgnition: [0], chainChanceByHitsSoFar: [0] };
const player = makePlayerSide();
const proj = project(player, enemy, zeroedCfg);
const result = runFight({ player, enemy, attemptsSinceIgnition: 0 }, zeroedCfg, new Rng(1), 1);
const errFrac = Math.abs(result.durationSec - proj.killSec) / proj.killSec;
check(
  "projected killSec tracks actual fight duration within 20%",
  errFrac < 0.2,
  `projected=${proj.killSec.toFixed(1)}s actual=${result.durationSec.toFixed(1)}s (${(errFrac * 100).toFixed(1)}% off)`,
);

if (failed) {
  console.error("\nprojection check FAILED");
  process.exit(1);
} else {
  console.log("\nprojection check passed");
}
