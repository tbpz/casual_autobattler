/**
 * The card engine (2026-10-01 — see sim/cards/engine.ts). Pins the rules the
 * cards are built on: listeners run in held order, a modify hook hands its
 * changed number back, a cascade stops at cascadeMaxDepth, a nested trigger
 * names the card that caused it, and a fight holding cards is still
 * deterministic.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { makeSquadFromRoles } from "../sim/roles.js";
import { makeEnemySide } from "../sim/run.js";
import { CARD_IDS } from "../sim/cards/index.js";
import { CardEngine } from "../sim/cards/engine.js";
import type { CardApi, CardDef, CardId, HookPayloads } from "../sim/cards/index.js";
import type { HeroState, SideState } from "../sim/types.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const api = {} as CardApi;
const dummyHero = {} as HeroState;
const dummySide = { heroes: [], dpsBonus: 0 } as SideState;

function def(id: CardId, hooks: CardDef["hooks"]): CardDef {
  return { id, title: id, detail: id, icon: "?", kind: "mark", reads: [], makes: [], hooks };
}

const damagePayload = (): HookPayloads["beforeDamage"] => ({ target: dummyHero, onEnemySide: true, mult: 1 });

// --- Listeners run in held order, and a modify hook hands its change back.
{
  const log: string[] = [];
  const double = def("shatter", [{ on: "beforeDamage", do: (e) => { log.push("double"); e.mult *= 2; } }]);
  const plusOne = def("execute", [{ on: "beforeDamage", do: (e) => { log.push("plusOne"); e.mult += 1; } }]);

  const a = damagePayload();
  new CardEngine([double, plusOne], 6).run("beforeDamage", a, api);
  const b = damagePayload();
  new CardEngine([plusOne, double], 6).run("beforeDamage", b, api);
  check("held order: the first card listed runs first", log.join(",") === "double,plusOne,plusOne,double", log.join(","));
  check("modify hook: ((1×2)+1) vs ((1+1)×2) — order changes the result", a.mult === 3 && b.mult === 4, `${a.mult} vs ${b.mult}`);

  const guarded = def("punish", [{ on: "beforeDamage", when: () => false, do: (e) => { e.mult = 99; } }]);
  const c = damagePayload();
  new CardEngine([guarded], 6).run("beforeDamage", c, api);
  check("when: a false guard skips the listener", c.mult === 1);
}

// --- A cascade stops at cascadeMaxDepth; a nested trigger names its cause.
{
  for (const maxDepth of [1, 3, 6]) {
    let calls = 0;
    // Two cards that raise each other's hook forever.
    let engine!: CardEngine;
    const a = def("spikedShield", [
      { on: "shieldAbsorbed", do: () => { calls++; engine.run("death", { side: dummySide, hero: dummyHero, onEnemySide: true }, api); } },
    ]);
    const b = def("spread", [
      { on: "death", do: () => { calls++; engine.run("shieldAbsorbed", { side: dummySide, absorbed: 1 }, api); } },
    ]);
    engine = new CardEngine([a, b], maxDepth);
    engine.run("shieldAbsorbed", { side: dummySide, absorbed: 1 }, api);
    check(`cascade cap: two cards feeding each other stop after ${maxDepth} deep`, calls === maxDepth, `${calls} calls`);
  }

  const seen: { card: CardId; causeCard: CardId | undefined; depth: number }[] = [];
  let engine!: CardEngine;
  const outer = def("bulwark", [
    {
      on: "guardBlock",
      do: () => {
        seen.push({ card: "bulwark", ...engine.firing() });
        engine.run("death", { side: dummySide, hero: dummyHero, onEnemySide: true }, api);
      },
    },
  ]);
  const inner = def("spread", [{ on: "death", do: () => { seen.push({ card: "spread", ...engine.firing() }); } }]);
  engine = new CardEngine([outer, inner], 6);
  engine.run("guardBlock", { guardian: dummyHero, slammer: dummyHero, side: dummySide }, api);
  check("firing(): the outer card sits at depth 1 with no cause", seen[0]?.depth === 1 && seen[0].causeCard === undefined);
  check("firing(): the card it set off sits at depth 2 and names the outer card", seen[1]?.depth === 2 && seen[1].causeCard === "bulwark");
}

// --- A real fight holding every card: deterministic, and the events carry depth.
{
  const fightCfg = { ...DEFAULT_RUN_CONFIG.fight, chainChanceByHitsSoFar: [1] };
  const play = (cards: CardId[]) => {
    const player = makeSquadFromRoles(["tank", "damage", "support"]);
    player.heroes[0]!.charge = fightCfg.chargeThreshold;
    const enemy = makeEnemySide(DEFAULT_RUN_CONFIG, 0, 0);
    return runFight({ player, enemy, cards }, fightCfg, new Rng(11), 11);
  };
  const a = play([...CARD_IDS]);
  const b = play([...CARD_IDS]);
  check("deterministic: the same seed and cards give the same events", JSON.stringify(a.events) === JSON.stringify(b.events));
  const triggers = a.events.filter((e) => e.type === "cardTriggered");
  check("every cardTriggered carries a depth of at least 1", triggers.every((e) => e.type === "cardTriggered" && e.depth >= 1));
  check("no cards held: nothing triggers", play([]).events.every((e) => e.type !== "cardTriggered"));
}

if (failed) process.exit(1);
