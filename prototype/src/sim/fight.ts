import type { Rng } from "./rng.js";
import type { FightConfig } from "./config.js";
import { prdLookup } from "./config.js";
import type { FightSetup, HeroState, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightEvent, FightResult, HeroSnapshot, Side, TickSnapshot } from "./events.js";

/**
 * Applies `amount` damage starting at the hero with id `startId`, overflowing
 * to the next living hero in list order if the hit is a killing blow with
 * damage to spare. Used for every normal attack (single-target) and for the
 * chain's bonus hits — both are concentrated hits, never splash. Returns the
 * ids of heroes that died, in list order, and the damage actually applied
 * (<= amount — less if the side didn't have enough total HP to absorb it),
 * which the caller credits to the attacker's `dealt` counter.
 */
function applyDamageFrom(side: SideState, startId: string, amount: number): { died: string[]; applied: number } {
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
 * fixed, tunable rate (see config.ts's docstring). */
function pickWeightedTargetId(side: SideState, rng: Rng, cfg: FightConfig): string | undefined {
  const alive = side.heroes.filter((h) => h.alive && h.hp > 0);
  if (alive.length === 0) return undefined;
  const weights = alive.map((h) => (h.role === "tank" ? (h.holding ? cfg.tankTargetWeight : cfg.brokenTankTargetWeight) : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < alive.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return alive[i]?.id;
  }
  return alive[alive.length - 1]?.id;
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
 * hits never go through this — they stay exact so the escalating tiers
 * (bonusHitStep * hitIndex) read as clean steps rather than noisy ones. */
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
  }));
}

