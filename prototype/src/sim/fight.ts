import type { Rng } from "./rng.js";
import type { FightConfig } from "./config.js";
import { prdLookup } from "./config.js";
import type { FightSetup, HeroState, SideState } from "./types.js";
import { sideHp, sideMaxHp } from "./types.js";
import type { FightEvent, FightResult, HeroSnapshot, TickSnapshot } from "./events.js";

/**
 * Applies `amount` damage to a side, concentrated on the front-most living
 * hero, overflowing to the next when one drops to 0. Used only for the
 * chain's single-target bonus hits — FIGHT_SCRIPT.md §3 explicitly wants a
 * bonus hit to be concentrated, "fired by the same hero throughout" and
 * "retargeting when its target dies," which only makes sense as a focused
 * hit, not splash. Returns the ids of heroes that died, in order.
 */
function applyConcentratedDamage(side: SideState, amount: number): string[] {
  let remaining = amount;
  const died: string[] = [];
  for (const hero of side.heroes) {
    if (remaining <= 0) break;
    if (!hero.alive || hero.hp <= 0) continue;
    const taken = Math.min(hero.hp, remaining);
    hero.hp -= taken;
    remaining -= taken;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.alive = false;
      died.push(hero.id);
    }
  }
  return died;
}

/**
 * Applies `amount` damage to a side, split proportionally across living
 * heroes by their current HP. Used for the continuous side-level DPS (both
 * sides' baseline combat).
 *
 * This replaced a front-most-concentrated model for baseline damage during
 * the Phase 2 batch harness pass: concentrating baseline damage killed the
 * front hero within the first ~7s of *every* fight (100 HP gone long before
 * the ~180 HP the aggregate pool takes to reach the eligibility gate),
 * contradicting DECISIONS.md's 2026-07-31 point 8 ("a hero falls only in the
 * bad-case dip, not every dip") and producing a 0% run-completion rate.
 *
 * Known cost, worth flagging rather than hiding: with autoRecoverHp fully
 * topping every living hero up before each fight (config.ts), and all heroes
 * therefore always entering a fight at equal HP, this proportional split
 * means no player hero can die mid-fight without the whole side wiping at
 * the same instant — so under the current model, a *won* fight never costs a
 * hero, and `deathPolicy` only bites on a run-ending loss. Mechanizing a
 * distinct "bad-case dip" that can cost one hero on an otherwise-won fight is
 * real, undecided design (FIGHT_SCRIPT.md defers it) — not invented here.
 */
function applyDistributedDamage(side: SideState, amount: number): string[] {
  const alive = side.heroes.filter((h) => h.alive && h.hp > 0);
  const totalHp = alive.reduce((sum, h) => sum + h.hp, 0);
  if (alive.length === 0 || amount <= 0 || totalHp <= 0) return [];
  const died: string[] = [];
  for (const hero of alive) {
    const share = amount * (hero.hp / totalHp);
    hero.hp -= share;
    if (hero.hp <= 1e-9) {
      hero.hp = 0;
      hero.alive = false;
      died.push(hero.id);
    }
  }
  return died;
}

function isWiped(side: SideState): boolean {
  return side.heroes.every((h) => !h.alive || h.hp <= 0);
}

function snapshotHeroes(side: SideState): HeroSnapshot[] {
  return side.heroes.map((h) => ({ id: h.id, hp: h.hp, maxHp: h.maxHp, alive: h.alive }));
}

