import type { Rng } from "./rng.js";
import type { ChainEffect, FightConfig } from "./config.js";
import { backfireChanceFor, chainContinuationChance, chainEscalationFactor } from "./config.js";
import type { ChainPlan, FightSetup, HeroState, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightEvent, FightResult, HeroSnapshot, Side, TickSnapshot } from "./events.js";

/**
 * Applies `amount` damage starting at the hero with id `startId`, overflowing
 * to the next living hero in list order if the hit is a killing blow with
 * damage to spare — unless `spillOverkill` is false, in which case the hit
 * applies at most its target's remaining HP and stops there regardless of
 * whether damage is left over. A normal attack (and a wind-up hit) always
 * spills; every chain effect passes `spillOverkill = false` instead — each
 * rung's damage effect (strikeAll, poundBiggest) already resolves against its
 * own freshly-chosen target(s), so letting overkill leak onto whichever body
 * happens to sit next in list order would go around that choice rather than
 * respect it. Returns the ids of heroes that
 * died, in list order, the damage actually applied (<= amount — less if the
 * side didn't have enough total HP to absorb it, or if spill is off and the
 * target alone couldn't), which the caller credits to the attacker's `dealt`
 * counter, and `lost` (== amount - applied) for reporting.
 */
function applyDamageFrom(
  side: SideState,
  startId: string,
  amount: number,
  chargeWeightSoaked = 0,
  spillOverkill = true,
): { died: string[]; applied: number; lost: number } {
  const startIdx = side.heroes.findIndex((h) => h.id === startId);
  if (startIdx < 0) return { died: [], applied: 0, lost: amount };
  let remaining = amount;
  const died: string[] = [];
  for (let i = startIdx; i < side.heroes.length && remaining > 0; i++) {
    const hero = side.heroes[i];
    if (!hero || !hero.alive || hero.hp <= 0) continue;
    const taken = Math.min(hero.hp, remaining);
    hero.hp -= taken;
    hero.soaked += taken;
    hero.charge += taken * chargeWeightSoaked;
    hero.hitsTaken += 1;
    remaining -= taken;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.alive = false;
      died.push(hero.id);
    }
    if (!spillOverkill) break;
  }
  // A dead guardian stops covering anything (2026-09-15 guard-visibility
  // pass) — otherwise the pool only tears down on the enemy's NEXT wind-up
  // (guardWindupAim below), and a standing guard readout would keep showing
  // charges nobody is left to spend on Bracer's behalf.
  if (side.guardHeroId && died.includes(side.guardHeroId)) {
    side.guardCharges = 0;
    side.guardClaims = 0;
    side.guardHeroId = null;
    side.guardInverted = false;
  }
  return { died, applied: amount - remaining, lost: remaining };
}

/** The front-most living hero — a normal attack's deterministic target when
 * the attacker is the player, so the player can always find and kill the
 * visible threat (the enemy bruiser) on purpose. */
function frontMostAliveId(side: SideState): string | undefined {
  return side.heroes.find((h) => h.alive && h.hp > 0)?.id;
}

/** Weighted-random target among living heroes — the enemy's targeting rule.
 * A tank draws more incoming attacks than a squishy ally (weight
 * cfg.tankTargetWeight vs. 1) while it's holding aggro; once it's broken
 * (2026-08-06 — see DECISIONS.md's "squad pick is the risk dial" entry) its
 * weight drops to cfg.brokenTankTargetWeight, so damage visibly splashes
 * onto the rest of the squad. Not every attack lands on the tank even while
 * holding — that's what keeps an individual body's death contingent rather
 * than baked into the arithmetic, while the AGGREGATE pool still drains at a
 * fixed, tunable rate (see config.ts's docstring).
 *
 * 2026-08-08 (root-cause pass, found while re-tuning the dominant-squad gap
 * — see DECISIONS.md): only the FIRST living holding tank in list order gets
 * the aggro bonus; a second holding tank counts as weight 1, same as a
 * non-tank. Before this fix, the bonus weight applied to EVERY living
 * holding tank at once, so a double-tank pick (Bracer+Hollow, the only two
 * pool members with role "tank") stacked additively — at tankTargetWeight=3
 * two tanks drew 6-of-7 incoming attacks between them, splitting the pool's
 * effective HP across two bodies with the third slot (no dedicated damage OR
 * support) taking almost nothing. That made every Bracer+Hollow+X squad
 * ~90-100% run completion regardless of X or how hard the ramp was pushed —
 * the same "no weakness a global ramp can reach" shape as the vex-burst gap
 * this whole pass exists to fix, just via double-tanking instead of
 * burst-killing. */
