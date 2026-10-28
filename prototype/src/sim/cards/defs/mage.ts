import type { HeroState } from "../../types.js";
import type { CardDef } from "../types.js";

/**
 * The Mage army's own runes (2026-10-23, DECISIONS.md "Mage runs get marks from merged shots only, four Mage runes and two duos", reworked
 * the same day in "Mage runes must act on the orbs, not the marks", and again on 2026-10-28 in "Mage bet 1 failed in play"). Each is offered
 * only in a Mages run (`army: "mages"`) and acts on the orbs themselves, so it stops making sense when "orb" is swapped for "hit". They sit
 * in three rival builds (`build`): the first rune held from one build shuts out the others (sim/offers.ts), so a build is a choice. Each build
 * has setup runes that speed it up and a payoff rune that stores power and releases it at the merge:
 *   Big merges  (hold more, hit harder): Vessel; payoff Static.
 *   Many merges (merge early and often): Fuse, Echo, Leech, Wellspring; payoff the duo Overload.
 *   Core orb    (the orb that never leaves): Tempo; payoff Kernel.
 * Vessel and Fuse change the loose-orb limit through the `orbCap` hook; the payoffs read `orbShot` and `orbsMerged`. Every number is a first
 * take in config.ts for the batch to tune.
 */

/** The counter key under which Kernel counts one mage's core-orb beats since its last merged shot. */
const kernelKey = (mage: HeroState): string => `kernel:${mage.id}`;
/** Tempo's own extra core beat raises orbBeat again; this counter is non-zero while it runs so that beat does not double again. */
const TEMPO_BUSY = "tempo:busy";
/** Overload merges the other mages inside its own orbsMerged hook; this counter is non-zero while it runs so that sweep does not start another. */
const OVERLOAD_BUSY = "overload:busy";

export const VESSEL: CardDef = {
  id: "vessel",
  title: "Vessel",
  detail: "A mage holds one more loose orb before they merge, and the merged shot is bigger.",
  icon: "⬡",
  kind: "general",
  army: "mages",
  build: "big",
  passive: true,
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbCap",
      do: (e, api) => {
        e.cap = Math.max(e.cap, api.cfg.vesselOrbMax);
        e.shotMult *= api.cfg.vesselShotMult;
      },
    },
  ],
};

export const FUSE: CardDef = {
  id: "fuse",
  title: "Fuse",
  detail: "A mage's loose orbs merge after two.",
  icon: "⬢",
  kind: "general",
  army: "mages",
  build: "many",
  passive: true,
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbCap",
      do: (e, api) => {
        e.cap = Math.min(e.cap, api.cfg.fuseOrbMax);
      },
    },
  ],
};

export const KERNEL: CardDef = {
  id: "kernel",
  title: "Kernel",
  detail: "A mage's core orb stores a charge on every beat; once full, the next merged shot is far bigger and spends it.",
  icon: "◉",
  kind: "general",
  army: "mages",
  build: "core",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbBeat",
      when: (e, api) => !e.loose && api.counter(kernelKey(e.mage)) < api.cfg.kernelMax,
      do: (e, api) => {
        api.bump(kernelKey(e.mage));
      },
    },
    {
      // Only a full store is spent: a merge before that leaves the charge where it is, so the big shot is a moment that was built up to.
      on: "orbShot",
      when: (e, api) => api.counter(kernelKey(e.mage)) >= api.cfg.kernelMax,
      do: (e, api) => {
        e.shotMult *= api.cfg.kernelShotMult;
        api.bump(kernelKey(e.mage), -api.counter(kernelKey(e.mage)));
        api.fire("kernel", "player", e.mage.id, api.cfg.kernelMax);
      },
    },
  ],
};

export const ECHO: CardDef = {
  id: "echo",
  title: "Echo",
  detail: "When a Mage's orbs merge, one loose orb stays behind.",
  icon: "❍",
  kind: "general",
  army: "mages",
  build: "many",
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
  detail: "When a Storm Mage's orbs merge, the shot also strikes every other enemy, harder for each orb it held.",
  icon: "ϟ",
  kind: "general",
  army: "mages",
  build: "big",
  needsEffects: ["stormOrb"],
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbsMerged",
      when: (e) => e.orbKind === "storm" && e.target !== undefined,
      do: (e, api) => {
        const each = e.shot * api.cfg.staticSharePerOrb * e.orbs;
        for (const foe of api.enemy.heroes) {
          if (!foe.alive || foe.hp <= 0 || foe === e.target) continue;
          const dealt = api.damage(api.enemy, foe.id, each);
          api.fire("static", "enemy", foe.id, Math.round(dealt));
        }
      },
    },
  ],
};

export const LEECH: CardDef = {
  id: "leech",
  title: "Leech",
  detail: "When another Mage's orbs merge, the Life Mage gains a loose orb.",
  icon: "☍",
  kind: "general",
  army: "mages",
  build: "many",
  needsEffects: ["lifeOrb"],
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbsMerged",
      do: (e, api) => {
        for (const life of api.player.heroes) {
          if (life === e.mage || life.kind !== "lifeMage" || !life.alive || life.hp <= 0) continue;
          if (api.addOrb(life)) api.fire("leech", "player", life.id, 1);
        }
      },
    },
  ],
};

export const TEMPO: CardDef = {
  id: "tempo",
  title: "Tempo",
  detail: "Core orbs work a second time on every beat, for less; loose orbs still work once.",
  icon: "◷",
  kind: "general",
  army: "mages",
  build: "core",
  needsEffects: ["frostOrb"],
  reads: [],
  makes: [],
  hooks: [
    {
      on: "beforeOrbBeat",
      when: (e, api) => !e.loose && api.counter(TEMPO_BUSY) > 0,
      do: (e, api) => {
        e.amount *= api.cfg.tempoSecondBeat;
      },
    },
    {
      on: "orbBeat",
      when: (e, api) => !e.loose && api.counter(TEMPO_BUSY) === 0,
      do: (e, api) => {
        api.bump(TEMPO_BUSY);
        try {
          api.beatOrb(e.mage, -1);
        } finally {
          api.bump(TEMPO_BUSY, -1);
        }
        api.fire("tempo", "player", e.mage.id, 1);
      },
    },
  ],
};

export const OVERLOAD: CardDef = {
  id: "overload",
  title: "Overload",
  detail: "When a Mage's orbs merge while every other Mage holds two loose orbs or more, they all merge at once.",
  icon: "❂",
  kind: "duo",
  army: "mages",
  build: "many",
  reads: [],
  makes: [],
  needs: { cards: ["echo", "fuse"] },
  hooks: [
    {
      // Every other living mage must be ready, so the cascade is the squad lining up, not one stray mage with orbs to spare.
      on: "orbsMerged",
      when: (e, api) => {
        if (api.counter(OVERLOAD_BUSY) > 0) return false;
        const others = api.player.heroes.filter((m) => m !== e.mage && m.army === "mages" && m.alive && m.hp > 0);
        return others.length > 0 && others.every((m) => (m.orbs ?? 0) >= api.cfg.overloadMinOrbs);
      },
      do: (e, api) => {
        api.bump(OVERLOAD_BUSY);
        let merged = 0;
        try {
          for (const mage of api.player.heroes.filter((m) => m !== e.mage && m.army === "mages" && m.alive && m.hp > 0)) {
            if (api.mergeOrbs(mage)) merged++;
          }
        } finally {
          api.bump(OVERLOAD_BUSY, -1);
        }
        if (merged > 0) api.fire("overload", "player", e.mage.id, merged);
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
  build: "many",
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
