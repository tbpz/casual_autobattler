# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-31 (folds in squad size N=3, parameterized (2026-07-30); and the 2026-07-31 run-shape decision: prototype #1 scoped as a vehicle covering a full 5-fight run, attrition with recoverable HP and permanent death, a coin economy with two spends, one optional-layer lever in scope, what a bonus hit does, and enemies not cascading in the prototype.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** building prototype #1 — the run, not just the fight. It is specified down to buildable mechanics and constants (see `FIGHT_SCRIPT.md` and `PROTOTYPE_PLAN.md`); nothing blocks writing the sim. Monetization and UA come later.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result was cast into a layered structure: **floor and ceiling are two separate layers, not one blended mechanic** → (5) the stakes shape was chosen (2026-07-28) → (6) the core loop's 30 seconds were specified as concrete mechanics (2026-07-29) → (7) squad size was fixed at N=3, parameterized (2026-07-30) → (8) a `DESIGN_QUESTIONS.md` pass turned the single fight into a full run, answering what a bonus hit does, whether enemies cascade, and the run's shape — 5 fights, attrition, an in-run coin economy (2026-07-31). Steps 1–8 are done.

**Disposable probing has stopped; the next build is the real game.** Every remaining sub-choice — tuning constants, the eligibility threshold, most of the optional layer's contents — is deliberately left to be settled by building rather than by another probe or another round of specification.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26/28, mechanized 2026-07-29/31)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is met:

- **Watch-native** — assemble, press play, watch. The core loop is exactly this shape, with no reading or deliberate choice required to reach the payoff.
- **"Pay off far bigger than expected"** — the proc chain usually fizzles immediately, so the *expected* outcome genuinely is small; the runaway chain is the exception that reads as a spike. On the current fight-level constants, a genuine runaway (3+ bonus hits) lands in roughly 7% of fights.
- **"Couldn't fully predict"** — two independent dice (whether the cascade ignites, and how long the chain runs), inside a layered relationship rather than a blended one: RNG supplies the floor inside the mandatory core loop, emergent combination supplies the ceiling inside a fully optional layer on top.
- **"Looked like it might fail first"** — met by mandatory in-fight visible jeopardy, enforced by a deterministic eligibility gate so the near-loss is a real sim state rather than a staged animation. It doubles as the core loop's attribution device: near-loss-then-recovery reads as the player's own story even when the dice did the work. Now also depends on the dip reading as losing even though it's escapable — see Working assumptions.
- **"Claim as mine"** — the friend's own play showed he does not read for or generate attribution, treating RNG outcomes purely as luck. Attribution is therefore understood as **Tu's need specifically**, met by the optional layer — with in-fight jeopardy supplying a weaker, no-reading-required version inside the core loop.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. |
| Core loop — fight mechanics | **Specified.** Fight length, beats, scoreboard, cascade mechanic, ignition gate, cascade-as-big-win (2026-07-29); squad size N=3 (2026-07-30); what a bonus hit does, and the fight-level constants (HP, damage rates, gate threshold) (2026-07-31). See `FIGHT_SCRIPT.md`. Not yet built. |
| The run — shape | **Specified (2026-07-31):** 5 fights, win all or run out of living heroes; attrition (HP recoverable, death permanent); coin earned per fight, spent on heal-now or bank-for-upgrade; loss ends the run and its coin. See `DECISIONS.md` and `PROTOTYPE_PLAN.md`. Not yet built. |
| Optional layer — concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional — forcing it failed 4/4 times. Not yet built. |
| Optional layer — contents | **First content specified (2026-07-31):** the run's one coin-spend decision (heal now vs. bank toward a damage upgrade), with a working accept-default. Everything beyond that — bench, synergies, squad-pick — is still unspecified candidate content. |
| Prototype #1 — scope | **Scoped (2026-07-31):** a *vehicle*, not a hypothesis test — its job is to make the lead moment perceivable, judged by whether it produces specific reactions and whether it can surprise its makers, not by a pass/fail claim. Covers the full run. See `PROTOTYPE_PLAN.md`. |
| Stakes — shape | **Chosen (2026-07-28):** in-fight jeopardy mandatory; economy run-scoped, never permanent. Permanent/account-level loss is ruled out. |
| Stakes — concrete devices | **Chosen (2026-07-31):** coin, earned per fight, lost on a run loss; spent on healing or an upgrade. An elected in-fight bank-or-push escalation and a rival scoreboard remain open, separate ideas — not decided. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started. This is "Next up" #1. |

