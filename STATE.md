# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-26 (pulled in the two 2026-07-24 DECISIONS entries that hadn't reached STATE yet — wired-together arm was built and played and is no longer "not built"; Tu's sustaining pleasure was sharpened from "comprehension of an open problem" to "decision-density." Also reflects the friend-test protocol now being ready to run.)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (hypothesis, not settled), currently in a **discovery phase**: the core fun has not yet been identified by play.

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI, experiment stage.
- **Platform:** mobile, casual audience.
- **Current focus:** find and verify what is actually fun, by play — not by more design reasoning. Monetization and UA come later.

## Where we are right now

An earlier version of this file asserted "fun = mastery + chaos" as settled; it was never verified by play, and the prototype built from it bored its own makers (diagnosis: no *spike* anywhere — mastery-optimization quietly cut chaos at every step, see [DECISIONS 2026-07-18](DECISIONS.md)). The fix in progress: **discovery by probe, not more theorizing.**

Process: (1) both makers independently recall *felt* moments and converge on one shared lead moment → (2) small disposable probes test whether that moment can be built, judged only by "do I not want to stop?" → (3) whichever probe earns a lean-in (for both makers) becomes the lead mechanic, others become support or get cut → (4) only then re-promote validated hypotheses to binding decisions and resync this file around the proven fun.

Step 1 is done (see below). Step 2 is active now — see **Probe status**. **Standing rule:** no new "do-not-re-litigate" decisions are minted until a probe earns one ([DECISIONS 2026-07-18](DECISIONS.md)).

## The shared lead moment (found 2026-07-19)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses (each is a test a mechanic must pass — full recall/synthesis in [DECISIONS 2026-07-19](DECISIONS.md)):
- **Watch-native** — assemble, press play, watch; not a compromise around watch-only combat.
- **"Pay off far bigger than expected"** — rejects mere stat-scaling; demands genuine over-delivery.
- **"Couldn't fully predict"** — resolved as **RNG triggers, emergent combination amplifies** — a division of labor, not a fork ([DECISIONS 2026-07-20](DECISIONS.md)). RNG decides *when/whether* a cascade fires (friend's favorite, supplies the **floor** — a highlight reachable even playing badly); emergent combination decides *what it becomes* (Tu's favorite, supplies the **ceiling** — rewards playing better). **Mastery is a ceiling, never a gate.** Sharpened by the wired-together arm's first play ([DECISIONS 2026-07-24](DECISIONS.md)): Tu's own sustaining pleasure is more specifically **decision-density** — an *open, recurring* space of strategic choice — not chance or comprehension-of-a-solved-system per se. Dread/boredom sets in once that space is fully mapped, regardless of whether RNG or a deterministic build was what closed it.
- **"Looked like it might fail first"** — real stakes required; a free same-difficulty retry that costs nothing undercuts this directly.
- **"Claim as mine"** — attributable; rejects illegible chaos and pure coin-flips.

This engines lens (Watching / Building / Gambling / Character-drama) is a **sorting label applied after naming the moment**, not a thing to choose first ([DECISIONS 2026-07-19](DECISIONS.md)) — naming a pole or mechanic first rejects nothing, which is exactly how the flat prototype accumulated.

## Probe status

Three-arm comparison testing the RNG-triggers-emergence bridge hypothesis. Judging bar throughout: **lean-in** ("do I not want to stop?"), required for both makers before an arm counts as validated.

