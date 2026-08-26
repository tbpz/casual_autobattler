# Decision Log — Casual Roguelike Autobattler

> **What this file is:** an append-only history of decisions and their rationale.
> **Rules:** never edit or delete an existing entry; only add new ones. Newest at the top.
> **When to read it:** only to answer a "why did we decide X?" question — grep it, don't read top-to-bottom. The current state lives in [STATE.md](STATE.md), not here.
> **Appending:** use the `decision-log` skill — it carries the format, the word budget, and the rules that keep entries grep-safe.
> **Archive boundary:** entries below the `ARCHIVE` rule predate the 2026-07-18 pivot and describe a superseded game design (hex grid, elevation, deploy zones, timed ultimate, fog-of-war, 5-heroes-plus-bench). Read them as history, not live rationale.
>
> Entry format: `## [YYYY-MM-DD] Title` → **Decision** / **Why** / **Replaces**.

---

## [2026-08-27] CLOCK/WOUNDED cannot price chain shape's tempo tradeoff — shape needs a different lever

- **Decision:**
  - CLOCK/WOUNDED does not and cannot price chain shape's tempo tradeoff at any tuning.
  - Chain shape needs a lever other than tempo, or the 2026-08-26 CLOCK/WOUNDED-as-shape-fix approach gets replaced.
  - CLOCK/WOUNDED itself stands as real, load-bearing general difficulty pacing — this narrows its stated purpose, it doesn't retire the mechanism.
- **Why:**
  - Measured via `npm run measure:enrage` (new `batch/enrageLeverage.ts`), n=1500: burst-leaning vs grind-leaning fields differed in mean fight duration by only ~0.34–0.46s, against CLOCK's 12-second tier spacing.
  - A retimed-CLOCK arm (tiers moved inside the real measured p10–p90 duration band, built specifically to test whether timing was the fix) left the duration delta and the shape completion ranking essentially unchanged.
  - That same retimed arm raised overall difficulty sharply (+8.9pt completion swing) — a real effect, but orthogonal to shape.
  - Enrage overall is causally real and load-bearing: removing it entirely swung completion +9.1pt at n=1500 (McNemar z=6.05).
  - That load-bearing effect is concentrated almost entirely in fight 5 — fights 1-4 win rate moved <1.5pt with enrage removed, fight 5 moved 9.6pt.
- **Replaces:**
  - Narrows [2026-08-26] "Enrage split into two visible, telegraphed threats": that entry's shape-tempo rationale is superseded by this measurement; its general-difficulty rationale stands.

---

## [2026-08-26] Enrage split into two visible, telegraphed threats — CLOCK and WOUNDED — replacing the silent continuous ramp

- **Decision:**
  - The single continuous enrage multiplier (`sim/fight.ts`'s `enrageMultiplierAt`) is replaced by two discrete, named threats: CLOCK (staged wall-clock tiers — the grinder's tax) and WOUNDED (a one-time spike on enemy HP lost — the burster's tax).
  - Each CLOCK tier telegraphs before it lands, mirroring the bruiser wind-up's telegraph/land split.
  - A persistent enrage HUD (`render/fightView.ts`) shows both threats live, replacing the old single `enrageStart` callout.
  - `sim/projection.ts` now forecasts CLOCK tiers crossed and WOUNDED's timing on the field-pick and pre-fight screens, before the pick is committed.
  - Chosen over reweighting the ramp in place, or shipping visibility only with no balance change.
- **Why:**
  - Root-cause pass on the 2026-08-25 test's L4 finding: the old ramp had no on-screen surface, no felt edge, and stopped discriminating slow from fast play once the 2026-08-08 pass added the HP-lost term.
  - Chain shape's only remaining content, after the 2026-08-20 EV-equalization pass, is tempo — a lever with no felt tempo cost left shape nothing to attribute to.
  - `npm run check` passes unchanged; `npm run batch -- --n 1000` holds default-roster completion ~22%, matching the prior ~23% band.
- **Replaces:**
  - Supersedes `config.ts`'s `enrageStartSec`/`enrageRampPerSec`/`enrageFromEnemyHpLostFactor` fields.
  - Moves STATE.md's Next up #1 toward playable — pending a played re-run of `ATTRIBUTION_TEST.md` against L4.

---

## [2026-08-25] Attribution test played: attribution reads, but only the charge bar is a complete lever

- **Decision:**
  - `ATTRIBUTION_TEST.md` was run on the fixed build — 11 cards, the lever x link grid, both
    probes — resolving STATE.md's Next up #1. Cards: 9 OWNED, 2 DICED, no FOOLED/BLIND/MOOT.
  - The 2026-08-17 perception failure is resolved: no card scored BLIND or FOOLED.
  - The grid locates the remaining break: L3 charge bar works; L2 bodies and L4 shape weak;
    L1 draft and L5 coin broken.
  - L3 is the only lever reaching link 5 — the session's single "next time I would" names
    charge-bar timing.
  - Probe A: chain shape is perceived as two shapes (long fuse vs. steep), not the five the
    2026-08-20 rework designed for.
  - L5 coin spend appears in none of the 12 cards' stated reasoning.
  - The OWNED count overstates live attribution — several picks were forced by attrition, and a
    true cause named for a forced pick still scores OWNED.
- **Why:**
  - Played verdict, written before each reveal under `?test=1`, so the cause was named without
    the game's explanation available.
  - L1's broken score matches Probe C's predicted ~3-point draft spread — a tuning fact, not a
    legibility failure.
  - Raw cards kept at `prototype/ATTRIBUTION_TEST_RUN_CARDS.md`.
- **Replaces:**
  - Resolves STATE.md's Next up #1 and its chain-shape open question.
  - Confirms the 2026-08-20 shape rework at "see it" and "connect it", not at "change it".
  - Partly falsifies STATE's bet that a drawn encounter keeps the field pick a live read.

---

## [2026-08-22] Projection survival solves the real enrage ramp instead of clamping a divide-by-zero

- **Decision:**
  - `surviveSec` and `tankHoldsSec` (`sim/projection.ts`) no longer divide HP by `max(netIncoming, 0.01)` — that guard, once healing met or exceeded mean incoming DPS, was silently returned as a fabricated survival time in the tens of thousands of seconds.
  - Both now solve a closed-form time-to-deplete against the real two-phase incoming-damage curve (flat, then linearly ramping past `enrageStartSec`) — the same ramp `fight.ts`'s `enrageMultiplierAt` applies live, not a flat mean taken only over the expected kill window.
  - Both are clamped to `cfg.maxFightSec` — the sim's own hard tick cutoff — instead of ever surfacing `Infinity` or an unbounded number.
- **Why:**
  - The flat-rate model was already an approximation calibrated to the kill window; dividing by a divide-by-zero guard past that window produced numbers with no physical meaning, not just an inaccurate one.
  - Measured as a common case (10% of realistic field-pick projections, 14 of 20 possible drafts — any draft with a healer), not an edge case — concentrated on the "Anvil" encounter, which appears in 2 of every 3 runs. Exactly reproduces the live bug: a healer draft vs Anvil read surviveSec=48500s/tankHoldsSec=18915s for a ~36s fight.
  - A 4,800-combo sweep (fielded squads x encounters x HP fractions x dpsBonus) confirmed the fix changes zero of the four pinned band-asserting fixtures in `checks/projection.ts` — no retuning needed.
- **Replaces:**
  - Corrects a defect in the 2026-08-07/08 "fight causality rebuild" / root-cause-pass projection math.

---

## [2026-08-20] Chain magnitude becomes uniform per kind; shape (fuse length + escalation curve) becomes the pick-time axis

- **Decision:**
  - `chainAffinity` is volatility-only now (feeds `backfireChanceFor` exclusively) — no longer scales chain payoff magnitude.
  - Every attacker's chain converges on one absolute expected-net-value target, every healer on another (`sim/heroes.ts`'s `CHAIN_EV_TARGET_DAMAGE`/`CHAIN_EV_TARGET_HEAL`).
  - Each hero carries its own `ChainProfile` (fuse length, escalation knee/step) — the four attackers and two healers now differ in shape, not size.
  - Pick screens show a shape sparkline + shape label + backfire-risk pips (`render/heroPickShared.ts`) in place of the old chain-output pip meter.
