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
import { Rng } from "./rng.js";
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
  /** Per-bruiser override of cfg.fight.windupIntervalSec (2026-08-15,
   * encounter-deck pass) — e.g. Duelist's wind-up landing twice as often.
   * Undefined falls back to the shared cfg value, same as every bruiser
   * authored before this field existed. */
  windupIntervalSec?: number;
  /** Enemy support (2026-08-15, encounter-deck pass) — same mechanism as a
   * player support's healPerBeat (types.ts's HeroState docstring, wired
   * generically in fight.ts's performHeroAction, which already heals
   * whichever side is acting): this bruiser heals its own side's lowest-HP
   * living body on its normal beat instead of attacking. Makes a slow grind
   * lose and a burst comp (or a chain) matter directly (Warden, below). */
  healPerBeat?: number;
}

export interface EncounterDef {
  name: string;
  /** One line for the field-pick screen — "the question it asks," stated
   * plainly enough to inform the fielding choice without reading like a
   * strategy-guide hint. */
  blurb: string;
  /** 2026-08-15 (encounter-deck pass — see this file's top docstring and
   * CHAIN_AXIS_PLAN.md's Chunk 3): which slot in a drawn run this encounter
   * is eligible for. "early" fills the opening fights, "mid" the middle
   * fights, "finale" the last — see encounterOrderFor below. Required so a
   * shuffle can't put a finale-shaped fight at fight 1 and make
   * difficultyRampFactor's ramp meaningless. */
  tier: "early" | "mid" | "finale";
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
    tier: "early",
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
    tier: "early",
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
    tier: "mid",
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
    tier: "mid",
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
    tier: "finale",
    bruisers: [
      { namePrefix: "Champion", maxHp: 230, damage: 11, attackIntervalSec: 1, windupTargeting: "weighted" },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Honor Guard",
    gruntMaxHp: 62,
    gruntDamage: 5,
    gruntAttackIntervalSec: 0.95,
  },
  // --- 2026-08-15 encounter-deck pass (CHAIN_AXIS_PLAN.md Chunk 3): six new
  // shapes, each asking a question none of the original five ask — see this
  // file's top docstring and each entry's blurb for the question itself.
  {
    name: "Anvil",
    blurb: "One huge body, barely hits back. A grind with no telegraph to fear — how long will you take?",
    tier: "early",
    // No bruiser at all (a grunt, not a bruiser) is deliberate: this
    // encounter's whole point is "no wind-up, no telegraph, zero jeopardy" —
    // a pure DPS check. A bruiser entry always schedules a wind-up cycle
    // (see makeEncounterEnemySide below); a lone grunt never does.
    bruisers: [],
    gruntCount: 1,
    gruntNamePrefix: "Anvil",
    gruntMaxHp: 420,
    gruntDamage: 4,
    gruntAttackIntervalSec: 1.3,
  },
  {
    name: "Ambush",
    blurb: "Four fast, fragile bodies. Can a squad with no line still hold?",
    tier: "mid",
    bruisers: [],
    gruntCount: 4,
    gruntNamePrefix: "Raider",
    gruntMaxHp: 40,
    gruntDamage: 5,
    gruntAttackIntervalSec: 0.6,
  },
  {
    name: "Duelist",
    blurb: "The wind-up fires twice as often. Can you survive sustained pressure, not just one big hit?",
    tier: "mid",
    bruisers: [
      { namePrefix: "Duelist", maxHp: 200, damage: 9, attackIntervalSec: 1.1, windupTargeting: "weighted", windupIntervalSec: 2.5 },
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
    tier: "mid",
    bruisers: [
      { namePrefix: "Warden", maxHp: 210, damage: 8, attackIntervalSec: 1.3, windupTargeting: "weighted", healPerBeat: 6 },
    ],
    gruntCount: 2,
    gruntNamePrefix: "Acolyte",
    gruntMaxHp: 55,
    gruntDamage: 4,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Glass Pair",
    blurb: "Two glass cannons, high damage each. Can you drop the first before it costs you?",
    tier: "mid",
    bruisers: [
      { namePrefix: "Glass", maxHp: 90, damage: 14, attackIntervalSec: 1.4, windupPhase: 0, windupTargeting: "weighted" },
      { namePrefix: "Glass", maxHp: 90, damage: 14, attackIntervalSec: 1.4, windupPhase: 0.5, windupTargeting: "weighted" },
    ],
    gruntCount: 0,
    gruntNamePrefix: "",
    gruntMaxHp: 0,
    gruntDamage: 0,
    gruntAttackIntervalSec: 1,
  },
  {
    name: "Vanguard",
    blurb: "The wind-up hunts your lowest HP — and chip damage keeps changing who that is. Can your squishies survive a moving target?",
    tier: "finale",
    bruisers: [
      { namePrefix: "Vanguard", maxHp: 240, damage: 11, attackIntervalSec: 1, windupTargeting: "lowestHp" },
    ],
    gruntCount: 3,
    gruntNamePrefix: "Outrider",
    gruntMaxHp: 50,
    gruntDamage: 5,
    gruntAttackIntervalSec: 0.7,
  },
];

/** Clamps to the LAST authored entry beyond ENCOUNTERS.length (same
 * clamp-to-last convention config.ts's prdLookup uses) rather than throwing
 * — makeEncounterEnemySide still scales by the UN-clamped fightIndex, so an
 * out-of-range index (e.g. a batch-tuning fixture deliberately asking for
 * "fight 10") still returns Champion's shape scaled harder, not an error. */
function clampEncounterIndex(idx: number): number {
  return Math.min(Math.max(idx, 0), ENCOUNTERS.length - 1);
}

export function encounterFor(fightIndex: number): EncounterDef | null {
  if (ENCOUNTERS.length === 0) return null;
  return ENCOUNTERS[clampEncounterIndex(fightIndex)] ?? null;
}

export function encounterNameFor(fightIndex: number): string | null {
  return encounterFor(fightIndex)?.name ?? null;
}

export function encounterBlurbFor(fightIndex: number): string | null {
  return encounterFor(fightIndex)?.blurb ?? null;
}

/** Direct lookup by ENCOUNTERS index (2026-08-15, encounter-deck pass) —
 * unlike encounterFor, does NOT treat the index as a fight number to clamp
 * against; used by the draw-aware call sites (RunSession, fieldPickScreen,
 * preFightScreen) which already have a real drawn index from
 * encounterOrderFor, not a fight-index guess. */
export function encounterAt(index: number): EncounterDef | null {
  return ENCOUNTERS[index] ?? null;
}

/** Builds the enemy SideState for fightIndex's authored encounter, scaled by
 * RunConfig's global ramp factors (kept as a batch-tuning multiplier on top
 * of the authored shape — see config.ts's difficultyRampFactor docstring,
 * 2026-08-09 update) — the SHAPE comes from the table above, the residual
 * fight-over-fight escalation still comes from the same exponential ramp
 * every other fight used. Bruisers lead the roster so the player's
 * front-targeting attacks (fight.ts) reliably hit one first; Twins'
 * second bruiser sits right after the first, both ahead of any grunts.
 *
 * `encounterIndex` (2026-08-15, encounter-deck pass) selects WHICH
 * encounter's shape to build, independent of `fightIndex` — which still
 * drives only the difficulty ramp below. Defaults to the pre-deck clamp
 * behavior (fightIndex itself, clamped) so every existing call site (batch
 * fixtures, checks/*, sim/run.ts's re-export) that doesn't pass a drawn
 * index keeps returning exactly the encounter it always did. */
export function makeEncounterEnemySide(cfg: RunConfig, fightIndex: number, encounterIndex?: number): SideState {
  const encounter = ENCOUNTERS.length === 0 ? null : ENCOUNTERS[clampEncounterIndex(encounterIndex ?? fightIndex)];
  if (!encounter) {
    throw new Error(`no encounter authored for fight index ${fightIndex} (ENCOUNTERS has ${ENCOUNTERS.length} entries)`);
  }
  const hpScale = Math.pow(cfg.difficultyRampFactor, fightIndex);
  const damageScale = Math.pow(cfg.difficultyDamageRampFactor, fightIndex);

  const heroes: HeroState[] = [];
  encounter.bruisers.forEach((b, i) => {
    const windupIntervalSec = b.windupIntervalSec ?? cfg.fight.windupIntervalSec;
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
      // fire-ready hero) — inert, set to 1 (a no-op multiplier) so nothing
      // downstream divides by zero.
      chainAffinity: 1,
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
      chainAffinity: 1,
    });
  }
  return { heroes, dpsBonus: 0 };
}

