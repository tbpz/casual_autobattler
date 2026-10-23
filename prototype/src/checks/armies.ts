/**
 * The armies (2026-10-20; sim/armies.ts, canvas 10.x and 11.x). Each assertion runs a small hand-built fight (or a roster step)
 * and pins one rule: the two starting squads, merge heroes off, the Undead's horde (Raise and Bone Wall raise a skeleton per hit,
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
import { ROLE_SORT_PRIORITY, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide, makeOfferPolicy, runRun } from "../sim/run.js";
import type { FightEvent, FightResult } from "../sim/events.js";
import type { ArmyKind, FightSetup, HeroState, SideState } from "../sim/types.js";
import { makeInitialProgress } from "../sim/progress.js";
import { mergeCandidates } from "../sim/heroes.js";
import { ARMY_ORDER, ARMY_UNITS, makeArmyRoster, makeArmyUnit, unitTitle } from "../sim/armies.js";
import { cardConnects, duoUnlocked } from "../sim/cards/index.js";
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
  const start = makeArmyRoster("undead", progress("undead").bonus);
  check("merge heroes are off while an army is picked", mergeCandidates(progress("undead"), start, run).length === 0 && mergeCandidates(makeInitialProgress(run), start, run).length > 0);
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
  check(`merge: the shot is ${shotSize(run.fight.mageStormMergeDamage)} on the front enemy and leaves no mark; the hits after it do no damage`, zaps.length === 1 && zaps.every((e) => e.type === "chainHit" && e.intended === shotSize(run.fight.mageStormMergeDamage) && e.mark === undefined && e.targetId === r.snapshots[0]!.enemyHeroes[0]!.id), zaps.map((e) => (e.type === "chainHit" ? e.intended : 0)).join(","));
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
  check("no Mage skill leaves a mark a rune could read, and none is a family of guard or mend", cardConnects("bulwark", ["frostOrb"]) === false && !duoUnlocked("phoenix", ["lifeOrb"], ["secondWind"]) && !cardConnects("bulwark", ["stormOrb"]));
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
  check("offers: titles use the army's names, and no merge line", offers.length > 0 && offers.every((o) => !/Completes/.test(o.worksWith ?? "")) && offers.every((o) => !/\b(tank|healer)\b/i.test(o.title) || o.kind === "card"), offers.map((o) => o.title).join(" | "));
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
    check(`${army}: the run records its army and plays at least a few rounds`, a.finalProgress.army === army && a.rounds.length >= 1 && a.rounds.every((r) => !r.mergeTaken));
  }
}

if (failed) {
  console.error("\narmies check FAILED");
  process.exit(1);
} else console.log("\narmies check passed");