- **Why:**
  - The 2026-08-17 played session found chain length dominates payoff by ~39x versus chainAffinity's ~2x, and the old pip meter had a dominant/dominated hero in 2 of 3 role slots — the "safe" pick was strictly worse, not a real tradeoff.
  - Equalizing net EV analytically (`sim/config.ts`'s `chainMagnitudeScaleAbsolute`) removes the dominance without removing choice, since fuse length and escalation shape still diverge widely and interact with the encounter drawn.
- **Replaces:**
  - Supersedes the 2026-08-19 entry's magnitude-ranking pip meter — the backfire-pricing mechanism from that entry is kept, only the payoff-ranking pip meter is replaced.

---

## [2026-08-19] Attribution fix scope: honest CHAIN pips + price chainAffinity as backfire risk, not a full rebalance

- **Decision:**
  - The CHAIN pip meter (squad/field pick) now ranks heroes by chain-output coefficient (damage or healPerBeat x chainAffinity), not raw chainAffinity.
  - `backfireChance` is no longer flat — it scales with the firing hero's own chainAffinity (`backfireChanceFor`, `sim/config.ts`), so higher affinity is a real gamble, not free EV.
  - Rebalancing hero stats to fix Cairn beating Ward is explicitly deferred.
- **Why:**
  - A measurement sweep (n=3000, three designs) found chainAffinity's LEVEL is mechanically real: scaling every hero's affinity 0.6x-1.4x moved completion monotonically ~6.5 points.
  - The CHOICE between heroes on affinity is not real: flattening the spread didn't hurt completion, and swapping only the support (tank/damage held fixed) had Cairn beat Ward in all four pairings despite lower affinity.
  - chainAffinity was unpriced — flat 0.12 backfireChance made more affinity strictly more EV, never a tradeoff (Hollow vs Bracer was +73% affinity, +9% DPS, for only -7.7% maxHp).
  - Chosen over a UI-only fix (no risk pricing) and a full rebalance (also fixes Cairn/Ward) via direct user choice — the rebalance touches every pinned balance check and needs its own played verdict.
- **Replaces:**
  - Resolves STATE.md's Next-up #2 "pick an ownership lever" — chosen and shipped, batch-verified, not yet played.
  - Does not resolve Cairn-beats-Ward, left open (named in `sim/heroes.ts`'s pool docstring).

---

## [2026-08-17] Prototype #1 played and judged: the shape lands, the read fails on perception and attribution

- **Decision:**
  - Prototype #1 was played and judged by Tu for the first time, resolving STATE.md's "Next up #1" gate.
  - Verdict: the shape lands — chains ran unexpectedly long in both directions, and both the payoff and the backfire were genuinely surprising and fun.
  - The shape does not read, on two separate axes: perception and attribution.
  - Perception failed for three causes: `hotBeatIntervalFactor` (`sim/config.ts`) makes the chain the most rushed moment in the fight; every callout (enrage, death, wind-up, chain) shared one DOM element in `render/fightView.ts`, so a chain hit's own tell could be overwritten before it was read; hits below `chainTellThreshold` were silent, with no rendered state at all for "is a continuation roll pending."
  - Attribution failed because chain length is the dominant payoff axis (measured ~39x vs. `chainAffinity`'s ~2x, see the 2026-08-15 payoff-axis entry) and takes zero player input.
  - That's a regression against the 2026-07-26 friend-validation finding that RNG-alone fails "claim as mine," not a newly-excused result — STATE's pre-registration excused only thinness on repeat play, and names attribution as Tu's own need.
- **Why:**
  - Both failures were traced to code (`sim/fight.ts`, `sim/config.ts`, `render/fightView.ts`) and confirmed live in a played session.
- **Replaces:**
  - Resolves STATE.md's "Next up #1." Does not resolve attribution itself — deferred pending a re-judged session once the perception fix (see entry below) has been played.

---

## [2026-08-17] Chain perception fix: dilated inter-hit gaps, a dedicated chain HUD, an end card on every chain

- **Decision:**
  - `render/playback.ts` now advances sim-time at a dilated rate during a chain's inter-hit gaps only; impacts stay at normal wall-clock speed, since their tracer/flinch/popup timing was already decoupled from sim-time.
  - Dilation deepens past the escalation knee and is capped analytically per chain so a long chain can't stall the fight's pace — see `playback.ts` for the mechanism.
  - The chain now renders to its own persistent HUD (title plus a per-hit pip row, visible from hit 1) instead of sharing the single callout element routine events use.
  - Every chain, not only a cascade-tier one, now resolves with an explicit end card that also states the firing hero's own `chainAffinity` multiplier next to the hit count.
  - Routine callouts (enrage, death, wind-up) now queue instead of overwriting each other.
- **Why:**
  - Directly answers the three perception causes named in the entry above.
  - `npm run check` and the chain-length-vs-identity-spread invariant are unchanged after this pass, confirming it is render-only with zero sim impact.
  - Verified live in-browser through a full run, win and loss.
- **Replaces:**
  - Nothing structural — implements the project's existing "chain must read" intent; does not touch the 2026-08-15 payoff-axis decision.

---

## [2026-08-16] STATE.md is sized by a reader framework, not a word budget

- **Decision:**
  - `STATE.md` is now two layers in one file: layer 1 is a self-contained 60-second re-orientation read; layer 2 is a working index (status by piece, unverified bets, open questions, how to work here).
  - The layering answers seven questions an arriving reader asks, in order; the sixth ("what must I not undo, and why?") stays this file's job — STATE only points here.
  - The 1,700-word budget is retired. Four rules replace it, each checkable per line while drafting rather than after: an admission test (does this line change what the reader does next session?), item-count slots per section, one-line-one-claim, and pointer-over-restatement.
  - Mechanism prose is cut from STATE entirely; the claim is a piece's status, the pointer is the code.
  - `REFERENCE.md` is new — near-static material (design spine, reference games, standing constraints), never regenerated by a sync.
- **Why:**
  - A word cap enforced after drafting forced a measure-then-trim pass that re-emitted the whole file, and compressing prose to fit a count made it denser, not more readable — the diagnosed cause of STATE going unread despite being current.
  - Both readers (Tu re-orienting, Claude working) already know the game and can read the code, so mechanism paraphrase was paid for twice — once in STATE, once at the code pointer beside it.
  - Measured before/after: STATE.md 1,703 → 849 words; layer 1 alone is 442.
- **Replaces:**
  - Supersedes the `state-sync` skill's 1,700-word budget and per-section cap table (pre-2026-08-16 version).
- **Caveat:**
  - Unverified: whether the new shape survives more than one real sync without drifting back toward length — the real test is the next sync being single-pass with no trim.

---

## [2026-08-15] Run-to-run depth comes from an expanding option pool, not a difficulty ladder

- **Decision:**
  - The answer to "nothing left to explore after a few runs" is widening the space a run draws from, not re-posing fixed content as a harder question.
  - Three depth sources are endorsed, in order: encounters (the question), offers/modifiers (the tools), heroes (the pieces).
  - A difficulty ladder (Ascension/stakes/Heat-style) is deferred, not rejected — reconsidered once the space beneath it is wide.
  - Tiered, magnitude-scaled feedback is adopted alongside it in its surgical form only, never as the primary answer.
  - This build is scoped to encounters, the chain's payoff axis, and the feedback defects; an offer system is a separate future build.
- **Why:**
  - Diagnosed cause: only 6 distinct drafts existed and the fight order was fixed, so two runs where the player makes the same 11 taps differed only by the seed.
  - The 2026-07-24 entry already established that dread arrives when the decision space is fully mapped, not when the dice go quiet.
  - A ladder needs a large space beneath it: Ascension works in Slay the Spire because 350+ cards sit underneath, and over a space mapped in 6 runs it only yields the same solved run played tighter.
  - Expanding the pool passes the 2026-07-26 fake-decision filter on all three counts.
  - Tu re-derived the pattern himself ("offer only tokens never seen at setup, capped to 3, revealed gradually").
- **Caveat:**
  - Pre-play. Verified only that the first widening builds and measures (`npm run check`, `npm run batch`); nothing is judged against prototype #1's completion criteria.
  - This records a direction chosen from a diagnosis, not a result confirmed by play.

---

## [2026-08-15] The run's fights are drawn from a tiered encounter deck, not a fixed sequence

- **Decision:**
  - A run draws its fights from an authored pool tiered early/mid/finale, instead of playing one fixed order every time.
  - The pool is wider than a single run: six new encounters join the original five — contents live in `sim/encounters.ts`.
  - `encounterOrderFor(seed, fightsPerRun)` samples without replacement within each tier.
  - The draw runs on its own RNG stream (`seed ^ 0x9e3779b9`), separate from the run's fight-resolution stream.
  - The drawn order threads through `RunSession`, the headless `runRun`, and both previews, so batch measures the real distribution and what is previewed is what is fought.
  - An encounter may override the wind-up interval and give the enemy a per-beat heal, so a new shape asks a different question instead of restating an old one bigger.
- **Why:**
  - A fixed order is memorizable — the field pick stops being a live read once the answer is known in advance.
  - Tiering is structural, not cosmetic: an untiered shuffle can open a run on the finale, making the difficulty ramp meaningless.
  - The separate stream is deliberate — drawing from the run's shared stream would shift every downstream roll and make existing seeds and prior tuning incomparable.
  - Shipped in `b0c78a1`.
- **Replaces:**
  - Supersedes the fixed `encounterFor(fightIndex)` lookup from the 2026-08-09 authored-encounters entry; that pass's authored shapes stand, only the order becomes drawn.
- **Caveat:**
  - Pre-play. Verified: `npm run check`, `npm run build`, `npm run batch`, and one live click-through where fights 1 and 2 drew two different early-tier encounters with the preview matching the enemy fought.
  - Not verified: any played run, or the criterion this pass exists to satisfy — "after 6 runs, is there still something you haven't tried?"

---

## [2026-08-15] The chain's payoff spread moves from hero identity to chain length

- **Decision:**
  - How long a chain runs — decided live, hit by hit — is the dominant source of payoff spread.
  - Hero identity (`chainAffinity`) is compressed to a tilt on magnitude, not the deciding factor.
  - Escalation is back-loaded: linear early, steepening past a knee hit (`chainEscalationFactor`, `chainEscalationKneeHit`, `chainEscalationStepMultiplier` in `sim/config.ts`).
  - Chain frequency is untouched — this pass moves where a chain's size is decided, not how often one fires.
  - A chain heal gets its own higher cap than a normal heal beat, so a long support chain reads as a real event rather than a slightly bigger tick.
- **Why:**
  - Measured pre-pass: a 7-hit chain was 269 damage for Rook and single digits for Cairn — payoff was knowable at draft time, so the suspense was spent before the dice were rolled.
  - Verified analytically after the pass (`checks/chaindist.ts`): worst-case per-hero length ratio 39x, against an identity ratio of only 2.1x at fixed length.
  - The escalation change alone pushed run completion to ~30.9%; retuning backfire chance held completion within about a point of the pre-pass ~28-30% baseline, measured at n=1500.
  - Shipped in `5ebdbff`.
- **Replaces:**
  - Supersedes the flat, `hitIndex`-linear chain-damage formula from the 2026-08-07 fight-causality-rebuild entry, which did not separate identity spread from length spread.
- **Caveat:**
  - Pre-play. Verified: the in-fight chain HUD's math against hand-calculated escalation values, plus one observed chain-saved-the-fight moment in a partial session.
  - Not verified: a full played run judged against prototype #1's completion criteria — whether a long chain *feels* categorically bigger is untested.

---

## [2026-08-15] Chain spectacle gets an intermediate tier, and scales to the firing hero

- **Decision:**
  - A chain hit below the tell threshold still gets only a slightly bigger number — no callout, same as before this pass.
  - A new intermediate tier now exists: a callout starts at a lower chain-length threshold than the full shake-and-loud-callout spectacle, so a short-but-real chain reads as more than nothing without triggering the full show.
  - The full-spectacle threshold itself moves up to match the length axis's own escalation knee, so the mechanical jump and the visual jump land on the same hit — current value lives in `sim/config.ts`.
  - The ignition callout's visual intensity now scales continuously to the firing hero's own `chainAffinity` — new; the pre-pass tell was uniform regardless of which hero ignited.
- **Why:**
  - Once chain length carries the payoff spread (see the entry above), a single binary spectacle gate can't distinguish a modest chain from a huge one — an intermediate tier and a hero-scaled tell are what let a short chain read as something without overselling it.
  - The full-spectacle trigger stays pinned to the same length a batch metric already tracks (`batch/report.ts`'s chain-length-5-plus fraction) — a self-consistency guard carried forward from the 2026-08-06 pass at the new threshold, so a future retune can't silently let the visual claim drift from the measured reality.
- **Replaces:**
  - Extends, not reverses, the 2026-08-06 "spectacle gated on chain length" entry — that entry established one length gate (3+ hits) for full spectacle with no intermediate tier and no per-hero scaling; this pass adds both and moves the gate to match the new payoff-axis escalation knee.
- **Caveat:**
  - Pre-play. Verified mechanically only — the thresholds fire in code and the batch metric tracks the same length.
  - Not verified: whether the two registers actually read as distinct to a player, which is the entire claim this pass makes.

---

## [2026-08-15] Chain rebuild: persistent charge bar replaces heat/ignition-roll; backfire coin flip replaces gift-flow

- **Decision:**
  - The chain trigger is deterministic: the highest-charge living hero fires the instant its charge crosses `chargeThreshold` — no candidate roll, no ignition-chance PRD table.
  - `charge` (renamed from `heat`) persists across the whole run, including on the bench, instead of zeroing at fight start.
  - `chainAffinity` scales payoff/backfire magnitude only, not accrual rate — every hero's bar fills at the same pace.
  - `heatGift` is removed from `HeroDef`/`HeroState` — charge is private to each hero again.
  - A fired chain resolves via a coin flip (`backfireChance`): the hero's own action repeats at the wrong side instead of the right one, same magnitude formula either way.
  - `chargeThreshold`/`backfireChance` live in `config.ts`, not here — see that file for current values.
- **Why:**
  - Player-facing complaint: the old ignition-roll/heat-gift stack was unreadable — the NEXT tag reshuffling between allies read as noise, not a mechanism a player could model.
  - Measured mid-pass: an initial `chargeThreshold` guess crashed default-draft completion to ~7% (n=800) even with backfire disabled — decoupling `chainAffinity` from accrual spread fire opportunities by raw output instead of concentrating on high-affinity carriers; fight 5 (Champion) relied on that concentration (win rate 31.8%→7.6%).
  - Re-tuning `chargeThreshold` restored fight 5 to a comparable win rate at n=800; `backfireChance` was then set so overall run completion landed within ~1 point of STATE.md's pre-rebuild ~28% baseline, measured at n=1500.
- **Replaces:**
  - Supersedes the heat-meter/ignition-roll mechanism from the 2026-08-07 "fight causality rebuild" entry and the `heatGift` addition from the 2026-08-09 entry below.
  - Known gap opened, not resolved: the coin economy's heal spend lost most of its protective value against the new dominant failure mode (a backfire burst); `always-heal` and `never-spend` measured statistically indistinguishable on run completion at n=3000 — flagged in `checks/chaindist.ts`.

---

## [2026-08-09] Boring-middle root-cause pass: roster/bench replaces deathPolicy, authored encounters replace one scaled archetype, heat flows between heroes

- **Decision:**
  - Death stays permanent for the run (explicit call, overriding this pass's own initial "downed one fight" proposal). The difficulty cliff is fixed by widening what's drafted vs. fielded instead — `sim/roster.ts` (new): a roster drafts once at run start, a smaller squad fields fresh each fight, so a fight is never short-handed even as deaths narrow the draft. `DeathPolicy` (`downAtFightEnd`/`onlyOnLoss`) is removed from `config.ts`, replaced outright by the roster/field split.
  - Enemy composition is authored per fight (`sim/encounters.ts`, new) instead of one archetype scaled bigger each time — each fight now asks a different question. Replaces the single `bruiser`/`grunt` `EnemyArchetype` every prior entry below assumed.
  - Heat can flow between heroes (`heatGift` on `HeroDef`/`HeroState`) instead of staying strictly private per hero.
  - `checks/chaindist.ts`'s primary pinned population is the coin economy ON (`always-heal`), not off.
- **Why:**
  - Player's report: safe builds won 5/5 with no mid-run tension; only ~3 of 20 possible squads were viable.
  - Measured pre-pass: fights 1-3 were a 100% win for all 20 squads; the difficulty ramp contributed nothing for 60% of a run.
  - Measured pre-pass, 60 fights/squad: whichever hero had the highest heat/sec ignited every time (Rook 34/34, Vex 13/13, Hollow 24/24) — a deterministic one-bit choice, not an in-fight variable.
  - Measured pre-pass: forcing every fight to field a full squad alone moved a squad's fight-5 win rate 27.8%→54.5% — isolating short-handedness, not permanence, as the cliff's cause.
  - Every prior `chaindist.ts` pin ran with the coin spend off; turning it on moved run completion 30-45 points on every squad tested.
- **Replaces:**
  - Supersedes the 2026-08-08 "squad size is N=3" closure below — no longer one fixed number; current sizes live in `config.ts`'s `rosterSize`/`playerN`.
  - Supersedes `deathPolicy` from the 2026-08-07 "fight causality rebuild" entry.
  - Known gaps, not blocking: fights 1-3 stay close to risk-free for a double-tank draft (named in `chaindist.ts`); heat-flow's ignition/full-spectacle rate landed above this pass's own "rare, prized" target even after one fraction cut.

---

## [2026-08-08] DECISIONS.md entries are historical evidence, not a live config mirror — closes the 5-vs-3 squad-size gap

- **Decision:**
  - `prototype/src/sim/config.ts` and `heroes.ts` are the sole authority for current tuning constants.
  - A number inside a DECISIONS.md entry is evidence as of that entry's date only — never a current setting.
  - Squad size is **N=3**, per the live build.
  - The pre-pivot "5 heroes + bench" entries (below the `ARCHIVE` rule) no longer bind squad size or anything else.
- **Why:**
  - Two same-day 2026-08-08 entries record `difficultyRampFactor` moving in opposite directions (`1.06→1.12` and `1.12→1.06`); append-only means neither can be corrected in place.
  - `config.ts:395` holds the actual current value; nothing in the log itself signals which entry is current without checking code.
  - `STATE.md`'s Next-up list has carried an unreconciled 5-vs-3 squad-size question since the 2026-07-18 pivot suspended the old roster entries in general but never named this specific contradiction as closed.
  - Raised while auditing why DECISIONS.md was growing fast and getting expensive to grep — see the new `decision-log` skill and this entry's own format, both from the same pass.
- **Replaces:** Nothing structural. Annotates, without editing, the numeric claims in the five 2026-08-08 tuning entries above. Formally closes the old "5 heroes + bench" entries' authority over squad size specifically — they were already suspended in general by 2026-07-18, this names the specific open item resolved.

---

## [2026-08-08] Dominant-squad fix: equal-throughput pool rebalance, a target-relative heal cap, HP-destroyed enrage, and a single-tank aggro cap

- **Decision:** Four changes, made together against the open "bracer+vex+cairn / vex+cairn+ward stay near-100%" gap this pool docstring had been carrying: (1) Vex's DPS is walked down to near-parity with Rook (17.1 → 7.2, via a slower cadence not a smaller hit) and its maxHp raised (45 → 70) so the slower cadence doesn't just trade one death spiral for another; Hollow's maxHp raised (130 → 180) so its HP-for-affinity trade is a real choice; Ward's heal cut (4 → 3) so its hybrid flexibility costs something; Bracer's maxHp trimmed (280 → 195) and damage raised (5 → 7). (2) A new `healMaxFractionOfTargetMaxHp` (0.11) caps a single heal beat at a fraction of the *target's* own maxHp, not a flat amount — a healer can no longer fully erase a squishy attacker's fragility for free. (3) A new `enrageFromEnemyHpLostFactor` (0.25) adds a second enrage term keyed to the fraction of enemy HP already destroyed, alongside the existing wall-clock term — a burst comp now still reaches the "angry" phase, via damage dealt instead of seconds elapsed, so killing fast no longer removes all exposure at once. (4) `fight.ts`'s weighted targeting now caps the tank aggro bonus to the *first* living holding tank — found mid-pass: it had been applying to every living holding tank at once, so a Bracer+Hollow double-tank pick stacked additively and was ~90-100% unloseable by a third route this pool rebalance alone didn't touch. Global difficulty (`difficultyRampFactor` 1.12→1.06, `difficultyDamageRampFactor` 1.045, enemy `bruiser`/`grunt` HP 190/60→155/48, `autoRecoverFraction` unchanged at 0.55) was recompensated downward throughout, since every change above made the base fight harder.
- **Why:** The player's diagnosis, given directly: this comb [sic] is "still too overwhelm that I can spam blindly and win the game and it's boring." A full 20-squad batch sweep (n=400-500) confirmed and widened the known gap: it wasn't 2 squads, it was 5 (bracer+vex+cairn, vex+cairn+ward, bracer+vex+ward all ≥98%; bracer+rook+ward, rook+cairn+ward both ≥93%), and the dominant comp was structurally the one LEAST able to deliver the game's own lead moment — bracer+vex+cairn fired 0.0% of its cascades from below 40% pool, because it won too fast and too safely for the fight's jeopardy beats (dip, wind-up, enrage) to ever engage. Root cause: every enemy threat is time-metered (attack cadence, a 5s wind-up, a 20s enrage clock), so damage output was ALSO the best defensive stat — killing faster reduced ALL of them at once, and nothing charged a price for DPS. A second, independent root cause surfaced mid-tuning: Bracer+Hollow's aggro weights were stacking additively, making any double-tank pick separately unloseable regardless of the third slot. After the fix (20-squad sweep, n=500): 18 of 20 squads land between 21-59% run completion (no blind-spam winner, no near-impossible pick), and the best comp now fires ~30-35% of its cascades from below 40% pool — every one of the 20 squads clears ≥25% on this metric, versus the old best comp's 0.0%. Two squads remain documented exceptions the pass's levers couldn't reach without re-inflating the other 18 back out of band: `rook+vex+ward` (no tank, weak healer, ~0%) and `bracer+cairn+ward` (near-zero real damage output — Cairn's own `damage` stat is decorative, it never attacks while `healPerBeat` is set — ~5-8%). Both are pinned individually in `checks/chaindist.ts`'s new "no dominant squad" sweep rather than silently ignored.
- **Replaces:** Closes the open gap left by the 2026-08-08 "difficulty retuned so the best squad can actually lose" entry below, which explicitly named this as unsolved and requiring a hero-stat-level change. Also flips `checks/projection.ts`'s "default roster bands comfortable" assertion to "bands tight" (the default pick is deliberately no longer a blind-safe win) and retires the old "risk dial: comfortable > tight > greedy" strict-ordering check in `checks/chaindist.ts` — Hollow's higher chainAffinity is now a genuine alternate path to survival rather than a strictly worse HP trade, so "tight" (hollow+rook+cairn) now completes MORE runs than "comfortable" (bracer+rook+cairn), 37.0% vs. 22.6% at n=2000. That ordering assumption no longer holds by design, not by accident.

## [2026-08-08] Every hero gets a visible chainAffinity stat — squad choice becomes the cascade's steering wheel; the hero pool is rebalanced off a dominance ladder

- **Decision:** Every hero in the pool now carries a `chainAffinity` value, shown as pips at squad-pick time, that multiplies both how fast that hero's heat accrues (how *often* it gets a shot at the cascade) and how big its chain hits land (how *big* the payoff is). Rook and Vex are re-cut to trade on this axis instead of Vex simply out-DPS-ing Rook for free (Rook: highest affinity, frequent/modest chains; Vex: high damage, moderate affinity, rare/enormous chains); Hollow and Bracer likewise split on the same axis for the tank role, and Cairn/Ward for support. Ward additionally gains `attacksWhileHealing` — it now attacks and heals on the same beat instead of the heal replacing the attack, so a two-support comp is no longer an automatic loss.
- **Why:** The player's own diagnostic, given directly: they could see the cascade happen "once in a while" and could name the shape of the moment they wanted (low-HP near-wipe turned around by a damage spike), but had no way to *aim* for it — the explicit reference was a Dota player choosing to build Daedalus on Gyrocopter, or picking Phantom Assassin, because he knows that choice buys a specific kind of fun. Measured against the running build: squad choice moved the cascade's full-spectacle rate by only ~4 points across all 20 possible 3-hero squads (21–25%) — there was no steering wheel. Separately, the pool itself was a dominance ladder rather than a set of tradeoffs: Vex out-DPS'd Rook 17.1 vs 6.7 for near-zero cost, and every comp containing both Cairn and Ward completed 0% of runs (two non-attacking supports is a guaranteed loss). After the fix, chainAffinity spread the full-spectacle rate to 20–68% across squads (a ~47-point range), and Rook/Ward both appear in the top 5 comps by spectacle rate — squad choice now visibly changes the cascade's odds and size, not just whether the run survives.
- **Replaces:** Nothing structural — extends the 2026-08-06 "squad pick is the risk dial" entry with a second, cascade-specific axis (that entry's projection/risk-band mechanism is about survival odds; this is about the cascade's odds and size specifically). Also fixes a stale docstring in `heroes.ts` that had documented a Hollow-vs-Bracer dip-rate tuning gap now superseded by this re-cut (see the new pool docstring for the current, still-open gap).

## [2026-08-08] Heat is spent on every ignition roll, not latched once per fight — ties the cascade to danger instead of decoupling from it

- **Decision:** The ignition eligibility check no longer latches after one roll per fight. Instead, whichever living hero has the *highest* heat (not simply the first one over threshold in role order) rolls, and its heat resets to 0 immediately after the roll — win or lose — so it must rebuild before it can roll again. A single persistent PRD counter (`ignitionChanceByAttemptsSinceIgnition`, replacing the old per-fight `ignitionChanceByFightsSince`) tracks failed attempts across rolls rather than across fights, since a fight can now contain several.
- **Why:** The player's cherished moment, stated directly: "my only DPS or Tanker HP gets very low, but then the damage gets much higher, like a critical buff, and they wipe the enemies with near death" — a cascade firing *from a losing position*, not a routine one. Under the previous one-roll-per-fight rule, winning squads took 0.00 deaths per run, so a fight's danger and its cascade opportunity could never co-occur — the cascade was common (~24% of fights) but the *moment* the player wanted was absent. Because heat already accrues partly from damage *soaked*, a squad taking real punishment now rebuilds heat and earns multiple attempts within one fight, while a fast clean win earns one — the tie between danger and the cascade falls out of the mechanism rather than being scripted. Batch-verified on the default squad: `fractionChainsWhileLosing` (ignition firing while the pool is below 40% of its fight-start max) went from ≈0% to 43.6%, against a ≥35% target.
- **Replaces:** The `heatFired` once-per-fight latch introduced in the 2026-08-07 fight-causality rebuild (see that entry, backfilled below) — the heat *mechanism* (per-hero meter, weighted by dealt/soaked/restored) is unchanged, only how many times it can fire per fight.

## [2026-08-08] Auto-recovery between fights is a fraction of each hero's own max HP, not a flat amount — fixes an inverted risk dial and restores real attrition

- **Decision:** `autoRecoverHp` (a flat HP amount added to every hero between fights, capped at their own max) is replaced by `autoRecoverFraction` (a fraction of each hero's *own* max HP recovered instead). The difficulty ramp also gained a second, much gentler axis: enemy per-hit damage now scales slightly per fight index (`difficultyDamageRampFactor`) alongside the existing HP-only ramp (`difficultyRampFactor`, raised 1.06 → 1.12).
- **Why:** Two problems, found in sequence while retuning difficulty upward to fix the "the game cannot be lost" complaint (below). First: at any flat recovery amount low enough to matter, every hero with maxHp below that amount (Rook, Vex, Ward) was topped off to full every single fight regardless of squad, while the tank (by far the highest-maxHp hero) alone carried forward permanent attrition — so cutting the flat amount from 200 toward something meaningful *inverted* the intended risk dial: the tank-based "comfortable" squad collapsed to 3.5% run completion while the glass-cannon "greedy" squad rose to 65.9%, exactly backwards. A fraction-of-own-max recovery heals every hero proportionally instead. Second: even after that fix, two squads (bracer+vex+cairn, vex+cairn+ward — the safest tank, the highest-damage dealer, and a real healer, together) stayed near-100% run completion regardless of how hard the HP-only ramp was pushed, because they kill fast enough that neither more enemy HP nor more exposure time bites — a small damage-ramp axis is what actually threatens a fast, well-protected comp, since it lands regardless of fight length.
- **Replaces:** Nothing named directly, but is the mechanism behind retuning the underlying complaint that the default squad (and 4 others) completed 100% of runs with 0.00 deaths — see the umbrella entry below.

## [2026-08-08] Difficulty retuned so the best squad can actually lose — "the game cannot be lost" was the root cause of "it feels like a solved puzzle"

- **Decision:** Retuned `difficultyRampFactor` (1.06 → 1.12) and `difficultyDamageRampFactor` (new, 1.05) together with the autoRecoverFraction change above, targeting the default/"comfortable" squad landing around 45–65% run completion instead of ~100%. Also redefined the batch harness's `greedy` squad preset (`vex+rook+hollow`, a true no-healer glass build) since Ward's new `attacksWhileHealing` made the old preset (`vex+rook+ward`) nearly as safe as "comfortable."
- **Why:** The player's diagnosis, given directly: "the optimal choices are obvious from the start... the rest is garbage... I just abuse these combinations round to round and get bored." Measured against the running build: the default squad, and 4 of the 20 possible 3-hero squads, completed 100% of runs with 0.00 deaths — the run was structurally unlosable for a well-built comp, which is what makes any single choice feel "solved" rather than risky. After retuning: default squad run completion 65.4%, mean deaths per run 1.18 (was 0.00), and the risk-dial regression (comfortable > tight > greedy by a real margin) holds with comfortable at 65% vs. tight at 16.9% and greedy at 5.3%.
- **Replaces:** Nothing directly — this is the umbrella motivation for the two entries above (chainAffinity's rebalance and the recovery-model fix), which are the actual mechanisms. One known gap remains, undecided and left open: `bracer+vex+cairn` and `vex+cairn+ward` still complete ~100% of runs regardless of ramp (see `heroes.ts`'s pool docstring) — fixing it needs a hero-stat-level change, not another global-ramp pass.

## [2026-08-07] Fight causality rebuild (backfilled 2026-08-08): the tank-break pity gate is replaced by a per-hero heat meter; a bruiser wind-up and an in-fight enrage clock are added

- **Decision:** Backfilled into the log after the fact — this rebuild shipped in code on 2026-08-07 but was never logged as a decision at the time; reconstructed here from the shipped code's own docstrings (`sim/config.ts`, `sim/fight.ts`) so DECISIONS.md stops being behind the code it's supposed to explain. Four changes, shipped together: (1) the 2026-08-06 ignition gate — reachable only once the player's tank line had broken, or the squad was tankless — is replaced by a per-hero HEAT meter (accruing from each hero's own dealt/soaked/restored, weighted by `heatWeightDealt/Soaked/Restored`); the first living hero to cross `heatThreshold` (110) triggers one ignition roll for the fight (later revised same-day-plus-one, see the 2026-08-08 "heat is spent" entry above). (2) The enemy bruiser gains a telegraphed wind-up: it periodically stops attacking, telegraphs against a weighted-random target for `windupTelegraphSec`, then lands `windupDamageMultiplier`× its own damage. (3) An in-fight enrage clock ramps enemy damage 1× → higher, linearly, after `enrageStartSec`, resetting every fight (not compounding across the run). (4) The chain's bonus-hit damage becomes multiplicative off the hot hero's own damage stat (`chainHitMultiplier` × hit index), replacing a flat 20/40/60/80/100 table, with a hard cap (`chainMaxHits`) added after the multiplicative version was found to run chains to 15-16 hits unchecked.
- **Why:** Per the shipped docstrings: the 2026-08-06 tank-break gate made the cascade structurally unreachable on a winning path, and *inverted* — the fastest, riskiest squad had the LOWEST full-spectacle rate (batch-verified at 0.5–0.9%) because it killed the enemy before its own pool could fall far enough to open the gate. Heat-based eligibility lets a fast dealer earn its shot by doing its own job, not by the squad nearly losing. The wind-up and enrage clock were added as the mechanisms that make fragility and slowness cost something now that the tank-break gate no longer structurally forces jeopardy.
- **Replaces:** The 2026-08-06 "squad pick is the risk dial" entry's ignition-gate mechanism (that entry's projection/risk-band framing is unaffected; only what makes a fight *eligible* to ignite changed). Superseded in turn by the 2026-08-08 "heat is spent" entry above, which keeps this heat mechanism but removes the once-per-fight latch.

---

## [2026-08-06] The squad pick becomes the run's risk dial; the cascade is only reachable from a broken tank line

- **Decision:** The player's squad composition determines how dangerous a fight is, via a pre-fight projection (comfortable / tight / losing) computed from mean-value DPS/HP math. The ignition gate (see the same day's "spectacle" entry) is only reachable once the squad's own tank line has broken (or, for tankless comps, the squad is projected to lose from the current position) — not from arithmetic pool-draining alone.
- **Why:** The player named the missing ingredient directly: "these moments have value because they happen once in a while, and the player needs to take a risk to earn that." A safe, balanced comp (tank/damage/support) should win clean and boring, with no cascade available to it. A greedy comp (e.g. two damage dealers, no tank) buys access to the big moment by accepting real danger. This gives "assemble your squad" a mechanical consequence beyond flavor, partially answering the open question of what the optional layer is allowed to modify in the fight.
- **Replaces:** Nothing directly, but changes how the eligibility gate (2026-07-29) is reached — see the "spectacle gated on payoff" and "jeopardy no longer mandatory" entries below, which this decision depends on.

## [2026-08-06] Spectacle (shake, callout, glow, escalating numbers) is gated on the chain's actual length, not on the ignition roll

- **Decision:** The full visual spectacle — screen shake, name callout, permanent hero glow, escalating damage font — fires only once a chain reaches a length threshold (3+), not the instant the ignition roll succeeds. A length-1 chain gets a slightly bigger damage number and nothing else; a length-2 chain adds a small callout and a glow. Ordinary attacks and heals gain their own small damage/heal numbers so they're legible without needing the spectacle vocabulary at all.
- **Why:** Measured directly from the running build: `npm run check:chaindist` showed an ignition rate of 64.65% against a chain≥3 rate of 7.30% — meaning the full light show fired roughly nine times for every one time the payoff it advertised actually happened (confirmed in a sampled run: two consecutive fights returned `ignited=true, chain=0` — full fireworks, zero effect). The player reported exactly the predicted consequence: "I don't even know what they are... it feels like a script fight." Gating spectacle on the outcome rather than the trigger means the rare, real payoff is the only time the game performs it, which is what makes it legible as rare.
- **Replaces:** The 2026-08-04 legibility rewrite's ignition tell (`fightView.ts`'s `showIgnition`, which fired shake+callout+permanent-glow on every successful ignition roll regardless of resulting chain length).

## [2026-08-06] In-fight jeopardy is no longer mandatory every fight

- **Decision:** The eligibility gate — and therefore the possibility of a dip/comeback beat at all — is no longer guaranteed to open every fight. Whether a fight has jeopardy now depends on the squad's composition (see the same day's "squad pick is the risk dial" entry): a comfortable comp can win a fight with no dip, no gate, no ignition roll, ever. Target funnel: roughly 3 in 4 fights are completely undramatic.
- **Why:** Reverses the 2026-07-28 stakes-shape decision's "in-fight jeopardy mandatory" clause. The player's own diagnosis: "these moments have value because they happen once in a while... right now it happens every fight so I feel no emotion for that and feel scripted." Verified in the code: the eligibility gate (pool ≤ 40% of fight-start max) was reached by arithmetic in nearly every fight regardless of play; `checks/beatsheet.ts` had to hand-pick a seed specifically because the gate didn't open on 4 of the first 10 seeds tried. A guaranteed near-loss is not a comeback — it's a cutscene the player learns to sit through. Rarity, bought with an elected risk at squad-pick time, is what restores the moment's value.
- **Replaces:** The mandatory-jeopardy clause of `[2026-07-28] Stakes' shape`. The run-scoped economy, permanent-loss ban, and both PRD tables named in that entry are unaffected.

## [2026-08-06] Per-hero HP bars replace the two aggregate side meters

- **Decision:** Both sides render six (or fewer, post-attrition) individual, proportionally-sized HP bars instead of one aggregate meter per side. Bar width scales with each hero's maxHp, so a 200 HP tank's bar is visibly ~4x a 45 HP glass cannon's — this gives a shared scale across bars (total bar-pixels on a side still reads as that side's total remaining HP) while also making each hero's individual state legible.
- **Why:** The player's core complaint — "I never know if my tanker takes damage... my dealer deals good damage... my healer is doing his job" — is a direct consequence of per-hero HP being encoded as circle opacity between 0.4 and 1.0, the least legible channel available, while the only prominent readout (the two aggregate meters) throws away exactly the per-hero information the player's squad plan needs to be checked against. Per-hero HP bars, plus job counters (soaked/dealt/restored) added the same day, are what let the player verify their plan actually happened.
- **Replaces:** `STATE.md`'s design-spine reasoning against per-hero bars ("not per-hero bars — six bars have no shared scale, so a glancing player can't tell who's winning") — proportional bar widths are the fix that reasoning didn't consider.

