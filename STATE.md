# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-29 (folds in the 2026-07-29 core-loop fight specification: fight length, scoreboard, cascade mechanic, ignition gate, and cascade-as-big-win-not-only-win. The core loop is now specified down to buildable mechanics.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** building the core loop for real. It is now specified at the mechanic level, so nothing blocks writing the sim. Monetization and UA come later.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result was cast into a layered structure: **floor and ceiling are two separate layers, not one blended mechanic** → (5) the stakes shape was chosen (2026-07-28) → (6) the core loop's 30 seconds were specified as concrete mechanics (2026-07-29). Steps 1–6 are done.

**Disposable probing has stopped; the next build is the real game.** Every remaining sub-choice — tuning constants, the eligibility threshold, the optional layer's contents — is deliberately left to be settled by building rather than by another probe or another round of specification.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26/28, mechanized 2026-07-29)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is met:

- **Watch-native** — assemble, press play, watch. The core loop is exactly this shape, with no reading or deliberate choice required to reach the payoff.
- **"Pay off far bigger than expected"** — the proc chain usually fizzles immediately, so the *expected* outcome genuinely is small; the runaway chain is the exception that reads as a spike.
- **"Couldn't fully predict"** — two independent dice (whether the cascade ignites, and how long the chain runs), inside a layered relationship rather than a blended one: RNG supplies the floor inside the mandatory core loop, emergent combination supplies the ceiling inside a fully optional layer on top.
- **"Looked like it might fail first"** — met by mandatory in-fight visible jeopardy, enforced by a deterministic eligibility gate so the near-loss is a real sim state rather than a staged animation. It doubles as the core loop's attribution device: near-loss-then-recovery reads as the player's own story even when the dice did the work.
- **"Claim as mine"** — the friend's own play showed he does not read for or generate attribution, treating RNG outcomes purely as luck. Attribution is therefore understood as **Tu's need specifically**, met by the optional layer — with in-fight jeopardy supplying a weaker, no-reading-required version inside the core loop.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. |
| Core loop — fight mechanics | **Specified (2026-07-29).** See the design spine below. Not yet built. |
| Optional layer — concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional — forcing it failed 4/4 times. Not yet built. |
| Optional layer — contents | Not specified. Candidate content listed in the design spine; nothing chosen. |
| Stakes — shape | **Chosen (2026-07-28):** in-fight jeopardy mandatory; economy run-scoped, never permanent. Permanent/account-level loss is ruled out. |
| Stakes — concrete devices | Open by design, to be settled during the build. See Open questions. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started. This is "Next up" #1. |

## Next up

1. **Build the core loop for real** — the fight below, playable end-to-end with zero required reading, plus retry.
2. **Tune by playing, not by arguing**: the eligibility threshold and all cascade/PRD constants are strawmen meant to be set by feel once something runs.
3. **Watch one specific risk in the first playable build:** whether the dip still *reads* as losing now that it is escapable without a cascade (see Working assumptions).
4. **Settle the concrete stakes devices while building** (bank-or-push, rival scoreboard) rather than pre-specifying them.
5. **Ask the friend one cheap question**: does run-scoped loss satisfy his unprompted "lose something on failure" ask, or did that mean permanent loss?
6. **Build the optional layer on top**, checked against the decision-density filter (must draw on genuinely new info, must never leave the passive default better than engaging, must resist collapsing to one repeatable optimal move) and modeled on Balatro's expanding-pool pattern.
7. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–6 are playable.

## The design spine

**Core loop (mandatory) — one ~30-second fight:**

