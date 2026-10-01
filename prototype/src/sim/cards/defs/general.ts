import { mostWornAlly } from "../helpers.js";
import type { CardDef } from "../types.js";

/** General cards: they read the fight itself rather than one mark. */

export const MOMENTUM: CardDef = {
  id: "momentum",
  title: "Momentum",
  detail: "When a chain ends, the next chain's hits are bigger.",
  icon: "➶",
  kind: "general",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "chainEnd",
      when: (e) => !e.backfire,
      do: (_e, api) => {
        api.bump("momentum");
      },
    },
    {
      on: "chainMagnitude",
      when: (_e, api) => api.counter("momentum") > 0,
      do: (e, api) => {
        const chains = Math.min(api.counter("momentum"), api.cfg.momentumCap);
        e.mult *= 1 + chains * api.cfg.momentumPerChain;
        api.fire("momentum", "player", e.hero.id, chains);
      },
    },
  ],
};

export const SECOND_WIND: CardDef = {
  id: "secondWind",
  title: "Second wind",
  detail: "When a unit drops low, it gains chain charge, once a fight.",
  icon: "♺",
  kind: "general",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "afterHit",
      when: (e, api) => !e.onEnemySide && e.target.alive && e.target.hp / e.target.maxHp < api.cfg.secondWindHpFraction,
      do: (e, api) => {
        if (!api.once(`secondWind:${e.target.id}`)) return;
        const charge = api.cfg.chargeThreshold * api.cfg.secondWindChargeFraction;
        api.addCharge(e.target, charge);
        api.fire("secondWind", "player", e.target.id, Math.round(charge));
      },
    },
  ],
};

export const IRON_HIDE: CardDef = {
  id: "ironHide",
  title: "Iron hide",
  detail: "When your Tank's chain marks, it leaves more stacks the tougher it is.",
  icon: "▦",
  kind: "general",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "chainStacks",
      when: (e, api) => e.hero.role === "tank" && Math.floor(e.hero.maxHp / api.cfg.ironHideHpPerStack) > 0,
      do: (e, api) => {
        const extra = Math.floor(e.hero.maxHp / api.cfg.ironHideHpPerStack);
        e.stacks += extra;
        api.fire("ironHide", "player", e.hero.id, extra);
      },
    },
  ],
};

export const BLOODLUST: CardDef = {
  id: "bloodlust",
  title: "Bloodlust",
  detail: "When an enemy dies, your most worn unit gains chain charge.",
  icon: "☾",
  kind: "general",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "death",
      when: (e) => e.onEnemySide,
      do: (_e, api) => {
        const worn = mostWornAlly(api);
        if (!worn) return;
        const charge = api.cfg.chargeThreshold * api.cfg.bloodlustChargeFraction;
        api.addCharge(worn, charge);
        api.fire("bloodlust", "player", worn.id, Math.round(charge));
      },
    },
  ],
};
