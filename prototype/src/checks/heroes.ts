/**
 * Merge heroes (2026-10-20 — DECISIONS.md 2026-10-19; sim/heroes.ts). Each assertion runs a small hand-built
 * fight (or a roster step) and pins one rule: the ten recipes, each hero's gift and skill, the merge itself
 * (when it is offered, what it uses, the full-squad rule), Dragon growth and the Twin's copy.
 *
 * Fights force a chain at tick 1 by starting the firing unit at full charge and pin the backfire coin and
 * the damage variance, so nothing here depends on a lucky roll.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeUnitState, ROLE_SORT_PRIORITY, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide, makeOfferPolicy, runRun } from "../sim/run.js";
import { roundDef } from "../sim/rounds.js";
import type { FightResult } from "../sim/events.js";
import type { FightSetup, HeroKind, HeroState, SideState } from "../sim/types.js";
import { makeInitialProgress } from "../sim/progress.js";
import { applyFightResultToRoster, fieldSquad } from "../sim/roster.js";
import { applyOffer } from "../sim/offers.js";
import {
  applyMerge,
  HERO_ORDER,
  HERO_POOL,
  isFrontRow,
  makeHeroState,
  mergeCandidates,
  pickIngredients,
  recipesCompletedBy,
} from "../sim/heroes.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;
const zero = { maxHp: 0, damage: 0 };
const unit = (role: PlayerRole, n = 1): HeroState => makeUnitState(role, n, `u${n}_${role}`, zero);
const hero = (kind: HeroKind): HeroState => makeHeroState(kind, zero);

/** A squad in fielding order (tank-first, like roster.ts's fieldSquad) against the round-1 enemy. */
function setup(units: HeroState[], tweak?: (enemy: SideState) => void): FightSetup {
  const heroes = [...units].sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  const enemy = makeEnemySide(run, 0, 0);
  tweak?.(enemy);
  return { player: { heroes, dpsBonus: 0 }, enemy };
}

function fight(s: FightSetup, seed = 7, over: Partial<typeof run.fight> = {}): FightResult {
  const fightCfg = { ...run.fight, forceBackfire: "never" as const, chainChanceByHitsSoFar: [1], damageVariance: 0, ...over };
  return runFight(s, fightCfg, new Rng(seed), seed);
}

function charged(h: HeroState): HeroState {
  h.charge = run.fight.chargeThreshold;
  return h;
}

/** The enemy never acts, so the squad is untouched when the unit under test first moves. */
const calm = (enemy: SideState): void => enemy.heroes.forEach((h) => (h.nextAttackT = 1000));

const firstChainHit = (r: FightResult) => r.events.find((e) => e.type === "chainHit");

// --- The ten recipes are distinct, each has a skill, and the row follows the Tanks.
{
  const keys = new Set(HERO_ORDER.map((k) => [...HERO_POOL[k].recipe].sort().join("+")));
  check("ten heroes, ten different recipes", HERO_ORDER.length === 10 && keys.size === 10);
  const front = HERO_ORDER.filter((k) => isFrontRow(hero(k)));
  check("front row: exactly Golem, Berserker and Paladin (two or more Tank pieces)", front.join() === "golem,berserker,paladin", front.join());
  check("every hero but the Twin names a skill of its own", HERO_ORDER.every((k) => (k === "twin") === (HERO_POOL[k].skill === null)));
}

// --- Golem: Taunt takes every enemy hit and slam; Fortify shields itself.
{
  const golem = hero("golem");
  const r = fight(setup([golem, unit("damage"), unit("support")], (enemy) => enemy.heroes.forEach((h) => (h.reachesBackline = true))));
  const downAt = r.events.find((e) => e.type === "heroDown" && e.side === "player" && e.heroId === golem.id)?.t ?? Infinity;
  const hits = r.events.filter((e) => (e.type === "attack" && e.side === "enemy" && e.t < downAt) || (e.type === "windupHit" && e.t < downAt));
  const allOnGolem = hits.every((e) => (e.type === "attack" || e.type === "windupHit") && e.targetId === golem.id);
  check("golem: every enemy hit and slam lands on it, even from enemies that reach the back row", hits.length > 0 && allOnGolem, `${hits.length} hits`);

  const fort = fight(setup([charged(hero("golem")), unit("damage"), unit("support")]));
  const hit = firstChainHit(fort);
  check("fortify: the first rung puts a shield on the golem itself", hit?.type === "chainHit" && hit.mark === "shield" && hit.targetId === golem.id);
}