| Arm | Status | Result |
|---|---|---|
| Emergence-only | done — Tu, 2026-07-22 | Genuine lean-in (target signal) *and* its predicted ceiling: a solved deterministic build stays solved forever. Read as the arm succeeding at what it tests, not a rejection — evidence for *why* emergence needs RNG paired with it. [Detail →](DECISIONS.md) |
| RNG-only | done — Tu, 2026-07-24 | Real jackpot-chase fun, but non-renewing — collapses (~30-40 rows) once the optimal piece-sequence is found and only chance remains. **Tu-only read — not yet checked against the friend**, whose stated floor need may be satisfied by the exact feeling Tu found boring. [Detail →](DECISIONS.md) |
| Wired-together (base) | built and played — Tu, 2026-07-24 | Flat for Tu: "spam spark and hope for surge," dread sets in once the dominant strategy (default Berserker, re-roll) is found. Diagnosed as **one decision, never revisited** — the roll is terminal (nothing sits between dice and outcome) and the space is non-renewing. Sharpens, doesn't overturn, the floor/ceiling split above. **Tu-only, unverified against the friend** — his floor need could want exactly this low-agency feeling. [Detail →](DECISIONS.md) |
| Wired-together, decision-layer iteration | in progress, not yet played | `probe/wired/layers.html` sketches three candidate recurring-decision layers on top of the *same, untouched* base dice — **draft** (swap a token into the row each round), **routing** (aim every spark/surge as it fires), and a third spend-after-you-see mode. All three excited Tu as *ideas*; none has been played yet, so this is a taste signal, not a validated result. Picking which shape to build/play first is open. |
| Friend validation | ready to run, not yet run | Session runbook is `probe/FRIEND_TEST_PROTOCOL.md` — fixed order RNG → Emergence → Wired-base, confound catalog, live reaction buckets, per-arm decisive attribution question. Tests all three arms above (not the decision-layer iteration, which postdates this protocol). |

Note on judging: a maker who *designed* a deterministic puzzle already knows the solve, so their own boredom with it is unreliable evidence against the building/puzzle moment — burnout must be checked against the arm's structural properties (not taken as a verdict) before it counts; lean-in is trustworthy self-report either way ([DECISIONS 2026-07-22](DECISIONS.md)).

## Next up

Immediate priority: **discovery, not construction** — do not resume building the loop until probe-validation has a real answer.

1. **Run the friend-validation session** — protocol is ready (`probe/FRIEND_TEST_PROTOCOL.md`), covers RNG, emergence, and wired-base.
2. **Pick and build one decision-layer shape** (draft / routing / spend-after, in `probe/wired/layers.html`) and play it — the excitement at the *idea* is weaker evidence than play, per this project's own standing rule.
3. Once an arm/iteration earns lean-in from both makers: **cast the lead**, derive further mechanics judged by "does this serve the moment?", then re-Settle and resync this file.

## The design spine (reference hypothesis, not a locked target)

> 5 individual heroes (+ a bench) → a 9 Kings-style draft builds up fielded *and* benched heroes over the run → two squads meet on contained terrain → the player watches a **readable, watch-only fight** → if it fails, **diagnose, adjust the squad, and retry within a limited attempt budget** → the lesson feeds the next setup. (A mid-fight tactical call is a *parked secondary experiment*.)

This is what the current prototype implements — the concrete thing built and found boring, retained as reference, not a target.

## Working assumptions (non-binding hypotheses)

Demoted 2026-07-18 from "Settled — do not re-litigate": none were verified by play before being declared settled. Each is still checkable true/false on its own; only the *bindingness* changed. Any may be reopened by a probe.