function cloneHeroes(heroes: HeroState[]): HeroState[] {
  return heroes.map((h) => ({ ...h, dealt: 0, soaked: 0, restored: 0, hitsTaken: 0 }));
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
): void {
  if (hero.healPerBeat) {
    const target = lowestHpAliveHero(attackerSide);
    if (target) {
      const amount = Math.min(hero.healPerBeat, target.maxHp - target.hp);
      if (amount > 0) {
        target.hp += amount;
        hero.restored += amount;
        events.push({ type: "heal", t, side: attackerSideLabel, healerId: hero.id, targetId: target.id, amount });
      }
    }
    return;
  }
  const targetId =
    targeting === "front" ? frontMostAliveId(defenderSide) : pickWeightedTargetId(defenderSide, rng, cfg);
  if (!targetId) return;
  const base = hero.damage + (isPlayerAttacker ? attackerSide.dpsBonus : 0);
  const damage = rollDamage(base, rng, cfg.damageVariance);
  const { died, applied } = applyDamageFrom(defenderSide, targetId, damage);
  hero.dealt += applied;
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

/**
 * Runs one fight to completion and returns the full record for replay.
 * Pure function: no DOM, no wall-clock, no imports outside sim/.
 */
export function runFight(setup: FightSetup, cfg: FightConfig, rng: Rng, seed: number): FightResult {
  // Work on private copies so the caller's setup objects aren't mutated.
  const player: SideState = { heroes: cloneHeroes(setup.player.heroes), dpsBonus: setup.player.dpsBonus };
  const enemy: SideState = { heroes: cloneHeroes(setup.enemy.heroes), dpsBonus: setup.enemy.dpsBonus };

  const playerStartMax = sideMaxHp(player);

  const events: FightEvent[] = [];
  const snapshots: TickSnapshot[] = [];

  const dt = 1 / cfg.tickRate;
  const maxTicks = Math.round(cfg.maxFightSec * cfg.tickRate);

  let gateOpened = false;
  let ignited = false;
  let hotHeroId: string | null = null;
  let bonusHitsLanded = 0;
  let finalChainLength = 0;
  let dipOccurred = false;

  let outcome: "win" | "loss" | null = null;
  let endReason: "wipe" | "failsafe" = "wipe";
  let endT = 0;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const t = tick * dt;
    endT = t;

    // Player heroes act on their own beats, targeting the front-most living
    // enemy — deterministic, so the player can reliably focus down the
    // bruiser. The hot hero also rolls its chain on the same beat.
    for (const hero of player.heroes) {
      if (!hero.alive || outcome || t < hero.nextAttackT) continue;
      performHeroAction(events, t, rng, cfg, player, "player", enemy, "enemy", hero, true, "front");
      hero.nextAttackT += hero.attackIntervalSec;
      if (isWiped(enemy)) {
        outcome = "win";
        continue;
      }
      if (hero.id === hotHeroId) {
        const chance = prdLookup(cfg.chainChanceByHitsSoFar, bonusHitsLanded);
        if (rng.chance(chance)) {
          const hitIndex = bonusHitsLanded + 1;
          const damage = Math.min(cfg.bonusHitStep * hitIndex, cfg.bonusHitCap);
          const targetId = frontMostAliveId(enemy);
          if (targetId) {
            const { died, applied } = applyDamageFrom(enemy, targetId, damage);
            hero.dealt += applied;
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

    // Enemy heroes act on their own beats, targeting a weighted-random
    // living player hero — see pickWeightedTargetId's docstring for why.
    if (!outcome) {
      for (const hero of enemy.heroes) {
        if (!hero.alive || outcome || t < hero.nextAttackT) continue;
        performHeroAction(events, t, rng, cfg, enemy, "enemy", player, "player", hero, false, "weighted");
        hero.nextAttackT += hero.attackIntervalSec;
        if (isWiped(player)) outcome = "loss";
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

    // The gate (2026-08-06 rework): only reachable once the player's tank
    // line has actually failed — every living tank broken, or no tank at
    // all — AND the pool has fallen to gatePoolFraction of its fight-start
    // max. A comfortable comp with a holding tank never reaches this, by
    // construction; see DECISIONS.md's "jeopardy no longer mandatory" and
    // "squad pick is the risk dial" entries. Stage 1 (this) + stage 2 (PRD),
    // one shot per fight.
    if (!gateOpened && !outcome) {
      const livingTanks = player.heroes.filter((h) => h.role === "tank" && h.alive);
      const lineBroken = livingTanks.length === 0 || livingTanks.every((h) => !h.holding);
      if (lineBroken) dipOccurred = true;
      if (lineBroken && sideHp(player) <= cfg.gatePoolFraction * playerStartMax) {
        gateOpened = true;
        events.push({ type: "gateOpen", t });
        const ignitionChance = prdLookup(cfg.ignitionChanceByFightsSince, setup.fightsSinceIgnition);
        const fired = rng.chance(ignitionChance);
        let heroId: string | null = null;
        if (fired) {
          // The hero who has done the most of its job goes hot — not a
          // random pick (2026-08-06, see DECISIONS.md's "squad pick is the
          // risk dial" entry) — so "VEX CHAIN x5" reads as Vex having
          // earned it rather than as a coin landing on Vex. Falls back to
          // restored (a pure-healer squad, or one where nobody has dealt
          // damage yet) if nobody has a dealt total to compare.
          const aliveHeroes = player.heroes.filter((h) => h.alive);
          if (aliveHeroes.length > 0) {
            const dealers = aliveHeroes.filter((h) => h.dealt > 0);
            const pool = dealers.length > 0 ? dealers : aliveHeroes;
            const byDealt = dealers.length > 0;
            let best = pool[0] as HeroState;
            for (const h of pool) {
              const better = byDealt ? h.dealt > best.dealt : h.restored > best.restored;
              if (better) best = h;
            }
            heroId = best.id;
            ignited = true;
            hotHeroId = heroId;
            bonusHitsLanded = 0;
          }
        }
        events.push({ type: "ignitionRoll", t, fired: fired && heroId !== null, heroId });
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
      gateOpen: gateOpened,
      // Render-facing (2026-08-06): only surfaced once the chain has earned
      // its tell, so a fizzled length-0/1 chain never glows or callouts.
      visibleChainHeroId: hotHeroId && bonusHitsLanded >= cfg.chainTellThreshold ? hotHeroId : null,
      visibleChainLength: bonusHitsLanded,
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
  };
}