- **Squad:** 3v3 placeholder, one screen, no camera cuts.
- **Scoreboard:** HP remaining, as two aggregate meters — one per side. Not per-hero bars (six bars have no shared scale, so a glancing player can't tell who's winning) and not an accumulating score against a target (the moment is a comeback, not a jackpot). Per-hero state shows as bodies falling over, not as tracked numbers.
- **Beats:** opening exchange (~8s, symmetric and deliberately boring) → **the dip** (~8s, the player's meter drops faster and a hero falls; must read as "losing" to someone glancing with no rules knowledge) → **ignition** (~4s, a distinct tell — shake, flash, name-callout) → **the chain** (~7s, the enemy meter collapses at a visibly different pace, font/sound/tick all change) → **resolve** (~3s, run-scoped stakes settle, retry appears).
- **The cascade is an escalating crit/proc chain.** One hero goes "hot"; each of its hits rolls for a bonus hit; each landed bonus hit raises the chance of the next. A chain usually fizzles at once and occasionally runs away exponentially.
- **Ignition is two-stage:** a *deterministic* eligibility gate (the cascade is not rollable until the sim reaches a real jeopardy state through normal combat) then a *pseudo-random* ignition roll whose chance climbs with every cascade-less fight and is capped below 100%. The cascade does not fire every fight — the dice decide **whether**, not merely **when**.
- **Two independent dice** — whether it ignites, and how long the chain runs — so **a cascade can fire and the fight can still be lost**.
- **The cascade is the big win, not the only win.** The dip is escapable by ordinary combat resolution.
- **Run-scoped stakes resolve** on the outcome: something real is won or lost, but nothing permanent.
- No reading or deliberate choice is required at any point to get the full payoff.

**Optional layer (fully skippable):** squad recruitment/drafting, hero synergies, between-attempt tuning. The old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) lives here as candidate content, not a core-path requirement. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- **The dip must still read as losing even though it is escapable.** This is the accepted cost of making the cascade the big win rather than the only win: if the player can sometimes just play out of the dip, jeopardy risks becoming ceremonial. If that tuning proves impossible, cascade-as-big-win is the first piece to revisit.
- **The core loop's cascade is a trigger, not a decision.** Accepted deliberately — decision-density is the optional layer's job, and the core loop is explicitly the casual half.
- Combat must be readable — chaos is visual-only, capped RNG — so the escalating outcome feels exciting without requiring comprehension.
- **Mastery is a ceiling, never a gate.** This is the filter that ruled permanent stakes out and that any new mechanic must pass.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move.
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play. An elected bank-or-push button would be the one permitted exception (nerve, not reading) and would need a safe auto-default.
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
| 🥈 | Darkest Dungeon | Risk/reward, stress/morale, character attachment; the friend's own named design ideal (auto-combat DD). Its attachment stakes are candidate content for the optional layer only, since they require investment and reading. |
| 🥈 | Heroes 3 | Hex/turn combat under an arena skin — visual anchor for the optional layer's hex-sim rendering. |
| 🥈 | TFT | On-board placement, hex-to-hex motion — reference for the optional layer. |
| 🥈 | PES / bot games | Proof watching high-variance AI-vs-AI is entertaining — reference for the core loop's watch-only bet. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch shape, but async-PvP — studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | Draft Showdown (App Store) | Trigger for the original discovery phase — real-time PvP draft-autobattler; deterministic puzzle-solving is absent from it. |

## Open questions

**Top priority — shapes the build:**

- **What the optional layer is allowed to modify in the fight** — the base proc chance, the escalation step, the cap, which hero can go hot, or what a bonus hit does. This is the hinge the entire optional layer hangs off.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.

**Non-blocking, resolve during/after the build:**

- The eligibility threshold — how far the player's meter must fall before ignition becomes possible.
- The squad-pick step — how many heroes on the bench, how many taps, what default. The core loop only needs the accept-default path to work.
- Stakes devices — whether to include an elected bank-or-push escalation, and whether to add a rival-bot scoreboard as a legibility skin on the score.
- Whether run-scoped loss satisfies the friend's "lose something on failure" ask (see Next up #5).
- OQ-13 — retry loop shape (per-round vs. per-run, count, same-difficulty enforcement).
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
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — the working draft of the core loop's 30 seconds. Holds the **strawman tuning constants** (chain escalation table, PRD table, magnitude targets) that are deliberately not in this file, since they're meant to change every time the build is played.
- `probe/FRIEND_TEST_PROTOCOL.md` — runbook used for the 2026-07-26 friend-validation session; historical reference now that probing is closed.
- `probe/` — the disposable RNG/emergence/wired toys built during discovery; historical reference, not the target for further building.
- `PROTOTYPE_PLAN.md` — build doc for the old single-spine design; expected to go stale, will need a rewrite against the layered structure.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