---

## [2026-08-04] Legibility rewrite: per-hero combat, a visible enemy bruiser, and wipe-only resolution replace side-level DPS, the timed dip, and the coin-flip tie-break

- **Decision:** Replace the fight's side-level DPS model with per-hero attack beats (attacker → target, visible); replace the enemy-DPS-decay curve with a single dominant "bruiser" enemy as the dip's cause; resolve every fight by wipe instead of a 30s timer; add three hero roles (tank/damage/support); add a run-start squad pick (3 of 6, default pre-filled) and a pre-fight enemy read.
- **Why:** The first playable build was judged not fun — no visible cause for HP loss, an unexplainable turnaround, nothing to assemble. Root cause: the fight had no actors, only two meters moved by a hidden formula. This is a change to the fight's mechanism, not to the lead moment itself; it puts real pressure on "the cascade is the big win, not the only win" (per-hero combat can snowball), guarded by a new batch metric (`fractionWinsWithNoChain`, currently ≈79%) rather than by hope.
- **Replaces:** The fight-level mechanism described in `FIGHT_SCRIPT.md` §3's DPS-decay dip and the run wrapper's 30s-timer/coin-flip resolve (2026-07-29/31 entries). The lead moment, the run shape, the coin economy, and both PRD tables are unchanged.

