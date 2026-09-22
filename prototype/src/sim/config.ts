/**
 * Every tunable constant for the fight and run sims, in one place.
 * Source of truth: this file and sim/heroes.ts are the sole authority for
 * current tuning constants (DECISIONS.md 2026-08-08); DECISIONS.md explains
 * why a value is what it is, but a number inside a DECISIONS.md entry is
 * evidence as of that entry's date only, never a current setting. The
 * original beat-sheet/PRD-table draft (archive/FIGHT_SCRIPT.md) and the
 * original build doc (archive/PROTOTYPE_PLAN.md) are both retired — see
 * their retirement headers for what superseded each. Per-hero stats (damage,
 * HP, attack cadence) superseded the old side-level DPS budgets (2026-08-04
 * legibility rewrite, DECISIONS.md): the fight now has actors, not a curve,
 * so "HP and DPS as side-level budgets divided among N" is superseded by
 * per-hero stat blocks in sim/heroes.ts and here. Values here are strawmen
 * meant to move by playing and by the batch harness (npm run batch).
 *
 * Readings this file fixes that the docs left implicit:
 *  1. A normal attack is single-target. The attacking side's hero targets the
 *     front-most living hero on the opposing side — deterministic, so the
 *     player can always find and kill the visible threat (the enemy bruiser)
 *     on purpose. The defending side's individual target is instead picked by
 *     *weighted-random* selection (fight.ts's pickWeightedTarget) — a tank
 *     draws more incoming attacks than a squishy ally, but not every attack,
 *     every fight, deterministically. This is what keeps a body's death
 *     contingent rather than baked into the arithmetic: the AGGREGATE pool
 *     drains at a fixed, tunable rate (so the dip and the eligibility gate
 *     stay predictable), while WHO specifically falls stays genuinely
 *     unpredictable fight to fight. Chain bonus hits keep the old
 *     concentrated-with-retarget rule (archive/FIGHT_SCRIPT.md §3 is
 *     explicit that a bonus hit is focused and retargets on a kill).
 *  2. Support heroes act on their own attack beat like everyone else, but
 *     heal their lowest-HP living ally instead of attacking — unless
 *     attacksWhileHealing is set (Ward), in which case the heal and the
 *     attack both happen on the same beat.
 * (Reading 2, "the gatePoolFraction denominator is fixed at fight start," is
 * gone as of the 2026-08-07 heat rebuild below — there is no pool-fraction
 * gate left to fix a denominator for.)
 */

/**
 * 2026-08-09 (boring-middle root-cause pass — the player's report was "safe
 * builds win 5/5 with no mid-run tension, and only ~3 of 20 squads are
 * viable"). DeathPolicy is GONE: the player explicitly chose to keep death
 * permanent for the run rather than soften it (see DECISIONS.md's entry on
 * this pass) — "onlyOnLoss" (full revival every win) was only ever a
 * diagnostic A/B variant used to isolate RC4 (the run's difficulty cliff was
 * short-handedness, not permanence — measured via `--death onlyOnLoss`:
 * bracer+rook+cairn's fight-5 win rate rose from 27.8% to 54.5% just from
 * always fielding 3, with no other change), never a real design option. The
 * fix that measurement pointed to is roster.ts's draft/field split: death
 * stays permanent, but the roster is drafted wider (rosterSize, below) than
 * what's fielded each fight (playerN), so a death shrinks your OPTIONS
 * without ever leaving you fielding fewer than a full, fair squad.
 */

// EnemyArchetype (a single "the bruiser" / "the grunt" stat block shared by
// every fight, only scaled bigger) is GONE (2026-08-09, encounter-table
// pass — see sim/encounters.ts's top docstring). Each of the run's 5 fights
// now authors its own enemy composition and stat blocks directly in
// encounters.ts's ENCOUNTERS table — that's what makes fight 1 ask a
// different question than fight 4, which a single scaled archetype
// structurally could not.

export interface FightConfig {
  /** Ticks per second. archive/FIGHT_SCRIPT.md doesn't specify a tick rate;
   * 20/s gives smooth meter motion without over-resolving hero attack
   * cadences below. */
  tickRate: number;
  /** Failsafe only — fights resolve by wipe, not by this clock. If a fight
   * somehow runs this long (should not happen given the stat blocks below),
   * it resolves by HP fraction so the sim can never hang. */
  maxFightSec: number;

  /** A tank stops holding aggro (targeting weight drops to
   * brokenTankTargetWeight) once its own HP falls to/below this fraction of
   * its own maxHp. */
  tankBreakFraction: number;
  /** Hysteresis: a broken tank resumes holding once healed back up to this
   * fraction, so a healer's save is a real, visible event rather than the
   * break/recover tell flickering every tick near the threshold. Must be
   * greater than tankBreakFraction. */
  tankRecoverFraction: number;

