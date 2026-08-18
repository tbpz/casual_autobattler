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
   * then lands windupDamageMultiplier x its own base damage (scaled by the
   * enrage multiplier below) on whoever it locked onto. A telegraph is a
   * dread beat with no player input required — you watch to see if the
   * named hero survives it.
   */
  windupIntervalSec: number;
  windupTelegraphSec: number;
  windupDamageMultiplier: number;

  /**
   * The enrage clock (2026-08-07 rebuild) — the mechanism that makes
   * slowness cost something. Enemy damage (normal attacks AND wind-ups)
   * holds at 1x until enrageStartSec into the fight, then ramps linearly by
   * enrageRampPerSec per second, uncapped. This is a within-fight ramp that
   * resets every fight — NOT a cross-fight damage scale (run.ts's comment on
   * scaledArchetype records that scaling enemy damage across the run's 5
   * fights at 1.08 collapsed win rate from ~100% to ~13% by fight 3; this is
   * a different axis, deliberately reset to 1x at the start of every fight).
   */
  enrageStartSec: number;
  enrageRampPerSec: number;
  /**
   * 2026-08-08 (root-cause pass, same as healMaxFractionOfTargetMaxHp above):
   * enrage also scales with the fraction of the enemy side's starting HP
   * already destroyed — a wounded enemy hits back harder. Before this, enrage
   * was purely wall-clock, which meant damage output was ALSO the best
   * defensive stat: every enemy threat (attack cadence, the wind-up, enrage
   * itself) is time-metered, so a comp that killed fast enough (e.g.
   * bracer+vex+cairn's 14s fights) reduced its OWN exposure to all three at
   * once and simply never reached the danger the ramp was meant to create.
   * This term makes killing fast cost something: a burst comp still reaches
   * the angry phase, just via HP destroyed rather than seconds elapsed, so
   * speed alone no longer removes exposure. lostFraction runs 0->1 over a
   * fight; multiplied by this factor and added straight to the multiplier
   * (see fight.ts's enrageMultiplierAt).
   */
  enrageFromEnemyHpLostFactor: number;

  /** Chain PRD by bonus-hits-so-far: index 0 = chance the *first* bonus hit
   * after ignition lands, last entry repeats (capped) beyond that. */
  chainChanceByHitsSoFar: number[];
  /** Bonus hit N magnitude = round(base * chainHitMultiplier *
   * chainEscalationFactor(N) * hero.chainAffinity), where base is the hot
   * hero's own damage stat for an attacker or its own healPerBeat for a
   * healer. Applies identically whether the chain is aimed right or
   * backfiring (2026-08-14 chain rebuild) — a high-affinity hero's backfire
   * is exactly as loud as its payoff.
   *
   * 2026-08-15 (chain-payoff-axis pass): N was replaced by
   * chainEscalationFactor(N) — see chainEscalationKneeHit/StepMultiplier
   * below and config.ts's chainEscalationFactor() — so the payoff's
   * unpredictable spread now comes from how LONG a chain runs (decided live,
   * hit by hit) rather than from chainAffinity (known at draft time,
   * compressed 0.3-1.6 -> 0.7-1.4 in heroes.ts for exactly this reason). */
  chainHitMultiplier: number;
  /** Hits 1..chainEscalationKneeHit escalate linearly (factor = hitIndex,
   * unchanged from the pre-2026-08-15 formula). Beyond the knee, each
   * additional hit adds chainEscalationStepMultiplier instead of 1 — see
   * chainEscalationFactor() below. Deliberately the same hit count as
   * chainFullTellThreshold (5) so the mechanical jump and the visual jump
   * (fightView.ts's chain spectacle ladder) land on the same hit. */
  chainEscalationKneeHit: number;
  /** See chainEscalationKneeHit above. 3 means a chain that reaches hit 7
   * escalates to knee + (7-knee)*3 = 4 + 9 = 13, vs. a pre-2026-08-15 flat 7
   * — the length axis now carries roughly a 40x spread between a 1-hit and a
   * 7-hit chain (sum of the escalation curve across a full chain, divided by
   * the first hit's own factor), which is what makes chain LENGTH — not
   * which hero fired it — the thing a player genuinely cannot call in
   * advance. See checks/chaindist.ts's escalation-vs-identity assertion. */
  chainEscalationStepMultiplier: number;
  /** Hard cap on chain length — added after the first batch pass found
   * chains running to 15-16 hits: chainChanceByHitsSoFar's last entry (0.9)
   * repeats forever once past the table, so the geometric tail averages 10
   * MORE hits past that point with no natural stop. Uncapped, multiplicative
   * per-hit damage means a chain that gets going almost never ends before
   * the enemy is deleted outright, and the fight's outcome collapses to
   * "did ignition fire" rather than staying a race. This caps the escalation
   * without touching the PRD table's shape (still easier to extend once a
   * chain is going — see chainChanceByHitsSoFar). */
  chainMaxHits: number;
  /** While a hero is hot, its next-beat advance is multiplied by this
   * (< 1 = faster) instead of the full attackIntervalSec — the chain
   * visibly accelerates the hot hero's cadence. */
  hotBeatIntervalFactor: number;

  /** Chain length (bonusHitsLanded) at/above which the render layer shows a
   * quiet callout on top of the base hit. Below this, a chain hit gets only
   * a slightly bigger damage number. Unlike before the 2026-08-14 chain
   * rebuild, this no longer gates WHETHER a chain glows or attributes — a
   * hero going hot, and whether it's a backfire, is loud from hit 1 (see
   * events.ts's TickSnapshot.chainBackfire) — this only gates the callout's
   * escalating LOUDNESS tier. */
  chainTellThreshold: number;
  /** Chain length at/above which the render layer shows the FULL spectacle
   * (shake, escalating font, loud callout). This is deliberately the same
   * threshold batch/report.ts's fractionWinsWithChain3Plus already tracks,
   * so tuning "how rare is the big moment" and "how rare is the show" stay
   * the same knob. */
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
}

