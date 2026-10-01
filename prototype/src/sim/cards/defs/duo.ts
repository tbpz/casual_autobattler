import type { CardDef } from "../types.js";

/**
 * Duo cards: each is offered only once both of its parts are held (cards/types.ts's
 * CardNeeds), and does something neither part does alone. The parts they name
 * are the ones a player will have met first, so the duo reads as a payoff for
 * a combination they already hold rather than a card to evaluate cold.
 */

export const FORTRESS: CardDef = {
  id: "fortress",
  title: "Fortress",
  detail: "When Guard blocks a slam, the squad shields again and the slammer is hurt.",
  icon: "♜",
  kind: "duo",
  reads: ["shield"],
  makes: [],
  needs: { cards: ["bulwark"], effects: ["ward"] },
  hooks: [
    {
      on: "guardBlock",
      do: (e, api) => {
        for (const ally of e.side.heroes) if (ally.alive && ally.hp > 0) api.addShield(ally, api.cfg.bulwarkShield);
        const hurt = Math.max(1, Math.round(e.guardian.maxHp * api.cfg.fortressReflectFraction));
        api.damage(api.enemy, e.slammer.id, hurt);
        api.fire("fortress", "player", e.guardian.id, hurt);
      },
    },
  ],
};

export const THERMAL_SHOCK: CardDef = {
  id: "thermalShock",
  title: "Thermal shock",
  detail: "When you hit a frozen, burning enemy, all its burn goes off at once.",
  icon: "⚛",
  kind: "duo",
  reads: ["frozen", "burn"],
  makes: [],
  needs: { cards: ["shatter"], marks: ["burn"] },
  hooks: [
    {
      on: "afterHit",
      when: (e, api) => e.onEnemySide && e.target.hp > 0 && api.isFrozen(e.target) && (e.target.marks?.burn ?? 0) > 0,
      do: (e, api) => {
        const burn = e.target.marks!.burn;
        e.target.marks!.burn = 0;
        const blast = burn * api.cfg.burnDamagePerStack * api.cfg.thermalShockMult;
        api.damage(api.enemy, e.target.id, blast);
        api.fire("thermalShock", "enemy", e.target.id, Math.round(blast));
      },
    },
  ],
};

export const KILLING_FROST: CardDef = {
  id: "killingFrost",
  title: "Killing frost",
  detail: "When an exposed enemy is frozen, Execute's line rises to half its HP.",
  icon: "☃",
  kind: "duo",
  reads: ["frozen", "exposed"],
  makes: [],
  needs: { cards: ["execute", "deepFreeze"] },
  hooks: [
    {
      on: "afterHit",
      when: (e, api) => e.onEnemySide && e.target.hp > 0 && api.isFrozen(e.target) && (e.target.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        if (e.target.hp / e.target.maxHp > api.cfg.killingFrostHpFraction) return;
        e.taken += e.target.hp;
        e.target.hp = 0;
        api.fire("killingFrost", "enemy", e.target.id, 0);
      },
    },
  ],
};

export const CINDER_SHIELD: CardDef = {
  id: "cinderShield",
  title: "Cinder shield",
  detail: "When a shield absorbs a hit, the attacker catches burn too.",
  icon: "⛉",
  kind: "duo",
  reads: ["shield"],
  makes: ["burn"],
  needs: { cards: ["spikedShield"], marks: ["burn"] },
  hooks: [
    {
      on: "shieldAbsorbed",
      when: (e) => e.source !== undefined && e.source.alive && !e.side.heroes.includes(e.source),
      do: (e, api) => {
        api.addBurn(e.source!, api.cfg.cinderShieldBurn);
        api.fire("cinderShield", "enemy", e.source!.id, api.cfg.cinderShieldBurn);
      },
    },
  ],
};

export const GLASS: CardDef = {
  id: "glass",
  title: "Glass",
  detail: "When a freeze ends, the enemy's exposure doubles.",
  icon: "◇",
  kind: "duo",
  reads: ["frozen", "exposed"],
  makes: ["exposed"],
  needs: { cards: ["weakSpot", "brittle"] },
  hooks: [
    {
      on: "thawed",
      when: (e) => e.onEnemySide && (e.target.marks?.exposed ?? 0) > 0,
      do: (e, api) => {
        const stacks = e.target.marks!.exposed;
        api.addExposed(e.target, stacks);
        api.fire("glass", "enemy", e.target.id, stacks);
      },
    },
  ],
};

export const PHOENIX: CardDef = {
  id: "phoenix",
  title: "Phoenix",
  detail: "When the first unit falls each fight, it gets back up with a shield.",
  icon: "✧",
  kind: "duo",
  reads: [],
  makes: ["shield"],
  needs: { cards: ["secondWind"], effects: ["mend"] },
  hooks: [
    {
      on: "death",
      when: (e) => !e.onEnemySide,
      do: (e, api) => {
        if (!api.once("phoenix")) return;
        e.hero.alive = true;
        e.hero.hp = Math.max(1, Math.round(e.hero.maxHp * api.cfg.phoenixHpFraction));
        api.addShield(e.hero, api.cfg.phoenixShield);
        api.fire("phoenix", "player", e.hero.id, e.hero.hp);
      },
    },
  ],
};