  /**
   * 2026-08-14 chain rebuild (see DECISIONS.md) — replaces the 2026-08-07/08
   * "heat" mechanism wholesale. That system stacked three RNG layers (who
   * becomes the candidate, whether ignition fires at all, how long the chain
   * runs) plus heat silently flowing between allies via heatGift — the
   * player could not form a model of it and the NEXT tag reshuffling read as
   * noise, not tension (playtest verdict).
   *
   * The rule now fits one sentence: every hero has a charge meter that fills
   * from doing its own job (dealt/soaked/restored, weighted by
   * chargeWeightDealt/Soaked/Restored below); the instant it crosses
   * chargeThreshold, THAT hero fires — no contest, no roll on whether it
   * happens. `chainAffinity` no longer touches accrual rate (every hero
   * charges at the same pace, so two bars at 80% mean the same thing), only
   * payoff size. There is no heatGift — charge is private to each hero. And
   * charge PERSISTS across the whole run (see types.ts's HeroState.charge
   * and roster.ts) instead of zeroing every fight, so a near-full bar is a
   * real strategic asset at field-pick time, not a coin flip.
   *
   * What fires is still a coin flip: see backfireChance below.
   */
  chargeWeightDealt: number;
  chargeWeightSoaked: number;
  chargeWeightRestored: number;
  /** The highest-charge living hero fires the instant its charge crosses
   * this. Higher than the old heatThreshold (110) — firing is no longer
   * gated behind a separate ignition roll, and charge now persists between
   * fights rather than resetting, both of which push toward more total
   * fires unless the bar itself asks for more. See the default value's own
   * comment (below, DEFAULT_FIGHT_CONFIG) for the batch-measured reasoning
   * behind landing at 220 specifically, not the initially-guessed 330. */
  chargeThreshold: number;
  /** The coin flip at the moment a chain fires (2026-08-14 chain rebuild):
   * this fraction of the time the chain aims at the wrong side instead of
   * the right one — an attacker's escalating hits land on its OWN team, a
   * healer's escalating heal restores the ENEMY. Same mechanic, same
   * magnitude formula (hero.chainAffinity scales a backfire exactly as it
   * scales a real payoff), just aimed backwards — see fight.ts's chain
   * resolution. No advance telegraph; the player finds out which way it
   * went only when it fires (colour reads instantly — gold burst vs red
   * implosion).
   *
   * 2026-08-19 (affinity-as-risk pass — see DECISIONS.md/STATE.md's
   * attribution investigation): no longer a flat constant. Before this pass,
   * chainAffinity scaled payoff/backfire MAGNITUDE symmetrically while every
   * hero shared this same flat chance — at those odds, symmetric magnitude
   * is NET POSITIVE expected value, so more affinity was strictly more EV,
   * never a real tradeoff (clearest case: Hollow vs Bracer was +73%
   * affinity, +9% DPS, for only -7.7% maxHp — an upgrade, not a choice). Use
   * backfireChanceFor(cfg, chainAffinity) below instead of reading this
   * field directly. */
  backfireChanceBase: number;
  /** See backfireChanceFor below — the risk half of "more affinity, more
   * volatility." Additional backfire chance per +1.0 of chainAffinity above
   * (or below) 1.0. Positive: more affinity means more real risk. Anchored
   * at 1.0 rather than the pool's actual min/max so this file stays
   * pool-agnostic (sim/config.ts must not import sim/heroes.ts's specific
   * stat block). */
  backfireChanceAffinitySlope: number;

  /**
   * The enemy bruiser's telegraphed heavy hit (2026-08-07 rebuild) — the
   * mechanism that makes fragility cost something. Every windupIntervalSec
   * the bruiser stops its normal attacks, telegraphs against a
   * weighted-random target for windupTelegraphSec (same targeting rule as a
   * normal enemy attack — a holding tank draws it tankTargetWeight-to-1),
   * then lands windupDamageMultiplier x its own base damage on whoever it
   * locked onto. A telegraph is a dread beat with no player input required —
   * you watch to see if the named hero survives it.
   *
   * 2026-08-27 (CLOCK/WOUNDED removal — see DECISIONS.md): this is now the
   * ONLY in-fight escalating threat. Nothing scales enemy damage over the
   * course of a fight any more; a wind-up hits for the same amount at t=5s
   * and t=45s.
   */
  windupIntervalSec: number;
  windupTelegraphSec: number;
  windupDamageMultiplier: number;

  /** Chain PRD by bonus-hits-so-far: index 0 = chance the *first* bonus hit
   * after ignition lands, last entry repeats (capped) beyond that. */
  chainChanceByHitsSoFar: number[];
  /** Bonus hit N magnitude = round(base * chainHitMultiplier *
   * chainEscalationFactor(N)), where base is the per-effect constant for
   * whichever ChainEffect the hot hero carries (chainStrikeAllBase and the
   * rest, below). Applies identically whether the chain is aimed right or
   * backfiring (2026-08-14 chain rebuild) — a backfire is exactly as loud as
   * the payoff it replaces.
   *
   * No hero term. `chainAffinity` was dropped from this formula by the
   * 2026-09-13 rebuild (heroes differ by EFFECT now, not by magnitude) and
   * is purely the backfire-risk lever — see backfireChanceFor. The base was
   * also the hot hero's own damage/healPerBeat stat before that rebuild;
   * it is a per-effect constant now. This docstring claimed both until
   * 2026-09-21. */
  chainHitMultiplier: number;
  /** Hits 1..chainEscalationKneeHit escalate linearly (factor = hitIndex).
   * Beyond the knee, each additional hit adds chainEscalationStepMultiplier
   * instead of 1 — see chainEscalationFactor() below.
   *
   * At the current knee of 1 the whole curve is the "beyond" branch, so the
   * factor is simply 1 + (hitIndex - 1) * step — a single near-flat slope
   * with no knee at all (2026-09-21, see chainEscalationStepMultiplier). The
   * knee is kept rather than removed because the formula still needs a hinge
   * point and a future pass may want one again. It no longer aligns with
   * chainFullTellThreshold; render/playback.ts, which used to read this for
   * its slow-motion pacing, reads that threshold directly now. */
  chainEscalationKneeHit: number;
  /** See chainEscalationKneeHit above.
   *
   * 2026-09-21: 3 -> 0.3, with knee 4 -> 1 and every per-effect base raised
   * ~3x to hold a full 7-rung chain at the same total. The old pair gave a
   * 40x spread between a 1-rung and a full chain, which meant 58% of chains
   * — the ones that stop at one or two rungs — delivered almost nothing: a
   * 2-rung Rook chain did 18 damage against bruisers of 90-310 HP. The
   * current pair puts that at 42 and the spread at 13x. Measured cost: chain
   * length's share of a fight's outcome variance fell from 47% to 31%, and
   * run completion rose 15.1% -> 18.1%. See DECISIONS.md this date. */
  chainEscalationStepMultiplier: number;
  /** Hard cap on chain length — added after the first batch pass found
   * chains running to 15-16 hits: chainChanceByHitsSoFar's last entry (0.9)
   * repeats forever once past the table, so the geometric tail averages 10
   * MORE hits past that point with no natural stop.
   *
   * The original reason was runaway MULTIPLICATIVE escalation: a chain that
   * got going deleted the enemy outright and the outcome collapsed to "did
   * ignition fire." The 2026-09-21 flattening removes that pressure, so this
   * cap may no longer be load-bearing — it is left untouched and unexamined
   * by that pass rather than assumed still necessary. */
  chainMaxHits: number;
  /** Global multiplier applied on top of chainChanceByHitsSoFar (see
   * chainContinuationChance below). Default 1 (inert). Exists so a check that
   * wants to disable continuation entirely (checks/beatsheet.ts,
   * checks/projection.ts — both zero this alongside chainChanceByHitsSoFar)
   * has one knob for it, separate from the table itself. */
  chainContinuationScale: number;
  /** While a hero is hot, its next-beat advance is multiplied by this
   * (< 1 = faster) instead of the full attackIntervalSec — the chain
   * visibly accelerates the hot hero's cadence. */
  hotBeatIntervalFactor: number;

