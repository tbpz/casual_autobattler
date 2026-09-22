/**
 * Sanity-checks sim/projection.ts's mechanism: that a squad with a tank
 * projected to comfortably outlast the fight bands "comfortable"; that a
 * tankless squad never does (living dangerously by construction, however
 * fast it kills); that a clearly under-powered squad bands "losing"; and
 * that killSec roughly matches an actual runFight's duration when variance
 * is zeroed (so the projection reads the same physics the sim implements).
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles } from "../sim/roles.js";
import { makeEnemySide } from "../sim/run.js";
import { ENCOUNTERS } from "../sim/encounters.js";
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
// Fixture is encounter index 3 (Executioner) — a squad-agnostic threat real
// enough that a tankless squad reads as "tight," not "comfortable," on it.
const enemy = makeEnemySide(cfg, 0, 3);

// Two tanks (round-robin split of the aggro weight) is the pick that clears
// TANK_HOLDS_COMFORTABLE_RATIO on this fixture.
const wellBuffered = project(makeSquadFromRoles(["tank", "tank", "support"]), enemy, cfg.fight);
check(
  "a tank projected to outlast the fight bands comfortable",
  wellBuffered.band === "comfortable",
  `got ${wellBuffered.band} (tankHolds=${wellBuffered.tankHoldsSec?.toFixed(1)} kill=${wellBuffered.killSec.toFixed(1)})`,
);

const tankless = project(makeSquadFromRoles(["damage", "damage", "support"]), enemy, cfg.fight);
check(
  "a tankless squad never bands comfortable, however fast it kills",
  tankless.band !== "comfortable",
  `got ${tankless.band} (margin=${tankless.margin.toFixed(2)})`,
);

// The default 1-tank/1-damage/1-support squad is not a blind-safe pick
// across the run — checks every authored encounter shape at the LAST
// round's own scale (sim/rounds.ts's ROUND_PLAN climbs toward it over the
// whole run), rather than pinning one fixture, since each shape is
// different by design and the round-based scale is what the real run
// actually puts a squad up against by the end.
const defaultRosterBands = ENCOUNTERS.map((_, i) => project(makeSquadFromRoles(["tank", "damage", "support"]), makeEnemySide(cfg, cfg.roundsPerRun - 1, i), cfg.fight).band);
check(
  "the default squad is not a blind-safe pick (not comfortable against every encounter)",
  defaultRosterBands.some((b) => b !== "comfortable"),
  `got bands [${defaultRosterBands.join(", ")}]`,
);

// tank+damage+support isn't underpowered against an unscaled encounter; pit
// it against a heavily-scaled enemy instead, where enemy HP/damage have
// scaled up but the squad's own kill speed hasn't.
const underpoweredEnemy = { heroes: enemy.heroes.map((h) => ({ ...h, maxHp: h.maxHp * 6, hp: h.hp * 6, damage: h.damage * 3 })), dpsBonus: 0 };
const underpowered = project(makeSquadFromRoles(["tank", "damage", "support"]), underpoweredEnemy, cfg.fight);
check(
  "a squad with margin < 1 bands losing",
  underpowered.band === "losing",
  `got ${underpowered.band} (margin=${underpowered.margin.toFixed(2)})`,
);

// killSec should roughly predict actual fight duration once variance and the
// chain-length table are zeroed out, isolating the mean-value trajectory.
const zeroedCfg = { ...cfg.fight, damageVariance: 0, chainChanceByHitsSoFar: [0], chainContinuationScale: 0 };
const player = makeSquadFromRoles(["tank", "damage", "support"]);
const proj = project(player, enemy, zeroedCfg);
const result = runFight({ player, enemy }, zeroedCfg, new Rng(1), 1);
const errFrac = Math.abs(result.durationSec - proj.killSec) / proj.killSec;
check(
  "projected killSec tracks actual fight duration within 20%",
  errFrac < 0.2,
  `projected=${proj.killSec.toFixed(1)}s actual=${result.durationSec.toFixed(1)}s (${(errFrac * 100).toFixed(1)}% off)`,
);

// --- Over-heal survival regression. A healer squad's projection against a
// no-threat encounter must stay finite and within maxFightSec — the
// divide-by-zero guard (enemyDps - healPerSec) must never get read back as
// a real survival time.
{
  const overhealPlayer = makeSquadFromRoles(["tank", "damage", "support"]);
  const anvil = makeEnemySide(cfg, 0, 5); // Anvil is ENCOUNTERS[5]
  const overheal = project(overhealPlayer, anvil, cfg.fight);
  check(
    "a healer squad vs Anvil projects a finite surviveSec within maxFightSec (over-heal regression)",
    Number.isFinite(overheal.surviveSec) && overheal.surviveSec <= cfg.fight.maxFightSec,
    `got surviveSec=${overheal.surviveSec.toFixed(1)} (cap ${cfg.fight.maxFightSec})`,
  );
  check(
    "the same squad's tankHoldsSec is finite and within maxFightSec (over-heal regression)",
    overheal.tankHoldsSec !== null && Number.isFinite(overheal.tankHoldsSec) && overheal.tankHoldsSec <= cfg.fight.maxFightSec,
    `got tankHoldsSec=${overheal.tankHoldsSec?.toFixed(1)} (cap ${cfg.fight.maxFightSec})`,
  );
}

// --- Chain-expectation coverage: a side with real carried charge projects
// visibly MORE chains than one starting fresh, and the projection never
// quietly omits the line players read as the chain signal.
{
  const fresh = makeSquadFromRoles(["tank", "damage", "support"]);
  const freshProj = project(fresh, enemy, cfg.fight);
  check(
    "a fresh-charge side's chainsExpected is a finite, non-negative number",
    Number.isFinite(freshProj.chainsExpected) && freshProj.chainsExpected >= 0,
    `got ${freshProj.chainsExpected.toFixed(2)}`,
  );

  const charged = makeSquadFromRoles(["tank", "damage", "support"]);
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
