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
  /** See types.ts's HeroState docstring — the squad-pick cascade lever. */
  chainAffinity: number;
  /** One line for the squad-pick screen — what picking this hero buys you,
   * beyond its raw numbers. */
  identity: string;
}

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
 */
export const PLAYER_HERO_POOL: HeroDef[] = [
  {
    id: "bracer", name: "Bracer", role: "tank", maxHp: 195, damage: 7, attackIntervalSec: 1.4,
    chainAffinity: 0.75,
    identity: "The wall. Steady, unglamorous — even a short chain from Bracer is worth watching; a long one isn't small at all.",
  },
  {
    id: "hollow", name: "Hollow", role: "tank", maxHp: 180, damage: 6, attackIntervalSec: 1.1,
    chainAffinity: 1.3,
    identity: "Fragile — but chains hard when it fires, for better or worse.",
  },
  {
    id: "rook", name: "Rook", role: "damage", maxHp: 85, damage: 6, attackIntervalSec: 0.9,
    chainAffinity: 1.4,
    identity: "Highest affinity in the pool — a real gamble: it fires often, and when it goes wrong it goes wrong loud.",
  },
  {
    id: "vex", name: "Vex", role: "damage", maxHp: 70, damage: 11, attackIntervalSec: 1.5,
    chainAffinity: 1.0,
    identity: "Explosive burst damage — its chain hits harder than its middling affinity suggests, at a middling backfire risk to match.",
  },
  {
    id: "cairn", name: "Cairn", role: "support", maxHp: 110, damage: 1, attackIntervalSec: 1.2, healPerBeat: 7,
    chainAffinity: 0.7,
    identity: "The safety net. Chains a heal instead of an attack — lowest affinity, but a long chain still heals for real; a backfire still stings.",
  },
  {
    id: "ward", name: "Ward", role: "support", maxHp: 92, damage: 3, attackIntervalSec: 1.0, healPerBeat: 3,
    attacksWhileHealing: true, chainAffinity: 1.15,
    identity: "Heals AND swings on the same beat — its chain is a heal, moderate affinity either way.",
  },
];

/** The actual chain-output magnitude for one hero: damage*chainAffinity for
 * an attacker, healPerBeat*chainAffinity for a healer — the exact terms
 * fight.ts's chainAttackMagnitude/resolveChainHit multiply against the
 * escalation curve (2026-08-19, affinity-as-risk pass — see
 * DECISIONS.md/STATE.md's attribution investigation). chainAffinity ALONE is
 * NOT this number: Vex (11 dmg x 1.0 = 11.0) truly out-chains Rook (6 dmg x
 * 1.4 = 8.4) by ~31%, which is exactly what the pre-2026-08-19 pip meter
 * (normalized against raw affinity) got backwards — see
 * render/heroPickShared.ts's chainOutputPips, the fix. Healer and attacker
 * coefficients are NOT directly comparable to each other (damage vs HP
 * restored are different units) — this function exists to rank heroes
 * WITHIN their own kind, same convention the pip meter already follows. */
export function chainCoefficient(h: Pick<HeroDef, "damage" | "healPerBeat" | "chainAffinity">): number {
  return (h.healPerBeat ?? h.damage) * h.chainAffinity;
}

/** The highest chain-output coefficient in the pool (see chainCoefficient
 * above) — heroPickShared.ts's chainOutputPips normalizes its pip display
 * against this so the pips stay correct if the pool changes. Supersedes the
 * pre-2026-08-19 MAX_CHAIN_AFFINITY-normalized pip display, which ranked
 * heroes on the wrong number. */
export const MAX_CHAIN_COEFFICIENT = Math.max(...PLAYER_HERO_POOL.map(chainCoefficient));

/** The highest chainAffinity in the pool — still used by fightView.ts's
 * ignition-burst visual scale (a KNOWN GAP, not yet switched to the
 * coefficient above — see the affinity-as-risk plan's "deliberately out of
 * scope" note: HeroSnapshot doesn't carry damage/healPerBeat, so that visual
 * can't compute the coefficient without a small sim-level schema change).
 * NOT used for the pick-screen pips anymore — see MAX_CHAIN_COEFFICIENT. */
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