- Education-primary: the reason to watch is to learn and improve the next setup; suspense is secondary.
- Fun = balanced mastery + chaos, where chaos = visual liveliness + offer-variance, not outcome-uncertainty.
- Depth comes from impactful *few* actions, not more actions.
- The 5 are individual characters, not anonymous groups/archetypes.
- Combat is watch-only in the primary loop — the single biggest untested bet in the whole design.
- Learn loop: set up → watch → on failure diagnose/adjust/retry within a same-difficulty attempt budget. (Slay the Spire and Balatro, two top references, don't use free same-difficulty retries — unresolved tension.)
- Opponent squads are readable, full-information puzzles with multiple valid solutions (no fog-of-war).
- A bench exists; roster is roguelike not a collection — fixed starter squad each run, unlimited unlockable pool, power built in-run only.
- Per-hero persistence within a run — build-up welds to the hero, not the fielded slot.
- Field framing = squad vs. squad on contained terrain, medieval-war roles (tank/ranged/flanker), win by annihilate.
- Spatial model = hex-grid sim, MOBA-style render (sim/skin split).
- Pre-fight setup = on-map drag-placement into an authored bounded deploy zone.
- Terrain = authored structure from a small hand-authored map library, fixed across retries.
- Elevation is risk/reward, not pure upside.
- Encounter authoring = anti-solutions (one primary threat + a terrain feature the enemy exploits + a different one the player can use to counter), validated by a 4-point test.
- Mid-fight tactical decision is a parked secondary experiment, not in the core loop.
- Mastery is distributed across draft + pre-fight setup + between-attempt tuning.
- Combat must be readable — chaos is visual-only, capped RNG.
- Synergy between characters/items is wanted as a watch-legible variance engine.
- 9 Kings' simple-input/deep-output draft rhythm is the design (grid-placement/throne-defense not automatically adopted) — but the current implementation (`prototype/src/game/draft.ts`, a thin recruit-one / +25%-stat offer) is much shallower than that implies; this gap is itself a suspect for the boredom.
- The "5-second to understand" rule is ad-creative-only, not a gameplay-loop constraint.

## Reference games (by relevance)

| Priority | Game | Why it matters |
|---|---|---|
| 🥇 | Into the Breach | Full-info, multi-solution puzzle that stays unsolvable without an opponent; signature moment: the solve clicks. No free same-difficulty retry. |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers refill the learn-loop; pure-annihilate yet deeply strategic. Heavy RNG + permadeath — in friction with this project's determinism/free-retry hypotheses. |
| 🥇 | Balatro | Deep education made casual; building-lead; signature moment: the build pops (runaway combo). |
| 🥈 | Darkest Dungeon | Risk/reward, stress/morale, character attachment; stakes/character-drama lead; friend's inspiration; in tension with "casual mobile." |
| 🥈 | Heroes 3 | Hex/turn combat under an arena skin — visual anchor for the hex-sim layer. |
| 🥈 | TFT | On-board placement, hex-to-hex motion for the MOBA-render skin; friend's inspiration (building/synergy). |
| 🥈 | PES / bot games | Proof watching high-variance AI-vs-AI is entertaining (the watching engine); unverified in this project. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch shape, but async-PvP — studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | Draft Showdown (App Store) | Trigger for this discovery phase — real-time PvP draft-autobattler the maker found more fun than this prototype. Runs on building + gambling, no free retry; deterministic puzzle-solving is absent from it. |

## Open questions

**OQ-0 — What is the fun? Which lead moment? 🔴 top priority — everything else is downstream.**
Co-founder alignment: done (see shared moment above). Probe-validation: active — this is what's currently blocking everything (see Probe status above). Nothing below this line blocks or unblocks work.

Reopened pending OQ-0:
- OQ-13 — retry loop shape (per-round vs. per-run, count, same-difficulty enforcement).
- OQ-6 residual — deploy-zone size/expressiveness (whether placement swallows the draft).
- OQ-14 — pre-run roster curation tightness.

Longer-horizon (not blocking):
- OQ-7 — attributability UI (recap, telegraphs, retry diff/ghost).
- OQ-8 — variance injectors (morale/stress, fuzzy AI, chain reactions, terrain hazards).
- OQ-9 — meta-progression across runs.
- OQ-10 — combat's concrete visual language.
- OQ-15 follow-on — alternate win conditions as encounter variety.

**Parked:** mid-fight tactical call — revisit only if a probe suggests the loop needs it.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `probe/FRIEND_TEST_PROTOCOL.md` — live runbook for the friend-validation session.
- `PROTOTYPE_PLAN.md` — build doc for the now-reopened design; expected to go stale.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current.
