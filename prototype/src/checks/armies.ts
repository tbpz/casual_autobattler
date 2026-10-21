/**
 * The armies (2026-10-20; sim/armies.ts, canvas 10.x and 11.x). Each assertion runs a small hand-built fight (or a roster step)
 * and pins one rule: the two starting squads, merge heroes off, the Undead's horde (Raise and Bone Wall raise a skeleton per hit,
 * five at most, then upgrade; the enemy's normal hits go to shields, then warriors, then the Bone Knight; Command; both backfires),
 * Roar, Pack Bite, Herd, Pack's charge, and that a whole run plays and replays the same for both armies.
 *
 * Fights force a chain at tick 1 by starting the firing unit at full charge and pin the backfire coin and the damage variance,
 * so nothing here depends on a lucky roll.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { ROLE_SORT_PRIORITY, type PlayerRole } from "../sim/roles.js";
import { makeEnemySide, makeOfferPolicy, runRun } from "../sim/run.js";
import type { FightResult } from "../sim/events.js";
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

const firstChainHit = (r: FightResult) => r.events.find((e) => e.type === "chainHit");
const chargeAt = (r: FightResult, id: string, t: number): number => {
  const snap = r.snapshots.find((s) => s.t >= t) ?? r.snapshots[r.snapshots.length - 1]!;
  return snap.playerHeroes.find((h) => h.id === id)?.charge ?? -1;
};

// --- The two starting squads, and what an army keeps from the plain game.
{
  const progress = (army: ArmyKind) => makeInitialProgress(run, undefined, army);
  const u = makeArmyRoster("undead", progress("undead").bonus).heroes;
  const b = makeArmyRoster("beasts", progress("beasts").bonus).heroes;
  const count = (hs: HeroState[], role: PlayerRole) => hs.filter((h) => h.role === role).length;
  check("undead start with six units, two of each role", u.length === 6 && count(u, "tank") === 2 && count(u, "damage") === 2 && count(u, "support") === 2);
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
  check("a run's first skills are the army's", progress("beasts").chain.tank.effects[0] === "roar" && progress("undead").chain.support.effects[0] === "raise" && progress("undead").chain.tank.effects[0] === "boneWall" && progress("undead").chain.damage.effects[0] === "command");
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

// --- Roar: takes the slam like Guard, and the first time it goes every other Beast's bar fills 25%.
{
  const bear = charged(unit("beasts", "tank"));
  const wolf = unit("beasts", "damage", 1);
  const r = fight(setup([bear, wolf, unit("beasts", "support")], calm));
  const hit = firstChainHit(r);
  const control = fight(setup([charged(makeArmyUnit("beasts", "tank", 1, "u1_tank", zero)), makeArmyUnit("beasts", "damage", 1, "u1_damage", zero), makeArmyUnit("beasts", "support", 1, "u1_support", zero)].map((h, i) => (i === 0 ? { ...h, chainEffects: ["guard" as const] } : h)), calm));
  const t = hit?.type === "chainHit" ? hit.t : 0;
  const gain = chargeAt(r, wolf.id, t + 0.05) - chargeAt(control, wolf.id, t + 0.05);
  check("roar: it takes the next slam (a guard charge)", hit?.type === "chainHit" && hit.kind === "guard", JSON.stringify(hit));
  check("roar: the first rung fills another Beast's bar by 25% of a full bar", Math.abs(gain - run.fight.chargeThreshold * run.fight.roarChargeFrac) < 0.5, gain.toFixed(2));
}

// --- Pack Bite: one bite for itself and one for each other Wolf.
{
  const three = fight(setup([charged(unit("beasts", "damage", 1)), unit("beasts", "damage", 2), unit("beasts", "damage", 3)], calm));
  const one = fight(setup([charged(unit("beasts", "damage", 1)), unit("beasts", "tank"), unit("beasts", "support")], calm));
  const h3 = firstChainHit(three), h1 = firstChainHit(one);
  check("pack bite: three Wolves bite for 18", h3?.type === "chainHit" && h3.intended === 3 * run.fight.packBiteDamage, JSON.stringify(h3));
  check("pack bite: a lone Wolf bites for 6", h1?.type === "chainHit" && h1.intended === run.fight.packBiteDamage, JSON.stringify(h1));
}

// --- Herd: heals every unit 1 for each Beast in the squad.
{
  const stag = charged(unit("beasts", "support"));
  const squad = [stag, unit("beasts", "tank"), unit("beasts", "damage", 1), unit("beasts", "damage", 2), unit("beasts", "damage", 3)];
  squad[1]!.hp = squad[1]!.maxHp - 40;
  const r = fight(setup(squad, calm));
  const healed = r.events.find((e) => e.type === "chainHit" && e.kind === "heal" && e.targetId === squad[1]!.id);
  check("herd: with five Beasts each unit gets 5", healed?.type === "chainHit" && healed.damage === 5 * run.fight.herdHealPerBeast, JSON.stringify(healed));
}

// --- Pack: a hit a Beast lands fills the other Beasts' bars; the same squad without an army does not.
{
  const mk = (army: ArmyKind | undefined) => {
    const hs = [unit("beasts", "tank"), unit("beasts", "damage", 1), unit("beasts", "damage", 2)];
    if (!army) for (const h of hs) delete h.army;
    return hs;
  };
  const withPack = mk("beasts"), without = mk(undefined);
  const a = fight(setup(withPack, calm), 7, { chargeThreshold: 1e9 });
  const b = fight(setup(without, calm), 7, { chargeThreshold: 1e9 });
  const bearId = withPack[0]!.id;
  const extra = chargeAt(a, bearId, 6) - chargeAt(b, bearId, 6);
  check("pack: every hit another Beast lands adds charge to the Bear", extra >= 4 * run.fight.packChargePerHit, extra.toFixed(1));
}

// --- Offers and runes keep working with army skills.
{
  check("rampart still reads a guard-like skill (Roar counts as guard; no Undead skill does)", cardConnects("bulwark", ["roar"]) && !cardConnects("bulwark", ["boneWall"]) && !cardConnects("bulwark", ["raise"]));
  check("phoenix still reads a mend-like skill (Herd counts as mend; Raise does not)", duoUnlocked("phoenix", ["herd"], ["secondWind"]) && !duoUnlocked("phoenix", ["raise"], ["secondWind"]));
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