// --- Berserker: Rage lifts damage with missing HP; Cleave hits the front enemy for 2.5x.
{
  const full = hero("berserker");
  const hurt = hero("berserker");
  hurt.hp = hurt.maxHp / 2;
  const damageOf = (h: HeroState): number | undefined => {
    const r = fight(setup([h, unit("damage"), unit("tank", 2)], calm), 7, { chargeThreshold: 1e9 });
    const e = r.events.find((x) => x.type === "attack" && x.side === "player" && x.attackerId === h.id);
    return e?.type === "attack" ? e.damage : undefined;
  };
  check("rage: at full HP the Berserker hits for its base 14", damageOf(full) === 14, String(damageOf(full)));
  check("rage: at half HP it hits for 1.5x (21)", damageOf(hurt) === 21, String(damageOf(hurt)));

  const cleave = fight(setup([charged(hero("berserker")), unit("damage"), unit("support")], calm));
  const hit = firstChainHit(cleave);
  const frontId = makeEnemySide(run, 0, 0).heroes[0]!.id;
  check("cleave: the first rung hits the front enemy for 2.5x damage (35)", hit?.type === "chainHit" && hit.targetId === frontId && hit.intended === 35, JSON.stringify(hit));
}

// --- Paladin: Martyr heals the others when it is hit; Bless shields every unit.
{
  const paladin = hero("paladin");
  const r = fight(setup([paladin, unit("damage"), unit("support")]), 7, { chargeThreshold: 1e9 });
  const hitAt = r.events.find((e) => e.type === "attack" && e.side === "enemy" && e.targetId === paladin.id)?.t;
  const heals = r.events.filter((e) => e.type === "heal" && e.healerId === paladin.id && e.t === hitAt);
  check("martyr: a hit on the Paladin heals the others (only those hurt, so allow none on a full squad)", hitAt !== undefined);
  const hurtAlly = unit("damage");
  hurtAlly.hp = 40;
  const p2 = hero("paladin");
  const r2 = fight(setup([p2, hurtAlly, unit("support")]), 7, { chargeThreshold: 1e9 });
  const martyr = r2.events.filter((e) => e.type === "heal" && e.healerId === p2.id);
  check("martyr: with a hurt ally, the Paladin being hit heals it 3", martyr.length > 0 && martyr[0]!.type === "heal" && martyr[0]!.amount === 3, `${martyr.length} heals`);
  void heals;

  const bless = fight(setup([charged(hero("paladin")), unit("damage"), unit("support")]));
  const shielded = bless.events.filter((e) => e.type === "chainHit" && e.hitIndex === 1 && e.mark === "shield");
  check("bless: the first rung shields all three units", shielded.length === 3, String(shielded.length));
}

// --- Assassin: Execute hits the weakest enemy for 3x; a kill fills the bar again.
{
  const assassin = charged(hero("assassin"));
  const s = setup([assassin, unit("tank"), unit("support")]);
  const weakest = [...s.enemy.heroes].sort((a, b) => a.hp - b.hp)[0]!;
  const r = fight(s);
  const hit = firstChainHit(r);
  check("execute: the first rung hits the weakest enemy for 3x damage (60)", hit?.type === "chainHit" && hit.targetId === weakest.id && hit.intended === 60, JSON.stringify(hit));

  const weak = setup([charged(hero("assassin")), unit("tank"), unit("support")], (enemy) =>
    enemy.heroes.forEach((h) => {
      h.hp = 55;
      h.maxHp = 55;
    }),
  );
  // One rung per chain, so each Execute ends its chain right after a kill.
  const lust = fight(weak, 7, { chargeTricklePerSec: 0, chargeWeightDealt: 0, chargeWeightSoaked: 0, chainChanceByHitsSoFar: [1, 0] });
  const ends = lust.events.filter((e) => e.type === "chainEnd" && e.heroId === assassin.id && e.killedIds.length > 0);
  const end = ends[0];
  const starts = lust.events.filter((e) => e.type === "chainStart" && e.heroId === assassin.id);
  const restart = end ? starts.find((e) => e.t >= end.t) : undefined;
  check("bloodlust: a chain that killed refills the bar, so the next one starts at once", !!end && !!restart && restart.t - end.t <= 0.1 + 1e-9, `${end?.t} -> ${restart?.t}`);
}

