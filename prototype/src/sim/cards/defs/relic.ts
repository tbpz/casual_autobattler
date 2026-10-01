import { frontEnemy, livingAllies, livingEnemies } from "../helpers.js";
import type { CardDef } from "../types.js";

/**
 * Relics: one is picked from three as the reward for the first win and held
 * for the rest of the run (sim/relics.ts). Each bends one rule of the whole run, so the same card pool
 * plays differently under a different relic. They are never offered mid-run, and
 * never take a card slot.
 */

export const EMBER_HEART: CardDef = {
  id: "emberHeart",
  title: "Ember heart",
  detail: "When a chain backfires, every enemy catches burn.",
  icon: "❤",
  kind: "relic",
  reads: [],
  makes: ["burn"],
  hooks: [
    {
      on: "chainStart",
      when: (e) => e.backfire,
      do: (_e, api) => {
        for (const enemy of livingEnemies(api)) {
          api.addBurn(enemy, api.cfg.emberHeartBurn);
          api.fire("emberHeart", "enemy", enemy.id, api.cfg.emberHeartBurn);
        }
      },
    },
  ],
};

export const FROST_CROWN: CardDef = {
  id: "frostCrown",
  title: "Frost crown",
  detail: "When a fight starts, the front enemy is frozen.",
  icon: "♛",
  kind: "relic",
  reads: [],
  makes: ["frozen"],
  hooks: [
    {
      on: "fightStart",
      do: (_e, api) => {
        const front = frontEnemy(api);
        if (!front) return;
        const sec = api.freeze(front, api.cfg.frostCrownSec);
        api.fire("frostCrown", "enemy", front.id, sec);
      },
    },
  ],
};

export const HUNTERS_EYE: CardDef = {
  id: "huntersEye",
  title: "Hunter's eye",
  detail: "When a fight starts, every enemy is already exposed.",
  icon: "◎",
  kind: "relic",
  reads: [],
  makes: ["exposed"],
  hooks: [
    {
      on: "fightStart",
      do: (_e, api) => {
        for (const enemy of livingEnemies(api)) {
          api.addExposed(enemy, api.cfg.huntersEyeStacks);
          api.fire("huntersEye", "enemy", enemy.id, api.cfg.huntersEyeStacks);
        }
      },
    },
  ],
};

export const BASTION: CardDef = {
  id: "bastion",
  title: "Bastion",
  detail: "When a fight starts, every unit has a shield.",
  icon: "⛨",
  kind: "relic",
  reads: [],
  makes: ["shield"],
  hooks: [
    {
      on: "fightStart",
      do: (_e, api) => {
        for (const ally of livingAllies(api)) {
          const added = api.addShield(ally, Math.round(ally.maxHp * api.cfg.bastionShieldFraction));
          if (added > 0) api.fire("bastion", "player", ally.id, Math.round(added));
        }
      },
    },
  ],
};

export const RESTLESS: CardDef = {
  id: "restless",
  title: "Restless",
  detail: "When a fight starts, every unit has charge but starts worn.",
  icon: "↯",
  kind: "relic",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "fightStart",
      // The fatigue is for this fight only (the roster's own fatigue is worked
      // out from its own values), so Restless is a trade of risk for speed, not
      // a slow drain: worn chains hit harder and run longer, and backfire more.
      do: (_e, api) => {
        for (const ally of livingAllies(api)) {
          api.addCharge(ally, api.cfg.chargeThreshold * api.cfg.restlessChargeFraction);
          ally.fatigue = Math.min(api.cfg.fatigueMax, ally.fatigue + api.cfg.restlessFatigue);
          api.fire("restless", "player", ally.id, api.cfg.restlessFatigue);
        }
      },
    },
  ],
};

export const MERCENARY: CardDef = {
  id: "mercenary",
  title: "Mercenary",
  detail: "A fourth unit of a random role joins your squad.",
  icon: "⚔",
  kind: "relic",
  reads: [],
  makes: [],
  // Does its work once, when the relic is picked (sim/relics.ts's
  // applyRelic) — nothing in a fight.
  hooks: [],
};
