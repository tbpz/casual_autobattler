import type { HeroState } from "../../types.js";
import type { CardDef } from "../types.js";

/**
 * The Mage army's own runes (2026-10-23, DECISIONS.md "Mage runs get marks from merged shots only, four Mage runes and two duos", reworked
 * the same day in "Mage runes must act on the orbs, not the marks"). Each is offered only in a Mages run (`army: "mages"`) and acts on the
 * orbs themselves, so it stops making sense when "orb" is swapped for "hit". They pull toward three rival builds:
 *   Big merges  (hold more, hit harder): Vessel, Static.
 *   Many merges (merge early and often): Fuse, Echo, Leech, and the duo Overload.
 *   Core orb    (the orb that never leaves): Kernel, Tempo.
 * Vessel and Fuse change the loose-orb limit through the `orbCap` hook and shut each other out of the offers (`excludedBy`). Every number is a
 * first take in config.ts for the batch to tune.
 */

/** The counter key under which Kernel counts one mage's core-orb beats this fight. */
const kernelKey = (mage: HeroState): string => `kernel:${mage.id}`;
/** Tempo's own extra core beat raises orbBeat again; this counter is non-zero while it runs so that beat does not double again. */
const TEMPO_BUSY = "tempo:busy";

export const VESSEL: CardDef = {
  id: "vessel",
  title: "Vessel",
  detail: "A mage holds one more loose orb before they merge, and the merged shot is bigger.",
  icon: "⬡",
  kind: "general",
  army: "mages",
  excludedBy: ["fuse"],
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
  detail: "A mage's loose orbs merge after two, and the merged shot is smaller.",
  icon: "⬢",
  kind: "general",
  army: "mages",
  excludedBy: ["vessel"],
  passive: true,
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbCap",
      do: (e, api) => {
        e.cap = Math.min(e.cap, api.cfg.fuseOrbMax);
        e.shotMult *= api.cfg.fuseShotMult;
      },
    },
  ],
};

export const KERNEL: CardDef = {
  id: "kernel",
  title: "Kernel",
  detail: "A mage's core orb works harder on every beat it has worked, until its orbs merge.",
  icon: "◉",
  kind: "general",
  army: "mages",
  reads: [],
  makes: [],
  hooks: [
    {
      on: "beforeOrbBeat",
      when: (e, api) => !e.loose && api.counter(kernelKey(e.mage)) > 0,
      do: (e, api) => {
        const beats = Math.min(api.counter(kernelKey(e.mage)), api.cfg.kernelMax);
        e.amount += beats * api.cfg.kernelStep;
        api.fire("kernel", "player", e.mage.id, Math.round(beats * api.cfg.kernelStep));
      },
    },
    {
      on: "orbBeat",
      when: (e) => !e.loose,
      do: (e, api) => {
        api.bump(kernelKey(e.mage));
      },
    },
    {
      on: "orbsMerged",
      do: (e, api) => {
        api.bump(kernelKey(e.mage), -api.counter(kernelKey(e.mage)));
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
  detail: "While a Storm Mage holds two loose orbs or more, each of its zaps jumps to a second enemy.",
  icon: "ϟ",
  kind: "general",
  army: "mages",
  needsEffects: ["stormOrb"],
  reads: [],
  makes: [],
  hooks: [
    {
      on: "orbBeat",
      when: (e, api) => e.orbKind === "storm" && e.target !== undefined && e.applied > 0 && (e.mage.orbs ?? 0) >= api.cfg.staticMinOrbs,
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
  detail: "When another Mage's orbs merge, the Life Mage gains a loose orb.",
  icon: "☍",
  kind: "general",
  army: "mages",
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
  detail: "When a Mage's orbs merge, every other Mage's loose orbs beat once at once.",
  icon: "❂",
  kind: "duo",
  army: "mages",
  reads: [],
  makes: [],
  needs: { cards: ["echo", "fuse"] },
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
