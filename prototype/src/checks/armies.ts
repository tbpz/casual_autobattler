/**
 * The armies (2026-10-20; sim/armies.ts, canvas 10.x and 11.x). Each assertion runs a small hand-built fight (or a roster step)
 * and pins one rule: the two starting squads, the Undead's horde (Raise and Bone Wall raise a skeleton per hit,
 * five at most, then upgrade; the enemy's normal hits go to shields, then warriors, then the Bone Knight; Command; both backfires),
 * the Beasts' pounce (one PACK bar, the Bear leading, Pin, Maul, Tend, the backfire, gained skills), the Mages' orbs (the core orb, no plain attack,
 * add, merge, clear, the beat, the Life drain and its Great Drain, backfire), and that a whole run plays and
 * replays the same for every army.
 *
 * Fights force a chain at tick 1 by starting the firing unit at full charge and pin the backfire coin and the damage variance,
 * so nothing here depends on a lucky roll.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { ROLE_SORT_PRIORITY, ROLE_UPGRADE_POOL, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide, makeOfferPolicy, runRun } from "../sim/run.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import type { ArmyKind, FightSetup, HeroState, SideState } from "../sim/types.js";
import { makeInitialProgress } from "../sim/progress.js";
import { ARMY_ORDER, ARMY_UNITS, makeArmyRoster, makeArmyUnit, unitTitle } from "../sim/armies.js";
import { CARD_DEFS, cardConnects, duoUnlocked, marksMadeBy } from "../sim/cards/index.js";
import type { CardId } from "../sim/cards/index.js";
import type { ArmyBuild } from "../sim/cards/types.js";
import { drawOffers } from "../sim/offers.js";
import { ENCOUNTERS } from "../sim/encounters.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const run = DEFAULT_RUN_CONFIG;
const zero = { maxHp: 0, damage: 0 };
const unit = (army: ArmyKind, role: PlayerRole, n = 1): HeroState => makeArmyUnit(army, role, n, `u${n}_${role}`, zero);

/** A squad in fielding order (tank-first, like roster.ts's fieldSquad) against the round-1 enemy. */
function setup(units: HeroState[], tweak?: (enemy: SideState) => void, encounter = 0): FightSetup {
  const heroes = [...units].sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  const enemy = makeEnemySide(run, 0, encounter);
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
const calm = (enemy: SideState): void => enemy.heroes.forEach((h) => (h.nextAttackT = 1000, h.nextWindupT = 1000));


// --- The two starting squads, and what an army keeps from the plain game.
{
  const progress = (army: ArmyKind) => makeInitialProgress(run, undefined, army);
  const u = makeArmyRoster("undead", progress("undead").bonus).heroes;
  const b = makeArmyRoster("beasts", progress("beasts").bonus).heroes;
  const m = makeArmyRoster("mages", progress("mages").bonus).heroes;
  const count = (hs: HeroState[], role: PlayerRole) => hs.filter((h) => h.role === role).length;
  check("undead start with six units, two of each role", u.length === 6 && count(u, "tank") === 2 && count(u, "damage") === 2 && count(u, "support") === 2);
  check("mages start with six units, two of each role, and field three", m.length === 6 && count(m, "tank") === 2 && count(m, "damage") === 2 && count(m, "support") === 2 && progress("mages").slots === 3);
  check("beasts start with seven units: two Bears, three Wolves, two Stags", b.length === 7 && count(b, "tank") === 2 && count(b, "damage") === 3 && count(b, "support") === 2);
  check("undead field three, beasts field five", progress("undead").slots === 3 && progress("beasts").slots === 5 && progress("beasts").slots <= run.maxSlots);
  check("a plain run is unchanged: three slots, no army", makeInitialProgress(run).slots === 3 && makeInitialProgress(run).army === undefined);
  check("units keep their role, and carry their army and kind", ARMY_ORDER.every((a) => (["tank", "damage", "support"] as PlayerRole[]).every((r) => {
    const h = unit(a, r);
    return h.role === r && h.army === a && h.kind === ARMY_UNITS[a][r].kind && h.chainEffects?.[0] === ARMY_UNITS[a][r].baseChain;
  })));
  check("the unit title replaces the role word", unitTitle(unit("undead", "tank")) === "Bone Knight" && unitTitle(unit("beasts", "damage")) === "Wolf" && unitTitle({ role: "tank" }) === "Tank");
  check("a run's first skills are the army's", progress("beasts").chain.tank.effects[0] === "pin" && progress("beasts").chain.damage.effects[0] === "maul" && progress("beasts").chain.support.effects[0] === "tend" && progress("undead").chain.support.effects[0] === "raise" && progress("undead").chain.tank.effects[0] === "boneWall" && progress("undead").chain.damage.effects[0] === "command" && progress("mages").chain.tank.effects[0] === "frostOrb" && progress("mages").chain.damage.effects[0] === "stormOrb" && progress("mages").chain.support.effects[0] === "lifeOrb");
}

// --- The Undead's horde (2026-10-21): Raise and Bone Wall raise one skeleton per hit, five at most, then upgrade; Command sends them all in.
// `chainMaxHits` caps how many hits a skill lands, so each assertion says how many skeletons it expects.
const standing = (r: FightResult, kind?: "warrior" | "shield") => {
  const last = r.snapshots[r.snapshots.length - 1]!;
  return last.playerHeroes.filter((h) => h.skeleton && h.skeletonKind && h.alive && (!kind || h.skeletonKind === kind));
};
const raises = (r: FightResult) => r.events.filter((e) => e.type === "raise");
/** A fight where each unit's skill goes off once only: nothing refills a bar after the first skill, so the counts below are exact. */
const solo = (s: FightSetup, seed = 7, over: Partial<typeof run.fight> = {}): FightResult => fight(s, seed, { chargeTricklePerSec: 0, chargeWeightDealt: 0, chargeWeightSoaked: 0, chargeWeightRestored: 0, ...over });
{
  const priest = charged(unit("undead", "support"));
  const r = solo(setup([priest, unit("undead", "tank")], calm), 7, { chainMaxHits: 3 });
  const rs = raises(r);
  check("raise: three hits raise three warrior skeletons", rs.length === 3 && rs.every((e) => e.type === "raise" && e.kind === "warrior"), `${rs.length} raises`);
  const sk = standing(r, "warrior");
  check("raise: they stand with the warrior's HP and stay for the fight", sk.length === 3 && sk.every((h) => h.maxHp === run.fight.undeadWarriorHp), `${sk.length} standing`);
  check("raise: each hit is one chain hit of kind raise, with no damage", r.events.filter((e) => e.type === "chainHit" && e.kind === "raise").length === 3 && r.events.every((e) => e.type !== "chainHit" || e.kind !== "raise" || e.damage === 0));
}
{
  const knight = charged(unit("undead", "tank"));
  const r = solo(setup([knight, unit("undead", "support")], calm), 7, { chainMaxHits: 2 });
  const rs = raises(r);
  check("bone wall: two hits raise two shield skeletons", rs.length === 2 && rs.every((e) => e.type === "raise" && e.kind === "shield") && standing(r, "shield").every((h) => h.maxHp === run.fight.undeadShieldHp) && standing(r, "shield").length === 2);
}
{
  const r = solo(setup([charged(unit("undead", "support")), unit("undead", "tank")], calm), 7, { chainMaxHits: 7 });
  const ups = r.events.filter((e) => e.type === "skeletonUpgrade");
  check("limit: seven raise hits leave five skeletons standing, not seven", raises(r).length === run.fight.undeadSkeletonMax && standing(r).length === run.fight.undeadSkeletonMax, `${raises(r).length} raises`);
  check("limit: the two hits past five upgrade the warriors instead (levels 1 then 2)", ups.length === 2 && ups.every((e, i) => e.type === "skeletonUpgrade" && e.kind === "warrior" && e.level === i + 1));
  const lastUp = ups[ups.length - 1]!.t;
  const swings = r.events.filter((e) => e.type === "attack" && e.side === "player" && e.attackerId.startsWith("skeleton_") && e.t > lastUp);
  const want = run.fight.undeadWarriorDamage + 2 * run.fight.undeadWarriorUpgradeDamage;
  check(`upgrade: every standing warrior now hits for ${want}, the ones raised before too`, swings.length > 0 && swings.every((e) => e.type === "attack" && e.damage === want), `${swings.length} swings`);
  const lastSnap = r.snapshots[r.snapshots.length - 1]!.playerHeroes.find((h) => h.skeleton && h.skeletonKind === "warrior");
  check("upgrade: a snapshot carries the kind's level for the +N badge", lastSnap?.skeletonLevel === 2);
}
{
  const r = solo(setup([charged(unit("undead", "tank")), unit("undead", "support")], calm), 7, { chainMaxHits: 7 });
  const want = run.fight.undeadShieldHp + 2 * run.fight.undeadShieldUpgradeHp;
  check("upgrade: a shield skeleton gets tougher, not stronger (45 becomes 61)", standing(r, "shield").length === 5 && standing(r, "shield").every((h) => h.maxHp === want), standing(r, "shield").map((h) => h.maxHp).join(","));
}
{
  // Enemy hits go to the shield first, then the warrior, then the Bone Knight. Both skeletons have 1 HP and the enemy hits for 1,
  // so each hit kills exactly what it lands on and nothing spills over.
  const knight = charged(unit("undead", "tank"));
  const priest = charged(unit("undead", "support"));
  const s = setup([knight, priest], (enemy) => enemy.heroes.forEach((h, i) => { h.nextWindupT = 1000; h.nextAttackT = i === 0 ? 12 : 1000; h.maxHp = h.hp = 1e6; if (i === 0) { h.damage = 1; h.attackIntervalSec = 1.5; } }));
  const r = solo(s, 7, { chainMaxHits: 1, undeadShieldHp: 1, undeadWarriorHp: 1 });
  const shieldId = raises(r).find((e) => e.type === "raise" && e.kind === "shield");
  const warriorId = raises(r).find((e) => e.type === "raise" && e.kind === "warrior");
  const hitsOnUs = r.events.filter((e) => e.type === "attack" && e.side === "enemy" && e.t >= 12).map((e) => (e.type === "attack" ? e.targetId : ""));
  check("order: the first enemy hit lands on the shield skeleton", shieldId?.type === "raise" && hitsOnUs[0] === shieldId.heroId, `${hitsOnUs[0]} vs ${shieldId?.type === "raise" ? shieldId.heroId : "-"}`);
  check("order: the second lands on the warrior skeleton", warriorId?.type === "raise" && hitsOnUs[1] === warriorId.heroId, `${hitsOnUs[1]} vs ${warriorId?.type === "raise" ? warriorId.heroId : "-"}`);
  check("order: the third, with no skeleton standing, lands on the Bone Knight", hitsOnUs[2] === knight.id, `${hitsOnUs[2]}`);
}
{
  // Slams stay random, and so do the hits of an enemy that reaches the back row.
  const duelist = ENCOUNTERS.findIndex((e) => e.name === "Duelist");
  let slamOnSkeleton = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = setup([charged(unit("undead", "support")), unit("undead", "tank"), unit("undead", "damage")], (enemy) => enemy.heroes.forEach((h, i) => { h.nextAttackT = 1000; h.nextWindupT = i === 0 ? 4 : 1000; }), duelist);
    const r = solo(s, seed, { chainMaxHits: 5 });
    if (r.events.some((e) => e.type === "windupHit" && e.targetId.startsWith("skeleton_"))) slamOnSkeleton++;
  }
  check("slams are random: some land on a skeleton and some do not", slamOnSkeleton > 0 && slamOnSkeleton < 40, `${slamOnSkeleton} of 40`);
  let offWall = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const knight = charged(unit("undead", "tank"));
    const s = setup([knight, unit("undead", "support"), unit("undead", "damage")], (enemy) => enemy.heroes.forEach((h, i) => { h.nextWindupT = 1000; h.nextAttackT = i === 0 ? 12 : 1000; h.maxHp = h.hp = 1e6; if (i === 0) { h.damage = 1; h.reachesBackline = true; } }));
    const r = solo(s, seed, { chainMaxHits: 2, undeadShieldHp: 500 });
    const shields = new Set(raises(r).map((e) => (e.type === "raise" ? e.heroId : "")));
    if (r.events.some((e) => e.type === "attack" && e.side === "enemy" && e.t >= 12 && !shields.has(e.targetId))) offWall++;
  }
  check("an enemy that reaches the back row ignores the wall: some of its hits land elsewhere", offWall > 0, `${offWall} of 30`);
}
{
  // Command: every standing skeleton strikes once per hit; with none standing it ends the skill.
  const wraith = charged(unit("undead", "damage"));
  wraith.charge = run.fight.chargeThreshold;
  const priest = unit("undead", "support");
  priest.charge = run.fight.chargeThreshold * 3;
  const r = solo(setup([wraith, priest], calm), 7, { chainMaxHits: 3 });
  const cmd = r.events.filter((e) => e.type === "chainHit" && e.kind === "damage" && e.sourceId.startsWith("skeleton_"));
  const ids = new Set(cmd.map((e) => (e.type === "chainHit" ? e.sourceId : "")));
  check("command: 3 hits with 3 skeletons standing are 9 skeleton strikes", cmd.length === 9 && ids.size === 3, `${cmd.length} strikes from ${ids.size} skeletons`);
  const hit = cmd[0];
  const expected = Math.round(run.fight.undeadWarriorDamage * run.fight.undeadCommandMult * 100) / 100;
  check("command: a first-rung strike is the skeleton's damage times the multiplier", hit?.type === "chainHit" && Math.abs(hit.intended - expected) < 0.01, `${hit?.type === "chainHit" ? hit.intended : "-"} vs ${expected}`);
  const alone = solo(setup([charged(unit("undead", "damage")), unit("undead", "tank")], calm), 7);
  const end = alone.events.find((e) => e.type === "chainEnd");
  check("command: with no skeleton standing the skill ends at once, striking nothing", !alone.events.some((e) => e.type === "chainHit") && end?.type === "chainEnd" && end.reason === "noTarget", end?.type === "chainEnd" ? end.reason : "-");
}
{
  // Backfires. One chain raises (no backfire), a later one on a worn unit that does backfire either knocks a skeleton down or turns
  // the strikes on our own front unit. The worn unit's fatigue makes its backfire likely, so a seed loop finds one quickly.
  let crumbled = false, turned = false;
  for (let seed = 1; seed <= 300 && !(crumbled && turned); seed++) {
    const raiser = charged(unit("undead", "support"));
    raiser.charge = run.fight.chargeThreshold * 3;
    const wornPriest = unit("undead", "support", 2);
    wornPriest.charge = run.fight.chargeThreshold * 2;
    wornPriest.fatigue = 100;
    const wornWraith = unit("undead", "damage");
    wornWraith.charge = run.fight.chargeThreshold;
    wornWraith.fatigue = 100;
    const knight = unit("undead", "tank");
    const r = solo(setup([knight, raiser, wornPriest, wornWraith], calm), seed, { chainMaxHits: 3, forceBackfire: undefined });
    const starts = r.events.filter((e) => e.type === "chainStart");
    const first = starts[0], second = starts[1], third = starts[2];
    if (!first || first.type !== "chainStart" || first.backfire) continue;
    if (second?.type === "chainStart" && second.backfire && second.heroId === wornPriest.id) {
      const knocked = r.events.find((e) => e.type === "chainHit" && e.backfire && e.sourceId === wornPriest.id && e.kind === "damage" && e.targetId?.startsWith("skeleton_"));
      if (knocked) crumbled = true;
    }
    if (third?.type === "chainStart" && third.backfire && third.heroId === wornWraith.id) {
      const strikes = r.events.filter((e) => e.type === "chainHit" && e.backfire && e.sourceId.startsWith("skeleton_") && e.targetId !== null);
      if (strikes.length > 0 && strikes.every((e) => e.type === "chainHit" && [knight.id, raiser.id, wornPriest.id, wornWraith.id].includes(e.targetId!))) turned = true;
    }
  }
  check("backfire: a backfired Raise knocks down one of our own warrior skeletons", crumbled);
  check("backfire: a backfired Command makes each skeleton strike one of our own units", turned);
}
{
  const plain = solo(setup([charged(unit("beasts", "tank")), unit("beasts", "damage")], calm), 7);
  check("only the Undead bring skeleton places: a Beast fight has none", !plain.snapshots[0]!.playerHeroes.some((h) => h.skeleton));
  const undead = solo(setup([unit("undead", "tank")], calm), 7);
  check("an Undead fight starts with five empty places", undead.snapshots[0]!.playerHeroes.filter((h) => h.skeleton && !h.alive && h.maxHp === 0).length === run.fight.undeadSkeletonMax);
}

