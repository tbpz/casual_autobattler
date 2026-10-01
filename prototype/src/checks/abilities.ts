/**
 * The six branching abilities (2026-10-01 — see config.ts's ChainEffect and
 * roles.ts's ROLE_UPGRADE_POOL): Brace, Quake, Frostbolt, Siphon, Cauterize,
 * Chill. Each runs one small hand-built fight and pins what it does and what
 * mark it leaves. Same harness as marks.ts: the firing unit starts at full
 * charge so the chain lands on tick 1, every continuation roll passes, and
 * `calm` keeps the enemy from acting.
 *
 * Also pins the run-level side: the role upgrade pools and the per-run draw.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import type { ChainEffect } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { PLAYER_ROLES, ROLE_UPGRADE_POOL, makeSquadFromRoles, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide } from "../sim/run.js";
import { ABILITY_MARKS, marksMadeBy } from "../sim/cards/index.js";
import { drawUpgradeOptions, makeInitialProgress } from "../sim/progress.js";
import type { CardId } from "../sim/cards/index.js";
import type { FightResult } from "../sim/events.js";
import type { FightSetup } from "../sim/types.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;

function setup(
  roles: PlayerRole[],
  effects: ChainEffect[],
  opts: { calm?: boolean; hurt?: PlayerRole; cards?: CardId[] } = {},
): FightSetup {
  const player = makeSquadFromRoles(roles);
  const firing = player.heroes.find((h) => h.role === roles[0])!;
  firing.charge = run.fight.chargeThreshold;
  firing.chainEffects = effects;
  if (opts.hurt) {
    const h = player.heroes.find((x) => x.role === opts.hurt)!;
    h.hp = Math.round(h.maxHp * 0.4);
  }
  const enemy = makeEnemySide(run, 0, 0);
  if (opts.calm) for (const h of enemy.heroes) h.nextAttackT = 1000;
  return { player, enemy, cards: opts.cards };
}

function fight(s: FightSetup, backfire: "always" | "never" = "never", seed = 7): FightResult {
  const cfg = { ...run.fight, forceBackfire: backfire, chainChanceByHitsSoFar: [1] };
  return runFight(s, cfg, new Rng(seed), seed);
}

type Hit = Extract<FightResult["events"][number], { type: "chainHit" }>;
/** The first rung of the FIRST chain only — the forced one. Other units keep
 * charging during a fight and fire their own chains later, which would
 * otherwise add rung-1 hits of their own abilities. */
const rungOne = (r: FightResult): Hit[] => {
  const start = r.events.findIndex((e) => e.type === "chainStart");
  const end = r.events.findIndex((e, i) => i > start && e.type === "chainEnd");
  return r.events
    .slice(start, end < 0 ? undefined : end)
    .filter((e): e is Hit => e.type === "chainHit" && e.hitIndex === 1);
};

// --- Brace: the firing tank shields itself; a backfire shields an enemy.
{
  const s = setup(["tank", "damage", "support"], ["brace"], { calm: true });
  const tankId = s.player.heroes.find((h) => h.role === "tank")!.id;
  const hits = rungOne(fight(s));
  check("brace: one rung, on the firing hero itself, leaving Shield", hits.length === 1 && hits[0]!.targetId === tankId && hits[0]!.mark === "shield" && (hits[0]!.markStacks ?? 0) > 0);

  const big = setup(["tank", "damage", "support"], ["brace"], { calm: true });
  big.player.heroes.find((h) => h.role === "tank")!.maxHp = 400;
  const bigHit = rungOne(fight(big))[0];
  check("brace: a tougher tank shields for more", (bigHit?.markStacks ?? 0) > (hits[0]!.markStacks ?? 0), `${bigHit?.markStacks} vs ${hits[0]!.markStacks}`);

  const back = rungOne(fight(setup(["tank", "damage", "support"], ["brace"], { calm: true }), "always"));
  check("brace: a backfire shields an enemy, not the squad", back.length === 1 && !s.player.heroes.some((h) => h.id === back[0]!.targetId));
}

// --- Quake: every enemy takes a hit and is left Exposed.
{
  const s = setup(["tank", "damage", "support"], ["quake"], { calm: true });
  const living = s.enemy.heroes.length;
  const hits = rungOne(fight(s));
  check("quake: the first rung hits every enemy", hits.length === living && hits.every((h) => h.kind === "damage" && h.damage > 0), `${hits.length} of ${living}`);
  check("quake: each survivor is left Exposed", hits.filter((h) => h.mark === "exposed").length >= 1);
}