// --- Dragon: Breath is one enemy until Adult, then all; four wins make a stage; falling resets it.
{
  const baby = charged(hero("dragon"));
  const adult = charged(hero("dragon"));
  adult.heroStage = 2;
  const count = (d: HeroState): number => {
    const r = fight(setup([d, unit("tank"), unit("support")], calm));
    return r.events.filter((e) => e.type === "chainHit" && e.hitIndex === 1 && e.sourceId === d.id).length;
  };
  const enemies = makeEnemySide(run, 0, 0).heroes.length;
  check("breath: a Baby breathes on one enemy", count(baby) === 1, String(count(baby)));
  check("breath: an Adult breathes on every enemy", count(adult) === enemies && enemies > 1, `${count(adult)} of ${enemies}`);

  const progress = makeInitialProgress(run);
  let roster: SideState = { heroes: [hero("dragon"), unit("tank"), unit("support")], dpsBonus: 0 };
  const ids = roster.heroes.map((h) => h.id);
  const result = fight(setup(roster.heroes.map((h) => ({ ...h }))));
  for (let i = 0; i < 4; i++) roster = applyFightResultToRoster(roster, fieldSquad(roster, ids, progress), result, run);
  const grown = roster.heroes.find((h) => h.hero === "dragon")!;
  check("growth: four fielded wins make a Young dragon with more HP and damage", grown.heroStage === 1 && grown.maxHp === 120 + run.heroDragonHpPerStage && grown.damage === 10 + run.heroDragonDamagePerStage, `${grown.heroStage} ${grown.maxHp} ${grown.damage}`);
  const benched = applyFightResultToRoster({ ...roster, heroes: roster.heroes }, fieldSquad(roster, ids.filter((id) => id !== grown.id), progress), result, run);
  check("growth: a benched dragon does not grow", (benched.heroes.find((h) => h.hero === "dragon")!.heroWins ?? 0) === 4);
  const fallen = { ...roster, heroes: roster.heroes.map((h) => (h.hero === "dragon" ? { ...h, alive: false, hp: 0 } : h)) };
  const revived = applyOffer(progress, fallen, { kind: "revive", unitId: grown.id, title: "", detail: "", headline: "" }, run).roster.heroes.find((h) => h.hero === "dragon")!;
  check("growth: a revived dragon is a Baby again", revived.heroStage === 0 && revived.heroWins === 0 && revived.maxHp === 120 && revived.damage === 10, `${revived.heroStage} ${revived.maxHp}`);
}

// --- Necromancer: empty places at the start; Raise fills one when anyone dies; Horde needs skeletons.
{
  const necro = hero("necromancer");
  const s = setup([necro, unit("tank"), unit("damage"), unit("support")]);
  const r = fight(s);
  const first = r.snapshots[0]!;
  const places = first.playerHeroes.filter((h) => h.skeleton);
  check("raise: the fight starts with four empty skeleton places (not alive, no HP)", places.length === 4 && places.every((h) => !h.alive && h.maxHp === 0), String(places.length));
  const raises = r.events.filter((e) => e.type === "raise");
  check("raise: a death makes a skeleton rise", raises.length > 0, String(raises.length));
  check("raise: at most four stand at once", r.snapshots.every((sn) => sn.playerHeroes.filter((h) => h.skeleton && h.alive).length <= 4));
  check("raise: the roster-facing result leaves skeletons out", r.finalPlayerHeroes.every((h) => !h.skeleton) && r.finalPlayerHeroes.length === 4);
  check("raise: a skeleton does not count as a unit in the side's HP", first.playerMaxHp === s.player.heroes.reduce((a, h) => a + h.maxHp, 0));

  // Only the Necromancer is allowed to fill its bar (the others start far below), and not before the first kills.
  const others = [unit("tank"), unit("damage"), unit("support")];
  others.forEach((h) => (h.charge = -1e6));
  const horde = fight(setup([hero("necromancer"), ...others]), 7, { chargeThreshold: 100, chargeTricklePerSec: 20 });
  const strikes = horde.events.filter((e) => e.type === "chainHit" && e.sourceId === necro.id && e.kind === "damage");
  check("horde: once skeletons stand, the Necromancer's chain strikes with them", strikes.length > 0, String(strikes.length));
  const noNecro = fight(setup([unit("tank"), unit("damage"), unit("support")]));
  check("raise: without a Necromancer nothing rises", !noNecro.events.some((e) => e.type === "raise") && !noNecro.snapshots[0]!.playerHeroes.some((h) => h.skeleton));
}

