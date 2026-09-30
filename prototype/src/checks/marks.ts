/**
 * Marks and payoff cards (2026-09-30 — see DECISIONS.md's "chain abilities
 * are redesigned to leave marks" and "upgrades become set-up and pay-off
 * combos" entries). Each assertion runs a small hand-built fight and pins one
 * rule: the setup half (an ability leaves its mark, a chain "+N" adds stacks
 * not damage, a backfire puts the mark on the wrong side) and the pay-off
 * half (a held card reads the mark and fires).
 *
 * Fights force a chain at tick 1 by starting the firing unit at full charge,
 * and pin the backfire coin with cfg.forceBackfire, so nothing here depends on
 * a lucky roll.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide } from "../sim/run.js";
import type { ChainEffect } from "../sim/config.js";
import type { FightResult } from "../sim/events.js";
import type { PayoffId } from "../sim/payoffs.js";
import type { FightSetup } from "../sim/types.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;

/** A squad of `roles` with unit 0 charged to fire on tick 1, optionally with a
 * chain level and a custom ability list, against a fresh Pack encounter. */
function chainSetup(
  roles: PlayerRole[],
  opts: { level?: number; effects?: ChainEffect[]; payoffs?: PayoffId[]; calm?: boolean } = {},
): FightSetup {
  const player = makeSquadFromRoles(roles);
  const firing = player.heroes.find((h) => h.role === roles[0])!;
  firing.charge = run.fight.chargeThreshold;
  if (opts.level) firing.chainLevel = opts.level;
  if (opts.effects) firing.chainEffects = opts.effects;
  const enemy = makeEnemySide(run, 0, 0);
  // calm: the enemy never acts, so the squad is still at full HP when the chain lands.
  if (opts.calm) for (const h of enemy.heroes) h.nextAttackT = 1000;
  return { player, enemy, payoffs: opts.payoffs };
}

function fight(setup: FightSetup, backfire: "always" | "never" = "never", seed = 7): FightResult {
  // Every continuation roll passes, so each chain lands several rungs.
  const fightCfg = { ...run.fight, forceBackfire: backfire, chainChanceByHitsSoFar: [1] };
  return runFight(setup, fightCfg, new Rng(seed), seed);
}

function firstChainHit(result: FightResult) {
  return result.events.find((e) => e.type === "chainHit");
}

// --- Expose leaves Exposed on the enemy it hit.
{
  const result = fight(chainSetup(["damage"]));
  const hit = firstChainHit(result);
  check("expose: the first chain rung leaves an Exposed mark", hit?.type === "chainHit" && hit.mark === "exposed" && (hit.markStacks ?? 0) >= 1);
  check(
    "expose: some enemy carries Exposed stacks in a snapshot",
    result.snapshots.some((s) => s.enemyHeroes.some((h) => h.marks.exposed > 0)),
  );
}

// --- A chain "+N" adds mark stacks, not damage.
{
  const base = firstChainHit(fight(chainSetup(["damage"], { level: 1 })));
  const boosted = firstChainHit(fight(chainSetup(["damage"], { level: 3 })));
  const ok = base?.type === "chainHit" && boosted?.type === "chainHit";
  check("level: a level-3 chain leaves 3 stacks per rung, level-1 leaves 1", ok && base.markStacks === 1 && boosted.markStacks === 3);
  check("level: the rung's raw damage is the same at every level", ok && base.intended === boosted.intended);
}

// --- Scorch leaves Burn, and Burn ticks damage.
{
  const result = fight(chainSetup(["damage"], { effects: ["scorch"] }));
  const hit = firstChainHit(result);
  check("scorch: the first rung leaves Burn", hit?.type === "chainHit" && hit.mark === "burn");
  check("scorch: a Burn tick lands on an enemy", result.events.some((e) => e.type === "burnTick" && e.side === "enemy" && e.amount > 0));
}

// --- Mend on a full-HP squad turns into Shield instead of whiffing.
{
  const result = fight(chainSetup(["support"], { calm: true }));
  const hit = firstChainHit(result);
  check("mend: with nobody hurt the rung still lands, as Shield", hit?.type === "chainHit" && hit.mark === "shield" && hit.damage === 0);
  check(
    "mend: a player unit carries Shield in a snapshot",
    result.snapshots.some((s) => s.playerHeroes.some((h) => h.marks.shield > 0)),
  );
  // (The enemy stays calm above, so the absorb check runs its own fight.)
  const absorbed = fight(chainSetup(["support"]));
  check("shield: an enemy hit is absorbed by a Shield at some point", absorbed.events.some((e) => e.type === "shieldAbsorb" && e.side === "player"));
}

// --- Ward shields every living ally.
{
  const result = fight(chainSetup(["support", "tank", "damage"], { effects: ["ward"] }));
  const wardHits = result.events.filter((e) => e.type === "chainHit" && e.hitIndex === 1 && e.mark === "shield");
  check("ward: the first rung shields every squad member", wardHits.length === 3, `got ${wardHits.length}`);
}

