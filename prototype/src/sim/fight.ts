import type { Rng } from "./rng.js";
import type { FightConfig } from "./config.js";
import { prdLookup } from "./config.js";
import type { FightSetup, HeroState, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightEvent, FightResult, HeroSnapshot, Side, TickSnapshot } from "./events.js";

/**
 * Credits a hero's heatGift (2026-08-09, heat-flow pass — see types.ts's
 * HeroState docstring): when `actingHero` did the gift's `on` thing, a
 * fraction of `amount` (the raw dealt/soaked/healed/etc. quantity, same
 * scale the acting hero's OWN heatWeight* credit uses) is credited to
 * another living ally on `side`, scaled by the RECIPIENT's own
 * chainAffinity — not the giver's — so the gift's value depends on who
 * receives it, same as every hero's own heat always has. `explicitTarget`
 * is required for `to: "target"` (currently only Cairn's "healed" gift,
 * where the recipient is whoever was just healed, not derivable from `side`
 * alone). No-ops silently if actingHero has no heatGift, or its `on` doesn't
 * match — callers pass the specific `on` they're firing so one function
 * covers every site without each site needing to know the others exist. */
function applyHeatGift(
  side: SideState,
  actingHero: HeroState,
  on: NonNullable<HeroState["heatGift"]>["on"],
  amount: number,
  explicitTarget?: HeroState,
): void {
  const gift = actingHero.heatGift;
  if (!gift || gift.on !== on || amount <= 0) return;
  const gifted = amount * gift.fraction;
  const creditTo = (h: HeroState) => {
    h.heat += gifted * h.chainAffinity;
  };
  if (gift.to === "target") {
    if (explicitTarget?.alive) creditTo(explicitTarget);
    return;
  }
  const others = side.heroes.filter((h) => h.alive && h.id !== actingHero.id);
  if (gift.to === "all") {
    for (const h of others) creditTo(h);
    return;
  }
  if (gift.to === "lowestHeat") {
    let best: HeroState | undefined;
    for (const h of others) if (!best || h.heat < best.heat) best = h;
    if (best) creditTo(best);
    return;
  }
  if (gift.to === "highestAffinity") {
    let best: HeroState | undefined;
    for (const h of others) if (!best || h.chainAffinity > best.chainAffinity) best = h;
    if (best) creditTo(best);
  }
}

/**
 * Applies `amount` damage starting at the hero with id `startId`, overflowing
 * to the next living hero in list order if the hit is a killing blow with
 * damage to spare. Used for every normal attack (single-target) and for the
 * chain's bonus hits — both are concentrated hits, never splash. Returns the
 * ids of heroes that died, in list order, and the damage actually applied
 * (<= amount — less if the side didn't have enough total HP to absorb it),
 * which the caller credits to the attacker's `dealt` counter.
 */
function applyDamageFrom(
  side: SideState,
  startId: string,
  amount: number,
  heatWeightSoaked = 0,
): { died: string[]; applied: number } {
  const startIdx = side.heroes.findIndex((h) => h.id === startId);
  if (startIdx < 0) return { died: [], applied: 0 };
  let remaining = amount;
  const died: string[] = [];
  for (let i = startIdx; i < side.heroes.length && remaining > 0; i++) {
    const hero = side.heroes[i];
    if (!hero || !hero.alive || hero.hp <= 0) continue;
    const taken = Math.min(hero.hp, remaining);
    hero.hp -= taken;
    hero.soaked += taken;
    hero.heat += taken * heatWeightSoaked * hero.chainAffinity;
    applyHeatGift(side, hero, "soaked", taken);
    hero.hitsTaken += 1;
    remaining -= taken;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.alive = false;
      died.push(hero.id);
    }
  }
  return { died, applied: amount - remaining };
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

/** Picks a wind-up's target per the bruiser's own windupTargeting rule
 * (2026-08-09, encounter-table pass — see types.ts's HeroState docstring and
 * sim/encounters.ts). Falls back to the normal weighted rule when unset, so
 * every pre-existing bruiser (no field set) behaves exactly as before. */
function pickWindupTargetId(hero: HeroState, player: SideState, rng: Rng, cfg: FightConfig): string | undefined {
  if (hero.windupTargeting === "lowestHp") return lowestHpAliveHero(player)?.id;
  return pickWeightedTargetId(player, rng, cfg);
}

