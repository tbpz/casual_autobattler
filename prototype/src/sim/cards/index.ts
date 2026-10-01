import type { ChainEffect, MarkId } from "../config.js";
import { INFERNO, KINDLING, OPEN_WOUND, SMOKE, SPREAD, WILDFIRE } from "./defs/burn.js";
import { CINDER_SHIELD, FORTRESS, GLASS, KILLING_FROST, PHOENIX, THERMAL_SHOCK } from "./defs/duo.js";
import { CRACK, EXECUTE, HUNTER_MARK, LAY_BARE, PUNISH, WEAK_SPOT } from "./defs/exposed.js";
import { BRITTLE, COLD_SNAP, DEEP_FREEZE, FROSTBITE, PERMAFROST, SHATTER } from "./defs/frozen.js";
import { BLOODLUST, IRON_HIDE, MOMENTUM, SECOND_WIND } from "./defs/general.js";
import { BASTION, EMBER_HEART, FROST_CROWN, HUNTERS_EYE, MERCENARY, RESTLESS } from "./defs/relic.js";
import { AEGIS, BULWARK, OVERFLOW, SHATTERGUARD, SHIELD_BASH, SPIKED_SHIELD } from "./defs/shield.js";
import type { CardDef, CardId } from "./types.js";

export type { CardApi, CardDef, CardHook, CardId, CardKind, CardNeeds, HookName, HookPayloads } from "./types.js";

/**
 * 2026-09-30 (marks and payoffs — see DECISIONS.md's "upgrades become set-up
 * and pay-off combos" entry), reworked 2026-10-01 into cards on a "when X, do Y"
 * engine (cards/types.ts, cards/engine.ts). A card is a squad-wide passive the
 * run holds (RunProgress.cards), handed to the fight in FightSetup.cards. Most
 * read a mark that a chain ability (or another card) leaves, so they are worth
 * little alone and a lot next to what sets them up.
 *
 * This file is the registry plus the "does this card connect to what the squad
 * can make" questions the offer draw and offer screen both ask. What each card
 * DOES lives with its definition in cards/defs/, one file per mark.
 */
export const CARD_DEFS: Record<CardId, CardDef> = {
  execute: EXECUTE,
  punish: PUNISH,
  weakSpot: WEAK_SPOT,
  crack: CRACK,
  layBare: LAY_BARE,
  hunterMark: HUNTER_MARK,
  shatter: SHATTER,
  deepFreeze: DEEP_FREEZE,
  coldSnap: COLD_SNAP,
  brittle: BRITTLE,
  frostbite: FROSTBITE,
  permafrost: PERMAFROST,
  spread: SPREAD,
  openWound: OPEN_WOUND,
  kindling: KINDLING,
  inferno: INFERNO,
  smoke: SMOKE,
  wildfire: WILDFIRE,
  spikedShield: SPIKED_SHIELD,
  bulwark: BULWARK,
  overflow: OVERFLOW,
  shieldBash: SHIELD_BASH,
  shatterguard: SHATTERGUARD,
  aegis: AEGIS,
  momentum: MOMENTUM,
  secondWind: SECOND_WIND,
  ironHide: IRON_HIDE,
  bloodlust: BLOODLUST,
  fortress: FORTRESS,
  thermalShock: THERMAL_SHOCK,
  killingFrost: KILLING_FROST,
  cinderShield: CINDER_SHIELD,
  glass: GLASS,
  phoenix: PHOENIX,
  emberHeart: EMBER_HEART,
  frostCrown: FROST_CROWN,
  huntersEye: HUNTERS_EYE,
  bastion: BASTION,
  restless: RESTLESS,
  mercenary: MERCENARY,
};

/** Every card id, in the registry's order. */
export const CARD_IDS = Object.keys(CARD_DEFS) as CardId[];

/** The cards offered through the ordinary pool — everything but duos, which
 * have their own rule (duoUnlocked). */
export const POOL_CARD_IDS: CardId[] = CARD_IDS.filter((id) => CARD_DEFS[id].kind !== "duo" && CARD_DEFS[id].kind !== "relic");

export const DUO_IDS: CardId[] = CARD_IDS.filter((id) => CARD_DEFS[id].kind === "duo");

