# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-04 (folds in the 2026-08-04 legibility rewrite: prototype #1 was built, played, judged not fun, and revised — per-hero combat, a visible enemy bruiser, wipe-only resolution, hero roles, a run-start squad pick, and a pre-fight read replace the original side-level-DPS/timer fight mechanism.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1 is built and playable (headless sim, run wrapper, batch harness, DOM render, run screens — `PROTOTYPE_PLAN.md` Phases 0–4 done). Phase 5 (play, watch, judge) has run one full cycle: played, judged not fun, revised. The next session should play the revised build and judge again. Monetization and UA come later.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result was cast into a layered structure: **floor and ceiling are two separate layers, not one blended mechanic** → (5) the stakes shape was chosen (2026-07-28) → (6) the core loop's 30 seconds were specified as concrete mechanics (2026-07-29) → (7) squad size was fixed at N=3, parameterized (2026-07-30) → (8) a `DESIGN_QUESTIONS.md` pass turned the single fight into a full run — 5 fights, attrition, an in-run coin economy (2026-07-31) → (9) **prototype #1 was built for real** per `PROTOTYPE_PLAN.md`'s phases, then played (2026-08-04) → (10) **the verdict was "not fun,"** diagnosed as a legibility failure — the fight had no actors, only two meters moved by a hidden formula, so nothing on screen explained why HP moved or why a fight turned around → (11) **the fight's mechanism was revised** (2026-08-04, logged in DECISIONS.md): per-hero attack beats replaced the side-level DPS model, a visible enemy "bruiser" replaced the DPS-decay curve as the dip's cause, fights resolve by wipe instead of a 30s timer, hero roles were added, and a run-start squad pick plus a pre-fight enemy read were added so "assemble your squad" is a real, skippable step. Steps 1–11 are done.

**The lead moment, the run shape, the coin economy, the eligibility gate, and both PRD tables are unchanged** — step 11 changed how the fight's mandatory jeopardy is *caused* and *rendered*, not what it's for. See DECISIONS.md's 2026-08-04 entry for the full rationale and what it puts at risk.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26/28, mechanized 2026-07-29/31)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is met:

- **Watch-native** — assemble, press play, watch. The core loop is exactly this shape, with no reading or deliberate choice required to reach the payoff. The 2026-08-04 build adds a squad pick and a pre-fight read; both ship with a working accept-default so the minimum path is still Play → watch → Play.
- **"Pay off far bigger than expected"** — the proc chain usually fizzles immediately, so the *expected* outcome genuinely is small; the runaway chain is the exception that reads as a spike. On the current fight-level constants, a genuine runaway (3+ bonus hits) lands in roughly 7% of fights (batch-verified 2026-08-04, matching the original ~7% target even after the combat-model rewrite). The pre-fight read (2026-08-04) is what gives the player a baseline to be surprised relative to.
- **"Couldn't fully predict"** — two independent dice (whether the cascade ignites, and how long the chain runs), inside a layered relationship rather than a blended one: RNG supplies the floor inside the mandatory core loop, emergent combination supplies the ceiling inside a fully optional layer on top.
- **"Looked like it might fail first"** — met by mandatory in-fight visible jeopardy, enforced by a deterministic eligibility gate so the near-loss is a real sim state rather than a staged animation. As of 2026-08-04 the jeopardy's *cause* is a visible enemy bruiser (killing it is the turnaround) rather than a hidden timer. It doubles as the core loop's attribution device: near-loss-then-recovery reads as the player's own story even when the dice did the work. Still depends on the dip reading as losing even though it's escapable — see Working assumptions.
- **"Claim as mine"** — the friend's own play showed he does not read for or generate attribution, treating RNG outcomes purely as luck. Attribution is therefore understood as **Tu's need specifically**, met by the optional layer — with in-fight jeopardy supplying a weaker, no-reading-required version inside the core loop, and the 2026-08-04 post-fight recap line giving an explicit causal account after the fact.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. |
| Core loop — fight mechanics | Specified 2026-07-29/31 (beats, scoreboard, cascade, ignition gate). **Built 2026-08-04**, then revised the same day for legibility: per-hero attack beats, an enemy bruiser, and wipe-only resolution replace the original side-level-DPS/timer mechanism. Unchanged: the eligibility gate, both PRD tables, the bonus-hit formula. See `PROTOTYPE_PLAN.md`'s 2026-08-04 note and `DECISIONS.md`. |
| The run — shape | Specified 2026-07-31 (5 fights, attrition, coin economy). **Built 2026-08-04.** |
| Optional layer — concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional — forcing it failed 4/4 times. |
| Optional layer — contents | The run's one coin-spend decision (heal now vs. bank toward a damage upgrade), with a working accept-default. **A run-start squad pick (3 of 6, default pre-filled) added 2026-08-04** as the first piece of literal "assemble your squad" content. Everything beyond that — bench, synergies, a picked squad's effect on the fight — is still unspecified candidate content. |
| Prototype #1 — scope | Scoped 2026-07-31 as a *vehicle*, not a hypothesis test. **Built and played 2026-08-04** — judged not fun, diagnosed as a legibility failure, revised same day. Not yet re-judged. See `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Chosen 2026-07-28: in-fight jeopardy mandatory; economy run-scoped, never permanent. Permanent/account-level loss is ruled out. |
| Stakes — concrete devices | Chosen 2026-07-31: coin, earned per fight, lost on a run loss; spent on healing or an upgrade. Costs re-tuned 2026-08-04 (see Related files) after the batch harness showed the original heal cost trivializing run completion. An elected in-fight bank-or-push escalation and a rival scoreboard remain open, separate ideas — not decided. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started — gated behind re-judging the 2026-08-04 revision (Next up #1). |

## Next up

1. **Play the revised prototype and judge it again**, against `PROTOTYPE_PLAN.md`'s two completion criteria (specific differentiated reactions; can it surprise its makers) — not against "is this fun yet," which is still the friend session's question. The dev build is playable via `npm run dev` in `prototype/`.
2. **Keep tuning by playing and by the batch harness**: current numbers (batch-verified 2026-08-04) are passive run-completion ≈33% (target ~25%) and engaged policies spanning ≈41–74% (target ~50%) depending on which lever is pulled. Heal remains the strongest lever specifically because it's the most direct counter to permanent-death attrition — see Working assumptions.
3. **Watch two specific risks, sharpened by the rewrite:**
   - Whether the dip still *reads* as losing now that its cause (the bruiser) is visible and killable rather than a hidden clock — unchanged concern, now more directly testable since the player can watch it happen.
   - Whether attrition spirals without a bench — the 2026-08-04 tuning pass reinforced this as a live risk rather than resolving it: across canned policies, healing (which directly offsets attrition) produces dramatically higher run-completion than the other levers, suggesting permanent death is the dominant difficulty driver.
4. **Ask the friend one cheap question**: does losing the run's coin on a loss satisfy his unprompted "lose something on failure" ask, or did that mean permanent loss?
5. **Reconcile the 5-vs-3 squad-size contradiction**: `[2026-07-04]`/`[2026-07-11]` in DECISIONS.md fix the squad at 5 + bench; the build uses N=3 (now via a 6-hero pick pool, still choosing exactly 3). Either those entries are superseded, or the optional layer's headline effect is widening 3→5 — currently written down as neither.
6. **Build the optional layer's next content.** The 2026-08-04 squad pick is a first piece (choosing *who*); still open: what the choice *does* to the fight beyond flavor (a picked squad currently has no synergy or composition effect beyond individual stats), checked against the decision-density filter (must draw on genuinely new info, must never leave the passive default better than engaging, must resist collapsing to one repeatable optimal move) and modeled on Balatro's expanding-pool pattern.
7. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–6 are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Squad:** N=3 a side for the prototype — a tuning constant, not a fixed commitment (parameterized so it can move without a refactor; see `FIGHT_SCRIPT.md` §1, though its side-level-budget framing is superseded by per-hero stats as of 2026-08-04 — see Related files). One screen, no camera cuts.
- **Scoreboard:** HP remaining, as two aggregate meters — one per side. Not per-hero bars (six bars have no shared scale, so a glancing player can't tell who's winning) and not an accumulating score against a target (the moment is a comeback, not a jackpot). Per-hero state shows as bodies falling over, not as tracked numbers.
- **Beats:** opening exchange (symmetric and deliberately boring) → **the dip** (the player's meter drops faster; in the bad case a hero falls — not every dip, since attrition makes a body lost every fight arithmetically impossible over 5 fights; must read as "losing" to someone glancing with no rules knowledge) → **ignition** (a distinct tell — shake, flash, name-callout) → **the chain** (the enemy meter collapses at a visibly different pace, font/sound/tick all change) → **resolve** (run-scoped stakes settle, retry appears). As of 2026-08-04 the fight resolves by wipe rather than a fixed-length timer, so beat timing varies fight to fight rather than landing on a fixed ~30s clock.
- **The cascade is an escalating crit/proc chain.** One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next. A bonus hit does **more damage than the last** (crit-style escalation), fired by the same hero throughout, retargeting when its target dies. A chain usually fizzles at once and occasionally runs away exponentially.
- **Ignition is two-stage:** a *deterministic* eligibility gate (the cascade is not rollable until the sim reaches a real jeopardy state through normal combat — player pool at or below 40% of current max) then a *pseudo-random* ignition roll whose chance climbs with every cascade-less fight and is capped below 100%. The cascade does not fire every fight — the dice decide **whether**, not merely **when**.
- **Two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**.
- **The cascade is the big win, not the only win.** The dip is escapable by ordinary combat resolution — guarded as of 2026-08-04 by a batch metric (fraction of wins with no chain, currently ≈79%) rather than by hope.
- **Enemies do not cascade**, in the prototype — kept as the player's signature, cheap to reverse later.
- No reading or deliberate choice is required at any point to get the full payoff — the 2026-08-04 squad pick and pre-fight read both ship with a working accept-default.

**The run (mandatory shape, one optional decision) — five fights:**

- **Length and end conditions:** 5 fights. Win all 5 to complete the run. Run out of living heroes and the run ends.
- **Attrition:** HP and death both carry between fights. HP is recoverable — a free auto-recovery tick between fights, no input required, keeps the passive path viable. Death is permanent for the run; max squad HP is the sum of living heroes' individual max HP (heroes are no longer uniform as of 2026-08-04, so this is no longer a flat multiple of a single hero's HP).
- **Coin:** earned per fight won, more if a cascade fired. Spendable on exactly **one decision point** — heal now, or bank toward a run-long damage upgrade — with a working accept-default (doing nothing still completes runs via auto-recovery alone). Costs re-tuned 2026-08-04; see Related files.
- **On a loss:** the run ends and its coin is lost. Nothing carries to the next run — the economy is entirely run-scoped, per the 2026-07-28 stakes-shape decision.
- **Difficulty ramp:** enemy HP rises per fight (damage does not, as of the 2026-08-04 tuning pass — scaling both compounded far faster than intended), so later fights are a longer grind rather than a harder-hitting one.

**Optional layer (fully skippable, beyond the run-level lever above):** a run-start squad pick (2026-08-04, first concrete content), squad recruitment/drafting beyond that, hero synergies, between-attempt tuning. The old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) lives here as candidate content, not a core-path requirement — see Next up #5 for the unreconciled 5-vs-3 tension this creates. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- **The dip must still read as losing even though it is escapable.** This is the accepted cost of making the cascade the big win rather than the only win: if the player can sometimes just play out of the dip, jeopardy risks becoming ceremonial. If that tuning proves impossible, cascade-as-big-win is the first piece to revisit.
- **Attrition can spiral without a wider roster.** Named as a cost when attrition was chosen (2026-07-31); **sharpened by the 2026-08-04 tuning pass**, which found healing (the most direct counter to permanent death) dominates the other two canned spend policies by a wide margin on run-completion — a sign this risk is real, not hypothetical. The bench is the likely fix if playtesting confirms it.
- **The core loop's cascade is a trigger, not a decision.** Accepted deliberately — decision-density is the optional layer's job, and the core loop is explicitly the casual half.
- Combat must be readable — chaos is visual-only, capped RNG — so the escalating outcome feels exciting without requiring comprehension. As of 2026-08-04 this is implemented via weighted-random (not uniform) enemy targeting: a tank draws more incoming attacks than a squishy ally, but not deterministically every hit, so an individual hero's survival stays genuinely uncertain while the aggregate pool trajectory stays tunable.
- **Mastery is a ceiling, never a gate.** This is the filter that ruled permanent stakes out and that any new mechanic must pass. Also the filter the run's coin economy was built to satisfy: it's run-scoped, so no permanent power gate opens.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move. The coin economy's two spends (heal vs. upgrade) were chosen specifically to avoid collapsing to one dominant move; the 2026-08-04 squad pick has a working accept-default but does not yet have a composition *effect* beyond individual stats — see Next up #6.
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play, and the run wrapper adds exactly one (plus the run-start squad pick as of 2026-08-04). An elected bank-or-push button remains a distinct, still-open idea (nerve, not reading) separate from the coin-spend already built.
- Opponent squads (when the optional layer engages combat setup) are readable, full-information puzzles with multiple valid solutions — no fog-of-war. The 2026-08-04 pre-fight read is a first, minimal instance of this for the enemy's fixed (bruiser + grunts) composition.
- Per-hero persistence, bench, and roguelike roster rules (fixed starter squad, unlockable pool, power built in-run only) apply within the optional layer.
- Mid-fight tactical decision remains parked — not in the core loop or the optional layer for now.
- The "5-second to understand" rule is ad-creative-only, not a gameplay-loop constraint.