function lowestHpAliveHero(side: SideState): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of side.heroes) {
    if (!h.alive || h.hp <= 0) continue;
    if (!best || h.hp < best.hp) best = h;
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

/** Enemy damage multiplier from the enrage clock (2026-08-07 rebuild,
 * extended 2026-08-08) — two additive terms on top of 1x. The wall-clock
 * term ramps linearly from enrageStartSec. The HP-lost term (2026-08-08 root-
 * cause pass — see config.ts's enrageFromEnemyHpLostFactor docstring) scales
 * with the fraction of the enemy side's starting HP already destroyed, so a
 * comp that kills fast still reaches the angry phase — via HP lost rather
 * than seconds elapsed — instead of out-racing enrage entirely. Applies to
 * both normal enemy attacks and wind-up hits, so the cost of a slow OR a
 * fast-but-incomplete fight grows for the whole enemy side, not just the
 * bruiser. See config.ts's FightConfig docstring for why the wall-clock term
 * resets every fight rather than compounding across the run; the HP-lost
 * term is naturally per-fight for the same reason (enemy HP resets). */
function enrageMultiplierAt(t: number, enemy: SideState, cfg: FightConfig): number {
  const timeTerm = t <= cfg.enrageStartSec ? 0 : (t - cfg.enrageStartSec) * cfg.enrageRampPerSec;
  const maxHp = sideMaxHp(enemy);
  const lostFraction = maxHp > 0 ? 1 - sideHp(enemy) / maxHp : 0;
  return 1 + timeTerm + lostFraction * cfg.enrageFromEnemyHpLostFactor;
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
    heat: h.heat,
  }));
}

function cloneHeroes(heroes: HeroState[]): HeroState[] {
  return heroes.map((h) => ({
    ...h,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    heat: 0,
    windupFireT: undefined,
    windupTargetId: undefined,
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
        hero.heat += amount * cfg.heatWeightRestored * hero.chainAffinity;
        applyHeatGift(attackerSide, hero, "healed", amount, target);
        events.push({ type: "heal", t, side: attackerSideLabel, healerId: hero.id, targetId: target.id, amount });
      }
    }
    // Ward's hybrid identity (2026-08-08, see heroes.ts): the heal doesn't
    // replace the attack when attacksWhileHealing is set — both happen on
    // the same beat, so a two-support comp is no longer an automatic loss.
    if (!hero.attacksWhileHealing) return;
  }
  const targetId =
    targeting === "front" ? frontMostAliveId(defenderSide) : pickWeightedTargetId(defenderSide, rng, cfg);
  if (!targetId) return;
  const base = (hero.damage + (isPlayerAttacker ? attackerSide.dpsBonus : 0)) * damageMultiplier;
  const damage = rollDamage(base, rng, cfg.damageVariance);
  const { died, applied } = applyDamageFrom(defenderSide, targetId, damage, cfg.heatWeightSoaked);
  hero.dealt += applied;
  hero.heat += applied * cfg.heatWeightDealt * hero.chainAffinity;
  applyHeatGift(attackerSide, hero, "dealt", applied);
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
      // Heat-gift "break" site (2026-08-09 — see Hollow's heatGift in
      // heroes.ts): unlike the continuous dealt/soaked/healed sites, a break
      // is a discrete event with no natural "raw amount" of its own, so the
      // gifted quantity is a fraction of cfg.heatThreshold itself — "how
      // much of a full meter does the dip hand out" rather than scaling off
      // any one hit.
      applyHeatGift(side, h, "break", cfg.heatThreshold);
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
  enrageMult: number,
): boolean {
  if (hero.windupFireT !== undefined) {
    if (t < hero.windupFireT) return false; // still telegraphing
    // Charge resolves. If the locked target died to something else first,
    // retarget fresh — the threat was real, just not to that hero anymore.
    const lockedAlive = hero.windupTargetId && player.heroes.some((h) => h.id === hero.windupTargetId && h.alive);
    const targetId = lockedAlive ? (hero.windupTargetId as string) : pickWindupTargetId(hero, player, rng, cfg);
    hero.windupFireT = undefined;
    hero.windupTargetId = undefined;
    hero.nextWindupT = t + cfg.windupIntervalSec;
    hero.nextAttackT = t + hero.attackIntervalSec;
    if (!targetId) return false;
    const damage = Math.max(1, Math.round(hero.damage * cfg.windupDamageMultiplier * enrageMult));
    const { died, applied } = applyDamageFrom(player, targetId, damage, cfg.heatWeightSoaked);
    hero.dealt += applied;
    events.push({ type: "windupHit", t, targetId, damage });
    for (const id of died) events.push({ type: "heroDown", t, side: "player", heroId: id });
    return isWiped(player);
  }
  if (hero.nextWindupT !== undefined && t >= hero.nextWindupT) {
    const targetId = pickWindupTargetId(hero, player, rng, cfg) ?? null;
    hero.windupTargetId = targetId;
    hero.windupFireT = t + cfg.windupTelegraphSec;
    events.push({ type: "windupStart", t, targetId, fireT: hero.windupFireT });
    return false;
  }
  if (t >= hero.nextAttackT) {
    performHeroAction(events, t, rng, cfg, enemy, "enemy", player, "player", hero, false, "weighted", enrageMult);
    hero.nextAttackT += hero.attackIntervalSec;
    return isWiped(player);
  }
  return false;
}