function shuffledIndices(rng: Rng, indices: number[]): number[] {
  const arr = [...indices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Samples `count` indices from `pool` without replacement, reshuffling and
 * continuing once the pool is exhausted rather than throwing — a tier with
 * fewer authored entries than a run needs (shouldn't happen at the current
 * pool sizes, but this is a draw over a table that will keep growing)
 * degrades to "no immediate repeat within one exhaustion pass" instead of
 * crashing the run. */
function sampleWithoutReplacement(rng: Rng, pool: number[], count: number): number[] {
  if (pool.length === 0 || count <= 0) return [];
  const result: number[] = [];
  let remaining: number[] = [];
  while (result.length < count) {
    if (remaining.length === 0) remaining = shuffledIndices(rng, pool);
    result.push(remaining.pop()!);
  }
  return result;
}

/** Draws this run's fight order (2026-08-15, encounter-deck pass —
 * CHAIN_AXIS_PLAN.md's Chunk 3): returns `fightsPerRun` indices into
 * ENCOUNTERS, sampled without replacement from the `early` tier for the
 * opening fights, `mid` for the middle fights, and one `finale` last — so
 * every run still ends on a finale-shaped fight, but which one (and which
 * five fights lead into it) varies run to run instead of replaying the same
 * fixed sequence.
 *
 * Uses a SEPARATE `Rng(seed ^ 0x9e3779b9)`, not the run's own fight stream
 * (render/runSession.ts, sim/run.ts's runRun) — drawing from the shared
 * stream would shift every downstream roll (damage variance, targeting,
 * chain/backfire) and make existing seeds and tuning incomparable to numbers
 * measured before this pass. */
export function encounterOrderFor(seed: number, fightsPerRun: number): number[] {
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  const byTier = (tier: EncounterDef["tier"]): number[] =>
    ENCOUNTERS.map((_, i) => i).filter((i) => ENCOUNTERS[i]!.tier === tier);

  const finaleCount = Math.min(1, fightsPerRun);
  const remaining = fightsPerRun - finaleCount;
  const earlyCount = Math.ceil(remaining / 2);
  const midCount = remaining - earlyCount;

  return [
    ...sampleWithoutReplacement(rng, byTier("early"), earlyCount),
    ...sampleWithoutReplacement(rng, byTier("mid"), midCount),
    ...sampleWithoutReplacement(rng, byTier("finale"), finaleCount),
  ];
}