// --- The Mages' orbs (2026-10-21; canvas 12.0D; merge reworked 2026-10-22; core orb and Life drain 2026-10-23, canvas 12.0E): every mage has a
// core orb that never leaves and makes no plain attack; every skill hit adds a loose orb (3 at most); every orb works alone on a shared beat
// (1 s in, then every 2 s) for the mage's own `damage`; a 4th hit merges the loose orbs into one great shot that fires at once and leaves no
// loose orb, and the next hit starts again from none. Orbs still out when a skill ends stay. Every fight below has an enemy with 1e6 HP that
// never acts, so nothing ends early and nothing dies. A test that is about the merge alone moves the first beat out of the fight
// (`noBeat`), so the core orb's work does not mix into what it counts.
const noBeat = { mageOrbFirstBeatSec: 1000 };
type EventOf<T extends FightEvent["type"]> = Extract<FightEvent, { type: T }>;
const eventsOf = <T extends FightEvent["type"]>(r: FightResult, type: T): EventOf<T>[] => r.events.filter((e): e is EventOf<T> => e.type === type);
const calmBig = (enemy: SideState): void => {
  calm(enemy);
  enemy.heroes.forEach((h) => (h.maxHp = h.hp = 1e6));
};
const mageIn = (r: FightResult, id: string, t = Infinity) => (r.snapshots.find((s) => s.t >= t) ?? r.snapshots[r.snapshots.length - 1]!).playerHeroes.find((h) => h.id === id)!;
const shotSize = (base: number): number => Math.round(base * run.fight.chainHitMultiplier);
{
  const storm = charged(unit("mages", "damage"));
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 3 });
  const adds = eventsOf(r, "orbAdd");
  check("storm orb: three hits add three orbs, one each", adds.length === 3 && adds.every((e, i) => e.orbs === i + 1 && e.heroId === storm.id), adds.map((e) => e.orbs).join(","));
  check("storm orb: a hit that adds an orb is a chain hit of kind orb with no damage", r.events.filter((e) => e.type === "chainHit" && e.kind === "orb").length === 3 && r.events.every((e) => e.type !== "chainHit" || e.kind !== "orb" || (e.damage === 0 && e.mark === undefined)));
  check("storm orb: the snapshot carries the three orbs", mageIn(r, storm.id).orbs === 3);
}
{
  const storm = charged(unit("mages", "damage"));
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 6 });
  const merges = eventsOf(r, "orbMerge");
  const strikes = eventsOf(r, "orbStrike");
  const adds = eventsOf(r, "orbAdd");
  check("merge: the 4th hit merges the orbs and fires one shot", merges.length === 1 && strikes.length === 1 && merges[0]!.t === strikes[0]!.t, `${merges.length} merges, ${strikes.length} shots`);
  check("merge: the big orb is gone at once, so the 5th and 6th hits start again from none (1, 2, 3, then 1, 2)", adds.map((e) => e.orbs).join(",") === "1,2,3,1,2", adds.map((e) => e.orbs).join(","));
  const zaps = r.events.filter((e) => e.type === "chainHit" && e.sourceId === storm.id && e.kind === "damage");
  check(`merge: the shot is ${shotSize(run.fight.mageStormMergeDamage)} on the front enemy and leaves ${run.fight.mageStormMergeBurn} Burn on it; the hits after it do no damage`, zaps.length === 1 && zaps.every((e) => e.type === "chainHit" && e.intended === shotSize(run.fight.mageStormMergeDamage) && e.mark === "burn" && e.markStacks === run.fight.mageStormMergeBurn && e.targetId === r.snapshots[0]!.enemyHeroes[0]!.id), zaps.map((e) => (e.type === "chainHit" ? e.intended : 0)).join(","));
  check("skill end: the orbs still out when the skill ends stay (2 after the 6th hit)", mageIn(r, storm.id).orbs === 2);
}
{
  const storm = charged(unit("mages", "damage"));
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 8 });
  const zaps = r.events.filter((e) => e.type === "chainHit" && e.sourceId === storm.id && e.kind === "damage");
  check("merge: a skill long enough fires a second shot, as big as the first, and ends with no orbs", eventsOf(r, "orbMerge").length === 2 && zaps.length === 2 && zaps.every((e) => e.type === "chainHit" && e.intended === shotSize(run.fight.mageStormMergeDamage)) && mageIn(r, storm.id).orbs === 0, zaps.map((e) => (e.type === "chainHit" ? e.intended : 0)).join(","));
}
{
  const r = solo(setup([charged(unit("mages", "damage")), unit("mages", "tank")], calmBig), 7, { chainMaxHits: 2 });
  check("skill end: a skill that never merged keeps its orbs", eventsOf(r, "orbMerge").length === 0 && mageIn(r, r.snapshots[0]!.playerHeroes.find((h) => h.kind === "stormMage")!.id).orbs === 2);
}
{
  // The beat: the core orb and two loose Storm orbs, out from the start of the fight, work together on the first beat (1 s in), each on one
  // enemy picked at random, for the mage's own damage.
  let sameTwice = 0, allApart = 0, wrong = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const storm = unit("mages", "damage");
    storm.orbs = 2;
    const three = (enemy: SideState): void => {
      calmBig(enemy);
      const base = enemy.heroes[0]!;
      enemy.heroes.push({ ...base, id: "e2", name: "e2" }, { ...base, id: "e3", name: "e3" });
    };
    const r = solo(setup([storm, unit("mages", "tank")], three), seed);
    const first = eventsOf(r, "orbTick").filter((e) => e.heroId === storm.id && e.t < run.fight.mageOrbFirstBeatSec + 0.2);
    const ids = first.map((e) => e.targetId);
    if (first.length !== 3 || first.some((e) => e.orbKind !== "storm" || e.amount !== storm.damage || Math.abs(e.t - run.fight.mageOrbFirstBeatSec) > 0.1) || first.map((e) => e.index).join() !== "-1,0,1") wrong++;
    if (new Set(ids).size < 3) sameTwice++;
    else allApart++;
  }
  check("beat: the core orb and two loose Storm orbs zap together 1 s in, for the Storm Mage's damage each", wrong === 0, `${wrong} seeds off`);
  check("beat: each orb picks its enemy alone, so two can pick the same one", sameTwice > 0 && allApart > 0, `${sameTwice} shared, ${allApart} apart`);
}
{
  // The core orb: a mage with no loose orb at all still works on the first beat and on the next one 2 s later, and a mage makes no plain attack.
  const storm = unit("mages", "damage");
  const tank = unit("mages", "tank");
  const life = unit("mages", "support");
  const r = solo(setup([storm, tank, life], calmBig), 7);
  const stormTicks = eventsOf(r, "orbTick").filter((e) => e.heroId === storm.id);
  check("core orb: with no loose orb the Storm Mage's core orb still zaps on the first beat and the next, for its damage", stormTicks.length >= 2 && stormTicks.slice(0, 2).every((e, i) => e.index === -1 && e.orbKind === "storm" && e.amount === storm.damage && Math.abs(e.t - (run.fight.mageOrbFirstBeatSec + i * run.fight.mageOrbBeatSec)) < 0.1), stormTicks.slice(0, 3).map((e) => e.t.toFixed(1)).join(","));
  check("no plain attack: no attack and no beat heal comes from a mage", !r.events.some((e) => (e.type === "attack" && e.side === "player") || (e.type === "heal" && e.side === "player")), `${r.events.filter((e) => e.type === "attack" && e.side === "player").length} attacks`);
  check("a Life Mage has no beat heal, so it shows damage rather than heal", life.healPerBeat === undefined && life.damage === ARMY_UNITS.mages.support.damage);
}
{
  // Orb work fills the mage's skill bar like a hit would (no trickle, nothing hits the squad): one core zap puts its damage into the Storm Mage's bar.
  const storm = unit("mages", "damage");
  const r = fight(setup([storm, unit("mages", "tank")], calmBig), 7, { chargeTricklePerSec: 0 });
  check("orb work fills the skill bar: the first core zap adds its damage to the Storm Mage's charge", Math.abs(mageIn(r, storm.id, run.fight.mageOrbFirstBeatSec + 0.1).charge - storm.damage) < 0.01, `${mageIn(r, storm.id, run.fight.mageOrbFirstBeatSec + 0.1).charge}`);
}
{
  // A Storm orb's zap is a hit by a Damage unit for the runes that read a normal hit: Kindling puts a burn on what it zapped.
  const storm = unit("mages", "damage");
  const r = solo({ ...setup([storm, unit("mages", "tank")], calmBig), cards: ["kindling"] }, 7);
  const kindled = eventsOf(r, "cardTriggered").filter((e) => e.card === "kindling");
  check("storm zap: counts as a Damage unit's hit, so Kindling fires on it", kindled.length >= 1 && Math.abs(kindled[0]!.t - run.fight.mageOrbFirstBeatSec) < 0.1, `${kindled.length} burns`);
}
{
  // Orbs left after a skill keep working: a skill of two hits leaves two Storm orbs, and they zap on the next beat.
  const storm = charged(unit("mages", "damage"));
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 2 });
  const zaps = eventsOf(r, "orbTick").filter((e) => e.heroId === storm.id);
  check("beat: orbs left after a skill keep working on the beat", zaps.length >= 2 && zaps.every((e) => e.orbKind === "storm"), `${zaps.length} zaps`);
}
{
  // Frost orbs shield their own mage: the core orb and two loose ones give it its damage each on the first beat.
  const frost = unit("mages", "tank");
  frost.orbs = 2;
  const r = solo(setup([frost, unit("mages", "support")], calmBig), 7);
  const ticks = eventsOf(r, "orbTick").filter((e) => e.heroId === frost.id && e.t < run.fight.mageOrbFirstBeatSec + 0.2);
  const afterBeat = mageIn(r, frost.id, run.fight.mageOrbFirstBeatSec + 0.1).marks.shield;
  check("frost orb: the core orb and two loose ones shield their own mage on the first beat", ticks.length === 3 && ticks.every((e) => e.orbKind === "frost" && e.targetId === frost.id && e.amount === frost.damage) && afterBeat === 3 * frost.damage, `${afterBeat} shield`);
}
{
  // Life orbs drain: each takes the Life Mage's damage from the front enemy and heals the most hurt unit by what it took, and says so through
  // one orbTick, not also a heal event. The core orb and two loose ones work on the first beat.
  const tank = unit("mages", "tank");
  tank.hp = tank.maxHp - 30;
  const life = unit("mages", "support");
  life.orbs = 2;
  const lr = solo(setup([tank, life], calmBig), 7);
  const lt = eventsOf(lr, "orbTick").filter((e) => e.heroId === life.id && e.t < run.fight.mageOrbFirstBeatSec + 0.2);
  const front = lr.snapshots[0]!.enemyHeroes[0]!;
  const after = lr.snapshots.find((s) => s.t >= run.fight.mageOrbFirstBeatSec + 0.1)!;
  check("life orb: three orbs each drain the front enemy and heal the most hurt unit, the tank, by the same amount", lt.length === 3 && lt.every((e) => e.orbKind === "life" && e.foeId === front.id && e.drained === life.damage && e.targetId === tank.id && e.amount === life.damage), lt.map((e) => `${e.targetId}:${e.amount}/${e.drained}`).join(" "));
  check("life orb: the enemy lost what was drained and the tank gained it", after.enemyHeroes[0]!.hp === front.hp - 3 * life.damage && after.playerHeroes.find((h) => h.id === tank.id)!.hp === tank.hp + 3 * life.damage, `${front.hp - after.enemyHeroes[0]!.hp} drained`);
  check("life orb: the drain is not announced a second time as a heal event", !lr.events.some((e) => e.type === "heal" && Math.abs(e.t - lt[0]!.t) < 0.01));
  const whole = unit("mages", "support");
  const wr = solo(setup([unit("mages", "tank"), whole], calmBig), 7);
  const wt = eventsOf(wr, "orbTick").find((e) => e.heroId === whole.id);
  check("life orb: with nobody hurt it still takes HP from the enemy, and heals nothing", wt?.orbKind === "life" && wt.drained === whole.damage && wt.amount === 0, `${wt?.drained}/${wt?.amount}`);
}
{
  // Merged Frost and Life orbs reach the whole squad.
  const frost = charged(unit("mages", "tank"));
  const storm = unit("mages", "damage");
  const r = solo(setup([frost, storm], calmBig), 7, { chainMaxHits: 4, ...noBeat });
  const shields = r.events.filter((e) => e.type === "chainHit" && e.sourceId === frost.id && e.kind === "heal" && e.mark === "shield");
  check("frost merge: the 4th hit shields every unit, up to half its HP", shields.length === 2 && shields.every((e) => e.type === "chainHit" && Math.abs((e.markStacks ?? 0) - Math.min(run.fight.mageFrostMergeShield, (e.targetId === frost.id ? frost.maxHp : storm.maxHp) * run.fight.shieldCapFractionOfMaxHp)) < 0.01) && new Set(shields.map((e) => (e.type === "chainHit" ? e.targetId : ""))).size === 2);
  check("frost merge: the orbs are gone after the shot", mageIn(r, frost.id).orbs === 0 && eventsOf(r, "orbStrike").length === 1);
  const tank = unit("mages", "tank");
  tank.hp = tank.maxHp - 60;
  const hurt = unit("mages", "damage");
  hurt.hp = hurt.maxHp - 40;
  const life = charged(unit("mages", "support"));
  const lr = solo(setup([tank, hurt, life], calmBig), 7, { chainMaxHits: 4, ...noBeat });
  const drain = lr.events.find((e) => e.type === "chainHit" && e.sourceId === life.id && e.kind === "damage");
  const heals = lr.events.filter((e) => e.type === "chainHit" && e.sourceId === life.id && e.kind === "heal");
  const frontId = lr.snapshots[0]!.enemyHeroes[0]!.id;
  const taken = drain?.type === "chainHit" ? drain.damage : 0;
  const share = taken / 3;
  const healed = (h: HeroState): number => {
    const e = heals.find((x) => x.type === "chainHit" && x.targetId === h.id);
    return e?.type === "chainHit" ? e.damage : -1;
  };
  check(`life merge: the 4th hit is one Great Drain of ${shotSize(run.fight.mageLifeMergeDrain)} from the front enemy`, drain?.type === "chainHit" && drain.targetId === frontId && drain.intended === shotSize(run.fight.mageLifeMergeDrain) && drain.damage === drain.intended && eventsOf(lr, "orbMerge").length === 1, `${taken}`);
  check("life merge: what it took is shared over the three living units, each capped by its room", heals.length === 3 && Math.abs(healed(tank) - Math.min(share, tank.maxHp - tank.hp)) < 0.01 && Math.abs(healed(hurt) - Math.min(share, hurt.maxHp - hurt.hp)) < 0.01 && healed(life) === 0, `${healed(tank)} / ${healed(hurt)} / ${healed(life)}`);
}
{
  // The core orb survives a merge: after the shot the mage keeps working on the beat.
  const storm = charged(unit("mages", "damage"));
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 6 });
  const merge = eventsOf(r, "orbMerge")[0];
  check("core orb: it is not spent by a merge, and keeps zapping on the beats after it", merge !== undefined && eventsOf(r, "orbTick").some((e) => e.heroId === storm.id && e.index === -1 && e.t > merge.t + 0.5), `${merge?.t}`);
}
{
  // Backfire pops one orb; with nothing to pop the skill ends.
  const storm = charged(unit("mages", "damage"));
  storm.orbs = 2;
  const r = solo(setup([storm, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 5, forceBackfire: "always" });
  const pops = eventsOf(r, "orbPop");
  const end = r.events.find((e) => e.type === "chainEnd");
  check("backfire: each backfired hit pops one loose orb (2, then 1, then none)", pops.length === 2 && pops[0]!.orbs === 1 && pops[1]!.orbs === 0 && eventsOf(r, "orbAdd").length === 0, pops.map((e) => e.orbs).join(","));
  check("backfire: with nothing left to pop the skill ends", end?.type === "chainEnd" && end.backfire && end.reason === "noTarget", end?.type === "chainEnd" ? end.reason : "-");
  const full = charged(unit("mages", "damage"));
  full.orbs = 3;
  const fr = solo(setup([full, unit("mages", "tank")], calmBig), 7, { chainMaxHits: 1, forceBackfire: "always" });
  check("backfire: a backfired hit pops an orb and never fires the shot", eventsOf(fr, "orbPop").length === 1 && eventsOf(fr, "orbMerge").length === 0);
}
{
  const m = solo(setup([unit("mages", "tank")], calmBig), 7);
  check("a Mage fight brings no skeleton places, and every Mage snapshot carries its orbs", !m.snapshots[0]!.playerHeroes.some((h) => h.skeleton) && m.snapshots[0]!.playerHeroes.every((h) => h.orbs === 0));
  const u = solo(setup([unit("undead", "tank")], calm), 7);
  check("only Mages carry orbs in a snapshot", u.snapshots[0]!.playerHeroes.every((h) => h.orbs === undefined));
  check("no Mage skill is a family of guard or mend", cardConnects("bulwark", ["frostOrb"]) === false && !duoUnlocked("phoenix", ["lifeOrb"], ["secondWind"]) && !cardConnects("bulwark", ["stormOrb"]));
  check("the Mage skills make the marks a merged shot leaves: Storm Burn, Frost Frozen and Shield, Life Shield", marksMadeBy(["stormOrb"]).has("burn") && marksMadeBy(["frostOrb"]).has("frozen") && marksMadeBy(["frostOrb"]).has("shield") && marksMadeBy(["lifeOrb"]).has("shield") && !marksMadeBy(["lifeOrb"]).has("burn") && !marksMadeBy(["stormOrb"]).has("exposed"));
}

// --- The Mage marks and runes (2026-10-23; DECISIONS.md "Mage runs get marks from merged shots only, four Mage runes and two duos"): only a merged
// shot leaves a mark, and the four Mage runes and two duos read the orb hooks. Every fight has an enemy with 1e6 HP that never acts.
{
  const three = (enemy: SideState): void => {
    calmBig(enemy);
    const base = enemy.heroes[0]!;
    enemy.heroes.push({ ...base, id: "e2", name: "e2" }, { ...base, id: "e3", name: "e3" });
  };
  const hits = (r: FightResult, sourceId: string) => r.events.filter((e): e is Extract<FightEvent, { type: "chainHit" }> => e.type === "chainHit" && e.sourceId === sourceId);

  // The marks.
  {
    const quiet = solo(setup([unit("mages", "damage"), unit("mages", "tank")], calmBig), 7);
    check("beats leave no mark: a Storm Mage's beats alone put no Burn or Exposed on the enemy", quiet.snapshots.every((sn) => sn.enemyHeroes.every((h) => h.marks.burn === 0 && h.marks.exposed === 0)) && quiet.events.every((e) => e.type !== "chainHit"));
    const frost = charged(unit("mages", "tank"));
    const fr = solo(setup([frost, unit("mages", "damage")], three), 7, { chainMaxHits: 4, ...noBeat });
    const stuns = hits(fr, frost.id).filter((e) => e.kind === "stun");
    const foes = fr.snapshots[0]!.enemyHeroes.length;
    check("frost merge: the shot freezes every living enemy, for the set time", foes > 1 && stuns.length === foes && new Set(stuns.map((e) => e.targetId)).size === foes && stuns.every((e) => e.durationSec === run.fight.mageFrostMergeFreezeSec), `${stuns.length} of ${foes}: ${stuns.map((e) => e.durationSec).join(",")}`);
    const life = charged(unit("mages", "support"));
    const lr = solo(setup([life, unit("mages", "tank"), unit("mages", "damage")], calmBig), 7, { chainMaxHits: 4, ...noBeat });
    const heals = hits(lr, life.id).filter((e) => e.kind === "heal");
    const drain = hits(lr, life.id).find((e) => e.kind === "damage")!;
    const share = drain.damage / 3;
    check("life merge: with nobody hurt the whole share becomes Shield, up to the cap", heals.length === 3 && heals.every((e) => e.mark === "shield" && Math.abs((e.markStacks ?? 0) - Math.min(share, (lr.snapshots[0]!.playerHeroes.find((h) => h.id === e.targetId)!.maxHp) * run.fight.shieldCapFractionOfMaxHp)) < 0.01), heals.map((e) => e.markStacks?.toFixed(1)).join("/"));
    const hurt = unit("mages", "tank");
    hurt.hp = hurt.maxHp - 5;
    const life2 = charged(unit("mages", "support"));
    const lr2 = solo(setup([life2, hurt, unit("mages", "damage")], calmBig), 7, { chainMaxHits: 4, ...noBeat });
    const h2 = hits(lr2, life2.id).filter((e) => e.kind === "heal");
    const toHurt = h2.find((e) => e.targetId === hurt.id)!;
    check("life merge: a unit with room is healed first and only the rest becomes Shield", Math.abs(toHurt.damage - 5) < 0.01 && Math.abs((toHurt.markStacks ?? 0) - (share - 5)) < 0.5, `${toHurt.damage} healed, ${toHurt.markStacks} shield`);
  }

  // The runes.
  const held = (units: HeroState[], cards: CardId[], tweak: (e: SideState) => void = calmBig) => ({ ...setup(units, tweak), cards });
  const triggers = (r: FightResult, card: CardId) => eventsOf(r, "cardTriggered").filter((e) => e.card === card);
  {
    // Echo.
    const storm = charged(unit("mages", "damage"));
    const r = solo(held([storm, unit("mages", "tank")], ["echo"]), 7, { chainMaxHits: 4, ...noBeat });
    check("Echo: a merge leaves one loose orb behind", mageIn(r, storm.id).orbs === 1 && triggers(r, "echo").length === 1);
    const plain = solo(held([charged(unit("mages", "damage")), unit("mages", "tank")], []), 7, { chainMaxHits: 4, ...noBeat });
    check("Echo: without it a merge leaves none", mageIn(plain, plain.snapshots[0]!.playerHeroes.find((h) => h.kind === "stormMage")!.id).orbs === 0);
  }
  const firstBeat = (r: FightResult, id: string) => eventsOf(r, "orbTick").filter((e) => e.heroId === id && e.t < run.fight.mageOrbFirstBeatSec + 0.2);
  const atFirstBeat = (r: FightResult, card: CardId) => triggers(r, card).filter((e) => e.t < run.fight.mageOrbFirstBeatSec + 0.2);
  {
    // Vessel: a mage holds one more loose orb before they merge, and the merged shot is bigger.
    const storm = charged(unit("mages", "damage"));
    const r = solo(held([storm, unit("mages", "tank")], ["vessel"]), 7, { chainMaxHits: 6, ...noBeat });
    const adds = eventsOf(r, "orbAdd").map((e) => e.orbs).join();
    const shot = r.events.find((e) => e.type === "chainHit" && e.sourceId === storm.id && e.kind === "damage");
    check("Vessel: the orbs reach four before the 5th hit merges them (1, 2, 3, 4, then 1 again)", adds === "1,2,3,4,1" && eventsOf(r, "orbMerge").length === 1 && eventsOf(r, "orbMerge")[0]!.orbs === run.fight.vesselOrbMax, adds);
    check("Vessel: the merged shot is bigger by the set share", shot?.type === "chainHit" && shot.intended === Math.round(shotSize(run.fight.mageStormMergeDamage) * run.fight.vesselShotMult), shot?.type === "chainHit" ? String(shot.intended) : "no shot");
  }
  {
    // Fuse: a mage's loose orbs merge after two; the shot stays full size (2026-10-28: the smaller shot is gone, a merge is a payoff).
    const storm = charged(unit("mages", "damage"));
    const r = solo(held([storm, unit("mages", "tank")], ["fuse"]), 7, { chainMaxHits: 6, ...noBeat });
    const adds = eventsOf(r, "orbAdd").map((e) => e.orbs).join();
    const shots = r.events.filter((e) => e.type === "chainHit" && e.sourceId === storm.id && e.kind === "damage");
    check("Fuse: the orbs merge at two (1, 2, merge, 1, 2, merge)", adds === "1,2,1,2" && eventsOf(r, "orbMerge").length === 2, adds);
    check("Fuse: each merged shot is the usual size", shots.length === 2 && shots.every((e) => e.type === "chainHit" && e.intended === shotSize(run.fight.mageStormMergeDamage)), shots.map((e) => (e.type === "chainHit" ? e.intended : 0)).join());
    const plain = solo(held([charged(unit("mages", "damage")), unit("mages", "tank")], []), 7, { chainMaxHits: 6, ...noBeat });
    check("Vessel and Fuse: without either, the limit and the shot are the usual ones", eventsOf(plain, "orbAdd").map((e) => e.orbs).join() === "1,2,3,1,2" && eventsOf(plain, "orbMerge").length === 1);
  }
  {
    // Kernel: the core orb stores a charge on every beat (up to the limit), and the next merged shot spends them all (2026-10-28).
    // The Storm Mage holds a full set of orbs and its bar fills on the trickle alone, so its first chain lands on a known number of beats.
    const shotOf = (r: FightResult, id: string) => r.events.find((e) => e.type === "chainHit" && e.sourceId === id && e.kind === "damage");
    const stormOf = (): HeroState => {
      const s = unit("mages", "damage");
      s.orbs = run.fight.mageOrbMax;
      return s;
    };
    // The bar fills at 6 a second, so the Storm Mage's first chain lands after its core beats at 1, 3, 5 and 7 seconds: four stored.
    const slow = { chargeTricklePerSec: 6, chainMaxHits: 1 };
    const usual = shotSize(run.fight.mageStormMergeDamage);
    const stormId = (r: FightResult): string => r.snapshots[0]!.playerHeroes.find((h) => h.kind === "stormMage")!.id;
    const full = solo(held([stormOf(), unit("mages", "tank")], ["kernel"]), 7, { ...slow, kernelMax: 3 });
    const fullMerge = eventsOf(full, "orbMerge").find((e) => e.heroId === stormId(full))!;
    const fullShot = shotOf(full, stormId(full));
    check("Kernel: with the store full the merged shot is the set number of times bigger", fullShot?.type === "chainHit" && fullShot.intended === Math.round(usual * run.fight.kernelShotMult), `${fullShot?.type === "chainHit" ? fullShot.intended : "no shot"}`);
    const spent = triggers(full, "kernel").filter((e) => e.t <= fullMerge.t + 0.01);
    check("Kernel: one trigger on the shot, naming the charges spent", spent.length === 1 && spent[0]!.amount === 3, spent.map((e) => e.amount).join());
    const notFull = solo(held([stormOf(), unit("mages", "tank")], ["kernel"]), 7, slow);
    const notFullShot = shotOf(notFull, stormId(notFull));
    check("Kernel: a merge before the store is full is the usual size and spends nothing", notFullShot?.type === "chainHit" && notFullShot.intended === usual && triggers(notFull, "kernel").filter((e) => e.t < 7.6).length === 0);
    const base = solo(held([stormOf(), unit("mages", "tank")], []), 7, { ...slow, kernelMax: 3 });
    const baseShot = shotOf(base, stormId(base));
    check("Kernel: without it the shot is the usual size however long it waits", baseShot?.type === "chainHit" && baseShot.intended === usual);
  }
  {
    // Static: when a Storm Mage's orbs merge, the shot also strikes every other enemy, for a share of the shot per orb it held (2026-10-28).
    const storm = charged(unit("mages", "damage"));
    storm.orbs = run.fight.mageOrbMax;
    const r = solo(held([storm, unit("mages", "tank")], ["static"], three), 7, { chainMaxHits: 1, ...noBeat });
    const strikes = triggers(r, "static");
    const each = Math.round(shotSize(run.fight.mageStormMergeDamage) * run.fight.staticSharePerOrb * run.fight.mageOrbMax);
    const frontId = r.snapshots[0]!.enemyHeroes[0]!.id;
    const foes = r.snapshots[0]!.enemyHeroes.length;
    check("Static: the merged shot also strikes every other enemy, the share per orb merged", eventsOf(r, "orbMerge").length === 1 && foes > 2 && strikes.length === foes - 1 && new Set(strikes.map((e) => e.targetId)).size === foes - 1 && strikes.every((e) => e.targetId !== frontId && Math.abs(e.amount - each) <= 1), `${strikes.length} of ${foes - 1} strikes at ${strikes.map((e) => e.amount).join()}`);
    const frost = charged(unit("mages", "tank"));
    frost.orbs = run.fight.mageOrbMax;
    const fr = solo(held([frost, unit("mages", "damage")], ["static"], three), 7, { chainMaxHits: 1, ...noBeat });
    check("Static: a Frost Mage's merge strikes nothing", eventsOf(fr, "orbMerge").length === 1 && triggers(fr, "static").length === 0);
    const none = solo(held([(() => { const s = charged(unit("mages", "damage")); s.orbs = run.fight.mageOrbMax; return s; })(), unit("mages", "tank")], [], three), 7, { chainMaxHits: 1, ...noBeat });
    check("Static: without it only the front enemy is hit", eventsOf(none, "orbMerge").length === 1 && triggers(none, "static").length === 0);
  }
  {
    // Leech: when another mage's orbs merge, the Life Mage gains a loose orb.
    const frost = charged(unit("mages", "tank"));
    const life = unit("mages", "support");
    const r = solo(held([frost, life], ["leech"]), 7, { chainMaxHits: 4, ...noBeat });
    check("Leech: when the Frost Mage's orbs merge, the Life Mage gains a loose orb", mageIn(r, life.id).orbs === 1 && triggers(r, "leech").length === 1 && triggers(r, "leech")[0]!.targetId === life.id);
    const own = charged(unit("mages", "support"));
    const ownRun = solo(held([own, unit("mages", "tank")], ["leech"]), 7, { chainMaxHits: 4, ...noBeat });
    check("Leech: the Life Mage's own merge gives it nothing", eventsOf(ownRun, "orbMerge").length === 1 && mageIn(ownRun, own.id).orbs === 0 && triggers(ownRun, "leech").length === 0);
    const none = solo(held([charged(unit("mages", "tank")), unit("mages", "support")], []), 7, { chainMaxHits: 4, ...noBeat });
    check("Leech: without it a merge gives the Life Mage nothing", none.snapshots[none.snapshots.length - 1]!.playerHeroes.find((h) => h.kind === "lifeMage")!.orbs === 0);
  }
  {
    // Tempo: the core orbs work twice on every beat; the loose ones once.
    const storm = unit("mages", "damage");
    storm.orbs = 2;
    const r = solo(held([storm, unit("mages", "tank")], ["tempo"]), 7);
    check("Tempo: the core orb works twice on the first beat, then each loose orb once", firstBeat(r, storm.id).map((e) => e.index).join() === "-1,-1,0,1", firstBeat(r, storm.id).map((e) => e.index).join());
    check("Tempo: the second core beat is the set share of the first", Math.abs(firstBeat(r, storm.id)[1]!.amount - storm.damage * run.fight.tempoSecondBeat) < 0.01 && firstBeat(r, storm.id)[0]!.amount === storm.damage, firstBeat(r, storm.id).map((e) => e.amount).join());
    check("Tempo: the extra beat does not double again (one trigger per mage's core orb)", atFirstBeat(r, "tempo").length === 2, `${atFirstBeat(r, "tempo").length} triggers`);
    const plain = unit("mages", "damage");
    plain.orbs = 2;
    const q = solo(held([plain, unit("mages", "tank")], []), 7);
    check("Tempo: without it the core orb works once", firstBeat(q, plain.id).map((e) => e.index).join() === "-1,0,1");
  }
  {
    // Overload: a merge by one mage merges every other mage holding two loose orbs or more at the same moment (2026-10-28).
    const withOrbs = (u: HeroState, n: number): HeroState => {
      u.orbs = n;
      return u;
    };
    const frost = withOrbs(charged(unit("mages", "tank")), run.fight.mageOrbMax);
    const storm = withOrbs(unit("mages", "damage"), run.fight.overloadMinOrbs);
    const life = withOrbs(unit("mages", "support"), run.fight.overloadMinOrbs);
    const r = solo(held([frost, storm, life], ["overload"], three), 7, { chainMaxHits: 1, ...noBeat });
    const merges = eventsOf(r, "orbMerge");
    check("Overload: when every other mage holds the set number of orbs, one merge sets them all off at the same moment", merges.length === 3 && new Set(merges.map((e) => e.t)).size === 1 && new Set(merges.map((e) => e.heroId)).size === 3 && eventsOf(r, "orbStrike").length === 3, merges.map((e) => `${e.heroId}@${e.t}`).join());
    check("Overload: one trigger, naming how many mages it merged; their orbs are gone", triggers(r, "overload").length === 1 && triggers(r, "overload")[0]!.amount === 2 && mageIn(r, storm.id).orbs === 0 && mageIn(r, life.id).orbs === 0);
    const few = withOrbs(unit("mages", "damage"), run.fight.overloadMinOrbs - 1);
    const q = solo(held([withOrbs(charged(unit("mages", "tank")), run.fight.mageOrbMax), few, withOrbs(unit("mages", "support"), run.fight.overloadMinOrbs)], ["overload"]), 7, { chainMaxHits: 1, ...noBeat });
    check("Overload: with one other mage holding fewer loose orbs than the set number, nothing cascades", eventsOf(q, "orbMerge").length === 1 && triggers(q, "overload").length === 0 && mageIn(q, few.id).orbs === run.fight.overloadMinOrbs - 1);
    const none = solo(held([withOrbs(charged(unit("mages", "tank")), run.fight.mageOrbMax), withOrbs(unit("mages", "damage"), run.fight.overloadMinOrbs)], []), 7, { chainMaxHits: 1, ...noBeat });
    check("Overload: without it only the mage that was hit merges", eventsOf(none, "orbMerge").length === 1);
    const echoed = solo(held([withOrbs(charged(unit("mages", "tank")), run.fight.mageOrbMax), withOrbs(unit("mages", "damage"), run.fight.overloadMinOrbs)], ["overload", "echo"]), 7, { chainMaxHits: 1, ...noBeat });
    check("Overload: the merged mage's other runes see its merge like any other (Echo leaves it one orb)", eventsOf(echoed, "orbMerge").length === 2 && triggers(echoed, "echo").length === 2);
  }
  {
    // Wellspring.
    // No Frost Mage here: its own orbs shield it, which would mix into what is counted.
    const life = unit("mages", "support");
    const r = solo(held([life, unit("mages", "damage")], ["wellspring"]), 7);
    const at = r.snapshots.find((sn) => sn.t >= run.fight.mageOrbFirstBeatSec + 0.1)!;
    const each = (life.damage * run.fight.wellspringFraction) / 2;
    check("Wellspring: HP a Life orb took that nobody could take in becomes shield, shared by the squad", at.playerHeroes.filter((h) => !h.skeleton).every((h) => Math.abs(h.marks.shield - each) < 0.01) && triggers(r, "wellspring").length >= 1, at.playerHeroes.map((h) => h.marks.shield).join("/"));
    const off = solo(held([unit("mages", "support"), unit("mages", "damage")], []), 7);
    const offAt = off.snapshots.find((sn) => sn.t >= run.fight.mageOrbFirstBeatSec + 0.1)!;
    check("Wellspring: without it an orb beat leaves no shield", offAt.playerHeroes.every((h) => h.marks.shield === 0));
  }
}

// --- Mage runes are offered only in a Mages run.
{
  const MAGE_CARDS: CardId[] = ["vessel", "fuse", "kernel", "echo", "static", "leech", "tempo", "overload", "wellspring"];
  const draws = (army: ArmyKind | undefined, cards: CardId[] = []): CardId[][] => {
    const all: CardId[][] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const progress = { ...makeInitialProgress(run, undefined, army), cards };
      const roster = makeArmyRoster(army ?? "mages", progress.bonus);
      all.push(drawOffers(new Rng(seed), progress, roster, run, 3).flatMap((o) => (o.kind === "card" && o.card ? [o.card] : [])));
    }
    return all;
  };
  const seen = (army: ArmyKind | undefined, cards: CardId[] = []): Set<CardId> => new Set(draws(army, cards).flat().filter((id) => MAGE_CARDS.includes(id)));
  const mages = seen("mages");
  check("offers: a Mages run is offered Mage runes, and never a duo before its parts are held", mages.size >= 5 && !mages.has("overload") && !mages.has("wellspring"), [...mages].join(","));
  check("offers: a Beasts, an Undead and a plain run are never offered a Mage rune", (["beasts", "undead", undefined] as (ArmyKind | undefined)[]).every((a) => seen(a).size === 0));
  check("offers: every win in a Mages run puts at least one Mage rune among the offers", draws("mages").every((cards) => cards.some((id) => MAGE_CARDS.includes(id))));
  // The fork (2026-10-28): each rune has a build, the first build rune held shuts out the other builds, and while none is held the three
  // offers are one rune from each build.
  const buildOf = (id: CardId): ArmyBuild | undefined => CARD_DEFS[id].build;
  const buildsIn = (cards: CardId[]): ArmyBuild[] => cards.flatMap((id) => buildOf(id) ?? []);
  check("fork: every Mage rune has a build, and Vessel, Static / Fuse, Echo, Leech, Overload, Wellspring / Kernel, Tempo are big / many / core", MAGE_CARDS.every((id) => buildOf(id) !== undefined) && (["vessel", "static"] as CardId[]).every((id) => buildOf(id) === "big") && (["fuse", "echo", "leech", "overload", "wellspring"] as CardId[]).every((id) => buildOf(id) === "many") && (["kernel", "tempo"] as CardId[]).every((id) => buildOf(id) === "core"));
  check("fork: with no build rune held, every win offers one rune from each build", draws("mages").every((cards) => {
    const bs = buildsIn(cards);
    return bs.length === 3 && new Set(bs).size === 3;
  }));
  const heldBuilds: [CardId, ArmyBuild][] = [["vessel", "big"], ["echo", "many"], ["kernel", "core"]];
  check("fork: holding a rune of one build, the runes of the other builds are never offered", heldBuilds.every(([id, build]) => [...seen("mages", [id])].every((c) => buildOf(c) === build)), heldBuilds.map(([id]) => [...seen("mages", [id])].join("/")).join(" | "));
  check("fork: holding a rune of one build, the offers still show that build's runes", heldBuilds.every(([id, build]) => [...seen("mages", [id])].some((c) => buildOf(c) === build)));
  check("fork: a plain rune does not fix a build, so the fork stays", draws("mages", ["bulwark"]).every((cards) => new Set(buildsIn(cards)).size === 3));
  check("offers: Static, Leech and Tempo each wait for the Mage skill whose orb they work on; the rest wait for none", cardConnects("static", ["stormOrb"]) && !cardConnects("static", ["frostOrb"]) && cardConnects("leech", ["lifeOrb"]) && !cardConnects("leech", ["stormOrb"]) && cardConnects("tempo", ["frostOrb"]) && !cardConnects("tempo", ["lifeOrb"]) && (["vessel", "fuse", "kernel", "echo"] as CardId[]).every((id) => cardConnects(id, [])));
  check("duos: Overload needs Echo and Fuse held; Wellspring needs Leech and Brim held", !duoUnlocked("overload", ["frostOrb"], ["echo"]) && !duoUnlocked("overload", ["frostOrb"], ["echo", "vessel"]) && duoUnlocked("overload", ["frostOrb"], ["echo", "fuse"]) && !duoUnlocked("wellspring", ["lifeOrb"], ["leech"]) && duoUnlocked("wellspring", ["lifeOrb"], ["leech", "overflow"]));
}

