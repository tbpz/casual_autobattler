import { frontEnemy, nextEnemy } from "../helpers.js";
import type { CardDef } from "../types.js";

/** Cards that read, or lay, the ✦ Exposed mark. */

export const EXECUTE: CardDef = {
  id: "execute",
  title: "Execute",
  detail: "When an exposed enemy is at low HP, it dies outright.",
  icon: "☠",
  kind: "mark",
  reads: ["exposed"],
  makes: [],
  hooks: [
    {
      on: "afterHit",
      when: (e) => e.onEnemySide && e.target.hp > 0 && (e.target.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        if (e.target.hp / e.target.maxHp > api.cfg.executeHpFraction) return;
        e.taken += e.target.hp;
        e.target.hp = 0;
        api.fire("execute", "enemy", e.target.id, 0);
      },
    },
  ],
};

export const PUNISH: CardDef = {
  id: "punish",
  title: "Punish",
  detail: "When your Tank hits an exposed enemy, it uses up the exposure for a big hit.",
  icon: "⚒",
  kind: "mark",
  reads: ["exposed"],
  makes: [],
  hooks: [
    {
      on: "beforeBasicAttack",
      // Consumed BEFORE the hit lands so the same stacks don't also amplify it
      // through the damage pipeline's Exposed multiplier.
      when: (e) => e.isPlayerAttacker && e.hero.role === "tank" && (e.victim?.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        const victim = e.victim!;
        const stacks = victim.marks!.exposed;
        const bonus = Math.max(1, Math.round(e.hero.damage * api.cfg.punishDamagePerStack * stacks));
        e.damage += bonus;
        victim.marks!.exposed = 0;
        api.fire("punish", "enemy", victim.id, bonus);
      },
    },
  ],
};

export const WEAK_SPOT: CardDef = {
  id: "weakSpot",
  title: "Weak spot",
  detail: "When your Damage unit hits an exposed enemy, it adds damage for every stack.",
  icon: "◉",
  kind: "mark",
  reads: ["exposed"],
  makes: [],
  hooks: [
    {
      on: "beforeBasicAttack",
      // Unlike Punish it keeps the stacks, and it scales with the Damage
      // unit's own damage, so +damage on that role makes it bigger.
      when: (e) => e.isPlayerAttacker && e.hero.role === "damage" && (e.victim?.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        const victim = e.victim!;
        const bonus = Math.max(1, Math.round(e.hero.damage * api.cfg.weakSpotPerStack * victim.marks!.exposed));
        e.damage += bonus;
        api.fire("weakSpot", "enemy", victim.id, bonus);
      },
    },
  ],
};

export const CRACK: CardDef = {
  id: "crack",
  title: "Crack",
  detail: "When an enemy reaches 5 exposed, it freezes and loses 2 stacks.",
  icon: "⚡",
  kind: "mark",
  reads: ["exposed"],
  makes: ["frozen"],
  hooks: [
    {
      on: "markApplied",
      when: (e, api) =>
        e.onEnemySide &&
        e.mark === "exposed" &&
        e.target.alive &&
        e.target.hp > 0 &&
        (e.target.marks?.exposed ?? 0) >= api.cfg.crackThreshold,
      do: (e, api) => {
        e.target.marks!.exposed -= api.cfg.crackSpendStacks;
        const sec = api.freeze(e.target, api.cfg.crackFreezeSec);
        api.fire("crack", "enemy", e.target.id, sec);
      },
    },
  ],
};

export const LAY_BARE: CardDef = {
  id: "layBare",
  title: "Lay bare",
  detail: "When an exposed enemy dies, its exposure moves to the next enemy.",
  icon: "↬",
  kind: "mark",
  reads: ["exposed"],
  makes: [],
  hooks: [
    {
      on: "death",
      when: (e) => e.onEnemySide && (e.hero.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        const next = nextEnemy(api, e.hero);
        if (!next) return;
        const stacks = e.hero.marks!.exposed;
        api.addExposed(next, stacks);
        api.fire("layBare", "enemy", next.id, stacks);
      },
    },
  ],
};

export const HUNTER_MARK: CardDef = {
  id: "hunterMark",
  title: "Hunter's mark",
  detail: "When a chain starts, the front enemy becomes exposed.",
  icon: "⌖",
  kind: "mark",
  reads: [],
  makes: ["exposed"],
  hooks: [
    {
      on: "chainStart",
      when: (e) => !e.backfire,
      do: (_e, api) => {
        const front = frontEnemy(api);
        if (!front) return;
        api.addExposed(front, api.cfg.hunterMarkStacks);
        api.fire("hunterMark", "enemy", front.id, api.cfg.hunterMarkStacks);
      },
    },
  ],
};
