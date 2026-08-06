# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-06 (folds in the 2026-08-06 legibility-and-risk-dial rewrite: the 2026-08-04 build was played again, judged still not fun — illegible per-hero state and spectacle firing far more often than its payoff — root-caused against the running code, and rebuilt: per-hero HP bars, job counters, a tank-break dip mechanism, spectacle tiered to the chain's actual length, staggered beats with damage variance, attribution-based ignition, and the squad pick wired up as a real risk dial. Batch-tuned; not yet re-played.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1 has been through two legibility revisions since its first playable build. The 2026-08-04 revision (per-hero combat, a visible bruiser, hero roles, squad pick) was played and judged still not fun: the player couldn't tell whether their squad plan was working, and the fight's spectacle fired on ~65% of fights while its payoff (a real chain) landed on ~7% — training the player to ignore the one tell that mattered. The 2026-08-06 revision rebuilt the fight's readout and risk model in response (see Design status and DECISIONS.md). It's built and batch-tuned but not yet played and judged — that's next.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result was cast into a layered structure: **floor and ceiling are two separate layers, not one blended mechanic** → (5) the stakes shape was chosen (2026-07-28) → (6) the core loop's 30 seconds were specified as concrete mechanics (2026-07-29) → (7) squad size was fixed at N=3, parameterized (2026-07-30) → (8) a `DESIGN_QUESTIONS.md` pass turned the single fight into a full run — 5 fights, attrition, an in-run coin economy (2026-07-31) → (9) **prototype #1 was built for real** per `PROTOTYPE_PLAN.md`'s phases, then played (2026-08-04) → (10) **the verdict was "not fun,"** diagnosed as a legibility failure — the fight had no actors, only two meters moved by a hidden formula → (11) **the fight's mechanism was revised** (2026-08-04): per-hero attack beats, a visible enemy bruiser, wipe-only resolution, hero roles, a squad pick, and a pre-fight read → (12) **that revision was played again and judged still not fun**, for two specific reasons the player stated directly: per-hero state (is my tank soaking, is my dealer hitting, is my healer healing) was unreadable, encoded only as body opacity; and the fight felt scripted, because it was — flat per-hit damage, six heroes on one shared beat, and a chain-ignition tell that fired on ~65% of fights while its payoff landed on ~7% → (13) the player sharpened the second complaint further: the payoff needs to be *rare and earned by a chosen risk*, not routine → (14) both complaints were traced to specific causes in the running code (RC1–RC8, see the 2026-08-06 plan) → (15) **the fight was rebuilt** (2026-08-06, logged in DECISIONS.md): per-hero proportional HP bars and job counters replace the two aggregate meters and opacity encoding; a tank-break mechanism causes a real, no-longer-mandatory dip; the chain's visual spectacle is tiered to its actual length instead of firing on the ignition roll; attacks now vary in damage and land on staggered beats; ignition picks the hero who's contributed most instead of a random one; and the squad pick now determines a fight's risk band (comfortable/tight/losing) via a shared projection module, with the cascade only reachable from a broken tank line. Batch-tuned against a target funnel (see Design status). Steps 1–15 are done; **step 15's build has not yet been played and judged** — that's Next up #1.

**The lead moment, the run shape, and the coin economy are unchanged** by either 2026-08 revision. What changed across both is how the fight's mandatory-vs-earned jeopardy is *caused*, *gated*, and *rendered* — not what the fight is for.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26/28, mechanized 2026-07-29/31)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is met:

