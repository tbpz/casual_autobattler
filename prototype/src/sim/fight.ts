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

/** Picks a wind-up's target per the bruiser's own windupTargeting rule
 * (2026-08-09, encounter-table pass — see types.ts's HeroState docstring and
 * sim/encounters.ts). Falls back to the normal weighted rule when unset, so
 * every pre-existing bruiser (no field set) behaves exactly as before. */
function pickWindupTargetId(
  hero: HeroState,
  player: SideState,
  rng: Rng,
  cfg: FightConfig,
  enemyTargetTally: Map<string, number> | undefined,
): string | undefined {
  if (hero.windupTargeting === "lowestHp") return lowestHpAliveHero(player)?.id;
  return pickEnemyTargetId(player, rng, cfg, enemyTargetTally);
}

function lowestHpAliveHero(side: SideState): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of side.heroes) {
    if (!h.alive || h.hp <= 0) continue;
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
    const lockedAlive = hero.windupTargetId && player.heroes.some((h) => h.id === hero.windupTargetId && h.alive);
    let targetId = lockedAlive ? (hero.windupTargetId as string) : pickWindupTargetId(hero, player, rng, cfg, enemyTargetTally);
    // Bracer's "guard" chain effect (config.ts's ChainEffect) redirects a
    // telegraphed hit at the moment it lands, not at telegraph start — a
    // real payoff sends it to the guarding hero; a backfire (guardInverted)
    // sends it to the player's own lowest-HP hero instead, Bracer stepping
    // aside rather than stepping in. A window in time (guardUntilT), not a
    // single consumable charge — every wind-up that fires before it expires
    // redirects, which is what lets a long chain guard several cycles.
    if (player.guardUntilT !== undefined && t < player.guardUntilT) {
      if (player.guardInverted) {
        targetId = lowestHpAliveHero(player)?.id ?? targetId;
      } else {
        const guardian = player.heroes.find((h) => h.id === player.guardHeroId && h.alive);
        if (guardian) targetId = guardian.id;
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
    events.push({ type: "windupHit", t, targetId, damage });
    for (const id of died) events.push({ type: "heroDown", t, side: "player", heroId: id });
    return isWiped(player);
  }
  if (hero.nextWindupT !== undefined && t >= hero.nextWindupT) {
    const targetId = pickWindupTargetId(hero, player, rng, cfg, enemyTargetTally) ?? null;
    hero.windupTargetId = targetId;
    hero.windupFireT = t + cfg.windupTelegraphSec;
    events.push({ type: "windupStart", t, targetId, fireT: hero.windupFireT });
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

/** Same curve as escalatedMagnitude, for a "guard"/"stun" rung's duration in
 * seconds — no rounding, no chainHitMultiplier (a duration is not damage). */
function escalatedDurationSec(cfg: FightConfig, baseSec: number, hitIndex: number): number {
  return baseSec * chainEscalationFactor(cfg, hitIndex);
}

/** One target's outcome from a single chain rung. Attack/heal effects that
 * hit several bodies at once (strikeAll, mendAll) produce one of these PER
 * living body; the caller (runFight) pushes one chainHit event per entry, all
 * sharing the same hitIndex and tick — which is what makes strikeAll read as
 * "everyone at once" on the same frame instead of needing its own event
 * shape. "guard" produces a single entry with no targetId (the effect is
 * side-level, not aimed at a body) and durationSec set; "stun" produces a
 * single entry with the frozen body's id and durationSec set. */
interface ChainHitEntry {
  kind: "damage" | "heal" | "guard" | "stun";
  targetId: string | null;
  amount: number;
  intended: number;
  died: string[];
  durationSec?: number;
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
      const sec = escalatedDurationSec(cfg, cfg.chainGuardBaseSec, hitIndex);
      player.guardUntilT = Math.max(player.guardUntilT ?? t, t + sec);
      player.guardHeroId = hero.id;
      player.guardInverted = backfire;
      return [{ kind: "guard" as const, targetId: hero.id, amount: 0, intended: 0, died: [] as string[], durationSec: sec }];
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
      target.stunnedUntilT = Math.max(target.stunnedUntilT ?? t, t + sec);
      target.nextAttackT = Math.max(target.nextAttackT, target.stunnedUntilT);
      if (target.nextWindupT !== undefined) target.nextWindupT = Math.max(target.nextWindupT, target.stunnedUntilT);
      // Cancels an in-progress telegraph outright — this is Hollow's whole
      // point ("cancelling a wind-up in progress"), not merely delaying it.
      target.windupFireT = undefined;
      target.windupTargetId = undefined;
      return [{ kind: "stun" as const, targetId: target.id, amount: 0, intended: 0, died: [] as string[], durationSec: sec }];
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
        const hits = rolled ? resolveChainHit(t, rng, cfg, player, enemy, hero, bonusHitsLanded + 1, chainBackfire) : null;
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
            });
            for (const id of hit.died) events.push({ type: "heroDown", t, side: downSide, heroId: id });
            chainDamageSoFar += hit.amount;
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
            killedIds: chainKillIds,
            backfire: chainBackfire,
            reason,
            effect: hotEffect!,
          });
          finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
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
          killedIds: chainKillIds,
          backfire: chainBackfire,
          reason: "sourceDied",
          // hotEffect is always set in lockstep with hotHeroId (see its own
          // declaration comment above) — non-null here by that invariant.
          effect: hotEffect!,
        });
        finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
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
        chainKillIds = [];
        events.push({ type: "chainStart", t, heroId: ready.id, backfire: chainBackfire, effect: hotEffect });
      }
    }

    const bruiser = enemy.heroes.find((h) => h.role === "bruiser");

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
      windupTargetId: bruiser?.alive && bruiser.windupFireT !== undefined ? (bruiser.windupTargetId ?? null) : null,
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
      killedIds: chainKillIds,
      backfire: chainBackfire,
      reason: "fightEnd",
      // hotEffect is always set in lockstep with hotHeroId (see its own
      // declaration comment above) — non-null here by that invariant.
      effect: hotEffect!,
    });
    finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
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