  /** Chain length at/above which the render layer shows the FULL spectacle
   * (shake, escalating font, loud callout — fightView.ts's chainPopupScale,
   * arena shake and end-card, all keyed on rung COUNT rather than on the
   * damage number). Also read by render/playback.ts as the hit where its
   * slow-motion between chain beats deepens (2026-09-21 — it read
   * chainEscalationKneeHit until that date, which the curve flattening made
   * meaningless). Deliberately the same threshold batch/report.ts's
   * chain-length-5-plus fraction already tracks, so "how rare is the big
   * moment" and "how rare is the show" stay the same knob.
   *
   * Note (2026-09-21): the mechanical jump this was aligned to is gone. Under
   * the flattened curve rung 5 is only ~16% bigger than rung 4, not ~75%. The
   * tier still marks something real — a chain reaching 5 is ~32% likely and
   * has delivered ~8x a 1-rung chain in total — but nothing in the check
   * suite would catch it if the shake starts to feel unearned. That is a
   * played judgement, not a measurable one. */
  chainFullTellThreshold: number;

  /** Weight multiplier applied to a tank's chance of being the enemy's
   * chosen target while holding (HP above tankBreakFraction), relative to
   * weight 1 for every other role. Also governs a wind-up's target pick. */
  tankTargetWeight: number;
  /** Same, but for a tank that has broken — dropping this near 1 is what
   * makes damage splash onto the rest of the squad once the tank fails. */
  brokenTankTargetWeight: number;

  /** Per-hit damage variance for normal attacks, as a fraction of base
   * damage (e.g. 0.25 = ±25%). NOT applied to chain bonus hits or wind-up
   * hits, which stay exact so escalating tiers and the telegraph's threat
   * read cleanly. 0 disables variance (used by checks/beatsheet.ts to
   * isolate the pure-combat trajectory). */
  damageVariance: number;

  /**
   * 2026-08-08 (root-cause pass on the bracer+vex+cairn/vex+cairn+ward
   * dominant-squad gap — see DECISIONS.md and heroes.ts's pool docstring): a
   * single heal beat can restore at most this fraction of the TARGET's own
   * maxHp. healPerBeat is otherwise a flat amount, which silently
   * over-rewards small HP pools — Cairn's 5.83 HPS was 13%/sec of Vex's
   * 45-maxHp pool but only 2%/sec of Bracer's 280, so a healer erased a
   * squishy attacker's fragility for free rather than that fragility costing
   * anything. This caps the effective heal rate against the target's own
   * body, not a flat number, so the cap scales with whoever's being healed.
   * Deliberately leaves tank-healing (large maxHp) close to unaffected.
   */
  healMaxFractionOfTargetMaxHp: number;
  /** Same idea as healMaxFractionOfTargetMaxHp, but for a CHAIN heal hit
   * specifically (2026-08-15, chain-payoff-axis pass) — deliberately much
   * higher. At the old shared 0.06 cap, Cairn's chain (lowest affinity, and
   * the mechanic's most literal "is this a dud" test) restored single
   * digits at ANY chain length against a normal-sized body — a length-7
   * chain and a length-1 chain were nearly indistinguishable, which is a
   * worse version of the exact problem this whole pass exists to fix. A
   * normal heal beat still caps at healMaxFractionOfTargetMaxHp (erasing
   * fragility for free is still the thing that field guards against); a
   * chain heal is a rare, escalating event and gets real room to matter.
   */
  chainHealMaxFractionOfTargetMaxHp: number;

