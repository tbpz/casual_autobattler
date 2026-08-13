/**
 * The sim -> render contract. fight.ts runs a fight to completion and emits
 * this once; render/playback.ts only ever replays it on wall-clock, never
 * re-simulates (the record-then-replay split carried over conceptually from
 * the old prototype's sim/engine.ts + render/playback.ts).
 */
import type { Role } from "./types.js";

export type Side = "player" | "enemy";

export type FightEvent =
  | { type: "attack"; t: number; side: Side; attackerId: string; targetId: string; damage: number }
  | { type: "heal"; t: number; side: Side; healerId: string; targetId: string; amount: number }
  | { type: "heatFull"; t: number; heroId: string }
  // heroId is always the candidate that rolled, win or lose (2026-08-08 —
  // needed so a miss can be attributed to a named hero, not just discarded;
  // see fightView.ts's showIgnitionMiss and runScreens.ts's recap line).
  | { type: "ignitionRoll"; t: number; fired: boolean; heroId: string }
  /** Heat flowing from one ally to another via a heatGift (2026-08-09 pass —
   * see heroes.ts's PLAYER_HERO_POOL). Previously silent: applyHeatGift moved
   * the receiver's meter with no render-facing trace at all, so "who ignites
   * can vary fight to fight" read as pure randomness instead of a mechanism.
   * `amount` is the accumulated, already-throttled quantity (see fight.ts's
   * heatGiftAccumFor) — one tell per pair means "a legible slice of someone's
   * bar just moved," not one event per underlying hit. */
  | { type: "heatGift"; t: number; fromId: string; toId: string; amount: number }
  | { type: "chainHit"; t: number; hitIndex: number; damage: number; targetId: string }
  /** heroId is the hero who was hot during this chain (2026-08-14
   * chain-legibility pass — previously chainEnd carried no owner, so the
   * payoff summary couldn't be attributed without cross-referencing the
   * ignitionRoll that started it). totalDamage/killedIds are what the chain
   * actually bought the squad — see fight.ts's chain-hit branch, which
   * accumulates both alongside the existing bonusHitsLanded counter. */
  | {
      type: "chainEnd";
      t: number;
      chainLength: number;
      heroId: string;
      totalDamage: number;
      killedIds: string[];
    }
  | { type: "heroDown"; t: number; side: Side; heroId: string }
  | { type: "tankBreak"; t: number; side: Side; heroId: string }
  | { type: "tankRecover"; t: number; side: Side; heroId: string }
  /** The bruiser begins a telegraphed charge against targetId, firing at
   * fireT — the dread beat: a named hero, on a visible clock. */
  | { type: "windupStart"; t: number; targetId: string | null; fireT: number }
  /** The charge resolves — targetId is who it actually landed on (may differ
   * from windupStart's target if that hero died first; see fight.ts). */
  | { type: "windupHit"; t: number; targetId: string; damage: number }
  /** Fires once, the first tick the enrage ramp becomes active. */
  | { type: "enrageStart"; t: number }
  | { type: "resolve"; t: number; outcome: "win" | "loss"; reason: "wipe" | "failsafe" };

/** A per-hero HP reading at one instant, for body rendering. */
export interface HeroSnapshot {
  id: string;
  name: string;
  role: Role;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Job counters as of this instant — see types.ts's HeroState docstring. */
  dealt: number;
  soaked: number;
  restored: number;
  hitsTaken: number;
  /** Tank-only: still holding aggro (not broken). Always false off-role. */
  holding: boolean;
  /** Ignition eligibility meter as of this instant — see types.ts's
   * HeroState docstring. Render-facing so a heat bar can fill visibly. */
  heat: number;
  /** Mirrors fight.ts's ignition-candidacy guard (a pure healer — healPerBeat
   * set, attacksWhileHealing not — can win the heat roll but can never land
   * a chain hit, so the sim excludes it from candidacy entirely). Render-
   * facing (2026-08-14 chain-legibility pass) so the "who's next" marker can
   * match the sim's own rule instead of approximating it from role alone. */
  canIgnite: boolean;
}

export interface TickSnapshot {
  t: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerHeroes: HeroSnapshot[];
  enemyHeroes: HeroSnapshot[];
  /** The hero currently hot (mid-chain), if any. Sim-facing truth, consumed
   * by checks/batch — the renderer reads visibleChainHeroId instead, so a
   * chain that hasn't yet earned its tell (see chainTellThreshold) never
   * glows. */
  hotHeroId: string | null;
  /** Render-facing chain state (2026-08-06): non-null only once the current
   * chain has landed cfg.chainTellThreshold+ hits, so a fizzled 0/1-length
   * chain never triggers the glow/callout tell. See DECISIONS.md's
   * "spectacle gated on payoff" entry. */
  visibleChainHeroId: string | null;
  visibleChainLength: number;
  /** Running damage total for the CURRENT chain (2026-08-14, chain-legibility
   * pass) — 0 whenever hotHeroId is null. Snapshot-driven, not
   * renderer-accumulated, so a persistent chain HUD stays correct under
   * pause/step/scrub, same reasoning as visibleChainHeroId. Unlike
   * visibleChainHeroId this is NOT gated by chainTellThreshold — the running
   * total is attribution, not spectacle, so it's always accurate once a
   * chain is live even before the glow earns its tell. */
  chainDamageSoFar: number;
  /** Current enemy damage multiplier from the enrage clock (2026-08-07
   * rebuild) — 1 before enrageStartSec, ramping after. Render-facing so a
   * live indicator can show it without the renderer knowing config.ts's
   * formula. */
  enrageMultiplier: number;
  /** The enemy bruiser's current wind-up target, if it's mid-telegraph —
   * render-facing so the targeted hero can be highlighted for the charge's
   * duration. Null when the bruiser isn't charging (or is dead). */
  windupTargetId: string | null;
}

export interface FightResult {
  seed: number;
  events: FightEvent[];
  snapshots: TickSnapshot[];
  outcome: "win" | "loss";
  endReason: "wipe" | "failsafe";
  ignited: boolean;
  chainLength: number;
  durationSec: number;
  /** Final per-hero HP, for the run wrapper to carry forward as attrition. */
  finalPlayerHeroes: HeroSnapshot[];
  /** True if the player's tank line ever broke, or the gate opened with no
   * living tank — i.e. this fight had a real dip. See DECISIONS.md
   * 2026-08-06 and batch/report.ts's dipRate metric. */
  dipOccurred: boolean;
  /** Failed-attempts-since-last-ignition counter's value at fight end (2026-
   * 08-08 "heat is spent" rebuild) — the run wrapper carries this into the
   * next fight's FightSetup.attemptsSinceIgnition. Can differ from what the
   * fight started with even on a loss-free run, since heat resets and
   * rebuilds after every roll, so one fight can contain several attempts. */
  attemptsSinceIgnition: number;
}
