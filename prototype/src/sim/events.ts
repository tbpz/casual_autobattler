/**
 * The sim -> render contract. fight.ts runs a fight to completion and emits
 * this once; render/playback.ts only ever replays it on wall-clock, never
 * re-simulates (the record-then-replay split carried over conceptually from
 * the old prototype's sim/engine.ts + render/playback.ts).
 */
import type { Role } from "./types.js";

export type Side = "player" | "enemy";

/** The firing hero's chain SHAPE, as much of it as the renderer needs
 * (2026-08-20, per-hero-profile pass — see config.ts's ChainProfile).
 * Deliberately NOT the whole ChainProfile: the continuation table and the
 * magnitude-normalizer terms are sim-internal, and the render layer only
 * ever needs "how many pips, and where does the ladder steepen." Carried on
 * chainStart (to size the HUD's pip row and playback's per-window escalation
 * knee) and mirrored onto TickSnapshot (see TickSnapshot.chainShape's own
 * docstring for why a snapshot field is needed too, not just the event). */
export interface ChainShape {
  /** Profile id (e.g. "longFuseFlat") — debug only. */
  profileId: string;
  /** Two-word player-facing label (e.g. "long fuse") — the end card's Step 3
   * replacement for "affinity carried ×N", which stopped being true the
   * moment chainAffinity stopped touching magnitude (fightView.ts's
   * renderChainEndCard). */
  label: string;
  /** This hero's own fuse length — replaces cfg.chainMaxHits everywhere the
   * renderer used to read the global field. */
  maxHits: number;
  /** This hero's escalation knee — playback.ts's gap-dilation deepening
   * point, and the HUD spectacle ladder's own reference. */
  escalationKneeHit: number;
}

export type FightEvent =
  | { type: "attack"; t: number; side: Side; attackerId: string; targetId: string; damage: number }
  | { type: "heal"; t: number; side: Side; healerId: string; targetId: string; amount: number }
  /** The moment a hero's charge bar fills and it fires (2026-08-14 chain
   * rebuild — replaces heatFull/ignitionRoll/heatGift wholesale: there is no
   * candidate contest and no roll on whether it happens anymore, only the
   * backfire coin flip carried on this event). `backfire` is decided once,
   * here, and every chainHit/chainEnd for this chain repeats it — the
   * renderer reads it to pick gold burst vs. red implosion immediately,
   * with no advance telegraph. `shape` (2026-08-20) is this hero's resolved
   * chain shape for the fight — see ChainShape above. */
  | { type: "chainStart"; t: number; heroId: string; backfire: boolean; shape: ChainShape }
  /** `kind` distinguishes an attacker's escalating damage hit from a
   * healer's escalating heal (2026-08-14 chain rebuild — the chain always
   * repeats the hero's OWN action). `backfire` mirrors the owning
   * chainStart's flag, carried per-hit so the renderer doesn't have to track
   * chain state itself. `sourceId` is the hot hero (2026-08-14 — replaces
   * fightView.ts's currentHotHeroId back-channel; attribution now rides the
   * event instead of a renderer-side field). `targetId` is whoever the hit
   * or heal actually landed on — the enemy on a good damage chain, an ALLY
   * on a backfired one; the lowest-HP ally on a good heal chain, the enemy
   * on a backfired one. */
  | {
      type: "chainHit";
      t: number;
      hitIndex: number;
      damage: number;
      /** What this hit was ESCALATED to before any clamping — a healer's raw
       * heal before the chain-heal cap/room clamp, an attacker's raw
       * magnitude before applyDamageFrom clamps it against the target side's
       * remaining HP (2026-08-29, Phase 0 of the chain-targeting plan — see
       * fight.ts's resolveChainHit). `damage` keeps meaning what actually
       * went in; `intended - damage` is what the hit wasted. Reporting
       * only — this changes no sim behaviour. */
      intended: number;
      targetId: string;
      kind: "damage" | "heal";
      backfire: boolean;
      sourceId: string;
    }
  /** heroId is the hero who was hot during this chain. totalDamage/killedIds
   * are what the chain actually bought (or cost) the squad — see fight.ts's
   * chain-hit branch, which accumulates both alongside bonusHitsLanded.
   * `backfire` mirrors chainStart's flag.
   *
   * `reason` (2026-08-19 chain-ending pass) distinguishes the four causes
   * that used to collapse into one identical event — a played session
   * couldn't tell a chain that hit the cap from one that just missed, and
   * a chain that WON the fight rendered the same "broken" beat as one that
   * fizzled. See fight.ts's two emission sites. */
  | {
      type: "chainEnd";
      t: number;
      chainLength: number;
      heroId: string;
      totalDamage: number;
      killedIds: string[];
      backfire: boolean;
      /** "sourceDied" (2026-08-29, Phase 0 lockout fix — see fight.ts's new
       * post-loop sweep): the hot hero died mid-chain, to its own backfire or
       * to an enemy hit, before its next beat could roll a continuation. The
       * chain closes out right there instead of leaving hotHeroId stuck on a
       * dead hero for the rest of the fight. */
      reason: "miss" | "capped" | "noTarget" | "fightEnd" | "sourceDied";
      /** This hero's own fuse length (2026-08-20, per-hero-profile pass) —
       * replaces cfg.chainMaxHits for the "capped implies max length" check
       * and the render layer's cap-pip lookup. By end time hotHeroId is
       * already null and the snapshot's chainShape is gone, so this can't be
       * recovered from anywhere else. */
      maxHits: number;
      /** This hero's own shape label (e.g. "long fuse") — same reasoning as
       * maxHits above; the end card's showChainEnd needs it and can't read
       * it off anything else by end time. */
      label: string;
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
  /** The CURRENT chain's shape (2026-08-20, per-hero-profile pass) — null
   * whenever hotHeroId is null. Carried on the snapshot, not just on
   * chainStart, because updateChainHud is deliberately snapshot-driven (so
   * the HUD stays correct under pause/step/scrub — see fightView.ts) and
   * render() drains events AFTER updating the HUD from the snapshot each
   * tick; an event-only path would paint one stale-length frame on the
   * ignition tick itself. */
  chainShape: ChainShape | null;
  /** Running damage/heal total for the CURRENT chain — 0 whenever hotHeroId
   * is null. Snapshot-driven, not renderer-accumulated, so a persistent
   * chain HUD stays correct under pause/step/scrub. */
  chainDamageSoFar: number;
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
}