- **Watch-native** — assemble, press play, watch. The core loop is exactly this shape, with no reading or deliberate choice required to reach the payoff. The squad pick and pre-fight read both ship with a working accept-default so the minimum path is still Play → watch → Play.
- **"Pay off far bigger than expected"** — as of 2026-08-06 this is carried by two things together: a pre-fight projection stating a concrete expectation in seconds ("clean win, ~3s to spare"), and a post-fight recap comparing it against what actually happened in the same units — plus the chain itself, whose full spectacle is now reserved for the ~7-8% of fights (batch-verified 2026-08-06) that land a 3+-hit chain, rather than firing on every ignition roll as the 2026-08-04 build did.
- **"Couldn't fully predict"** — two independent dice (whether the cascade ignites, and how long the chain runs), inside a layered relationship rather than a blended one: RNG supplies the floor inside the mandatory core loop, emergent combination supplies the ceiling inside a fully optional layer on top. As of 2026-08-06 per-hit damage also carries its own variance (±25%), so even a fixed squad's fight plays out differently fight to fight.
- **"Looked like it might fail first"** — as of 2026-08-06 this is **no longer guaranteed every fight** (a reversal of the 2026-07-28 stakes-shape decision — see DECISIONS.md's "jeopardy no longer mandatory" entry). A comfortable, balanced squad can win clean with no dip at all; a greedy squad buys a real shot at jeopardy — and at the cascade — by accepting a broken tank line as the cost. The dip's cause is now a tank's line failing (visible, HP-bar-driven), not a hidden pool-fraction threshold.
- **"Claim as mine"** — the friend's own play showed he does not read for or generate attribution, treating RNG outcomes purely as luck. Attribution is therefore understood as **Tu's need specifically**, met by the optional layer — with in-fight jeopardy supplying a weaker, no-reading-required version inside the core loop, and the post-fight recap giving an explicit causal account (per-hero job counters, projected-vs-actual) after the fact. As of 2026-08-06 the cascade's hero is picked by contribution (whoever has dealt or healed the most), not at random, so "VEX chained ×4" reads as earned.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. |
| Core loop — fight mechanics | Specified 2026-07-29/31, built 2026-08-04, revised 2026-08-04 for legibility (per-hero beats, bruiser, wipe-only resolution) — judged not fun on replay. **Rebuilt 2026-08-06**: per-hero HP bars, job counters, a tank-break dip (no longer mandatory), tiered chain spectacle, staggered beats, damage variance, contribution-based ignition. Batch-tuned; not yet played. See DECISIONS.md's 2026-08-06 entries and `prototype/src/sim/fight.ts`, `projection.ts`. |
| The run — shape | Specified 2026-07-31 (5 fights, attrition, coin economy). Built 2026-08-04. Unchanged by the 2026-08-06 revision. |
| Optional layer — concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional — forcing it failed 4/4 times. |
| Optional layer — contents | The run's one coin-spend decision (heal now vs. bank toward a damage upgrade), with a working accept-default. The run-start squad pick (3 of 6, default pre-filled, added 2026-08-04) **now has a real composition effect as of 2026-08-06**: it sets a fight's risk band (comfortable/tight/losing) via `sim/projection.ts`, and the cascade is only reachable from a broken tank line — so squad choice determines danger, not just individual stats. Bench, hero synergies beyond the risk dial, and a picked squad's effect on later fights remain unspecified candidate content. |
| Prototype #1 — scope | Scoped 2026-07-31 as a *vehicle*. Built 2026-08-04, played, judged not fun, revised same day. Played again, judged still not fun (illegible state, routine spectacle). **Revised again 2026-08-06** — not yet re-played. See `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Chosen 2026-07-28: economy run-scoped, never permanent (still true). **In-fight jeopardy's mandatory clause was reversed 2026-08-06** — jeopardy is now squad-dependent; a comfortable squad can complete a fight with no dip, gate, or ignition roll at all. Target funnel for the default squad (batch-verified 2026-08-06): ~27% of fights dip, ~20% ignite, ~8% show the full chain spectacle. |
| Stakes — concrete devices | Chosen 2026-07-31: coin, earned per fight, lost on a run loss; spent on healing or an upgrade. Costs re-tuned 2026-08-04. Unchanged by the 2026-08-06 revision. An elected in-fight bank-or-push escalation and a rival scoreboard remain open, separate ideas — not decided. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started — gated behind re-judging the 2026-08-06 revision (Next up #1). |

## Next up

1. **Play the 2026-08-06 revision and judge it again**, against `PROTOTYPE_PLAN.md`'s two completion criteria (specific differentiated reactions; can it surprise its makers). Specifically check: can the player now answer "did my plan work?" without being told (per-hero bars, job counters), and does the rare fight feel different from the common one (tiered spectacle, non-mandatory dip)? The dev build is playable via `npm run dev` in `prototype/`.
2. **Validate and tune the risk-dial's three-tier ordering.** A known, documented gap as of 2026-08-06 (see `prototype/src/sim/heroes.ts`'s pool docstring): `hollow` (the "riskier" tank) currently shows a *lower* dip rate than `bracer` (the "comfortable" default) in batch data, because Hollow's higher damage shortens fight length enough to outweigh Bracer's bigger HP buffer. The comfortable-vs-greedy contrast the squad-pick screen's copy relies on **is** validated (greedy shows lower run-completion, more deaths per run via `npm run batch --squad greedy`); the middle "tight" tier is not yet reliably riskier than "comfortable." Fix by playing and by the batch harness (`npm run batch --squad <comfortable|tight|greedy>`).
3. **Keep tuning by playing and by the batch harness.** Current numbers for the default squad (batch-verified 2026-08-06): dip rate ~27%, ignition ~20%, full-spectacle (chain≥3) ~8%, wins-with-no-chain ~86%. `checks/chaindist.ts` pins these as regression bands.
4. **Watch whether the tank-break dip still reads as "the plan failing"** to a glancing player — the per-hero bars and the "IS BREAKING" callout are the 2026-08-06 answer to this; needs a real playtest to confirm.
5. **Ask the friend one cheap question**: does losing the run's coin on a loss satisfy his unprompted "lose something on failure" ask, or did that mean permanent loss?
6. **Reconcile the 5-vs-3 squad-size contradiction**: `[2026-07-04]`/`[2026-07-11]` in DECISIONS.md fix the squad at 5 + bench; the build uses N=3 (via a 6-hero pick pool, still choosing exactly 3). Either those entries are superseded, or the optional layer's headline effect is widening 3→5 — currently written down as neither.
7. **Whether attrition needs a bench to avoid spiraling** remains open (see Working assumptions) — not touched by the 2026-08-06 revision.
8. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–7 are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Squad:** N=3 a side for the prototype — a tuning constant, not a fixed commitment. One screen, no camera cuts. As of 2026-08-06 the 6-hero pool has two heroes per role (tank: Bracer/Hollow, damage: Rook/Vex, support: Cairn/Ward), each pair trading safety for speed/power, so the squad pick is a real risk choice, not just a flavor choice.
- **Scoreboard (revised 2026-08-06):** six (or fewer, post-attrition) individual HP bars, proportionally sized to each hero's maxHp both within and across sides — bar width, not opacity, carries per-hero HP, and total bar-pixels on a side still reads as that side's aggregate HP. This **replaces** the prior two-aggregate-meter design (which encoded per-hero HP as body opacity 0.4–1.0) — see DECISIONS.md's 2026-08-06 "per-hero HP bars" entry for why the aggregate-only version failed the player directly. A job counter (soaked/dealt/restored) sits under each body.
- **Beats:** opening exchange (symmetric, boring) → **the dip** (no longer mandatory as of 2026-08-06 — happens in a minority of fights, driven by whether a player tank's line breaks under sustained fire; the tank's HP bar draining while others hold is the "plan working" read, a sudden acceleration in the others' bars is the "plan failing" read) → **ignition** (a distinct tell only once the chain reaches a length threshold — a fizzled 0-1-length chain gets a slightly bigger number and nothing else, as of 2026-08-06) → **the chain** (the enemy meter collapses at a visibly different pace once the tell threshold is crossed) → **resolve** (run-scoped stakes settle, retry appears). Fights resolve by wipe rather than a fixed-length timer, so beat timing varies fight to fight.
- **The cascade is an escalating crit/proc chain.** One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next. A bonus hit does **more damage than the last** (crit-style escalation), fired by the same hero throughout, retargeting when its target dies. A chain usually fizzles at once and occasionally runs away exponentially. As of 2026-08-06 the hero who goes hot is whichever living hero has contributed most (dealt or healed), not a random pick.
- **Ignition is two-stage, and no longer arithmetic-guaranteed (revised 2026-08-06):** a *deterministic* eligibility gate — reachable only once the player's tank line has broken (or there is no living tank) **and** the pool has fallen to a set fraction of its fight-start max — then a *pseudo-random* ignition roll whose chance climbs with every cascade-less fight and is capped below 100%. A comfortable, well-tanked squad can win a fight without ever reaching the gate.
- **Two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**.
- **The cascade is the big win, not the only win.** Guarded by a batch metric (fraction of wins with no chain, ~86% for the default squad as of 2026-08-06).
- **Enemies do not cascade**, in the prototype — kept as the player's signature, cheap to reverse later.
- **The squad pick is the run's risk dial (2026-08-06).** A shared projection module (`sim/projection.ts`) scores a chosen squad against the next fight as comfortable/tight/losing, shown on the squad-pick screen (live, as picks change) and the pre-fight screen (per-hero detail). A comfortable squad is designed to win clean, with the cascade out of reach; a greedy squad buys a shot at both the dip and the cascade. See Next up #2 for the known gap in how well this ordering currently holds across all three tiers.
- No reading or deliberate choice is required at any point to get the full payoff — the squad pick and pre-fight read both ship with a working accept-default.

**The run (mandatory shape, one optional decision) — five fights:**

- **Length and end conditions:** 5 fights. Win all 5 to complete the run. Run out of living heroes and the run ends.
- **Attrition:** HP and death both carry between fights. HP is recoverable — a free auto-recovery tick between fights, no input required, keeps the passive path viable. Death is permanent for the run; max squad HP is the sum of living heroes' individual max HP.
- **Coin:** earned per fight won, more if a cascade fired. Spendable on exactly **one decision point** — heal now, or bank toward a run-long damage upgrade — with a working accept-default (doing nothing still completes runs via auto-recovery alone).
- **On a loss:** the run ends and its coin is lost. Nothing carries to the next run — the economy is entirely run-scoped, per the 2026-07-28 stakes-shape decision.
- **Difficulty ramp:** enemy HP rises per fight (damage does not), so later fights are a longer grind rather than a harder-hitting one.

**Optional layer (fully skippable, beyond the run-level lever above):** a run-start squad pick (2026-08-04) that now sets a fight's risk band (2026-08-06) as its first concrete composition effect, beyond individual stats. Squad recruitment/drafting beyond the current 6-hero pool, hero synergies beyond the risk dial, and between-attempt tuning remain unspecified candidate content. The old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) lives here as candidate content, not a core-path requirement — see Next up #6 for the unreconciled 5-vs-3 tension this creates. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- **Attrition can spiral without a wider roster.** Named as a cost when attrition was chosen (2026-07-31); sharpened by the 2026-08-04 tuning pass. Not re-tested by the 2026-08-06 revision — still an open risk (see Next up #7).
- **The core loop's cascade is a trigger, not a decision.** Accepted deliberately — decision-density is the optional layer's job, and the core loop is explicitly the casual half.
- **Combat must be readable — chaos is visual-only, capped RNG.** As of 2026-08-06 this is implemented via state-dependent weighted targeting: a *holding* tank draws 3× the incoming attacks of a squishy ally; a *broken* tank draws the same weight as everyone else, so damage visibly redistributes onto the squad the instant the tank's line fails. Per-hit damage also now varies ±25%, so an individual hero's outcome stays genuinely uncertain fight to fight even for a fixed squad.
- **Mastery is a ceiling, never a gate.** This is the filter that ruled permanent stakes out and that any new mechanic must pass. Also the filter the run's coin economy was built to satisfy: it's run-scoped, so no permanent power gate opens.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move. The coin economy's two spends were chosen to satisfy this; the squad pick's risk-dial effect (2026-08-06) is a first test of the same filter for squad composition — not yet confirmed against "resists a single dominant move" (Next up #2's ordering gap is a live risk to this).
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play, and the run wrapper adds exactly one (plus the squad pick). An elected bank-or-push button remains a distinct, still-open idea (nerve, not reading) separate from the coin-spend already built.
- Opponent squads (when the optional layer engages combat setup) are readable, full-information puzzles with multiple valid solutions — no fog-of-war. The pre-fight read is a first, minimal instance of this for the enemy's fixed (bruiser + grunts) composition; as of 2026-08-06 it also shows the projection's per-hero prediction lines.
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

- **What the optional layer is allowed to modify in the fight** — *partially answered 2026-08-06*: the squad pick now sets a fight's risk band (comfortable/tight/losing) and gates cascade access. Still open: whether it should also modify the fight-level hinge directly (base proc chance, escalation step, cap), and whether a picked squad should affect anything beyond the risk-dial framing.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.
- **Whether attrition needs a bench to avoid spiraling** — sharpened by the 2026-08-04 tuning pass, not re-tested since.

**Non-blocking, resolve during/after the build:**

- The gate's pool-fraction and tank-break-fraction thresholds — strawman values as of 2026-08-06 (see `sim/config.ts`), to be tuned by feel and by the risk-dial ordering gap (Next up #2).
- Whether to add a further **elected bank-or-push escalation within a fight** (distinct from the between-fight coin spend already built), and whether to add a rival-bot scoreboard as a legibility skin on the score.
- Whether run-scoped loss (losing the run's coin) satisfies the friend's "lose something on failure" ask (see Next up #5).
- The 5-vs-3 squad-size contradiction (see Next up #6).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft), if drag-placement is kept in the optional layer.
- OQ-14 — pre-run roster curation tightness (partially informed by the squad pick's 6-pool/pick-3 shape, still not settled as the final answer).

**Longer-horizon:**

- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost) — the post-fight recap's projected-vs-actual line (2026-08-06) is the fullest instance of this so far.
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if the optional layer's build suggests it's needed.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — the working draft of one fight's 30 seconds. Partially superseded by the 2026-08-04 combat-model rewrite, and further by 2026-08-06 (jeopardy no longer mandatory; the ignition tell is now tiered by chain length) — both noted inline in the file. Still current: both PRD tables' shape, the bonus-hit formula, and the beat-sheet's overall *sequence* (opening exchange → dip → ignition → chain → resolve), when a fight has jeopardy at all.
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — the build doc for prototype #1: scope, stack, run-level constants, and build phases. Phases 0–4 are done; Phase 5 (play, watch, judge) has run two cycles (2026-08-04, 2026-08-04-replay) and needs a third against the 2026-08-06 revision.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned the single fight into a full run; 12 of 30 answered as of 2026-07-31, the rest triaged by whether they block code, hang off an answered question, or should be stubbed and settled by playing.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
- `prototype/` — the actual code: `src/sim/` (heroes.ts, fight.ts, run.ts, config.ts, projection.ts — pure, headless), `src/render/` (DOM view + screens), `src/batch/` (the tuning harness, with a `--squad comfortable|tight|greedy|id,id,id` flag added 2026-08-06), `src/checks/` (regression checks, including `projection.ts` added 2026-08-06 — `npm run check`). Run it with `npm run dev` inside `prototype/`.

> `probe/` (the disposable RNG/emergence/wired toys and `FRIEND_TEST_PROTOCOL.md`) and `ONMAP_SETUP_PLAN.md` were deleted 2026-07-31 as stale — the old prototype build they supported is gone. DECISIONS.md's 2026-07-26 entry still names `probe/FRIEND_TEST_PROTOCOL.md` as the session runbook; that reference is now historical only, not a live path.
