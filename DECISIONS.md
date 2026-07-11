# Decision Log — Casual Roguelike Autobattler

> **What this file is:** an append-only history of decisions and their rationale.
> **Rules:** never edit or delete an existing entry; only add new ones. Newest at the top.
> **When to read it:** only to answer a "why did we decide X?" question — grep it, don't read top-to-bottom. The current state lives in [STATE.md](STATE.md), not here.
>
> Entry format: `## [YYYY-MM-DD] Title` → **Decision** / **Why** / **Replaces**.

---

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