function cloneHeroes(heroes: HeroState[]): HeroState[] {
  return heroes.map((h) => ({ ...h }));
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
  const initialLivingPlayers = player.heroes.filter((h) => h.alive).length;

  const events: FightEvent[] = [];
  const snapshots: TickSnapshot[] = [];

  const dt = 1 / cfg.tickRate;
  const maxTicks = Math.round(cfg.fightDurationSec * cfg.tickRate);

  let gateOpened = false;
  let ignited = false;
  let hotHeroId: string | null = null;
  let bonusHitsLanded = 0;
  let nextChainRollT = Infinity;
  let finalChainLength = 0;

  let outcome: "win" | "loss" | null = null;
  let endReason: "wipe" | "timer" = "timer";
  let endT = cfg.fightDurationSec;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const tStart = (tick - 1) * dt;
    const t = tick * dt;

    // Continuous side-level damage this tick. Evaluated at the tick's midpoint
    // (not tStart) so the discrete sum exactly matches the continuous integral
    // of a linear rate — left-endpoint evaluation was biasing the trajectory
    // just enough to turn FIGHT_SCRIPT.md §3's exact analytic tie at t=30
    // (both sides land at exactly 30/300 HP) into a small, consistent enemy
    // edge, silently converting "a genuine coin flip" into a guaranteed loss
    // whenever no chain landed (~80% of fights) — see resolve below for the
    // other half of this fix.
    const tMid = tStart + dt / 2;
    const enemyDpsNow =
      cfg.enemyDpsStart + (cfg.enemyDpsEnd - cfg.enemyDpsStart) * (tMid / cfg.fightDurationSec);
    const livingPlayers = player.heroes.filter((h) => h.alive).length;
    const playerDpsScale = cfg.dpsScalesWithLivingHeroes
      ? livingPlayers / Math.max(initialLivingPlayers, 1)
      : 1;
    const playerDpsNow = (cfg.playerDpsSideTotal + player.dpsBonus) * playerDpsScale;

    for (const id of applyDistributedDamage(player, enemyDpsNow * dt)) {
      events.push({ type: "heroDown", t, side: "player", heroId: id });
    }
    for (const id of applyDistributedDamage(enemy, playerDpsNow * dt)) {
      events.push({ type: "heroDown", t, side: "enemy", heroId: id });
    }

    if (isWiped(player)) {
      outcome = "loss";
      endReason = "wipe";
      endT = t;
    } else if (isWiped(enemy)) {
      outcome = "win";
      endReason = "wipe";
      endT = t;
    }

    // Stage 1 (deterministic) + stage 2 (PRD) ignition gate, one shot per fight.
    if (!gateOpened && !outcome) {
      const currentMax = playerStartMax; // reading #3: fixed at fight start, not recomputed.
      if (sideHp(player) <= cfg.eligibilityGateFraction * currentMax) {
        gateOpened = true;
        events.push({ type: "gateOpen", t });
        const ignitionChance = prdLookup(cfg.ignitionChanceByFightsSince, setup.fightsSinceIgnition);
        const fired = rng.chance(ignitionChance);
        let heroId: string | null = null;
        if (fired) {
          const aliveHeroes = player.heroes.filter((h) => h.alive);
          if (aliveHeroes.length > 0) {
            const pick = aliveHeroes[rng.nextInt(0, aliveHeroes.length)];
            if (pick) {
              heroId = pick.id;
              ignited = true;
              hotHeroId = heroId;
              bonusHitsLanded = 0;
              nextChainRollT = t + cfg.attackIntervalSec;
            }
          }
        }
        events.push({ type: "ignitionRoll", t, fired: fired && heroId !== null, heroId });
      }
    }

    // Chain rolls, on the hot hero's attack beat, while eligible and unresolved.
    if (hotHeroId && !outcome && t >= nextChainRollT) {
      const hero = player.heroes.find((h) => h.id === hotHeroId);
      if (!hero || !hero.alive) {
        // The hot hero itself died (shouldn't happen given it's picked from
        // currently-alive heroes and player damage is now distributed rather
        // than concentrated, but guard it defensively regardless).
        events.push({ type: "chainEnd", t, chainLength: bonusHitsLanded });
        finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
        hotHeroId = null;
      } else {
        const chance = prdLookup(cfg.chainChanceByHitsSoFar, bonusHitsLanded);
        const success = rng.chance(chance);
        if (success) {
          const hitIndex = bonusHitsLanded + 1;
          const damage = Math.min(cfg.bonusHitStep * hitIndex, cfg.bonusHitCap);
          const target = enemy.heroes.find((h) => h.alive);
          for (const id of applyConcentratedDamage(enemy, damage)) {
            events.push({ type: "heroDown", t, side: "enemy", heroId: id });
          }
          events.push({
            type: "chainHit",
            t,
            hitIndex,
            damage,
            targetId: target?.id ?? "",
          });
          bonusHitsLanded = hitIndex;
          nextChainRollT = t + cfg.attackIntervalSec;
          if (isWiped(enemy)) {
            outcome = "win";
            endReason = "wipe";
            endT = t;
          }
        } else {
          events.push({ type: "chainEnd", t, chainLength: bonusHitsLanded });
          finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
          hotHeroId = null;
        }
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
    });

    if (outcome) break;
  }

  // If a chain was still running when the fight ended (wipe or timer), close it out.
  if (hotHeroId) {
    events.push({ type: "chainEnd", t: endT, chainLength: bonusHitsLanded });
    finalChainLength = Math.max(finalChainLength, bonusHitsLanded);
  }

  if (!outcome) {
    // Timer resolve: higher HP fraction wins. A near-exact tie (the intended
    // no-cascade case, per FIGHT_SCRIPT.md §3's own worked check: both sides
    // land at exactly 30/300 HP with no chain) is resolved by an actual coin
    // flip — not a hardcoded loss — because the doc explicitly calls this
    // case "a genuine coin flip," and the cascade is meant to be the *big*
    // win, not the *only* win (§4).
    const playerFraction = sideMaxHp(player) > 0 ? sideHp(player) / sideMaxHp(player) : 0;
    const enemyFraction = sideMaxHp(enemy) > 0 ? sideHp(enemy) / sideMaxHp(enemy) : 0;
    const tieEpsilon = 1e-6;
    if (Math.abs(playerFraction - enemyFraction) < tieEpsilon) {
      outcome = rng.chance(0.5) ? "win" : "loss";
    } else {
      outcome = playerFraction > enemyFraction ? "win" : "loss";
    }
    endReason = "timer";
    endT = cfg.fightDurationSec;
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
  };
}
