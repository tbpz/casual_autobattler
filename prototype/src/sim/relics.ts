import type { Rng } from "./rng.js";
import { CARD_DEFS, RELIC_IDS } from "./cards/index.js";
import type { CardId } from "./cards/index.js";
import type { RunConfig } from "./config.js";
import type { RunProgress } from "./progress.js";
import type { SideState } from "./types.js";

/**
 * 2026-10-01 (the build-depth plan, "G. a pick at the start of the run", moved
 * by DECISIONS.md's relic-timing entries). The reward for the first win is a
 * choice of one relic from three — a small rule-bender that points the rest of
 * the run in a direction (Ember heart wants backfires, Hunter's eye wants
 * anything that reads exposed). Most relics are ordinary cards
 * (cards/defs/relic.ts) held in RunProgress.relic.
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

/** Puts the chosen relic into the run. A relic is just held; the roster comes back
 * unchanged (Wanderer, which used to add a squad spot here, was removed 2026-10-17). */
export function applyRelic(
  progress: RunProgress,
  roster: SideState,
  relic: CardId,
  _cfg: RunConfig,
): { progress: RunProgress; roster: SideState } {
  if (!CARD_DEFS[relic] || CARD_DEFS[relic].kind !== "relic") throw new Error(`applyRelic: "${relic}" is not a relic`);
  return { progress: { ...progress, relic }, roster };
}