// --- A backfire puts the mark on the wrong side.
{
  const result = fight(chainSetup(["damage"]), "always");
  const hit = firstChainHit(result);
  check("backfire: the chain is a backfire", hit?.type === "chainHit" && hit.backfire);
  const early = result.snapshots.find((s) => s.playerHeroes.some((h) => h.marks.exposed > 0));
  check("backfire: Exposed lands on the player's own side", early !== undefined);
  check(
    "backfire: no enemy is Exposed by a backfired expose",
    early !== undefined && early.enemyHeroes.every((h) => h.marks.exposed === 0),
  );
}

// --- Guard marks the slammer, whether it pulled the slam over or it was already aimed at the guardian.
{
  let blocks = 0;
  let held = 0;
  let unmarked = 0;
  let missed = 0;
  for (let round = 0; round < 20; round += 3) {
    for (let enc = 0; enc < 12; enc++) {
      for (let seed = 1; seed <= 8; seed++) {
        const player = makeSquadFromRoles(["tank", "damage", "support"]);
        const tankId = player.heroes.find((h) => h.role === "tank")!.id;
        const result = runFight({ player, enemy: makeEnemySide(run, round, enc) }, run.fight, new Rng(seed), seed);
        let i = 0;
        for (const e of result.events) {
          if (e.type !== "windupHit") continue;
          while (i + 1 < result.snapshots.length && result.snapshots[i + 1]!.t < e.t) i++;
          const before = result.snapshots[i]!;
          const after = result.snapshots.find((s, k) => k > i && s.t >= e.t);
          const guardLive = before.guardHeroId === tankId && before.guardCharges > 0;
          if (e.redirect === "guard" || e.redirect === "guardHeld") {
            blocks++;
            if (e.redirect === "guardHeld") held++;
            if ((after?.enemyHeroes.find((h) => h.id === e.sourceId)?.marks.exposed ?? 0) <= 0) unmarked++;
          } else if (!e.redirect && e.targetId === tankId && guardLive && before.playerHeroes.some((h) => h.id !== tankId && h.alive)) {
            missed++;
          }
        }
      }
    }
  }
  check("guard: a blocked slam leaves the slammer Exposed", blocks > 0 && unmarked === 0, `${blocks} blocks, ${unmarked} unmarked`);
  check("guard: a slam already aimed at the guardian is a held block", held > 0, `${held} held`);
  check("guard: no slam hits a guardian with live charges unblocked", missed === 0, `${missed} missed`);
}

// --- Payoff cards.
{
  // Shatter: an enemy frozen for the whole fight dies sooner with the card.
  const frozenSetup = (payoffs: PayoffId[]): FightSetup => {
    const setup: FightSetup = { player: makeSquadFromRoles(["tank", "damage", "support"]), enemy: makeEnemySide(run, 0, 0), payoffs };
    for (const h of setup.enemy.heroes) {
      h.stunnedUntilT = 1000;
      h.nextAttackT = 1000;
    }
    return setup;
  };
  const plain = fight(frozenSetup([]));
  const shattered = fight(frozenSetup(["shatter"]));
  check("shatter: it fires on a frozen enemy", shattered.events.some((e) => e.type === "payoffTriggered" && e.payoff === "shatter"));
  check("shatter: the fight ends sooner with the card", shattered.durationSec < plain.durationSec * 0.8, `${shattered.durationSec.toFixed(1)}s vs ${plain.durationSec.toFixed(1)}s`);
  check("shatter: without the card nothing fires", !plain.events.some((e) => e.type === "payoffTriggered"));
}
{
  // Execute: an Exposed enemy already below the line dies on the first hit.
  const setup = (payoffs: PayoffId[]): FightSetup => {
    const s: FightSetup = { player: makeSquadFromRoles(["tank", "damage", "support"]), enemy: makeEnemySide(run, 0, 0), payoffs };
    const front = s.enemy.heroes[0]!;
    // Big enough that one hit leaves it under the line instead of killing it.
    front.maxHp = 1000;
    front.hp = 340;
    front.marks = { exposed: 2, burn: 0, shield: 0 };
    return s;
  };
  const with_ = fight(setup(["execute"]));
  const without = fight(setup([]));
  const executed = with_.events.find((e) => e.type === "payoffTriggered" && e.payoff === "execute");
  check("execute: it fires on an Exposed enemy under the line", executed !== undefined);
  check("execute: without the card it does not", !without.events.some((e) => e.type === "payoffTriggered"));
}
{
  // Spread: a burning enemy's death hands its Burn to the next body.
  const s: FightSetup = { player: makeSquadFromRoles(["tank", "damage", "support"]), enemy: makeEnemySide(run, 0, 0), payoffs: ["spread"] };
  const front = s.enemy.heroes[0]!;
  front.hp = 1;
  front.marks = { exposed: 0, burn: 4, shield: 0 };
  const result = fight(s);
  const spread = result.events.find((e) => e.type === "payoffTriggered" && e.payoff === "spread");
  check("spread: it fires when a burning enemy dies", spread !== undefined);
  check(
    "spread: the next enemy is burning afterwards",
    result.snapshots.some((snap) => snap.enemyHeroes.slice(1).some((h) => h.marks.burn > 0)),
  );
}

console.log(failed ? "\nmarks check FAILED" : "\nmarks check passed");
process.exit(failed ? 1 : 0);
