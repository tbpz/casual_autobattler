import type { HeroState, Role, SideState } from "./types.js";

/**
 * The single source of hero definitions — the squad-pick screen, the
 * pre-fight read, the headless batch harness, and the CLI all build player
 * sides from this pool so they can never drift onto different stat blocks.
 */
export interface HeroDef {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  healPerBeat?: number;
}

/**
 * Re-cut 2026-08-06 (see DECISIONS.md's "squad pick is the risk dial" entry):
 * comps now differ in HOW they fail, not just in total stats, and cadences
 * are staggered so a side's beats don't all land on the same tick. Bracer
 * (safe, slow) vs. Hollow (trades wall for damage) is the tank-side risk
 * knob; Rook (steady) vs. Vex (glass cannon) is the damage-side knob; Cairn
 * (strong safety net) vs. Ward (weaker heal) is the support-side knob.
 * Values are strawmen for the batch harness (npm run batch) to move.
 *
 * Known open tuning gap (2026-08-06): `npm run batch --squad tight` (Hollow)
 * currently shows a LOWER dip rate than `--squad comfortable` (Bracer) —
 * Hollow's higher damage shortens the fight enough to outweigh Bracer's
 * bigger buffer, so "tight" isn't yet reliably riskier than "comfortable"
 * the way its name implies. The comfortable-vs-greedy contrast (used by the
 * squad-pick screen's example verdicts) IS validated — greedy shows lower
 * run-completion and more deaths per run. Fully validating the three-tier
 * ordering is next-session work, not blocking: these are strawman
 * constants, meant to move by playing, same as everywhere else in this file.
 */
export const PLAYER_HERO_POOL: HeroDef[] = [
  { id: "bracer", name: "Bracer", role: "tank", maxHp: 280, damage: 5, attackIntervalSec: 1.4 },
  { id: "hollow", name: "Hollow", role: "tank", maxHp: 130, damage: 6, attackIntervalSec: 1.1 },
  { id: "rook", name: "Rook", role: "damage", maxHp: 85, damage: 6, attackIntervalSec: 0.9 },
  { id: "vex", name: "Vex", role: "damage", maxHp: 45, damage: 12, attackIntervalSec: 0.7 },
  { id: "cairn", name: "Cairn", role: "support", maxHp: 110, damage: 1, attackIntervalSec: 1.2, healPerBeat: 7 },
  { id: "ward", name: "Ward", role: "support", maxHp: 75, damage: 3, attackIntervalSec: 1.0, healPerBeat: 4 },
];

/** The working accept-default squad — the comfortable comp: one tank, one
 * damage, one support, none of them the greedy pick in their role. */
export const DEFAULT_PLAYER_ROSTER_IDS = ["bracer", "rook", "cairn"];

const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

export function findHeroDef(id: string): HeroDef {
  const def = PLAYER_HERO_POOL.find((h) => h.id === id);
  if (!def) throw new Error(`unknown hero id: ${id}`);
  return def;
}

export function makeHeroState(def: HeroDef, instanceId: string, phase = 0): HeroState {
  return {
    id: instanceId,
    name: def.name,
    role: def.role,
    maxHp: def.maxHp,
    hp: def.maxHp,
    alive: true,
    damage: def.damage,
    attackIntervalSec: def.attackIntervalSec,
    // phase in [0,1) spreads a side's first beats across one interval so
    // same-cadence heroes don't all act on the identical tick (2026-08-06 —
    // see DECISIONS.md's per-hero-bars entry for why simultaneous beats were
    // a legibility problem: six lunges/flinches firing in the same 250ms).
    nextAttackT: def.attackIntervalSec * (1 - phase * 0.8),
    healPerBeat: def.healPerBeat,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
  };
}

/** Builds the player SideState from chosen hero ids, sorted tank-first so the
 * tank draws the front-row visual slot (targeting itself is weighted-random —
 * see fight.ts — not positional, but the front row is still where a tank
 * "belongs" on screen). */
export function makePlayerSide(heroIds: string[] = DEFAULT_PLAYER_ROSTER_IDS, dpsBonus = 0): SideState {
  const heroes = heroIds
    .map((id, i) => makeHeroState(findHeroDef(id), `p${i}_${id}`, i / heroIds.length))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus };
}
