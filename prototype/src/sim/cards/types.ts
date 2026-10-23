import type { ChainEffect, FightConfig, MarkId } from "../config.js";
import type { Side } from "../events.js";
import type { ArmyKind, HeroState, SideState } from "../types.js";

/**
 * 2026-10-01 (cards on a "when X, do Y" engine — see DECISIONS.md and the
 * build-depth plan). A card is data: the hooks it listens on, a guard, and what
 * it does. fight.ts raises a hook at each point a card may care about
 * (runHook); sim/cards/engine.ts runs the held cards' listeners in held order.
 *
 * Two kinds of hook share one shape. A MODIFY hook is raised before a number is
 * used and hands the listener a mutable payload field (`mult`, `sec`, `damage`)
 * to change in place. A REACTION hook is raised after something happened, and
 * the listener does something about it. Either may call back into the fight
 * through CardApi, and whatever that raises runs cards too — that is the
 * cascade. The engine caps its depth (FightConfig.cascadeMaxDepth).
 */
export type CardId =
  // Mark cards that read one or two marks.
  | "execute"
  | "punish"
  | "weakSpot"
  | "crack"
  | "layBare"
  | "hunterMark"
  | "shatter"
  | "deepFreeze"
  | "coldSnap"
  | "brittle"
  | "frostbite"
  | "permafrost"
  | "spread"
  | "openWound"
  | "kindling"
  | "inferno"
  | "smoke"
  | "wildfire"
  | "spikedShield"
  | "bulwark"
  | "overflow"
  | "shieldBash"
  | "shatterguard"
  | "aegis"
  // General cards: they read the fight itself, not one mark.
  | "momentum"
  | "secondWind"
  | "ironHide"
  | "bloodlust"
  // Duo cards: offered only once both parts are held.
  | "fortress"
  | "thermalShock"
  | "killingFrost"
  | "cinderShield"
  | "glass"
  | "phoenix"
  // Mage army cards (sim/cards/defs/mage.ts): offered only in a Mages run.
  | "vessel"
  | "fuse"
  | "kernel"
  | "echo"
  | "static"
  | "leech"
  | "tempo"
  | "overload"
  | "wellspring"
  // Relics: one is picked as the round 1 reward and held after that (sim/relics.ts).
  | "emberHeart"
  | "frostCrown"
  | "huntersEye"
  | "bastion"
  | "restless";

export type CardKind = "mark" | "general" | "duo" | "relic";

/** What each hook hands its listeners. Fields a listener may change are
 * commented "mutable". `onEnemySide` is true when the body is on the enemy
 * side — cards belong to the player, so most of them care. */
export interface HookPayloads {
  /** Once, before the first tick. */
  fightStart: { t: number };
  /** Before one body takes a hit, after Exposed is counted. */
  beforeDamage: { target: HeroState; onEnemySide: boolean; mult: number /* mutable */ };
  /** After a hit removed HP from `target` (it may be at 0 already). */
  afterHit: { target: HeroState; onEnemySide: boolean; taken: number /* mutable: HP removed */ };
  /** A Shield soaked part of a hit on `side`. `source` is who swung, if known. */
  shieldAbsorbed: { side: SideState; source?: HeroState; absorbed: number };
  /** A hit used up the last of `target`'s Shield. */
  shieldBroken: { side: SideState; target: HeroState; source?: HeroState };
  /** A body just died. A listener may bring it back by setting alive and hp
   * (Phoenix); fight.ts then drops it from the hit's list of the dead. */
  death: { side: SideState; hero: HeroState; onEnemySide: boolean };
  /** Before a normal attack's damage is applied. */
  beforeBasicAttack: { hero: HeroState; isPlayerAttacker: boolean; victim?: HeroState; damage: number /* mutable */ };
  /** After a normal attack landed. `target` is undefined if it had nobody to hit. */
  afterBasicAttack: { hero: HeroState; isPlayerAttacker: boolean; target?: HeroState; applied: number; killed: boolean };
  /** A mark was just laid on `target` (exposed and burn: stacks; shield: amount actually added). */
  markApplied: { target: HeroState; mark: "exposed" | "burn" | "shield"; stacks: number; onEnemySide: boolean };
  /** Before a freeze lands for `sec` seconds. */
  beforeFreeze: { target: HeroState; backfire: boolean; sec: number /* mutable */ };
  /** A freeze just landed, `sec` seconds long. */
  frozen: { target: HeroState; sec: number; backfire: boolean; onEnemySide: boolean };
  /** A freeze just ran out. */
  thawed: { target: HeroState; onEnemySide: boolean };
  /** Before one burn tick's damage is applied. */
  beforeBurnTick: { hero: HeroState; side: Side; damage: number /* mutable */ };
  /** One burn tick landed, removing `applied` HP. */
  burnTick: { hero: HeroState; side: Side; applied: number };
  /** Before a burn's stacks fade after a tick. */
  beforeBurnDecay: { hero: HeroState; side: Side; decay: number /* mutable */ };
  /** Healing past full: `amount` was wasted. */
  overheal: { target: HeroState; amount: number; onEnemySide: boolean };
  /** Before a Shield is topped up: the most it can hold, as a fraction of max HP. */
  shieldCap: { target: HeroState; onEnemySide: boolean; fraction: number /* mutable */ };
  /** Guard just absorbed a slam on the squad's behalf. */
  guardBlock: { guardian: HeroState; slammer: HeroState; side: SideState };
  /** A chain just fired. */
  chainStart: { hero: HeroState; backfire: boolean };
  /** Before a chain's next hit is rolled: the chance it continues. */
  beforeChainRoll: { hero: HeroState; chance: number /* mutable */ };
  /** Before one chain rung's damage or healing is sized. */
  chainMagnitude: { hero: HeroState; mult: number /* mutable */ };
  /** Before one chain rung's mark stacks are counted. */
  chainStacks: { hero: HeroState; stacks: number /* mutable */ };
  /** A chain just ended, `length` hits long. */
  chainEnd: { hero: HeroState; backfire: boolean; length: number };
  /** Mages army (fight.ts's `beatOrb`): before one orb works on the shared beat. `loose` is false for the core orb. `target` is who a Storm
   * zap will hit or whose HP a Life orb will take (the front enemy); a Frost orb has none. `amount` is what the orb does (the mage's
   * damage). */
  beforeOrbBeat: { mage: HeroState; orbKind: "storm" | "frost" | "life"; loose: boolean; target?: HeroState; amount: number /* mutable */ };
  /** An orb just worked. `applied` is the HP a Storm zap or a Life drain removed, or the shield a Frost orb added. `wasted` is what a Life
   * orb took that nobody could take in (0 for the others). */
  orbBeat: { mage: HeroState; orbKind: "storm" | "frost" | "life"; loose: boolean; target?: HeroState; applied: number; wasted: number };
  /** Before the gap to the next shared orb beat is set, in seconds. */
  orbGap: { sec: number /* mutable */ };
  /** Whenever `mage`'s loose-orb limit is read: `cap` is how many it holds before the next hit merges them, `shotMult` scales the merged shot. */
  orbCap: { mage: HeroState; cap: number /* mutable */; shotMult: number /* mutable */ };
  /** A mage's loose orbs just merged and the great shot fired; the orbs are gone. */
  orbsMerged: { mage: HeroState; orbKind: "storm" | "frost" | "life" };
}

