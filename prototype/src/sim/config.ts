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

import type { CardId } from "./cards/types.js";

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
   * payoff size. There is no heatGift — charge is private to each hero. The
   * rebuild made charge persist across the run; the 2026-09-30
   * chain-frequency rework reversed that: every fight starts at zero (see
   * roster.ts's fieldSquad), and chargeTricklePerSec below adds a time floor.
   *
   * What fires is still a coin flip: see backfireChance below.
   */
  chargeWeightDealt: number;
  chargeWeightSoaked: number;
  chargeWeightRestored: number;
  /** The highest-charge living hero fires the instant its charge crosses
   * this, one chain at a time. Charge resets every fight, so this is sized to
   * be reached inside one — see the default value's own comment (below,
   * DEFAULT_FIGHT_CONFIG) for the batch-measured reasoning. */
  chargeThreshold: number;
  /** Charge every living player hero gains per second of fight time, on top of
   * what its own job earns (DECISIONS.md 2026-09-30 "Chains fire every
   * fight"). It is the floor that lets a hero nobody hurts, heals or hits —
   * a healer in a quiet opening — still reach a chain. 0 turns it off. */
  chargeTricklePerSec: number;
  /** Multiplies every enemy's maxHp/hp on top of sim/rounds.ts's per-round
   * hpScale (sim/encounters.ts's buildEnemySide). The one knob that makes
   * enemies tougher to absorb the extra chains; 1 is inert. */
  enemyHpScale: number;
  /**
   * Fatigue (DECISIONS.md 2026-09-30 "Fatigue replaces per-role backfire
   * odds"). A unit's fatigue runs from 0 to `fatigueMax`, persists for the
   * whole run, and sets two things in a fight: how likely its chain is to
   * backfire, and how long and strong its chains are.
   *
   * The coin flip at the moment a chain fires (2026-08-14 chain rebuild) is
   * unchanged: this fraction of the time the chain aims at the wrong side —
   * an attacker's escalating hits land on its OWN team, a healer's heal
   * restores the ENEMY — at the same magnitude a real payoff would have had.
   * What changed is where the odds come from. They were a per-role constant
   * (chainAffinity, 2026-08-19); they are now `backfireChanceFor(cfg, fatigue)`,
   * a curve through three anchors: `backfireAtFresh` at 0, `backfireAtSweetSpot`
   * at `fatigueSweetSpot`, and `backfireAtBreaking` at `fatigueMax`.
   *
   * The curve is deliberately shallow up to the sweet spot and steep after
   * it. The chain boost below rises linearly, so a unit's expected value per
   * chain peaks somewhere in the middle and falls off past it — the point of
   * "push or rest". If the backfire rose as gently as the boost did, maximum
   * fatigue would always be the right call (the 2026-08-19 trap).
   */
  fatigueMax: number;
  /** Fatigue at which each tier starts — Worn, Frayed, Breaking (Fresh starts
   * at 0). Presentation only: nothing in the sim reads a tier, only the
   * continuous value. */
  fatigueTierFloors: [number, number, number];
  fatigueSweetSpot: number;
  backfireAtFresh: number;
  backfireAtSweetSpot: number;
  backfireAtBreaking: number;
  /** At `fatigueMax`, added to every continuation chance (chainContinuationChance)
   * and scaled down linearly with fatigue — a frayed unit's chains run longer. */
  fatigueContinuationBonus: number;
  /** At `fatigueMax`, the fraction added to every escalated rung's magnitude
   * (fatigueMagnitudeMult), scaled down linearly with fatigue. */
  fatigueMagnitudeBonus: number;

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
   * has since been removed altogether; fatigue scales the result at the call
   * site instead (fatigueMagnitudeMult). The base was
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
  /** Renamed 2026-09-30 with the ability ids: chainScorchBase (was
   * chainStrikeAllBase), chainExposeBase (was chainPoundBase), chainWardBase
   * (was chainMendAllBase), chainMendBase (was chainMendOneBase). Same values,
   * same role in the escalation curve. The docstring above still uses the old
   * names for the pass that derived them. */
  chainScorchBase: number;
  chainExposeBase: number;
  chainWardBase: number;
  chainMendBase: number;
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
   * 2026-10-01 (the six branching abilities — see ChainEffect's docstring).
   * First-pass strawmen, same convention as every number here. Damage and heal
   * bases escalate on the shared curve like the four above; the two freeze
   * lengths escalate like chainStunBaseSec. `chainBraceShieldFraction` is a
   * fraction of the BRACING hero's max HP (the base the curve then scales), so
   * +HP on a tank is also a bigger Brace. `chainSiphonHealFraction` is the part
   * of the damage Siphon actually dealt that comes back as healing.
   */
  chainBraceShieldFraction: number;
  chainQuakeBase: number;
  chainFrostboltBase: number;
  chainFrostboltFreezeSec: number;
  chainSiphonBase: number;
  chainSiphonHealFraction: number;
  chainCauterizeHealBase: number;
  chainCauterizeBurnBase: number;
  chainChillSec: number;

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
   * Marks (2026-09-30 — see DECISIONS.md's "chain abilities are redesigned to
   * leave marks" entry). Every value below is a first-pass strawman, meant to
   * move by playing. Marks last one fight; sim/fight.ts owns the rules.
   *
   * Exposed: each stack adds `exposedDamagePerStack` to every hit the body
   * takes, up to `exposedStackCap` stacks. Burn: every `burnTickSec` the body
   * takes `burnDamagePerStack` per stack, then loses `burnDecayPerTick`
   * stacks. Shield: absorbs damage before HP, capped at
   * `shieldCapFractionOfMaxHp` of the body's maxHp.
   *
   * Per-rung stacks: expose/scorch/guard leave `1 + (chainLevel - 1)` stacks
   * (chain "+N" means one extra stack per rung — the 2026-09-30 entry).
   * Shield sources are HP-equivalents: `chainWardShield` per ward rung
   * (escalated like any base), `chainShieldPerLevel` extra flat shield per
   * mend or ward rung per level above 1.
   */
  exposedDamagePerStack: number;
  exposedStackCap: number;
  burnTickSec: number;
  burnDamagePerStack: number;
  burnDecayPerTick: number;
  shieldCapFractionOfMaxHp: number;
  chainWardShield: number;
  chainShieldPerLevel: number;

  /**
   * Payoff-card tunables (2026-09-30; sim/cards/index.ts). `executeHpFraction`: an
   * Exposed enemy at or below this HP fraction dies outright. `shatterMult`:
   * all damage on a Frozen body is multiplied by this. `punishDamagePerStack`:
   * a tank's normal hit on an Exposed body adds this fraction of the tank's
   * damage per stack, then uses the stacks up. `deepFreezeMult`: Freeze on an
   * Exposed body lasts this many times as long. `openWoundMult`: Burn ticks on
   * an Exposed body count this many times. `spikedShieldExposeStacks`: Exposed
   * stacks an attacker gains when a Shield absorbs its hit. `bulwarkShield`:
   * Shield every living ally gains when Guard blocks a slam.
   */
  executeHpFraction: number;
  shatterMult: number;
  punishDamagePerStack: number;
  deepFreezeMult: number;
  openWoundMult: number;
  spikedShieldExposeStacks: number;
  bulwarkShield: number;
  /**
   * 2026-10-01 (cards on a "when X, do Y" engine; sim/cards/engine.ts): how
   * many cards deep one cascade may go — a card's effect can raise a hook that
   * runs another card, and so on. At this depth a hook raises nothing, so cards
   * that feed each other end instead of looping forever.
   */
  cascadeMaxDepth: number;
  /**
   * 2026-10-01: tunables for the cards added with the engine (sim/cards/defs/),
   * first-pass strawmen like every number here. Grouped by the card that reads
   * them. Exposed: `weakSpotPerStack` is a fraction of the Damage unit's own
   * damage per Exposed stack on its target (so +damage on that role is also a
   * bigger Weak spot); `crackThreshold` stacks make an enemy freeze for
   * `crackFreezeSec` and cost `crackSpendStacks`; `hunterMarkStacks` land on
   * the front enemy when a chain starts. Frozen: `coldSnapSec` freeze on a
   * backfire; `brittleExposePerSec` Exposed stacks per second of freeze (at least one a rung); Frostbite gives
   * `frostbiteBurnPerSec` Burn stacks per second of freeze; Permafrost adds
   * `permafrostChainBonus` to a chain's continue chance while any enemy is
   * frozen. Burn: Kindling adds `kindlingBurn` per Damage attack; Inferno adds
   * `infernoPerTick` per earlier enemy burn tick this fight, up to
   * `infernoCap`; Smoke shields your weakest unit for `smokeShieldFraction` of
   * a tick. Shield: Overflow turns `overflowFraction` of wasted healing into
   * Shield; Shield bash adds `shieldBashFraction` of the Tank's Shield to its
   * hit; Shatterguard freezes a shield-breaker `shatterguardFreezeSec`; Aegis
   * lifts the Shield cap to `aegisCapFraction` of max HP. General: Momentum
   * makes each rung `momentumPerChain` bigger per chain already finished this
   * fight, up to `momentumCap` chains; Second wind fires below
   * `secondWindHpFraction` HP and gives `secondWindChargeFraction` of a full
   * bar; Iron hide adds one mark stack per `ironHideHpPerStack` Tank max HP;
   * Bloodlust gives `bloodlustChargeFraction` of a bar per enemy death. Duos:
   * Fortress hurts a slammer for `fortressReflectFraction` of the guardian's
   * max HP; Thermal shock multiplies a burn's pent-up damage by
   * `thermalShockMult`; Killing frost's Execute line on a frozen enemy is
   * `killingFrostHpFraction`; Cinder shield gives an attacker
   * `cinderShieldBurn` Burn; Phoenix stands a fallen unit back up at
   * `phoenixHpFraction` HP with `phoenixShield` Shield.
   */
  weakSpotPerStack: number;
  crackThreshold: number;
  crackSpendStacks: number;
  crackFreezeSec: number;
  hunterMarkStacks: number;
  coldSnapSec: number;
  brittleExposePerSec: number;
  frostbiteBurnPerSec: number;
  permafrostChainBonus: number;
  kindlingBurn: number;
  infernoPerTick: number;
  infernoCap: number;
  smokeShieldFraction: number;
  overflowFraction: number;
  shieldBashFraction: number;
  shatterguardFreezeSec: number;
  aegisCapFraction: number;
  momentumPerChain: number;
  momentumCap: number;
  secondWindHpFraction: number;
  secondWindChargeFraction: number;
  ironHideHpPerStack: number;
  bloodlustChargeFraction: number;
  fortressReflectFraction: number;
  thermalShockMult: number;
  killingFrostHpFraction: number;
  cinderShieldBurn: number;
  phoenixHpFraction: number;
  phoenixShield: number;
  /** Wildfire: the share of its normal decay a burn keeps (0 = never fades). */
  wildfireDecayFraction: number;
  /**
   * Relics (2026-10-01; sim/relics.ts): one is picked as the reward for winning
   * round `relicRound`, and held for the rest of the run. Ember heart
   * puts `emberHeartBurn` Burn on every enemy when a chain backfires; Frost
   * crown freezes the front enemy `frostCrownSec` at fight start; Hunter's eye
   * starts every enemy with `huntersEyeStacks` Exposed; Bastion starts each unit
   * with `bastionShieldFraction` of its max HP as Shield; Restless starts each
   * unit with `restlessChargeFraction` of a full bar but `restlessFatigue` extra
   * fatigue for that fight (stronger, riskier chains).
   */
  emberHeartBurn: number;
  frostCrownSec: number;
  huntersEyeStacks: number;
  bastionShieldFraction: number;
  restlessChargeFraction: number;
  restlessFatigue: number;

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
 * rebuild — see DECISIONS.md; renamed and given marks 2026-09-30, see the
 * "chain abilities are redesigned to leave marks" entry). Every ability does
 * its old job AND leaves a mark (MarkId below) that a payoff card
 * (sim/cards/index.ts) can read:
 *  - "scorch" — damage to every living body on the target side at once, and a
 *    Burn stack on each. Good against a crowd.
 *  - "expose" — damage to the highest-current-HP living body on the target
 *    side, re-picked every rung, and an Exposed stack on it. Good against one
 *    huge body.
 *  - "guard" — redirects the target side's next N telegraphed hits onto the
 *    firing hero, one per rung. Every slam it blocks leaves the slammer
 *    Exposed. Good against anything that winds up.
 *  - "stun" (shown as Freeze) — the front-most living body on the target side
 *    can't act for a duration, cancelling an in-progress wind-up. Its mark is
 *    Frozen, which is the existing stun fields, not a new stack. Good against
 *    a spike that needs cancelling, or a fast attacker.
 *  - "ward" — heals every living ally on the target side at once, and gives
 *    each a small Shield. Good against steady chip damage from many hits.
 *  - "mend" — heals the worst-hurt living ally on the target side; healing
 *    past full HP becomes Shield. Good against a threat that hunts one hero.
 * 2026-10-01 (roles branch — see sim/roles.ts's ROLE_UPGRADE_POOL) six more,
 * two per role, so every role can reach three marks:
 *  - "brace" — the firing hero shields itself, sized off its own max HP.
 *  - "quake" — a small hit on every enemy, each left Exposed.
 *  - "frostbolt" — freezes the front enemy, then hits it (so the hit lands on
 *    a frozen body).
 *  - "siphon" — hits the weakest enemy and heals your worst-hurt hero for part
 *    of it; healing past full becomes Shield.
 *  - "cauterize" — heals the worst-hurt ally and sets the enemy that last hit
 *    them burning.
 *  - "chill" — freezes the enemy that last hit your weakest hero.
 * A backfire mirrors the identical effect onto the WRONG side (attacker
 * effects and their marks hit the firing hero's own side; healer effects heal
 * and shield the enemy) — same convention the pre-rebuild chain always used.
 */
export type ChainEffect =
  | "scorch"
  | "expose"
  | "guard"
  | "stun"
  | "ward"
  | "mend"
  | "brace"
  | "quake"
  | "frostbolt"
  | "siphon"
  | "cauterize"
  | "chill";

/** The four marks (2026-09-30). Exposed/Burn/Shield are stacks on a body
 * (types.ts's HeroState.marks); Frozen is the existing stun fields. All last
 * one fight. */
export type MarkId = "exposed" | "frozen" | "burn" | "shield";

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
    case "scorch":
      return { does: "Hits every enemy and sets them burning.", against: "Good against a crowd." };
    case "expose":
      return { does: "Hits the biggest enemy and exposes it.", against: "Good against one huge enemy." };
    case "guard":
      return { does: "Takes the next slam and exposes the slammer.", against: "Good against slams." };
    case "stun":
      return { does: "Freezes one enemy, cancelling its slam.", against: "Good against a slam, or a fast enemy." };
    case "ward":
      return { does: "Heals the whole squad and shields them.", against: "Good against lots of small hits." };
    case "mend":
      return { does: "Heals your worst-hurt hero; extra becomes shield.", against: "Good when one hero takes all the hits." };
    case "brace":
      return { does: "Shields itself, more the tougher it is.", against: "Good for a tank that soaks." };
    case "quake":
      return { does: "Hits every enemy a little and exposes them.", against: "Good against a crowd." };
    case "frostbolt":
      return { does: "Freezes the front enemy, then hits it.", against: "Good with anything that loves frozen." };
    case "siphon":
      return { does: "Hits the weakest enemy and heals from it.", against: "Good for finishing and staying up." };
    case "cauterize":
      return { does: "Heals the hurt hero and burns their attacker.", against: "Good when one enemy hunts one hero." };
    case "chill":
      return { does: "Freezes whoever hit your weakest hero.", against: "Good against a hunter." };
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

/** A round-screen ability chip's icon plus one-word label (2026-09-29,
 * round-screen rebuild — see design/HANDOFF.md and RoundGrown.dc.html).
 * guard/stun/expose/mend keep the mockup icons (formerly poundBiggest and
 * mendOne); scorch and ward (formerly strikeAll and mendAll) have no mockup
 * to copy, so their icon/word are new here. */
export function chainEffectChip(effect: ChainEffect): { icon: string; word: string } {
  switch (effect) {
    case "guard":
      return { icon: "⛨", word: "guard" };
    case "stun":
      return { icon: "❄", word: "freeze" };
    case "expose":
      return { icon: "◎", word: "expose" };
    case "mend":
      return { icon: "♥", word: "mend" };
    case "scorch":
      return { icon: "✺", word: "scorch" };
    case "ward":
      return { icon: "✚", word: "ward" };
    case "brace":
      return { icon: "⛊", word: "brace" };
    case "quake":
      return { icon: "≋", word: "quake" };
    case "frostbolt":
      return { icon: "❆", word: "frostbolt" };
    case "siphon":
      return { icon: "☍", word: "siphon" };
    case "cauterize":
      return { icon: "♨", word: "cauterize" };
    case "chill":
      return { icon: "❅", word: "chill" };
  }
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
  /** The 0-based round whose win reward is the relic pick instead of the normal
   * offers (2026-10-01: a run opens on a fight, so the pick comes after one). */
  relicRound: number;
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
   * (sim/progress.ts's applyOffer), capped at chainLevelCap. Since 2026-09-30
   * each level above 1 leaves one extra MARK stack per chain rung (fight.ts's
   * markStacks) and lengthens Freeze; it no longer multiplies damage or heals
   * — see sim/roster.ts's stampProgressOntoSquad for how it reaches a unit. */
  chainLevelStep: number;
  chainLevelCap: number;
  /** Payoff cards (2026-09-30; sim/cards/index.ts, sim/offers.ts): the most a run
   * can hold at once — taking another at the cap means dropping one held.
   * `cardWeight` is a payoff offer's flat draw weight (they don't ramp with
   * the round like small/big offers do); `cardConnectBoost` multiplies it by
   * `1 + boost` when the card reads a mark the squad can already make. */
  cardCap: number;
  cardWeight: number;
  cardConnectBoost: number;
  /** 2026-10-01: a duo card's draw weight is `cardWeight * duoBoost` once both
   * its parts are held — the whole point of holding the parts is to see it.
   * `borrowWeightFraction` scales `cardWeight` for a "borrow" offer (a role
   * taking another role's base ability), which is meant to be rare. */
  duoBoost: number;
  /** The most the whole card group may weigh in one draw (sim/offers.ts's
   * drawOffers). Cards draw at flat per-card weights, so without a cap a bigger
   * pool crowds the number offers out of the three on screen; past the cap every
   * card's weight shrinks together. */
  cardGroupWeightCap: number;
  borrowWeightFraction: number;
  /** Restricts the offer pool to these cards, in this order (undefined = every
   * card). For experiments and checks — `--cards a,b,c` on the batch CLI — never
   * set by a real run. */
  cardPool?: CardId[];
  /** 2026-10-01 (roles branch): the most abilities a role's chain may gain on
   * top of its base — a role is offered upgrades from the pool its run drew
   * (RunProgress.upgradeOptions) until it holds this many. */
  maxUpgradesPerRole: number;
  /** How many of a role's pool the run draws as that role's upgrade options at
   * run start (sim/progress.ts's drawUpgradeOptions). */
  upgradeOptionsPerRole: number;
  /** How many of each win's offers are drawn from build pieces only (payoff
   * cards and ability gains) before the ordinary weighted draw fills the rest
   * (sim/offers.ts's drawOffers). 0 turns the guarantee off. */
  buildOffersGuaranteed: number;
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

  /**
   * Between-round fatigue rules (2026-09-30, DECISIONS.md "Fatigue replaces
   * per-role backfire odds"; sim/roster.ts's applyFightResultToRoster reads
   * them). A FIELDED unit gains `fatiguePerFight` for taking part, plus
   * `fatiguePerHpLost` times the fraction of its own maxHp it lost net over the
   * fight, plus `fatiguePerBackfire` per chain of its that backfired. A
   * BENCHED living unit loses `fatigueBenchRest`. A "rest" offer
   * (sim/offers.ts) cuts one unit by `restFatigueCut`. Fatigue stays inside
   * [0, fightCfg.fatigueMax]; the ceiling is what stops a backfire spiral.
   */
  fatiguePerFight: number;
  fatiguePerHpLost: number;
  fatiguePerBackfire: number;
  fatigueBenchRest: number;
  restFatigueCut: number;
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
  // 2026-09-30 chain-frequency rework (DECISIONS.md "Chains fire every
  // fight"): charge now resets every fight, so the bar has to be reachable
  // inside one. The old 220 assumed a bar that carried over between fights;
  // with a reset it left chains at ~0.6 per fight and run completion under 1%.
  // Measured (greedy, n=300-1000): a threshold of 45 with a 6/s trickle puts
  // the first chain at a median ~18% of the fight and lets ~90% of fielded
  // heroes chain at least once. That share is capped by the one-chain-at-a-time
  // queue, not by charge: a squad of 5 in a ~12s fight has room for only 3-4
  // chains, and more fielded heroes lowers the share. enemyHpScale 1.6 was
  // then found by sweeping it back to roughly the pre-rework ~10% run
  // completion (11.8% at n=1000). It also lengthens fights, which is what
  // gives the queue room. All three are strawmen to move by playing.
  // 2026-10-01 (cards, abilities and relics): the squad got stronger, which
  // shortened fights (17.0s to 15.5s), dropped heroes-who-chained to 84% and
  // lifted greedy completion to 12%. Swept again: 1.8 puts completion at 9.4%
  // and heroes-who-chained at 86% (n=1000, greedy), 2.0 at 5.2% / 87%.
  chargeThreshold: 45,
  chargeTricklePerSec: 6,
  enemyHpScale: 1.8,

  // Fatigue (2026-09-30, DECISIONS.md "Fatigue replaces per-role backfire
  // odds") — first-pass strawmen, see the FightConfig docstring for the shape.
  // The backfire anchors replace the old per-role 0.12 +/- slope (which ran
  // ~9% for a tank to ~16% for a damage unit). With ~6 chains a fight, a flat
  // 12% would put a backfire in about half of all fights, so the fresh anchor
  // sits well under it and only a worn unit gets near it.
  fatigueMax: 100,
  fatigueTierFloors: [25, 50, 80],
  fatigueSweetSpot: 45,
  backfireAtFresh: 0.03,
  backfireAtSweetSpot: 0.1,
  backfireAtBreaking: 0.55,
  fatigueContinuationBonus: 0.1,
  fatigueMagnitudeBonus: 0.35,

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
  chainScorchBase: 6,
  chainExposeBase: 18,
  chainWardBase: 3,
  chainMendBase: 4.5,
  // 2026-09-15 freeze-visibility pass: cut from 0.8 now that links ADD UP
  // instead of a Math.max overwrite (fight.ts's resolveChainHit stun case) —
  // at the old value a full 7-link chain would freeze a body for ~32s in a
  // ~20s fight. 0.25 -> 0.75 on 2026-09-21, same ~3x as the four bases above
  // and for the same reason; a full chain still totals ~10s of freeze. Still
  // not re-verified against completion rate or the failsafe-termination rate
  // in its own right.
  chainStunBaseSec: 0.75,
  chainBraceShieldFraction: 0.04,
  chainQuakeBase: 4,
  chainFrostboltBase: 9,
  chainFrostboltFreezeSec: 0.5,
  chainSiphonBase: 9,
  chainSiphonHealFraction: 0.6,
  chainCauterizeHealBase: 3,
  chainCauterizeBurnBase: 3,
  chainChillSec: 0.5,
  // NOT rescaled by the 2026-09-21 pass: guard is a flat charge per rung and
  // never reads the escalation curve (see its docstring above).
  chainGuardChargesPerRung: 1,

  // Marks and payoffs (2026-09-30) — first-pass strawmen, see the docstrings
  // above. Exposed at 12%/stack means a full 7-rung expose chain reads as
  // roughly +80% damage on the target; Burn at 3/stack/second is small alone
  // on purpose, so Open wound and Spread have room to matter.
  exposedDamagePerStack: 0.12,
  exposedStackCap: 10,
  burnTickSec: 1,
  burnDamagePerStack: 3,
  burnDecayPerTick: 1,
  shieldCapFractionOfMaxHp: 0.5,
  chainWardShield: 4,
  chainShieldPerLevel: 6,
  executeHpFraction: 0.35,
  shatterMult: 2,
  punishDamagePerStack: 1.5,
  deepFreezeMult: 3,
  openWoundMult: 3,
  spikedShieldExposeStacks: 2,
  bulwarkShield: 25,
  cascadeMaxDepth: 6,
  weakSpotPerStack: 0.25,
  crackThreshold: 5,
  crackSpendStacks: 2,
  crackFreezeSec: 1,
  hunterMarkStacks: 1,
  coldSnapSec: 1.5,
  brittleExposePerSec: 0.5,
  frostbiteBurnPerSec: 2,
  permafrostChainBonus: 0.15,
  kindlingBurn: 1,
  infernoPerTick: 1,
  infernoCap: 15,
  smokeShieldFraction: 0.5,
  overflowFraction: 1,
  shieldBashFraction: 0.25,
  shatterguardFreezeSec: 1,
  aegisCapFraction: 1,
  momentumPerChain: 0.1,
  momentumCap: 10,
  secondWindHpFraction: 0.3,
  secondWindChargeFraction: 0.5,
  ironHideHpPerStack: 90,
  bloodlustChargeFraction: 0.4,
  fortressReflectFraction: 0.1,
  thermalShockMult: 5,
  killingFrostHpFraction: 0.5,
  cinderShieldBurn: 2,
  phoenixHpFraction: 0.3,
  phoenixShield: 20,
  wildfireDecayFraction: 0.5,
  emberHeartBurn: 5,
  frostCrownSec: 4,
  huntersEyeStacks: 2,
  bastionShieldFraction: 0.08,
  restlessChargeFraction: 0.7,
  restlessFatigue: 2,

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
  relicRound: 0,
  startingSlots: 3,
  maxSlots: 5,
  maxRosterSize: 10,

  offersPerWin: 3,
  chainLevelStep: 1,
  chainLevelCap: 5,
  cardCap: 8,
  cardWeight: 1.2,
  cardConnectBoost: 1.5,
  duoBoost: 6,
  cardGroupWeightCap: 12,
  borrowWeightFraction: 0.25,
  maxUpgradesPerRole: 2,
  upgradeOptionsPerRole: 2,
  buildOffersGuaranteed: 1,
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

  // First-pass strawmen — see the RunConfig docstring. Tuned so a unit that is
  // fielded every round drifts toward the sweet spot by mid-run rather than
  // maxing out in a handful of fights.
  fatiguePerFight: 3,
  fatiguePerHpLost: 25,
  fatiguePerBackfire: 4,
  fatigueBenchRest: 12,
  restFatigueCut: 30,
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

/** How worn a unit is, as a fraction of `fatigueMax` in [0, 1]. Clamped so a
 * stray out-of-range value can't push any of the fatigue formulas below off
 * their anchors. */
export function fatigueFraction(cfg: FightConfig, fatigue: number): number {
  return cfg.fatigueMax > 0 ? Math.max(0, Math.min(1, fatigue / cfg.fatigueMax)) : 0;
}

export type FatigueTier = "fresh" | "worn" | "frayed" | "breaking";

/** The tier a fatigue value falls in — presentation only, see
 * fatigueTierFloors. */
export function fatigueTier(cfg: FightConfig, fatigue: number): FatigueTier {
  const [worn, frayed, breaking] = cfg.fatigueTierFloors;
  if (fatigue >= breaking) return "breaking";
  if (fatigue >= frayed) return "frayed";
  if (fatigue >= worn) return "worn";
  return "fresh";
}

/** The chance a firing chain backfires, as a function of the firing unit's
 * fatigue (DECISIONS.md 2026-09-30). Piecewise linear through three anchors —
 * backfireAtFresh at 0, backfireAtSweetSpot at fatigueSweetSpot,
 * backfireAtBreaking at fatigueMax — so the rise is gentle to the sweet spot
 * and steep after it (see the FightConfig docstring for why). Pure, same
 * convention as chainEscalationFactor. Clamped to [0, 1] defensively. */
export function backfireChanceFor(cfg: FightConfig, fatigue: number): number {
  const f = Math.max(0, Math.min(cfg.fatigueMax, fatigue));
  const sweet = Math.max(0, Math.min(cfg.fatigueMax, cfg.fatigueSweetSpot));
  let p: number;
  if (f <= sweet) {
    p = sweet > 0 ? cfg.backfireAtFresh + (cfg.backfireAtSweetSpot - cfg.backfireAtFresh) * (f / sweet) : cfg.backfireAtSweetSpot;
  } else {
    const span = cfg.fatigueMax - sweet;
    p = cfg.backfireAtSweetSpot + (cfg.backfireAtBreaking - cfg.backfireAtSweetSpot) * ((f - sweet) / span);
  }
  return Math.max(0, Math.min(1, p));
}

/** The factor a unit's fatigue multiplies every escalated chain rung by:
 * 1 when fresh, 1 + fatigueMagnitudeBonus at fatigueMax. */
export function fatigueMagnitudeMult(cfg: FightConfig, fatigue: number): number {
  return 1 + cfg.fatigueMagnitudeBonus * fatigueFraction(cfg, fatigue);
}

/** prdLookup against cfg's own continuation table, plus the firing unit's
 * fatigue bonus, damped by cfg.chainContinuationScale (default 1, inert) — see
 * that field's own docstring for why the scale exists as a separate knob on
 * top of the table. `fatigue` defaults to 0 so a caller that has no unit to
 * ask (a check) gets the plain table. Clamped to [0, 1] defensively, same
 * convention as backfireChanceFor.
 *
 * 2026-09-13 ("a hero's chain names its own enemy" rebuild): heroes no longer
 * carry their own continuation table — every hero reads this same one. What
 * differs between heroes now is the EFFECT a rung produces (ChainEffect
 * above), and, since 2026-09-30, how worn the unit is. */
export function chainContinuationChance(cfg: FightConfig, hitsSoFar: number, fatigue = 0): number {
  const raw = prdLookup(cfg.chainChanceByHitsSoFar, hitsSoFar) + cfg.fatigueContinuationBonus * fatigueFraction(cfg, fatigue);
  return Math.max(0, Math.min(1, raw * cfg.chainContinuationScale));
}