// --- Frostbolt: freezes the front enemy, then hits that same enemy.
{
  const s = setup(["damage", "tank", "support"], ["frostbolt"], { calm: true });
  const frontId = s.enemy.heroes[0]!.id;
  const result = fight(s);
  const hits = rungOne(result);
  const stun = hits.find((h) => h.kind === "stun");
  const dmg = hits.find((h) => h.kind === "damage");
  check("frostbolt: a freeze and a hit land on the same rung", stun !== undefined && dmg !== undefined);
  check("frostbolt: both aim at the front enemy", stun?.targetId === frontId && dmg?.targetId === frontId);
  check(
    "frostbolt: the front enemy shows frozen in a snapshot",
    result.snapshots.some((sn) => sn.enemyHeroes.some((h) => h.id === frontId && (h.stunnedUntilT ?? 0) > sn.t)),
  );

  // Freeze lands before the hit, so a held Shatter doubles it.
  const plain = rungOne(fight(setup(["damage", "tank", "support"], ["frostbolt"], { calm: true }))).find((h) => h.kind === "damage")!;
  const shattered = rungOne(fight(setup(["damage", "tank", "support"], ["frostbolt"], { calm: true, cards: ["shatter"] }))).find((h) => h.kind === "damage")!;
  check("frostbolt: Shatter doubles the bolt that follows its own freeze", shattered.damage >= plain.damage * 1.9, `${shattered.damage} vs ${plain.damage}`);
}

// --- Siphon: hits the weakest enemy and heals the worst-hurt hero from it.
{
  const s = setup(["damage", "tank", "support"], ["siphon"], { calm: true, hurt: "tank" });
  const weakest = [...s.enemy.heroes].sort((a, b) => a.hp - b.hp)[0]!;
  const tankId = s.player.heroes.find((h) => h.role === "tank")!.id;
  const hits = rungOne(fight(s));
  const dmg = hits.find((h) => h.kind === "damage");
  const heal = hits.find((h) => h.kind === "heal");
  check("siphon: the hit lands on the weakest enemy", dmg?.targetId === weakest.id);
  check("siphon: the worst-hurt hero is healed by it", heal?.targetId === tankId && heal.damage > 0);
  check("siphon: the heal is no bigger than the damage dealt", heal !== undefined && dmg !== undefined && heal.damage <= dmg.damage);
}

// --- Cauterize: heals the worst-hurt hero and sets an enemy burning.
{
  const s = setup(["support", "tank", "damage"], ["cauterize"], { calm: true, hurt: "tank" });
  const tankId = s.player.heroes.find((h) => h.role === "tank")!.id;
  const result = fight(s);
  const hits = rungOne(result);
  const heal = hits.find((h) => h.kind === "heal");
  const burn = hits.find((h) => h.kind === "damage");
  check("cauterize: heals the worst-hurt hero", heal?.targetId === tankId && heal.damage > 0);
  check("cauterize: leaves an enemy burning", burn?.mark === "burn" && s.enemy.heroes.some((h) => h.id === burn.targetId));
  check("cauterize: a Burn tick lands on an enemy", result.events.some((e) => e.type === "burnTick" && e.side === "enemy" && e.amount > 0));
}

// --- Chill: freezes an enemy; against a hunter, the one that hit the weakest hero.
{
  const s = setup(["support", "tank", "damage"], ["chill"], { calm: true });
  const result = fight(s);
  const hits = rungOne(result);
  check("chill: one freeze lands on an enemy", hits.length === 1 && hits[0]!.kind === "stun" && s.enemy.heroes.some((h) => h.id === hits[0]!.targetId));

  // Live fight: any chill rung that lands after an enemy hit a hero freezes an enemy.
  const live = fight(setup(["support", "tank", "damage"], ["chill"]));
  const stuns = live.events.filter((e) => e.type === "chainHit" && e.kind === "stun");
  check("chill: in a live fight it freezes enemies, never the squad", stuns.length > 0 && stuns.every((e) => e.type === "chainHit" && !e.backfire));
}

// --- Pools and the per-run draw.
{
  for (const role of PLAYER_ROLES) {
    const pool = ROLE_UPGRADE_POOL[role];
    const marks = new Set(pool.flatMap((e) => ABILITY_MARKS[e]));
    check(`pool: ${role} has three upgrades`, pool.length === 3);
    check(`pool: ${role}'s upgrades reach at least two different marks`, marks.size >= 2, [...marks].join(","));
  }
  const allMarks = marksMadeBy(PLAYER_ROLES.flatMap((r) => ROLE_UPGRADE_POOL[r]));
  check("pool: every one of the four marks can be made", allMarks.size === 4);

  const options = drawUpgradeOptions(new Rng(1), run);
  check(
    "draw: each role gets upgradeOptionsPerRole options, all from its own pool",
    PLAYER_ROLES.every((r) => options[r].length === run.upgradeOptionsPerRole && options[r].every((e) => ROLE_UPGRADE_POOL[r].includes(e))),
  );
  const seen = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) seen.add(JSON.stringify(drawUpgradeOptions(new Rng(seed), run)));
  check("draw: different seeds give different option sets", seen.size > 5, `${seen.size} distinct of 60`);
  const again = JSON.stringify(drawUpgradeOptions(new Rng(9), run)) === JSON.stringify(drawUpgradeOptions(new Rng(9), run));
  check("draw: the same seed gives the same options", again);
  const fresh = makeInitialProgress(run);
  check(
    "draw: without a stream a role gets the first options of its pool",
    PLAYER_ROLES.every((r) => fresh.upgradeOptions[r].join() === ROLE_UPGRADE_POOL[r].slice(0, run.upgradeOptionsPerRole).join()),
  );
}

if (failed) process.exit(1);
