import { frontEnemy } from "../helpers.js";
import type { CardDef } from "../types.js";

/** Cards that read, or lay, the ❄ Frozen mark. */

export const SHATTER: CardDef = {
  id: "shatter",
  title: "Shatter",
  detail: "When you hit a frozen enemy, the hit does double.",
  icon: "✸",
  kind: "mark",
  reads: ["frozen"],
  makes: [],
  hooks: [
    {
      on: "beforeDamage",
      when: (e, api) => e.onEnemySide && api.isFrozen(e.target),
      do: (e, api) => {
        e.mult *= api.cfg.shatterMult;
        api.fire("shatter", "enemy", e.target.id, api.cfg.shatterMult);
      },
    },
  ],
};

export const DEEP_FREEZE: CardDef = {
  id: "deepFreeze",
  title: "Deep freeze",
  detail: "When you freeze an exposed enemy, the freeze lasts longer.",
  icon: "❄",
  kind: "mark",
  reads: ["frozen", "exposed"],
  makes: [],
  hooks: [
    {
      on: "beforeFreeze",
      // Only ever a payoff on the real (non-backfire) side.
      when: (e) => !e.backfire && (e.target.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        e.sec *= api.cfg.deepFreezeMult;
        api.fire("deepFreeze", "enemy", e.target.id, api.cfg.deepFreezeMult);
      },
    },
  ],
};

export const COLD_SNAP: CardDef = {
  id: "coldSnap",
  title: "Cold snap",
  detail: "When a chain backfires, the front enemy freezes.",
  icon: "❅",
  kind: "mark",
  reads: [],
  makes: ["frozen"],
  hooks: [
    {
      on: "chainStart",
      when: (e) => e.backfire,
      do: (_e, api) => {
        const front = frontEnemy(api);
        if (!front) return;
        const sec = api.freeze(front, api.cfg.coldSnapSec);
        api.fire("coldSnap", "enemy", front.id, sec);
      },
    },
  ],
};

export const BRITTLE: CardDef = {
  id: "brittle",
  title: "Brittle",
  detail: "When you freeze an enemy, it becomes exposed for every second.",
  icon: "❋",
  kind: "mark",
  reads: ["frozen"],
  makes: ["exposed"],
  hooks: [
    {
      // 2026-10-02: was "when a freeze ends" (the `thawed` hook). A chain's
      // Freeze stacks to ~10 s and the enemy usually dies first, so a thaw
      // trigger almost never fired for the squad that most wanted it. Now
      // paid out as each freeze rung lands, Frostbite's way, so a longer
      // freeze buys more exposure.
      on: "frozen",
      when: (e) => e.onEnemySide && !e.backfire,
      do: (e, api) => {
        const stacks = Math.max(1, Math.round(e.sec * api.cfg.brittleExposePerSec));
        api.addExposed(e.target, stacks);
        api.fire("brittle", "enemy", e.target.id, stacks);
      },
    },
  ],
};

export const FROSTBITE: CardDef = {
  id: "frostbite",
  title: "Frostbite",
  detail: "When you freeze an enemy, it catches burn for every second.",
  icon: "❆",
  kind: "mark",
  reads: ["frozen"],
  makes: ["burn"],
  hooks: [
    {
      on: "frozen",
      when: (e) => e.onEnemySide && !e.backfire,
      do: (e, api) => {
        const stacks = Math.max(1, Math.round(e.sec * api.cfg.frostbiteBurnPerSec));
        api.addBurn(e.target, stacks);
        api.fire("frostbite", "enemy", e.target.id, stacks);
      },
    },
  ],
};

export const PERMAFROST: CardDef = {
  id: "permafrost",
  title: "Permafrost",
  detail: "While any enemy is frozen, your chains are likelier to go on.",
  icon: "▥",
  kind: "mark",
  reads: ["frozen"],
  makes: [],
  hooks: [
    {
      on: "beforeChainRoll",
      when: (_e, api) => api.enemy.heroes.some((h) => h.alive && api.isFrozen(h)),
      do: (e, api) => {
        e.chance += api.cfg.permafrostChainBonus;
        const frozen = api.enemy.heroes.find((h) => h.alive && api.isFrozen(h));
        api.fire("permafrost", "enemy", frozen!.id, api.cfg.permafrostChainBonus);
      },
    },
  ],
};