function pickWeightedTargetId(side: SideState, rng: Rng, cfg: FightConfig): string | undefined {
  const alive = side.heroes.filter((h) => h.alive && h.hp > 0);
  if (alive.length === 0) return undefined;
  let aggroTankClaimed = false;
  const weights = alive.map((h) => {
    if (h.role !== "tank") return 1;
    if (!h.holding) return cfg.brokenTankTargetWeight;
    if (aggroTankClaimed) return 1;
    aggroTankClaimed = true;
    return cfg.tankTargetWeight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < alive.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return alive[i]?.id;
  }
  return alive[alive.length - 1]?.id;
}

/** Smooth weighted round-robin (nginx-style): deterministic target selection
 * that converges to the same long-run share as pickWeightedTargetId's dice,
 * with no RNG draw (2026-09-04, deciding-factors measurement rig — see
 * config.ts's enemyTargetMode docstring and FIGHT_DECIDING_FACTORS.md). Reads
 * the exact same weight formula as pickWeightedTargetId, re-evaluated on
 * every pick so a tank breaking (or dying) mid-fight still shifts the share.
 * `tally` is one `currentWeight` per hero id, carried across the whole fight
 * by the caller (fresh per runFight call — never shared between fights). */
function pickRoundRobinTargetId(side: SideState, cfg: FightConfig, tally: Map<string, number>): string | undefined {
  const alive = side.heroes.filter((h) => h.alive && h.hp > 0);
  if (alive.length === 0) return undefined;
  let aggroTankClaimed = false;
  let totalWeight = 0;
  let bestIdx = -1;
  let bestCurrent = -Infinity;
  for (let i = 0; i < alive.length; i++) {
    const hero = alive[i];
    if (!hero) continue;
    let w = 1;
    if (hero.role === "tank") {
      if (!hero.holding) w = cfg.brokenTankTargetWeight;
      else if (!aggroTankClaimed) {
        aggroTankClaimed = true;
        w = cfg.tankTargetWeight;
      }
    }
    totalWeight += w;
    const current = (tally.get(hero.id) ?? 0) + w;
    tally.set(hero.id, current);
    if (current > bestCurrent) {
      bestCurrent = current;
      bestIdx = i;
    }
  }
  const winner = alive[bestIdx];
  if (!winner) return undefined;
  tally.set(winner.id, bestCurrent - totalWeight);
  return winner.id;
}

/** Resolves cfg.enemyTargetMode: the shipped dice (pickWeightedTargetId,
 * unchanged) or the deterministic round-robin above. `tally` is required
 * (and the round-robin branch throws without one) rather than silently
 * falling back to dice — a silent fallback would quietly break the exact
 * measurement enemyTargetMode exists to make possible. Only ever called for
 * an ENEMY's own attack/wind-up target pick against the player side — a
 * chain backfire's own weighted pick (this file's "front" rule) is a
 * different factor and stays on pickWeightedTargetId directly, see
 * config.ts's enemyTargetMode docstring. */
function pickEnemyTargetId(
  side: SideState,
  rng: Rng,
  cfg: FightConfig,
  tally: Map<string, number> | undefined,
): string | undefined {
  if (cfg.enemyTargetMode !== "weightedRoundRobin") return pickWeightedTargetId(side, rng, cfg);
  if (!tally) throw new Error("pickEnemyTargetId: weightedRoundRobin mode requires a tally");
  return pickRoundRobinTargetId(side, cfg, tally);
}

/** Who a live guard forces the telegraph toward or away from — resolved once
 * per telegraph pick (2026-09-15 slam-provability pass, see types.ts's
 * SideState.guardCharges docstring). `excludeId` is the ordinary case: a
 * protective guard has charges, so the bruiser must lock onto someone else,
 * leaving the guard's eventual redirect a real, visible change of target.
 * `forceId` is the backfired mirror: the slam must lock onto the guardian
 * ITSELF so a backfire can swing visibly AWAY at impact — excluding the
 * eventual victim wouldn't work, since the lowest-HP hero at telegraph time
 * isn't necessarily the lowest-HP hero 1.5s later when the hit lands. Returns
 * null when there's no usable guard: no charges left after reservations, or
 * the guardian has died (in which case the guard is torn down here too, so a
 * stale guardHeroId doesn't linger on the snapshot). */
interface GuardAim {
  forceId?: string;
  excludeId?: string;
}
function guardWindupAim(player: SideState): GuardAim | null {
  const available = (player.guardCharges ?? 0) - (player.guardClaims ?? 0);
  if (available <= 0) return null;
  const guardian = player.guardHeroId ? player.heroes.find((h) => h.id === player.guardHeroId) : undefined;
  if (!guardian || !guardian.alive || guardian.hp <= 0) {
    player.guardCharges = 0;
    player.guardClaims = 0;
    player.guardHeroId = null;
    return null;
  }
  return player.guardInverted ? { forceId: guardian.id } : { excludeId: guardian.id };
}

/** Picks a wind-up's target per the bruiser's own windupTargeting rule
 * (2026-08-09, encounter-table pass — see types.ts's HeroState docstring and
 * sim/encounters.ts). Falls back to the normal weighted rule when unset, so
 * every pre-existing bruiser (no field set) behaves exactly as before.
 *
 * `aim` (guardWindupAim above) is applied on top of that rule rather than
 * instead of it — a forced target short-circuits everything, an excluded
 * target is filtered from the candidate pool before either targeting rule
 * runs, and a pool a filter empties (the guardian is the only living hero)
 * falls back to the unfiltered pick so a telegraph never comes back empty. */
function pickWindupTargetId(
  hero: HeroState,
  player: SideState,
  rng: Rng,
  cfg: FightConfig,
  enemyTargetTally: Map<string, number> | undefined,
  aim?: GuardAim | null,
): string | undefined {
  if (aim?.forceId) {
    const forced = player.heroes.find((h) => h.id === aim.forceId && h.alive && h.hp > 0);
    if (forced) return forced.id;
  }
  const pool: SideState =
    aim?.excludeId && player.heroes.some((h) => h.id === aim.excludeId)
      ? { ...player, heroes: player.heroes.filter((h) => h.id !== aim.excludeId) }
      : player;
  const pick =
    hero.windupTargeting === "lowestHp"
      ? lowestHpAliveHero(pool)?.id
      : pickEnemyTargetId(pool, rng, cfg, enemyTargetTally);
  if (pick) return pick;
  // Excluding the guardian emptied the pool (it's the only living hero) —
  // fall back to the unfiltered pick rather than return no target at all.
  return pool === player
    ? undefined
    : hero.windupTargeting === "lowestHp"
      ? lowestHpAliveHero(player)?.id
      : pickEnemyTargetId(player, rng, cfg, enemyTargetTally);
}

/** excludeId skips the guardian when a backfired guard needs a NEW victim —
 * without it, a backfire whose guardian happens to already be the lowest-HP
 * hero would silently resolve as a protective save (2026-09-15). */
function lowestHpAliveHero(side: SideState, excludeId?: string): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of side.heroes) {
    if (!h.alive || h.hp <= 0 || h.id === excludeId) continue;
    if (!best || h.hp < best.hp) best = h;
  }
  return best;
}

/** Mirror of lowestHpAliveHero above, for the "poundBiggest" chain effect
 * (Rook's identity — config.ts's ChainEffect). Strict `>` so the FIRST body
 * in list order wins an exact tie — matching lowestHpAliveHero's own strict
 * `<`. Not cosmetic: Twins and Glass Pair (sim/encounters.ts) seed their two
 * bodies at identical HP, so this comparison is what decides which one Rook's
 * chain commits to on hit 1. Re-picked every rung (not locked at ignition
 * like the old "siege" rule it replaces), so a chain can switch targets if
 * the current biggest body dies mid-chain. */
function highestHpAliveHero(side: SideState): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of side.heroes) {
    if (!h.alive || h.hp <= 0) continue;
    if (!best || h.hp > best.hp) best = h;
  }
  return best;
}

function isWiped(side: SideState): boolean {
  return side.heroes.every((h) => !h.alive || h.hp <= 0);
}

/** Rolls a normal attack's damage within +/-variance of base. Chain bonus
 * hits and wind-up hits never go through this — they stay exact so the
 * escalating tiers and the telegraph's threat read as clean numbers rather
 * than noisy ones. */
function rollDamage(base: number, rng: Rng, variance: number): number {
  if (variance <= 0) return base;
  const factor = 1 + (rng.next() * 2 - 1) * variance;
  return Math.max(1, Math.round(base * factor));
}

