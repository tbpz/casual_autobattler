/**
 * Fight-sim state types. A "side" is a list of heroes — no hardcoded slots,
 * so squad size N stays a parameter (FIGHT_SCRIPT.md "parameterized" section).
 * Heroes are ordered front-to-back; a normal attack targets the front-most
 * living hero on the opposing side (see fight.ts's targeting helpers).
 */

export type Role = "tank" | "damage" | "support" | "bruiser" | "grunt";

export interface HeroState {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  hp: number;
  /** Set the instant hp hits 0 mid-fight. Whether this becomes a permanent
   * run-level death is decided by RunConfig.deathPolicy, not here. */
  alive: boolean;
  /** Damage dealt by this hero's normal attack. Support heroes still carry a
   * (small) damage value but act as a healer on their beat instead — see
   * fight.ts's performHeroAction. */
  damage: number;
  /** Seconds between this hero's attack/heal beats. */
  attackIntervalSec: number;
  /** Sim-clock time (seconds) of this hero's next beat. */
  nextAttackT: number;
  /** If set, this hero heals its lowest-HP living ally on its beat instead
   * of attacking — the mechanism for a rising meter the player can attribute
   * to a specific body. */
  healPerBeat?: number;
  /** If set alongside healPerBeat, this hero ALSO attacks on the same beat
   * instead of the heal replacing the attack — Ward's hybrid identity (see
   * heroes.ts). Meaningless without healPerBeat set. */
  attacksWhileHealing?: boolean;

  /** Multiplies both how fast this hero's own heat accrues and how big its
   * chain hits land (see fight.ts's chain-damage formula and config.ts's
   * heatWeight* constants) — the squad-pick lever for "how often do I get a
   * shot at the cascade, and how big is it when it lands." See heroes.ts's
   * PLAYER_HERO_POOL for why each hero's value differs. */
  chainAffinity: number;

  /** Per-fight job counters (2026-08-06 legibility pass) — zeroed at fight
   * start by cloneHeroes, never carried between fights. These are the
   * readout the player's squad plan is judged against: did the tank soak,
   * did the dealer deal, did the healer restore. See fightView.ts. */
  dealt: number;
  soaked: number;
  restored: number;
  hitsTaken: number;
  /** True while a tank is still holding aggro (above tankBreakFraction of
   * its own maxHp). Always false for non-tank roles. Drives both the
   * enemy's targeting weight (fight.ts) and the "broken" visual tell. */
  holding: boolean;

  /** Ignition eligibility meter (2026-08-07 rebuild, replaces the old
   * pity-gate — see config.ts's FightConfig docstring). Accrues from this
   * hero's own job (dealt/soaked/restored, weighted by config.ts's
   * heatWeightDealt/Soaked/Restored); the first living hero to cross
   * heatThreshold triggers an ignition roll. Zeroed at fight start by
   * cloneHeroes, same as the other per-fight job counters. */
  heat: number;

  /** Enemy bruiser only: sim-clock time of this hero's next wind-up charge
   * start. Undefined for every other role. */
  nextWindupT?: number;
  /** Set only while charging (telegraphed) — the sim-clock time the wind-up
   * fires. Undefined when not charging. */
  windupFireT?: number;
  /** Locked target id for the current charge, chosen when the charge starts
   * so the telegraph and the eventual hit agree on who's threatened — even
   * if that hero dies to something else before the hit lands (fight.ts falls
   * back to a fresh weighted pick in that case). */
  windupTargetId?: string | null;
}

export interface SideState {
  heroes: HeroState[];
  /** Flat bonus added to every living hero's attack damage, accumulated from
   * run-level upgrades (coin sink B). Applied only to the player side; 0 for
   * enemies. */
  dpsBonus: number;
}

export function sideMaxHp(side: SideState): number {
  return side.heroes.reduce((sum, h) => sum + h.maxHp, 0);
}

export function sideHp(side: SideState): number {
  return side.heroes.reduce((sum, h) => sum + h.hp, 0);
}

export function sideLivingCount(side: SideState): number {
  return side.heroes.filter((h) => h.alive).length;
}

/** A fight's starting setup. Both sides carry whatever HP/deaths attrition left them with. */
export interface FightSetup {
  player: SideState;
  enemy: SideState;
  /** Failed ignition attempts since the player side last ignited, going into
   * this fight (PRD counter). As of the heat-is-spent rebuild an "attempt" is
   * a single roll, not a fight — a fight can contain several (heat resets
   * and rebuilds after every roll), so this can advance mid-fight too; see
   * fight.ts and FightResult.attemptsSinceIgnition, which carries the
   * counter's value at fight-end forward into the next fight's setup. */
  attemptsSinceIgnition: number;
}