  /**
   * Base magnitude for each ChainEffect (2026-09-13, "a hero's chain names
   * its own enemy" rebuild — see DECISIONS.md). A chain rung's actual
   * strength is `base * chainEscalationFactor(cfg, hitIndex)` — one shared
   * curve, for five of the six effects. `chainStrikeAllBase`/`chainPoundBase`
   * are damage; `chainMendAllBase`/`chainMendOneBase` are healing;
   * `chainStunBaseSec` is SECONDS, not damage — a duration escalates on the
   * identical curve as a damage number, which is what lets one curve stay
   * honest across five different verbs. See fight.ts's resolveChainHit for
   * the switch that reads these.
   *
   * `chainGuardChargesPerRung` is the exception (2026-09-15 slam-provability
   * pass — see its own docstring below): a flat count, not escalated at all.
   *
   * Values are pinned to the FULL-CHAIN total, not to the base itself. The
   * original 2026-09-13 set was derived from the pre-rebuild pool: the
   * escalation curve summed against chainChanceByHitsSoFar gave ~12.955
   * expected escalation units per fired chain against an old
   * CHAIN_EV_TARGET_DAMAGE of 76, so chainPoundBase: 6 reproduced the old
   * single-target attacker almost exactly. The 2026-09-21 flattening cut the
   * curve's sum from 40 to 13.3, so every base here was raised ~3.01x to keep
   * each effect's 7-rung total where it was — poundBiggest still totals ~240,
   * strikeAll ~80 per body, mendAll ~41 per ally, mendOne ~61, stun ~10s. The
   * ratios between effects are unchanged: chainStrikeAllBase and
   * chainMendAllBase stay cut roughly by the pool's median living-enemy count
   * (3) so an "everyone at once" effect doesn't simply dominate a
   * single-target one on every board. chainStunBaseSec is
   * a PER-LINK seconds value, not the whole chain's payoff — fight.ts's
   * resolveChainHit stun case adds each link's escalated duration onto the
   * running total the CHAIN has bought so far (2026-09-15 freeze-visibility
   * pass, replacing an earlier version that kept only the single longest
   * link), and runFight HOLDS that target frozen at the running total for
   * as long as the chain stays live (2026-09-16 freeze-layout pass — a
   * short early link otherwise lapsed before the next one landed, since
   * links arrive faster than they individually last), draining only once
   * the chain ends. So the chain's total freeze is the SUM of every landed
   * link's duration, not just the last one, and it never blinks off
   * mid-chain. See chainStunBaseSec's own field docstring for the resulting
   * full-chain math.
   *
   * chainMendOneBase is capped by the heal-clamp guard
   * (chainHealMaxFractionOfTargetMaxHp) rather than by an EV target: at the
   * pre-2026-09-21 curve its last rung sat at 1.5 * 13 = 19.5 against
   * checks/chaindist.ts's ceiling of 20.2, which was tight. The flattened
   * curve's last factor is 2.8, so 4.5 puts that rung at 12.6 — the same
   * full-chain total with real room under the clamp. That also means the
   * clamp no longer binds mendAll at all; it is left in place, not tuned to
   * re-bind, since a cap that never fires is harmless and the next curve
   * change may need it again.
   */
  chainStrikeAllBase: number;
  chainPoundBase: number;
  chainMendAllBase: number;
  chainMendOneBase: number;
  /** Per-link freeze duration in seconds, escalated by chainEscalationFactor
   * like any other base above, then SUMMED across every link that lands
   * (2026-09-15 freeze-visibility pass — see fight.ts's resolveChainHit stun
   * case) and HELD without lapsing for as long as the chain stays live
   * (2026-09-16 freeze-layout pass — see runFight's per-tick freeze-hold
   * block). A full 7-link chain's total freeze is
   * `base * sum(chainEscalationFactor(1..7))` = `base * ~13.3` at this file's
   * own escalation constants (it was `base * ~40` before the 2026-09-21
   * flattening, which is why the base tripled in the same pass — the ~10s
   * full-chain total is unchanged) — batch-verify against completion rate and
   * the failsafe-termination rate before trusting this value played. Checked
   * at 0.25 against the 2026-09-16 hold, n=1000,
   * default draft, always-heal: 18.4% completion / 13.1% dip / 0.1%
   * failsafe, against an 18.7% / 13.0% / 0.0% pre-hold baseline — the hold
   * mostly recovers seconds that were being lapsed away between rungs 1-2
   * and 2-3, not new seconds on top, so it moved overall difficulty by
   * noise, not by a real amount. No retune needed FOR THE HOLD ITSELF; this
   * remains otherwise untuned, per the batch-verify note above. */
  chainStunBaseSec: number;

  /**
   * How many slam-redirects one "guard" rung buys (2026-09-15,
   * slam-provability pass — replaces chainGuardBaseSec's time window). The
   * old window (1.5s) expired before most slams arrived at all — the enemy's
   * own windupIntervalSec (5) plus windupTelegraphSec (1.5) is a 6.5s cycle —
   * so a one-hit guard usually did nothing, and the pick screen's own promise
   * ("Takes the next slam for the squad.", chainEffectLines below) wasn't
   * actually true. A charge count that waits instead of expiring makes it
   * true: a rung-1 guard covers exactly one slam, however long the wait.
   *
   * Flat, not escalated by chainEscalationFactor — see resolveChainHit's
   * guard case for why running a charge count through the same curve as a
   * damage number would produce more charges than a fight has slams to spend
   * them on.
   */
  chainGuardChargesPerRung: number;