function snapshotHeroes(side: SideState): HeroSnapshot[] {
  return side.heroes.map((h) => ({
    id: h.id,
    name: h.name,
    role: h.role,
    hp: h.hp,
    maxHp: h.maxHp,
    alive: h.alive,
    dealt: h.dealt,
    soaked: h.soaked,
    restored: h.restored,
    hitsTaken: h.hitsTaken,
    holding: h.holding,
    charge: h.charge,
    chainAffinity: h.chainAffinity,
    windupFireT: h.windupFireT,
    windupTargetId: h.windupTargetId,
    nextWindupT: h.nextWindupT,
    windupIntervalSec: h.windupIntervalSec,
    stunnedUntilT: h.stunnedUntilT,
    stunnedFromT: h.stunnedFromT,
    stunnedHeld: h.stunnedHeld,
  }));
}

/** Resolves a hero's ChainPlan for THIS fight (2026-09-13, "a hero's chain
 * names its own enemy" rebuild — see types.ts's ChainPlan docstring).
 * Computed for EVERY hero, enemy sides included: cheap, and harmless for
 * enemies since they never chain and nothing reads their plan. An enemy's
 * `effect` is arbitrary (they author no HeroDef.chainEffect) — never
 * exercised, since only the player side is ever scanned to ignite a chain. */
function resolveChainPlan(cfg: FightConfig, hero: HeroState): ChainPlan {
  return {
    effect: hero.chainEffect ?? "poundBiggest",
    backfireChance: backfireChanceFor(cfg, hero.chainAffinity),
  };
}

function cloneHeroes(heroes: HeroState[], cfg: FightConfig): HeroState[] {
  return heroes.map((h) => ({
    ...h,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    // charge is deliberately NOT reset here (2026-08-14 chain rebuild) — it
    // persists across the whole run; see types.ts's HeroState.charge.
    windupFireT: undefined,
    windupTargetId: undefined,
    chainPlan: resolveChainPlan(cfg, h),
  }));
}

/** One hero's beat: support heroes heal their lowest-HP living ally instead
 * of attacking. Everyone else deals damage to a target picked by `targeting`
 * — "front" (deterministic, player attackers) or "weighted" (enemy
 * attackers). Pushes the attack/heal event and any resulting heroDown
 * events, and credits the acting hero's dealt/restored counters. */
function performHeroAction(
  events: FightEvent[],
  t: number,
  rng: Rng,
  cfg: FightConfig,
  attackerSide: SideState,
  attackerSideLabel: Side,
  defenderSide: SideState,
  defenderSideLabel: Side,
  hero: HeroState,
  isPlayerAttacker: boolean,
  targeting: "front" | "weighted",
  damageMultiplier = 1,
  enemyTargetTally?: Map<string, number>,
): void {
  if (hero.healPerBeat) {
    const target = lowestHpAliveHero(attackerSide);
    if (target) {
      // Capped against the TARGET's own maxHp (2026-08-08 root-cause pass —
      // see config.ts's healMaxFractionOfTargetMaxHp docstring): flat healing
      // silently over-rewarded small HP pools, erasing a squishy attacker's
      // fragility for free.
      const cap = target.maxHp * cfg.healMaxFractionOfTargetMaxHp;
      const amount = Math.min(hero.healPerBeat, cap, target.maxHp - target.hp);
      if (amount > 0) {
        target.hp += amount;
        hero.restored += amount;
        hero.charge += amount * cfg.chargeWeightRestored;
        events.push({ type: "heal", t, side: attackerSideLabel, healerId: hero.id, targetId: target.id, amount });
      }
    }
    // Ward's hybrid identity (2026-08-08, see heroes.ts): the heal doesn't
    // replace the attack when attacksWhileHealing is set — both happen on
    // the same beat, so a two-support comp is no longer an automatic loss.
    if (!hero.attacksWhileHealing) return;
  }
  const targetId =
    targeting === "front" ? frontMostAliveId(defenderSide) : pickEnemyTargetId(defenderSide, rng, cfg, enemyTargetTally);
  if (!targetId) return;
  const base = (hero.damage + (isPlayerAttacker ? attackerSide.dpsBonus : 0)) * damageMultiplier;
  const damage = rollDamage(base, rng, cfg.damageVariance);
  const { died, applied } = applyDamageFrom(defenderSide, targetId, damage, cfg.chargeWeightSoaked);
  hero.dealt += applied;
  hero.charge += applied * cfg.chargeWeightDealt;
  events.push({ type: "attack", t, side: attackerSideLabel, attackerId: hero.id, targetId, damage });
  for (const id of died) events.push({ type: "heroDown", t, side: defenderSideLabel, heroId: id });
}

/** Re-evaluates every living tank's holding/broken state after a beat.
 * Hysteresis (tankBreakFraction < tankRecoverFraction) means a healer
 * pulling a tank back over the recover line is what restores aggro — the
 * mechanism that makes support's job visible and consequential rather than
 * decorative. Pushes tankBreak/tankRecover events on transitions only. */
function updateTankHolding(events: FightEvent[], t: number, side: SideState, sideLabel: Side, cfg: FightConfig): void {
  for (const h of side.heroes) {
    if (h.role !== "tank" || !h.alive) continue;
    const frac = h.hp / h.maxHp;
    if (h.holding && frac <= cfg.tankBreakFraction) {
      h.holding = false;
      events.push({ type: "tankBreak", t, side: sideLabel, heroId: h.id });
    } else if (!h.holding && frac >= cfg.tankRecoverFraction) {
      h.holding = true;
      events.push({ type: "tankRecover", t, side: sideLabel, heroId: h.id });
    }
  }
}

/** The enemy bruiser's telegraphed heavy hit (2026-08-07 rebuild) — see
 * config.ts's FightConfig docstring. A small state machine on the bruiser's
 * own HeroState: idle (normal attack beat) until nextWindupT, then charging
 * (windupFireT set, no normal attacks) until the charge resolves, then back
 * to idle with nextWindupT pushed forward. The wind-up REPLACES the
 * bruiser's beat rather than adding to it — it's the same actor doing a
 * different, telegraphed thing, not bonus damage on top.
 * Returns true if this beat wiped the player side. */