// --- An army run is never offered the plain squad's role abilities (2026-10-23): Scorch, Frostbolt, Siphon and the rest of ROLE_UPGRADE_POOL.
// An army unit's skill is what it does; it can still borrow another army unit's skill.
{
  const plainAbilities = new Set(Object.values(ROLE_UPGRADE_POOL).flat());
  const gains = (army: ArmyKind | undefined): { plain: number; borrowed: number } => {
    const n = { plain: 0, borrowed: 0 };
    for (let seed = 1; seed <= 300; seed++) {
      const progress = makeInitialProgress(run, undefined, army);
      const roster = makeArmyRoster(army ?? "mages", progress.bonus);
      for (const o of drawOffers(new Rng(seed), progress, roster, run, 3)) {
        if (o.kind !== "chainGain" || !o.effect) continue;
        if (plainAbilities.has(o.effect)) n.plain++;
        else n.borrowed++;
      }
    }
    return n;
  };
  check("offers: a plain run is offered role abilities (so the check below can fail)", gains(undefined).plain > 0);
  check("offers: a Mages, an Undead and a Beasts run are never offered a plain role ability", ARMY_ORDER.every((a) => gains(a).plain === 0), ARMY_ORDER.map((a) => `${a}:${gains(a).plain}`).join(" "));
}

