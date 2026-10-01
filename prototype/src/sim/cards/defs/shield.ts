import type { CardDef } from "../types.js";

/** Cards that read, or lay, the ⛊ Shield mark. */

export const SPIKED_SHIELD: CardDef = {
  id: "spikedShield",
  title: "Spiked shield",
  detail: "When a shield absorbs a hit, the attacker becomes exposed.",
  icon: "✶",
  kind: "mark",
  reads: ["shield"],
  makes: ["exposed"],
  hooks: [
    {
      on: "shieldAbsorbed",
      // The attacker that hit a Shield pays for it — only an attacker from the
      // other side that is still standing.
      when: (e) => e.source !== undefined && e.source.alive && !e.side.heroes.includes(e.source),
      do: (e, api) => {
        const source = e.source!;
        api.addExposed(source, api.cfg.spikedShieldExposeStacks);
        api.fire("spikedShield", api.sideLabel(e.side) === "enemy" ? "player" : "enemy", source.id, api.cfg.spikedShieldExposeStacks);
      },
    },
  ],
};

export const BULWARK: CardDef = {
  id: "bulwark",
  title: "Bulwark",
  detail: "When Guard blocks a slam, the whole squad gains a shield.",
  icon: "⛫",
  kind: "mark",
  reads: ["shield"],
  makes: ["shield"],
  needsEffects: ["guard"],
  hooks: [
    {
      on: "guardBlock",
      do: (e, api) => {
        for (const ally of e.side.heroes) if (ally.alive && ally.hp > 0) api.addShield(ally, api.cfg.bulwarkShield);
        api.fire("bulwark", "player", e.guardian.id, api.cfg.bulwarkShield);
      },
    },
  ],
};

export const OVERFLOW: CardDef = {
  id: "overflow",
  title: "Overflow",
  detail: "When a heal has nowhere to go, the extra becomes shield.",
  icon: "≈",
  kind: "mark",
  reads: [],
  makes: ["shield"],
  hooks: [
    {
      on: "overheal",
      when: (e) => !e.onEnemySide,
      do: (e, api) => {
        const added = api.addShield(e.target, e.amount * api.cfg.overflowFraction);
        if (added > 0) api.fire("overflow", "player", e.target.id, added);
      },
    },
  ],
};

export const SHIELD_BASH: CardDef = {
  id: "shieldBash",
  title: "Shield bash",
  detail: "When your Tank hits, it adds a quarter of its shield as damage.",
  icon: "▣",
  kind: "mark",
  reads: ["shield"],
  makes: [],
  hooks: [
    {
      on: "beforeBasicAttack",
      when: (e) => e.isPlayerAttacker && e.hero.role === "tank" && (e.hero.marks?.shield ?? 0) > 0,
      do: (e, api) => {
        const bonus = Math.max(1, Math.round(e.hero.marks!.shield * api.cfg.shieldBashFraction));
        e.damage += bonus;
        api.fire("shieldBash", "enemy", e.victim?.id ?? e.hero.id, bonus);
      },
    },
  ],
};

export const SHATTERGUARD: CardDef = {
  id: "shatterguard",
  title: "Shatterguard",
  detail: "When a shield breaks, the attacker freezes.",
  icon: "◈",
  kind: "mark",
  reads: ["shield"],
  makes: ["frozen"],
  hooks: [
    {
      on: "shieldBroken",
      when: (e, api) =>
        api.sideLabel(e.side) === "player" && e.source !== undefined && e.source.alive && !e.side.heroes.includes(e.source),
      do: (e, api) => {
        const sec = api.freeze(e.source!, api.cfg.shatterguardFreezeSec);
        api.fire("shatterguard", "enemy", e.source!.id, sec);
      },
    },
  ],
};

export const AEGIS: CardDef = {
  id: "aegis",
  title: "Aegis",
  detail: "Shields can grow to your units' full max HP.",
  icon: "⬡",
  kind: "mark",
  reads: ["shield"],
  makes: [],
  hooks: [
    {
      on: "shieldCap",
      when: (e) => !e.onEnemySide,
      // A passive rule, not a moment — it raises no cardTriggered of its own.
      do: (e, api) => {
        e.fraction = Math.max(e.fraction, api.cfg.aegisCapFraction);
      },
    },
  ],
};
