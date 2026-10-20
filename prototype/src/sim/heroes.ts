import type { ChainEffect, RunConfig } from "./config.js";
import type { HeroKind, HeroState } from "./types.js";
import type { RunProgress } from "./progress.js";
import type { RosterState } from "./roster.js";
import { PLAYER_ROLES, ROLE_LABEL, ROLE_POOL, type PlayerRole } from "./roles.js";

/**
 * The ten merge heroes (2026-10-20, branch dev/merge-heroes; DECISIONS.md 2026-10-19): three basic units
 * (Tank, Damage, Healer) merge into one hero and leave the squad. Every recipe is open from round 1; which
 * ones a run can reach depends on the units the offers bring. A hero has a GIFT (always on, read off
 * `HeroState.hero` by fight.ts) and a SKILL (its own `chainEffects`, a chain like any other).
 *
 * The stat blocks are the made-up figures drawn on canvas 8.x (design/tools/gen-heroes.js) — strawmen meant to
 * move by playing, same convention as ROLE_POOL. Gift and skill numbers live in FightConfig (config.ts).
 *
 * An older, unrelated sim/heroes.ts held the six named heroes of the pre-2026-09-23 game; that file is gone.
 */

export interface HeroDef {
  kind: HeroKind;
  name: string;
  /** The three pieces, in the order the pick screen lists them. */
  recipe: [PlayerRole, PlayerRole, PlayerRole];
  /** The role most of its pieces had (the Twin: Damage). Role-wide stat offers, the tank rules and
   * fielding order read this. */
  role: PlayerRole;
  maxHp: number;
  damage: number;
  healPerBeat?: number;
  /** The skill's chain ability. The Twin has none of its own (it copies a neighbour's, sim/roster.ts). */
  skill: ChainEffect | null;
}

/** The ten heroes, in the order the merge pick lists them (also the bot's order). */
export const HERO_ORDER: HeroKind[] = [
  "golem",
  "berserker",
  "paladin",
  "assassin",
  "dragon",
  "necromancer",
  "priest",
  "treant",
  "vampire",
  "twin",
];

export const HERO_POOL: Record<HeroKind, HeroDef> = {
  golem: { kind: "golem", name: "Golem", recipe: ["tank", "tank", "tank"], role: "tank", maxHp: 480, damage: 9, skill: "fortify" },
  // Berserker's 14 base damage is what the canvas shows lifted to 22 at 150 of 330 HP (Rage).
  berserker: { kind: "berserker", name: "Berserker", recipe: ["tank", "tank", "damage"], role: "tank", maxHp: 330, damage: 14, skill: "cleave" },
  paladin: { kind: "paladin", name: "Paladin", recipe: ["tank", "tank", "support"], role: "tank", maxHp: 350, damage: 8, skill: "bless" },
  assassin: { kind: "assassin", name: "Assassin", recipe: ["damage", "damage", "damage"], role: "damage", maxHp: 170, damage: 20, skill: "execute" },
  // Baby stats; roster.ts grows it a stage per cfg.heroDragonWinsPerStage wins.
  dragon: { kind: "dragon", name: "Dragon", recipe: ["damage", "damage", "tank"], role: "damage", maxHp: 120, damage: 10, skill: "breath" },
  necromancer: { kind: "necromancer", name: "Necromancer", recipe: ["damage", "damage", "support"], role: "damage", maxHp: 150, damage: 6, skill: "horde" },
  priest: { kind: "priest", name: "Priest", recipe: ["support", "support", "support"], role: "support", maxHp: 230, damage: 2, healPerBeat: 14, skill: "prayer" },
  treant: { kind: "treant", name: "Treant", recipe: ["support", "support", "tank"], role: "support", maxHp: 300, damage: 2, healPerBeat: 10, skill: "bloom" },
  vampire: { kind: "vampire", name: "Vampire", recipe: ["support", "support", "damage"], role: "support", maxHp: 180, damage: 12, skill: "bite" },
  twin: { kind: "twin", name: "Twin", recipe: ["tank", "damage", "support"], role: "damage", maxHp: 190, damage: 8, skill: null },
};