// --- The Beasts' pounce (2026-10-22; canvas 12.0C): no beast has a skill bar of its own; everything the pack collects fills one PACK bar,
// and a full bar sets off a pounce, a skill rolled on the Bear's beat whose every rung runs every beast's part (Pin, Maul, Tend) in turn.
{
  const packFull = (h: HeroState): HeroState => {
    h.charge = run.fight.chargeThreshold * run.fight.beastPackBarMult;
    return h;
  };
  const pack = () => ({ bear: unit("beasts", "tank"), wolf1: unit("beasts", "damage", 1), wolf2: unit("beasts", "damage", 2), stag: unit("beasts", "support") });
  const ids = (p: ReturnType<typeof pack>) => [p.bear, p.wolf1, p.wolf2, p.stag].map((h) => h.id);
  /** The chain hits of the first pounce's first rung (a fight can hold more than one pounce; they come at later times). */
  const firstRung = (r: FightResult) => {
    const hits = r.events.filter((e): e is Extract<FightEvent, { type: "chainHit" }> => e.type === "chainHit");
    return hits.filter((e) => e.t === hits[0]?.t);
  };

  // The bar.
  {
    const p = pack();
    const r = fight(setup([p.bear, p.wolf1, p.wolf2, p.stag], calm), 7, { chargeThreshold: 1e9 });
    const last = r.snapshots[r.snapshots.length - 1]!;
    check("pack: no beast has a skill bar of its own, so every Beast's charge stays 0", r.snapshots.every((s) => s.playerHeroes.every((h) => h.charge === 0)));
    check("pack: the shared PACK bar fills instead, and a snapshot says how big it is", (last.packCharge ?? 0) > 0 && last.packMax === 1e9 * run.fight.beastPackBarMult, `${last.packCharge} of ${last.packMax}`);
    const plain = [unit("beasts", "tank"), unit("beasts", "damage", 1)];
    for (const h of plain) delete h.army;
    check("pack: a squad with no army has no PACK bar", fight(setup(plain, calm)).snapshots.every((s) => s.packCharge === undefined));
  }

  // The pounce, one rung.
  {
    const p = pack();
    p.bear.hp = p.bear.maxHp - 40;
    const r = fight(setup([packFull(p.bear), p.wolf1, p.wolf2, p.stag], calm), 7, { chainMaxHits: 1 });
    const start = r.events.find((e) => e.type === "pounceStart");
    const chainStart = r.events.find((e) => e.type === "chainStart");
    check("pounce: a full bar sets it off at once, and the Bear leads", start?.type === "pounceStart" && start.leadId === p.bear.id && chainStart?.type === "chainStart" && chainStart.heroId === p.bear.id && chainStart.t < 0.2, JSON.stringify(start));
    check("pounce: the beasts jump in the order Bear, Wolves, Stag", start?.type === "pounceStart" && start.beastIds.join() === ids(p).join());
    const front = r.snapshots[0]!.enemyHeroes[0]!.id;
    const rung = firstRung(r);
    const pin = rung.find((e) => e.kind === "stun");
    check("pin: the Bear freezes the front enemy for the pin's seconds", pin?.sourceId === p.bear.id && pin.targetId === front && Math.abs((pin.durationSec ?? 0) - run.fight.beastPinSec) < 1e-6, JSON.stringify(pin));
    const mauls = rung.filter((e) => e.kind === "damage");
    check("maul: each Wolf bites the front enemy for its own maul", mauls.length === 2 && mauls.every((e) => e.targetId === front && e.intended === run.fight.beastMaulDamage) && mauls.map((e) => e.sourceId).join() === [p.wolf1.id, p.wolf2.id].join(), JSON.stringify(mauls));
    const tend = rung.find((e) => e.kind === "heal" && e.targetId === p.bear.id);
    check("tend: the Stag heals every unit, the hurt Bear included", tend?.sourceId === p.stag.id && tend.damage === run.fight.beastTendHeal, JSON.stringify(tend));
    const hit = r.events.find((e) => e.type === "pounceHit");
    check("pounce: one pounceHit names the pack and where it landed", hit?.type === "pounceHit" && hit.hitIndex === 1 && hit.targetId === front && hit.beastIds.length === 4 && !hit.backfire, JSON.stringify(hit));
    // The bar is held full while the pounce runs, and empty when it ends.
    const end = r.events.find((e) => e.type === "chainEnd");
    const during = r.snapshots.find((s) => s.t > (start?.t ?? 0) && s.t < (end?.t ?? 0) && s.hotHeroId === p.bear.id);
    const after = r.snapshots.find((s) => s.t >= (end?.t ?? 0) + 0.05);
    check("pounce: the PACK bar stays full while it runs and empties when it ends", during?.packCharge === during?.packMax && (after?.packCharge ?? 1e9) < run.fight.chargeThreshold, `${during?.packCharge} then ${after?.packCharge}`);
  }

  // A skill a role gained is every beast of that role's, on every pounce.
  {
    const p = pack();
    for (const w of [p.wolf1, p.wolf2]) w.chainEffects = ["maul", "expose"];
    const r = fight(setup([packFull(p.bear), p.wolf1, p.wolf2, p.stag], calm), 7, { chainMaxHits: 1 });
    const exposed = firstRung(r).filter((e) => e.mark === "exposed");
    check("gained skill: each Wolf's Expose goes off in the pounce, beside its Maul", exposed.length === 2 && exposed.map((e) => e.sourceId).join() ===[p.wolf1.id, p.wolf2.id].join(), `${exposed.length} exposes`);
  }

  // A backfired pounce lands on your own side, and counts against every beast that jumped.
  {
    const p = pack();
    const own = new Set(ids(p));
    const r = fight(setup([packFull(p.bear), p.wolf1, p.wolf2, p.stag], calm), 7, { chainMaxHits: 1, forceBackfire: "always" });
    const rung = firstRung(r);
    const pin = rung.find((e) => e.kind === "stun");
    const mauls = rung.filter((e) => e.kind === "damage");
    const tend = rung.find((e) => e.kind === "heal");
    check("backfire: the pin lands on one of our own units, never the Bear", pin !== undefined && pin.targetId !== null && own.has(pin.targetId) && pin.targetId !== p.bear.id, JSON.stringify(pin));
    check("backfire: the Wolves bite our own front unit", mauls.length === 2 && mauls.every((e) => e.targetId !== null && own.has(e.targetId)), JSON.stringify(mauls));
    check("backfire: the Stag heals the enemy", tend?.targetId !== null && tend !== undefined && !own.has(tend.targetId!), JSON.stringify(tend));
    check("backfire: the whole rung is marked as a backfire", rung.length > 0 && rung.every((e) => e.backfire));
    const last = r.snapshots[r.snapshots.length - 1]!;
    check("backfire: it counts against every beast that jumped", last.playerHeroes.every((h) => h.backfires >= 1), last.playerHeroes.map((h) => h.backfires).join());
  }

  // A whole fight: pounces come round, each one ends, and no beast's own bar ever holds a charge.
  {
    const p = pack();
    const r = fight(setup([p.bear, p.wolf1, p.wolf2, p.stag]), 7, { chainChanceByHitsSoFar: [1, 0.5, 0], forceBackfire: "never" });
    const starts = r.events.filter((e) => e.type === "pounceStart").length;
    const ends = r.events.filter((e) => e.type === "chainEnd").length;
    check("a whole fight: pounces fire and each one ends", starts >= 1 && ends === starts, `${starts} pounces, ${ends} ends`);
    // The Bear leads while it stands; a pounce after it falls is led by the next beast in the jumping order.
    const bearDownAt = r.events.find((e) => e.type === "heroDown" && e.side === "player" && e.heroId === p.bear.id)?.t ?? Infinity;
    check("a whole fight: the Bear leads every pounce while it stands", r.events.filter((e) => e.type === "pounceStart" && e.t < bearDownAt).every((e) => e.type === "pounceStart" && e.leadId === p.bear.id));
  }
}