function handleBruiserBeat(
  events: FightEvent[],
  t: number,
  rng: Rng,
  cfg: FightConfig,
  enemy: SideState,
  player: SideState,
  hero: HeroState,
  enemyTargetTally: Map<string, number> | undefined,
): boolean {
  if (hero.windupFireT !== undefined) {
    if (t < hero.windupFireT) return false; // still telegraphing
    // Charge resolves. If the locked target died to something else first,
    // retarget fresh — the threat was real, just not to that hero anymore.
    // The fresh pick still honors a live guard's exclusion (guardWindupAim)
    // so a mid-telegraph death can't hand the guardian back to the RNG.
    const originalTargetId = hero.windupTargetId ?? null;
    const lockedAlive = originalTargetId !== null && player.heroes.some((h) => h.id === originalTargetId && h.alive);
    let targetId = lockedAlive
      ? (originalTargetId as string | undefined)
      : pickWindupTargetId(hero, player, rng, cfg, enemyTargetTally, guardWindupAim(player));
    // `redirect` (2026-09-13 slam-visibility pass, reworked 2026-09-15) names
    // WHY the final target differs from the locked one — a plain retarget
    // (the locked hero died to something else) vs. Bracer's guard stepping
    // in or aside below — so the render layer can tell them apart instead of
    // only seeing an unexplained diff between windupStart's target and this
    // hit's.
    let redirect: "guard" | "guardBackfire" | "targetDied" | null =
      !lockedAlive && originalTargetId !== null ? "targetDied" : null;

    // Release this telegraph's own reservation (if the pick above applied
    // one) before deciding whether a charge is actually spendable — the
    // reservation's only job was keeping a SECOND bruiser's telegraph
    // (Twins, Glass Pair) from also excluding the guardian off the same
    // charge; it plays no further role once this slam is resolving.
    if (hero.windupGuardClaimed) {
      player.guardClaims = Math.max(0, (player.guardClaims ?? 0) - 1);
      hero.windupGuardClaimed = false;
    }

    // Bracer's "guard" chain effect (config.ts's ChainEffect) redirects a
    // telegraphed hit at the moment it lands, not at telegraph start — a
    // real payoff sends it to the guarding hero; a backfire (guardInverted)
    // sends it to the player's own lowest-HP hero (excluding the guardian)
    // instead, Bracer stepping aside rather than stepping in. Spends exactly
    // one charge, and only when the target actually changes — with
    // guardWindupAim steering the telegraph away from (or, backfired, onto)
    // the guardian, a same-target no-op should now be rare, but a guard that
    // became live only after this telegraph already locked its target can
    // still produce one.
    const guardian = player.guardHeroId ? player.heroes.find((h) => h.id === player.guardHeroId) : undefined;
    if (targetId && guardian && guardian.alive && guardian.hp > 0 && (player.guardCharges ?? 0) > 0) {
      if (player.guardInverted) {
        const inverted = lowestHpAliveHero(player, guardian.id)?.id;
        if (inverted && inverted !== targetId) {
          targetId = inverted;
          redirect = "guardBackfire";
          player.guardCharges = (player.guardCharges ?? 0) - 1;
        }
      } else if (guardian.id !== targetId) {
        targetId = guardian.id;
        redirect = "guard";
        player.guardCharges = (player.guardCharges ?? 0) - 1;
      }
    }

    hero.windupFireT = undefined;
    hero.windupTargetId = undefined;
    hero.nextWindupT = t + (hero.windupIntervalSec ?? cfg.windupIntervalSec);
    hero.nextAttackT = t + hero.attackIntervalSec;
    if (!targetId) return false;
    const damage = Math.max(1, Math.round(hero.damage * cfg.windupDamageMultiplier));
    const { died, applied } = applyDamageFrom(player, targetId, damage, cfg.chargeWeightSoaked);
    hero.dealt += applied;
    events.push({ type: "windupHit", t, sourceId: hero.id, targetId, damage, originalTargetId, redirect });
    for (const id of died) events.push({ type: "heroDown", t, side: "player", heroId: id });
    return isWiped(player);
  }
  if (hero.nextWindupT !== undefined && t >= hero.nextWindupT) {
    // A live guard steers the telegraph itself, not just the eventual hit
    // (2026-09-15 slam-provability pass) — see guardWindupAim's docstring.
    // Reserving a claim here (released when this slam resolves, above) is
    // what stops a second bruiser's telegraph from also excluding the
    // guardian off a single shared charge.
    const aim = guardWindupAim(player);
    if (aim) player.guardClaims = (player.guardClaims ?? 0) + 1;
    hero.windupGuardClaimed = aim !== null;
    const targetId = pickWindupTargetId(hero, player, rng, cfg, enemyTargetTally, aim) ?? null;
    hero.windupTargetId = targetId;
    hero.windupFireT = t + cfg.windupTelegraphSec;
    events.push({ type: "windupStart", t, sourceId: hero.id, targetId, fireT: hero.windupFireT });
    return false;
  }
  if (t >= hero.nextAttackT) {
    performHeroAction(events, t, rng, cfg, enemy, "enemy", player, "player", hero, false, "weighted", 1, enemyTargetTally);
    hero.nextAttackT += hero.attackIntervalSec;
    return isWiped(player);
  }
  return false;
}

/** A chain rung's escalated magnitude for a damage/heal effect — the shared
 * escalation curve (config.ts's chainEscalationFactor) times cfg's own
 * chainHitMultiplier, off whichever per-effect base config.ts's ChainEffect
 * fields authored. Rounded and floored at 1, same convention the pre-rebuild
 * formula used. Not used for "guard"/"stun" — those escalate a DURATION, see
 * escalatedDurationSec below, which deliberately skips both the rounding and
 * chainHitMultiplier (a duration isn't damage). */
function escalatedMagnitude(cfg: FightConfig, base: number, hitIndex: number): number {
  return Math.max(1, Math.round(base * cfg.chainHitMultiplier * chainEscalationFactor(cfg, hitIndex)));
}

/** Same curve as escalatedMagnitude, for a "stun" rung's duration in seconds
 * — no rounding, no chainHitMultiplier (a duration is not damage). "guard"
 * no longer escalates on this curve (see resolveChainHit's guard case,
 * 2026-09-15) — its per-rung value is a flat charge, since a charge has no
 * magnitude of its own to escalate. */
function escalatedDurationSec(cfg: FightConfig, baseSec: number, hitIndex: number): number {
  return baseSec * chainEscalationFactor(cfg, hitIndex);
}

/** One target's outcome from a single chain rung. Attack/heal effects that
 * hit several bodies at once (strikeAll, mendAll) produce one of these PER
 * living body; the caller (runFight) pushes one chainHit event per entry, all
 * sharing the same hitIndex and tick — which is what makes strikeAll read as
 * "everyone at once" on the same frame instead of needing its own event
 * shape. "guard" produces a single entry with the guarding hero's own id as
 * targetId (side-level, but the guardian is who the pip belongs to) and
 * charges set; "stun" produces a single entry with the frozen body's id and
 * durationSec/durationTotalSec set. */
