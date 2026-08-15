# Reopening the strategy space — encounter deck + moving the chain's payoff axis

> **Picking this up in a fresh session:** this file is self-contained — no prior conversation context is needed. Start a new session in `casual_autobattler` and say:
> *"Read `CHAIN_AXIS_PLAN.md` and execute it, starting from Chunk 3."*
> Then read `STATE.md` per `CLAUDE.md`'s READ protocol before touching code.
>
> **Status as of 2026-08-15:** All three chunks are done and committed on `main` (`b560ed5`, `5ebdbff`, `b0c78a1`) — confirm with `git log origin/main..main` before assuming otherwise, since push status isn't tracked here. Chunk 3 (the encounter deck) shipped as an 11-encounter tiered pool (5 original + 6 new: Anvil, Ambush, Duelist, Warden, Glass Pair, Vanguard), drawn per run via `encounterOrderFor`. Not yet played/judged in this form — see this file's "Verify" step and the decision-protocol candidates at the bottom, still open pending a played verdict.

## Context

**The problem.** The chain genuinely surprises and is fun, but the rest of a run doesn't hold attention. After several runs there's no reason to press Play again — "it has nothing more to explore."

**This is a known, pre-registered gap.** `DECISIONS.md` 2026-07-24 logs Tu saying near-verbatim *"there's not much more to explore,"* and concludes: *"Tu is pulled by an open space of decisions, and dread/boredom is what happens once that space is fully mapped."* `STATE.md`'s Next up #1 carries the pre-registered expectation (originally `PROTOTYPE_PLAN.md`, now archived) that prototype #1 would feel thin on repeat play and that this is *"the expected result, not a failure signal."* So this is confirmation of a known gap, not a failure of the chain rebuild.

### Cause 1 — the space is closed after ~6 runs (Chunk 3 targets this — still open)

| Element | Varies run to run? |
|---|---|
| Encounters + their order | **No** — `encounterFor(fightIndex)` indexes `ENCOUNTERS` directly (`sim/encounters.ts:116`). Pack always first, Champion always fifth. |
| Hero pool | **No** — same 6, same stats. |
| Draft | **6 distinct drafts exist**, total. Default always drops Vex (`sim/heroes.ts:122`). |
| Field pick | Default is a deterministic function of roster state (`sim/roster.ts:48-73`). |
| Coin spend | Same 3 options, same prices, no randomized stock — and currently **inert** (STATE: `always-heal` ≈ `never-spend`). |
| Everything else | The seed only. |

**Two runs where the player makes the same 11 taps differ only by the seed.** RNG cannot reopen this — 2026-07-24 already established RNG as "seasoning, not the engine."

### Cause 2 — the payoff spread sat on the wrong axis (Chunk 2 — DONE)

The chain is not rare: it fires in ~79% of fights. **That frequency was settled and stayed** — `chargeThreshold` (220) was never touched by this build.

The problem was *where the size of a chain was decided* — before this pass, `chainAffinity` (0.3–1.6, ~5x spread, fixed at draft time) dominated magnitude over chain length (1–7 hits, linear). A 7-hit chain was 269 damage for Rook and single digits for Cairn — the suspense was spent before the dice were rolled, and the loud ignition fanfare (identical volume regardless of who fired) made a weak hero's chain over-promise every time.

**Shipped fix (`5ebdbff`):** `chainAffinity` compressed to 0.7–1.4 (final values: Cairn 0.7, Bracer 0.75, Vex 1.0, Ward 1.15, Hollow 1.3, Rook 1.4 — max). A new escalation curve (`chainEscalationFactor` in `sim/config.ts`) replaces the old flat `hitIndex` term: linear through hit 4 (`chainEscalationKneeHit: 4`), then steepens by `chainEscalationStepMultiplier: 3` per hit beyond — a 7-hit chain now escalates ~40x over a 1-hit chain, for every hero, regardless of affinity (verified analytically in `checks/chaindist.ts`: worst-case per-hero length ratio 39x vs. an identity ratio of only 2.1x at fixed length). Chain heals get their own cap (`chainHealMaxFractionOfTargetMaxHp: 0.20`, vs. the normal beat's 0.06) so a long support chain is a real event. `backfireChance` re-tuned 0.10→0.12 to hold run completion near the ~28% baseline after the escalation change pushed it to ~30.9%; lands at ~29.6%.

The ignition callout and burst ring now scale to the firing hero's own `chainAffinity` (`--ignite-scale` in `style.css`, wired in `fightView.ts`'s `showChainStart`) so a weak hero's tell doesn't over-promise. The popup-scale ramp (`chainPopupScale` in `fightView.ts`) is now sublinear through hit 4 and jumps discontinuously at the new `chainFullTellThreshold: 5` (was 3; `chainTellThreshold` moved 2→3) — a cascade should be tellable from a good chain without reading the number. `batch/report.ts`'s RC1 spectacle guard was renamed `fractionFightsWithChain5Plus` to track the new threshold.

