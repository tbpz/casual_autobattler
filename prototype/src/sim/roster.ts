import type { RunConfig } from "./config.js";
import type { HeroState, Role, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightResult } from "./events.js";
import { ROLE_SORT_PRIORITY } from "./heroes.js";

/**
 * The run-level roster (2026-08-09 "boring-middle" root-cause pass — see
 * config.ts's DeathPolicy-removal docstring for why this replaced
 * deathPolicy rather than sitting alongside it). rosterSize heroes (5) are
 * drafted once at run start; each fight fields exactly playerN (3) of the
 * LIVING roster. This is what turns the run's difficulty cliff into a curve
 * without softening death: every fight is always a fair fight, fielding a
 * full squad, never short-handed — but the SET of three answering it
 * narrows and degrades in quality as roster members die, permanently,
 * exactly as before.
 *
 * A RosterState has the exact same shape as a fight's SideState (heroes +
 * dpsBonus) — it's a wider one that persists across the whole run rather
 * than being rebuilt each fight. Reusing the type means sideHp/sideMaxHp and
 * heroes.ts's makePlayerSide work on a roster for free; makePlayerSide IS
 * how a roster gets built (pass 5 ids instead of 3).
 */
export type RosterState = SideState;

const FIELD_ROLE_ORDER: Role[] = ["tank", "damage", "support"];

export function livingRosterHeroes(roster: RosterState): HeroState[] {
  return roster.heroes.filter((h) => h.alive);
}

/** Whether the roster can field a full squad for the next fight — false
 * means the run ends here (roster exhausted), the new counterpart to a fight
 * LOSS ending the run. See run.ts's runRun. */
export function canFieldSquad(roster: RosterState, fieldSize: number): boolean {
  return livingRosterHeroes(roster).length >= fieldSize;
}

/** The accept-default field pick (2026-08-09): one living hero per role in
 * tank -> damage -> support priority (ties broken by current HP fraction,
 * highest first), then fills any remaining slots from the rest of the
 * living roster by HP fraction. This is what keeps the minimum path
 * Play -> watch -> Play even with a bench: the default adapts automatically
 * as the roster degrades, no player input required. Also the ONLY fielding
 * policy the headless batch harness uses — see run.ts's runRun — since batch
 * measures the accept-default path, same as it always has for the coin
 * spend. */
export function defaultFieldPick(roster: RosterState, fieldSize: number): string[] {
  const living = livingRosterHeroes(roster);
  const hpFrac = (h: HeroState) => (h.maxHp > 0 ? h.hp / h.maxHp : 0);
  const pickedIds = new Set<string>();
  const picked: string[] = [];

  for (const role of FIELD_ROLE_ORDER) {
    if (picked.length >= fieldSize) break;
    const best = living
      .filter((h) => h.role === role && !pickedIds.has(h.id))
      .sort((a, b) => hpFrac(b) - hpFrac(a))[0];
    if (best) {
      picked.push(best.id);
      pickedIds.add(best.id);
    }
  }
  if (picked.length < fieldSize) {
    const rest = living.filter((h) => !pickedIds.has(h.id)).sort((a, b) => hpFrac(b) - hpFrac(a));
    for (const h of rest) {
      if (picked.length >= fieldSize) break;
      picked.push(h.id);
      pickedIds.add(h.id);
    }
  }
  return picked;
}

/** Builds one fight's SideState from the chosen roster members — copies
 * (not references) so fight.ts's cloneHeroes mutating the fight-local state
 * never touches the persisted roster. Sorted tank-first, same convention as
 * heroes.ts's makePlayerSide, so the tank draws the front-row visual slot. */
export function fieldSquad(roster: RosterState, fieldedIds: string[]): SideState {
  const byId = new Map(roster.heroes.map((h) => [h.id, h]));
  const heroes = fieldedIds
    .map((id) => byId.get(id))
    .filter((h): h is HeroState => !!h)
    .map((h) => ({ ...h }))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus: roster.dpsBonus };
}

/**
 * Folds a fight's outcome back into the persisted roster (only called after
 * a WIN — a loss ends the run before this runs, same convention the old
 * applyFightResultToPlayer used). HP/alive come from the fight for whoever
 * was fielded; a hero that wasn't fielded this fight is untouched by the
 * fight itself. THEN recovery applies asymmetrically: a fielded hero gets
 * cfg.autoRecoverFraction, a living benched hero gets the higher
 * cfg.benchedRecoverFraction — the rotation pressure that makes the bench a
 * real decision (see config.ts's benchedRecoverFraction docstring).
 *
 * Death stays permanent — a roster hero whose hp hit 0 is marked !alive here
 * and never revives, exactly as the pre-2026-08-09 downAtFightEnd policy
 * did. Unlike that policy, the dead hero is kept in the array (not spliced
 * out) so a field-pick screen can still show "Cairn has fallen" instead of
 * the hero silently vanishing from the list.
 */
export function applyFightResultToRoster(
  roster: RosterState,
  fielded: SideState,
  result: FightResult,
  cfg: RunConfig,
): RosterState {
  const finalById = new Map(result.finalPlayerHeroes.map((h) => [h.id, h]));
  const fieldedIds = new Set(fielded.heroes.map((h) => h.id));
  const heroes = roster.heroes.map((h) => {
    if (!h.alive) return h; // already permanently dead — no-op, never revives
    const wasFielded = fieldedIds.has(h.id);
    const final = wasFielded ? finalById.get(h.id) : undefined;
    const afterFight: HeroState = final ? { ...h, hp: final.hp, alive: final.alive } : h;
    if (!afterFight.alive) return afterFight; // just died this fight — no recovery tick
    const fraction = wasFielded ? cfg.autoRecoverFraction : cfg.benchedRecoverFraction;
    return { ...afterFight, hp: Math.min(afterFight.maxHp, afterFight.hp + afterFight.maxHp * fraction) };
  });
  return { heroes, dpsBonus: roster.dpsBonus };
}

/** Roster-wide HP reading (bench included) — the "how healthy is my whole
 * draft" figure the run-complete/spend screens show, broader than any one
 * fight's per-hero recap. Thin re-export so callers don't need to remember
 * RosterState is just a SideState under the hood. */
export const rosterHp = sideHp;
export const rosterMaxHp = sideMaxHp;
