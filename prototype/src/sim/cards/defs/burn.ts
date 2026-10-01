import { nextEnemy, weakestAlly } from "../helpers.js";
import type { CardDef } from "../types.js";

/** Cards that read, or lay, the ♨ Burn mark. */

export const SPREAD: CardDef = {
  id: "spread",
  title: "Spread",
  detail: "When a burning enemy dies, its burn jumps to the next enemy.",
  icon: "♨",
  kind: "mark",
  reads: ["burn"],
  makes: [],
  hooks: [
    {
      on: "death",
      when: (e) => e.onEnemySide && (e.hero.marks?.burn ?? 0) > 0,
      do: (e, api) => {
        const next = nextEnemy(api, e.hero);
        if (!next) return;
        const burn = e.hero.marks!.burn;
        api.addBurn(next, burn);
        next.burnFrom = e.hero.burnFrom;
        api.fire("spread", "enemy", next.id, burn);
      },
    },
  ],
};

export const OPEN_WOUND: CardDef = {
  id: "openWound",
  title: "Open wound",
  detail: "When an exposed enemy burns, the burn ticks count triple.",
  icon: "✂",
  kind: "mark",
  reads: ["burn", "exposed"],
  makes: [],
  hooks: [
    {
      on: "beforeBurnTick",
      when: (e) => e.side === "enemy" && (e.hero.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        e.damage *= api.cfg.openWoundMult;
        api.fire("openWound", "enemy", e.hero.id, Math.round(e.damage));
      },
    },
  ],
};

export const KINDLING: CardDef = {
  id: "kindling",
  title: "Kindling",
  detail: "When your Damage unit attacks, the target catches burn.",
  icon: "♢",
  kind: "mark",
  reads: [],
  makes: ["burn"],
  hooks: [
    {
      on: "afterBasicAttack",
      when: (e) => e.isPlayerAttacker && e.hero.role === "damage" && e.target !== undefined && !e.killed,
      do: (e, api) => {
        const target = e.target!;
        api.addBurn(target, api.cfg.kindlingBurn);
        target.burnFrom = e.hero.id;
        api.fire("kindling", "enemy", target.id, api.cfg.kindlingBurn);
      },
    },
  ],
};

export const INFERNO: CardDef = {
  id: "inferno",
  title: "Inferno",
  detail: "When burn ticks, every earlier tick this fight makes it hit harder.",
  icon: "☄",
  kind: "mark",
  reads: ["burn"],
  makes: [],
  hooks: [
    {
      on: "beforeBurnTick",
      when: (e) => e.side === "enemy",
      do: (e, api) => {
        const earlier = api.counter("inferno");
        api.bump("inferno");
        const extra = Math.min(earlier, api.cfg.infernoCap) * api.cfg.infernoPerTick;
        if (extra <= 0) return;
        e.damage += extra;
        api.fire("inferno", "enemy", e.hero.id, extra);
      },
    },
  ],
};

export const SMOKE: CardDef = {
  id: "smoke",
  title: "Smoke",
  detail: "When an enemy's burn ticks, your weakest unit gains shield.",
  icon: "☁",
  kind: "mark",
  reads: ["burn"],
  makes: ["shield"],
  hooks: [
    {
      on: "burnTick",
      when: (e) => e.side === "enemy" && e.applied > 0,
      do: (e, api) => {
        const weakest = weakestAlly(api);
        if (!weakest) return;
        const added = api.addShield(weakest, Math.max(1, Math.round(e.applied * api.cfg.smokeShieldFraction)));
        if (added > 0) api.fire("smoke", "player", weakest.id, added);
      },
    },
  ],
};

export const WILDFIRE: CardDef = {
  id: "wildfire",
  title: "Wildfire",
  detail: "When an enemy burns, the burn fades half as fast.",
  icon: "✹",
  kind: "mark",
  reads: ["burn"],
  makes: [],
  hooks: [
    {
      on: "beforeBurnDecay",
      when: (e) => e.side === "enemy" && e.decay > 0,
      do: (e, api) => {
        e.decay *= api.cfg.wildfireDecayFraction;
        api.fire("wildfire", "enemy", e.hero.id, 0);
      },
    },
  ],
};