/** The relics a run may start with — picked from three at run start, never offered after. */
export const RELIC_IDS: CardId[] = CARD_IDS.filter((id) => CARD_DEFS[id].kind === "relic");

/** The marks each chain ability leaves. Exposed/Burn/Shield are stacks;
 * Frozen is the stun fields. Guard leaves Exposed on the slammer it blocks. */
export const ABILITY_MARKS: Record<ChainEffect, MarkId[]> = {
  guard: ["exposed"],
  stun: ["frozen"],
  expose: ["exposed"],
  scorch: ["burn"],
  mend: ["shield"],
  ward: ["shield"],
  brace: ["shield"],
  quake: ["exposed"],
  frostbolt: ["frozen"],
  siphon: ["shield"],
  cauterize: ["burn"],
  chill: ["frozen"],
};

/** The set of marks a squad can currently make: the marks its abilities leave,
 * plus the marks a held card's effect lays (`makes`) — but a card only counts
 * once everything IT reads is already in the set, so a bridge (Spiked shield:
 * shield → exposed) feeds forward only when something feeds it. Repeated until
 * nothing new is added, so a chain of bridges counts end to end. A card that
 * reads nothing (Hunter's mark) always counts. */
export function marksMadeBy(effects: readonly ChainEffect[], held: readonly CardId[] = []): Set<MarkId> {
  const marks = new Set<MarkId>();
  for (const effect of effects) for (const mark of ABILITY_MARKS[effect]) marks.add(mark);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of held) {
      const def = CARD_DEFS[id];
      if (!def.reads.every((m) => marks.has(m))) continue;
      for (const mark of def.makes) {
        if (!marks.has(mark)) {
          marks.add(mark);
          grew = true;
        }
      }
    }
  }
  return marks;
}

/** True when a duo's parts are all in hand: every card it names is held, at
 * least one of its abilities is among `effects`, and every mark it names can
 * be made. Duos are only ever offered, and only ever work as "connected", when
 * this holds. */
export function duoUnlocked(id: CardId, effects: readonly ChainEffect[], held: readonly CardId[]): boolean {
  const needs = CARD_DEFS[id].needs;
  if (!needs) return false;
  if (needs.cards && !needs.cards.every((c) => held.includes(c))) return false;
  if (needs.effects && !needs.effects.some((e) => effects.includes(e))) return false;
  if (needs.marks) {
    const made = marksMadeBy(effects, held);
    if (!needs.marks.every((m) => made.has(m))) return false;
  }
  return true;
}

/** True when `id` has what it needs right now — everything it reads is
 * something the squad (or a held card) can make, or, for a duo, all its parts
 * are held. A card that reads nothing (a maker, a general card) works on its
 * own, so it always connects. The offer draw tilts toward connected cards, the
 * offer screen names the link, and a drop choice sheds unconnected ones
 * first. */
export function cardConnects(id: CardId, effects: readonly ChainEffect[], held: readonly CardId[] = []): boolean {
  const def = CARD_DEFS[id];
  if (def.needs) return duoUnlocked(id, effects, held);
  if (def.needsEffects) return def.needsEffects.some((e) => effects.includes(e));
  const made = marksMadeBy(effects, held);
  return def.reads.every((mark) => made.has(mark));
}

/** Which held card to drop when a run is at the cap and the player (or the
 * headless greedy policy) takes another: a card that connects to nothing goes
 * first, oldest first among ties. The interactive UI lets the player choose
 * instead. */
export function pickCardToDrop(held: readonly CardId[], effects: readonly ChainEffect[], alsoHeld: readonly CardId[] = []): CardId {
  const dead = held.find((id) => !cardConnects(id, effects, [...alsoHeld, ...held]));
  return dead ?? held[0]!;
}

/** The icon and one-word label the UI shows for each mark (2026-09-30).
 * Plain glyphs, same convention as config.ts's chainEffectChip. */
export const MARK_CHIP: Record<MarkId, { icon: string; word: string }> = {
  exposed: { icon: "✦", word: "exposed" },
  frozen: { icon: "❄", word: "frozen" },
  burn: { icon: "♨", word: "burn" },
  shield: { icon: "⛊", word: "shield" },
};