## Reference games (by relevance)

| Priority | Game | Why it matters |
|---|---|---|
| 🥇 | Balatro | The concrete structural model: a first-time player watches the score climb and feels the spike without reading a single joker (core loop), while a deeper player mines synergies underneath (optional layer). Its expanding-pool pattern is the fix for the rejected draft sketch; its run-scoped, elected escalation is the model for the stakes economy. |
| 🥇 | Into the Breach | Full-info, multi-solution puzzle that stays unsolvable without an opponent — reference for the optional layer's puzzle design. |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers refill the learn-loop — reference for the optional layer. Its permadeath is *not* the model here; stakes stay run-scoped. |
| 🥈 | Dota (crit / PRD) | The direct source of the cascade's shape: an escalating proc whose chance climbs after each miss but never reaches certainty. Also the friend's own originally-cited reference. |
| 🥈 | Darkest Dungeon | Risk/reward, stress/morale, character attachment; the friend's own named design ideal (auto-combat DD), and the direct source of the 2026-07-31 attrition decision (HP persists, death is permanent). Its deeper attachment mechanics (bench-based recovery, character-specific stress) remain optional-layer candidate content, since they require investment and reading. |
| 🥈 | Heroes 3 | Hex/turn combat under an arena skin — visual anchor for the optional layer's hex-sim rendering. |
| 🥈 | TFT | On-board placement, hex-to-hex motion — reference for the optional layer. |
| 🥈 | PES / bot games | Proof watching high-variance AI-vs-AI is entertaining — reference for the core loop's watch-only bet. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch shape, but async-PvP — studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | Draft Showdown (App Store) | Trigger for the original discovery phase — real-time PvP draft-autobattler; deterministic puzzle-solving is absent from it. |

