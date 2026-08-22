/**
 * Fight-sim state types. A "side" is a list of heroes — no hardcoded slots,
 * so squad size N stays a parameter (archive/FIGHT_SCRIPT.md "parameterized" section).
 * Heroes are ordered front-to-back; a normal attack targets the front-most
 * living hero on the opposing side (see fight.ts's targeting helpers).
 */
import type { ChainProfile } from "./config.js";

export type Role = "tank" | "damage" | "support" | "bruiser" | "grunt";

/** A hero's resolved chain plan for THIS fight (2026-08-20, per-hero-profile
 * pass — see config.ts's ChainProfile/chainMagnitudeScaleFor). Sim-internal:
 * resolved once per fight in fight.ts's cloneHeroes (from HeroState.
 * chainProfile, falling back to baselineChainProfile(cfg) when unset) and
 * stored back on the cloned HeroState so a chain-fire site never has to
 * recompute it mid-fight, and so a batch-harness roster transform that
 * changes chainAffinity without recomputing this can't silently measure an
 * un-normalized hero — the plan is always freshly derived from whatever cfg
 * the fight actually runs under. */
export interface ChainPlan {
  profile: ChainProfile;
  /** The multiplier equalizing this profile+risk against the pool's EV
   * anchor — see config.ts's chainMagnitudeScaleFor. */
  magnitudeScale: number;
  /** This hero's own backfireChanceFor(cfg, chainAffinity), cached alongside
   * the plan it was used to derive so both travel together. */
  backfireChance: number;
}

export interface HeroState {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  hp: number;
  /** Set the instant hp hits 0 mid-fight. Death is permanent at the roster
   * level — see roster.ts's applyFightResultToRoster. */
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

  /** 2026-08-14 (chain-rebuild pass) through 2026-08-19 (affinity-as-risk
   * pass): scaled PAYOFF magnitude in both directions. 2026-08-20 (per-hero-
   * profile pass, Step 3): magnitude moved entirely onto chainProfile/
   * chainMagnitudeTarget below — chainAffinity is now VOLATILITY ONLY, via
   * config.ts's backfireChanceFor (higher affinity = higher backfire chance,
   * same payoff size as every other hero of its kind). It still doesn't
   * scale how fast `charge` accrues — every hero fills at the same rate, so
   * two heroes' bars read as directly comparable at field-pick time. See
   * heroes.ts's PLAYER_HERO_POOL for why each hero's value differs: this is
   * now "how much of a gamble is this hero to have go hot," nothing else. */
  chainAffinity: number;

  /** This hero's own chain SHAPE (2026-08-20, per-hero-profile pass — see
   * config.ts's ChainProfile). Undefined falls back to
   * baselineChainProfile(cfg) — the identity transform that kept every
   * hero's behavior unchanged through Step 1/Step 2, before Step 3 actually
   * authored per-hero shapes (see heroes.ts's PLAYER_HERO_POOL). Set on
   * HeroDef/HeroState alike, same as chainAffinity. */
  chainProfile?: ChainProfile;
  /** This hero's absolute expected-net-chain-value target (2026-08-20, Step
   * 3 — see config.ts's chainMagnitudeScaleAbsolute and heroes.ts's
   * CHAIN_EV_TARGET_DAMAGE/HEAL). Undefined falls back to a value that
   * reproduces chainMagnitudeScaleFor's pool-agnostic behavior (Variant A) —
   * see fight.ts's resolveChainPlan for the exact fallback formula. */
  chainMagnitudeTarget?: number;
  /** This hero's chain plan, RESOLVED for the current fight — see this
   * file's ChainPlan docstring. Undefined until fight.ts's cloneHeroes sets
   * it; enemies never get one (they never chain). */
  chainPlan?: ChainPlan;

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

  /** The chain meter (2026-08-14 chain-rebuild pass — see DECISIONS.md).
   * Accrues from this hero's own job (dealt/soaked/restored, weighted by
   * config.ts's chargeWeightDealt/Soaked/Restored). The instant it crosses
   * chargeThreshold, THIS hero fires — no candidate contest, no roll on
   * whether it happens. Unlike every other field on this list, `charge`
   * PERSISTS across the whole run (roster.ts carries it forward for both
   * fielded and benched heroes) and is reset to 0 only when this hero fires
   * a chain. cloneHeroes deliberately does not zero it. */
  charge: number;

  /** Enemy bruiser only: sim-clock time of this hero's next wind-up charge
   * start. Undefined for every other role. */
  nextWindupT?: number;
  /** Enemy bruiser only (2026-08-15, encounter-deck pass — see
   * sim/encounters.ts's EncounterBruiser.windupIntervalSec): per-bruiser
   * override of cfg.fight.windupIntervalSec, read by fight.ts's
   * handleBruiserBeat when it reschedules nextWindupT after a charge
   * resolves. Undefined falls back to the shared cfg value, so every
   * pre-existing bruiser (no override authored) behaves exactly as before. */
  windupIntervalSec?: number;
  /** Set only while charging (telegraphed) — the sim-clock time the wind-up
   * fires. Undefined when not charging. */
  windupFireT?: number;
  /** Locked target id for the current charge, chosen when the charge starts
   * so the telegraph and the eventual hit agree on who's threatened — even
   * if that hero dies to something else before the hit lands (fight.ts falls
   * back to a fresh weighted pick in that case). */
  windupTargetId?: string | null;
  /** Enemy bruiser only (2026-08-09, encounter-table pass — see
   * sim/encounters.ts): which rule picks a wind-up's target. "weighted"
   * (default when unset) is the normal enemy-attack rule — a holding tank
   * draws it disproportionately. "lowestHp" always locks the lowest-current-
   * HP living player hero — the Executioner encounter's whole premise
   * ("can your squishies survive"), deliberately bypassing tank aggro
   * entirely for this one threat. */
  windupTargeting?: "weighted" | "lowestHp";
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

/** A fight's starting setup. Both sides carry whatever HP/deaths attrition
 * left them with; the player side also carries each hero's `charge` in from
 * the roster (2026-08-14 chain-rebuild pass) — there is no separate
 * cross-fight counter anymore, since charge itself is the persisted state. */
export interface FightSetup {
  player: SideState;
  enemy: SideState;
}