## Next up

1. **Build prototype #1 for real**, per `PROTOTYPE_PLAN.md`'s phases: headless fight sim → headless run wrapper → batch-sim harness → render → run screens → play.
2. **Tune by playing and by the batch harness**, not by arguing: the eligibility threshold, all fight/run constants, and the difficulty ramp are strawmen meant to be set by feel and by the harness's distribution report (target: ~25% run completion passive, ~50% engaged).
3. **Watch two specific risks in the first playable build:**
   - Whether the dip still *reads* as losing now that it is escapable without a cascade (unchanged from 2026-07-29).
   - Whether attrition spirals without a bench — pulled forward by the 2026-07-31 decision, not anticipated when attrition was chosen. Three heroes and no bench may make permanent death too punishing over a 5-fight run.
4. **Ask the friend one cheap question**: does losing the run's coin on a loss satisfy his unprompted "lose something on failure" ask, or did that mean permanent loss?
5. **Reconcile the 5-vs-3 squad-size contradiction**: `[2026-07-04]`/`[2026-07-11]` in DECISIONS.md fix the squad at 5 + bench; the build uses N=3. Either those entries are superseded, or the optional layer's headline effect is widening 3→5 — currently written down as neither.
6. **Build the optional layer's next content** beyond the one coin-spend lever, checked against the decision-density filter (must draw on genuinely new info, must never leave the passive default better than engaging, must resist collapsing to one repeatable optimal move) and modeled on Balatro's expanding-pool pattern.
7. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–6 are playable.

## The design spine

**Core loop (mandatory) — one ~30-second fight:**

- **Squad:** N=3 a side for the prototype — a tuning constant, not a fixed commitment (parameterized so it can move without a refactor; see `FIGHT_SCRIPT.md` §1). One screen, no camera cuts.
- **Scoreboard:** HP remaining, as two aggregate meters — one per side. Not per-hero bars (six bars have no shared scale, so a glancing player can't tell who's winning) and not an accumulating score against a target (the moment is a comeback, not a jackpot). Per-hero state shows as bodies falling over, not as tracked numbers.
- **Beats:** opening exchange (~8s, symmetric and deliberately boring) → **the dip** (~8s, the player's meter drops faster; in the bad case a hero falls — not every dip, since attrition makes a body lost every fight arithmetically impossible over 5 fights; must read as "losing" to someone glancing with no rules knowledge) → **ignition** (~4s, a distinct tell — shake, flash, name-callout) → **the chain** (~7s, the enemy meter collapses at a visibly different pace, font/sound/tick all change) → **resolve** (~3s, run-scoped stakes settle, retry appears).
- **The cascade is an escalating crit/proc chain.** One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next. A bonus hit does **more damage than the last** (crit-style escalation), fired by the same hero throughout, retargeting when its target dies. A chain usually fizzles at once and occasionally runs away exponentially.
- **Ignition is two-stage:** a *deterministic* eligibility gate (the cascade is not rollable until the sim reaches a real jeopardy state through normal combat — player pool at or below 40% of current max) then a *pseudo-random* ignition roll whose chance climbs with every cascade-less fight and is capped below 100%. The cascade does not fire every fight — the dice decide **whether**, not merely **when**.
- **Two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**.
- **The cascade is the big win, not the only win.** The dip is escapable by ordinary combat resolution.
- **Enemies do not cascade**, in the prototype — kept as the player's signature, cheap to reverse later.
- No reading or deliberate choice is required at any point to get the full payoff.

**The run (mandatory shape, one optional decision) — five fights:**

- **Length and end conditions:** 5 fights. Win all 5 to complete the run. Run out of living heroes and the run ends.
- **Attrition:** HP and death both carry between fights. HP is recoverable — a free auto-recovery tick between fights, no input required, keeps the passive path viable. Death is permanent for the run; max squad HP is 100 × living heroes, so losing a hero permanently shrinks the ceiling.
- **Coin:** earned per fight won, more if a cascade fired. Spendable on exactly **one decision point** — heal now, or bank toward a run-long damage upgrade — with a working accept-default (doing nothing still completes runs via auto-recovery alone). This is the optional layer's first concrete content.
- **On a loss:** the run ends and its coin is lost. Nothing carries to the next run — the economy is entirely run-scoped, per the 2026-07-28 stakes-shape decision.
- **Difficulty ramp:** enemy HP rises per fight, so fight 5 is a harder fight than fight 1.

**Optional layer (fully skippable, beyond the one run-level lever above):** squad recruitment/drafting, hero synergies, between-attempt tuning. The old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) lives here as candidate content, not a core-path requirement — see Next up #5 for the unreconciled 5-vs-3 tension this creates. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- **The dip must still read as losing even though it is escapable.** This is the accepted cost of making the cascade the big win rather than the only win: if the player can sometimes just play out of the dip, jeopardy risks becoming ceremonial. If that tuning proves impossible, cascade-as-big-win is the first piece to revisit.
- **Attrition can spiral without a wider roster.** Named as a cost when attrition was chosen (2026-07-31): three heroes, permanent death, and a 5-fight run may compound faster than is fun. Watch during the build; the bench is the likely fix if it does.
- **The core loop's cascade is a trigger, not a decision.** Accepted deliberately — decision-density is the optional layer's job, and the core loop is explicitly the casual half.
- Combat must be readable — chaos is visual-only, capped RNG — so the escalating outcome feels exciting without requiring comprehension.
- **Mastery is a ceiling, never a gate.** This is the filter that ruled permanent stakes out and that any new mechanic must pass. Also the filter the run's coin economy was built to satisfy: it's run-scoped, so no permanent power gate opens.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move. The coin economy's two spends (heal vs. upgrade) were chosen specifically to avoid collapsing to one dominant move.
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play, and the run wrapper adds exactly one. An elected bank-or-push button remains a distinct, still-open idea (nerve, not reading) separate from the coin-spend already built.
- Opponent squads (when the optional layer engages combat setup) are readable, full-information puzzles with multiple valid solutions — no fog-of-war.
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

