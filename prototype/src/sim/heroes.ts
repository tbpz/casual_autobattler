import type { ChainProfile } from "./config.js";
import type { HeroState, Role, SideState } from "./types.js";

/**
 * The single source of hero definitions — the squad-pick screen, the
 * pre-fight read, the headless batch harness, and the CLI all build player
 * sides from this pool so they can never drift onto different stat blocks.
 */
export interface HeroDef {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  damage: number;
  attackIntervalSec: number;
  healPerBeat?: number;
  /** See types.ts's HeroState docstring — Ward's hybrid identity. */
  attacksWhileHealing?: boolean;
  /** See types.ts's HeroState docstring — now the VOLATILITY lever only
   * (2026-08-20, Step 3): higher affinity means a bigger backfire chance
   * (config.ts's backfireChanceFor), nothing about payoff size. */
  chainAffinity: number;
  /** This hero's chain SHAPE (2026-08-20, Step 3 — see config.ts's
   * ChainProfile and this file's CHAIN_PROFILES). The mechanical identity
   * lever that replaced chainAffinity-as-magnitude: heroes differ in how
   * long their fuse runs and how back-loaded the escalation is, not in how
   * big any given hit lands. */
  chainProfile: ChainProfile;
  /** This hero's absolute expected-net-chain-value target (2026-08-20, Step
   * 3 — see CHAIN_EV_TARGET_DAMAGE/HEAL below and config.ts's
   * chainMagnitudeScaleAbsolute). Every attacker converges on
   * CHAIN_EV_TARGET_DAMAGE, every healer on CHAIN_EV_TARGET_HEAL, regardless
   * of its own damage/healPerBeat stat — this is what makes "no hero has a
   * bigger chain" literally true, not just softened. */
  chainMagnitudeTarget: number;
  /** One line for the squad-pick screen — what picking this hero buys you,
   * beyond its raw numbers. */
  identity: string;
}

/**
 * Per-hero chain profiles (2026-08-20, Step 3 of the "chain choice: make the
 * pick a shape, not a size" plan — see DECISIONS.md). Chain magnitude used to
 * be chainAffinity times a hero's own damage/healPerBeat, which meant one
 * pole of every pick (low affinity, or low damage) was structurally a
 * SMALLER cascade — less of the exact thing the game promises, a tax rather
 * than a tradeoff. These profiles replace that: every hero's chain converges
 * on the SAME expected net value within its kind (chainMagnitudeTarget,
 * below), so no pick is "less chain." What differs is SHAPE — how long the
 * fuse runs (maxHits, and how fast continuation odds decay) and how
 * back-loaded the escalation is (escalationKneeHit/StepMultiplier) — a 2x2
 * over fuse length and escalation steepness for the four attackers:
 *
 *              flat escalation        steep escalation
 *  long fuse   Bracer (grinds,        Rook (weak early, huge
 *              many similar hits)     if it survives the length)
 *  short fuse  Vex (few hits,         Hollow (three hits that
 *              front-loaded)          land like six)
 *
 * The two healers (Cairn, Ward) are both kept LONG-FUSE AND FLAT deliberately
 * — see chainHealMaxFractionOfTargetMaxHp's own docstring (config.ts): a
 * chain heal is clamped against the target's own maxHp, so a short, steep
 * healer profile would earn a large per-hit scale (to hit the shared target
 * in fewer hits) whose late hits then clamp away, silently under-realizing
 * its analytic EV in exactly the place the equal-EV design can't see it. A
 * long, flat curve keeps every hit's raw magnitude well under the clamp
 * ceiling (see checks/chaindist.ts's heal-clamp guard) so the analytic
 * target is what actually lands. Cairn and Ward differ from each other only
 * in degree (Cairn's odds are a touch higher, Ward's fuse a touch longer to
 * compensate for its higher backfire chance) — their real differentiation is
 * risk (chainAffinity), same as the rest of the pool.
 *
 * Values are strawmen for the batch harness to move, same as everywhere else
 * in this file — chosen by direct computation (not hand-derived) against
 * config.ts's expectedChainUnits/expectedNetChainUnits/
 * chainMagnitudeScaleAbsolute, then checked against chainHealMaxFractionOfTargetMaxHp's
 * clamp ceiling for the two healers before being locked in.
 */
