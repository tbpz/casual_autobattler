/**
 * The lab's setup layer — turns a hand-picked matchup into the exact same
 * FightSetup/FightResult the real game plays through. This file is the only
 * place the lab touches sim/: it calls makeUnitState, buildEnemySide, and
 * runFight, all unchanged, the same way batch/cli.ts's `fight` subcommand
 * already does. Nothing here is a new sim mechanism.
 */
import { Rng } from "../sim/rng.js";
import type { RunConfig } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles, type PlayerRole } from "../sim/roles.js";
import { buildEnemySide, encounterAt } from "../sim/encounters.js";
import type { FightSetup } from "../sim/types.js";
import type { FightResult } from "../sim/events.js";

/** One fight's worth of hand-picked setup — everything the lab screen offers
 * a knob for. Distinct from FightSetup (the sim's own shape): this is the
 * SOURCE a lab fight is built from, not the built SideState pair itself. */
export interface LabSetup {
  /** Any number of slots, each a PlayerRole. Duplicates allowed. */
  roles: PlayerRole[];
  /** Starting charge per SLOT, 0-100 — chargePercents[i] belongs to
   * roles[i]. */
  chargePercents: number[];
  /** Index into sim/encounters.ts's ENCOUNTERS table. */
  encounterIndex: number;
  /** A direct HP/damage scale multiplier on the drawn encounter — 0 is
   * unscaled (1x). Kept separate from encounterIndex, same as
   * buildEnemySide's own two independent parameters. */
  rampIndex: number;
  seed: number;
  /** Starting HP per SLOT, 0-100 (of that slot's own maxHp) — same
   * slot-not-array-position convention as chargePercents. Undefined slots
   * default to 100 (fresh). */
  hpPercents?: number[];
}

/** Builds the FightSetup runFight actually consumes, from a LabSetup.
 *
 * The one subtlety: makeSquadFromRoles assigns each unit an instance id of
 * `u${slotIndex}_${role}` BEFORE sorting the array tank-first, so a squad's
 * array order is not slot order once a tank is anywhere but slot 0. Charge
 * is therefore attached by matching that same instance id, never by
 * re-reading array position. */
export function buildLabFightSetup(setup: LabSetup, cfg: RunConfig): FightSetup {
  const player = makeSquadFromRoles(setup.roles);
  const byInstanceId = new Map(player.heroes.map((h) => [h.id, h]));
  setup.roles.forEach((role: PlayerRole, slot) => {
    const instanceId = `u${slot}_${role}`;
    const hero = byInstanceId.get(instanceId);
    if (!hero) {
      throw new Error(`buildLabFightSetup: no unit at instance id ${instanceId} — slot/role mismatch`);
    }
    const pct = setup.chargePercents[slot] ?? 0;
    hero.charge = Math.round((pct / 100) * cfg.fight.chargeThreshold);
    const hpPct = setup.hpPercents?.[slot] ?? 100;
    hero.hp = Math.max(0, Math.round((hpPct / 100) * hero.maxHp));
    hero.alive = hero.hp > 0;
  });
  const encounter = encounterAt(setup.encounterIndex);
  if (!encounter) throw new Error(`buildLabFightSetup: no encounter at index ${setup.encounterIndex}`);
  const scale = 1 + setup.rampIndex * 0.05;
  const enemy = buildEnemySide(cfg.fight, encounter, scale, scale);
  return { player, enemy };
}

/** Runs one lab fight to completion. A FRESH Rng(setup.seed) every call —
 * unlike the real run (render/runSession.ts), which shares one Rng stream
 * across the whole run, a lab fight is meant to be reproduced on its own. */
export function runLabFight(setup: LabSetup, cfg: RunConfig): FightResult {
  const built = buildLabFightSetup(setup, cfg);
  return runFight(built, cfg.fight, new Rng(setup.seed), setup.seed);
}