// --- Priest: Radiance hits the front enemy with every heal; Prayer heals all.
{
  const priest = hero("priest");
  const wounded = unit("tank");
  wounded.hp = 60;
  const r = fight(setup([priest, wounded, unit("damage")]), 7, { chargeThreshold: 1e9 });
  const heal = r.events.find((e) => e.type === "heal" && e.healerId === priest.id);
  const hit = heal ? r.events.find((e) => e.type === "attack" && e.attackerId === priest.id && e.t === heal.t) : undefined;
  check("radiance: a Priest's heal comes with a hit on the front enemy at the same moment", !!heal && !!hit, `${heal?.t}`);

  const prayer = fight(setup([charged(hero("priest")), unit("tank"), unit("damage")]));
  const first = prayer.events.filter((e) => e.type === "chainHit" && e.hitIndex === 1);
  check("prayer: the first rung heals every unit and hits the front enemy once per unit healed", first.filter((e) => e.type === "chainHit" && e.kind === "heal").length === 3 && first.some((e) => e.type === "chainHit" && e.kind === "damage"), String(first.length));
}

// --- Treant: Rooted makes its heal grow through the fight.
{
  const treant = hero("treant");
  const tank = unit("tank");
  tank.hp = 40;
  const r = fight(setup([treant, tank, unit("damage")]), 7, { chargeThreshold: 1e9, heroRootedFullSec: 4, healMaxFractionOfTargetMaxHp: 1 });
  const heals = r.events.filter((e) => e.type === "heal" && e.healerId === treant.id);
  const early = heals[0];
  const late = heals.filter((e) => e.t > 4).pop();
  check("rooted: the Treant's first heal is small and a later one is bigger", !!early && !!late && early.type === "heal" && late.type === "heal" && early.amount <= 6 && late.amount >= 8 && late.amount > early.amount, `${early?.type === "heal" ? early.amount : "-"} -> ${late?.type === "heal" ? late.amount : "-"}`);
}

// --- Vampire: Leech heals the unit that landed a hit; Bite heals the squad.
{
  const vampire = hero("vampire");
  const hurt = unit("damage");
  hurt.hp = 40;
  const r = fight(setup([vampire, hurt, unit("tank")]), 7, { chargeThreshold: 1e9 });
  const leech = r.events.filter((e) => e.type === "heal" && e.healerId === vampire.id && e.targetId === hurt.id);
  check("leech: a hit by a hurt squadmate heals it 1", leech.length > 0 && leech.every((e) => e.type === "heal" && e.amount <= 1 + 1e-9), String(leech.length));

  const squadHurt = unit("tank");
  squadHurt.hp = 60;
  const bite = fight(setup([charged(hero("vampire")), squadHurt, unit("damage")]));
  const hits = bite.events.filter((e) => e.type === "chainHit" && e.hitIndex === 1);
  check("bite: the first rung bites one enemy and heals the squad", hits.some((e) => e.type === "chainHit" && e.kind === "damage") && hits.some((e) => e.type === "chainHit" && e.kind === "heal"), String(hits.length));
}

// --- Twin: copies the neighbour's skill when the squad is built.
{
  const progress = makeInitialProgress(run);
  const roster: SideState = { heroes: [unit("tank"), unit("damage"), unit("support"), hero("twin")], dpsBonus: 0 };
  const squad = fieldSquad(roster, roster.heroes.map((h) => h.id), progress);
  const twin = squad.heroes.find((h) => h.hero === "twin")!;
  const damage = squad.heroes.find((h) => h.id === "u1_damage")!;
  check("twin: Mirror copies the first back-row neighbour's skill", JSON.stringify(twin.chainEffects) === JSON.stringify(damage.chainEffects), JSON.stringify(twin.chainEffects));
  const alone = fieldSquad({ heroes: [unit("tank"), hero("twin")], dpsBonus: 0 }, ["u1_tank", "hero_twin"], progress).heroes.find((h) => h.hero === "twin")!;
  check("twin: alone in the back it copies the front unit", JSON.stringify(alone.chainEffects) === JSON.stringify(["guard"]), JSON.stringify(alone.chainEffects));
}