interface ChainHitEntry {
  kind: "damage" | "heal" | "guard" | "stun";
  targetId: string | null;
  amount: number;
  intended: number;
  died: string[];
  /** "stun" only — how many seconds THIS link alone added. */
  durationSec?: number;
  /** "stun" only — the target's full remaining freeze after this link lands
   * (target.stunnedUntilT - t), same convention as guard's chargesTotal
   * below: links are additive, so this is the running total a player has
   * bought so far, not a repeat of durationSec. */
  durationTotalSec?: number;
  /** "guard" only — how many slams this rung adds to the guard's charge
   * count. See resolveChainHit's guard case. */
  charges?: number;
  /** "guard" only — the guardian's full pool after this rung's grant. */
  chargesTotal?: number;
}

/** Resolves one rung of the currently-hot hero's chain (2026-09-13, "a
 * hero's chain names its own enemy" rebuild — see config.ts's ChainEffect).
 * The chain always repeats the hero's OWN effect, escalated by hitIndex;
 * `backfire` aims the SAME effect at the wrong side instead of changing what
 * it does — same convention every version of this mechanic has used.
 *
 * Returns null when this rung has nothing to do — every candidate on the
 * target side is dead (damage effects), every ally is already full HP (heal
 * effects), or (stun only) no living body to freeze. The caller treats that
 * exactly like a failed continuation roll: the chain ends. "guard" never
 * whiffs — it is a side-level effect, not aimed at a body, so the player
 * side always exists to receive it. */
function resolveChainHit(
  t: number,
  rng: Rng,
  cfg: FightConfig,
  player: SideState,
  enemy: SideState,
  hero: HeroState,
  hitIndex: number,
  backfire: boolean,
  // "stun" only — this CHAIN's running total of freeze seconds bought so far,
  // per target id (2026-09-16 freeze-layout pass). Owned by runFight, reset
  // at chain start and released at chain end (see releaseStunHold); this
  // function only reads and adds to it, so a hold that spans several rungs
  // stays correct even though each rung is resolved by a separate call.
  stunHeld: Map<string, number>,
): ChainHitEntry[] | null {
  const effect: ChainEffect = hero.chainPlan?.effect ?? "poundBiggest";
  // A damage effect's real payoff lands on the enemy, backfire on the
  // player's own side; a heal effect is the mirror of that (real payoff
  // heals the player's own side, backfire heals the enemy) — same asymmetry
  // every version of this mechanic has used. "guard" is side-level (always
  // the player) and "stun" picks its own target per branch below, so neither
  // reads this.
  const isHealEffect = effect === "mendAll" || effect === "mendOne";
  const targetSide = isHealEffect ? (backfire ? enemy : player) : backfire ? player : enemy;

  switch (effect) {
    case "strikeAll": {
      const targets = targetSide.heroes.filter((h) => h.alive && h.hp > 0);
      if (targets.length === 0) return null;
      const damage = escalatedMagnitude(cfg, cfg.chainStrikeAllBase, hitIndex);
      return targets.map((target) => {
        const { died, applied } = applyDamageFrom(targetSide, target.id, damage, 0, false);
        hero.dealt += applied;
        return { kind: "damage" as const, targetId: target.id, amount: applied, intended: damage, died };
      });
    }
    case "poundBiggest": {
      const target = highestHpAliveHero(targetSide);
      if (!target) return null;
      const damage = escalatedMagnitude(cfg, cfg.chainPoundBase, hitIndex);
      const { died, applied } = applyDamageFrom(targetSide, target.id, damage, 0, false);
      hero.dealt += applied;
      return [{ kind: "damage" as const, targetId: target.id, amount: applied, intended: damage, died }];
    }
    case "mendAll": {
      const allies = targetSide.heroes.filter((h) => h.alive && h.hp > 0 && h.hp < h.maxHp);
      if (allies.length === 0) return null;
      const raw = escalatedMagnitude(cfg, cfg.chainMendAllBase, hitIndex);
      return allies.map((target) => {
        const cap = target.maxHp * cfg.chainHealMaxFractionOfTargetMaxHp;
        const amount = Math.max(1, Math.min(raw, cap, target.maxHp - target.hp));
        target.hp += amount;
        if (!backfire) hero.restored += amount;
        return { kind: "heal" as const, targetId: target.id, amount, intended: raw, died: [] as string[] };
      });
    }
    case "mendOne": {
      const target = lowestHpAliveHero(targetSide);
      if (!target) return null;
      const room = target.maxHp - target.hp;
      if (room <= 0) return null;
      // Chain heals get their own, much higher cap than a normal heal beat
      // (2026-08-15 — see config.ts's chainHealMaxFractionOfTargetMaxHp
      // docstring): at the shared normal-beat cap, a support's chain was
      // capped to single digits regardless of length.
      const cap = target.maxHp * cfg.chainHealMaxFractionOfTargetMaxHp;
      const raw = escalatedMagnitude(cfg, cfg.chainMendOneBase, hitIndex);
      const amount = Math.max(1, Math.min(raw, cap, room));
      target.hp += amount;
      if (!backfire) hero.restored += amount;
      return [{ kind: "heal" as const, targetId: target.id, amount, intended: raw, died: [] as string[] }];
    }
    case "guard": {
      // Side-level, not aimed at a body — always writes to the PLAYER side,
      // since only the enemy ever winds up. A real payoff covers the squad
      // with the firing hero (Bracer); a backfire inverts the redirect onto
      // the player's own lowest-HP hero instead (handleBruiserBeat reads
      // guardInverted) — Bracer stepping aside rather than stepping in.
      // Never whiffs: the player side always exists while the fight runs.
      //
      // A flat charge per rung, not this file's escalation curve (2026-09-15
      // slam-provability pass) — the curve escalates the SIZE of one
      // instance of an effect, and a charge has no size of its own; the
      // number it moves is the bruiser's own damage, authored elsewhere.
      // Running the curve would give a rung-7 chain more charges than a
      // ~20-second fight has slams to spend them on. Total protection still
      // rises with chain length, which is what the curve is linear on below
      // the knee — this just stops pretending a 7th rung buys 7x as much of
      // something a player could ever observe.
      const charges = cfg.chainGuardChargesPerRung;
      player.guardCharges = (player.guardCharges ?? 0) + charges;
      player.guardHeroId = hero.id;
      player.guardInverted = backfire;
      return [
        {
          kind: "guard" as const,
          targetId: hero.id,
          amount: 0,
          intended: 0,
          died: [] as string[],
          charges,
          chargesTotal: player.guardCharges,
        },
      ];
    }
    case "stun": {
      // Payoff: deterministic front-most, same reasoning as a normal player
      // attack — makeEncounterEnemySide puts bruisers first, so this
      // reliably freezes the boss on purpose. Backfire: weighted-random own
      // hero, the same rule an enemy's own attack uses against the player —
      // a stun turned on yourself shouldn't be aimable.
      const targetId = backfire ? pickWeightedTargetId(player, rng, cfg) : frontMostAliveId(enemy);
      const targetSideForLookup = backfire ? player : enemy;
      const target = targetId ? targetSideForLookup.heroes.find((h) => h.id === targetId) : undefined;
      if (!target) return null;
      const sec = escalatedDurationSec(cfg, cfg.chainStunBaseSec, hitIndex);
      // Additive across the whole CHAIN (2026-09-15 freeze-visibility pass,
      // held continuously since 2026-09-16 — see runFight's per-tick pin
      // below, which is what actually keeps this from lapsing between
      // rungs; this function only grows the running total each rung adds
      // to). stunHeld carries the total for THIS chain; if the target
      // walked in already frozen by something else (a still-draining
      // freeze left over from an earlier chain), that leftover is folded in
      // once, on the first rung to touch this target, so nothing already
      // bought is wasted. stunnedFromT anchors the render layer's drain
      // once the chain releases the hold (releaseStunHold) — only moved
      // here when the body wasn't already frozen by anything.
      const alreadyFrozen = (target.stunnedUntilT ?? t) > t;
      if (!alreadyFrozen) target.stunnedFromT = t;
      const carryover = stunHeld.get(target.id) ?? (alreadyFrozen ? target.stunnedUntilT! - t : 0);
      const total = carryover + sec;
      stunHeld.set(target.id, total);
      target.stunnedUntilT = t + total;
      target.stunnedHeld = true;
      target.nextAttackT = Math.max(target.nextAttackT, target.stunnedUntilT);
      if (target.nextWindupT !== undefined) target.nextWindupT = Math.max(target.nextWindupT, target.stunnedUntilT);
      // Cancels an in-progress telegraph outright — this is Hollow's whole
      // point ("cancelling a wind-up in progress"), not merely delaying it.
      target.windupFireT = undefined;
      target.windupTargetId = undefined;
      return [
        {
          kind: "stun" as const,
          targetId: target.id,
          amount: 0,
          intended: 0,
          died: [] as string[],
          durationSec: sec,
          durationTotalSec: total,
        },
      ];
    }
  }
}

