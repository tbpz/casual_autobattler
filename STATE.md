# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-08 (folds in two rebuilds DECISIONS.md had recorded but this file hadn't: the 2026-08-07 fight-causality rebuild — heat-based ignition eligibility, a bruiser wind-up, an in-fight enrage clock — backfilled into the log same-day-plus-one; and the 2026-08-08 rebuild that followed it, made in direct response to the player's own diagnosis of the 2026-08-07 build: the cascade was common but unsteerable, and the run was unlosable for a well-built squad, which read as "solved." The 2026-08-08 build adds a visible chainAffinity stat per hero, makes heat spendable per-roll instead of latched per-fight, fixes a flat-recovery bug that had been silently starving tanks, and retunes difficulty so a run can actually be lost. Batch-tuned and smoke-tested — Claude drove the built app in a browser and confirmed the new UI renders correctly with no console errors — but **not yet played and judged by either maker**, which is Next up #1.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1 has been through four fight-mechanism revisions since its first playable build. The most recent (2026-08-08) responded to two specific complaints the player stated directly after playing the 2026-08-07 revision: the cascade felt unsteerable (squad choice barely moved its odds), and the rest of the game felt like a solved puzzle (a well-built squad could not lose). Both are addressed in the current build — see Design status — but it hasn't been played and judged yet.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result was cast into a layered structure: **floor and ceiling are two separate layers, not one blended mechanic** → (5) the stakes shape was chosen (2026-07-28) → (6) the core loop's 30 seconds were specified as concrete mechanics (2026-07-29) → (7) squad size was fixed at N=3, parameterized (2026-07-30) → (8) a `DESIGN_QUESTIONS.md` pass turned the single fight into a full run — 5 fights, attrition, an in-run coin economy (2026-07-31) → (9) **prototype #1 was built for real** per `PROTOTYPE_PLAN.md`'s phases, then played (2026-08-04) → (10) **the verdict was "not fun,"** diagnosed as a legibility failure → (11) **the fight's mechanism was revised** (2026-08-04): per-hero attack beats, a visible enemy bruiser, wipe-only resolution, hero roles, a squad pick, a pre-fight read → (12) **that revision was played again and judged still not fun** — per-hero state was unreadable, and the fight felt scripted (a chain-ignition tell fired on ~65% of fights while its payoff landed on ~7%) → (13) the player sharpened the complaint further: the payoff needs to be *rare and earned by a chosen risk* → (14) both complaints were traced to specific causes in the running code → (15) **the fight was rebuilt** (2026-08-06): per-hero HP bars, a tank-break dip mechanism, spectacle tiered to chain length, the squad pick wired to a risk band via a projection module → (16) **that build was rebuilt again the next day (2026-08-07, backfilled into DECISIONS.md 2026-08-08)**: the 2026-08-06 tank-break ignition gate had a fatal flaw — it made the cascade structurally unreachable on a winning path, and *inverted*, so the fastest/riskiest squad had the LOWEST spectacle rate (0.5–0.9%, batch-verified). Replaced with a per-hero HEAT meter (accrues from each hero's own dealt/soaked/restored), plus a telegraphed bruiser wind-up and an in-fight enrage clock as the new sources of jeopardy → (17) **the player played that 2026-08-07 build and named two new, specific complaints**: the cascade is common (~24% of fights) but *unsteerable* — squad choice moved its odds by only ~4 points across all 20 possible squads, and nothing in the game taught what to pick for it, unlike a Dota player deliberately building Daedalus on Gyrocopter; and the rest of the game felt like *a solved puzzle*, because the default squad (and 4 of 20 possible squads) completed 100% of runs with 0.00 deaths — there was no cost to being wrong → (18) **root-caused and rebuilt again (2026-08-08)**: every hero gained a visible `chainAffinity` stat that sets both how often and how big its chains are, making squad choice the actual cascade lever; heat is now spent on every roll (win or lose) instead of latching after one attempt per fight, so a dangerous fight earns multiple shots at the cascade while a clean one earns one — tying the cascade to danger as an emergent consequence; a bug was found and fixed where auto-recovery between fights was a flat HP amount that silently starved only the tank while fully healing every squishy hero regardless of squad, which had been inverting the risk dial; and difficulty was retuned so the best squad lands around 65% run completion with real deaths, instead of ~100%. Steps 1–18 are done; **step 18's build has not yet been played and judged by either maker** — that's Next up #1.