---

## [2026-07-31] Prototype #1 scoped: a vehicle covering a full 5-fight run, with attrition, an in-run coin economy, and one optional-layer lever

- **Decision:** Nine commitments that turn the specified *fight* into a buildable *loop*, and fix what the first build is for:
  1. **Prototype #1 is a vehicle, not a hypothesis test.** Its job is to actualize the lead moment so it can be judged and adjusted, not to pass or fail a stated claim. Its success criteria are correspondingly different: it works if watching it produces **specific, differentiated reactions** ("the chain ended flat," "the dip is too long"), and if it can **surprise its makers** — if it can only show what was already specified, it is a rendering of the docs rather than an instrument.
  2. **It covers a full run, not a single fight.** Five fights. Win all five to complete the run; run out of living heroes and the run ends.
  3. **Attrition: HP and death both carry between fights.** Option B of the two on the table, over "fresh every fight."
  4. **HP is recoverable; bodies are not.** Max squad HP is 100 × *living* heroes, so a death permanently removes a third of the ceiling for the rest of the run. A free auto-recovery tick between fights (no input required) keeps the passive path viable.
  5. **Coin is earned and spent inside the run, with two sinks** — heal now, or bank toward a damage upgrade. Nothing carries between runs.
  6. **One optional-layer lever is in scope** — exactly one decision point (the coin spend), with a viable accept-default. Not zero, and not three.
  7. **Q6 answered — a bonus hit does more damage than the last**, crit-style, fired by the same hero, retargeting when its target dies.
  8. **The dip costs HP; a hero falling is the bad-case dip, not every dip.**
  9. **Enemies do not cascade in the prototype** — but the cascade is written side-agnostically so enabling it later is a flag, not a rewrite.