  /**
   * 2026-09-04 (deciding-factors measurement rig — see
   * FIGHT_DECIDING_FACTORS.md): who the enemy attacks (and which player hero
   * a wind-up locks onto with windupTargeting "weighted") is a coin flip
   * today — pickWeightedTargetId re-rolls it every beat. That dice roll was
   * never priceable on its own, because there was no way to hold "who gets
   * hit" steady without also changing HOW MUCH each hero gets hit. This flag
   * exists only to make that possible.
   *
   * Default `"weighted"` reproduces today's game exactly — pickWeightedTargetId,
   * unchanged, still consumes the RNG stream the same way. `"weightedRoundRobin"`
   * keeps the identical long-run share per hero (same tankTargetWeight /
   * brokenTankTargetWeight formula, re-evaluated every pick so a tank breaking
   * mid-fight still shifts the share) but picks deterministically — smooth
   * weighted round-robin (fight.ts's pickRoundRobinTargetId), the same
   * algorithm load balancers use to spread requests by weight with no RNG. This
   * is deliberately NOT "always hit the tank": that would change how much
   * damage the tank eats, and the measurement would become about the tank
   * instead of about the dice. Freezing a rate at its own average, not at a
   * single point, is what makes the resulting number a price on RANDOMNESS
   * itself rather than a price on some other change smuggled in alongside it.
   *
   * Never read by chain backfire targeting (fight.ts's "front" rule, which
   * re-rolls pickWeightedTargetId against the PLAYER's own side) — that is a
   * different factor ("which way the chain aims" and "who on your side eats
   * it"), measured separately, and is untouched by this flag on purpose.
   */
  enemyTargetMode: "weighted" | "weightedRoundRobin";

  /**
   * Measurement-only override of a chain's backfire coin flip (2026-09-04,
   * chain-proof pass — see `batch/chainProof.ts`'s claim 3: "a backfire can
   * create a losing position outright"). `fight.ts`'s ignition site still
   * rolls `rng.chance(backfireChanceFor(...))` every time, so the RNG stream
   * is untouched either way — this only overrides what the roll DECIDES,
   * never whether it happens. `undefined` (every shipped config) reproduces
   * today's behaviour exactly: the roll's own result is used, byte-identical
   * to before this field existed. `"always"`/`"never"` force every chain in
   * the fight to backfire or not, so a batch rig can hold the backfire coin
   * fixed while everything else (which hero fires, chain length, targeting)
   * still varies normally. Never set outside batch/checks code.
   */
  forceBackfire?: "always" | "never";
}

/**
 * A hero's chain EFFECT (2026-09-13, "a hero's chain names its own enemy"
 * rebuild — see DECISIONS.md). Replaces the old ChainProfile/ChainTargeting
 * pair — heroes no longer differ by a bigger/smaller/differently-shaped
 * number, they differ by what the chain DOES:
 *  - "strikeAll" — damage to every living body on the target side at once
 *    (Vex). Good against a crowd.
 *  - "poundBiggest" — damage to the highest-current-HP living body on the
 *    target side, re-picked every rung (Rook). Good against one huge body.
 *  - "guard" — redirects the target side's next N telegraphed hits onto the
 *    firing hero, one per rung (Bracer). Good against anything that winds
 *    up.
 *  - "stun" — the front-most living body on the target side can't act for a
 *    duration, cancelling an in-progress wind-up (Hollow). Good against a
 *    spike that needs cancelling, or a fast attacker.
 *  - "mendAll" — heals every living ally on the target side at once (Cairn).
 *    Good against steady chip damage from many small hits.
 *  - "mendOne" — heals the lowest-HP living ally on the target side, same
 *    target-pick rule as a normal heal beat (Ward). Good against a threat
 *    that hunts one hero to kill it.
 * A backfire mirrors the identical effect onto the WRONG side (attacker
 * effects hit the firing hero's own side; healer effects heal the enemy) —
 * same convention the pre-rebuild chain always used, just carried through six
 * effects instead of one damage/heal split.
 */
export type ChainEffect = "strikeAll" | "poundBiggest" | "guard" | "stun" | "mendAll" | "mendOne";

/** The two-line pick-screen text for a hero's chain EFFECT (2026-09-13, "a
 * hero's chain names its own enemy" rebuild — see DECISIONS.md). `does` names
 * the effect in plain words; `against` names when to bring it. This is the
 * single source for that wording — render/heroPickShared.ts's
 * chainEffectLines (the squad/field pick rows) and this file's
 * chainEffectVerb (the short one-line version for a pre-fight readout) both
 * read it, so the two screens can't drift into describing the same effect
 * two different ways.
 *
 * "Slam" is the only word taught to the player beyond plain English — it
 * names the enemy's charged-up hit and is used consistently in these lines,
 * the enemy blurbs (sim/encounters.ts), the pre-fight lines (projection.ts),
 * and the in-fight callout (render/fightView.ts's showWindupStart). Every
 * other word here is ordinary language, not a coined term. Keep `does`
 * around 40 characters and `against` around 40 — both sit in a
 * `white-space: nowrap` column (style.css's .hero-pick-chain/-against) that
 * doesn't wrap. */
export function chainEffectLines(effect: ChainEffect): { does: string; against: string } {
  switch (effect) {
    case "strikeAll":
      return { does: "Hits every enemy at once.", against: "Good against a crowd." };
    case "poundBiggest":
      return { does: "Hits the biggest enemy, over and over.", against: "Good against one huge enemy." };
    case "guard":
      return { does: "Takes the next slam for the squad.", against: "Good against slams." };
    case "stun":
      return { does: "Freezes one enemy, cancelling its slam.", against: "Good against a slam, or a fast enemy." };
    case "mendAll":
      return { does: "Heals the whole squad at once.", against: "Good against lots of small hits." };
    case "mendOne":
      return { does: "Heals your worst-hurt hero, hard.", against: "Good when one hero takes all the hits." };
  }
}

/** A short, compact verb phrase for `effect` — used where space is tight
 * (sim/projection.ts's chain line, render/fightView.ts's end-of-chain card).
 * Derived from chainEffectLines' `does` above (lowercased, full stop
 * dropped) rather than hand-kept as a second copy of the same six ideas. */
export function chainEffectVerb(effect: ChainEffect): string {
  const does = chainEffectLines(effect).does;
  return does.charAt(0).toLowerCase() + does.slice(1, -1);
}

export interface RunConfig {
  fight: FightConfig;

