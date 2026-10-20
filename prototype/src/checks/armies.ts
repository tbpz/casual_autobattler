/**
 * The armies (2026-10-20; sim/armies.ts, canvas 10.x and 11.x). Each assertion runs a small hand-built fight (or a roster step)
 * and pins one rule: the two starting squads, merge heroes off, Undying (once per fight, harder after), Grave Guard, Soul Bolt,
 * Blood Rite, Roar, Pack Bite, Herd, Pack's charge, and that a whole run plays and replays the same for both armies.
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
  check("a run's first skills are the army's", progress("beasts").chain.tank.effects[0] === "roar" && progress("undead").chain.support.effects[0] === "bloodRite");
}

// --- Undying: the first fall in a fight is undone at half HP, once, and the unit hits harder after.
{
  const wraith = unit("undead", "damage");
  wraith.hp = 1;
  const r = fight(setup([wraith], (enemy) => enemy.heroes.forEach((h, i) => { h.nextAttackT = i === 0 ? 2 : 1000; h.nextWindupT = 1000; if (i === 0) h.damage = 1000; })), 7, { chargeThreshold: 1e9 });
  const rose = r.events.filter((e) => e.type === "heroRose" && e.heroId === wraith.id);
  check("undying: the unit gets back up when it would fall", rose.length === 1 && rose[0]!.type === "heroRose" && !rose[0]!.byGuard, `${rose.length} rises`);
  check("undying: it stands up at half its max HP", rose[0]?.type === "heroRose" && rose[0].hp === Math.round(wraith.maxHp * run.fight.undyingReviveFrac), String(rose[0]?.type === "heroRose" ? rose[0].hp : "-"));
  const roseT = rose[0]?.t ?? Infinity;
  const downs = r.events.filter((e) => e.type === "heroDown" && e.heroId === wraith.id);
  check("undying: only once; a second fall is a real fall", downs.length === 1 && (downs[0]?.t ?? 0) > roseT);
  const hits = (from: number, to: number) => r.events.filter((e) => e.type === "attack" && e.side === "player" && e.attackerId === wraith.id && e.t > from && e.t <= to);
  const before = hits(0, roseT)[0], after = hits(roseT, Infinity)[0];
  const base = ARMY_UNITS.undead.damage.damage;
  check(`undying: a unit that has risen hits 1.5x harder (${base} becomes ${base * run.fight.undyingDamageMult})`, before?.type === "attack" && after?.type === "attack" && before.damage === base && after.damage === base * run.fight.undyingDamageMult, `${before?.type === "attack" ? before.damage : "-"} -> ${after?.type === "attack" ? after.damage : "-"}`);
  const beastHp1 = unit("beasts", "damage");
  beastHp1.hp = 1;
  const rb = fight(setup([beastHp1], (enemy) => enemy.heroes.forEach((h, i) => { h.nextAttackT = i === 0 ? 2 : 1000; h.nextWindupT = 1000; })), 7, { chargeThreshold: 1e9 });
  check("undying belongs to the Undead: a Beast that would fall, falls", !rb.events.some((e) => e.type === "heroRose") && rb.events.some((e) => e.type === "heroDown" && e.heroId === beastHp1.id));
}

// --- Grave Guard: takes the slam; a slam that knocks it down stands it back up, and Undying is still ready.
{
  const knight = charged(unit("undead", "tank"));
  knight.hp = 5;
  const duelist = ENCOUNTERS.findIndex((e) => e.name === "Duelist");
  const r = fight(setup([knight], (enemy) => enemy.heroes.forEach((h, i) => { h.nextAttackT = 1000; h.nextWindupT = i === 0 ? 0.5 : 1000; }), duelist), 7);
  const slam = r.events.find((e) => e.type === "windupHit" && e.targetId === knight.id);
  const rose = r.events.find((e) => e.type === "heroRose" && e.heroId === knight.id);
  check("grave guard: the slam lands on the knight and a rise follows at once", slam?.type === "windupHit" && rose?.type === "heroRose" && rose.byGuard && rose.t === slam.t, JSON.stringify({ slam: slam?.type, rose: rose?.type }));
  check("grave guard: it stands up at half HP", rose?.type === "heroRose" && rose.hp === Math.round(knight.maxHp * run.fight.graveGuardReviveFrac));
}

// --- Soul Bolt: Expose with a base of 17, more once one of your units has risen; leaves Exposed.
{
  const r = fight(setup([charged(unit("undead", "damage")), unit("undead", "tank"), unit("undead", "support")], calm));
  const hit = firstChainHit(r);
  check("soul bolt: the first rung hits the biggest enemy for 17 and exposes it", hit?.type === "chainHit" && hit.intended === 17 && hit.mark === "exposed", JSON.stringify(hit));
  let bigger = 0;
  for (let seed = 1; seed <= 40 && bigger === 0; seed++) {
    const w = unit("undead", "damage");
    const priest = unit("undead", "support");
    priest.hp = 1;
    const res = fight(setup([w, priest]), seed, { forceBackfire: "never" });
    const roseT = res.events.find((e) => e.type === "heroRose")?.t;
    if (roseT === undefined) continue;
    if (res.events.some((e) => e.type === "chainHit" && e.sourceId === w.id && e.hitIndex === 1 && e.t > roseT && e.intended > 17.5)) bigger++;
  }
  check("soul bolt: after one of your units has risen, the bolt is bigger", bigger > 0);
}

// --- Blood Rite: the Bone Priest pays 20 HP, then heals every other unit 12.
{
  const priest = charged(unit("undead", "support"));
  const knight = unit("undead", "tank");
  knight.hp = knight.maxHp - 50;
  const r = fight(setup([priest, knight, unit("undead", "damage")], calm));
  const paid = r.events.find((e) => e.type === "chainHit" && e.kind === "damage" && e.targetId === priest.id);
  const healed = r.events.find((e) => e.type === "chainHit" && e.kind === "heal" && e.targetId === knight.id);
  check("blood rite: the first rung costs the priest 20 HP", paid?.type === "chainHit" && paid.damage === run.fight.bloodRiteCost, JSON.stringify(paid));
  check("blood rite: and heals another unit 12", healed?.type === "chainHit" && healed.damage === run.fight.bloodRiteHeal, JSON.stringify(healed));
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
  check("rampart still reads a guard-like skill (Grave Guard and Roar count as guard)", cardConnects("bulwark", ["graveGuard"]) && cardConnects("bulwark", ["roar"]) && !cardConnects("bulwark", ["soulBolt"]));
  check("phoenix still reads a mend-like skill (Blood Rite and Herd count as mend)", duoUnlocked("phoenix", ["herd"], ["secondWind"]) && duoUnlocked("phoenix", ["bloodRite"], ["secondWind"]));
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