export const CHAIN_PROFILES = {
  longFuseFlat: {
    id: "longFuseFlat",
    label: "long fuse",
    maxHits: 10,
    escalationKneeHit: 8,
    escalationStepMultiplier: 1.3,
    continuation: [0.78, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.9, 0.9],
  },
  shortFuseSteep: {
    id: "shortFuseSteep",
    label: "short fuse",
    maxHits: 3,
    escalationKneeHit: 1,
    escalationStepMultiplier: 5,
    continuation: [0.6, 0.55],
  },
  longFuseSteep: {
    id: "longFuseSteep",
    label: "back-loaded",
    maxHits: 9,
    escalationKneeHit: 5,
    escalationStepMultiplier: 4.5,
    continuation: [0.72, 0.76, 0.8, 0.82, 0.84, 0.85, 0.85, 0.85],
  },
  shortFuseFlat: {
    id: "shortFuseFlat",
    label: "front-loaded",
    maxHits: 4,
    escalationKneeHit: 4,
    escalationStepMultiplier: 2,
    continuation: [0.65, 0.65, 0.6],
  },
  healerSteady: {
    id: "healerSteady",
    label: "steady",
    maxHits: 12,
    escalationKneeHit: 12,
    escalationStepMultiplier: 1,
    continuation: [0.85, 0.86, 0.87, 0.88, 0.89, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  },
  healerHybrid: {
    id: "healerHybrid",
    label: "hybrid",
    maxHits: 16,
    escalationKneeHit: 16,
    escalationStepMultiplier: 1,
    continuation: [0.82, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89],
  },
} as const satisfies Record<string, ChainProfile>;

/** Every attacker's chain converges on this absolute expected-net-damage
 * value (2026-08-20, Step 3); every healer on CHAIN_EV_TARGET_HEAL below.
 * Anchored to the POOL MEAN of the old (pre-Step-3) per-hero expected-net
 * chain magnitude — Bracer 56.8, Hollow 67.7, Rook 69.7, Vex 108.4, mean
 * ~75.7 — rounded, so overall difficulty starts centered near its old
 * baseline rather than dragging every hero up to Vex's old (highest) payoff.
 * Re-batch (npm run check:chaindist / npm run batch) before trusting this
 * number if the pool's stat blocks or backfire tuning move. */
export const CHAIN_EV_TARGET_DAMAGE = 76;
/** See CHAIN_EV_TARGET_DAMAGE above. Lower than the naive old-baseline mean
 * (~43) — capped instead by the heal-clamp guard (checks/chaindist.ts):
 * Ward's own profile is the binding constraint (its higher backfire chance
 * demands a bigger scale for the same net target), so this value is the
 * largest shared heal target that still keeps BOTH healers' last-hit raw
 * magnitude comfortably under chainHealMaxFractionOfTargetMaxHp's ceiling on
 * a normal-sized body, not a value picked to match the old system. */
export const CHAIN_EV_TARGET_HEAL = 28;

/**
 * Re-cut 2026-08-08 (player verdict: the pool was a dominance ladder, not a
 * set of tradeoffs — Vex out-DPSed Rook for near-free, any comp with both
 * Cairn and Ward lost 100% of the time since two non-attacking supports is a
 * guaranteed loss, and squad choice barely moved the cascade's odds at all).
 * Re-tuned again 2026-08-08 after that first re-cut turned out to still be a
 * dominance ladder in disguise: `chainAffinity` was multiplying against each
 * hero's raw throughput in BOTH the heat term (heatWeight * dps * affinity)
 * and the chain-damage term (damage * affinity * N) rather than being an
 * orthogonal axis, so Vex's higher damage stat alone made it out-DPS,
 * out-heat, AND out-chain Rook despite Rook's higher affinity — a full
 * 20-squad batch sweep found 3 near-unloseable comps (bracer+vex+cairn,
 * vex+cairn+ward, bracer+vex+ward, all >=98% run completion) plus 2 more
 * near-unloseable by a different route (bracer+rook+ward, rook+cairn+ward,
 * both >=93%, via Ward's attacksWhileHealing beating Cairn on total
 * throughput for only 35 less HP) — see DECISIONS.md's entry on this pass
 * for the full root-cause writeup.
 *
 * The operative principle as of 2026-08-08: within a role, every hero gets
 * roughly the SAME throughput budget (DPS for damage, heal-per-second for
 * support), and differs only in SHAPE — burst size vs. cadence, fragility,
 * and `chainAffinity`.
 *  - tank: Bracer is the wall (low affinity — a quiet chain either way);
 *    Hollow is fragile but chains hard (high affinity) — a real
 *    HP-for-ceiling trade, in both directions now.
 *  - damage: Rook has the pool's highest affinity — reliably escalating
 *    chains. Vex is burst, at near-parity DPS with Rook (was 17.14 vs 6.67,
 *    then a first pass claimed ~7.2 vs 6.67 without the stat block actually
 *    landing there — it was still 8.67 vs 6.67, a real +30%, verified
 *    2026-08-09 by re-deriving DPS from the stat block rather than trusting
 *    this comment. Re-cut to damage:11/attackIntervalSec:1.5 = 7.33 vs 6.67,
 *    trimming per-hit damage this time rather than cadence, so the burst
 *    identity survives the nerf without also softening the chain
 *    multiplier, which reads off the same per-hit damage stat).
 *
 *    2026-08-19 correction (affinity-as-risk pass, same discipline as the
 *    2026-08-09 note above — verified by re-deriving from the stat block,
 *    not trusted from memory): "Rook has the pool's highest affinity —
 *    reliably escalating chains" does NOT mean Rook has the pool's biggest
 *    chain. Chain magnitude is damage*chainAffinity (see chainCoefficient
 *    below), and Vex's higher damage (11 vs 6) wins out over Rook's higher
 *    affinity (1.0 vs 1.4): Vex 11.0 > Rook 8.4, a ~31% gap in Vex's favor.
 *    Rook's real distinguishing trait is backfire RISK (highest affinity =
 *    highest backfireChanceFor, config.ts), not payoff size — its identity
 *    string below was corrected to match.
 *  - support: Cairn is the pure safety net (lowest affinity — its heal
 *    chain is the mildest in the pool, good or bad) with the pool's highest
 *    heal throughput. Ward attacks AND heals on the same beat
 *    (attacksWhileHealing), so a two-support comp is still viable, but its
 *    healPerBeat is cut so that hybrid flexibility and its own moderate
 *    affinity cost something instead of beating Cairn on every axis for
 *    free.
 *
 *    2026-08-19 finding, NOT yet acted on (out of scope for the
 *    affinity-as-risk pass — a throughput/HP rebalance, not a pricing fix):
 *    batch-measured (n=3000, 4 matched pairs holding tank+damage fixed,
 *    swapping only the support) that Cairn beats Ward in every pairing
 *    despite Cairn's lower affinity — the intended "costs something instead
 *    of beating Cairn for free" trade does not currently hold either
 *    direction; Ward is strictly behind, not a real tradeoff. Left as a
 *    named, deferred gap — see the affinity-as-risk plan's Context section.
 * Values are strawmen for the batch harness (npm run batch --squad <combo>)
 * to move, same as everywhere else in this file.
 *
 * 2026-08-14 chain rebuild (see DECISIONS.md): heatGift is gone — charge is
 * private to each hero — and `chainAffinity` now scales ONLY payoff/backfire
 * magnitude, not accrual speed (every hero's meter fills at the same rate).
 * See config.ts's FightConfig docstring and types.ts's HeroState.chainAffinity.
 *
 * 2026-08-15 (chain-payoff-axis pass — see DECISIONS.md and
 * prototype/CHAIN_AXIS_PLAN's Chunk 2): `chainAffinity` compressed from a
 * 0.3-1.6 spread (~5.3x) to 0.7-1.4 (2x) — the old spread made "how big will
 * this chain be" fully knowable at DRAFT time (a Cairn ignition was always a
 * dud, a Rook ignition was always a jackpot), so the suspense was spent
 * before the dice were even rolled. Affinity now differentiates heroes
 * without gating the mechanic on/off; the spread that made a cascade feel
 * unpredictable moved onto chain LENGTH instead, which is decided live (see
 * config.ts's chainEscalationKneeHit/StepMultiplier and
 * fight.ts's chainAttackMagnitude) — a length-7 chain now escalates roughly
 * 40x over a length-1 chain, regardless of hero, so no chain is a dud and no
 * hero is a guaranteed jackpot either.
 *
 * 2026-08-20 (Step 3 of the "chain choice: make the pick a shape, not a
 * size" plan — see DECISIONS.md): superseded above. A played verdict found
 * that even with chainAffinity compressed and length the dominant axis, the
 * damage pair still had a strict winner — Vex out-pipped Rook on chain
 * output (11 dmg x 1.0 vs 6 dmg x 1.4 = 11.0 vs 8.4) AND carried less
 * backfire risk (12% vs 18%) AND had higher DPS, so "pick the biggest bar"
 * was simply correct play, not a misread. `chainAffinity` no longer touches
 * magnitude AT ALL now — see its own docstring above — and every hero's
 * chain converges on the same absolute expected-net-value within its kind
 * (CHAIN_EV_TARGET_DAMAGE/HEAL, chainMagnitudeTarget below). The pool's
 * per-hero shape (CHAIN_PROFILES) is now the only thing chain choice buys:
 * a different curve, never a bigger or smaller one. Every hero's
 * `damage`/`healPerBeat`/DPS stat below still matters for NORMAL combat
 * (soaking, dealing, healing outside the chain) — only the chain formula
 * itself stopped reading them.
 */
export const PLAYER_HERO_POOL: HeroDef[] = [
  {
    id: "bracer", name: "Bracer", role: "tank", maxHp: 195, damage: 7, attackIntervalSec: 1.4,
    chainAffinity: 0.75,
    chainProfile: CHAIN_PROFILES.longFuseFlat,
    chainMagnitudeTarget: CHAIN_EV_TARGET_DAMAGE,
    identity: "The wall. Long fuse, flat growth — its chain rarely ends fast, and rarely ends small either.",
  },
  {
    id: "hollow", name: "Hollow", role: "tank", maxHp: 180, damage: 6, attackIntervalSec: 1.1,
    chainAffinity: 1.3,
    chainProfile: CHAIN_PROFILES.shortFuseSteep,
    chainMagnitudeTarget: CHAIN_EV_TARGET_DAMAGE,
    identity: "Fragile, and its chain is short — but three hits can land like six, for better or worse.",
  },
  {
    id: "rook", name: "Rook", role: "damage", maxHp: 85, damage: 6, attackIntervalSec: 0.9,
    chainAffinity: 1.4,
    chainProfile: CHAIN_PROFILES.longFuseSteep,
    chainMagnitudeTarget: CHAIN_EV_TARGET_DAMAGE,
    identity: "Highest affinity in the pool — a real gamble on backfire risk. Its chain is back-loaded: weak early, huge if it survives the length.",
  },
  {
    id: "vex", name: "Vex", role: "damage", maxHp: 70, damage: 11, attackIntervalSec: 1.5,
    chainAffinity: 1.0,
    chainProfile: CHAIN_PROFILES.shortFuseFlat,
    chainMagnitudeTarget: CHAIN_EV_TARGET_DAMAGE,
    identity: "Explosive burst damage. Front-loaded chain — fires off a few big hits fast, at a middling backfire risk to match.",
  },
  {
    id: "cairn", name: "Cairn", role: "support", maxHp: 110, damage: 1, attackIntervalSec: 1.2, healPerBeat: 7,
    chainAffinity: 0.7,
    chainProfile: CHAIN_PROFILES.healerSteady,
    chainMagnitudeTarget: CHAIN_EV_TARGET_HEAL,
    identity: "The safety net. Chains a heal instead of an attack — lowest backfire risk in the pool, and a long, steady fuse.",
  },
  {
    id: "ward", name: "Ward", role: "support", maxHp: 92, damage: 3, attackIntervalSec: 1.0, healPerBeat: 3,
    attacksWhileHealing: true, chainAffinity: 1.15,
    chainProfile: CHAIN_PROFILES.healerHybrid,
    chainMagnitudeTarget: CHAIN_EV_TARGET_HEAL,
    identity: "Heals AND swings on the same beat — its chain heal runs just as long as Cairn's, at a real backfire risk to match.",
  },
];

/** The highest/lowest chainAffinity in the pool — used by fightView.ts's
 * ignition-burst visual scale to size the ignition tell's intensity to how
 * volatile the firing hero is.
 *
 * 2026-08-20 (Step 3): this used to be a KNOWN GAP — the burst scaled off
 * raw chainAffinity while the pick-screen pips (and the sim's actual
 * magnitude formula) had moved on to the true chain-output coefficient
 * (damage*chainAffinity), so a low-affinity, high-damage hero's ignition
 * visually undersold its real payoff. That gap is gone now, not patched:
 * chainAffinity no longer touches magnitude at all — it IS volatility, full
 * stop — so a burst sized off it is an honest read of "how big a gamble is
 * this hero going hot," exactly what it always visually implied. The old
 * chainCoefficient/MAX_CHAIN_COEFFICIENT_ATTACKER/HEALER pick-screen pips
 * are gone too (heroPickShared.ts's chainShapeSparkline replaces them) —
 * payoff is equalized now, so a pip meter ranking heroes on magnitude would
 * be actively misleading rather than merely imprecise. */
export const MAX_CHAIN_AFFINITY = Math.max(...PLAYER_HERO_POOL.map((h) => h.chainAffinity));
/** The lowest chainAffinity in the pool (2026-08-15) — paired with
 * MAX_CHAIN_AFFINITY so the renderer can normalize an ignition tell's
 * intensity to "how loud is this hero's ignition, relative to the pool's
 * range" without importing the whole pool (see render/fightView.ts's
 * showChainStart). */
export const MIN_CHAIN_AFFINITY = Math.min(...PLAYER_HERO_POOL.map((h) => h.chainAffinity));

/** The working accept-default FIELDED squad — the comfortable comp: one
 * tank, one damage, one support, none of them the greedy pick in their role.
 * Still used by the ad-hoc single-fight CLI paths (batch/cli.ts's `fight`
 * subcommand) and by checks that test one fight in isolation, outside the
 * run-level roster below. */
export const DEFAULT_PLAYER_ROSTER_IDS = ["bracer", "rook", "cairn"];

/** The working accept-default DRAFT (2026-08-09 roster/bench pass — see
 * roster.ts and config.ts's rosterSize): 5 of the pool's 6, leaving Vex
 * (the explosive-burst outlier) as the one hero a player has to actively
 * choose to bring in rather than getting for free. */
export const DEFAULT_DRAFT_ROSTER_IDS = ["bracer", "hollow", "rook", "cairn", "ward"];

/** Tank -> damage -> support fielding priority — exported for roster.ts's
 * defaultFieldPick (the accept-default fielding order) as well as
 * makePlayerSide's own sort below, so the two never drift apart. */
export const ROLE_SORT_PRIORITY: Record<Role, number> = { tank: 0, damage: 1, support: 2, bruiser: 0, grunt: 1 };

export function findHeroDef(id: string): HeroDef {
  const def = PLAYER_HERO_POOL.find((h) => h.id === id);
  if (!def) throw new Error(`unknown hero id: ${id}`);
  return def;
}

export function makeHeroState(def: HeroDef, instanceId: string, phase = 0): HeroState {
  return {
    id: instanceId,
    name: def.name,
    role: def.role,
    maxHp: def.maxHp,
    hp: def.maxHp,
    alive: true,
    damage: def.damage,
    attackIntervalSec: def.attackIntervalSec,
    // phase in [0,1) spreads a side's first beats across one interval so
    // same-cadence heroes don't all act on the identical tick (2026-08-06 —
    // see DECISIONS.md's per-hero-bars entry for why simultaneous beats were
    // a legibility problem: six lunges/flinches firing in the same 250ms).
    nextAttackT: def.attackIntervalSec * (1 - phase * 0.8),
    healPerBeat: def.healPerBeat,
    attacksWhileHealing: def.attacksWhileHealing,
    chainAffinity: def.chainAffinity,
    chainProfile: def.chainProfile,
    chainMagnitudeTarget: def.chainMagnitudeTarget,
    dealt: 0,
    soaked: 0,
    restored: 0,
    hitsTaken: 0,
    holding: def.role === "tank",
    charge: 0,
  };
}

/** Builds the player SideState from chosen hero ids, sorted tank-first so the
 * tank draws the front-row visual slot (targeting itself is weighted-random —
 * see fight.ts — not positional, but the front row is still where a tank
 * "belongs" on screen). */
export function makePlayerSide(heroIds: string[] = DEFAULT_PLAYER_ROSTER_IDS, dpsBonus = 0): SideState {
  const heroes = heroIds
    .map((id, i) => makeHeroState(findHeroDef(id), `p${i}_${id}`, i / heroIds.length))
    .sort((a, b) => ROLE_SORT_PRIORITY[a.role] - ROLE_SORT_PRIORITY[b.role]);
  return { heroes, dpsBonus };
}
