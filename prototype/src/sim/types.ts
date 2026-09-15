/**
 * Fight-sim state types. A "side" is a list of heroes — no hardcoded slots,
 * so squad size N stays a parameter (archive/FIGHT_SCRIPT.md "parameterized" section).
 * Heroes are ordered front-to-back; a normal attack targets the front-most
 * living hero on the opposing side (see fight.ts's targeting helpers).
 */
import type { ChainEffect } from "./config.js";

export type Role = "tank" | "damage" | "support" | "bruiser" | "grunt";

/** A hero's resolved chain plan for THIS fight (2026-09-13, "a hero's chain
 * names its own enemy" rebuild — replaces the old profile/targeting/
 * magnitude-scale ChainPlan). Resolved once per fight in fight.ts's
 * cloneHeroes (from HeroState.chainEffect) and stored back on the cloned
 * HeroState so a chain-fire site never has to re-derive it mid-fight. Enemies
 * get an arbitrary effect too (cloneHeroes resolves every hero) but it is
 * never read — only the player side is ever scanned to ignite a chain. */
export interface ChainPlan {
  effect: ChainEffect;
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

  /** VOLATILITY ONLY (2026-08-19 affinity-as-risk pass, unchanged by the
   * 2026-09-13 chain-effect rebuild): feeds config.ts's backfireChanceFor —
   * higher affinity means a bigger backfire chance, nothing about what a
   * hero's chain does or how big it lands (see chainEffect below for that).
   * It also doesn't scale how fast `charge` accrues — every hero fills at
   * the same rate, so two heroes' bars read as directly comparable at
   * field-pick time. See heroes.ts's PLAYER_HERO_POOL for why each hero's
   * value differs: this is "how much of a gamble is this hero to have go
   * hot," nothing else. */
  chainAffinity: number;

  /** This hero's own chain EFFECT (2026-09-13, "a hero's chain names its own
   * enemy" rebuild — see config.ts's ChainEffect and heroes.ts's
   * PLAYER_HERO_POOL). Set on HeroDef/HeroState alike, same as chainAffinity;
   * enemies author no value (they never chain — only the player side is ever
   * scanned to ignite one). */
  chainEffect?: ChainEffect;
  /** This hero's chain plan, RESOLVED for the current fight — see this
   * file's ChainPlan docstring. Undefined until fight.ts's cloneHeroes sets
   * it; enemies get one too (harmless — never read). */
  chainPlan?: ChainPlan;
  /** Set by Hollow's "stun" chain effect (config.ts's ChainEffect) —
   * sim-clock time this hero is unable to act until. Read by the beat loop
   * (fight.ts) to push nextAttackT/nextWindupT past it, and by a bruiser's
   * wind-up start to cancel an in-progress telegraph. Undefined when not
   * stunned. Additive across chain links (2026-09-15 freeze-visibility
   * pass) — each new link extends this past its current value rather than
   * replacing it, so a longer chain reliably buys a longer freeze.
   * 2026-09-16 (freeze-layout pass): while stunnedHeld is true, fight.ts
   * re-pins this to `t + (this chain's running total for this target)`
   * EVERY tick, not just when a link lands — a chain's links land on
   * Hollow's own ~0.66s cadence, faster than early links alone last, so
   * without the hold this value would count down toward the clock and
   * lapse between links instead of only draining once the whole chain is
   * over. Snapshot-carried (see events.ts's HeroSnapshot) so fightView.ts
   * can draw a live countdown instead of racing a wall-clock timer. */
  stunnedUntilT?: number;
  /** Sim-clock time the CURRENT freeze began — set the instant a stun first
   * lands on a body that wasn't already frozen, left untouched while later
   * links extend stunnedUntilT above. Together the two give the render layer
   * a stable "how full was this bar to start" for a draining countdown;
   * without it, an extending freeze would have no fixed point to drain
   * from. 2026-09-16: reset again the instant the CHAIN ends (not just the
   * freeze) — see fight.ts's releaseStunHold — so a freeze that was HELD for
   * several seconds still drains its actual final length starting from
   * "full" at release, rather than looking mostly-drained already. */
  stunnedFromT?: number;
  /** True for as long as the CURRENT chain is still buying this hero's
   * freeze (2026-09-16 freeze-layout pass) — fight.ts sets it the instant a
   * stun link first lands on this hero and clears it (via releaseStunHold)
   * the instant that chain ends, wherever that happens. While true, the
   * freeze is being HELD (fightView.ts shows it full, with the seconds
   * counting up as links add to it) rather than draining; once false, it
   * drains normally from stunnedUntilT down to stunnedFromT. Undefined
   * outside of a stun chain currently touching this hero. */
  stunnedHeld?: boolean;

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
  /** Enemy bruiser only: true while the CURRENT telegraph reserved a guard
   * charge at pick time (fight.ts's guardWindupAim/handleBruiserBeat,
   * 2026-09-15) — released back to SideState.guardClaims the instant this
   * telegraph resolves, whether or not it ends up spending a real charge.
   * Only matters when two bruisers wind up under one shared guard. */
  windupGuardClaimed?: boolean;
}

export interface SideState {
  heroes: HeroState[];
  /** Flat bonus added to every living hero's attack damage, accumulated from
   * run-level upgrades (coin sink B). Applied only to the player side; 0 for
   * enemies. */
  dpsBonus: number;

  /** Set by a "guard" chain effect (config.ts's ChainEffect, Bracer's
   * identity) — while guardCharges > 0, an enemy wind-up that would land on
   * this side aims away from the guardian instead (fight.ts's
   * guardWindupAim), then redirects onto the guardian at impact
   * (handleBruiserBeat), spending one charge. A count, not a deadline
   * (2026-09-15 slam-provability pass) — the pick screen already promises
   * "the next slam," and a charge that waits instead of expiring is the only
   * way to make that literally true. Always set on the PLAYER side, since
   * only the enemy ever winds up. guardInverted (set by a backfired guard)
   * forces the telegraph ONTO the guardian instead, then swings the slam
   * away onto the player's own lowest-HP hero (excluding the guardian) at
   * impact — Bracer stepping aside rather than stepping in. Per-fight only;
   * never carried by roster.ts. */
  guardHeroId?: string | null;
  guardCharges?: number;
  guardInverted?: boolean;
  /** Charges already claimed by a telegraph in flight but not yet spent at
   * impact — reserved the instant an aim is forced/excluded (fight.ts's
   * guardWindupAim) and released when that slam resolves. Only matters when
   * more than one bruiser winds up under the same guard (Twins, Glass Pair):
   * without a reservation, two telegraphs would both aim away from the
   * guardian off a single charge, and the second slam would land on a
   * squishy it would otherwise have missed — a harder fight than before the
   * fix. guardCharges - guardClaims is the count still available to aim by. */
  guardClaims?: number;
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