Live-verified: the in-fight chain HUD's math matched hand-calculated escalation values exactly, and a real "projected 18s short, won with 8s to spare" chain-saved-the-fight moment was observed in play.

### Cause 3 — feedback defects (Chunk 1 — DONE)

`render/fightView.ts` was otherwise well built (arrival-timed tracers, HP ghost bars, flinch scaled by `damage/maxHp`, wind-up telegraph, tank break/hold, live job counters, `near-full` charge pulse at ≥85%). Three gaps, all fixed in `b560ed5`:

- **`heroDown` had no case in `handleEvent`.** Now shows a named "X FALLS" callout in a muted register, distinct from both the chain callout and the tank-break tell. Live-confirmed firing correctly mid-fight.
- **A lost run showed no recap.** `renderRunOverScreen` now reuses `fightRecap`/`chainRecapLine`/`noChainRecapLine`/`spareLine`, same as the win recap. Live-confirmed showing the full per-hero breakdown and spare-time comparison after a loss.
- **Victory was binary.** `showResolve` now tiers a win by remaining squad HP (flawless / regular / narrow) and adds a near-miss beat when a hero ends a fight charged above ~85% without firing. Live-confirmed a plain "VICTORY" correctly *not* tiering on a mid-HP win.

`encounterBlurbFor`'s dead-code status (never rendered) is still open — folded into Chunk 3 (item 3.6) rather than fixed standalone, since it's most useful once encounters are actually drawn rather than fixed.

### Industry research → the direction

Three solutions dominate the genre: **(1) expanding option pool** (Balatro jokers, StS unlocks, SAP packs — the space is never solved because new pieces keep entering it); **(2) re-posing fixed content as a harder question** (StS Ascension, Balatro stakes, Hades Heat, daily seeds); **(3) micro-stakes + tiered feedback** (Balatro's per-hand goal and magnitude-scaled juice, ITB's per-turn puzzle, slot near-miss, push-your-luck).

**Chosen: (1) as the answer, with the surgical half of (3) alongside. (2) is deferred, not rejected** — Ascension works in Slay the Spire *because* 350+ cards sit underneath it; over a space mapped in 6 runs it just yields the same solved run played tighter.

Solution 1 passes the project's own fake-decision filter (2026-07-26) on all three counts, fits the logged unlock rule (2026-07-11: widen the pool, never hand power), and is what Tu re-derived himself ("offer only tokens never seen at setup, capped to 3, revealed gradually").

**Long-term, all three depth sources are in play** — encounters (the question), offers/modifiers (the tools), heroes (the pieces). **This build is scoped to encounters + the chain's payoff axis + the feedback defects**, so the diagnosis gets tested before the expensive offer system (a future, separate build — not this plan) is built.

---

## Execution order

Sequenced for **interruption safety**, not design priority — each chunk ends with a tree that compiles, runs, and is worth committing on its own.

| Chunk | What | Status | Commit |
|---|---|---|---|
| **1** | Feedback defects | **DONE** | `b560ed5` (pushed) |
| **2** | Chain payoff axis + spectacle curve | **DONE** | `5ebdbff` (local only — not pushed as of 2026-08-15) |
| **3** | Encounter deck | **DONE** | `b0c78a1` |

Chunk 3 is the largest and the worst one to be interrupted inside — item 3.5 changes a signature used by five files. Start it only with quota headroom; if unsure, do 3.1–3.3 (additive, nothing breaks) and stop before 3.4. **Commit after finishing, or after 3.1–3.3 if stopping early.**

---

## Chunk 3 — the encounter deck

Turn the fixed 5-fight sequence into 5 drawn from a wider authored pool, so the field pick becomes a live read instead of a memorized answer.

**3.1 Add difficulty tiering to `EncounterDef`** (`sim/encounters.ts:35`).
Add `tier: "early" | "mid" | "finale"`. Without it a shuffle could put Champion at fight 1 and make the `difficultyRampFactor` ramp meaningless. Tag the existing five: Pack `early`, The Wall `early`, Twins `mid`, Executioner `mid`, Champion `finale`.

**3.2 Add two optional fields to `EncounterBruiser`** (`sim/encounters.ts:23`).
`windupIntervalSec?: number` (per-bruiser override of `cfg.fight.windupIntervalSec`, consumed at `encounters.ts:148`) and `healPerBeat?: number` (enemy support — `fight.ts` already branches on `healPerBeat` for the player side at `fight.ts:196-216`, so this is mostly wiring the enemy path). These two knobs are what make genuinely *different questions* possible rather than restated duplicates — the docstring at `encounters.ts:1-19` already names varying the **shape** of the threat, not its size, as the whole point.

