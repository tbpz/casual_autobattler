/**
 * The run's five fights, authored (2026-08-09 boring-middle root-cause
 * pass — see DECISIONS.md's entry on this pass, and STATE.md's RC3):
 * replaces the old single scaled "bruiser + (n-1) grunts, only bigger" with
 * five encounters that each ask a different question. Measured before this
 * pass: fight 1 was a 100% win for all 20 possible squads, fight 2 >=97%
 * for all 20, fight 3 >=91% for 18 of 20 — a single fixed threat shape
 * against additive hero stats has exactly one optimum, so no fight asked a
 * different question and no squad needed to be a different answer. Varying
 * the SHAPE of the threat (not just its size) is what makes the run-level
 * draft (squadPickScreen.ts) and the per-fight field pick
 * (fieldPickScreen.ts) into a real puzzle: a squad built for fight 3
 * (Twins — two telegraphed spikes) can be exactly wrong for fight 4
 * (Executioner — hunts your squishiest body).
 *
 * Every number here is a strawman, same convention as config.ts and
 * heroes.ts — meant to move by playing and by the batch harness
 * (`npm run batch`), not a final balance pass.
 */
import type { RunConfig } from "./config.js";
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
}

export interface EncounterDef {
  name: string;
  /** One line for the field-pick screen — "the question it asks," stated
   * plainly enough to inform the fielding choice without reading like a
   * strategy-guide hint. */
  blurb: string;
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
    bruisers: [],
    gruntCount: 5,
    gruntNamePrefix: "Skirmisher",
    gruntMaxHp: 48,
    gruntDamage: 3.6,
    gruntAttackIntervalSec: 0.9,
  },
  {
    name: "The Wall",
    blurb: "One huge body, nothing else. Can you kill it before the fight grinds you down?",
    bruisers: [
      { namePrefix: "Wall", maxHp: 310, damage: 10, attackIntervalSec: 1.2, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Twins",
    blurb: "Two telegraphed spikes, offset. Can you absorb both without a break?",
    bruisers: [
      { namePrefix: "Twin", maxHp: 150, damage: 8.5, attackIntervalSec: 1.15, windupPhase: 0, windupTargeting: "weighted" },
      { namePrefix: "Twin", maxHp: 150, damage: 8.5, attackIntervalSec: 1.15, windupPhase: 0.5, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Executioner",
    blurb: "The wind-up hunts your lowest-HP hero directly, tank aggro or not. Can your squishies survive?",
    bruisers: [
      { namePrefix: "Executioner", maxHp: 190, damage: 10, attackIntervalSec: 1.1, windupTargeting: "lowestHp" },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Guard",
    gruntMaxHp: 55,
    gruntDamage: 4.5,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Champion",
    blurb: "The finale — everything the run has taught you, at once.",
    bruisers: [
      { namePrefix: "Champion", maxHp: 230, damage: 11, attackIntervalSec: 1, windupTargeting: "weighted" },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Honor Guard",
    gruntMaxHp: 62,
    gruntDamage: 5,
    gruntAttackIntervalSec: 0.95,
  },
];

/** Clamps to the LAST authored entry beyond ENCOUNTERS.length (same
 * clamp-to-last convention config.ts's prdLookup uses) rather than throwing
 * — makeEncounterEnemySide still scales by the UN-clamped fightIndex, so an
 * out-of-range index (e.g. a batch-tuning fixture deliberately asking for
 * "fight 10") still returns Champion's shape scaled harder, not an error. */
export function encounterFor(fightIndex: number): EncounterDef | null {
  if (ENCOUNTERS.length === 0) return null;
  const idx = Math.min(Math.max(fightIndex, 0), ENCOUNTERS.length - 1);
  return ENCOUNTERS[idx] ?? null;
}

export function encounterNameFor(fightIndex: number): string | null {
  return encounterFor(fightIndex)?.name ?? null;
}

export function encounterBlurbFor(fightIndex: number): string | null {
  return encounterFor(fightIndex)?.blurb ?? null;
}

/** Builds the enemy SideState for fightIndex's authored encounter, scaled by
 * RunConfig's global ramp factors (kept as a batch-tuning multiplier on top
 * of the authored shape — see config.ts's difficultyRampFactor docstring,
 * 2026-08-09 update) — the SHAPE comes from the table above, the residual
 * fight-over-fight escalation still comes from the same exponential ramp
 * every other fight used. Bruisers lead the roster so the player's
 * front-targeting attacks (fight.ts) reliably hit one first; Twins'
 * second bruiser sits right after the first, both ahead of any grunts. */
export function makeEncounterEnemySide(cfg: RunConfig, fightIndex: number): SideState {
  const encounter = encounterFor(fightIndex);
  if (!encounter) {
    throw new Error(`no encounter authored for fight index ${fightIndex} (ENCOUNTERS has ${ENCOUNTERS.length} entries)`);
  }
  const hpScale = Math.pow(cfg.difficultyRampFactor, fightIndex);
  const damageScale = Math.pow(cfg.difficultyDamageRampFactor, fightIndex);

  const heroes: HeroState[] = [];
  encounter.bruisers.forEach((b, i) => {
    const windupIntervalSec = cfg.fight.windupIntervalSec;
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
      dealt: 0,
      soaked: 0,
      restored: 0,
      hitsTaken: 0,
      holding: false,
      charge: 0,
      // Enemies never chain (fight.ts only scans the player side for a
      // fire-ready hero) — inert, set to 1 (a no-op multiplier) so nothing
      // downstream divides by zero.
      chainAffinity: 1,
      nextWindupT: windupIntervalSec * (1 - phase),
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
      chainAffinity: 1,
    });
  }
  return { heroes, dpsBonus: 0 };
}
