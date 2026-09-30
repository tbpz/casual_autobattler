/**
 * The pool of enemy SHAPES a round can draw — five bodies with no line to
 * break, one huge body, two offset slams, and so on. Each shape asks a
 * different question of a squad; sim/rounds.ts is what turns a shape into a
 * specific round's actual enemy (applying that round's own HP/damage scale
 * on top).
 *
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md): this
 * file used to own BOTH the shapes and the run's fixed 5-fight order/ramp
 * (`tier: "early"|"mid"|"finale"`, `encounterOrderFor`,
 * `makeEncounterEnemySide`'s own ramp-factor math). The run is now
 * `roundsPerRun` (20) rounds with mini-bosses and a boss, authored in
 * sim/rounds.ts's ROUND_PLAN — so `tier` is renamed to match the four kinds
 * of round a shape can fill (`filler`/`normal`/`miniboss`/`boss`), and the
 * draw order + ramp math both moved to rounds.ts. This file now owns only
 * the SHAPES and the pure builder (buildEnemySide) that turns a shape plus
 * an explicit scale into a SideState — rounds.ts is the only caller.
 *
 * Every number here is a strawman, same convention as config.ts and
 * roles.ts — meant to move by playing, not a final balance pass.
 */
import type { FightConfig } from "./config.js";
import type { HeroState, SideState } from "./types.js";

export interface EncounterBruiser {
  namePrefix: string;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  /** 0..1 phase into the first wind-up cycle — lets multiple bruisers in one
   * encounter (Twins) interleave their charges instead of firing in
   * lockstep. 0 = fires its first charge at the normal windupIntervalSec. */
  windupPhase?: number;
  windupTargeting: "weighted" | "lowestHp";
  /** Per-bruiser override of cfg.windupIntervalSec — e.g. Duelist's wind-up
   * landing twice as often. Undefined falls back to the shared cfg value. */
  windupIntervalSec?: number;
  /** Enemy support — this bruiser heals its own side's most-wounded living
   * body on its normal beat instead of attacking. */
  healPerBeat?: number;
}

/** Which of the four round shapes an encounter is eligible to fill — see
 * sim/rounds.ts's ROUND_PLAN. "filler" rounds are meant to be quick and
 * low-threat; "boss" is reserved for the run's final round. */
export type EncounterKind = "filler" | "normal" | "miniboss" | "boss";

export interface EncounterDef {
  name: string;
  /** One line for the round screen — "the question it asks," plain enough
   * to inform the squad-mix pick without reading like a strategy-guide
   * hint. */
  blurb: string;
  kind: EncounterKind;
  bruisers: EncounterBruiser[];
  gruntCount: number;
  gruntNamePrefix: string;
  gruntMaxHp: number;
  gruntDamage: number;
  gruntAttackIntervalSec: number;
}