/** The words a hero's gift and skill are described with, shared by the merge pick, the popup and the
 * cards. Plain English; `{shield}` and `{slam}` are the usual term marks. Ported from
 * design/tools/gen-heroes.js (which stays the source for the canvas frames). */
export interface HeroText {
  /** One line on the pick row: what the hero is. */
  job: string;
  giftName: string;
  giftHead: string;
  giftLine: string;
  skillName: string;
  skillHead: string;
  skillChips: string[];
  skillLines: [string, string];
}

export const HERO_TEXT: Record<HeroKind, HeroText> = {
  golem: {
    job: "Three Tanks in one wall. Every enemy hit lands on it.",
    giftName: "Taunt",
    giftHead: "Every enemy hit lands on the Golem.",
    giftLine: "{slam}s too, and the enemies that normally reach your back row.",
    skillName: "Fortify",
    skillHead: "Wraps itself in a big {shield}.",
    skillChips: ["Itself", "sh:Shield"],
    skillLines: ["{shield} worth 40% of its max HP.", "Each time it goes again, the {shield} grows."],
  },
  berserker: {
    job: "Two Tanks and a Damage unit. Stands in front and hits harder the more it is hurt.",
    giftName: "Rage",
    giftHead: "The more hurt it is, the harder it hits.",
    giftLine: "+1% damage for every 1% of HP missing. At 20% HP it hits 80% harder.",
    skillName: "Cleave",
    skillHead: "A big swing at the front enemy.",
    skillChips: ["Front enemy"],
    skillLines: ["Hits for 2.5 times its damage.", "Each time it goes again, the swing is bigger."],
  },
  paladin: {
    job: "Two Tanks and a Healer. Every hit it takes heals the rest of the squad.",
    giftName: "Martyr",
    giftHead: "Every hit it takes heals your other units a little.",
    giftLine: "3 HP to each other unit, for every hit it takes.",
    skillName: "Bless",
    skillHead: "Gives every unit a {shield}.",
    skillChips: ["Whole squad", "sh:Shield"],
    skillLines: ["{shield} worth 8% of each unit's max HP.", "Each time it goes again, every unit gets another."],
  },
  assassin: {
    job: "Three Damage units in one blade. Every kill charges its skill at once.",
    giftName: "Bloodlust",
    giftHead: "Every kill fills its skill bar at once.",
    giftLine: "An enemy dying means it strikes again right away.",
    skillName: "Execute",
    skillHead: "A heavy strike on the weakest enemy.",
    skillChips: ["Weakest enemy"],
    skillLines: ["Hits for 3 times its damage.", "A kill from it fills the bar again."],
  },
  dragon: {
    job: "Two Damage units and a Tank. Starts as a baby and grows.",
    giftName: "Growth",
    giftHead: "Grows a stage every 4 fights it wins.",
    giftLine: "Baby, Young, Adult, Elder: bigger, tougher, harder hitting. Resting it stops its growth.",
    skillName: "Breath",
    skillHead: "Breathes on the enemy.",
    skillChips: ["Front enemy, then all"],
    skillLines: ["A Baby hits one enemy. From Adult, it hits every enemy.", "If the Dragon falls, all its growth is lost."],
  },
  necromancer: {
    job: "Two Damage units and a Healer. Everyone who dies fights for it.",
    giftName: "Raise",
    giftHead: "Anyone who dies, yours or theirs, rises as a skeleton.",
    giftLine: "It fights on your side until the fight ends. At most 4 at once.",
    skillName: "Horde",
    skillHead: "Every skeleton strikes at once.",
    skillChips: ["Every skeleton"],
    skillLines: ["Each skeleton hits the front enemy for 8.", "Each time it goes again, the whole army swings again."],
  },
  priest: {
    job: "Three Healers in one. Every heal also hurts the front enemy.",
    giftName: "Radiance",
    giftHead: "Each heal also hits the front enemy for the same amount.",
    giftLine: "Heals 14, and the front enemy takes 14.",
    skillName: "Prayer",
    skillHead: "Heals every unit.",
    skillChips: ["Whole squad"],
    skillLines: ["Heals 14 each.", "The front enemy is hit once for every unit healed."],
  },
  treant: {
    job: "Two Healers and a Tank. Its healing grows as the fight goes on.",
    giftName: "Rooted",
    giftHead: "Its healing grows every second of the fight.",
    giftLine: "Heals 3 at the start of a fight, 10 after 25 seconds.",
    skillName: "Bloom",
    skillHead: "Heals every unit.",
    skillChips: ["Whole squad"],
    skillLines: ["Heals what Rooted has grown to.", "A long fight makes it a big heal."],
  },
  vampire: {
    job: "Two Healers and a Damage unit. Every hit your squad lands heals the one who landed it.",
    giftName: "Leech",
    giftHead: "Every hit your squad lands heals the unit that landed it.",
    giftLine: "A little each time: 1 HP per hit.",
    skillName: "Bite",
    skillHead: "Bites the strongest enemy and heals the squad.",
    skillChips: ["Strongest enemy", "Heals the squad"],
    skillLines: ["Hits for 2 times its damage.", "The squad is healed for what it dealt, shared out."],
  },
  twin: {
    job: "One Tank, one Damage unit and one Healer. Copies the skill of the unit next to it.",
    giftName: "Mirror",
    giftHead: "Copies the skill of the unit next to it in the back row.",
    giftLine: "Alone in the back, it copies the front unit.",
    skillName: "Echo",
    skillHead: "Uses whatever skill it copied.",
    skillChips: ["The copied skill"],
    skillLines: ["Next to a Damage unit it uses Expose. Next to a Healer, Mend.", "It charges on its own, so both of them fire."],
  },
};