  /**
   * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md): the
   * six named heroes, the run-start draft, and the coin spend are gone.
   * A run is now `roundsPerRun` rounds against sim/rounds.ts's ROUND_PLAN,
   * starting from `startingSlots` units (one Tank, one Damage, one Healer —
   * sim/roles.ts's ROLE_POOL) and growing by whatever `npm run offers` (see
   * sim/offers.ts) hands out after each win.
   */
  roundsPerRun: number;
  /** Units fielded per round at run start (sim/roles.ts's PLAYER_ROLES, one
   * of each) — grows over the run via the "slot" offer (sim/offers.ts),
   * capped at maxSlots below. Replaces the old fixed playerN. */
  startingSlots: number;
  /** Hard cap on `RunProgress.slots` — a "slot" offer above this is filtered
   * out by sim/offers.ts's drawOffers rather than left to overshoot. */
  maxSlots: number;
  /** Hard cap on total roster size (living + fallen) — a "recruit" offer
   * above this is filtered out the same way. Generous: this is a ceiling
   * against unbounded growth, not a real constraint at 20 rounds x 3 offers. */
  maxRosterSize: number;

  /** Offers shown per win (sim/offers.ts's drawOffers) — see that file's
   * top docstring for the weighting-by-round rule. */
  offersPerWin: number;
  /** A "chainLevel" offer raises a role's chain level by this much
   * (sim/progress.ts's applyOffer), capped at chainLevelCap. fight.ts's
   * escalatedMagnitude/escalatedDurationSec multiply by the fielded unit's
   * own chainLevel — see sim/roster.ts's stampProgressOntoSquad. */
  chainLevelStep: number;
  chainLevelCap: number;
  /** A "statHp"/"statDamage" offer raises every unit of that role's own
   * maxHp/damage by this much, permanently (sim/progress.ts's
   * RunProgress.bonus) — applied once, at offer time, to every living unit
   * of that role and baked into every unit of that role recruited after. */
  statHpStep: number;
  statDamageStep: number;
  /** A "heal" offer's flat HP grant to every living unit. */
  healFlatAmount: number;
  /** A "revive" offer brings back one fallen unit at this fraction of its
   * own maxHp. */
  reviveHpFraction: number;

  /** Fraction of a FIELDED unit's own maxHp granted between rounds, no
   * input, capped at their own max (see roster.ts's applyFightResultToRoster).
   * Deliberately per-unit-proportional rather than a flat HP amount — a flat
   * amount silently favors low-maxHp roles and specifically starves the
   * tank. */
  autoRecoverFraction: number;
  /** Fraction of a BENCHED (living, not fielded this round) roster unit's own
   * maxHp granted between rounds — deliberately HIGHER than
   * autoRecoverFraction: resting is the reward for not fielding a unit,
   * which is what makes the squad-mix pick a real rotation decision rather
   * than "always field the same three." */
  benchedRecoverFraction: number;
}