- **Why:**
  - **Vehicle over test (1)** because the makers could not answer hero-level design questions in the abstract and correctly perceived every option as equally reasonable. Taste about texture is downstream of a percept; deliberating it before there is something on screen is the failure the standing 2026-07-26 "learn by building" rule exists to prevent. The two criteria exist because a vehicle has no pass/fail and therefore no natural completion point — without them it sprawls.
  - **A run, not a single fight (2), for two independent reasons.** First, *"far bigger than I expected"* is not observable in one fight: expectation is a baseline, and the baseline only exists after watching the chain fizzle repeatedly. PRD also counts across fights by construction. Second, and more decisive: **jeopardy is not testable without stakes, and stakes are run-scoped** (2026-07-28). Strip the run and losing costs nothing, so the dip becomes animation no matter how real the sim state under it is — and *"looked like it might fail first"* is load-bearing. A single-fight build would also have manufactured a confound: the maker playing it first would find it non-renewing and be unable to tell whether that was the expected core-loop thinness or simply the absence of anything to lose.
  - **Attrition (3)** was chosen deliberately over the simpler alternative, taking the friend's Darkest Dungeon inspiration, and STATE already anticipated its home ("DD's attachment stakes are candidate content for the optional layer"). **Named cost, accepted going in:** attrition compounds — a body lost in fight 2 makes fight 3 more losable, and with win-all-five that can spiral. Point 4 is the brake.
  - **Point 4 is what stops the spiral.** Recoverable HP plus permanent bodies is the DD split: you can always claw back condition, but never capacity. Free auto-recovery is what keeps the passive default *viable* rather than merely *present* — without it, recovery becomes mandatory management and the optional layer stops being optional, which is the exact failure that went 0/4 in probing (2026-07-26).
  - **Two sinks, not one (5).** A single heal sink collapses to "heal whoever is lowest" — one repeatable dominant move, which is failure mode 3 on the project's own 2026-07-26 decision-density filter. Heal-now versus bank-for-upgrade is a real short-term-survival-against-long-term-power tension and resists a dominant answer.
  - **One lever (6)** because the layered structure is this project's central bet and it makes three claims: the core loop alone pays off; the optional layer raises the ceiling; the passive default is never worse. A layer-1-only build tests only the first — it is structurally incapable of failing the bet, and therefore of confirming it. Attrition had already forced recovery into the build, so putting a single toggle on it is nearly free. Capping it at *one* keeps the accept-default path honest and the result readable.
  - **Q6 as growing damage (7)** satisfies three separate constraints at once: it makes the chain escalate *visibly* (without it, bonus hit #5 looks identical to #1 and the chain is just a fast normal attack), it keeps attribution on a single unmistakable body, and it is the only one of the four candidate answers that reaches the existing magnitude target — flat repeats cannot deliver "5s of chain ≈ 20s of normal exchange" in 4–6 hits, geometric growth does.
  - **Point 8 is forced arithmetic, not taste.** The beat sheet has a hero falling every fight. With permanent death and three heroes, that empties the squad by fight 3 and makes fight 5 unreachable by construction.
  - **Point 9** keeps the cascade the player's signature rather than a weather system, and keeps the win-rate math tractable for a first build. Deliberately cheap to reverse.
- **Replaces:** **Supersedes** the "fresh every fight" strawman for hero persistence in the core loop. **Reverses** [2026-07-11] "unit attrition deferred" — attrition is now in scope. **Partially resolves OQ-13**: retry is per-*run*, not per-fight. **Answers STATE's top open question** — what the optional layer is allowed to modify — as: coin, spent on healing and damage upgrades. **Executes** the 2026-07-28 run-scoped stakes decision by giving it its first concrete devices. **Pulls forward** the bench question (deferred in `FIGHT_SCRIPT.md` §5): DD-style permanent death is survivable in DD because of a large roster, and with three heroes and no bench it may spiral — to be settled by building. **Leaves to the build**, per the standing 2026-07-26 rule: all tuning constants (now drafted in `FIGHT_SCRIPT.md` and the prototype build doc), whether the passive completion rate lands near its ~25% target, and whether the dip still reads as losing.

## [2026-07-29] The core loop's fight is specified: 30s, two HP meters, escalating proc chain, PRD-gated ignition, and the cascade as the big win rather than the only win

- **Decision:** Five commitments that turn the core loop from a set of relationships ("RNG triggers, emergence amplifies") into a buildable fight. Drafted as strawmen in `FIGHT_SCRIPT.md`, reacted to, and settled:
  1. **Fight length is ~30 seconds**, beat-sheeted as: opening exchange (~8s) → visible dip (~8s) → ignition (~4s) → chain (~7s) → resolve (~3s). Accepted as drafted, without a competing case being argued.
  2. **The scoreboard is HP-remaining, shown as two aggregate meters — one per side.** Not six per-hero bars, and not a Balatro-style accumulating score against a target. Per-hero state is conveyed as bodies (a hero at zero falls over), not as a second set of tracked numbers.
  3. **The cascade is an escalating crit/proc chain** — option C of the three drafted. One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next. A chain therefore usually fizzles immediately and occasionally runs away exponentially. Rejected: chain-kill snowball (A) and revive/rally wave (B).
  4. **Ignition is gated by mandatory jeopardy plus a pseudo-random-distribution roll, capped below 100%.** Two stages: a *deterministic* eligibility gate (the cascade is not rollable at all until the sim reaches a real jeopardy state through normal combat resolution), then a *random* ignition roll whose chance climbs with every fight that ended without an ignition and never reaches certainty. The cascade does not fire every fight: the dice decide **whether**, not merely **when**. The PRD counter is read as running across fights — it persists between fights and resets on ignition — rather than per-tick within one.
  5. **The cascade is the big win, not the only win.** Jeopardy is escapable by ordinary combat resolution; a player can grind back out of the dip with no cascade at all.
- **Why:**
  - **Aggregate meters over per-hero bars** because six bars have no shared scale — a glancing player would have to read and compare them to learn who is winning, which violates the core loop's defining zero-reading requirement (2026-07-26 layering). Two aggregates give a single tug-of-war read, and they carry the beat sheet directly: the dip *is* the player's meter falling, the chain *is* the enemy's collapsing. **HP-remaining over accumulating-score** because the shared lead moment is a comeback (defense-flavored) rather than a jackpot (offense-flavored).
  - **Option C** because it is the friend's own originally-cited Dota/crit reference and is the closest squad-fight expression of the RNG-only probe shape that already earned his lean-in (200+ unprompted rounds, 2026-07-26). Adopted with a cost named going in: C is a *trigger, not a decision*, and scored weakest on Tu's decision-density read. That cost is acceptable precisely because of the layered structure — the core loop is explicitly the friend/casual half, and decision-density is the optional layer's job, not the core loop's.
  - **PRD capped below 100%** because a cascade that fires reliably once eligible is not a cascade, it is a scripted comeback, and a scripted rescue destroys the lead moment's "couldn't fully predict" clause. PRD is the cheapest device that supplies a *floor* without supplying a *guarantee*: a drought self-corrects, so the player is never abandoned for long, but no fight is ever safe.
  - **Points 3 and 4 together deliberately create two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**. This is what keeps the jeopardy real rather than ceremonial.
  - **Point 5 exists to break a coupling that point 4 would otherwise force.** If in-fight jeopardy is mandatory (2026-07-28) *and* the cascade is the only exit from it, then cascade-fire-rate and win-rate become the same number by construction — one dial for two jobs, which is this project's recurring failure shape (see the floor/ceiling blend, 2026-07-26, and the two-jobs split in the stakes entry below). On the drafted constants it would also imply a ~35–45% loss rate, too punishing for a casual mobile audience whose observed behavior is gain-chasing. Decoupling lets ignition rate be tuned for *how often the lead moment lands* while difficulty is tuned separately.
  - **Accepted cost of point 5, named going in:** if the dip is sometimes survivable by ordinary play, it is not reliably *scary*. This puts real pressure on the mandatory-jeopardy commitment (2026-07-28) — the "looked like it might fail first" clause now depends on the dip being tuned so it still *reads* as losing even when it is in fact escapable. If that tuning proves impossible, point 5 is the piece to revisit first.
- **Replaces:** Replaces nothing — this is the first specification of the core loop's fight at the mechanic level, and it supersedes only the corresponding strawmen in `FIGHT_SCRIPT.md` §1–§4. **Executes** the 2026-07-28 stakes-shape decision's mandatory-jeopardy commitment by giving it a concrete mechanism (the deterministic eligibility gate is what makes "looks lost first" true without staging it). **Advances** STATE.md "Next up" step 1. **Leaves open, to be settled by building rather than by further specification** (per the standing 2026-07-26 "learn by building, not by pre-validating" rule): the eligibility threshold; all specific PRD and chain constants, which are strawmen for tuning by feel; what the optional layer is permitted to modify in the proc chain (base chance, escalation step, cap, which hero can go hot, or what a bonus hit does); and the squad-pick step, explicitly deferred.

## [2026-07-28] Stakes shape chosen: in-fight jeopardy is mandatory, and the stakes economy is run-scoped, never permanent

- **Decision:** The stakes mechanism left open on 2026-07-26 is resolved at the level of **shape** (concrete devices still to be picked during the build). Two commitments:
  1. **In-fight visible jeopardy is mandatory.** The fight must *look* like it is being lost before the cascade turns it — squad down, health in the red, then the dice fire. This is a pacing/presentation constraint on cascade timing, not an economy: it costs the player nothing, requires zero reading, and is what actually delivers the lead moment's "looked like it might fail first" clause.
  2. **The stakes economy is run-scoped and never permanent.** What can be lost is accumulated *within a run* — winnings, progress, a stack built this session. Ruled out: permanent or account-level loss of any kind (energy systems, item destruction, permanent resource drain, difficulty that ratchets past what a non-reading player can clear).
- **Why:** The two commitments exist because stakes were being asked to do **two different jobs**, and — the same lesson as the failed floor/ceiling blend (2026-07-26) — one mechanic doing both is the failure shape. Job A is *moment-level dread* (the lead moment's clause, which lives inside the ~30 seconds of watching a fight); Job B is *run-level meaning* (the standing "free same-difficulty retry costs nothing, so winning means nothing" diagnosis from 2026-07-19, which lives in the economy between fights). Splitting them lets each be solved with the cheapest correct device.
  - Jeopardy is mandatory rather than optional because the core loop is **watch-only with zero required decisions**, so the usual tension source ("can I execute?") was removed by design; what is on the line is the only remaining source, and near-loss-then-recovery is also the cheapest **attribution generator** for a player who does not self-attribute — "I was nearly dead and pulled through" reads as *my story* even when the dice did all the work, which partially serves "claim as mine" inside the core loop rather than only in the optional layer.
  - Permanence is ruled out because it would break the standing **"mastery is a ceiling, never a gate"** rule (2026-07-19): any stake that makes the non-reading player progressively worse off inverts the ceiling into a gate, and on a casual mobile game it is also a retention bug — a bad session must never cost something the player cannot re-enter in ~30 seconds.
- **Replaces:** Resolves the top-priority "Stakes mechanism" open question in STATE.md (the loss-on-fail / jackpot / bot-comparison fork) at the shape level, and closes the "mechanism not chosen" flag on the Stakes row of STATE.md's Design status table. Executes, does not reopen, the 2026-07-26 adoption of stakes in principle. Leaves open, deliberately and per that same entry's "learn by building, not by pre-validating" rule: whether an **elected bank-or-push** escalation button is included (it would be the one decision allowed in an otherwise zero-decision core loop — nerve, not reading — and would need a safe auto-default), whether a **rival-bot scoreboard** is added as a legibility skin on the score, and whether **attachment/permadeath stakes** appear in the optional layer as ceiling content. Also leaves open whether run-scoped loss satisfies the friend's unprompted "lose something on failure" ask or whether that ask meant permanent loss — worth one cheap direct question, given this project's standing rule that observed play outranks self-report (observed play was gain-chasing: 200+ rounds for a bare high score).

## [2026-07-26] Stop probing, adopt stakes, and stop trying to blend floor and ceiling into one mechanic — move to building the real game

- **Decision:** Three things adopted together, closing the discovery-phase probe loop opened 2026-07-18/19:
  1. **Stakes** (the shared moment's untested "looked like it might fail first" clause) is adopted without a further dedicated probe. The friend asked for it unprompted (lose something on failure / a casino-style big reward / compete against a bot for score), it matches a long-observed pattern in him (Darkest Dungeon stress-reversal was his own independently-named design ideal, per the 2026-07-19 alignment entry), and Tu has no objection. The exact mechanism (loss-on-fail vs. jackpot-style reward vs. bot-comparison) is left open to be decided during build, not pre-specified here.
  2. **Floor and ceiling are split into layers, not blended into one mechanic.** Four attempts at a single wired mechanic meant to serve both makers at once (base wired, plus the draft/routing/spend decision-layer sketches, all logged 2026-07-24/26) failed in structurally related ways — either the added decision collapses to one dominant repeatable move, or it reads as effortful/off-putting to the low-agency player regardless of how much dice remain underneath (see the friend-validation entry immediately below). Read together, this is treated as evidence that blending is the wrong *shape*, not that the right blend hasn't been found yet. Adopted structure instead: a **mandatory core loop that needs zero reading or deliberate choice** to deliver its full payoff (RNG-triggered escalating outcome + stakes — the friend/casual-audience half of the shared moment), with the **emergent-combination/decision-density layer sitting fully optional on top** (Tu's half), never required to touch the core loop's payoff. Modeled on Balatro (already this project's #1-ranked reference game): a first-time player can watch the score climb and feel the spike without reading a single joker, while a deeper player mines synergies underneath.
  3. **Stop building disposable throwaway probes.** The next build is treated as a real prototype of the actual game under this layered structure, not another one-off toy — further learning happens by building and playing the real thing, not by pre-validating every remaining piece in isolation first.
- **Why:** The project's own history (the "fun = mastery + chaos" reset, DECISIONS 2026-07-18) already showed a plausible, agreed-on-in-conversation idea can fail once built — so the bar for "stop probing" isn't zero remaining uncertainty, it's having independently validated the two halves separately (ceiling: emergence-only lean-in, 2026-07-22; floor: RNG-only lean-in, tonight — see entry below) plus a structural reason (four failed blend attempts) to expect further blending probes to keep failing the same way. Open-ended re-probing of the blended-mechanic shape was the actual risk raised; the fix is changing the shape being tested, not testing longer.
- **Replaces:** Supersedes the "wired-together" arm as the target shape for combining floor and ceiling (STATE.md Probe status table, all rows) — the wired arm and its decision-layer iterations are not pursued further as-is. Does not reopen the 2026-07-19/07-20 floor/ceiling division-of-labor finding — confirms and executes it, via layering instead of blending. Advances STATE.md "Next up" step 3 ("cast the lead, derive further mechanics, resync").

## [2026-07-26] Friend-validation session run — RNG confirmed cleanly; friend's behavior shows he doesn't self-generate variety

- **Decision:** Ran the friend-validation session (`probe/FRIEND_TEST_PROTOCOL.md`), fixed order RNG → Emergence → Wired-base, blind framing, ~10-20 rounds per arm. Session logs weren't captured; Tu observed directly instead (shared screen + face on a live call). Results, read against the protocol's own outcome tables:
  - **RNG-only:** clean confirmation of the predicted result. Strong engagement (200+ unprompted rounds, played while carrying on a separate conversation) plus attribution absent — "realized it's RNG after all," stopped reading card text, just spammed Play for a high score. Matches §8's "chases hard but 'the dice did it'" row: the cleanest possible result, confirms RNG-alone fails "claim as mine" on its own and motivates pairing it with a ceiling layer rather than shipping it solo.
  - **Emergence-only and Wired-base:** inconclusive as isolated arm verdicts, but produced a stronger, unplanned finding. In the emergence game (deterministic — same input always gives the same output), the friend repeatedly pressed Play on the *same unchanged sequence* expecting a new result each time, which is structurally impossible; he had not read the cards closely enough to know that. Observed directly, not inferred from self-report, and consistent with an independently-observed, long-running pattern in his general gaming behavior (collapsing StarCraft/Dota/WoW into one repeated action played on muscle memory; stopping at Hades' final boss rather than hunting new weapon combos, unlike Tu). Tu judges this cross-context pattern strong enough to settle without a formal reach-depth re-test of the emergence/wired arms specifically.
- **Why:** Per the protocol's own §0, the friend is the fresh, trustworthy judge for the emergence/building moment specifically. Watching him take an action that could structurally never produce the outcome he expected is stronger evidence than either arm's self-reported "too complex" reaction, because it rules out "he'd have kept exploring if the rules were just less dense" and instead points at a stable trait: he expects the game to supply variety to him rather than generating it himself through deliberate choice-changing.
- **Replaces:** Resolves the two "Tu-only, unverified against the friend" flags on the RNG-only and Wired-together rows of STATE.md's probe table (RNG side: confirmed; wired side: superseded by the finding above rather than independently re-verified as "flat"). Feeds directly into the entry above.

---

## [2026-07-26] Decision-density criterion sharpened: three ways a "recurring decision" turns out fake

- **Decision:** Tu played all three decision-layer sketches in `probe/wired/layers.html` and rejected all three, but the rejections aren't scattered complaints — each names a different, specific way a recurring decision fails to deliver decision-density (the sustaining pleasure named 2026-07-24) even though a decision is nominally there every round. **Draft** (swap a token into the row each round) failed because the offered tokens are drawn from the same pool the row/reroll already ranges over — nothing new enters the space, so the "choice" is a reroll wearing a decision costume; Tu's own fix instinct (offer only tokens never seen at setup, capped to 3, revealed gradually) independently re-derives Balatro's expanding-joker-pool pattern, this project's #1 reference game. **Routing** (aim every spark/surge as it fires) failed because the no-choice default — a trigger firing all events at once — is strictly more powerful than any routed outcome; a decision that only costs power relative to doing nothing is a tax, not agency, and directly inverts the existing "mastery is a ceiling, never a gate" clause into a gate. **Spend** (rescue a roll with scarce charges) failed because, even with real scarcity nominally present (5 charges), the dominant play — find the single highest-EV piece, dump every charge as force-surge into it — is discoverable and then correct every round, the same collapse-to-a-solved-policy failure already diagnosed in the emergence-only (2026-07-22) and RNG-only (2026-07-24) arms; Tu's own read ("could be better if more limited") names tighter scarcity as the fix. **The sharpened criterion:** a recurring decision only produces real decision-density if it (a) draws on genuinely new information/options not already inferable from the current state, (b) never leaves the passive/default outcome better than engaging, and (c) resists converging to one repeatable optimal move.
- **Why:** Without this, "add a recurring decision" is not an actionable design constraint — all three sketches nominally added one and all three still felt bad, for three different mechanical reasons. Naming the three failure shapes (recombination-without-novelty, choice-as-tax, spammable-to-a-solve) turns "decision-density" from a diagnosis into a checkable filter for the next iteration of this probe, and for any future mechanic proposed against the shared lead moment.
- **Replaces:** Sharpens (does not overturn) the 2026-07-24 "Tu's core pleasure is decision-density" entry — that entry established *that* an open recurring-decision space is the sustaining pleasure; this entry establishes *what makes a proposed decision space fake* even when a decision is nominally present every round. Does not resolve STATE.md's open "pick which decision-layer shape to build first" question — narrows the design space that next pick must satisfy.

## [2026-07-24] Tu's core pleasure is decision-density, not chance or comprehension per se — RNG is seasoning, not the engine

- **Decision:** Reflecting on the wired probe (`probe/wired/`), Tu named the actual defect for himself: playing it felt like "spam spark and hope for surge," and after several attempts he felt dread because "there's not much more to explore" — the dominant strategy resolves to defaulting Berserker first (highest rate of triggering the amplifier chain) and re-rolling. He initially attributed this to bad RNG design and asked to be proven wrong. The diagnostic move: propose three sketches that each add exactly one *recurring* decision on top of the exact same, untouched surge dice (between-round draft / live event-routing / spend-after-you-see interventions) and check Tu's reaction. Result: **all three excited him, despite none being built or played yet**, and specifically because they "give the game more room to explore, to think strategically" — with the RNG held constant across all three. Since the one shared variable was "a decision was added" and the one thing *not* varied was randomness, the excitement isolates **decision-density / size of the strategic space** as Tu's sustaining pleasure — not the dice, and not raw comprehension-of-a-solved-system either (which is what the emergence-only arm supplied, and which also burned out once solved, per 2026-07-22). This refines rather than contradicts the 2026-07-24 RNG-only-arm entry ("comprehension/mastery of an open problem" was the read there) — the sharper version is: Tu is pulled by an **open space of decisions**, and dread/boredom is what happens once that space is fully mapped, regardless of whether RNG or a deterministic build was what closed it.
- **Why:** Tu asked to be proven wrong that the RNG itself is the flaw. The proof is structural, not rhetorical: three sketches held the randomness bit-for-bit fixed and varied only "is there a recurring decision," and excitement tracked the decision, not the dice. This reframes the wired probe's flatness — it isn't that the surge mechanic is bad, it's that the probe hands the player exactly one decision (build the row) and then only re-rolls it forever, so the roll is *terminal* (nothing sits between dice and outcome) and the space is *non-renewing* (solve it once, every future run is the same row re-rolled). Both defects trace to "one decision, never revisited," which is now read as the actual thing to fix, with RNG's role narrowed to seasoning/floor rather than primary surprise source — consistent with, and now given a mechanism for, the 2026-07-20 floor/ceiling division of labor.
- **Caveat — this is Tu-only, unverified against the friend.** The friend's stated floor need ("a highlight reachable even playing badly") could be satisfied by exactly the low-agency jackpot-chase feeling Tu is describing as boring for himself (same asymmetry flagged in the 2026-07-24 RNG-only entry) — a design that maximizes decision-density for Tu risks *raising* the skill floor and eroding the friend's half of the shared moment. Also, per this project's own standing rule, excitement at an untried idea is weaker evidence than play (Tu felt the same pull about the original prototype from a design doc, which then bored him once built) — this entry records a taste signal to point the next probe at, not a validated result.
- **Replaces:** Sharpens (does not overturn) the 2026-07-24 "RNG-only arm" entry's framing of Tu's sustaining pleasure from "comprehension/mastery of an open problem" to the more specific "decision-density / recurring strategic choice." Does not close the wired-together arm (still "not built" per STATE.md Probe status) — motivates its next iteration and the still-open choice of which recurring-decision shape (draft / routing / spend-after) to build first.

## [2026-07-24] STATE.md restructured for redundancy; CLAUDE.md gains a "live status lives in one place" rule + a stable section skeleton

- **Decision:** STATE.md had grown to ~190 lines partly because live facts were being restated in multiple sections — most visibly, each probe arm's result was told 3–4 times (in "How we decide," "The shared lead moment," OQ-0, and "Next up"), and the floor/ceiling and RNG-triggers/emergence-amplifies resolutions were each stated 2–3 times. This was a full STATE regeneration (not a line-edit) that: (1) collapsed all probe-arm results into a single **Probe status** table, the sole source of truth, with every other section pointing to it instead of restating it; (2) moved rationale/evidence that already lives in DECISIONS (the "why it felt flat" essay, the `toy.mjs explore` numbers, the who-can-judge-what note) out of STATE into one-line pointers; (3) compressed the working-hypotheses list and reference-games table to one line each, dropping elaboration but keeping every fact checkable. Result: 191 → 130 lines, no content lost, no new file (stayed two-file: STATE + DECISIONS — a third REFERENCE.md was considered and rejected, see Why). CLAUDE.md's Guardrails section gains two additions to keep this from re-bloating: **"Live status lives in exactly one place"** (an evolving fact gets one home; other mentions point to it, never restate it) and a **fixed 11-section skeleton** that a future resync regenerates into.
- **Why:** Redundancy isn't just length — it's a correctness risk. When the same fact lives in four places, a future sync can update some copies and miss others, producing silent contradictions, which is exactly what the existing "never repeat a fact in STATE" guardrail already warned against; this decision makes that guardrail concrete (one table, not a rule with no mechanism) and extends it with a named skeleton so section structure stays stable across rewrites. A separate REFERENCE.md was considered for the bulkier hypothesis/reference-game detail but rejected: it would break the clean present-truth/history binary between STATE and DECISIONS, create a third document with no `Last synced` audit contract (this project already has two such casualties — STRATEGY.md and PROTOTYPE_PLAN.md are both stale), and fall outside the READ protocol's "STATE first" default, meaning the AI would either read it every session (no context savings) or skip it and silently lose filters it currently uses to reject proposed mechanics (e.g. the working-hypotheses list).
- **Replaces:** No prior decision reversed — this is a structural/process change to how STATE.md and CLAUDE.md's guardrails work, not a change to any game-design content. All probe results, hypotheses, and reference-game facts carried forward unchanged in meaning, only in shorter form.

## [2026-07-24] RNG-only arm played: fun is real but non-renewing — mastery/comprehension, not chance, sustains Tu

- **Decision:** Tu's own play of the RNG-only probe is fun but on different terms than emergence, and the difference is diagnostic, not just a vibe note. The RNG probe's fun moment is a **jackpot chase**: a light strategic choice (pick the highest-reward pieces to sequence) followed by repeated Play-spam hoping for the top score. That fun is real (a genuine jackpot high) but **collapses fast** — around 30-40 rows, once Tu concludes he can't beat his high score *and* the "best sequence" is solved (just pick the biggest pieces). Diagnosis: the boredom trigger isn't "luck ran out," it's "the strategy space closed" — once the optimal policy is nameable, only chance is left, and chance alone doesn't hold Tu's attention. This reads as a **player-type signal, not just a probe-tuning note**: Tu's sustaining pleasure is comprehension/mastery of an *open* problem, not the reward hit itself — which lines up with why the emergence arm hooked him (2026-07-22 entry) even though it produced its own, later burnout. Provisional read pending the wired-together arm: **RNG is a weak primary surprise source for Tu specifically** (finite, external, exhausts itself once modeled) vs. **emergent combination is a stronger one** (structural, renews as long as the interaction space stays unsolved) — RNG's likelier role is seasoning the inputs to the emergent puzzle, not carrying the moment on its own.
- **Why:** Same session, same instinct as the 2026-07-22 emergence entry — Tu's own reaction to a toy he built is useful signal but knowingly asymmetric: this is **Tu's read of his own play only**, not yet checked against the friend (the RNG-favoring half of the team per the 2026-07-19 alignment). The friend's floor need is explicitly "a highlight reachable even playing badly" — that could be satisfied by exactly the jackpot-chase feeling Tu is describing as boring for himself. So this entry records a real, load-bearing observation about Tu-as-player, but it is **not** a verdict that RNG-only fails as an arm until the friend's play is checked.
- **Replaces:** Adds a second data point to the three-arm probe alongside the 2026-07-22 emergence-only finding; does not close arm 2 (RNG-only) the way arm 1 was closed, and does not yet resolve the 2026-07-20 "both, wired together" division-of-labor question — that resolution still waits on the RNG-triggers-emergence arm and, importantly, on the friend's independent play of these same probes.

## [2026-07-22] Emergence-only arm complete — burnout is the structural ceiling, not a balance problem

- **Decision:** The emergence-only arm of the three-arm probe (`probe/emergence/toy.mjs`, `play.html`, `rules.mjs` v2) is judged **complete** based on Tu's own play, not further balance passes. Tu reported a genuine lean-in — "the desire to play more to find the best combo" — which is the exact positive signal this arm existed to test for. The burnout that followed ("only Crit combo is strong," rules felt too complex to parse) is diagnosed as the arm's **predicted structural ceiling**, not a tunable imbalance: a deterministic system means same input → same output forever, so once a build is solved it is solved *permanently* — there is no amount of token rebalancing that keeps a solved puzzle replayable. This is exactly the failure mode the three-arm plan's bridge hypothesis exists to fix (RNG decides *whether/when* a cascade fires, so a known-best build can't go stale on repeat). **Stop optimizing/rebalancing this toy; move to building the RNG-only arm next, then the wired-together arm.**
- **Why:** Two signals from the same session point opposite directions and had to be weighed differently. The lean-in is trustworthy self-report — Tu is the emergence-*skeptical* half of the team by his own stated favorite (RNG), so building hooking him even briefly is real evidence for the shared moment. The burnout is *not* equally trustworthy on its own terms: per the 2026-07-19 alignment finding, a maker who designed the puzzle already knows the solve, so his own boredom is unreliable evidence against the building/puzzle moment specifically — it needed to be checked against what the arm was structurally capable of before treating it as a verdict. Checked via `node toy.mjs explore 5 200000`: the v2 redesign (5 slots/15 tokens, real scarcity, cost/anti-synergy tokens) already passed its own diversity bar (top-decile runaway 6.0x, obvious build only 43% of best, 2 build families) — so the "only Crit is strong" feeling isn't an undiscovered balance bug so much as every token in the pool being scaffolding around one underlying crit/kill engine (confirmed: only F/B/U/T score anything solo; every other token is inert outside the crit chain). Further tuning would not change that a deterministic engine, once solved, stays solved — the ceiling is structural, not numeric.
- **Replaces:** Executes STATE.md's "Next up" step 2 (three-arm comparison) — closes out **arm 1 of 3 (emergence-only)** with a verified result and redirects the active work to arm 2 (RNG-only). Does not reopen or overturn the 2026-07-20 "division of labor" decision — it supplies the empirical confirmation for *why* emergence needs RNG paired with it, rather than being a standalone viable arm.

## [2026-07-20] The RNG-vs-emergence knob is not a fork — both, with a division of labor

- **Decision:** Reframe the "open knob" from a *choice* (RNG **or** emergent combination as the surprise source) to a **wiring diagram**: the game uses **both**, each doing a different job. **RNG triggers** — decides *when/whether* a cascade fires (the friend's need, and the source of the floor: a highlight reachable even playing badly). **Emergent combination amplifies** — decides *what the cascade becomes* once triggered (Tu's need, and the source of the ceiling: reward for playing better). This is the same shape already committed in the 2026-07-19 floor/ceiling resolution (RNG = floor, synergy-depth = ceiling) and the same shape as every 🥇 reference game (Balatro, Slay the Spire, Into the Breach all run RNG + emergent systems together, never one alone). The probe step is **not** reframed as "pick RNG or emergence" — it now tests **execution of the bridge hypothesis** (does a dice-triggered cascade satisfy both the RNG-lover and the emergence-lover?) via a three-arm comparison: RNG-only, emergence-only, and RNG-triggers-emergence-together, judged by lean-in for *both* makers.
- **Why:** "Choose one" was never actually forced by the design — it conflated two different things (a *source* of unpredictability vs. a *structure* of system interaction) that aren't mutually exclusive, and the shared-moment work already resolved the underlying maker-taste tension as floor-vs-ceiling, not an either/or. Treating "both" as a real division of labor (not a treaty where each maker gets his favorite mechanic bolted on separately) keeps the probe's attribution discipline intact — the risk being guarded against is unattributable fun (the original flat-prototype failure), not the number of engines used, so a probe testing the *wired-together* bridge hypothesis explicitly (not each half in isolation as the deliverable) is what preserves that discipline.
- **Replaces:** Sharpens (does not overturn) the 2026-07-19 "open knob" language in STATE.md and the "Co-founder alignment reached" DECISIONS entry — the underlying floor/ceiling finding is unchanged; only the "RNG vs. emergence, unresolved" framing of the probe question is corrected to "both, wired together, execution is the open question."

## [2026-07-19] Co-founder alignment reached: one shared lead moment found

- **Decision:** Both makers' independent recalls (Tu's in `ALIGNMENT_PREP.md`; friend's given verbally — Dota Gyrocopter/Daedalus, RNG-skill heroes, Darkest Dungeon stress-reversal, WoW/Dota battleground "I told you so") converge on **one shared lead moment**: *"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."* Sub-findings that make up this convergence:
  - **Attribution is shared** — both makers want legible credit when the payoff lands (Tu: "unmistakably mine to have built"; friend: "I decided to build Daedalus," "my call was right"). **Skill-gating is not shared** and is resolved as **floor vs. ceiling, not a fork**: variance/RNG is the **floor** (a highlight is reachable even playing badly — the friend's stated need), synergy-depth is the **ceiling** (rewards playing better — Tu's need). **Mastery is a ceiling, never a gate**, on this game.
  - Tu's own "want to play better" instinct is scoped down: it applies to competitive/PvP mastery (Dota-as-esport) and is **not** a core need for this single-player watch-only game.
  - **Open knob, now the active probe question:** source of the "couldn't fully predict" surprise — **RNG** (friend's stated favorite: bash/crit/non-targeted-skill procs) vs. **emergent combination** (Tu's stated favorite: deterministic systems colliding into unplanned behavior). Bridge hypothesis to probe: **RNG triggers legible chains** — the dice decides *when/whether* a cascade fires, the player's setup decides *what it becomes*, so both the "chaos-lover" and the "system-engineer" get their beat from the same event.
  - The friend supplies a **stakes/dread→relief** pole Tu's own recall under-weighted (Darkest Dungeon near-death-turned-win), which independently confirms STATE's existing diagnosis that free-same-difficulty-retry costs nothing and therefore winning means nothing. Refinement carried from the friend's battleground moment: the payoff should feel **earned through adversity** — it should look like it might fail before it lands.
  - The friend independently named *this exact game* as his own design ideal (Darkest Dungeon, but auto-combat, simpler decisions, faster pace) — an unprompted validation of the project's core premise from the collaborator, not just the primary maker.
  - Checked and dismissed: the shared moment reads as "obvious"/universal at the headline level ("small input, big payoff" is close to a universal reward-spike shape), but the two makers converging is evidence of **correlated taste** (shared reference games), not evidence the moment is what *everyone* wants — a competitive-mastery, pure-puzzle/control, or narrative-first player would have named a different moment and did not surface here. The moment still functions as a real filter via its **load-bearing clauses** (watch-native; "run away past what I planned" rejects mere scaling; emergent chain rejects illegible coin-flip *and* rejects a fully-solved deterministic puzzle; "looked like it might fail first" requires real stakes; "mine to have built" rejects unattributable chaos) — those clauses, not the headline, are what a mechanic must pass. The remaining risk is understood to be **execution** (can a synergy system be built deep enough to keep surprising its own author, à la Balatro) rather than moment-novelty.
- **Why:** Closes the alignment step opened by the 2026-07-18/07-19 decisions — both makers have now independently recalled and revealed, and the outcome is convergence (not the flagged divergence risk), with one genuine open knob (RNG vs. emergence) rather than a fork in the lead moment itself.
- **Replaces:** Resolves the co-founder-alignment sub-part of OQ-0 (STATE.md). Does **not** resolve OQ-0's personal/probe-validation sub-part — that remains open and becomes the next active work (fun probes, testing the RNG-triggers-legible-chains bridge hypothesis with stakes restored). Supersedes the "friend's recall still pending" status recorded in the 2026-07-19 alignment-candidate working notes.

## [2026-07-19] The alignment deliverable is a single lead *moment*, not an engine or a mechanic

- **Decision:** The co-founder alignment step produces **one shared lead *moment*** — a concrete, remembered *felt beat* (a few seconds, with a shape: anticipation→payoff or dread→relief) that the game exists to deliver — **not** a "lead engine" and **not** a mechanic/feature. The three-engine lens (watching / building / gambling / character-drama) is **demoted from the thing you choose to a sorting label**: you name moments first, then tag each with an engine afterward and use the lens only to check whether the two makers' moments secretly match or secretly conflict. Process: **both makers** (not just the friend) each **independently** recall **3–5 moments** — *only moments they have actually felt in a game they played*, not moments they imagine could be fun — reveal, then **rank to one lead moment or name an explicit divergence**. Mechanics are derived *after* the moment is chosen and judged by one test: does this serve the moment?
- **Why:** Naming a pole ("mastery") or a mechanic first can **reject no feature**, so it fails to constrain design — the exact altitude that produced the flat prototype (a pile of locally-justified mechanics — hex sim, full-info, deterministic, free retry — aimed at no shared feeling). A *moment* is concrete enough to say no to features, so mechanics fall out of it instead of piling up under it. It also **exposes co-founder divergence that an engine/mechanic list hides**: two makers can agree on mechanics ("a draft, positioning, watch the fight") while secretly wanting different feelings, and converge on a compromise that is "technically fine, secretly boring." An engine is a category with the same rejection-nothing weakness as "mastery"; it survives only as a post-hoc label.
- **Replaces:** Sharpens the 2026-07-18 discovery decision: the alignment output is now a **moment**, with **engine demoted to a sorting label**, and the recall **scope broadened from the friend's homework to both makers** with an explicit 3–5-candidates / one-lead / only-felt-moments discipline. Does not reopen the 2026-07-18 "fun is unverified / building not theorizing" stance — it operationalizes it.

## [2026-07-18] Fun is unverified — demote the "Settled" list to hypotheses; switch to discovery-by-probes + co-founder alignment

- **Decision:** The core fun was **theorized, never verified by play**; STATE's "core insight" is a hypothesis, not a finding. Therefore: (1) the entire **"Settled — do not re-litigate" list is demoted to working hypotheses**, reopenable until play earns each one back; (2) **no new do-not-re-litigate decisions** are minted until play produces a lean-in; (3) the next work is **discovery, not construction** — starting with co-founder alignment, then small disposable probes that each isolate one autobattler fun-engine (watching / building / gambling), judged only by "do I not want to stop?"; (4) because this is a two-person team, a **co-founder alignment step runs first** to surface where the two makers' visions diverge before anything is built.
- **Why:** An extensive design + a faithful prototype produced boredom — evidence that more theorizing is the wrong tool and fun is empirical. Keeping the "Settled" list binding protects an *unverified* direction, which is worse than no discipline. The reference games (Balatro/StS/ItB) were themselves found by play, and two of them contradict the settled determinism + free-same-difficulty-retry choices. Two makers with fuzzy, possibly divergent visions (friend's DD + TFT + "chaos" clips point at three different engines) risk a compromise that is "technically fine, secretly boring."
- **Replaces:** Does not delete prior entries (append-only) but **suspends the binding force** of the 2026-07-11 → 2026-07-15 "Settled" decisions (education-primary, watch-only, deterministic sim, same-difficulty retry, on-map hex placement, etc.) — they revert to hypotheses. Supersedes STATE's "prototype-spec gate is cleared, nothing blocks building" — building is now blocked pending the fun-lead decision.

---

> ## ARCHIVE — entries below predate the 2026-07-18 pivot
> Everything below this line describes the pre-pivot game design (hex-grid tactics, elevation, authored deploy zones, timed-ultimate mid-fight decisions, fog-of-war, a 5-hero-plus-bench roster). The entry immediately above suspended all of it. Kept for the historical record of *why* the pivot happened — not current, not live rationale.

## [2026-07-15] OQ-6 (form) resolved: pre-fight setup is on-map placement into an authored bounded deploy zone

- **Decision:** Squad setup happens **on the battle map itself**, not on a separate screen — setup and battlefield share one view so the player places while reading the terrain they're countering. The player **drag-places** each fielded hero onto **any legal hex inside an authored, bounded deployment zone** (free placement *within* the zone, TFT-style). This rejects three alternatives at once: the current **separate-screen dropdown** setup (illegible — you pick a lane name blind to the map), **coarse row×lane slots**, and **free-place-anywhere**. The **deployment zone is the per-encounter balancing knob** — its size and shape control elevation access, whether any single setup is a dominant no-brainer, and how much placement can carry relative to the draft. Legal hexes exclude walls, the enemy side, and (by default authoring) enemy-held high ground; the zone is authored per map. Zone *size/expressiveness* is a dial tuned in the prototype, not fixed here.
- **Why:** The old separate-screen dropdown setup contradicts the game's own spine — the whole premise is *reading and countering a visible board* with positioning-as-the-solve, yet the player was setting up blind to the terrain. On-map placement fixes that directly and cheaply. **Free-within-zone over coarse row×lane** is required because the encounter model authors *specific* terrain counters — a flank gap, a chokepoint, a route onto elevation — and row×lane is too coarse to express "get an archer onto *that* hex"; the prototype's deployment slots already had to be hand-pinned to exact meaningful hexes, so the coarse abstraction was already leaking. **Bounded over free-place-anywhere** because an unbounded space is where players find author-unintended degenerate positions that trivialize the puzzle and break the 4-point authoring test, and because the zone is the single knob that also governs elevation access and the placement-vs-draft power balance. TFT is the proof the input is casual-mobile-viable and the placement decisions are conscious and attributable; the residual attribution risk of a large continuous placement space is a *zone-size* concern, not a reason to go coarse. A cheap safeguard for clean between-retry attribution (surface a ghost of the previous attempt's placement so the player's change is visible) is noted but not committed.
- **Replaces:** Resolves the **FORM** half of OQ-6 and **overturns the PROTOTYPE_PLAN.md provisional answer** ("row × lane — coarse placement, not free hex-drop"), which was an unexamined default rather than a considered decision. Narrows OQ-6 to one remaining dial: **how large/expressive the deploy zone is** — the attribution↔expression tradeoff, and whether rich placement starts to **swallow the draft** as the lever that decides fights (mastery must stay distributed, not collapse onto positioning). Interacts with the elevation decision logged alongside this one.

## [2026-07-15] Elevation is intrinsically risk/reward, not pure upside

- **Decision:** High ground (and elevation generally) must grant its advantage **and a matching exposure** — a unit on high ground reaches/sees further **but also takes more incoming / is targetable from more of the map.** It is never pure upside. Concretely in the prototype sim, the existing `+range` bonus gains a symmetric downside (e.g. no cover, increased damage taken, or greater visibility to enemies); the **specific parameter values are a prototype tuning dial**, not fixed here. Consequence: **occupying high ground is a bet** (more reach for more risk), so neither starting on it nor racing to it is ever a free or dominant choice — the balance is intrinsic to the tile, independent of the map.
- **Why:** A choice is a no-brainer only when it has upside and no cost; the sim's current high-ground bonus (`+1 range`, `combat.ts`) is exactly that — pure upside — which is what would make "put the archer on the hill" a dominant, puzzle-collapsing pick. The clean fix is **not** a global "can't start on high ground" rule (a blunt ban that would be wrong on maps where starting elevated is the intended fair setup) but making elevation **self-balancing**: attach a downside that scales with the upside so it is a risk/reward decision on *every* map automatically, without the author having to remember to punish it. This directly satisfies the standing OQ-16 test — *a terrain feature must raise a question with several answers, never announce its own answer.* Because combat is watch-only, the exposure must be **legible** at placement time and in the recap ("my archer took the hill and got focused down"), which the range-ring telegraph and attribution recap already support.
- **Replaces:** Rejects the floated "players cannot start on high ground" rule. Sharpens the OQ-16 terrain-as-structure and OQ-19 anti-solution model (elevation is a counter-paired lever, not a stat). Deploy-zone authoring (from the OQ-6 form decision) remains the per-encounter control over *whether* the high ground is a start option; this decision governs *what standing there costs.*

## [2026-07-14] OQ-19 resolved: encounters are authored as anti-solutions — terrain+threat counter-pairs, validated by "the deathball dies legibly"

- **Decision:** An encounter is authored by designing **anti-solutions, not solutions.** Each encounter = **one primary threat + a terrain feature the enemy exploits + a different terrain feature that lets the player counter** (terrain authored in *counter-pairs*). The set of setups that avoid every anti-solution *is* the solution space — which makes it multi-solution automatically and makes each death point at one fixable cause. Threats are composed from a small reusable **library of "threat primitives"** (AoE artillery → punishes clumping; backline assassin → punishes exposed squishies; tank wall → punishes a frontal DPS race; high-ground archers → punish ignoring elevation; kite/skirmisher → punishes a slow deathball). **Difficulty scales by the number of *simultaneously interacting* threats, never by bigger stats** — early rounds = one threat / one lesson; later rounds = two threats that make a single counter insufficient so levers must be combined. Every authored encounter must pass a **4-point authoring test**: (1) name the intended lesson in one sentence; (2) the naive deathball loses, and loses *to that named lesson*, loudly — not to a diffuse stat gap; (3) ≥2 *distinct* setups win (genuinely different levers — where you stand / who you send / how you bait — not two flavors of one); (4) a wrong setup loses *readably* (one dominant cause of death). Because the sim is deterministic (hex, no in-fight hazards), this test is runnable, not a vibe: run the deathball + candidate solves and check.
- **Why:** With annihilate contributing zero spatial pressure (OQ-15) and terrain-as-structure carrying the whole positioning burden (OQ-16), the open risk was authoring stat-checks or single-solution key-locks by accident. Designing anti-solutions instead of solutions is what *structurally guarantees* the three required properties at once — deathball fails, multiple solves exist, and the loss is attributable — which is exactly what the watch-only retry loop needs to teach cleanly. It also turns authoring into **composition** (pick primitives + a counter-paired map) rather than per-encounter invention, and the 4-point test is a concrete gate a 2-person team can actually apply. This directly discharges the "raise a question with several answers, never announce its own answer" test handed forward from OQ-16.
- **Worked example (illustrative, not locked):** "The Plaza" — enemy AoE **Mage** + 2 tanky Grunts on a map whose obvious route funnels the player through a **narrow gap into an open plaza** (the kill zone), with **side walls** offering a longer flank route. Naive deathball clumps in the plaza and dies to two telegraphed fireballs landing on the bunched squishies (healer first → cascade). Three distinct solves: **split the approach** (positioning), **flank-snipe the Mage with a fast unit** (who-you-send), **bait the AoE onto the tank** (composition). Escalation: round 2 adds a backline **Assassin** that makes split-and-snipe conflict, forcing combined levers. The 5 illustrative starter heroes used to sanity-check this (tank / melee-DPS / fast-flanker / archer / healer) and the specific map are **illustrations, not committed content** — the *method* is what's decided here.
- **Replaces:** Resolves OQ-19, the last of the 🔨 prototype-spec gate ({OQ-16, OQ-17} → OQ-19). The prototype spec is now unblocked; next step is building the minimal core-loop prototype. Consumes the "several answers, not one" test from the OQ-16 entry and the positioning-burden constraint from OQ-15.

## [2026-07-13] OQ-17 resolved: discrete hex-grid simulation + continuous MOBA-style rendering (sim/skin split)

- **Decision:** Spatial resolution is a **fine hex grid at the simulation layer**, rendered as **continuous, real-time, MOBA-style motion at the presentation layer** — the two layers are deliberately decoupled. The engine reasons in discrete hex cells (range, AoE, pathing, adjacency, chokepoints); the player sees smooth interpolated movement over an arena skin, with the **grid hidden except on telegraph** (range rings, AoE footprints, aggro lines). The grid is **fine-grained** so interpolated motion reads continuous, not steppy. Chosen resolution is **hex, not square.** Both **continuous-2D-as-a-simulation-model** and **square grid** are dropped. Visual anchors: **Heroes 3** (hex/turn logic under an arena skin) and **TFT** (hex outlines fade out in combat + smooth hex-to-hex movement).
- **Why:** The player wants the MOBA look, **not** a continuous-positioning *mechanic* — and a look can be painted over a discrete sim, so there was never a real conflict; the two just live on different layers. A discrete sim is what the load-bearing constraints need: readability, authorability, determinism, and clean attribution for the watch-only retry loop. Continuous *simulation* is uniquely toxic here because combat is **watch-only** — the AI, not the player, makes every pathing choice and the player can't correct it, so fine-grained continuous space becomes an unreadable black box ("was it my setup or the pathfinder?"), which breaks attribution. Real-time interpolated rendering beats Heroes 3's turn-based snapping, so we expect to read *less* boardgamey than Heroes 3, not merely as good. **Hex over square** because hex's 6 equidistant neighbors give uniform distance and roughly **circular** ranges/AoE — directly serving the make-or-break readability constraint and the MOBA look — whereas square forces the diagonal-distance compromise (blocky diamonds or unrealistically cheap diagonals); hex also reads more organic and animates more fluidly. Accepted cost: hex is harder to author/tool (axial/cube coordinates, custom map editor), but it's a bounded, one-time, well-documented cost, small given only a *small* hand-authored map library.
- **Replaces:** the prior **"lean toward continuous 2D"** recorded under OQ-17. Resolves OQ-17 and sharpens OQ-10 (combat look). The continuous MOBA feel survives strictly as a **visual/presentation** layer, consistent with "chaos = visual-only."

## [2026-07-13] OQ-16 resolved: terrain-as-structure in the prototype, hand-authored, in-fight hazards deferred

- **Decision:** **Terrain-as-structure is in the first prototype** — real authored geometry (chokepoints, thin corridors, high ground, impassable walls) that gives positioning consequence and carries the positioning burden the annihilate win condition can't (per the OQ-15 constraint). Terrain is **hand-authored**, drawn from a **small library of maps** — **not procedural.** **"Variance" here means a different authored map per round** (a new puzzle each round), **not** in-fight random hazards. **In-fight random hazards (the OQ-8 sense of terrain-as-variance) stay deferred/parked** and are not mixed into the prototype. Standing design test for terrain features: a terrain feature must **raise a question with several answers, never announce its own answer** — a chokepoint that only rewards AoE is a single-solution stat-check, not a puzzle.
- **Why:** With annihilate contributing zero spatial pressure, terrain must supply it, and *structural* geometry (not random hazards) is what creates readable, authorable positioning consequence. Hand-authored over procedural because the Into the Breach model (our #1 ref) hand-authors precisely because reliably generating *fair, multi-solution* puzzles procedurally is an unsolved hard problem; a small authored library also keeps difficulty controllable for the same-difficulty retry loop. Hazards are deferred because dropping random in-fight events on top of structure would **muddy attribution** (was it my squad change or the random hazard?) and add build cost — they're a good *later* injector, not a prototype ingredient. The "different map per round" reading is what keeps each round a fresh puzzle without touching within-round determinism (retries stay same-difficulty because the map is fixed across retries and varies only between rounds).
- **Replaces:** Resolves OQ-16 and keeps it distinct from OQ-8 (terrain-as-variance/hazards, still deferred). Carries forward the OQ-15 constraint and hands the "several answers, not one" test into OQ-19 (puzzle authoring).

## [2026-07-13] OQ-15 resolved: annihilate is the prototype win condition; alternate objectives deferred as a per-encounter variety lever

- **Decision:** The fight's win condition for the prototype is **annihilate** — wipe the enemy squad. The other three candidates (**rout-the-commander, breakthrough-to-the-edge, hold-or-survive**) are **not dropped**; they are **deferred as a per-encounter variety/content lever** to add later. A standing constraint follows from this choice: because annihilate is the most stat-dominant objective and contributes **zero** spatial pressure of its own, **terrain (OQ-16) and encounter authoring (OQ-19) now own 100% of the positioning burden** — they must be what makes the naive deathball fail and multiple solves exist.
- **Why:** The objective type is not where strategic depth lives — Slay the Spire (a 🥇 reference) is pure-annihilate and deeply strategic; the depth is in the composition puzzle, not the goal. Annihilate is the *honest* prototype baseline precisely because it injects no free positional structure: an objective like rout-the-commander can paper over weak encounter design by handing you an artificial spatial goal, whereas annihilate forces terrain + authoring to carry the puzzle — testing the hardest thing first. Deferring the other three costs almost nothing in reachable design space: they return later as encounter-type variety ("this one is breakthrough, the boss is rout-the-commander"), which is *content*, not *depth*.
- **Replaces:** Resolves OQ-15 (previously "never actually decided"). Feeds a hard constraint into the still-open OQ-16 and OQ-19.

## [2026-07-11] Primary prototype loop = watch-only combat + retry-and-tune; mid-fight decision demoted to a secondary experiment

- **Decision:** The first prototype's core loop is **watch-only combat + a retry-and-tune learn loop**: the player sets up a squad, watches a readable fight resolve autonomously, and if it fails, **diagnoses why, adjusts the squad, and retries.** The **mid-fight tactical decision is demoted from a hard constraint to a parked secondary experiment** — revisited only if the retry-and-tune loop proves too thin. **Substitution is dropped** as the committed mid-fight form.
- **Why:** Retry-and-tune is the tightest expression of the education hook — watch → diagnose → change one thing → retest, with feedback in seconds instead of a whole round. It answers the old worry that PvE setup-only is too thin (it is *many* setup iterations with instant feedback, not one shot). Substitution lost its meaning once fog-of-war was dropped, and whether combat *develops* emergently enough to make any mid-fight reaction worthwhile is a prototype question, not a whiteboard one — so mid-fight is parked, not killed.
- **Replaces:** [2026-07-11] "Mid-fight decision retained — but it is NOT the timed ultimate," which made a mid-fight decision a **hard constraint**. Mid-fight is no longer a hard constraint; it is a secondary experiment. Distributed mastery still holds, but mastery now spans **draft + pre-fight setup + between-attempt tuning** rather than an in-fight call.

## [2026-07-11] Retry loop rationed by a limited number of attempts; unit attrition deferred

- **Decision:** The retry-and-tune loop is rationed by a **limited number of attempts** at a round, chosen so that **each retry is the same difficulty** (constant-difficulty retries → the loop teaches cleanly and outcomes stay attributable to the player's change). **Unit attrition** (units wearing out / being lost across the run) is **deferred to a later, separate mechanic**, added only after the core loop is proven fun.
- **Why:** Attrition-per-attempt curves experimentation backwards (abundant when content is easy, scarce when it's hard), risks a death spiral for the very player trying to learn, and muddies attribution by changing roster strength between tries. A flat attempt budget keeps difficulty constant across retries, so the player can isolate *their* change as the variable. Attrition is a good *second* economy (buy/upgrade trade-offs, stories-from-failure) but must not sabotage the core learn loop, so it comes later and separate.
- **Replaces:** Narrows the open "how is the retry loop rationed?" question. Leaves open whether the attempt budget is **per-round or per-run**.

## [2026-07-11] OQ-11 resolved: roster model — unlock widens the pool, every run starts from a default starter, power is built in-run

- **Decision:** This is a **roguelike, not a collection RPG.** Every run **starts from a fixed default starter squad**; all hero power is **built inside the run** via the draft. The unlocked hero **pool is unlimited** and grows via **run-completion rewards and buying** — but unlocking/buying only **widens the variety of heroes that can appear**, it never hands over pre-leveled power. Before a run, the player **brings a limited subset** of the unlocked pool as this run's draftable heroes (a strategic pre-run choice).
- **Why:** Keeps power inside the run, so mastery stays in *play*, not in an out-of-run wallet — avoiding the Heroes Charge trap where all mastery leaks into the collection/gear meta. Unlocking-as-variety is exactly the education refill bill (more combinatorial offers) without turning the game into a gacha.
- **Replaces:** OQ-11's open "where do new heroes come from / is this a collection game" framing. Leaves open **how tight the pre-run curation is** (the "adapt to what's offered" vs "pre-plan a build" dial) and the exact default-starter composition.

## [2026-07-11] OQ-11 resolved: per-hero persistence (build-up welds to the individual)

- **Decision:** Within a run, run-long build-up **attaches to the individual hero**, not to the fielded slot. A benched hero **keeps everything they earned** and returns to the field **fully built**. (Everything resets to the default starter at the start of each new run.)
- **Why:** Makes rotating heroes cheap and keeps the bench meaningful — a hero you invested in is still worth what you put in when you bring them back. Aligns with "the 5 are individual characters": investment sticks to a person.
- **Replaces:** OQ-11's open "per-hero persistence vs. lost-on-bench" sub-question.

## [2026-07-11] OQ-12 resolved (info model): fog-of-war dropped; opponent squads are readable puzzles with multiple solutions

- **Decision:** The player **always sees the opponent squad** — no hidden-information / fog-of-war. Enemy squads are designed as **readable puzzles with multiple valid solutions**, and building a counter should reward **creativity** (multiple viable ways to crack each encounter). The skill is **reading and countering a visible board**, not guessing a hidden one. This is the Into the Breach model.
- **Why:** "Guess the hidden enemy and bet" is a *suspense* mechanic (demoted to secondary) and, in PvE, evaporates on replay once the authored encounter is learned — and losing to hidden information isn't attributable to a player decision, which breaks the primary education/attributability hook. A visible, multi-solution puzzle keeps outcomes attributable and refills via combinatorial depth.
- **Replaces:** The fog-of-war / "guess and bet on the opponent's strategy" idea floated under OQ-12. Confirms education-primary (OQ-5) rather than reopening it.

## [2026-07-11] OQ-1 resolved: squad vs. squad on contained terrain

- **Decision:** The 5 are an **attacking squad that meets an enemy squad** on a contained battlefield — two squads meet in the middle of a terrain, no long march. Medieval-war framing: frontline tanks, backline ranged, mobile flankers striking from the side. *Not* a defended point holding off waves (no "hold the throne").
- **Why:** Resolves the foundational spatial question. A contained meeting-on-terrain keeps the fight watchable (no march) and gives positioning/role structure (front/back/flank) something to bite on, while leaving room for terrain-as-variance.
- **Replaces:** OQ-1's open defense-vs-offense framing (the "9 Kings hold-the-throne" option is dropped).

## [2026-07-11] OQ-2 resolved: run-long build-up = draft offers feeding the fielded 5 + the bench

- **Decision:** The run-long build-up is a **9 Kings-style draft** — one simple choice per round, deep outcome. It feeds **both** the fielded 5 **and** the bench (recruit new heroes / upgrade existing ones). It is *one* choice per round, not three parallel systems.
- **Why:** Keeps the simple-input / deep-output draft rhythm as the roguelike variety engine, now reconciled with the bench accepted on 2026-07-11: the draft is where both fielded and benched heroes get built up. Adapt to what's offered, not execute a pre-planned build.
- **Replaces:** OQ-2's open framing (upgrade-5 vs. non-hero elements vs. recruit-from-bench). Narrows it to draft-offers feeding heroes (fielded + bench); leaves bench *scope* (size, source, build-up attachment) as the open follow-on question.

## [2026-07-11] Mid-fight decision retained — but it is NOT the timed ultimate

- **Decision:** A mid-fight decision layer is a **hard constraint** (PvE without PvP makes pre-fight setup alone too thin to carry depth). It is **not** ultimate-timing — that reflex-timing model is dropped. It is a small number of **rationed / condition-gated**, low-attention tactical calls. Candidate forms (not yet narrowed): re-instruct team strategy/stance, mid-fight items/consumables, terrain alteration, and FM-style substitutions. A **bench is accepted as in-scope**, so substitutions is a live candidate.
- **Why:** Setup-only depth works in TFT / Super Auto Pets *only because they're (async) PvP* — the opponent keeps setup unsolved. In single-player PvE, all three reference games (Into the Breach, Slay the Spire, Balatro) put real decisions *inside* combat; removing ours makes the game more passive than its models. Rationing/gating keeps the attention cost that killed ult-timing from returning.
- **Replaces:** [2026-07-04] "Mid-fight form = the Timed Ultimate." Leaves [2026-07-04] "Mastery is distributed" **valid** — mastery again spans draft + setup + mid-fight; only the mid-fight *form* changed. **Opens a new question:** accepting a bench reopens roster/bench scope (bench size, where bench heroes come from, how run-long build-up attaches to benched vs. fielded heroes).

## [2026-07-11] Combat must be readable; "chaos" is visual-only

- **Decision:** Combat must be **readable** — education (the core watch-hook) requires the player to trace what happened. "Chaotic/destructive" is redefined to mean **visual liveliness only**: free movement, multiple terrains, varied skills and unit types — *not* outcome-unpredictability, *not* illegibility. Light RNG stays wanted, but capped at the point where it never makes the fight unreadable.
- **Why:** You can't learn a transferable lesson from an illegible swirl or a coin-flip. Readability is a precondition of the education loop.
- **Replaces:** [2026-07-04] "Dropped: clean, readable, MOBA-style combat" (which said combat should be chaotic/destructive and *not* readable). Readability is now required; only the visual surface stays lively.

## [2026-07-11] OQ-5 resolved: education-primary, PvE — not suspense/PvP

- **Decision:** The primary reason to watch a fight is **education** — the player reads what happens and applies the lesson to the next setup. The game is **single-player PvE**. **Suspense** ("will I win?") is demoted to a *secondary* effect (early-run, before content is learned; and execution-level, "can I pull the solve off under this random draw"), not the core hook. Primary references become **Into the Breach, Slay the Spire, Balatro**.
- **Why:** PvE + education is a proven, small-team-shippable path (ItB, StS, Balatro — none PvP; Balatro was one dev). PvE + suspense is structurally hard: authored content stops surprising once learned, so *durable* suspense needs an adaptive opponent (PvP/async — every setup-and-watch suspense autobattler, e.g. Super Auto Pets / Mechabellum, is async-PvP for exactly this reason). Education's refill bill is *content*, not an opponent: combinatorial depth (synergy × enemy × terrain) + difficulty tiers that force re-solving. This also matches the "watch to learn for next setup" instinct held from the start.
- **Replaces:** OQ-5's open "FM-style spectacle vs. 9 Kings-style solver" framing, and the implicit assumption that spectacle/suspense is the primary watch-hook. Sets aside the async-PvP autobattler cluster (Super Auto Pets, Mechabellum, Backpack Battles, The Bazaar) as PvP-dependent; async ghosts remain an optional *later* bolt-on, never the foundation.

## [2026-07-04] Mastery is distributed, not concentrated in the ultimate

- **Decision:** Player mastery spans the whole run — run-long build-up (the draft) + pre-fight setup + mid-fight ultimate timing. The ultimate is one lever among several.
- **Why:** If all mastery rode on the ultimate, the rest of the loop would be passive. Distributing it keeps every phase meaningful.
- **Replaces:** the earlier implicit assumption that the ultimate carried the whole mastery load.

## [2026-07-04] Mid-fight form = the Timed Ultimate

- **Decision:** Each character has an ultimate that charges as they fight; the player's mid-fight decision is *when to fire it*. One simple tap; the "should I have waited?" tension is the mastery lever, chain reactions supply the chaos.
- **Why:** Satisfies "simple input, deep decision." Heroes Charge / Dota Legends proves a charged manual-cast ultimate is readable and casual-viable.
- **Replaces:** the open question of what the mid-fight control actually is. Note the cautionary half of the Heroes Charge lesson: its ult timing was so shallow it was auto-castable, so all mastery lived in the collection/gear meta. Our ultimate must have a trade-off that makes "fire the instant it's ready" sometimes wrong (see open question in STATE).

## [2026-07-04] The 5 are individual characters, not anonymous groups/archetypes

- **Decision:** The unit of play is an individual character.
- **Why:** The ultimate-charging mechanic sticks to a *character*, so the unit must be an individual. Individuals also keep the Darkest Dungeon morale/rally drama available — a group can't have a personal breakdown you remember as a story.
- **Replaces:** the earlier open framing of squads-as-groups/archetypes.

## [2026-07-04] Core insight reframed: fun = the tension between mastery and chaos

- **Decision:** The core fun is the balance between mastery (decisions visibly shape outcomes) and chaos (surprise, spectacle, replayability). An engaging outcome is both *surprising AND attributable*.
- **Why:** Randomness alone isn't fun (a coin flip is max variance, zero fun); solved mastery is stale. The fun lives in the balance — pure chaos is a slot machine, pure mastery is a solved puzzle.
- **Replaces:** the earlier framing that leaned on chaos/randomness as the primary fun source.

## [2026-07-04] The "5 seconds to understand" rule is ad-creative-only, not a gameplay rule

- **Decision:** The 5-second-comprehension metric applies to whether a video *ad* reads in 5 seconds — not to the core gameplay loop.
- **Why:** Applied to gameplay it wrongly caps decision depth. Inputs stay simple, but the decision *behind* an input should out-complex the input.
- **Replaces:** the old use of "5 seconds to understand a screen" as a core-loop design constraint (now deprecated as a gameplay rule).

## [2026-07-04] Dropped: clean, readable, MOBA-style combat

- **Decision:** Combat should feel chaotic and destructive, not organized.
- **Why:** Watching the fight is half the fun; a clean MOBA readout undercuts the spectacle.
- **Replaces:** earlier preference for MOBA-style legible combat.

## [2026-07-04] Dropped: top-down view as a core experience

- **Decision:** Top-down is still aesthetically preferred but not a hill to die on.
- **Why:** It's a look, not a load-bearing design choice.
- **Replaces:** top-down-as-core-experience.

## [2026-07-04] Dropped: scaling player actions for depth

- **Decision:** Depth comes from making the *few* actions (pre-fight and mid-fight) impactful — not from adding more actions.
- **Why:** More actions = more cognitive load = bad for casual mobile.
- **Replaces:** the earlier "scale actions for depth" direction.

## [2026-07-04] Dropped: TFT as a primary reference (synergy is KEPT)

- **Decision:** TFT is no longer a primary reference (economy game, shared shop, trait synergies; too complex for the target audience, different fun source).
- **Why:** The fun we're chasing (watchable, attributable chaos) differs from TFT's economy/optimization fun.
- **Replaces:** TFT-as-primary-reference. **Important scope note:** this drops only the *TFT framing*. Synergy between characters/items is explicitly still wanted (see STATE) — it was never deprecated.

## [2026-07-04] STRATEGY.md deprecated pending rewrite

- **Decision:** `STRATEGY.md` is deprecated and will be rewritten from scratch later when needed. Do not treat it as current.
- **Why:** Superseded by the current design direction; keeping it as-is avoids conflicting sources of truth.
- **Replaces:** STRATEGY.md's status as an active document.

---

> **Backfill note:** all entries above are dated 2026-07-04 (the last working session before this log existed). They were migrated from the previous `CONTEXT.md` (rev 5) when it was split into STATE.md + DECISIONS.md on 2026-07-05. Exact original dates for each individual decision are not recorded; 2026-07-04 is used as the best-known timestamp.