export type HookName = keyof HookPayloads;

/** What a card can do to the fight. Every method goes through the same
 * helpers the built-in rules use, so a card's effect is seen by every other
 * card exactly like a built-in one. */
export interface CardApi {
  readonly cfg: FightConfig;
  /** Sim-clock time of the tick being resolved. */
  readonly t: number;
  readonly player: SideState;
  readonly enemy: SideState;
  isFrozen(h: HeroState): boolean;
  sideLabel(side: SideState): Side;
  addExposed(h: HeroState, stacks: number): void;
  addBurn(h: HeroState, stacks: number): void;
  /** Returns the Shield actually added (it is capped). */
  addShield(h: HeroState, amount: number): number;
  /** Deals `amount` through the normal damage pipeline (Exposed, Shield,
   * death) with no attacker. Returns the HP actually removed. */
  damage(side: SideState, targetId: string, amount: number): number;
  /** Freezes `target` for `sec` more seconds (Deep freeze and friends see it
   * first). Returns the seconds actually frozen. */
  freeze(target: HeroState, sec: number): number;
  addCharge(h: HeroState, amount: number): void;
  /** A number in [0, 1) from the fight's random stream (a rune that picks a target at random). */
  random(): number;
  /** Mages army: puts one loose orb round `mage` (its orb limit at most). Returns whether one was added. */
  addOrb(mage: HeroState): boolean;  /** Mages army: one of `mage`'s loose orbs (index 0 up) works once now, outside the beat; the orb stays. Returns false when the fight was
   * won by it (no enemy left). */
  beatOrb(mage: HeroState, index: number): boolean;
  /** Per-fight counters, for cards that build up (Momentum, Inferno). */
  counter(key: string): number;
  bump(key: string, by?: number): number;
  /** True the first time it is called with `key` this fight, false after. */
  once(key: string): boolean;
  /** Puts a cardTriggered event on the fight's record, naming the card that
   * set it off (if one did) and how deep in a cascade it sits. */
  fire(card: CardId, side: Side, targetId: string, amount: number): void;
}

export type CardHook = {
  [K in HookName]: {
    on: K;
    /** Skip this listener when false. Omitted means always. */
    when?: (e: HookPayloads[K], api: CardApi) => boolean;
    do: (e: HookPayloads[K], api: CardApi) => void;
  };
}[HookName];

/** What a duo card needs before it is offered. Every listed card must be held;
 * at least one of `effects` must be among the squad's abilities; every one of
 * `marks` must be something the squad or a held card can make. */
export interface CardNeeds {
  cards?: CardId[];
  effects?: ChainEffect[];
  marks?: MarkId[];
}

export interface CardDef {
  id: CardId;
  title: string;
  /** One plain sentence in "When X, Y" form, shown on the offer card. */
  detail: string;
  /** A single glyph for the card's chip. */
  icon: string;
  kind: CardKind;
  /** The marks this card reads — it does nothing until the squad can make
   * EVERY one of them (Deep freeze needs frozen and exposed, not either). */
  reads: MarkId[];
  /** The marks this card's own effect lays, so a held card can feed another
   * (Brittle lays exposed, which Execute reads). */
  makes: MarkId[];
  /** A card that needs a specific ability rather than a mark (Bulwark needs
   * Guard's blocks). When set, this overrides `reads` for the connection
   * test. */
  needsEffects?: ChainEffect[];
  /** Duo cards only. */
  needs?: CardNeeds;
  /** A card that belongs to one army: offered only in that army's run, and drawn at `armyCardBoost` there (sim/offers.ts). */
  army?: ArmyKind;
  /** Rival runes: this card is not offered while any of these is held (Vessel and Fuse pull opposite ways). */
  excludedBy?: CardId[];
  /** True for a card that works as a standing rule and raises no cardTriggered
   * of its own (Aegis), so the batch's fire-rate line leaves it out. */
  passive?: true;
  hooks: CardHook[];
}
