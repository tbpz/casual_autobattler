# Decision Log — Casual Roguelike Autobattler

> **What this file is:** an append-only history of decisions and their rationale.
> **Rules:** never edit or delete an existing entry; only add new ones. Newest at the top.
> **When to read it:** only to answer a "why did we decide X?" question — grep it, don't read top-to-bottom. The current state lives in [STATE.md](STATE.md), not here.
>
> Entry format: `## [YYYY-MM-DD] Title` → **Decision** / **Why** / **Replaces**.

---

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