## Open questions

**Top priority — shapes the build:**

- **What the optional layer is allowed to modify in the fight** — beyond the run's coin economy and the 2026-08-04 squad pick (which currently only changes *who*, not a composition effect), the fight-level hinge is still open: base proc chance, escalation step, cap, or which hero can go hot.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.
- **Whether attrition needs a bench to avoid spiraling** (see Working assumptions and Next up #3) — sharpened, not yet answered, by the 2026-08-04 tuning pass.

**Non-blocking, resolve during/after the build:**

- The eligibility threshold — currently a strawman at 40% of current max; to be tuned by feel.
- Whether to add a further **elected bank-or-push escalation within a fight** (distinct from the between-fight coin spend already built), and whether to add a rival-bot scoreboard as a legibility skin on the score.
- Whether run-scoped loss (losing the run's coin) satisfies the friend's "lose something on failure" ask (see Next up #4).
- The 5-vs-3 squad-size contradiction (see Next up #5).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft), if drag-placement is kept in the optional layer.
- OQ-14 — pre-run roster curation tightness (partially informed by the 2026-08-04 squad pick's 6-pool/pick-3 shape, still not settled as the final answer).

**Longer-horizon:**

- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost) — the 2026-08-04 post-fight recap line is a first, minimal instance of this, pulled forward from this bucket.
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if the optional layer's build suggests it's needed.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — the working draft of one fight's 30 seconds. **Partially superseded 2026-08-04:** §3's side-level-DPS worked check and the fixed ~30s timer no longer describe the build (per-hero combat, an enemy bruiser, and wipe-only resolution replaced them — see DECISIONS.md's 2026-08-04 entry). Still current: the eligibility gate, both PRD tables, the bonus-hit formula, and the beat-sheet's *shape* (opening exchange → dip → ignition → chain → resolve).
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — the build doc for prototype #1: scope, stack, run-level constants, and build phases. Phases 0–4 are done; Phase 5 has run one cycle (played, judged, revised) and needs a second. Its 2026-08-04 note at the bottom is the fullest account of what changed in the legibility rewrite and why.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned the single fight into a full run; 12 of 30 answered as of 2026-07-31, the rest triaged by whether they block code, hang off an answered question, or should be stubbed and settled by playing.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
- `prototype/` — the actual code: `src/sim/` (heroes.ts, fight.ts, run.ts, config.ts — pure, headless), `src/render/` (DOM view + screens), `src/batch/` (the tuning harness), `src/checks/` (regression checks — `npm run check`). Run it with `npm run dev` inside `prototype/`.

> `probe/` (the disposable RNG/emergence/wired toys and `FRIEND_TEST_PROTOCOL.md`) and `ONMAP_SETUP_PLAN.md` were deleted 2026-07-31 as stale — the old prototype build they supported is gone. DECISIONS.md's 2026-07-26 entry still names `probe/FRIEND_TEST_PROTOCOL.md` as the session runbook; that reference is now historical only, not a live path.
