/**
 * The sim -> render contract. fight.ts runs a fight to completion and emits
 * this once; render/playback.ts only ever replays it on wall-clock, never
 * re-simulates (the record-then-replay split carried over conceptually from
 * the old prototype's sim/engine.ts + render/playback.ts).
 */
import type { ChainEffect } from "./config.js";
import type { Role } from "./types.js";

export type Side = "player" | "enemy";

export type FightEvent =
  | { type: "attack"; t: number; side: Side; attackerId: string; targetId: string; damage: number }
  | { type: "heal"; t: number; side: Side; healerId: string; targetId: string; amount: number }
  /** The moment a hero's charge bar fills and it fires (2026-08-14 chain
   * rebuild — replaces heatFull/ignitionRoll/heatGift wholesale: there is no
   * candidate contest and no roll on whether it happens anymore, only the
   * backfire coin flip carried on this event). `backfire` is decided once,
   * here, and every chainHit/chainEnd for this chain repeats it — the
   * renderer reads it to pick gold burst vs. red implosion immediately, with
   * no advance telegraph. `effect` (2026-09-13, "a hero's chain names its own
   * enemy" rebuild — see config.ts's ChainEffect) is what this chain DOES —
   * replaces the old per-hero ChainShape (fuse length/escalation knee), which
   * described a number's curve instead of naming what the chain answers. */
  | { type: "chainStart"; t: number; heroId: string; backfire: boolean; effect: ChainEffect }
  /** `kind` mirrors ChainEffect's own damage/heal/guard/stun split (2026-09-13
   * rebuild). `backfire` mirrors the owning chainStart's flag, carried
   * per-hit so the renderer doesn't have to track chain state itself.
   * `sourceId` is the hot hero. `targetId` is whoever this hit landed on (or,
   * for "guard", the firing hero itself — the effect is side-level, not aimed
   * at a body). A rung that hits several bodies at once ("strikeAll",
   * "mendAll") produces one chainHit event PER body, all sharing the same
   * `hitIndex` and `t` — that's what makes it read as "everyone at once"
   * without a separate multi-target event shape. */
  | {
      type: "chainHit";
      t: number;
      hitIndex: number;
      damage: number;
      /** What this hit was ESCALATED to before any clamping — a healer's raw
       * heal before the chain-heal cap/room clamp, an attacker's raw
       * magnitude before applyDamageFrom clamps it against the target's
       * remaining HP. `damage` keeps meaning what actually went in;
       * `intended - damage` is what the hit wasted. Reporting only — this
       * changes no sim behaviour. 0 for "guard"/"stun", which don't move HP. */
      intended: number;
      targetId: string | null;
      kind: "damage" | "heal" | "guard" | "stun";
      backfire: boolean;
      sourceId: string;
      /** Set only for "stun" — how many seconds THIS rung's freeze added
       * (config.ts's chainStunBaseSec, escalated). Undefined for
       * "damage"/"heal", which carry their number in `amount` instead, and
       * for "guard", which carries its count in `charges` below (2026-09-15
       * — guard stopped being a duration). */
      durationSec?: number;
      /** Set only for "stun" — the target's full remaining freeze AFTER this
       * rung lands (HeroState.stunnedUntilT post-update, minus the current
       * time). Links are additive (2026-09-15 freeze-visibility pass), so
       * this is the running total a player has bought toward this freeze so
       * far — same convention as guard's chargesTotal below, not a repeat of
       * durationSec. */
      durationTotalSec?: number;
      /** Set only for "guard" — how many slam-redirects this rung adds
       * (config.ts's chainGuardChargesPerRung). */
      charges?: number;
      /** Set only for "guard" — the guardian's full pool AFTER this rung's
       * grant (SideState.guardCharges post-update). `charges` is what this
       * rung alone added; a multi-rung guard chain needs the running total to
       * say "covers 3 slams now," not repeat "covers 1" on every rung
       * (2026-09-15 guard-visibility pass). */
      chargesTotal?: number;
    }
  /** heroId is the hero who was hot during this chain. totalDamage/killedIds
   * are what the chain actually bought (or cost) the squad — see fight.ts's
   * chain-hit branch, which accumulates both alongside bonusHitsLanded.
   * `backfire` mirrors chainStart's flag. `effect` is this chain's own
   * ChainEffect — the end card's showChainEnd needs it and can't read it off
   * anything else by end time (hotHeroId is already null).
   *
   * `reason` (2026-08-19 chain-ending pass) distinguishes the four causes
   * that used to collapse into one identical event — a played session
   * couldn't tell a chain that hit the cap from one that just missed, and
   * a chain that WON the fight rendered the same "broken" beat as one that
   * fizzled. See fight.ts's emission sites. */
  | {
      type: "chainEnd";
      t: number;
      chainLength: number;
      heroId: string;
      totalDamage: number;
      /** "stun" only — the sum of every landed link's own duration this
       * chain (2026-09-15 freeze-visibility pass). 0 for every other effect,
       * same convention as totalDamage being 0 for "guard"/"stun" — see
       * fight.ts's chainStunSoFar. */
      totalStunSec: number;
      killedIds: string[];
      backfire: boolean;
      /** "sourceDied" (2026-08-29, Phase 0 lockout fix — see fight.ts's new
       * post-loop sweep): the hot hero died mid-chain, to its own backfire or
       * to an enemy hit, before its next beat could roll a continuation. The
       * chain closes out right there instead of leaving hotHeroId stuck on a
       * dead hero for the rest of the fight. */
      reason: "miss" | "capped" | "noTarget" | "fightEnd" | "sourceDied";
      effect: ChainEffect;
    }
  | { type: "heroDown"; t: number; side: Side; heroId: string }
  | { type: "tankBreak"; t: number; side: Side; heroId: string }
  | { type: "tankRecover"; t: number; side: Side; heroId: string }
  /** The bruiser begins a telegraphed charge against targetId, firing at
   * fireT — the dread beat: a named hero, on a visible clock. `sourceId`
   * (2026-09-13 slam-visibility pass) is the bruiser itself — previously
   * absent, which is why the render layer could highlight the victim but
   * never the attacker. */
  | { type: "windupStart"; t: number; sourceId: string; targetId: string | null; fireT: number }
  /** The charge resolves — targetId is who it actually landed on (may differ
   * from windupStart's target if that hero died first; see fight.ts).
   * `sourceId` (2026-09-13) mirrors windupStart's. `originalTargetId` is the
   * target locked at telegraph start (null if none was ever locked);
   * `redirect` says WHY it differs from the final `targetId` — "targetDied"
   * (the locked hero fell to something else first, so this is an ordinary
   * retarget), "guard" (Bracer's chain effect stepped IN at fire time — a
   * real save), "guardBackfire" (Bracer's guard stepped ASIDE instead,
   * sending the slam to the squad's own weakest hero — 2026-09-15,
   * previously indistinguishable from "guard" so a betrayal rendered as an
   * identical save) — or null when the final target IS the locked one.
   * Without this the cases were indistinguishable from a diff alone, and
   * Bracer's guard had no visible proof it did anything. */
  | {
      type: "windupHit";
      t: number;
      sourceId: string;
      targetId: string;
      damage: number;
      originalTargetId: string | null;
      redirect: "guard" | "guardBackfire" | "targetDied" | null;
    }
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
  /** The chain meter as of this instant — see types.ts's HeroState.charge
   * docstring. Render-facing so the charge bar can fill visibly, including
   * across fights (it's the same persisted value the roster carries). */
  charge: number;
  /** This hero's chainAffinity (2026-08-15, chain-payoff-axis pass) —
   * render-facing so an ignition tell can scale its own intensity to this
   * hero's expected magnitude (see render/fightView.ts's showChainStart)
   * without the renderer importing the static hero pool. Inert (1) for
   * enemies, who never chain — see sim/encounters.ts. */
  chainAffinity: number;
  /** Enemy bruiser only (2026-09-13 slam-visibility pass) — mirrors
   * types.ts's HeroState fields of the same name, render-facing so the slam
   * bar/aim line/attacker-glow can be driven per-hero, per-frame, straight
   * off the snapshot (same discipline as every other tell here: correct
   * under pause/step/scrub). Undefined for every non-bruiser. */
  windupFireT?: number;
  windupTargetId?: string | null;
  nextWindupT?: number;
  windupIntervalSec?: number;
  /** Hollow's "stun" chain effect (2026-09-15 freeze-visibility pass) —
   * mirrors types.ts's HeroState fields of the same name, render-facing so a
   * live countdown can be driven per-hero, per-frame, straight off the
   * snapshot (same discipline as windupFireT etc. above: correct under
   * pause/step/scrub, no wall-clock timer). Undefined whenever this hero
   * isn't currently frozen. */
  stunnedUntilT?: number;
  stunnedFromT?: number;
  /** Mirrors HeroState.stunnedHeld (2026-09-16 freeze-layout pass) — true
   * while the live chain is still buying this freeze (fightView.ts holds
   * the ring full and counts the seconds up), false once it's draining. */
  stunnedHeld?: boolean;
}

