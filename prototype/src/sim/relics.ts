import type { Rng } from "./rng.js";
import { CARD_DEFS, RELIC_IDS } from "./cards/index.js";
import type { CardId } from "./cards/index.js";
import type { RunProgress } from "./progress.js";
import type { PlayerRole } from "./roles.js";
import { PLAYER_ROLES, makeUnitState } from "./roles.js";
import type { SideState } from "./types.js";

/**
 * 2026-10-01 (the build-depth plan, "G. a pick at the start of the run", moved
 * by DECISIONS.md's relic-timing entries). The reward for the first win is a
 * choice of one relic from three — a small rule-bender that points the rest of
 * the run in a direction (Ember heart wants backfires, Hunter's eye wants
 * anything that reads exposed). Most relics are ordinary cards
 * (cards/defs/relic.ts) held in RunProgress.relic; Mercenary is the exception
 * that changes the roster once, here.
 *
 * Pure data and pure functions, like offers.ts, so the headless driver
 * (sim/run.ts) and the interactive session (render/runSession.ts) share them.
 */

/** Draws `count` distinct relics for the relic pick. */
export function drawRelicChoices(rng: Rng, count = 3): CardId[] {
  const left = [...RELIC_IDS];
  const out: CardId[] = [];
  while (out.length < count && left.length > 0) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/** Puts the chosen relic into the run. Mercenary also adds a fourth unit of a
 * random role (drawn from `rng`) to the roster; every other relic is just held. */
export function applyRelic(
  progress: RunProgress,
  roster: SideState,
  relic: CardId,
  rng: Rng,
): { progress: RunProgress; roster: SideState } {
  if (!CARD_DEFS[relic] || CARD_DEFS[relic].kind !== "relic") throw new Error(`applyRelic: "${relic}" is not a relic`);
  const next = { ...progress, relic };
  if (relic !== "mercenary") return { progress: next, roster };
  const role: PlayerRole = PLAYER_ROLES[Math.floor(rng.next() * PLAYER_ROLES.length)]!;
  const ordinal = roster.heroes.filter((h) => h.role === role).length + 1;
  const unit = makeUnitState(role, ordinal, `u${roster.heroes.length}_${role}`, progress.bonus[role]);
  return { progress: next, roster: { ...roster, heroes: [...roster.heroes, unit] } };
}