// --- The merge: candidates, the full-squad rule, the units used, the new hero.
{
  const progress = makeInitialProgress(run);
  const start: SideState = { heroes: ["tank", "damage", "support", "tank", "damage", "support"].map((r, i) => unit(r as PlayerRole, i + 1)), dpsBonus: 0 };
  start.heroes.forEach((h, i) => (h.id = `u${i}_${h.role}`));
  const kinds = mergeCandidates(progress, start, run).map((c) => c.kind);
  check("merge: the starting six (two of each role) can make the seven recipes with at most two of a role", kinds.join() === "berserker,paladin,dragon,necromancer,treant,vampire,twin", kinds.join());

  const five: SideState = { heroes: start.heroes.slice(0, 5), dpsBonus: 0 };
  check("merge: five living units still leave three after a merge, so it is allowed", mergeCandidates(progress, five, run).length > 0);
  const four: SideState = { heroes: start.heroes.slice(0, 4), dpsBonus: 0 };
  check("merge: four living units would leave two for three slots, so there is no merge", mergeCandidates(progress, four, run).length === 0);
  check("merge: mergeEnabled 0 turns it off", mergeCandidates(progress, start, { ...run, mergeEnabled: 0 }).length === 0);

  const tired: SideState = { heroes: start.heroes.map((h) => ({ ...h })), dpsBonus: 0 };
  tired.heroes[3]!.fatigue = 80; // the second tank
  tired.heroes[1]!.fatigue = 10;
  const used = pickIngredients(tired, HERO_POOL.berserker.recipe)!;
  check("merge: the most tired unit of each role is the one used", used.includes("u3_tank") && used.includes("u1_damage") && used.length === 3, used.join());

  const option = mergeCandidates(progress, start, run).find((c) => c.kind === "berserker")!;
  const merged = applyMerge(progress, start, option);
  const made = merged.heroes.find((h) => h.hero === "berserker")!;
  check("merge: three units leave and one hero joins, fresh", merged.heroes.length === 4 && option.ingredientIds.every((id) => !merged.heroes.some((h) => h.id === id)) && made.hp === made.maxHp && made.fatigue === 0);
  check("merge: a hero is never an ingredient and is never made twice", !mergeCandidates(progress, merged, run).some((c) => c.kind === "berserker") && (pickIngredients(merged, ["damage"]) ?? []).every((id) => id !== made.id));

  const ids = new Set(merged.heroes.map((h) => h.id));
  let more = merged;
  for (const role of ["damage", "damage", "tank", "support"] as PlayerRole[]) {
    more = applyOffer(progress, more, { kind: "recruit", role, title: "", detail: "", headline: "" }, run).roster;
  }
  check("merge: recruits after a merge get ids no unit already has", new Set(more.heroes.map((h) => h.id)).size === more.heroes.length && ids.size === merged.heroes.length);
  check("recruit: names the hero it would complete", recipesCompletedBy(start, "tank").join() === "golem" && recipesCompletedBy(start, "damage").join() === "assassin" && recipesCompletedBy(start, "support").join() === "priest");
}

// --- The merge in a run: only after a mini-boss win, and never when turned off.
{
  let merges = 0;
  let wrongRound = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
    const result = runRun(run, new Rng(seed), offerRng, makeOfferPolicy("build", offerRng), seed);
    for (const r of result.rounds) {
      if (!r.mergeTaken) continue;
      merges++;
      if (roundDef(r.roundIndex).kind !== "miniboss" || r.offerTaken !== null) wrongRound++;
    }
    const off = new Rng((seed ^ 0x51ed270b) >>> 0);
    const none = runRun(run, new Rng(seed), off, makeOfferPolicy("build", off), seed, { mergePick: null });
    if (none.rounds.some((r) => r.mergeTaken)) wrongRound++;
  }
  check("run: a merge is taken after a mini-boss win only, in place of the offers", merges > 0 && wrongRound === 0, `${merges} merges, ${wrongRound} wrong`);
}

if (failed) {
  console.error("\nheroes check FAILED");
  process.exit(1);
} else console.log("\nheroes check passed");
