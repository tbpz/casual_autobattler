import type { RunConfig } from "./config.js";
import type { HeroState, Role, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightResult } from "./events.js";
import { ROLE_SORT_PRIORITY } from "./roles.js";
import type { RunProgress } from "./progress.js";

/**
 * The run-level roster — units drafted over the course of the run (starting
 * at cfg.startingSlots, growing via a "recruit"/"slot" offer — see
 * sim/offers.ts), of which `progress.slots` are fielded each round. Every
 * round is always a fair fight, fielding a full squad — but the SET
 * answering it narrows if units die, permanently, and widens again if the
 * run offers a recruit.
 *
 * A RosterState has the exact same shape as a fight's SideState (heroes +
 * dpsBonus) — it's a wider one that persists across the whole run rather
 * than being rebuilt each round.
 */
export type RosterState = SideState;

/** Per-round context handed to a FieldPick alongside the roster — nothing
 * today reads it; it exists so a future fielding policy CAN key off which
 * round/encounter is next without another signature change. */
export interface FieldPickContext {
  fightIndex: number;
  encounterIndex: number;
}

/** A fielding policy: given the living roster and how many slots to fill,
 * returns the chosen unit ids. defaultFieldPick (below) is one instance of
 * this shape. Introduced so sim/run.ts's runRun can be handed an alternate
 * policy for measurement without touching the shipped accept-default path. */
export type FieldPick = (roster: RosterState, fieldSize: number, ctx: FieldPickContext) => string[];

const FIELD_ROLE_ORDER: Role[] = ["tank", "damage", "support"];

export function livingRosterHeroes(roster: RosterState): HeroState[] {
  return roster.heroes.filter((h) => h.alive);
}

/** Whether the roster can field a full squad for the next round — false
 * means the run ends here (roster exhausted). */
export function canFieldSquad(roster: RosterState, fieldSize: number): boolean {
  return livingRosterHeroes(roster).length >= fieldSize;
}

/** The accept-default squad-mix pick: one living unit per role in
 * tank -> damage -> support priority (ties broken by current HP fraction,
 * highest first), then fills any remaining slots from the rest of the
 * living roster by HP fraction. Keeps the minimum path Play -> watch -> Play
 * even as the roster grows or shrinks — the default adapts automatically. */
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

/** Stamps a role's current chain effect/level (RunProgress.chain — see
 * progress.ts) onto every unit of that role — 2026-09-23 (roles/rounds
 * rebuild): a chain upgrade belongs to the ROLE, not to one unit, so this is
 * what makes "upgrade Tank chain once" reach every tank already in the
 * roster, and every tank recruited after. Called on the FIELDED squad, right
 * before a fight — never on the persisted roster itself, so nothing needs
 * to be re-synced when an offer changes progress.chain later. */
function stampProgressOntoSquad(side: SideState, progress: RunProgress): SideState {
  return {
    ...side,
    heroes: side.heroes.map((h) => {
      const roleProgress = h.role === "tank" || h.role === "damage" || h.role === "support" ? progress.chain[h.role] : undefined;
      return roleProgress ? { ...h, chainEffects: roleProgress.effects, chainLevel: roleProgress.level } : h;
    }),
  };
}

/** Builds one round's SideState from the chosen roster members — copies (not
 * references) so fight.ts's cloneHeroes mutating the fight-local state never
 * touches the persisted roster. Sorted tank-first, and stamped with the
 * run's current per-role chain effect/level (see stampProgressOntoSquad
 * above). */
export function fieldSquad(roster: RosterState, fieldedIds: string[], progress: RunProgress): SideState {
  const byId = new Map(roster.heroes.map((h) => [h.id, h]));
  const heroes = fieldedIds
    .map((id) => byId.get(id))
    .filter((h): h is HeroState => !!h)
    .map((h) => ({ ...h }))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return stampProgressOntoSquad({ heroes, dpsBonus: roster.dpsBonus }, progress);
}

/**
 * Folds a round's outcome back into the persisted roster (only called after
 * a WIN — a loss ends the run before this runs). HP/alive/charge come from
 * the fight for whoever was fielded; a unit that wasn't fielded this round
 * is untouched by the fight itself. THEN recovery applies asymmetrically to
 * HP: a fielded unit gets cfg.autoRecoverFraction, a living benched unit
 * gets the higher cfg.benchedRecoverFraction — the rotation pressure that
 * makes the squad-mix pick a real decision. `charge` is untouched by the
 * recovery tick — it's a run-long resource, not HP.
 *
 * Death stays permanent — a roster unit whose hp hit 0 is marked !alive here
 * and never revives on its own (a "revive" offer is the only way back). The
 * dead unit is kept in the array (not spliced out) so the round screen can
 * still show "Tank 1 has fallen."
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
    if (!h.alive) return h; // already permanently dead — no-op, never revives on its own
    const wasFielded = fieldedIds.has(h.id);
    const final = wasFielded ? finalById.get(h.id) : undefined;
    const afterFight: HeroState = final ? { ...h, hp: final.hp, alive: final.alive, charge: final.charge } : h;
    if (!afterFight.alive) return afterFight; // just died this fight — no recovery tick
    const fraction = wasFielded ? cfg.autoRecoverFraction : cfg.benchedRecoverFraction;
    return { ...afterFight, hp: Math.min(afterFight.maxHp, afterFight.hp + afterFight.maxHp * fraction) };
  });
  return { heroes, dpsBonus: roster.dpsBonus };
}

/** Roster-wide HP reading (bench included) — the "how healthy is my whole
 * roster" figure the round/run screens show. */
export const rosterHp = sideHp;
export const rosterMaxHp = sideMaxHp;