export interface TickSnapshot {
  t: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerHeroes: HeroSnapshot[];
  enemyHeroes: HeroSnapshot[];
  /** The hero currently hot (mid-chain), if any. */
  hotHeroId: string | null;
  /** Whether the CURRENT chain (hotHeroId) is a backfire — meaningless when
   * hotHeroId is null. 2026-08-14 chain rebuild: with an explicit good/bad
   * identity decided at chainStart, the chain reads loud from hit 1 — there
   * is no more delayed "earn the glow" gating (the old visibleChainHeroId/
   * chainTellThreshold gate is gone; see DECISIONS.md). */
  chainBackfire: boolean;
  visibleChainLength: number;
  /** The CURRENT chain's effect (config.ts's ChainEffect) — null whenever
   * hotHeroId is null. Carried on the snapshot, not just on chainStart,
   * because updateChainHud is deliberately snapshot-driven (so the HUD stays
   * correct under pause/step/scrub — see fightView.ts) and render() drains
   * events AFTER updating the HUD from the snapshot each tick; an event-only
   * path would paint one stale-length frame on the ignition tick itself. */
  chainEffect: ChainEffect | null;
  /** Running damage/heal total for the CURRENT chain — 0 whenever hotHeroId
   * is null. Snapshot-driven, not renderer-accumulated, so a persistent
   * chain HUD stays correct under pause/step/scrub. */
  chainDamageSoFar: number;
  /** Bracer's guard, as of this instant (2026-09-15 slam-provability pass) —
   * side-level like hotHeroId/chainBackfire above, not per-hero, since it has
   * one named owner. null/0/false whenever no guard is live. Lets the render
   * layer draw a live guard (a pip count on the guardian, a dashed "this aim
   * is conditional" hint on the telegraph) without waiting for a windupHit
   * event to prove one exists — see fightView.ts's updateWindupTells. */
  guardHeroId: string | null;
  guardCharges: number;
  guardInverted: boolean;
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
}