// --- Offers and runes keep working with army skills.
{
  check("a Frozen rune reads the Bear's Pin as a Freeze; no other Beast or Undead skill, and no guard rune, reads it", cardConnects("shatter", ["pin"]) && !cardConnects("shatter", ["maul"]) && !cardConnects("bulwark", ["pin"]) && !cardConnects("bulwark", ["boneWall"]) && !cardConnects("bulwark", ["raise"]));
  check("phoenix still reads a mend-like skill (Tend counts as mend; Maul and Raise do not)", duoUnlocked("phoenix", ["tend"], ["secondWind"]) && !duoUnlocked("phoenix", ["maul"], ["secondWind"]) && !duoUnlocked("phoenix", ["raise"], ["secondWind"]));
  const progress = makeInitialProgress(run, undefined, "beasts");
  const roster = makeArmyRoster("beasts", progress.bonus);
  const offers = drawOffers(new Rng(5), progress, roster, run, 3);
  check("offers: titles use the army's names", offers.length > 0 && offers.every((o) => !/\b(tank|healer)\b/i.test(o.title) || o.kind === "card"), offers.map((o) => o.title).join(" | "));
}

// --- A whole run plays for each army, and replays the same.
{
  for (const army of ARMY_ORDER) {
    const play = (seed: number) => {
      const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
      return runRun(run, new Rng(seed), offerRng, makeOfferPolicy("build", offerRng), seed, { army });
    };
    const a = play(11), b = play(11);
    check(`${army}: a seed replays the same run`, JSON.stringify(a.rounds) === JSON.stringify(b.rounds) && a.roundsWon === b.roundsWon, `${a.roundsWon} rounds`);
    check(`${army}: the run records its army and plays at least a few rounds`, a.finalProgress.army === army && a.rounds.length >= 1);
  }
}

if (failed) {
  console.error("\narmies check FAILED");
  process.exit(1);
} else console.log("\narmies check passed");
