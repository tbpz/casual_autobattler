/**
 * Turns one fight's raw event list into the answer the export log's four
 * questions get checked against — "decided by ___" is a felt claim written
 * before the fight is re-read; this is the same claim worked out from the
 * events instead, so the two can be compared. Pure: no DOM, no Node, no RNG —
 * shared by the browser export (log/runLog.ts) and the offline reader
 * (tools/readLog.ts) so the two can never compute a different answer for the
 * same fight.
 *
 * Reads `result.snapshots` for ground truth (final per-hero hp/dealt/soaked/
 * restored/hitsTaken — fight.ts's snapshotHeroes already tracks these
 * exactly, dead heroes included) but the EXPORTED file never keeps the
 * snapshot array itself (~600 entries per fight, most of it redundant with
 * the event list) — only this summary and the raw events are written. See
 * log/runLog.ts.
 *
 * Two deliberate simplifications, documented rather than silently eaten:
 *
 *  1. Kill attribution (whose hit actually finished a body) is inferred, not
 *     recorded directly — fight.ts pushes a `heroDown` immediately after the
 *     damage event that caused it, at the identical tick, so the nearest
 *     preceding damage event targeting that body at the same `t` is treated
 *     as the killing blow. Correct for every fight this file has been run
 *     against; a future change to fight.ts's event-push order would need
 *     this re-checked.
 *  2. An ordinary attack or a slam that overkills its target SPILLS onto the
 *     next living body in that side's list (applyDamageFrom's
 *     `spillOverkill`, fight.ts) — a killing blow can soak two bodies at
 *     once. The `attack`/`windupHit` EVENT only ever names the one body it
 *     was aimed at (`targetId`), not whoever the overflow actually landed
 *     on, so a fight with several bodies dying in quick succession will
 *     under-count the spillover recipient and over-count the named target by
 *     the same amount — the totals below are attributed to WHO WAS AIMED
 *     AT, not a perfect per-body ledger. This is the dominant source of the
 *     small mismatches tools/readLog.ts's cross-check flags; it is a real
 *     gap in what the event log records, not a bug in this file's replay.
 *
 * `finalSnapshot`'s own `dealt`/`soaked`/`restored` mix ordinary and chain
 * together (fight.ts increments the same counter from both paths) — that
 * mixed total is kept on each HeroDecided as `groundTruth` specifically so
 * the reader can cross-check this file's own ordinary/chain SPLIT against it
 * (should match within simplification 2's spillover slack) rather than
 * trusting the split blindly.
 */
import type { FightResult, Side } from "../sim/events.js";
import type { ChainEffect } from "../sim/config.js";

export interface HeroDecided {
  id: string;
  name: string;
  side: Side;
  role: string;
  maxHp: number;
  /** Damage this hero dealt via its own ordinary attack beat. */
  damageDealtOrdinary: number;
  /** Damage this hero dealt via a fired (non-backfired) chain. */
  damageDealtChain: number;
  /** Damage a bruiser's own slam dealt (fight.ts credits this to the
   * bruiser's `dealt` counter same as an ordinary attack — see
   * handleBruiserBeat's windupHit branch). Always 0 for a player hero. */
  damageDealtSlam: number;
  /** Damage this hero took from an ordinary attack. */
  damageTakenOrdinary: number;
  /** Damage this hero took from a chain hit correctly aimed at its side (an
   * enemy body taking a player's non-backfired damage chain). Never
   * populated for a player hero. */
  damageTakenChainDirect: number;
  /** Damage this hero took from a bruiser's slam. */
  damageTakenSlam: number;
  /** Damage this hero took from a chain BACKFIRE — its own side's chain
   * turned on it. Only ever populated for a player hero. */
  damageTakenChainBackfire: number;
  healingGiven: number;
  healingReceived: number;
  /** Ids this hero's own hits (ordinary or chain) are the nearest preceding
   * damage event to a heroDown for — see this file's header. */
  kills: string[];
  died: boolean;
  diedAtSec: number | null;
  finalHp: number;
  /** fight.ts's own exact per-hero totals (snapshotHeroes), for cross-check
   * against this file's ordinary/chain split — see this file's header. */
  groundTruth: { dealt: number; soaked: number; restored: number; hitsTaken: number };
}

export interface ChainDecided {
  heroId: string;
  heroName: string;
  effect: ChainEffect;
  backfire: boolean;
  length: number;
  reason: "miss" | "capped" | "noTarget" | "fightEnd" | "sourceDied";
  totalDamage: number;
  totalStunSec: number;
  totalGuardCharges: number;
  /** Sum of (intended - damage) over every damage-kind link — a chain that
   * looked huge but landed on bodies already nearly dead. 0 for heal/guard/
   * stun effects, which don't overkill the same way. */
  wastedDamage: number;
  killedIds: string[];
  startSec: number;
  endSec: number | null;
}

export interface SlamDecided {
  sourceId: string;
  sourceName: string;
  targetId: string;
  originalTargetId: string | null;
  damage: number;
  redirect: "guard" | "guardBackfire" | "targetDied" | null;
  atSec: number;
}