export interface RunConfig {
  fight: FightConfig;
  fightsPerRun: number;
  /** Residual global multiplier on top of each fight's AUTHORED encounter
   * (sim/encounters.ts's ENCOUNTERS table, 2026-08-09) — still
   * maxHp * difficultyRampFactor^fightIndex, applied to every bruiser/grunt
   * in that fight's composition. Kept as a single batch-tuning knob for
   * "make the whole curve steeper/shallower" without re-authoring all 5
   * encounters by hand; the actual SHAPE of each fight's difficulty now
   * comes from the table, not this exponent. */
  difficultyRampFactor: number;
  /** Same, for per-hit damage — see difficultyRampFactor above and
   * sim/encounters.ts's makeEncounterEnemySide. Deliberately gentler than
   * the HP ramp, same historical reasoning as before this pass: HP-only
   * scaling has a blind spot against fast, well-protected comps. */
  difficultyDamageRampFactor: number;
  /** Heroes FIELDED per fight (roster.ts) — the actual fight is always this
   * many, never fewer (this is what RC4's fix guarantees). The enemy side's
   * composition is no longer a fixed count against this — see
   * sim/encounters.ts, where each fight authors its own headcount (Pack
   * fields 5 grunts and no bruiser; The Wall fields 1 bruiser alone). */
  playerN: number;

  /** Heroes DRAFTED once at run start (roster.ts's RosterState) — the
   * run-level build commitment. Always >= playerN; the difference is the
   * bench. See config.ts's DeathPolicy-removal docstring above and
   * roster.ts's top docstring for why this replaced deathPolicy. */
  rosterSize: number;