**3.3 Author ~5–7 new encounters**, each asking a question none of the current five ask:

| Name | Shape | The question |
|---|---|---|
| Anvil | Huge HP, very low damage, no wind-up | Can you kill anything at all before enrage? Pure DPS check, zero jeopardy. |
| Ambush | 4 fast, fragile grunts (~0.6s interval) | Punishes a draft with no tank — damage arrives faster than a tank can absorb. |
| Duelist | One fast bruiser, `windupIntervalSec: 2.5` | Wind-ups land twice as often — tests sustained soak, not burst survival. |
| Warden | Bruiser with `healPerBeat` + 2 grunts | Must burst through healing; a slow grind loses. Directly rewards a chain. |
| Glass Pair | 2× low-HP high-damage bodies | Kill order matters — front-targeting kills the first one fast, so the race is real. |
| Vanguard | Bruiser with `windupTargeting: "lowestHp"` + fast grunts | Executioner's question, compounded by chip damage that keeps changing who's lowest. |

**3.4 Draw the order per run.** New export in `encounters.ts`:

```
encounterOrderFor(seed: number, fightsPerRun: number): number[]
```

Returns indices into `ENCOUNTERS`: sample without replacement from `early` for the opening fights, `mid` for the middle, one `finale` last. Use a **separate `new Rng(seed ^ 0x9e3779b9)`**, not the run's fight stream — drawing from `RunSession`'s shared stream (`runSession.ts:68`) would shift every downstream roll and make existing seeds and tuning incomparable.

**3.5 Thread the order through.** `makeEncounterEnemySide(cfg, fightIndex, encounterIndex?)` — `fightIndex` still drives the ramp (`encounters.ts:143-144`), `encounterIndex` now selects the shape. Default it to the current clamp so batch fixtures and `sim/run.ts:80`'s re-export keep working. Then:
- `RunSession` (`render/runSession.ts`): build `encounterOrder` in the constructor; add getters `currentEncounterName` / `currentEncounterBlurb`; pass the index at `runSession.ts:125`.
- `sim/run.ts:188` — headless `runRun` takes the same order, so batch measures the real distribution.
- `render/app.ts:34` — replace `encounterNameFor(session.currentFightIndex)` with the session getter.

**3.6 Render `blurb`.** Show it on the field-pick screen (`render/fieldPickScreen.ts`) under the encounter name. It's written, it's the "question it asks" line the docstring describes, and it's currently dead code (`encounterBlurbFor` has zero call sites) — the cheapest legibility win in the build, and what makes a *drawn* encounter readable rather than confusing.

**Verify:**
- `npm run check` — `checks/determinism.ts` needs updating (the encounter order is new same-seed state); `checks/beatsheet.ts`, `checks/chaindist.ts`, and `checks/projection.ts` should pass unchanged (Chunk 2's chain-axis assertions don't depend on which encounters are drawn).
- `npm run batch` — run completion near the current ~28-30% baseline (see Chunk 2's re-tuned numbers above) **across the new pool**, and no single draft dominating across many shuffles. The 2026-08-09 pass measured per-squad win rates per fight; re-run that shape. Fights 1–3 being close to risk-free for a double-tank draft is a known, still-open gap (`checks/chaindist.ts`'s own "KNOWN GAP" assertion, currently pinned at f1≥98%, f2/f3≥90%) — measure whether the deck improves it, and loosen/tighten that pin to match reality rather than leaving it stale.
- `npm run dev` — *after 6 runs, is there still something you haven't tried?* If no, the pool is too small, not the wrong idea.

**Commit.**

---

**Out of scope for this build:** offers/modifiers (the Balatro-joker layer — the next planned depth source, not part of this plan), new heroes, Ascension-style ladder, daily seeds, leaderboards, any cross-run power.

## Decision protocol

Per `CLAUDE.md`, nothing is logged to `DECISIONS.md` until Tu confirms. Candidates once Chunk 3 is played — surface them, don't auto-write:

- *Expanding option pool over difficulty ladder as the answer to run-to-run thinness* (ladder deferred, not rejected; offers and hero-pool widening endorsed as later steps).
- *The encounter deck (draw 5 from a tiered pool) replaces the fixed 5-encounter sequence.*
- *Chain payoff moved from the "who fires it" axis to the "how long it runs" axis — `chainAffinity` compressed, length escalation steepened, frequency unchanged.* (Already shipped in Chunk 2 — log once played/judged, not before.)
- *Spectacle is deliberately non-linear in impact: no chain is silent, escalation is back-loaded, and 5+ hits reads as categorically different rather than proportionally bigger.* (Already shipped in Chunk 2 — log once played/judged, not before.)
