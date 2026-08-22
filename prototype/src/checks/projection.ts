/**
 * Sanity-checks sim/projection.ts's mechanism: that a comp with a tank
 * projected to comfortably outlast the fight bands "comfortable"; that a
 * tankless comp never does (living dangerously by construction, however
 * fast it kills); that a clearly under-powered comp bands "losing"; and that
 * killSec roughly matches an actual runFight's duration when variance is
 * zeroed (so the projection reads the same physics the sim implements, not
 * a divergent approximation).
 *
 * Also asserts the default roster (DEFAULT_PLAYER_ROSTER_IDS) is NOT a
 * blind-safe pick across the whole run — flipped from "comfortable at fight
 * 0" by the 2026-08-08 dominant-squad root-cause pass (see heroes.ts's pool
 * docstring): bracer+rook+cairn is no longer a free win by design.
 *
 * 2026-08-09 (boring-middle root-cause pass): the "comfortable" fixture
 * moved from bracer+vex+cairn to bracer+hollow+cairn (double tank). Fixing
 * two separate overstatements in the SAME direction — this file's wind-up
 * DPS was averaged over the wrong cycle length, and config.ts's heal cap
 * never actually bound on anyone — happened to also expose that Vex's
 * pre-fix DPS overshoot (see heroes.ts) was propping bracer+vex+cairn's
 * margin up. Once Vex was cut to real parity with Rook, no single-tank comp
 * clears TANK_HOLDS_COMFORTABLE_RATIO at fight 0 any more; double tank is now
 * the only pick that does, honestly.
 *
 * Also 2026-08-09 (encounter-table pass — see sim/encounters.ts): the
 * single "fight 0" fixture for the default-roster assertion is gone. Each of
 * the 5 fights now authors its own shape, so a squad reads differently
 * against each one BY DESIGN (see encounters.ts's top docstring) — a single
 * pinned "bands tight against fight 0" no longer describes the property
 * that matters. The property now checked: the default roster does not band
 * "comfortable" against every one of the 5 fights — i.e. at least one
 * encounter genuinely tests it, rather than every fight reading as an
 * effortless floor the way the pre-encounter-table game did.
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
// Fixture is fight index 1 (The Wall — sim/encounters.ts), not 0 (Pack), as
// of the encounter-table pass: Pack's five simultaneous attackers spread
// enough incoming damage that even a double-tank pick only just clears
// margin 1 there (ratio ~1.0-1.02 measured), while a single, slower-hitting
// body (The Wall) is exactly the shape a real tank comp should read as safe
// against.
const enemy = makeEnemySide(cfg, 1);

// 2026-08-09 (see this file's top docstring): swapped again to
// bracer+hollow+cairn — the double-tank pick is the only one left that
// clears TANK_HOLDS_COMFORTABLE_RATIO once Vex's DPS overshoot was fixed.
const wellBuffered = project(makePlayerSide(["bracer", "hollow", "cairn"]), enemy, cfg.fight);
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

// 2026-08-09 (encounter-table pass — see this file's top docstring): checks
// across all 5 authored fights rather than pinning one fixture, since each
// fight is now a different shape by design.
const defaultRosterBands = [0, 1, 2, 3, 4].map((i) => project(makePlayerSide(), makeEnemySide(cfg, i), cfg.fight).band);
check(
  "the default roster is not a blind-safe pick (not comfortable against every fight)",
  defaultRosterBands.some((b) => b !== "comfortable"),
  `got bands [${defaultRosterBands.join(", ")}]`,
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

// killSec should roughly predict actual fight duration once variance and the
// chain-length table are zeroed out, isolating the mean-value trajectory.
// 2026-08-14 chain rebuild: no more ignitionChanceByAttemptsSinceIgnition to
// zero — firing itself is deterministic on threshold-cross now, not a roll.
// chainContinuationScale: 0 (2026-08-20, per-hero-profile pass) added
// alongside chainChanceByHitsSoFar — see checks/beatsheet.ts's identical
// override for why the global table alone stops being enough once a hero can
// carry its own continuation odds.
const zeroedCfg = { ...cfg.fight, damageVariance: 0, chainChanceByHitsSoFar: [0], chainContinuationScale: 0 };
const player = makePlayerSide();
const proj = project(player, enemy, zeroedCfg);
const result = runFight({ player, enemy }, zeroedCfg, new Rng(1), 1);
const errFrac = Math.abs(result.durationSec - proj.killSec) / proj.killSec;
check(
  "projected killSec tracks actual fight duration within 20%",
  errFrac < 0.2,
  `projected=${proj.killSec.toFixed(1)}s actual=${result.durationSec.toFixed(1)}s (${(errFrac * 100).toFixed(1)}% off)`,
);

// --- Over-heal survival regression (2026-08-22 — see DECISIONS.md). Before
// this fix, a healer draft against the "Anvil" encounter (index 5) read
// surviveSec=48500/tankHoldsSec=18915 for a fight that resolves in ~36s —
// enemyDps - healPerSec clamped to the divide-by-zero GUARD (0.01), and the
// guard got treated as a real DPS figure. Measured as a common case (10% of
// realistic field-pick projections, 14 of 20 drafts — any draft with a
// healer), not a rare edge case, concentrated on exactly this encounter.
// Pins the fix directly: both figures must be finite AND stay under the
// sim's own hard fight-length cutoff, `maxFightSec` — a number bigger than
// that is exactly as dishonest as the old fabricated one, just smaller.
{
  const overhealPlayer = makePlayerSide(["bracer", "rook", "cairn"]);
  const anvil = makeEnemySide(cfg, 0, 5); // Anvil is ENCOUNTERS[5], tier "early"
  const overheal = project(overhealPlayer, anvil, cfg.fight);
  check(
    "a healer draft vs Anvil projects a finite surviveSec within maxFightSec (over-heal regression)",
    Number.isFinite(overheal.surviveSec) && overheal.surviveSec <= cfg.fight.maxFightSec,
    `got surviveSec=${overheal.surviveSec.toFixed(1)} (cap ${cfg.fight.maxFightSec})`,
  );
  check(
    "the same draft's tankHoldsSec is finite and within maxFightSec (over-heal regression)",
    overheal.tankHoldsSec !== null && Number.isFinite(overheal.tankHoldsSec) && overheal.tankHoldsSec <= cfg.fight.maxFightSec,
    `got tankHoldsSec=${overheal.tankHoldsSec?.toFixed(1)} (cap ${cfg.fight.maxFightSec})`,
  );
}

// --- Chain-expectation coverage (2026-08-20, per-hero-profile pass — Part 1
// §6 of the "chain choice: make the pick a shape, not a size" plan). Two
// properties: a side with real carried charge projects visibly MORE chains
// than one starting fresh (the mechanism actually responds to input), and
// the projection never quietly omits the line players read as the chain
// signal.
{
  const fresh = makePlayerSide();
  const freshProj = project(fresh, enemy, cfg.fight);
  check(
    "a fresh-charge side's chainsExpected is a finite, non-negative number",
    Number.isFinite(freshProj.chainsExpected) && freshProj.chainsExpected >= 0,
    `got ${freshProj.chainsExpected.toFixed(2)}`,
  );

  const charged = makePlayerSide();
  charged.heroes[0]!.charge = cfg.fight.chargeThreshold * 0.9;
  const chargedProj = project(charged, enemy, cfg.fight);
  check(
    "carried charge raises chainsExpected relative to a fresh side",
    chargedProj.chainsExpected > freshProj.chainsExpected,
    `fresh=${freshProj.chainsExpected.toFixed(2)} charged=${chargedProj.chainsExpected.toFixed(2)}`,
  );
  check(
    "chainLine is always a non-empty player-facing string",
    typeof chargedProj.chainLine === "string" && chargedProj.chainLine.length > 0,
    `got ${JSON.stringify(chargedProj.chainLine)}`,
  );
}

if (failed) {
  console.error("\nprojection check FAILED");
  process.exit(1);
} else {
  console.log("\nprojection check passed");
}