/** The ability word a unit's skill goes by in a bubble or popup: a hero's own name for it, else the first
 * of its chain abilities. */
export function heroSkillName(kind: HeroKind): string {
  return HERO_TEXT[kind].skillName;
}

/** Whether a unit stands in the front row. A basic unit: only the Tank. A hero: two or more of its pieces
 * were Tanks (Golem, Berserker, Paladin). */
export function isFrontRow(h: Pick<HeroState, "role" | "hero" | "madeFrom">): boolean {
  if (h.hero && h.madeFrom) return h.madeFrom.filter((r) => r === "tank").length >= 2;
  return h.role === "tank";
}

/** A Dragon's stage from its fight wins: 0 Baby, 1 Young, 2 Adult, 3 Elder (capped). */
export function dragonStage(wins: number, cfg: RunConfig): number {
  return Math.min(3, Math.floor(Math.max(0, wins) / Math.max(1, cfg.heroDragonWinsPerStage)));
}

export const DRAGON_STAGE_NAMES = ["Baby", "Young", "Adult", "Elder"] as const;

/** Builds a fresh hero at full health and no fatigue. `bonus` is the run's earned stat bonus for the
 * hero's main role, baked in once, same as makeUnitState. */
export function makeHeroState(kind: HeroKind, bonus: { maxHp: number; damage: number }): HeroState {
  const def = HERO_POOL[kind];
  const role = ROLE_POOL[def.role];
  const maxHp = def.maxHp + bonus.maxHp;
  return {
    id: `hero_${kind}`,
    name: def.name,
    role: def.role,
    maxHp,
    hp: maxHp,
    alive: true,
    damage: def.damage + bonus.damage,
    attackIntervalSec: role.attackIntervalSec,
    nextAttackT: role.attackIntervalSec,
    healPerBeat: def.healPerBeat,
    fatigue: 0,
    backfires: 0,
    // The Twin's real list is copied from its neighbour at squad-build time; "guard" is what it uses alone.
    chainEffects: [def.skill ?? "guard"],
    chainLevel: 1,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
    charge: 0,
    hero: kind,
    madeFrom: [...def.recipe],
    ...(kind === "dragon" ? { heroWins: 0, heroStage: 0 } : {}),
  };
}