export const DEFAULT_FIGHT_CONFIG: FightConfig = {
  tickRate: 20,
  maxFightSec: 180,

  // tankBreakFraction retuned down hard from an initial 0.3 during the
  // 2026-08-06 tuning pass: at 0.3 the comfortable comp (bracer+rook+cairn)
  // broke its tank line in ~90-100% of fights regardless of Bracer's own
  // HP/damage. Only a low break threshold (tank has to be nearly dead, not
  // just battered) kept the "IS BREAKING" tell rare rather than routine.
  // Still governs enemy targeting weight and the broken-tank visual as of
  // the 2026-08-07 rebuild — jeopardy no longer routes through this alone
  // (see heatThreshold and windupIntervalSec below), but a tank's line still
  // visibly fails the same way.
  tankBreakFraction: 0.03,
  tankRecoverFraction: 0.2,

  // Charge (2026-08-14 chain rebuild — see this file's FightConfig
  // docstring). Weighted 1/0.5/1.5 so a hero's OWN job fills its meter at a
  // rate that tracks its actual DPS/HPS, not a flat counter: soaked is
  // weighted down because a tank's damage share is large but
  // slow-accumulating, restored is weighted up because heal-per-beat amounts
  // are small. Carried over unchanged from the old heatWeight* values — only
  // the threshold needed to move, since accrual itself is unaffected by this
  // rebuild (chainAffinity no longer multiplies it, but the base weights
  // still do).
  chargeWeightDealt: 1,
  chargeWeightSoaked: 0.5,
  chargeWeightRestored: 1.5,
  // 220 (2x the old heatThreshold of 110) — batch-verified via
  // `npm run batch --squad default --policy always-heal --n 800`. First
  // strawman (330, 3x) crashed default-draft run completion to ~7% even with
  // backfireChance at 0 — root cause: decoupling chainAffinity from accrual
  // (see chargeThreshold's docstring above) means fire opportunities spread
  // more evenly across low- and high-affinity heroes by RAW output instead of
  // concentrating on high-affinity carriers the way the old heat mechanism
  // did, so the average chain's payoff dropped — fine for fights 1-4's
  // generous margins, but fight 5 (Champion) relied on that concentration and
  // collapsed (win rate 31.8% -> 7.6%, deaths in fight 5 alone rose from 3.15
  // to 4.37 out of a 5-hero roster). 220 restores fight 5 to ~35% at
  // backfireChance=0 — comparable to the old mechanism's 31.8% — while still
  // meaningfully higher than the old 110 (charge now persists across fights
  // rather than resetting, so a lower threshold would make fight 1 fire
  // almost immediately, undercutting the "earned across the run" arc).
  chargeThreshold: 220,
  // 0.10 — batch-verified alongside chargeThreshold above: at 220/0.10, the
  // default draft (always-heal, n=800) landed run completion at ~28%, close
  // to STATE.md's existing ~28% baseline for the OLD (pre-2026-08-15) chain
  // mechanic. Higher values (0.15-0.25) were tested and eroded completion
  // roughly linearly (26% / 22% / 18%) with no cliff — a legitimate
  // further-tuning knob, not a value chosen to avoid a bug.
  //
  // Re-tuned 0.10 -> 0.12 (2026-08-15, chain-payoff-axis pass): moving a
  // chain's payoff spread onto length (steeper escalation past
  // chainEscalationKneeHit — see heroes.ts's chainAffinity docstring for
  // the full rationale) pushed always-heal completion up to ~30.9% at
  // backfireChance=0.10, n=1500 — the escalation curve makes both a real
  // payoff AND a backfire bigger equally, but a losing fight is more likely
  // to end (by wipe) before a chain reaches the steep part of the curve,
  // while a winning one can ride a long chain further, so the net effect
  // skewed the game slightly easier. 0.12 lands back at ~29.6%, within a
  // point of the ~28% baseline.
  //
  // Restructured flat -> per-hero (2026-08-19, affinity-as-risk pass): this
  // value becomes backfireChanceBase, the rate at chainAffinity===1.0 (Vex
  // exactly — sees zero change from the flat-0.12 era). Strawman
  // (unverified against a played session, only batch-measured — same as
  // every value in this file): backfireChanceAffinitySlope=0.15 spreads real
  // backfire risk ~7.5% (Cairn, 0.7 affinity) to ~18% (Rook, 1.4 affinity)
  // across the pool's current range. Re-batch (`npm run check:chaindist`)
  // before trusting either number again if chainAffinity's own pool range
  // moves.
  backfireChanceBase: 0.12,
  backfireChanceAffinitySlope: 0.15,

  // Wind-up (2026-08-07 rebuild, retuned twice after batch passes — see
  // DECISIONS.md's "fight causality rebuild" entry): the initial strawman
  // (interval 5s, x3.5) combined with the then-live enrage ramp and the
  // larger enemy pool to produce ~0% run completion across every squad.
  // (That ramp is gone as of 2026-08-27 — these numbers have not been
  // re-tuned for its absence, deliberately; see DECISIONS.md.) Backed off
  // further on a second pass once the enemy pool itself came back down —
  // 9s cadence, 2.0x base damage still leaves a 45hp Vex on ~27hp
  // (survivable once, dangerous twice) while landing well inside Bracer's
  // 280hp buffer.
  windupIntervalSec: 5,
  windupTelegraphSec: 1.5,
  windupDamageMultiplier: 2.0,

  chainChanceByHitsSoFar: [0.7, 0.75, 0.8, 0.85, 0.9],
  // A plain multiplier on the per-effect base (chainStrikeAllBase and the
  // rest below), left inert at 1 — see this file's FightConfig docstring.
  chainHitMultiplier: 1,
  chainMaxHits: 7,
  chainContinuationScale: 1,
  hotBeatIntervalFactor: 0.6,

  // 2026-09-21 curve-flattening pass (was 4 / 3 from the 2026-08-15
  // chain-payoff-axis pass). knee 1 means the whole curve is one near-flat
  // slope: factors 1, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8. Measured on
  // checks/chaindist.ts's own funnel (n=1500, seed base 70_000): a 2-rung
  // Rook chain 18 -> 42 damage, run completion 15.1% -> 18.1%, chain length's
  // share of a fight's outcome variance 47% -> 31%. Every per-effect base
  // below was raised ~3.01x in the same pass to hold a full 7-rung chain at
  // the same total it had before — the pass moved where a chain's value sits,
  // not how much a maxed one is worth. Re-measure both together, never one
  // without the other.
  chainEscalationKneeHit: 1,
  chainEscalationStepMultiplier: 0.3,

  // 2026-08-15 chain-payoff-axis pass: raised from 3 to 5. It matched the
  // escalation knee at the time so the mechanical and visual jumps landed on
  // the same hit; the 2026-09-21 flattening removed that jump, and this
  // threshold now stands on its own as "the chain went long" — see its
  // docstring above. render/playback.ts reads it for pacing.
  chainFullTellThreshold: 5,

  tankTargetWeight: 3,
  brokenTankTargetWeight: 1,

  damageVariance: 0.25,

  // 2026-08-08 (root-cause pass): started at 0.05, loosened to 0.11 during
  // the 20-squad batch sweep. Re-lowered to 0.06 (2026-08-09, boring-middle
  // root-cause pass): at 0.11 the cap never actually bound on any hero in the
  // pool — even Vex's cap (7.7) sat above Cairn's raw 7/beat, so the whole
  // mechanism was a documented no-op. At 0.06, caps are Bracer 11.7, Hollow
  // 10.8, Cairn 6.6, Ward 5.5, Rook 5.1, Vex 4.2 — Cairn's 7/beat now
  // genuinely trims against every squishy target (Cairn healing Vex caps at
  // 4.2, not 7), which is the small-body case this exists to fix. See this
  // file's FightConfig docstring.
  healMaxFractionOfTargetMaxHp: 0.06,
  // 2026-08-15 chain-payoff-axis pass — see this field's own docstring
  // above. ~3.3x the normal-beat cap: high enough that a long Cairn/Ward
  // chain reads as a real event (up to a fifth of a body's own maxHp in one
  // hit) without letting a single chain hit fully top up a squishy ally.
  chainHealMaxFractionOfTargetMaxHp: 0.2,

  // See this field's own docstring above. All four raised ~3.01x on
  // 2026-09-21 (from 2 / 6 / 1 / 1.5) when chainEscalationStepMultiplier went
  // 3 -> 0.3: the curve's sum fell 40 -> 13.3, so these hold each effect's
  // FULL-chain total where it was. These two numbers move together — changing
  // one without the other silently rescales every chain in the game.
  chainStrikeAllBase: 6,
  chainPoundBase: 18,
  chainMendAllBase: 3,
  chainMendOneBase: 4.5,
  // 2026-09-15 freeze-visibility pass: cut from 0.8 now that links ADD UP
  // instead of a Math.max overwrite (fight.ts's resolveChainHit stun case) —
  // at the old value a full 7-link chain would freeze a body for ~32s in a
  // ~20s fight. 0.25 -> 0.75 on 2026-09-21, same ~3x as the four bases above
  // and for the same reason; a full chain still totals ~10s of freeze. Still
  // not re-verified against completion rate or the failsafe-termination rate
  // in its own right.
  chainStunBaseSec: 0.75,
  // NOT rescaled by the 2026-09-21 pass: guard is a flat charge per rung and
  // never reads the escalation curve (see its docstring above).
  chainGuardChargesPerRung: 1,

  // See this field's own docstring above — default "weighted" is today's
  // shipped behaviour (pickWeightedTargetId's dice roll), not a change.
  enemyTargetMode: "weighted",
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  fight: DEFAULT_FIGHT_CONFIG,

  // 2026-09-23 (roles/rounds rebuild) — 20 rounds against sim/rounds.ts's
  // ROUND_PLAN (mini-bosses at 7/14, boss at 20), starting from 3 units (one
  // Tank, one Damage, one Healer) instead of a 5-of-6 hero draft. Every
  // number below is a first-pass strawman, same convention as the rest of
  // this file — meant to move by playing, not a balance pass.
  roundsPerRun: 20,
  startingSlots: 3,
  maxSlots: 5,
  maxRosterSize: 10,

  offersPerWin: 3,
  chainLevelStep: 1,
  chainLevelCap: 5,
  statHpStep: 20,
  statDamageStep: 2,
  healFlatAmount: 30,
  reviveHpFraction: 0.5,

  // Raised from the pre-rebuild values (0.25 / 0.45): the old 5-fight run
  // always had a 5-unit roster (2 benched) to rotate from day one; this run
  // starts at exactly 3 units with no bench at all until a "recruit"/"slot"
  // offer shows up, so early rounds have no rotation to lean on and need
  // more of their own HP back between rounds. See roster.ts's
  // applyFightResultToRoster for why benched still recovers faster (the
  // squad-mix pick's rotation pressure), once there is a bench to reward.
  autoRecoverFraction: 0.4,
  benchedRecoverFraction: 0.6,
};