export const ENCOUNTERS: EncounterDef[] = [
  {
    name: "Pack",
    blurb: "Five bodies, no line to break. Can you outlast the weight of numbers?",
    kind: "filler",
    bruisers: [],
    gruntCount: 5,
    gruntNamePrefix: "Skirmisher",
    gruntMaxHp: 48,
    gruntDamage: 5.8,
    gruntAttackIntervalSec: 0.9,
  },
  {
    name: "The Wall",
    blurb: "One huge body, nothing else. Can you kill it before the fight grinds you down?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Wall", maxHp: 310, damage: 16.4, attackIntervalSec: 1.2, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Twins",
    blurb: "Two slams, offset. Can you take both without a break?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Twin", maxHp: 150, damage: 11.2, attackIntervalSec: 1.15, windupPhase: 0, windupTargeting: "weighted" },
      { namePrefix: "Twin", maxHp: 150, damage: 11.2, attackIntervalSec: 1.15, windupPhase: 0.5, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Executioner",
    blurb: "Its slam goes straight for your weakest unit, tank or no tank. Can they survive?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Executioner", maxHp: 190, damage: 11.6, attackIntervalSec: 1.1, windupTargeting: "lowestHp" },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Guard",
    gruntMaxHp: 55,
    gruntDamage: 5.2,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Champion",
    blurb: "A mini-boss — everything the run has taught you so far, at once.",
    kind: "miniboss",
    bruisers: [
      { namePrefix: "Champion", maxHp: 230, damage: 11, attackIntervalSec: 1, windupTargeting: "weighted" },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Honor Guard",
    gruntMaxHp: 62,
    gruntDamage: 5,
    gruntAttackIntervalSec: 0.95,
  },
  {
    name: "Anvil",
    blurb: "One huge body, barely hits back. No slam to fear — how fast can you kill it?",
    kind: "filler",
    // No bruiser at all (a grunt, not a bruiser) is deliberate: this
    // encounter's whole point is "no wind-up, no telegraph, zero jeopardy" —
    // a pure DPS check. A bruiser entry always schedules a wind-up cycle
    // (see buildEnemySide below); a lone grunt never does.
    bruisers: [],
    gruntCount: 1,
    gruntNamePrefix: "Anvil",
    gruntMaxHp: 420,
    gruntDamage: 13.6,
    gruntAttackIntervalSec: 1.3,
  },
  {
    name: "Ambush",
    blurb: "Four fast, fragile bodies. Can a squad with no line still hold?",
    kind: "normal",
    bruisers: [],
    gruntCount: 4,
    gruntNamePrefix: "Raider",
    gruntMaxHp: 40,
    gruntDamage: 5.8,
    gruntAttackIntervalSec: 0.6,
  },
  {
    name: "Duelist",
    blurb: "Its slam lands twice as often. Can you take steady pressure, not just one big hit?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Duelist", maxHp: 200, damage: 19.8, attackIntervalSec: 1.1, windupTargeting: "weighted", windupIntervalSec: 2.5 },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Warden",
    blurb: "It heals as fast as you can hurt it. Can you burst through faster than it mends?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Warden", maxHp: 210, damage: 13.1, attackIntervalSec: 1.3, windupTargeting: "weighted", healPerBeat: 6 },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Acolyte",
    gruntMaxHp: 55,
    gruntDamage: 6.6,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Glass Pair",
    blurb: "Two glass cannons, high damage each. Can you drop the first before it costs you?",
    kind: "normal",
    bruisers: [
      { namePrefix: "Glass", maxHp: 90, damage: 19.6, attackIntervalSec: 1.4, windupPhase: 0, windupTargeting: "weighted" },
      { namePrefix: "Glass", maxHp: 90, damage: 19.6, attackIntervalSec: 1.4, windupPhase: 0.5, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Vanguard",
    blurb: "A mini-boss. Its slam goes for your weakest unit — and small hits keep changing who that is.",
    kind: "miniboss",
    bruisers: [
      { namePrefix: "Vanguard", maxHp: 240, damage: 6.6, attackIntervalSec: 1, windupTargeting: "lowestHp" },
    ],
    gruntCount: 3,
    gruntNamePrefix: "Outrider",
    gruntMaxHp: 50,
    gruntDamage: 3,
    gruntAttackIntervalSec: 0.7,
  },
  {
    name: "The Reckoning",
    blurb: "The boss. Everything the run has thrown at you, in one body, with no room left to learn on the fly.",
    kind: "boss",
    bruisers: [
      { namePrefix: "Reckoning", maxHp: 260, damage: 10, attackIntervalSec: 1, windupTargeting: "lowestHp", windupIntervalSec: 4.5 },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Herald",
    gruntMaxHp: 55,
    gruntDamage: 4.5,
    gruntAttackIntervalSec: 0.9,
  },
];

/** Direct lookup by ENCOUNTERS index (sim/rounds.ts's own drawn index —
 * never a fight-number guess to clamp). */
export function encounterAt(index: number): EncounterDef | null {
  return ENCOUNTERS[index] ?? null;
}

/** Every ENCOUNTERS index whose kind matches — sim/rounds.ts draws from this
 * per round. */
export function encounterIndicesOfKind(kind: EncounterKind): number[] {
  return ENCOUNTERS.map((_, i) => i).filter((i) => ENCOUNTERS[i]!.kind === kind);
}

/** Builds the enemy SideState for one authored encounter shape, scaled by
 * explicit hpScale/damageScale (sim/rounds.ts computes these per round — see
 * ROUND_PLAN). Pure: no RunConfig, no round-index math — that all lives in
 * rounds.ts now. Bruisers lead the roster so the player's front-targeting
 * attacks (fight.ts) reliably hit one first; a second bruiser (Twins, Glass
 * Pair) sits right after the first, both ahead of any grunts. */
export function buildEnemySide(fightCfg: FightConfig, encounter: EncounterDef, roundHpScale: number, damageScale: number): SideState {
  const hpScale = roundHpScale * fightCfg.enemyHpScale;
  const heroes: HeroState[] = [];
  encounter.bruisers.forEach((b, i) => {
    const windupIntervalSec = b.windupIntervalSec ?? fightCfg.windupIntervalSec;
    const phase = b.windupPhase ?? 0;
    heroes.push({
      id: `e${i}_bruiser`,
      name: encounter.bruisers.length > 1 ? `${b.namePrefix} ${i + 1}` : b.namePrefix,
      role: "bruiser",
      maxHp: b.maxHp * hpScale,
      hp: b.maxHp * hpScale,
      alive: true,
      damage: b.damage * damageScale,
      attackIntervalSec: b.attackIntervalSec,
      nextAttackT: b.attackIntervalSec,
      healPerBeat: b.healPerBeat,
      dealt: 0,
      soaked: 0,
      restored: 0,
      hitsTaken: 0,
      holding: false,
      charge: 0,
      // Enemies never chain (fight.ts only scans the player side for a
      // fire-ready hero) — fatigue is inert here.
      fatigue: 0,
      backfires: 0,
      nextWindupT: windupIntervalSec * (1 - phase),
      windupIntervalSec: b.windupIntervalSec,
      windupTargeting: b.windupTargeting,
    });
  });
  for (let i = 0; i < encounter.gruntCount; i++) {
    const phase = encounter.gruntCount > 0 ? i / encounter.gruntCount : 0;
    heroes.push({
      id: `e${heroes.length}_grunt`,
      name: encounter.gruntCount > 1 ? `${encounter.gruntNamePrefix} ${i + 1}` : encounter.gruntNamePrefix,
      role: "grunt",
      maxHp: encounter.gruntMaxHp * hpScale,
      hp: encounter.gruntMaxHp * hpScale,
      alive: true,
      damage: encounter.gruntDamage * damageScale,
      attackIntervalSec: encounter.gruntAttackIntervalSec,
      nextAttackT: encounter.gruntAttackIntervalSec * (1 - phase * 0.8),
      dealt: 0,
      soaked: 0,
      restored: 0,
      hitsTaken: 0,
      holding: false,
      charge: 0,
      fatigue: 0,
      backfires: 0,
    });
  }
  return { heroes, dpsBonus: 0 };
}
