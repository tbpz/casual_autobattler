/**
 * The lab's setup layer — turns a hand-picked matchup into the exact same
 * FightSetup/FightResult the real game plays through. This file is the only
 * place the lab touches sim/: it calls makePlayerSide, makeEncounterEnemySide,
 * and runFight, all unchanged, the same way batch/cli.ts's `fight` subcommand
 * and every batch/*.ts rig already do. Nothing here is a new sim mechanism —
 * see this feature's plan for the precedent each piece follows.
 */
import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makePlayerSide } from "../sim/heroes.js";
import { makeEncounterEnemySide } from "../sim/encounters.js";
import type { FightSetup } from "../sim/types.js";
import type { FightResult } from "../sim/events.js";

/** One fight's worth of hand-picked setup — everything the lab screen offers
 * a knob for. Distinct from FightSetup (the sim's own shape): this is the
 * SOURCE a lab fight is built from, not the built SideState pair itself. */
export interface LabSetup {
  /** Exactly 3 slots (cfg.playerN) — each a PLAYER_HERO_POOL id. Duplicates
   * allowed (e.g. "bracer","bracer","rook") — makePlayerSide doesn't care. */
  heroIds: string[];
  /** Starting charge per SLOT, 0-100 — chargePercents[i] belongs to
   * heroIds[i], not to whatever position that hero ends up at after
   * makePlayerSide's tank-first sort (see buildLabFightSetup below). */
  chargePercents: number[];
  /** Index into sim/encounters.ts's ENCOUNTERS table. */
  encounterIndex: number;
  /** The `fightIndex` the enemy's difficulty ramp reads — 0 is unscaled. Kept
   * separate from encounterIndex on purpose, same as
   * makeEncounterEnemySide's own two independent parameters. */
  rampIndex: number;
  seed: number;
}

/** Builds the FightSetup runFight actually consumes, from a LabSetup.
 *
 * The one subtlety: makePlayerSide assigns each hero an instance id of
 * `p${slotIndex}_${heroId}` BEFORE sorting the array tank-first (heroes.ts's
 * makePlayerSide), so a squad's array order is not slot order once a tank is
 * anywhere but slot 0. Charge is therefore attached by matching that same
 * instance id, never by re-reading array position — matching by position
 * would silently attach a slider to the wrong hero the moment the squad isn't
 * already tank-first. */
export function buildLabFightSetup(setup: LabSetup, cfg: RunConfig): FightSetup {
  const player = makePlayerSide(setup.heroIds);
  const byInstanceId = new Map(player.heroes.map((h) => [h.id, h]));
  setup.heroIds.forEach((heroId, slot) => {
    const instanceId = `p${slot}_${heroId}`;
    const hero = byInstanceId.get(instanceId);
    if (!hero) {
      throw new Error(`buildLabFightSetup: no hero at instance id ${instanceId} — slot/heroId mismatch`);
    }
    const pct = setup.chargePercents[slot] ?? 0;
    hero.charge = Math.round((pct / 100) * cfg.fight.chargeThreshold);
  });
  const enemy = makeEncounterEnemySide(cfg, setup.rampIndex, setup.encounterIndex);
  return { player, enemy };
}

/** Runs one lab fight to completion. A FRESH Rng(setup.seed) every call —
 * unlike the real run (render/runSession.ts), which shares one Rng stream
 * across all 5 fights, a lab fight is meant to be reproduced on its own, so
 * it gets its own stream seeded straight from setup.seed. Same seed -> same
 * FightSetup -> identical event log, exactly like every other runFight call
 * site (see checks/determinism.ts). */
export function runLabFight(setup: LabSetup, cfg: RunConfig): FightResult {
  const built = buildLabFightSetup(setup, cfg);
  return runFight(built, cfg.fight, new Rng(setup.seed), setup.seed);
}