**The lead moment, the run shape, and the coin economy are unchanged** by any of the fight-mechanism revisions (2026-08-04 through 2026-08-08). What changed across all of them is how the fight's jeopardy and cascade are *caused*, *gated*, *sized*, and *rendered* — not what the fight is for.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26/28, mechanized 2026-07-29/31)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is met:

- **Watch-native** — assemble, press play, watch. The core loop is exactly this shape, with no reading or deliberate choice required to reach the payoff. The squad pick and pre-fight read both ship with a working accept-default so the minimum path is still Play → watch → Play.
- **"Pay off far bigger than expected"** — carried by a pre-fight projection stating a concrete expectation in seconds, a post-fight recap comparing it against what actually happened, and the chain itself, whose full spectacle is reserved for fights that land a 3+-hit chain (batch-verified 2026-08-08: ~34–37% for the default squad, up from the 2026-08-06 target of ~7-8% — see Probe/live-status table for why that number moved and what it now means).
- **"Couldn't fully predict"** — two independent dice (whether the cascade ignites, and how long the chain runs) inside a layered relationship: RNG supplies the floor inside the mandatory core loop, emergent combination supplies the ceiling inside a fully optional layer on top. Per-hit damage also carries its own variance (±25%).
- **"Looked like it might fail first"** — **as of 2026-08-08 this can be genuinely true**, not just visually implied: the default squad completes 65% of runs with real deaths (mean 1.2/run), and 43.6% of successful ignitions now fire while the player's pool is below 40% of its fight-start max — the near-death-turned-cascade shape the player named as the game's best moment is a measured, common outcome of play, not a rare accident of the old, unlosable build.
- **"Claim as mine"** — the friend's own play showed he does not read for or generate attribution, treating RNG outcomes purely as luck; attribution is Tu's need specifically. As of 2026-08-08 the squad-pick screen states the cascade lever directly (each hero's `chainAffinity`, shown as pips, plus a one-line identity), so a player can *choose* to build toward the cascade the way a Dota player chooses Daedalus on Gyrocopter — not just receive it as an accident of a random roll.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. |
| Core loop — fight mechanics | Rebuilt four times since the first playable build (2026-08-04 ×2, 2026-08-06, 2026-08-07, 2026-08-08). Current mechanism: per-hero HP bars and job counters; a bruiser wind-up and an in-fight enrage clock as jeopardy sources; ignition eligibility is a per-hero HEAT meter (highest-heat living hero, weighted by that hero's `chainAffinity`) that is SPENT on every roll — win or lose — rather than latched once per fight, so a dangerous fight earns multiple attempts; chain damage is multiplicative off the hot hero's own damage stat AND its own `chainAffinity`. Batch-tuned; not yet played. See DECISIONS.md's 2026-08-07 and 2026-08-08 entries and `prototype/src/sim/fight.ts`, `heroes.ts`, `projection.ts`. |
| The run — shape | Specified 2026-07-31 (5 fights, attrition, coin economy). Unchanged in shape by any fight-mechanism revision, but attrition is now load-bearing for the first time: auto-recovery between fights is a fraction of each hero's own max HP (`autoRecoverFraction`, 2026-08-08), not a flat amount — the flat version had silently starved only the tank while fully healing every squishy hero, which inverted the intended risk ordering when difficulty was raised. |
| Optional layer — concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional — forcing it failed 4/4 times. |
| Optional layer — contents | The run's one coin-spend decision (heal now vs. bank toward a damage upgrade), with a working accept-default. The run-start squad pick (3 of 6) has two composition effects as of 2026-08-08: it sets a fight's risk band (comfortable/tight/losing, via `sim/projection.ts`) AND it sets the cascade's frequency and size directly via each picked hero's `chainAffinity` (shown as pips on the pick screen). Bench and a picked squad's effect on later fights remain unspecified candidate content. |
| Prototype #1 — scope | Scoped 2026-07-31 as a *vehicle*. Built 2026-08-04, played twice, revised four more times since (2026-08-06/07/08). The 2026-08-08 build is smoke-tested (Claude drove the app in a browser; UI renders correctly, no console errors) but not yet played and judged by either maker. See `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Chosen 2026-07-28: economy run-scoped, never permanent (still true). In-fight jeopardy is squad-dependent, not mandatory (2026-08-06, still true). **As of 2026-08-08 the run can genuinely be lost** for the first time since prototyping began: default-squad run completion is 65.4% (n=2000) with a mean 1.2 deaths/run, versus ~100% completion / 0.00 deaths before this pass. Batch-verified funnel for the default squad: dip rate ~21%, ignition rate ~82%, full-spectacle (chain≥3) rate ~34-35%, and — the direct measure of the player's cherished moment — 43.6% of successful ignitions fire while the pool is below 40% of its fight-start max (target was ≥35%). |
| Stakes — concrete devices | Chosen 2026-07-31: coin, earned per fight, lost on a run loss; spent on healing or an upgrade. Unchanged in shape. An elected in-fight bank-or-push escalation and a rival scoreboard remain open, separate ideas — not decided. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started — gated behind playing and judging the 2026-08-08 revision (Next up #1). |

## Next up

1. **Play the 2026-08-08 revision and judge it**, against `PROTOTYPE_PLAN.md`'s two completion criteria (specific differentiated reactions; can it surprise its makers). Specifically check: can the player now name, at squad-pick time, which comp is their "Daedalus" pick for the cascade (the `chainAffinity` pips + identity lines are the answer this build ships); and does a cascade firing from a near-loss actually feel like the moment the player described, now that it's a measured ~44% of ignitions rather than ≈0%. The dev build is playable via `npm run dev` in `prototype/`.
2. **Known open tuning gap (2026-08-08):** `bracer+vex+cairn` and `vex+cairn+ward` — the safest tank, the highest-damage dealer, and a real healer, together — stay at ~99-100% run completion regardless of how hard the difficulty ramp (`difficultyRampFactor`/`difficultyDamageRampFactor`) is pushed, because they kill fast enough that neither more enemy HP nor more exposure time bites. This is a hero-stat-level problem (no weakness on any axis a global ramp can reach), not a global-tuning one — see `prototype/src/sim/heroes.ts`'s pool docstring. Every other comp, including the default roster, shows a real spread of risk.
3. **Keep tuning by playing and by the batch harness.** Current numbers for the default squad (batch-verified 2026-08-08, n=2000): run completion 65.4%, dip rate ~21%, ignition ~82%, full-spectacle (chain≥3) ~35%, chains-while-losing ~44%. `checks/chaindist.ts` pins these as regression bands.
4. **Ask the friend one cheap question**: does losing the run's coin on a loss satisfy his unprompted "lose something on failure" ask, or did that mean permanent loss?
5. **Reconcile the 5-vs-3 squad-size contradiction**: `[2026-07-04]`/`[2026-07-11]` in DECISIONS.md fix the squad at 5 + bench; the build uses N=3 (via a 6-hero pick pool, still choosing exactly 3). Either those entries are superseded, or the optional layer's headline effect is widening 3→5 — currently written down as neither.
6. **Whether attrition needs a bench to avoid spiraling** is no longer purely theoretical now that attrition is load-bearing (2026-08-08) — worth re-checking once the build is played, not just batch-verified.
7. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–6 are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Squad:** N=3 a side for the prototype — a tuning constant, not a fixed commitment. One screen, no camera cuts. The 6-hero pool has two heroes per role (tank: Bracer/Hollow, damage: Rook/Vex, support: Cairn/Ward), each pair trading on a different axis (HP/damage/cadence AND, as of 2026-08-08, `chainAffinity`), so the squad pick is a real risk-and-cascade choice, not just a flavor choice. Ward additionally attacks on the same beat it heals (`attacksWhileHealing`, 2026-08-08), so a two-support comp is no longer an automatic loss.
- **Scoreboard:** six (or fewer, post-attrition) individual HP bars, proportionally sized to each hero's maxHp both within and across sides. A job counter (soaked/dealt/restored) sits under each body, and a labelled `CHAIN` bar (2026-08-08; previously an unlabelled "heat" bar) shows that hero's progress toward its next ignition roll — including visibly draining on a miss, since heat is now spent per-roll.
- **Beats:** opening exchange (symmetric, boring) → **the dip** (driven by a tank's line breaking under sustained fire, or by the enemy bruiser's telegraphed wind-up and the in-fight enrage clock, both added 2026-08-07) → **ignition** (a distinct tell only once the chain reaches a length threshold) → **the chain** (the enemy meter collapses at a visibly different pace once the tell threshold is crossed) → **resolve**. Fights resolve by wipe rather than a fixed-length timer.
- **The cascade is an escalating crit/proc chain.** One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next, capped at 7 hits. A bonus hit does more damage than the last, multiplicatively off the hot hero's own damage stat AND its own `chainAffinity` (2026-08-08) — so a hot Vex is explosive, a hot Rook is frequent-but-modest, and a hot Bracer is a near-total damp squib, by design.
- **Ignition eligibility is a per-hero HEAT meter (2026-08-07), spent per-roll (2026-08-08):** heat accrues from each hero's own dealt/soaked/restored, weighted both by a fixed per-source weight and by that hero's own `chainAffinity`. The highest-heat living hero above threshold triggers a roll; its heat resets to 0 whether the roll fires or fizzles, so it must rebuild before rolling again — a single fight can now contain several attempts. A persistent PRD counter (`ignitionChanceByAttemptsSinceIgnition`) tracks failed attempts across rolls, not across fights.
- **Two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**.
- **The cascade is the big win, not the only win.** Guarded by a batch metric (fraction of wins with no chain, ~35% for the default squad as of 2026-08-08).
- **Enemies do not cascade**, in the prototype — kept as the player's signature, cheap to reverse later.
- **The squad pick has two composition effects (2026-08-08):** a shared projection module (`sim/projection.ts`) scores a chosen squad as comfortable/tight/losing (survival odds), shown on the squad-pick and pre-fight screens; and each hero's `chainAffinity`, shown as pips on the pick screen, sets the cascade's frequency and size directly. A comfortable squad is designed to win with real but moderate risk; the framing of "safe squad = no cascade access" from 2026-08-06 no longer holds now that heat-based eligibility (2026-08-07) is reachable on any winning path — see Next up #2 for the residual gap this creates (some safe-and-fast comps are still nearly unlosable).
- No reading or deliberate choice is required at any point to get the full payoff — the squad pick and pre-fight read both ship with a working accept-default.

**The run (mandatory shape, one optional decision) — five fights:**

- **Length and end conditions:** 5 fights. Win all 5 to complete the run. Run out of living heroes and the run ends.
- **Attrition:** HP and death both carry between fights. HP is recoverable via a free auto-recovery tick between fights (no input required) — as of 2026-08-08 this recovers a *fraction* of each hero's own max HP, not a flat amount (see Design status for why the flat version was a bug). Death is permanent for the run; max squad HP is the sum of living heroes' individual max HP.
- **Coin:** earned per fight won, more if a cascade fired. Spendable on exactly **one decision point** — heal now, or bank toward a run-long damage upgrade — with a working accept-default.
- **On a loss:** the run ends and its coin is lost. Nothing carries to the next run.
- **Difficulty ramp:** enemy HP rises per fight (`difficultyRampFactor`, 1.12), and — new as of 2026-08-08 — enemy per-hit damage rises much more gently (`difficultyDamageRampFactor`, 1.05), added specifically because an HP-only ramp couldn't threaten a fast-killing, well-protected comp (see Next up #2).

**Optional layer (fully skippable, beyond the run-level lever above):** a run-start squad pick that sets both a fight's risk band and the cascade's frequency/size (2026-08-08). Squad recruitment/drafting beyond the current 6-hero pool, hero synergies beyond the risk-and-cascade dial, and between-attempt tuning remain unspecified candidate content. The old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) lives here as candidate content — see Next up #5 for the unreconciled 5-vs-3 tension this creates. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- **Attrition can spiral without a wider roster.** Named as a cost when attrition was chosen (2026-07-31). As of 2026-08-08 attrition is load-bearing for the first time (mean 1.2 deaths/run for the default squad, up from 0.00) — this risk is no longer purely theoretical and is worth re-checking once the build is played (see Next up #6).
- **The core loop's cascade is a trigger, not a decision** inside a single fight, but **which hero is likely to carry it is now a decision made at squad-pick time** (2026-08-08's `chainAffinity`) — decision-density at pick time, trigger-only within the fight itself; the core loop remains the casual half.
- **Combat must be readable — chaos is visual-only, capped RNG.** Implemented via state-dependent weighted targeting (a holding tank draws 3× incoming attacks; a broken tank draws the same weight as everyone else) and ±25% per-hit damage variance.
- **Mastery is a ceiling, never a gate.** This is the filter that ruled permanent stakes out and that any new mechanic must pass. The run's coin economy satisfies it by being run-scoped; the squad pick's risk-and-cascade effect is a second test of the same filter, now with a real cost (losable runs) to make the choice matter.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move. **This filter is not yet fully satisfied** — two squads (`bracer+vex+cairn`, `vex+cairn+ward`) remain a near-dominant move regardless of difficulty tuning (Next up #2); the filter holds for every other comp in the pool.
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play, and the run wrapper adds exactly one (plus the squad pick). An elected bank-or-push button remains a distinct, still-open idea separate from the coin-spend already built.
- Opponent squads (when the optional layer engages combat setup) are readable, full-information puzzles with multiple valid solutions — no fog-of-war. The pre-fight read is a first, minimal instance of this for the enemy's fixed (bruiser + grunts) composition.
- Per-hero persistence, bench, and roguelike roster rules (fixed starter squad, unlockable pool, power built in-run only) apply within the optional layer.
- Mid-fight tactical decision remains parked — not in the core loop or the optional layer for now.
- The "5-second to understand" rule is ad-creative-only, not a gameplay-loop constraint.

## Reference games (by relevance)

| Priority | Game | Why it matters |
|---|---|---|
| 🥇 | Balatro | The concrete structural model: a first-time player watches the score climb and feels the spike without reading a single joker (core loop), while a deeper player mines synergies underneath (optional layer). Its expanding-pool pattern is the fix for the rejected draft sketch; its run-scoped, elected escalation is the model for the stakes economy. |
| 🥇 | Into the Breach | Full-info, multi-solution puzzle that stays unsolvable without an opponent — reference for the optional layer's puzzle design. |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers refill the learn-loop — reference for the optional layer. Its permadeath is *not* the model here; stakes stay run-scoped. |
| 🥈 | Dota (crit / PRD) | The direct source of the cascade's shape: an escalating proc whose chance climbs after each miss but never reaches certainty. Also the direct source of the `chainAffinity` framing (2026-08-08): the player's own reference point for "a legible, elected build choice that changes the odds and size of a payoff" was a Dota player choosing Daedalus on Gyrocopter, or picking Phantom Assassin, specifically because he knows it will be more fun. |
| 🥈 | Darkest Dungeon | Risk/reward, stress/morale, character attachment; the friend's own named design ideal (auto-combat DD), and the direct source of the 2026-07-31 attrition decision (HP persists, death is permanent) — now load-bearing for the first time as of 2026-08-08. |
| 🥈 | Heroes 3 | Hex/turn combat under an arena skin — visual anchor for the optional layer's hex-sim rendering. |
| 🥈 | TFT | On-board placement, hex-to-hex motion — reference for the optional layer. |
| 🥈 | PES / bot games | Proof watching high-variance AI-vs-AI is entertaining — reference for the core loop's watch-only bet. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch shape, but async-PvP — studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | Draft Showdown (App Store) | Trigger for the original discovery phase — real-time PvP draft-autobattler; deterministic puzzle-solving is absent from it. |

## Open questions

**Top priority — shapes the build:**

- **What the optional layer is allowed to modify in the fight** — *further answered 2026-08-08*: the squad pick now sets both a fight's risk band and the cascade's frequency/size directly (`chainAffinity`). Still open: whether it should modify the fight-level hinge further (base heat weights, escalation step, cap) beyond what a hero's own stats already do.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.
- **Whether attrition needs a bench to avoid spiraling** — no longer purely theoretical now that attrition is load-bearing (2026-08-08); needs re-checking once the build is played.

**Non-blocking, resolve during/after the build:**

- The heat-weight and threshold constants — strawman values as of 2026-08-08 (see `sim/config.ts`), to be tuned by feel and by the residual "two near-unlosable comps" gap (Next up #2).
- Whether to add a further **elected bank-or-push escalation within a fight** (distinct from the between-fight coin spend already built), and whether to add a rival-bot scoreboard as a legibility skin on the score.
- Whether run-scoped loss (losing the run's coin) satisfies the friend's "lose something on failure" ask (see Next up #4).
- The 5-vs-3 squad-size contradiction (see Next up #5).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft), if drag-placement is kept in the optional layer.
- OQ-14 — pre-run roster curation tightness (partially informed by the squad pick's 6-pool/pick-3 shape, still not settled as the final answer).

**Longer-horizon:**

- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost) — the post-fight recap's projected-vs-actual line, plus the 2026-08-08 "no chain — none caught" miss line, are the fullest instances of this so far.
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if the optional layer's build suggests it's needed.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — the working draft of one fight's 30 seconds. Superseded on several points by the 2026-08-04, 2026-08-06, 2026-08-07, and 2026-08-08 combat-model revisions (noted inline in the file where caught). Still current: both PRD tables' shape (though their contents have moved), and the beat-sheet's overall *sequence* (opening exchange → dip → ignition → chain → resolve).
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — the build doc for prototype #1: scope, stack, run-level constants, and build phases. Phases 0–4 are done; Phase 5 (play, watch, judge) has run two cycles (2026-08-04, 2026-08-04-replay) plus one more against the 2026-08-07 build, and needs a fourth against the 2026-08-08 revision.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned the single fight into a full run; 12 of 30 answered as of 2026-07-31, the rest triaged by whether they block code, hang off an answered question, or should be stubbed and settled by playing.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
- `prototype/` — the actual code: `src/sim/` (heroes.ts, fight.ts, run.ts, config.ts, projection.ts, types.ts, events.ts — pure, headless), `src/render/` (DOM view + screens, including the 2026-08-08 `CHAIN`-labelled heat bar and squad-pick affinity pips), `src/batch/` (the tuning harness, with a `--squad comfortable|tight|greedy|id,id,id` flag), `src/checks/` (regression checks, `npm run check`). Run it with `npm run dev` inside `prototype/`.

> `probe/` (the disposable RNG/emergence/wired toys and `FRIEND_TEST_PROTOCOL.md`) and `ONMAP_SETUP_PLAN.md` were deleted 2026-07-31 as stale — the old prototype build they supported is gone. DECISIONS.md's 2026-07-26 entry still names `probe/FRIEND_TEST_PROTOCOL.md` as the session runbook; that reference is now historical only, not a live path.