- **What the optional layer is allowed to modify in the fight** — beyond the run's coin economy (now specified), the fight-level hinge is still open: base proc chance, escalation step, cap, or which hero can go hot.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.
- **Whether attrition needs a bench to avoid spiraling** (see Working assumptions and Next up #3) — pulled forward by the 2026-07-31 attrition decision, not yet answered.

**Non-blocking, resolve during/after the build:**

- The eligibility threshold — currently a strawman at 40% of current max; to be tuned by feel.
- The squad-pick step — how many heroes on the bench, how many taps, what default. The core loop only needs the accept-default path to work.
- Whether to add a further **elected bank-or-push escalation within a fight** (distinct from the between-fight coin spend already built), and whether to add a rival-bot scoreboard as a legibility skin on the score.
- Whether run-scoped loss (losing the run's coin) satisfies the friend's "lose something on failure" ask (see Next up #4).
- The 5-vs-3 squad-size contradiction (see Next up #5).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft), if drag-placement is kept in the optional layer.
- OQ-14 — pre-run roster curation tightness.

**Longer-horizon:**

- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost).
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if the optional layer's build suggests it's needed.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — the working draft of one fight's 30 seconds, including the fight-level tuning constants (HP, damage rates, chain table, PRD table, gate threshold) deliberately kept out of this file since they're meant to change every time the build is played.
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — the build doc for prototype #1: scope, stack, run-level constants, and build phases. Rewritten 2026-07-31 against the current layered/run design; the pre-2026-07-15 hex-grid version is fully superseded.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned the single fight into a full run; 12 of 30 answered as of 2026-07-31, the rest triaged by whether they block code, hang off an answered question, or should be stubbed and settled by playing.
- `probe/FRIEND_TEST_PROTOCOL.md` — runbook used for the 2026-07-26 friend-validation session; historical reference now that probing is closed.
- `probe/` — the disposable RNG/emergence/wired toys built during discovery; historical reference, not the target for further building.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