/**
 * Runs one fight to completion and returns the full record for replay.
 * Pure function: no DOM, no wall-clock, no imports outside sim/.
 */
export function runFight(setup: FightSetup, cfg: FightConfig, rng: Rng, seed: number): FightResult {
  // Work on private copies so the caller's setup objects aren't mutated.
  const player: SideState = { heroes: cloneHeroes(setup.player.heroes, cfg), dpsBonus: setup.player.dpsBonus };
  const enemy: SideState = { heroes: cloneHeroes(setup.enemy.heroes, cfg), dpsBonus: setup.enemy.dpsBonus };

  const events: FightEvent[] = [];
  const snapshots: TickSnapshot[] = [];

  const dt = 1 / cfg.tickRate;
  const maxTicks = Math.round(cfg.maxFightSec * cfg.tickRate);

  let ignited = false;
  let hotHeroId: string | null = null;
  // Whether the CURRENT chain (hotHeroId) is a backfire — decided once, at
  // fire time, by backfireChanceFor(cfg, firing hero's chainAffinity)
  // (2026-08-14 chain rebuild; per-hero since the 2026-08-19 affinity-as-risk
  // pass — see config.ts's backfireChanceBase docstring). Meaningless while
  // hotHeroId is null.
  let chainBackfire = false;
  // The CURRENT chain's effect (config.ts's ChainEffect) — set the instant
  // hotHeroId is set, cleared the instant it's cleared, so the two are always
  // in lockstep; meaningless while hotHeroId is null, same as chainBackfire
  // above. 2026-09-13 rebuild: every rung of a fired chain now always lands
  // (resolveChainHit returns null only for a TOTAL whiff, which ends the
  // chain outright — see its own docstring), so there is no more separate
  // "hasn't whiffed yet" flag to track alongside this.
  let hotEffect: ChainEffect | null = null;
  let bonusHitsLanded = 0;
  let finalChainLength = 0;
  // Running totals for the CURRENT chain — reset when a chain fires,
  // accumulated on every landed chain hit, and folded into the chainEnd
  // event so the payoff summary ("Rook's chain — 5 hits, 187, Bruiser down")
  // doesn't need the render layer to reconstruct it by re-summing chainHit
  // events itself.
  let chainDamageSoFar = 0;
  let chainKillIds: string[] = [];
  // "stun" links don't move HP (chainDamageSoFar stays 0 for them by
  // construction), so the end card needs its own running total to report
  // what a freeze chain actually bought (2026-09-15 freeze-visibility pass —
  // see fightView.ts's renderChainEndCard, which used to suppress any number
  // for "stun" because there was nothing honest to show).
  let chainStunSoFar = 0;
  // "stun" only (2026-09-16 freeze-layout pass) — per target id, this CHAIN's
  // running total of freeze seconds bought so far. Reset alongside
  // chainStunSoFar at chain start; resolveChainHit adds to it every rung
  // that lands; the per-tick hold below reads it every tick to re-pin each
  // held target's stunnedUntilT so the freeze can't lapse between rungs;
  // releaseStunHold clears it (and each target's own stunnedHeld) the
  // instant the chain ends, wherever that happens.
  let chainStunHeld: Map<string, number> = new Map();
  // A tankless comp is living dangerously from the first tick — counted as a
  // dip immediately, same as the old gate's "no living tank" clause.
  let dipOccurred = !player.heroes.some((h) => h.role === "tank" && h.alive);
  // Smooth-weighted-round-robin state for cfg.enemyTargetMode ===
  // "weightedRoundRobin" (2026-09-04, deciding-factors rig) — see
  // pickRoundRobinTargetId's docstring. One per fight, never read when
  // enemyTargetMode is the default "weighted".
  const enemyTargetTally = new Map<string, number>();
  let outcome: "win" | "loss" | null = null;
  let endReason: "wipe" | "failsafe" = "wipe";
  let endT = 0;

  // Ends the CURRENT chain's freeze hold (2026-09-16 freeze-layout pass) —
  // called at every site that ends a chain, right before hotHeroId/hotEffect
  // themselves get cleared. Leaves stunnedUntilT exactly where the last hold
  // tick pinned it (still correctly in the future, still tickable down to
  // zero on its own from here) but re-anchors stunnedFromT to THIS instant,
  // so the render layer's post-chain drain starts from "full" at the moment
  // the chain actually ended, not from whenever the freeze first began —
  // that's what makes a freeze held for several seconds still visibly drain
  // its own real length, not look mostly-drained already at the moment the
  // hold lets go. No-op (empty map) for every chain whose effect isn't
  // "stun".
  function releaseStunHold(atT: number): void {
    if (chainStunHeld.size === 0) return;
    for (const id of chainStunHeld.keys()) {
      const held = player.heroes.find((h) => h.id === id) ?? enemy.heroes.find((h) => h.id === id);
      if (held) {
        held.stunnedHeld = false;
        held.stunnedFromT = atT;
      }
    }
    chainStunHeld = new Map();
  }

  for (let tick = 1; tick <= maxTicks; tick++) {
    const t = tick * dt;
    endT = t;

    // Player heroes act on their own beats, targeting the front-most living
    // enemy — deterministic, so the player can reliably focus down the
    // bruiser. The hot hero also rolls its chain on the same beat, and its
    // beat itself runs faster while hot (hotBeatIntervalFactor) — the chain
    // visibly accelerates the hot hero's cadence.
    for (const hero of player.heroes) {
      if (!hero.alive || outcome || t < hero.nextAttackT) continue;
      const isHot = hero.id === hotHeroId;
      performHeroAction(events, t, rng, cfg, player, "player", enemy, "enemy", hero, true, "front");
      hero.nextAttackT += hero.attackIntervalSec * (isHot ? cfg.hotBeatIntervalFactor : 1);
      if (isWiped(enemy)) {
        outcome = "win";
        continue;
      }
      if (isHot) {
        // capped/rolled kept separate from `hits` (2026-08-19 chain-ending
        // pass) so the miss branch below can report WHY the chain ended —
        // continuation roll failed, the hard cap forced it, or the roll
        // passed but resolveChainHit found no valid target at all — instead
        // of collapsing all three into one identical event. Every hero now
        // shares one continuation table and cap (config.ts's
        // chainChanceByHitsSoFar/chainMaxHits) — see this file's 2026-09-13
        // rebuild; chainContinuationScale still applies on top, a global
        // damper checks/beatsheet.ts and checks/projection.ts use to disable
        // continuation entirely.
        const capped = bonusHitsLanded >= cfg.chainMaxHits;
        const chance = capped ? 0 : chainContinuationChance(cfg, bonusHitsLanded);
        const rolled = rng.chance(chance);
        const hits = rolled
          ? resolveChainHit(t, rng, cfg, player, enemy, hero, bonusHitsLanded + 1, chainBackfire, chainStunHeld)
          : null;
        if (hits) {
          const hitIndex = bonusHitsLanded + 1;
          const downSide: Side = chainBackfire ? "player" : "enemy";
          for (const hit of hits) {
            events.push({
              type: "chainHit",
              t,
              hitIndex,
              damage: hit.amount,
              intended: hit.intended,
              targetId: hit.targetId,
              kind: hit.kind,
              backfire: chainBackfire,
              sourceId: hero.id,
              durationSec: hit.durationSec,
              durationTotalSec: hit.durationTotalSec,
              charges: hit.charges,
              chargesTotal: hit.chargesTotal,
            });
            for (const id of hit.died) events.push({ type: "heroDown", t, side: downSide, heroId: id });
            chainDamageSoFar += hit.amount;
            chainStunSoFar += hit.durationSec ?? 0;
            chainKillIds.push(...hit.died);
          }
          bonusHitsLanded = hitIndex;
          if (chainBackfire) {
            if (isWiped(player)) outcome = "loss";
          } else if (isWiped(enemy)) {
            outcome = "win";
          }
        } else {
          const reason: "miss" | "capped" | "noTarget" = capped ? "capped" : rolled ? "noTarget" : "miss";
          events.push({
            type: "chainEnd",
            t,
            chainLength: bonusHitsLanded,
            // hero.id here, not hotHeroId — isHot already established
            // hero.id === hotHeroId, and hero.id is narrowed to string while
            // hotHeroId's declared type stays `string | null`.
            heroId: hero.id,
            totalDamage: chainDamageSoFar,
            totalStunSec: chainStunSoFar,
            killedIds: chainKillIds,
            backfire: chainBackfire,
            reason,
            effect: hotEffect!,
          });
          finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
          releaseStunHold(t);
          hotHeroId = null;
          hotEffect = null;
        }
      }
    }

    // Enemy heroes act on their own beats. The bruiser runs its wind-up
    // state machine (charge/fire, replacing its normal attack while
    // telegraphing); everyone else attacks a weighted-random living player
    // hero, same as before — see pickWeightedTargetId's docstring for why.
    if (!outcome) {
      for (const hero of enemy.heroes) {
        if (!hero.alive || outcome) continue;
        let wiped = false;
        if (hero.role === "bruiser") {
          wiped = handleBruiserBeat(events, t, rng, cfg, enemy, player, hero, enemyTargetTally);
        } else if (t >= hero.nextAttackT) {
          performHeroAction(events, t, rng, cfg, enemy, "enemy", player, "player", hero, false, "weighted", 1, enemyTargetTally);
          hero.nextAttackT += hero.attackIntervalSec;
          wiped = isWiped(player);
        }
        if (wiped) outcome = "loss";
      }
    }

    // A tank's line can break (or recover, if healed back up) on any beat
    // that changed its HP — checked once per tick rather than inline in
    // performHeroAction so a hero hit by multiple attackers in one tick only
    // transitions once, cleanly ordered after all of this tick's damage.
    if (!outcome) {
      updateTankHolding(events, t, player, "player", cfg);
      if (player.heroes.some((h) => h.role === "tank" && h.alive && !h.holding)) dipOccurred = true;
    }

    // The hot hero can die mid-chain — to its own backfire (in the player
    // loop above) or to an enemy hit (in the enemy loop above) — and this
    // per-hero loop skips dead heroes, so without this sweep hotHeroId would
    // stay set on a corpse for the rest of the fight: no other hero could
    // ever fire again (the eligibility check below), and every later
    // snapshot would keep naming a dead hero as hot (2026-08-29, Phase 0 of
    // the chain-targeting plan — see CHAIN_TARGETING_IMPLEMENTATION_PLAN.md's
    // 0.1). Closing it out here, before the eligibility check, lets a fresh
    // chain fire the same tick if some other hero is already past threshold.
    if (!outcome && hotHeroId !== null) {
      const hotHero = player.heroes.find((h) => h.id === hotHeroId);
      if (!hotHero || !hotHero.alive) {
        events.push({
          type: "chainEnd",
          t,
          chainLength: bonusHitsLanded,
          heroId: hotHeroId,
          totalDamage: chainDamageSoFar,
          totalStunSec: chainStunSoFar,
          killedIds: chainKillIds,
          backfire: chainBackfire,
          reason: "sourceDied",
          // hotEffect is always set in lockstep with hotHeroId (see its own
          // declaration comment above) — non-null here by that invariant.
          effect: hotEffect!,
        });
        finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
        releaseStunHold(t);
        hotHeroId = null;
        hotEffect = null;
      }
    }

    // Chain trigger (2026-08-14 rebuild — see config.ts's FightConfig
    // docstring and DECISIONS.md). Only checked while no chain is currently
    // running (hotHeroId === null) — a second hero crossing threshold
    // mid-chain waits its turn rather than interrupting it. The
    // highest-charge living hero fires the INSTANT its charge crosses
    // chargeThreshold — no candidate contest beyond breaking a same-tick tie,
    // and no roll on whether it happens. Every hero is eligible now,
    // including a pure healer — its chain is a heal, not an attack (see
    // resolveChainHit).
    if (!outcome && hotHeroId === null) {
      let ready: HeroState | undefined;
      for (const h of player.heroes) {
        if (!h.alive || h.charge < cfg.chargeThreshold) continue;
        if (!ready || h.charge > ready.charge) ready = h;
      }
      if (ready) {
        ready.charge = 0;
        ignited = true;
        hotHeroId = ready.id;
        // The roll always happens, whether or not cfg.forceBackfire overrides
        // what it decides — see that field's own docstring (config.ts) for
        // why this keeps the RNG stream identical to today's game.
        const rolled = rng.chance(backfireChanceFor(cfg, ready.chainAffinity));
        chainBackfire = cfg.forceBackfire === undefined ? rolled : cfg.forceBackfire === "always";
        hotEffect = ready.chainPlan?.effect ?? "poundBiggest";
        bonusHitsLanded = 0;
        chainDamageSoFar = 0;
        chainStunSoFar = 0;
        chainKillIds = [];
        chainStunHeld = new Map();
        events.push({ type: "chainStart", t, heroId: ready.id, backfire: chainBackfire, effect: hotEffect });
      }
    }

    // Freeze hold (2026-09-16 freeze-layout pass) — while a "stun" chain is
    // still live, re-pin every target it has frozen so far to
    // `t + (this chain's running total for that target)`, EVERY tick, not
    // just on the tick a rung lands. Rungs land on Hollow's own ~0.66s
    // cadence; the running total after only one or two rungs is often
    // shorter than that gap, so without this the freeze would still lapse
    // between rungs even though the total never resets (resolveChainHit
    // alone isn't enough — see that function's own stun case). Also re-pins
    // nextAttackT/nextWindupT past the held stunnedUntilT, same as
    // resolveChainHit does at hit time, so the body stays unable to act for
    // exactly as long as it visibly reads frozen. Once the chain ends
    // (releaseStunHold, above), this block simply stops running for that
    // chain's targets and they drain normally from wherever this left them.
    if (!outcome && hotHeroId !== null && hotEffect === "stun" && chainStunHeld.size > 0) {
      const stunSide = chainBackfire ? player : enemy;
      for (const [id, total] of chainStunHeld) {
        const held = stunSide.heroes.find((h) => h.id === id);
        if (!held) continue;
        held.stunnedUntilT = t + total;
        held.nextAttackT = Math.max(held.nextAttackT, held.stunnedUntilT);
        if (held.nextWindupT !== undefined) held.nextWindupT = Math.max(held.nextWindupT, held.stunnedUntilT);
      }
    }

    snapshots.push({
      t,
      playerHp: sideHp(player),
      playerMaxHp: sideMaxHp(player),
      enemyHp: sideHp(enemy),
      enemyMaxHp: sideMaxHp(enemy),
      playerHeroes: snapshotHeroes(player),
      enemyHeroes: snapshotHeroes(enemy),
      hotHeroId,
      chainBackfire,
      visibleChainLength: bonusHitsLanded,
      chainDamageSoFar: hotHeroId ? chainDamageSoFar : 0,
      chainEffect: hotHeroId ? hotEffect : null,
      guardHeroId: player.guardHeroId ?? null,
      guardCharges: player.guardCharges ?? 0,
      guardInverted: player.guardInverted ?? false,
    });

    if (outcome) break;
  }

  if (!outcome) {
    // Failsafe only — should not happen given the stat blocks in config.ts,
    // but the sim must never hang. Resolve by HP fraction.
    const playerFraction = sideMaxHp(player) > 0 ? sideHp(player) / sideMaxHp(player) : 0;
    const enemyFraction = sideMaxHp(enemy) > 0 ? sideHp(enemy) / sideMaxHp(enemy) : 0;
    outcome = playerFraction >= enemyFraction ? "win" : "loss";
    endReason = "failsafe";
  }

  // If a chain was still running when the fight ended, close it out.
  if (hotHeroId) {
    events.push({
      type: "chainEnd",
      t: endT,
      chainLength: bonusHitsLanded,
      heroId: hotHeroId,
      totalDamage: chainDamageSoFar,
      totalStunSec: chainStunSoFar,
      killedIds: chainKillIds,
      backfire: chainBackfire,
      reason: "fightEnd",
      // hotEffect is always set in lockstep with hotHeroId (see its own
      // declaration comment above) — non-null here by that invariant.
      effect: hotEffect!,
    });
    finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
    // No more ticks/snapshots follow the fight ending, so this has nothing
    // left to render — closes out HeroState consistently regardless.
    releaseStunHold(endT);
  }

  events.push({ type: "resolve", t: endT, outcome, reason: endReason });

  return {
    seed,
    events,
    snapshots,
    outcome,
    endReason,
    ignited,
    chainLength: finalChainLength,
    durationSec: endT,
    finalPlayerHeroes: snapshotHeroes(player),
    dipOccurred,
  };
}
