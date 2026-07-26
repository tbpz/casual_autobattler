# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-26 (folds in same-day DECISIONS entries: the friend-validation session ran, resolving the RNG-vs-friend question and closing out the wired-blend approach; the project moved from disposable-probe discovery into building the real game under a layered floor/ceiling structure.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** the discovery-by-probe phase is closed — the game's shape is now settled enough to build for real (see below). Building the core loop and its optional layer is the active work. Monetization and UA come later.

## Where we are right now

Discovery ran as: (1) both makers independently recalled felt moments and converged on one shared lead moment (2026-07-19) → (2) small disposable probes tested whether that moment could be built (RNG-only, emergence-only, wired-together + 3 decision-layer sketches) → (3) a friend-validation session (2026-07-26) checked the probes' predictions against the friend directly → (4) the result is now cast into a structure: **floor and ceiling are two separate layers, not one blended mechanic** — see "The design spine" below. Steps 1–4 are done. **Disposable probing has stopped; the next build is the real game**, not another throwaway toy.

## The shared lead moment (found 2026-07-19, structure settled 2026-07-26)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses and how each is now met:
- **Watch-native** — assemble, press play, watch; the core loop (below) is exactly this shape, with no reading or deliberate choice required to reach the payoff.
- **"Pay off far bigger than expected"** — supplied by an RNG-triggered escalating outcome (dice decide *when* a cascade fires) — validated: RNG-only earned a strong, unprompted lean-in from the friend (200+ rounds) in the [2026-07-26 friend-validation session](DECISIONS.md).
- **"Couldn't fully predict"** — **RNG triggers, emergent combination amplifies**, but as of 2026-07-26 this is a **layered** relationship, not a blended one: RNG supplies the floor inside the mandatory core loop; emergent combination supplies the ceiling inside a fully optional layer on top. Four attempts to blend both into one mechanic (base wired + draft/routing/spend sketches) all failed structurally — see [DECISIONS 2026-07-24/26](DECISIONS.md) — which is why the layers are now kept separate instead.
- **"Looked like it might fail first"** — real stakes, adopted 2026-07-26 without further probing (the friend asked for it unprompted and it matches his own stated design ideal, Darkest Dungeon). **Exact mechanism (loss-on-fail / jackpot-style reward / bot-comparison) is undecided** — see Open questions.
- **"Claim as mine"** — the friend's own play showed he doesn't read for or generate attribution himself: he treats RNG outcomes purely as luck, and pressed an unchanged, deterministic sequence repeatedly expecting new outcomes he structurally couldn't get ([DECISIONS 2026-07-26](DECISIONS.md)). Attribution is now understood as **Tu's need specifically**, met by the optional layer — not a requirement the core loop itself has to satisfy for every player.

## Design status