/**
 * Runs one fight to completion and returns the full record for replay.
 * Pure function: no DOM, no wall-clock, no imports outside sim/.
 */
export function runFight(setup: FightSetup, cfg: FightConfig, rng: Rng, seed: number): FightResult {
  // Work on private copies so the caller's setup objects aren't mutated.
  const player: SideState = { heroes: cloneHeroes(setup.player.heroes), dpsBonus: setup.player.dpsBonus };
  const enemy: SideState = { heroes: cloneHeroes(setup.enemy.heroes), dpsBonus: setup.enemy.dpsBonus };

  const events: FightEvent[] = [];
  const snapshots: TickSnapshot[] = [];

  const dt = 1 / cfg.tickRate;
  const maxTicks = Math.round(cfg.maxFightSec * cfg.tickRate);

  let ignited = false;
  let hotHeroId: string | null = null;
  let bonusHitsLanded = 0;
  let finalChainLength = 0;
  // Spent-per-roll PRD counter (2026-08-08 "heat is spent" rebuild) — an
  // "attempt" is a single roll, not a fight, since heat now resets and can
  // rebuild several times within one fight. Starts from whatever the
  // previous fight ended with (setup.attemptsSinceIgnition); its final value
  // here is returned on FightResult for the run wrapper to carry forward.
  let attemptsSinceIgnition = setup.attemptsSinceIgnition;
  // A tankless comp is living dangerously from the first tick — counted as a
  // dip immediately, same as the old gate's "no living tank" clause.
  let dipOccurred = !player.heroes.some((h) => h.role === "tank" && h.alive);
  let enrageStarted = false;

  let outcome: "win" | "loss" | null = null;
  let endReason: "wipe" | "failsafe" = "wipe";
  let endT = 0;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const t = tick * dt;
    endT = t;

    const enrageMult = enrageMultiplierAt(t, enemy, cfg);
    // 2026-08-09 fix: this used to test `enrageMult > 1`, which the HP-lost
    // term (config.ts's enrageFromEnemyHpLostFactor) makes true the instant
    // any enemy takes damage — so the "enemy enrage begins" tell fired at
    // t~1s in every fight, not at enrageStartSec, meaning nothing. Gate the
    // TELL on the wall-clock term only; enrageMult itself (used for actual
    // damage below) is unchanged and still includes both terms.
    if (!enrageStarted && t > cfg.enrageStartSec) {
      enrageStarted = true;
      events.push({ type: "enrageStart", t });
    }

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
        const chance = bonusHitsLanded >= cfg.chainMaxHits ? 0 : prdLookup(cfg.chainChanceByHitsSoFar, bonusHitsLanded);
        if (rng.chance(chance)) {
          const hitIndex = bonusHitsLanded + 1;
          // Multiplicative off the hot hero's own damage (PLUS the run's
          // dpsBonus upgrade — 2026-08-09 fix: this was reading raw
          // hero.damage only, so the one thing coin buys never touched the
          // one thing the game is built around) AND its own chainAffinity
          // (2026-08-07/08) — see config.ts's FightConfig docstring: a Vex
          // chain is explosive, a Bracer chain is a damp squib, so squad
          // choice sets the ceiling's SIZE, not just whether it's reachable.
          const damage = Math.max(
            1,
            Math.round((hero.damage + player.dpsBonus) * cfg.chainHitMultiplier * hitIndex * hero.chainAffinity),
          );
          const targetId = frontMostAliveId(enemy);
          if (targetId) {
            const { died, applied } = applyDamageFrom(enemy, targetId, damage);
            hero.dealt += applied;
            // Rook's "chainHit" gift (2026-08-09, see heroes.ts): a chain
            // hit itself doesn't run through performHeroAction (it's a
            // separate escalating-damage path, not a normal attack), so this
            // site needs its own applyHeatGift call rather than picking one
            // up for free the way "dealt" does above.
            applyHeatGift(player, hero, "chainHit", applied);
            events.push({ type: "chainHit", t, hitIndex, damage, targetId });
            for (const id of died) events.push({ type: "heroDown", t, side: "enemy", heroId: id });
            bonusHitsLanded = hitIndex;
            if (isWiped(enemy)) outcome = "win";
          }
        } else {
          events.push({ type: "chainEnd", t, chainLength: bonusHitsLanded });
          finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
          hotHeroId = null;
        }
      }
    }

    // Enemy heroes act on their own beats. The bruiser runs its wind-up
    // state machine (charge/fire, replacing its normal attack while
    // telegraphing); everyone else attacks a weighted-random living player
    // hero, same as before — see pickWeightedTargetId's docstring for why.
    // Both routes scale by the current enrage multiplier.
    if (!outcome) {
      for (const hero of enemy.heroes) {
        if (!hero.alive || outcome) continue;
        let wiped = false;
        if (hero.role === "bruiser") {
          wiped = handleBruiserBeat(events, t, rng, cfg, enemy, player, hero, enrageMult);
        } else if (t >= hero.nextAttackT) {
          performHeroAction(events, t, rng, cfg, enemy, "enemy", player, "player", hero, false, "weighted", enrageMult);
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

    // Heat-based ignition eligibility (2026-08-07 rebuild, replaces the old
    // pity-gate — see config.ts's FightConfig docstring and DECISIONS.md's
    // "fight causality rebuild" entry). Only checked while no chain is
    // currently running (hotHeroId === null) — a second candidate crossing
    // threshold mid-chain waits its turn rather than interrupting it.
    // 2026-08-08: the CANDIDATE is the highest-heat living hero, not the
    // first in array order (which always favored the tank); and heat is
    // SPENT on the roll — win or lose — rather than latching out after one
    // attempt per fight forever, so a squad that keeps taking damage keeps
    // earning shots within the same fight. See config.ts's docstring.
    if (!outcome && hotHeroId === null) {
      let candidate: HeroState | undefined;
      for (const h of player.heroes) {
        if (!h.alive || h.heat < cfg.heatThreshold) continue;
        // 2026-08-09 fix: a pure healer (healPerBeat set, no
        // attacksWhileHealing — i.e. Cairn) never reaches the chain-hit
        // branch below, since performHeroAction returns before the attack
        // path on every one of its own beats. Before this guard it could
        // still WIN the ignition roll — burning the roll and the whole PRD
        // chain for ~1 damage/hit while every other candidate's heat kept
        // accruing unspent. Exclude it from candidacy so only a hero that
        // can actually land a chain hit ever goes hot.
        if (h.healPerBeat && !h.attacksWhileHealing) continue;
        if (!candidate || h.heat > candidate.heat) candidate = h;
      }
      if (candidate) {
        events.push({ type: "heatFull", t, heroId: candidate.id });
        const ignitionChance = prdLookup(cfg.ignitionChanceByAttemptsSinceIgnition, attemptsSinceIgnition);
        const fired = rng.chance(ignitionChance);
        candidate.heat = 0;
        if (fired) {
          ignited = true;
          hotHeroId = candidate.id;
          bonusHitsLanded = 0;
          attemptsSinceIgnition = 0;
        } else {
          attemptsSinceIgnition += 1;
        }
        events.push({ type: "ignitionRoll", t, fired, heroId: candidate.id });
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
      // Render-facing (2026-08-06): only surfaced once the chain has earned
      // its tell, so a fizzled length-0/1 chain never glows or callouts.
      visibleChainHeroId: hotHeroId && bonusHitsLanded >= cfg.chainTellThreshold ? hotHeroId : null,
      visibleChainLength: bonusHitsLanded,
      enrageMultiplier: enrageMult,
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
    events.push({ type: "chainEnd", t: endT, chainLength: bonusHitsLanded });
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
    attemptsSinceIgnition,
  };
}