/** Look up a PRD-style table: index by count, clamp to the last (capped) entry. */
export function prdLookup(table: number[], countSoFar: number): number {
  const idx = Math.min(countSoFar, table.length - 1);
  const value = table[idx];
  if (value === undefined) {
    throw new Error("prdLookup: table must be non-empty");
  }
  return value;
}

/** A chain bonus hit's escalation factor at `hitIndex` (1-based) — replaces
 * the pre-2026-08-15 formula's raw `hitIndex` (see FightConfig's
 * chainHitMultiplier/chainEscalationKneeHit/StepMultiplier docstrings, and
 * fight.ts's escalatedMagnitude/escalatedDurationSec, the two call sites).
 * Linear through the knee, then stepMultiplier per hit beyond it.
 *
 * Pure and hero-agnostic: the SAME factor applies to every hero, multiplied
 * only by whichever per-effect base its ChainEffect carries. No hero term —
 * chainAffinity has not entered this since the 2026-09-13 rebuild, and buys
 * backfire risk only. At the current knee of 1 there is effectively no knee:
 * the curve is one near-flat slope (2026-09-21). */
export function chainEscalationFactor(cfg: FightConfig, hitIndex: number): number {
  if (hitIndex <= cfg.chainEscalationKneeHit) return hitIndex;
  return cfg.chainEscalationKneeHit + (hitIndex - cfg.chainEscalationKneeHit) * cfg.chainEscalationStepMultiplier;
}

/** The chance a firing chain backfires, as a function of the firing hero's
 * own chainAffinity (2026-08-19, affinity-as-risk pass — see
 * backfireChanceBase/backfireChanceAffinitySlope's docstrings above). Pure
 * and hero-agnostic, same convention as chainEscalationFactor: this file
 * never imports the specific hero pool, so the formula is anchored at
 * chainAffinity === 1.0 rather than the pool's actual min/max. Clamped to
 * [0, 1] defensively — the pool's current range (0.7-1.4) never approaches
 * either bound at the current base/slope, but a future hero or a retuned
 * slope shouldn't be able to produce a nonsense probability. */
export function backfireChanceFor(cfg: FightConfig, chainAffinity: number): number {
  return Math.max(0, Math.min(1, cfg.backfireChanceBase + cfg.backfireChanceAffinitySlope * (chainAffinity - 1)));
}

/** prdLookup against cfg's own continuation table, damped by
 * cfg.chainContinuationScale (default 1, inert) — see that field's own
 * docstring for why the scale exists as a separate knob on top of the table.
 * Clamped to [0, 1] defensively, same convention as backfireChanceFor.
 *
 * 2026-09-13 ("a hero's chain names its own enemy" rebuild): heroes no longer
 * carry their own continuation table — every hero reads this same one, same
 * as before the 2026-08-20 per-hero-profile pass. What differs between heroes
 * now is the EFFECT a rung produces (ChainEffect above), not how likely the
 * chain is to keep running. */
export function chainContinuationChance(cfg: FightConfig, hitsSoFar: number): number {
  const raw = prdLookup(cfg.chainChanceByHitsSoFar, hitsSoFar);
  return Math.max(0, Math.min(1, raw * cfg.chainContinuationScale));
}