Replaces the old "Probe status" table now that probing has stopped — this is the current state of each piece, the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop concept (RNG-triggered escalation, zero reading required) | Validated, by the RNG-only probe and the friend-validation session. Not yet built as the real game. |
| Optional layer concept (emergent combination / decision-density) | Validated, by the emergence-only probe (Tu's lean-in, 2026-07-22). Confirmed it must stay fully optional, not forced — forcing it (wired-together + 3 decision-layer sketches) failed 4/4 times. Not yet built as an opt-in layer. |
| Stakes | Adopted in principle (2026-07-26). Mechanism not chosen. |
| Blended single-mechanic approach | Rejected (2026-07-24/26), 4 attempts. Not pursued further. |
| Real game build | Not started. This is "Next up." |

## Next up

1. **Choose the stakes mechanism** (loss-on-fail / jackpot-style reward / bot-comparison, or a combination) and attach it to the core loop.
2. **Build the core loop for real**: press-play squad fight, RNG-triggered escalating outcome, stakes attached, retry — playable end-to-end with zero required reading.
3. **Build the optional layer on top**, checked against the 2026-07-26 decision-density filter (must draw on genuinely new info, must never leave the passive default better than engaging, must resist collapsing to one repeatable optimal move) and modeled on Balatro's expanding-pool pattern rather than the rejected draft/routing/spend sketches.
4. **Decide how the optional layer surfaces in the UI** — auto-revealed over time, or sought out by the player (open question).
5. Re-evaluate which old design-spine elements (draft, hex terrain, medieval roles, diagnose/adjust/retry) belong in the optional layer as concrete content, once 1–3 are playable.

## The design spine (current reference hypothesis)

> **Core loop (mandatory):** pick a squad fast, or accept a default — press play — squads fight on their own, watch-only — RNG decides when a cascade/big moment fires — stakes resolve (win/lose something real) — retry. No reading or deliberate choice is required to get the full payoff.
>
> **Optional layer (fully skippable):** squad recruitment/drafting, hero synergies, between-attempt tuning — the old design spine's content (5 individual heroes + bench, 9 Kings-style draft, hex-grid terrain, medieval-war roles, on-map drag-placement, diagnose-adjust-retry) now lives here as candidate content, not a core-path requirement. A player who never opens this layer still gets the full core-loop payoff; a player who does gets a higher ceiling.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only in the core loop — the single biggest bet, now less risky since RNG-only (the same watch-and-press-play shape) already earned a lean-in.
- Combat must be readable — chaos is visual-only, capped RNG — so the escalating outcome feels exciting without requiring comprehension.
- The optional layer's decision points must pass the 2026-07-26 filter: new info, never a tax on the passive default, resists a single dominant move.
- Depth comes from impactful *few* actions — applies to the optional layer; the core loop ideally needs none beyond press-play.
- Opponent squads (when the optional layer engages combat setup) are readable, full-information puzzles with multiple valid solutions — no fog-of-war.
- Per-hero persistence, bench, and roguelike roster rules (fixed starter squad, unlockable pool, power built in-run only) apply within the optional layer.
- Mid-fight tactical decision remains parked — not in the core loop or the optional layer for now.
- The "5-second to understand" rule is ad-creative-only, not a gameplay-loop constraint.

## Reference games (by relevance)

| Priority | Game | Why it matters |
|---|---|---|
| 🥇 | Balatro | The concrete structural model for this project now: a first-time player watches the score climb and feels the spike without reading a single joker (core loop), while a deeper player mines synergies underneath (optional layer). Its expanding-pool pattern is the fix for the rejected draft sketch. |
| 🥇 | Into the Breach | Full-info, multi-solution puzzle that stays unsolvable without an opponent — reference for the optional layer's puzzle design. |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers refill the learn-loop — reference for the optional layer. Heavy RNG + permadeath — in tension with this project's still-open stakes-mechanism choice. |
| 🥈 | Darkest Dungeon | Risk/reward, stress/morale, character attachment; the friend's own named design ideal (auto-combat DD) — direct reference for the stakes-mechanism decision. |
| 🥈 | Heroes 3 | Hex/turn combat under an arena skin — visual anchor for the optional layer's hex-sim rendering. |
| 🥈 | TFT | On-board placement, hex-to-hex motion — reference for the optional layer. |
| 🥈 | PES / bot games | Proof watching high-variance AI-vs-AI is entertaining — reference for the core loop's watch-only bet. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch shape, but async-PvP — studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | Draft Showdown (App Store) | Trigger for the original discovery phase — real-time PvP draft-autobattler; deterministic puzzle-solving is absent from it. |

## Open questions

**Top priority — blocks the build:**
- **Stakes mechanism** — loss-on-fail vs. jackpot-style reward vs. bot-comparison (or a combination). Needed before the core loop can be built end-to-end.
- **How the optional layer surfaces** — auto-revealed over time, or sought out deliberately by the player.

Non-blocking, resolve during/after the build:
- OQ-13 — retry loop shape (per-round vs. per-run, count, same-difficulty enforcement).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft), if drag-placement is kept in the optional layer.
- OQ-14 — pre-run roster curation tightness.

Longer-horizon:
- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost).
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if the optional layer's build suggests it's needed.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `probe/FRIEND_TEST_PROTOCOL.md` — runbook used for the 2026-07-26 friend-validation session; historical reference now that probing is closed.
- `probe/` — the disposable RNG/emergence/wired toys built during discovery; historical reference, not the target for further building.
- `PROTOTYPE_PLAN.md` — build doc for the old single-spine design; expected to go stale, will need a rewrite against the layered structure.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