export interface RankedContributor {
  id: string;
  name: string;
  amount: number;
}

export interface DecidedSummary {
  heroes: HeroDecided[];
  chains: ChainDecided[];
  slams: {
    landed: number;
    guardRedirects: number;
    guardBackfireRedirects: number;
    retargetedOnDeath: number;
    totalDamage: number;
    events: SlamDecided[];
  };
  /** Lowest the PLAYER side's total HP (fraction of its own max) fell to at
   * any point in the fight, and when — read straight off result.snapshots,
   * which the export itself does not keep (see this file's header). */
  lowestPlayerHpFraction: { fraction: number; atSec: number };
  endPlayerHpFraction: number;
  /** The three biggest contributors to the enemy's HP loss, and to the
   * player's — the line "decided by ___" gets held against. */
  topEnemyDamageDealers: RankedContributor[];
  topPlayerDamageTakenSources: RankedContributor[];
}

interface Identity {
  id: string;
  name: string;
  side: Side;
  role: string;
  maxHp: number;
}

function bump(map: Map<string, RankedContributor>, id: string, name: string, amount: number): void {
  if (amount <= 0) return;
  const existing = map.get(id);
  if (existing) existing.amount += amount;
  else map.set(id, { id, name, amount });
}

export function summarizeFight(result: FightResult): DecidedSummary {
  const finalSnapshot = result.snapshots[result.snapshots.length - 1];
  if (!finalSnapshot) {
    throw new Error("summarizeFight: FightResult has no snapshots — cannot read ground truth");
  }

  const identities = new Map<string, Identity>();
  for (const h of finalSnapshot.playerHeroes) identities.set(h.id, { id: h.id, name: h.name, side: "player", role: h.role, maxHp: h.maxHp });
  for (const h of finalSnapshot.enemyHeroes) identities.set(h.id, { id: h.id, name: h.name, side: "enemy", role: h.role, maxHp: h.maxHp });

  const heroById = new Map<string, HeroDecided>();
  for (const h of [...finalSnapshot.playerHeroes, ...finalSnapshot.enemyHeroes]) {
    const idn = identities.get(h.id)!;
    heroById.set(h.id, {
      id: h.id,
      name: idn.name,
      side: idn.side,
      role: idn.role,
      maxHp: idn.maxHp,
      damageDealtOrdinary: 0,
      damageDealtChain: 0,
      damageDealtSlam: 0,
      damageTakenOrdinary: 0,
      damageTakenChainDirect: 0,
      damageTakenSlam: 0,
      damageTakenChainBackfire: 0,
      healingGiven: 0,
      healingReceived: 0,
      kills: [],
      died: !h.alive,
      diedAtSec: null,
      finalHp: h.hp,
      groundTruth: { dealt: h.dealt, soaked: h.soaked, restored: h.restored, hitsTaken: h.hitsTaken },
    });
  }

  const enemyDealt = new Map<string, RankedContributor>();
  const playerTaken = new Map<string, RankedContributor>();

  const chains: ChainDecided[] = [];
  let openChain: ChainDecided | null = null;

  const slamEvents: SlamDecided[] = [];
  let guardRedirects = 0;
  let guardBackfireRedirects = 0;
  let retargetedOnDeath = 0;
  let slamTotalDamage = 0;

  const events = result.events;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    switch (e.type) {
      case "attack": {
        const attacker = heroById.get(e.attackerId);
        const target = heroById.get(e.targetId);
        if (attacker) {
          attacker.damageDealtOrdinary += e.damage;
          if (attacker.side === "player") bump(enemyDealt, attacker.id, attacker.name, e.damage);
        }
        if (target) {
          target.damageTakenOrdinary += e.damage;
          if (target.side === "player") bump(playerTaken, e.attackerId, attacker?.name ?? e.attackerId, e.damage);
        }
        break;
      }
      case "heal": {
        const healer = heroById.get(e.healerId);
        const target = heroById.get(e.targetId);
        if (healer) healer.healingGiven += e.amount;
        if (target) target.healingReceived += e.amount;
        break;
      }
      case "chainStart": {
        openChain = {
          heroId: e.heroId,
          heroName: identities.get(e.heroId)?.name ?? e.heroId,
          effect: e.effect,
          backfire: e.backfire,
          length: 0,
          reason: "fightEnd",
          totalDamage: 0,
          totalStunSec: 0,
          totalGuardCharges: 0,
          wastedDamage: 0,
          killedIds: [],
          startSec: e.t,
          endSec: null,
        };
        break;
      }
      case "chainHit": {
        const source = heroById.get(e.sourceId);
        const target = e.targetId ? heroById.get(e.targetId) : undefined;
        const targetSide = e.targetId ? identities.get(e.targetId)?.side : undefined;
        if (e.kind === "damage") {
          if (source && !e.backfire) {
            source.damageDealtChain += e.damage;
            bump(enemyDealt, source.id, source.name, e.damage);
          }
          if (target) {
            if (e.backfire && targetSide === "player") {
              target.damageTakenChainBackfire += e.damage;
              bump(playerTaken, `${e.sourceId}:backfire`, `${source?.name ?? e.sourceId}'s backfire`, e.damage);
            } else if (!e.backfire && targetSide === "enemy") {
              target.damageTakenChainDirect += e.damage;
            }
          }
        } else if (e.kind === "heal") {
          if (source && !e.backfire) source.healingGiven += e.damage;
          if (target) target.healingReceived += e.damage;
        }
        if (openChain && openChain.heroId === e.sourceId) {
          openChain.length = Math.max(openChain.length, e.hitIndex);
          if (e.kind === "damage") {
            openChain.wastedDamage += Math.max(0, e.intended - e.damage);
          } else if (e.kind === "guard") {
            openChain.totalGuardCharges += e.charges ?? 0;
          }
        }
        break;
      }
      case "chainEnd": {
        if (openChain && openChain.heroId === e.heroId) {
          openChain.reason = e.reason;
          openChain.endSec = e.t;
          openChain.killedIds = e.killedIds;
          openChain.length = e.chainLength;
          // Authoritative — fight.ts already sums these precisely per chain;
          // see this file's header for why they're trusted over a hand-rolled
          // re-sum during chainHit.
          openChain.totalDamage = e.totalDamage;
          openChain.totalStunSec = e.totalStunSec;
          chains.push(openChain);
          openChain = null;
        }
        break;
      }
      case "heroDown": {
        const hero = heroById.get(e.heroId);
        if (hero) hero.diedAtSec = e.t;
        // Simplification (see file header): the killer is whichever damage
        // event immediately precedes this heroDown, at the same tick,
        // targeting this same body.
        for (let j = i - 1; j >= 0 && events[j]!.t === e.t; j--) {
          const prior = events[j]!;
          if (prior.type === "attack" && prior.targetId === e.heroId) {
            heroById.get(prior.attackerId)?.kills.push(e.heroId);
            break;
          }
          if (prior.type === "chainHit" && prior.targetId === e.heroId && prior.kind === "damage") {
            heroById.get(prior.sourceId)?.kills.push(e.heroId);
            break;
          }
          if (prior.type === "windupHit" && prior.targetId === e.heroId) {
            heroById.get(prior.sourceId)?.kills.push(e.heroId);
            break;
          }
        }
        break;
      }
      case "windupHit": {
        const source = heroById.get(e.sourceId);
        const target = heroById.get(e.targetId);
        if (source) source.damageDealtSlam += e.damage;
        if (target) target.damageTakenSlam += e.damage;
        slamTotalDamage += e.damage;
        slamEvents.push({
          sourceId: e.sourceId,
          sourceName: source?.name ?? e.sourceId,
          targetId: e.targetId,
          originalTargetId: e.originalTargetId,
          damage: e.damage,
          redirect: e.redirect,
          atSec: e.t,
        });
        bump(playerTaken, e.sourceId, source?.name ?? e.sourceId, e.damage);
        if (e.redirect === "guard") guardRedirects++;
        if (e.redirect === "guardBackfire") guardBackfireRedirects++;
        if (e.redirect === "targetDied") retargetedOnDeath++;
        break;
      }
      case "tankBreak":
      case "tankRecover":
      case "windupStart":
      case "resolve":
        break;
    }
  }

  // An unresolved chain (fight ended mid-chain) never got a chainEnd —
  // fight.ts's post-loop sweep normally closes these with reason
  // "fightEnd"/"sourceDied" before the events array is returned, but this
  // guards against ever silently dropping one if that changes.
  if (openChain) {
    (openChain as ChainDecided).endSec = result.durationSec;
    chains.push(openChain);
  }

  let lowestFraction = 1;
  let lowestAtSec = 0;
  for (const snap of result.snapshots) {
    const frac = snap.playerMaxHp > 0 ? snap.playerHp / snap.playerMaxHp : 1;
    if (frac < lowestFraction) {
      lowestFraction = frac;
      lowestAtSec = snap.t;
    }
  }
  const endPlayerHpFraction = finalSnapshot.playerMaxHp > 0 ? finalSnapshot.playerHp / finalSnapshot.playerMaxHp : 1;

  const rankTop3 = (m: Map<string, RankedContributor>): RankedContributor[] =>
    [...m.values()].sort((a, b) => b.amount - a.amount).slice(0, 3);

  return {
    heroes: [...heroById.values()],
    chains,
    slams: {
      landed: slamEvents.length,
      guardRedirects,
      guardBackfireRedirects,
      retargetedOnDeath,
      totalDamage: slamTotalDamage,
      events: slamEvents,
    },
    lowestPlayerHpFraction: { fraction: lowestFraction, atSec: lowestAtSec },
    endPlayerHpFraction,
    topEnemyDamageDealers: rankTop3(enemyDealt),
    topPlayerDamageTakenSources: rankTop3(playerTaken),
  };
}
