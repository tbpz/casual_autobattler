import type { ChainEffect } from "./config.js";
import type { ArmyKind, HeroState, SideState, UnitKind } from "./types.js";
import { PLAYER_ROLES, ROLE_LABEL, ROLE_POOL, makeUnitState, type PlayerRole } from "./roles.js";

/**
 * The armies (2026-10-20; canvas 10.x and 11.x, design/tools/gen-armies.js; DECISIONS.md once Tu confirms): a run picks Undead
 * or Beasts before round 1 and every unit is re-skinned into it. An army unit keeps its `role` (tank, damage or support), so the
 * tank lock, the front and back rows, the offers and every rune that reads a role work as before. What the army changes is the
 * unit's name, look, stats and its base skill (in the place of Guard, Expose or Mend), plus one rule for the whole squad:
 *   Undead, Undying: a unit gets back up once per fight (fight.ts's applyDamageFrom), then hits harder.
 *   Beasts, Pack: five units are fielded instead of three, and every hit a Beast lands fills the others' skill bars a little.
 * Merge heroes (sim/heroes.ts) are off while an army is picked. Every number is a made-up first take, like ROLE_POOL's.
 */

export const ARMY_ORDER: ArmyKind[] = ["undead", "beasts"];

export interface ArmyUnitDef {
  kind: UnitKind;
  role: PlayerRole;
  /** What the unit is called, where a plain unit shows "Tank" / "Damage" / "Healer". */
  title: string;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  healPerBeat?: number;
  /** The unit's base skill, in the place of its role's Guard / Expose / Mend. */
  baseChain: ChainEffect;
}

export const ARMY_UNITS: Record<ArmyKind, Record<PlayerRole, ArmyUnitDef>> = {
  undead: {
    tank: { kind: "boneKnight", role: "tank", title: "Bone Knight", maxHp: 145, damage: 7, attackIntervalSec: 1.3, baseChain: "graveGuard" },
    damage: { kind: "wraith", role: "damage", title: "Wraith", maxHp: 60, damage: 8, attackIntervalSec: 1.1, baseChain: "soulBolt" },
    support: { kind: "bonePriest", role: "support", title: "Bone Priest", maxHp: 76, damage: 2, attackIntervalSec: 1.1, healPerBeat: 4, baseChain: "bloodRite" },
  },
  beasts: {
    tank: { kind: "bear", role: "tank", title: "Bear", maxHp: 140, damage: 5, attackIntervalSec: 1.3, baseChain: "roar" },
    damage: { kind: "wolf", role: "damage", title: "Wolf", maxHp: 60, damage: 6, attackIntervalSec: 1.1, baseChain: "packBite" },
    support: { kind: "stag", role: "support", title: "Stag", maxHp: 72, damage: 2, attackIntervalSec: 1.1, healPerBeat: 3, baseChain: "herd" },
  },
};

/** The roles an army starts with, in roster order (Beasts: 7 units, five fielded and two on the bench). The default squad takes one of each role
 * first, then fills in roster order, so a Beasts run fields a Bear, three Wolves and a Stag and benches a Bear and a Stag. */
export const ARMY_START_ORDER: Record<ArmyKind, PlayerRole[]> = {
  undead: ["tank", "damage", "support", "tank", "damage", "support"],
  beasts: ["tank", "damage", "support", "damage", "damage", "tank", "support"],
};

export function armyUnitDef(army: ArmyKind, role: PlayerRole): ArmyUnitDef {
  return ARMY_UNITS[army][role];
}

/** A role's base skill: the army's own when one is picked, else the plain Guard / Expose / Mend. */
export function baseChainFor(role: PlayerRole, army?: ArmyKind): ChainEffect {
  return army ? ARMY_UNITS[army][role].baseChain : ROLE_POOL[role].baseChain;
}

/** What a unit of `role` is called: its army title, else the plain role word. */
export function roleLabelFor(role: PlayerRole, army?: ArmyKind): string {
  return army ? ARMY_UNITS[army][role].title : ROLE_LABEL[role];
}