/** A Dragon back at Baby: what a revive does to one (its growth is lost when it falls). */
export function resetDragon(h: HeroState, bonus: { maxHp: number; damage: number }): HeroState {
  const def = HERO_POOL.dragon;
  const maxHp = def.maxHp + bonus.maxHp;
  return { ...h, maxHp, hp: Math.min(h.hp, maxHp), damage: def.damage + bonus.damage, heroWins: 0, heroStage: 0 };
}

/** One merge the player can take: the hero, and the three units the game would use for it. */
export interface MergeOption {
  kind: HeroKind;
  ingredientIds: string[];
}

/** The units a recipe would use: for each piece the most worn living basic unit of that role (most tired
 * first, then the more hurt, then roster order), never a hero. Undefined when the roster lacks a piece. */
export function pickIngredients(roster: RosterState, recipe: readonly PlayerRole[]): string[] | undefined {
  const taken = new Set<string>();
  const ids: string[] = [];
  for (const role of recipe) {
    const pick = roster.heroes
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.alive && !h.hero && h.role === role && !taken.has(h.id))
      .sort((a, b) => b.h.fatigue - a.h.fatigue || a.h.hp / a.h.maxHp - b.h.hp / b.h.maxHp || a.i - b.i)[0];
    if (!pick) return undefined;
    taken.add(pick.h.id);
    ids.push(pick.h.id);
  }
  return ids;
}

/**
 * Every hero the roster can merge right now (2026-10-20): the recipe's three pieces are living basic units,
 * that hero is not already in the roster (one of each kind per run), and the merge leaves enough living
 * units to fill every fighting slot (`progress.slots`) — three go, one comes, so a merge needs a spare unit
 * beyond the squad. Empty when cfg.mergeEnabled is 0. In HERO_ORDER.
 */
export function mergeCandidates(progress: RunProgress, roster: RosterState, cfg: RunConfig): MergeOption[] {
  if (!cfg.mergeEnabled) return [];
  const living = roster.heroes.filter((h) => h.alive).length;
  if (living - 3 + 1 < progress.slots) return [];
  const out: MergeOption[] = [];
  for (const kind of HERO_ORDER) {
    if (roster.heroes.some((h) => h.hero === kind)) continue;
    const ingredientIds = pickIngredients(roster, HERO_POOL[kind].recipe);
    if (ingredientIds) out.push({ kind, ingredientIds });
  }
  return out;
}

/** Applies a merge: the three ingredient units leave the roster and the hero joins it at the end, fresh. */
export function applyMerge(progress: RunProgress, roster: RosterState, option: MergeOption): RosterState {
  const leaving = new Set(option.ingredientIds);
  const hero = makeHeroState(option.kind, progress.bonus[HERO_POOL[option.kind].role]);
  return { ...roster, heroes: [...roster.heroes.filter((h) => !leaving.has(h.id)), hero] };
}

/** "Bram, Rex and Ivy": the names of the units a merge uses, for the pick screen. */
export function ingredientNames(roster: RosterState, option: MergeOption): string[] {
  return option.ingredientIds.map((id) => roster.heroes.find((h) => h.id === id)?.name ?? id);
}

/** Which recipes one more unit of `role` would newly make possible, for a Recruit offer's "Completes X"
 * line. Counts only living basic units; skips heroes already made. */
export function recipesCompletedBy(roster: RosterState, role: PlayerRole): HeroKind[] {
  const have: Record<PlayerRole, number> = { tank: 0, damage: 0, support: 0 };
  for (const h of roster.heroes) if (h.alive && !h.hero && PLAYER_ROLES.includes(h.role as PlayerRole)) have[h.role as PlayerRole]++;
  const need = (recipe: readonly PlayerRole[], counts: Record<PlayerRole, number>): boolean =>
    PLAYER_ROLES.every((r) => recipe.filter((x) => x === r).length <= counts[r]);
  const after = { ...have, [role]: have[role] + 1 };
  return HERO_ORDER.filter(
    (kind) =>
      !roster.heroes.some((h) => h.hero === kind) &&
      !need(HERO_POOL[kind].recipe, have) &&
      need(HERO_POOL[kind].recipe, after),
  );
}

/** A role's plain label, re-exported so the pick screen needs one import. */
export { ROLE_LABEL };