  /** Fraction of a FIELDED hero's own maxHp granted between fights, no
   * input, capped at their own max (see roster.ts's applyFightResultToRoster).
   * Deliberately per-hero-proportional rather than a flat HP amount — a flat
   * amount silently favors low-maxHp heroes and specifically starves the
   * tank (see this field's 2026-08-08 history for the batch numbers that
   * caught it). Cut further 2026-08-09 (0.55 -> 0.25) now that a fielded
   * hero's exposure is compensated by benchedRecoverFraction below — see
   * that field's docstring for why the two move as a pair. */
  autoRecoverFraction: number;
  /** Fraction of a BENCHED (living, not fielded this fight) roster hero's own
   * maxHp granted between fights — deliberately HIGHER than
   * autoRecoverFraction (2026-08-09, roster/bench pass): resting is the
   * reward for not fielding a hero, which is what makes the bench a real
   * rotation decision rather than "always field your best 3" — a hero left
   * out after a rough fight comes back meaningfully healthier next time,
   * while the three who fought carry real, slower-healing wear. */
  benchedRecoverFraction: number;

  coinPerWin: number;
  coinBonusOnIgnition: number;
  healCoinCost: number;
  healHpAmount: number;
  upgradeCoinCost: number;
  /** Flat bonus added to every player hero's per-attack damage, rest of the run. */
  upgradeDpsBonus: number;
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
  // (interval 5s, x3.5) combined with the enrage ramp and the larger enemy
  // pool to produce ~0% run completion across every squad. Backed off
  // further on a second pass once the enemy pool itself came back down —
  // 9s cadence, 2.0x base damage still leaves a 45hp Vex on ~27hp
  // (survivable once, dangerous twice) while landing well inside Bracer's
  // 280hp buffer.
  windupIntervalSec: 5,
  windupTelegraphSec: 1.5,
  windupDamageMultiplier: 2.0,

  // Enrage (2026-08-07 rebuild, retuned after the first batch pass): holds
  // at 1x for the first 20s, then ramps a gentle 2.5%/sec — a ~28s fight
  // ends near x1.2 enemy damage, not x1.8. Resets every fight; see this
  // file's FightConfig docstring for why this must NOT compound across the
  // run's 5 fights the way HP scaling does.
  enrageStartSec: 20,
  enrageRampPerSec: 0.025,
  // 2026-08-08 (root-cause pass): started at 0.6, walked back to 0.25 during
  // the 20-squad batch sweep — 0.6 turned out to double-punish SLOW fights
  // rather than selectively reaching fast ones (every WON fight ends at 100%
  // enemy HP lost by definition, so the term reaches its cap in every win
  // regardless of squad; a slow fight just spends more real seconds exposed
  // while ramping through it, so it ate more total bonus damage than the fast
  // comps it was aimed at). At 0.25, an enemy side ground down to 50% HP is
  // hitting x1.125, and to 10% HP is hitting x1.225 — enough that a burst
  // comp still feels real pressure it didn't used to, without re-punishing
  // the already-slower squads harder than the fast ones it targets.
  enrageFromEnemyHpLostFactor: 0.25,

  chainChanceByHitsSoFar: [0.7, 0.75, 0.8, 0.85, 0.9],
  // Multiplicative off the hot hero's own damage (2026-08-07 rebuild,
  // replaces the flat bonusHitStep/bonusHitCap table) — see this file's
  // FightConfig docstring.
  chainHitMultiplier: 1,
  chainMaxHits: 7,
  hotBeatIntervalFactor: 0.6,

  // 2026-08-15 chain-payoff-axis pass — see chainEscalationKneeHit/
  // StepMultiplier's own docstrings above.
  chainEscalationKneeHit: 4,
  chainEscalationStepMultiplier: 3,