/** The word under a unit on a screen: its army title, else its role word. */
export function unitTitle(u: { role: string; kind?: UnitKind }): string {
  if (u.kind) {
    for (const army of ARMY_ORDER) for (const role of PLAYER_ROLES) if (ARMY_UNITS[army][role].kind === u.kind) return ARMY_UNITS[army][role].title;
  }
  return u.role in ROLE_LABEL ? ROLE_LABEL[u.role as PlayerRole] : u.role;
}

/** Every army title, for the name draw (sim/roles.ts's nameUnits renames a unit still called "Wolf 2"). */
export const ARMY_TITLES: string[] = ARMY_ORDER.flatMap((a) => PLAYER_ROLES.map((r) => ARMY_UNITS[a][r].title));

/** A fresh, full-health unit of an army. The same shape as sim/roles.ts's makeUnitState, with the army's name, stats and base skill. */
export function makeArmyUnit(army: ArmyKind, role: PlayerRole, ordinal: number, instanceId: string, bonus: { maxHp: number; damage: number }): HeroState {
  const def = ARMY_UNITS[army][role];
  const base = makeUnitState(role, ordinal, instanceId, bonus);
  const maxHp = def.maxHp + bonus.maxHp;
  const unit: HeroState = {
    ...base,
    name: `${def.title} ${ordinal}`,
    maxHp,
    hp: maxHp,
    damage: def.damage + bonus.damage,
    attackIntervalSec: def.attackIntervalSec,
    nextAttackT: def.attackIntervalSec,
    chainEffects: [def.baseChain],
    army,
    kind: def.kind,
  };
  if (def.healPerBeat !== undefined) unit.healPerBeat = def.healPerBeat;
  else delete unit.healPerBeat;
  return unit;
}

/** An army's starting roster, in the order of sim/roles.ts's makeStartingRoster (one of each role, then again). */
export function makeArmyRoster(army: ArmyKind, bonus: Record<PlayerRole, { maxHp: number; damage: number }>): SideState {
  const heroes: HeroState[] = [];
  const seen: Record<PlayerRole, number> = { tank: 0, damage: 0, support: 0 };
  for (const role of ARMY_START_ORDER[army]) {
    seen[role] += 1;
    heroes.push(makeArmyUnit(army, role, seen[role], `u${heroes.length}_${role}`, bonus[role]));
  }
  return { heroes, dpsBonus: 0 };
}

/** The unit a new recruit of `role` is, in a run with `army` (or the plain unit). */
export function makeUnitFor(army: ArmyKind | undefined, role: PlayerRole, ordinal: number, instanceId: string, bonus: { maxHp: number; damage: number }): HeroState {
  return army ? makeArmyUnit(army, role, ordinal, instanceId, bonus) : makeUnitState(role, ordinal, instanceId, bonus);
}

/** The words an army and its units are described with, shared by the pick screen, the popup and the cards. `{slam}` and `{exposed}` are
 * the usual term marks. Ported from design/tools/gen-armies.js (which stays the source for the canvas frames). */
export interface ArmyText {
  name: string;
  /** One line under the name on the pick screen. */
  pitch: string;
  ruleName: string;
  ruleHead: string;
  ruleLines: [string, string];
  /** The rule as the explain card writes it. */
  ruleCard: string;
}

export const ARMY_TEXT: Record<ArmyKind, ArmyText> = {
  undead: {
    name: "Undead",
    pitch: "Fall once. Rise stronger.",
    ruleName: "Undying",
    ruleHead: "Every unit gets back up once per fight.",
    ruleLines: ["It rises at half HP and hits 50% harder for the rest of the fight.", "Healing is weaker: falling is part of the plan."],
    ruleCard: "Every unit gets back up once per fight, at half HP, and hits 50% harder after. Healing is weaker, because falling is part of the plan.",
  },
  beasts: {
    name: "Beasts",
    pitch: "Five small units. Skills all the time.",
    ruleName: "Pack",
    ruleHead: "You field 5 beasts instead of 3.",
    ruleLines: ["Each beast is smaller and weaker.", "Every hit one lands fills every other beast's skill bar a little."],
    ruleCard: "You field 5 beasts instead of 3. Each beast is smaller and weaker, but every hit one lands fills every other beast's skill bar a little, so skills go off all the time.",
  },
};

