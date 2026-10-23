import type { CardDef } from "../types.js";

/**
 * The Mage army's own runes (2026-10-23, DECISIONS.md "Mage runs get marks from merged shots only, four Mage runes and two duos").
 * Each is offered only in a Mages run (`army: "mages"`) and reads the orb hooks fight.ts raises (beforeOrbBeat, orbBeat, orbGap,
 * orbsMerged). Three of them read a mark another mage's merged shot leaves (Burn from Storm, Frozen from Frost), so the combos come from
 * mixing mages. Every number is a first take in config.ts for the batch to tune.
 */

export const ECHO: CardDef = {
  id: "echo",
  title: "Echo",
  detail: "When a Mage's orbs merge, one loose orb stays behind.",
  icon: "❍",
  kind: "general",
  army: "mages",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbsMerged",
      do: (e, api) => {
        if (api.addOrb(e.mage)) api.fire("echo", "player", e.mage.id, 1);
      },
    },
  ],
};

export const STATIC: CardDef = {
  id: "static",
  title: "Static",
  detail: "When a Storm orb zaps a burning enemy, the zap jumps to a second enemy.",
  icon: "ϟ",
  kind: "mark",
  army: "mages",
  reads: ["burn"],
  makes: [],
  hooks: [
    {
      on: "orbBeat",
      when: (e) => e.orbKind === "storm" && e.target !== undefined && (e.target.marks?.burn ?? 0) > 0 && e.applied > 0,
      do: (e, api) => {
        const others = api.enemy.heroes.filter((h) => h.alive && h.hp > 0 && h !== e.target);
        if (others.length === 0) return;
        const next = others[Math.floor(api.random() * others.length)]!;
        // Plain damage through the pipeline, not a Damage unit's hit: only the first zap feeds Tinder and Weak spot.
        const dealt = api.damage(api.enemy, next.id, e.applied);
        api.fire("static", "enemy", next.id, Math.round(dealt));
      },
    },
  ],
};

export const LEECH: CardDef = {
  id: "leech",
  title: "Leech",
  detail: "When a Life orb drains a burning enemy, it takes double.",
  icon: "☍",
  kind: "mark",
  army: "mages",
  reads: ["burn"],
  makes: [],
  hooks: [
    {
      on: "beforeOrbBeat",
      when: (e) => e.orbKind === "life" && e.target !== undefined && (e.target.marks?.burn ?? 0) > 0,
      do: (e, api) => {
        e.amount *= api.cfg.leechMult;
        api.fire("leech", "enemy", e.target!.id, Math.round(e.amount));
      },
    },
  ],
};

export const TEMPO: CardDef = {
  id: "tempo",
  title: "Tempo",
  detail: "While any enemy is frozen, the orbs beat twice as fast.",
  icon: "◷",
  kind: "mark",
  army: "mages",
  reads: ["frozen"],
  makes: [],
  hooks: [
    {
      on: "orbGap",
      when: (_e, api) => api.enemy.heroes.some((h) => h.alive && api.isFrozen(h)),
      do: (e, api) => {
        e.sec *= api.cfg.tempoGapMult;
        const frozen = api.enemy.heroes.find((h) => h.alive && api.isFrozen(h));
        api.fire("tempo", "enemy", frozen!.id, Math.round(e.sec * 10) / 10);
      },
    },
  ],
};

export const OVERLOAD: CardDef = {
  id: "overload",
  title: "Overload",
  detail: "When a Mage's orbs merge, every other Mage's loose orbs beat once at once.",
  icon: "❂",
  kind: "duo",
  army: "mages",
  reads: ["frozen"],
  makes: [],
  needs: { cards: ["echo", "tempo"] },
  hooks: [
    {
      on: "orbsMerged",
      do: (e, api) => {
        for (const mage of api.player.heroes) {
          if (mage === e.mage || mage.army !== "mages" || !mage.alive || mage.hp <= 0) continue;
          const loose = mage.orbs ?? 0;
          if (loose === 0) continue;
          // The orbs stay: each works once more, now, and the next shared beat finds them still out.
          for (let i = 0; i < loose; i++) if (!api.beatOrb(mage, i)) break;
          api.fire("overload", "player", mage.id, loose);
        }
      },
    },
  ],
};

export const WELLSPRING: CardDef = {
  id: "wellspring",
  title: "Wellspring",
  detail: "When a Life orb takes HP nobody can take in, it becomes shield for the squad.",
  icon: "❖",
  kind: "duo",
  army: "mages",
  reads: ["shield"],
  makes: [],
  needs: { cards: ["leech", "overflow"] },
  hooks: [
    {
      on: "orbBeat",
      when: (e) => e.orbKind === "life" && e.wasted > 0,
      do: (e, api) => {
        const squad = api.player.heroes.filter((h) => h.alive && h.hp > 0 && !h.skeleton);
        if (squad.length === 0) return;
        const each = (e.wasted * api.cfg.wellspringFraction) / squad.length;
        let added = 0;
        for (const ally of squad) added += api.addShield(ally, each);
        if (added > 0) api.fire("wellspring", "player", e.mage.id, Math.round(added));
      },
    },
  ],
};