  // 2026-08-15 chain-payoff-axis pass: raised from 2/3 to 3/5, matching the
  // escalation knee above so the mechanical jump (hit 5 starts escalating 3x
  // as fast) and the visual jump (fightView.ts's spectacle ladder) land on
  // the same hit — a player should be able to tell a cascade from a good
  // chain without reading the number. Below chainTellThreshold (hits 1-2), a
  // chain hit is legible (tracer, popup, HUD) but gets no callout at all —
  // deliberately, per the "no chain is silent but escalation is back-loaded"
  // rule this pass is built around.
  chainTellThreshold: 3,
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
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  fight: DEFAULT_FIGHT_CONFIG,
  fightsPerRun: 5,
  // bruiser/grunt (a single global archetype shared by every fight) is GONE
  // (2026-08-09, encounter-table pass) — each fight's enemy composition and
  // stat blocks are now authored directly in sim/encounters.ts's ENCOUNTERS
  // table. History of the pre-pass HP/damage tuning (160/50 -> 280/90 ->
  // 155/48, and the ramp-factor walk below) lives in DECISIONS.md rather
  // than here now that there's no longer a single archetype for it to
  // describe.
  //
  // These two ramp factors are now a residual GLOBAL multiplier on top of
  // each encounter's authored numbers (see this field's RunConfig
  // docstring) — deliberately much gentler than the pre-pass values (1.06 /
  // 1.045), since the table's per-fight authored shape now carries most of
  // the curve. Batch-tuning knob, not the primary difficulty lever anymore.
  difficultyRampFactor: 1.03,
  difficultyDamageRampFactor: 1.02,
  playerN: 3,

  // Draft 5 of the 6-hero pool at run start, field 3 each fight (2026-08-09
  // roster/bench pass — see this file's DeathPolicy-removal docstring and
  // roster.ts). Every combination but one (rosterSize = pool size - 1) keeps
  // a real bench; the pool has exactly 6, so 5 is the largest draft that
  // still leaves a choice of who to leave out.
  rosterSize: 5,

  // Converted from a flat autoRecoverHp (200) to a fraction of each hero's
  // OWN maxHp (2026-08-08) — the flat amount fully erased attrition (every
  // squad completed every run at 0.00 deaths) AND, once cut to compensate,
  // inverted the risk dial: at a flat 90, any hero with maxHp <= 90 (Rook,
  // Vex, Ward) was topped off to full every fight regardless of squad, while
  // Bracer (280 maxHp) recovered only ~32% and silently carried the rest as
  // permanent attrition — so the TANK-based "comfortable" squad collapsed to
  // 3.5% run completion while the glass-cannon "greedy" squad rose to 65.9%,
  // exactly backwards. A fraction recovers every hero proportionally to its
  // own max, so the ramp above can raise real difficulty without punishing
  // one archetype specifically. See roster.ts's applyFightResultToRoster.
  //
  // Cut again 0.55 -> 0.25 (2026-08-09, roster/bench pass): with a 5-hero
  // roster now absorbing what used to be pure attrition, free recovery this
  // generous made HP carry between fights almost irrelevant — see
  // benchedRecoverFraction below, the field this one is now tuned opposite.
  autoRecoverFraction: 0.25,
  // See benchedRecoverFraction's own docstring on RunConfig above (why
  // benched recovers faster than fielded). 0.45 chosen so a hero rested one
  // fight comes back meaningfully ahead of one that fought every fight, but
  // still short of a full heal — rotation helps, it doesn't erase the run's
  // attrition entirely.
  benchedRecoverFraction: 0.45,

  coinPerWin: 10,
  coinBonusOnIgnition: 5,
  // 2026-08-09 fix: was 16 against a max of coinPerWin+coinBonusOnIgnition =
  // 15/fight, so the FIRST spend decision in every single run was
  // structurally unaffordable no matter what happened in fight 1 — the coin
  // economy was dead on arrival. 10 is affordable off any single win.
  healCoinCost: 10,
  healHpAmount: 25,
  upgradeCoinCost: 45,
  upgradeDpsBonus: 2,
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
 * chainHitMultiplier/chainEscalationKneeHit/StepMultiplier docstrings and
 * fight.ts's chainAttackMagnitude/resolveChainHit, the two call sites).
 * Linear through the knee, then steeper by stepMultiplier per hit beyond it
 * — pure and hero-agnostic, so the same curve applies to every hero's own
 * base stat and chainAffinity multiplicatively. */
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