export interface UnitText {
  title: string;
  /** The line under the name in the popup. */
  job: string;
  skillName: string;
  skillHead: string;
  skillChips: string[];
  skillLines: [string, string];
  /** The skill as the explain card writes it. */
  skillCard: string;
}

export const UNIT_TEXT: Record<UnitKind, UnitText> = {
  boneKnight: {
    title: "Bone Knight", job: "The Undead Tank. Stands in front and takes the hits. Gets back up once.",
    skillName: "Grave Guard", skillHead: "Takes the next {slam} for the squad.", skillChips: ["Next slam"],
    skillLines: ["Takes 1 slam for each time it goes again.", "If a slam knocks it down, it stands up at once, and Undying is still ready."],
    skillCard: "Takes the next {slam} for the squad. If that slam knocks it down, it stands up at once and Undying is still ready.",
  },
  wraith: {
    title: "Wraith", job: "The Undead Damage unit. Hits harder with every unit of yours that has risen.",
    skillName: "Soul Bolt", skillHead: "A bolt at the biggest enemy, which it exposes.", skillChips: ["Biggest enemy"],
    skillLines: ["Hits for 17, and 9 more for each of your units that has risen this fight.", "Each time it goes again, the bolt is bigger."],
    skillCard: "Hits the biggest enemy for 17, and 9 more for each of your units that has risen this fight, and exposes it. Each time it goes again, the bolt is bigger.",
  },
  bonePriest: {
    title: "Bone Priest", job: "The Undead Healer. Heals a little, and pays its own HP to do it.",
    skillName: "Blood Rite", skillHead: "Pays its own HP to heal everyone else.", skillChips: ["Whole squad", "Costs 20 HP"],
    skillLines: ["Loses 20 HP and heals every other unit 12.", "Each time it goes again, it pays and heals again."],
    skillCard: "Loses 20 HP and heals every other unit 12. Undying makes the price safe: if it falls, it gets up.",
  },
  bear: {
    title: "Bear", job: "The Beast Tank. Stands in front and rallies the pack.",
    skillName: "Roar", skillHead: "Takes the next {slam} and rallies the pack.", skillChips: ["Next slam", "Whole pack"],
    skillLines: ["The first time it goes, every other beast's skill bar fills 25%.", "Each time it goes again, it takes one more slam."],
    skillCard: "Takes the next {slam} for the pack, and every other beast's skill bar fills 25%.",
  },
  wolf: {
    title: "Wolf", job: "The Beast Damage unit. Bites more with other Wolves beside it.",
    skillName: "Pack Bite", skillHead: "Bites the front enemy, with the pack.", skillChips: ["Front enemy"],
    skillLines: ["Bites for 6, once more for each other Wolf in the squad: 3 Wolves, 18.", "Each time it goes again, every bite is bigger."],
    skillCard: "Bites the front enemy for 6, once more for each other Wolf in the squad. Three Wolves bite for 18.",
  },
  stag: {
    title: "Stag", job: "The Beast Healer. Heals more the bigger the pack is.",
    skillName: "Herd", skillHead: "Heals every unit, more for a bigger pack.", skillChips: ["Whole squad"],
    skillLines: ["Heals each unit 1 for every beast in the squad: 5 beasts, 5 HP each.", "Each time it goes again, it heals again."],
    skillCard: "Heals every unit 1 for every beast in the squad. With 5 beasts, each unit gets 5 HP.",
  },
};

/** The unit kind of an army's role. */
export function kindOf(army: ArmyKind, role: PlayerRole): UnitKind {
  return ARMY_UNITS[army][role].kind;
}

/** Whether a unit is an army unit of `army` (Undying and Pack read this). */
export function isArmyUnit(h: Pick<HeroState, "army">, army: ArmyKind): boolean {
  return h.army === army;
}
