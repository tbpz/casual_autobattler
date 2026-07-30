# Prototype Implementation Plan — Casual Roguelike Autobattler

> **What this file is:** the build doc for prototype #1. **Rewritten 2026-07-31**, superseding the 2026-07-14 version in full. The old version targeted the pre-2026-07-15 single-spine design — hex-grid tactical movement, terrain, A* pathing, a 9-Kings draft. That design is gone: `STATE.md` now files hex terrain and draft as optional-layer *candidate content*, not a core-loop requirement, and the fight actually specified in `FIGHT_SCRIPT.md` has no spatial movement at all — it's two aggregate meters and a proc chain. This version is derived from `FIGHT_SCRIPT.md` and the [2026-07-31 DECISIONS.md entry](DECISIONS.md). Not part of the STATE/DECISIONS discipline — a build doc, expected to go stale, re-derive by hand as the build teaches things.

---

## What this build is for

**Prototype #1 is a vehicle, not a hypothesis test** (2026-07-31). Its job is to actualize the lead moment — turn "I assemble my squad, press play, and watch it pay off far bigger than I expected" into something on screen — so it can be judged and adjusted with real taste instead of argued about in the abstract. It does not have a single pass/fail claim.

Two completion criteria stand in for a test:

1. **It produces specific, differentiated reactions when watched** — "the chain ended flat," "8 seconds of opening is too long," "I didn't notice the ignition." If the honest reaction is only "seems fine," the vehicle failed as an instrument — the fix is more fidelity in one named channel, not more features.
2. **It must be able to surprise its makers.** If it can only show what `FIGHT_SCRIPT.md` and `DECISIONS.md` already specified, it's a rendering of the docs, not something to learn from.

**Pre-registered expectation (2026-07-30):** Tu plays this first, and the core loop is explicitly the friend/casual half of the design — the RNG-only probe already showed Tu's satisfaction with pure watch-and-press-play is real but non-renewing. If prototype #1 feels thin to Tu on repeat play, **that is the expected result, not a failure signal.** The judgment to make while playing is *does the 30-second shape land and read*, not *do I want to keep playing* — the second question is what the friend session is for.

## Scope

**In:**

- One fight, full beat sheet per `FIGHT_SCRIPT.md` §1–§4: opening exchange → dip → ignition → chain → resolve, ~30s, two aggregate HP meters.
- A full run: 5 fights, win all 5 or run out of living heroes (2026-07-31).
- Attrition: HP and death both carry between fights. HP is recoverable (free auto-recovery between fights, no input); death is permanent — max squad HP is 100 × living heroes.
- Coin economy: earned per fight won (+bonus if a cascade fired), spendable on exactly **one decision point** with a working accept-default — heal now, or bank toward a damage upgrade. Doing nothing still works (auto-recovery alone).
- A **headless batch-sim mode**: run N runs with no rendering, report win rate per fight, run-completion rate, chain-length distribution, and how often a cascade decided the outcome. This is what turns tuning from argument into measurement, per the standing "learn by building" rule.

**Out (explicitly, per Q30):**

- Squad-pick / bench / draft (`FIGHT_SCRIPT.md` §5, deferred).
- Hero roles or any distinguishing identity beyond a stub (silhouette + color, identical stats) — `DESIGN_QUESTIONS.md` Part 2/3.
- Enemy cascading (2026-07-31: no, for the prototype — see `FIGHT_SCRIPT.md` §3).
- Any spatial/tactical layer — no hex grid, no terrain, no pathing. Not deferred so much as no longer part of the specified core loop.
- Art, sound. Sound flagged as a real cost (the ignition tell and the chain's "distinct sound" in `FIGHT_SCRIPT.md` §1 lean on it) — cheapest hedge is two placeholder blips, not a design pass, if the chain reads flat and the cause is ambiguous.
- Meta-progression across runs — coin and upgrades are run-scoped only (2026-07-28); nothing carries to the next run.

## Stack

Simpler than the pre-2026-07-15 plan required, because the specified fight has no movement or pathing to simulate.

- **Web / TypeScript.** A pure-TS deterministic fight sim (`sim/`, no DOM/Pixi imports) + a thin render layer for the two meters, hero bodies, and the ignition/chain visual tells, + plain HTML/CSS for the resolve and coin screens.
- **Sim/render split, retained from the old plan for a sharper reason than before:** it's what makes the headless batch-sim mode possible, and that mode is now a first-class requirement, not a nice-to-have — the design has enough interacting dice (ignition PRD, chain PRD, attrition, coin) that "does this feel right" needs a distribution, not one playthrough.
- **Seeded RNG,** threaded through both fight and run. Same seed = identical run — useful for reproducing a specific chain while tuning, less load-bearing than in the old hex-sim plan since attribution no longer depends on deterministic replay for its own sake.

## Fight-level constants

Full detail, derivation, and the worked beat-sheet check are in `FIGHT_SCRIPT.md` §3. Summarized here for build reference:

| Constant | Value |
|---|---|
| Hero HP | 100 each |
| Player squad damage | 9/sec, side total (flat) |
| Enemy damage | 16/sec at t=0, decaying linearly to 2/sec at t=30 |
| Enemy HP (fight 1) | 300 |
| Eligibility gate | player pool ≤ 40% of current max |
| Bonus hit damage | 20 × (bonus hits so far), capped at 100 |
| Fight end, nobody wiped | 30s timer, higher meter wins |

## Run-level constants

| Constant | Value |
|---|---|
| Fights per run | 5 — win all, or run out of living heroes |
| Max squad HP | 100 × living heroes (death permanently removes capacity) |
| Auto-recovery between fights | +100 HP free, capped at max, no input required |
| Coin per fight won | 10, +5 if a cascade fired |
| Sink A — heal | 10 coin → +50 HP now |
| Sink B — upgrade | 30 coin → +2 dmg/sec, rest of the run |
| Difficulty ramp | enemy HP +10% per fight (300 → ~440 by fight 5) |
| On loss | run ends, coin lost, nothing carries to the next run |

## Build phases

### Phase 0 — Fight sim spine *(headless, no graphics)*

- `sim/` — pure module. Two sides, each a list of heroes (HP, damage share) — no hardcoded slots, so squad size N stays a parameter per the 2026-07-30 decision.
- Tick loop: apply side-level damage rates → check eligibility gate → roll ignition (PRD, persists across fights) → roll chain length (PRD, resets each ignition) → apply bonus-hit damage with retarget-on-death → resolve at 30s or wipe.
- **Every threshold as a fraction of current max, never a body count** — the eligibility gate and any future "hero down" check must survive N changing.
- **Milestone:** run one fight from the console, print the event log (beat timings, ignition/no-ignition, chain length, final meters). Same seed → identical log.

### Phase 1 — Run wrapper *(headless, no graphics)*

- Chain 5 fights: carry HP and living-hero count forward, apply auto-recovery between fights, apply the difficulty ramp, award coin, apply the one coin-spend decision (default: none).
- End conditions: 5 wins → run complete; 0 living heroes → run over, coin lost.
- **Milestone:** run one full 5-fight run from the console, print a per-fight summary and the run outcome.

### Phase 2 — Headless batch-sim harness

- Run N runs (start with 1,000) with a fixed policy (e.g. "always heal," "always upgrade," "never spend") and print: win rate per fight index, run-completion rate, chain-length histogram, fraction of wins where a chain of 3+ fired.
- **Target to check against:** passive-default completion rate near **~25%** of runs, engaged (spending coin well) near **~50%**. If the batch numbers are wildly off, fix the fight/run constants *before* spending time on rendering — cheaper to iterate headless.
- **Milestone:** a distribution report that lets a tuning change be judged by numbers moving, not by replaying and guessing.

### Phase 3 — Render *(watch the fight)*

- Two aggregate meters, hero bodies (stub shapes) that visibly react to damage, the ignition tell (flash/shake/callout), the chain's escalating visual pop, resolve screen, retry.
- Playback: no scrubbing needed for a 30s fight, but a pause is worth having for diagnosing "what just happened."
- **Milestone:** watch the Phase-0 fight play out and read correctly with zero explanation — the first real check against completion criterion 1.

### Phase 4 — Run screens

- Resolve screen after each fight → coin awarded → the one spend decision (heal / bank-upgrade / skip) → next fight, or run-complete / run-over screen.
- **Milestone:** a full run is playable end to end, five fights, watch-only except the one coin decision.

### Phase 5 — Play, watch, judge

- Tu plays first (Q29), against the pre-registered expectation above. Then the friend.
- Judge against the two completion criteria at the top of this doc, not against "is this fun yet" — fun is the friend session's question.
- Specifically watch the two risks flagged in `FIGHT_SCRIPT.md` and `DECISIONS.md`: whether the dip still reads as losing now that it's escapable, and whether attrition spirals without a bench.
- Only after this: log what changed to `DECISIONS.md`, then build the optional layer's next content on top.

## Critical path

Phases 0→1→2 are headless and strictly ordered — get the numbers right before spending effort on rendering, since Phase 2's batch harness is what makes "are these constants even in the right neighborhood" checkable in minutes instead of by replaying dozens of fights by hand. Phase 3 is the first genuinely make-or-break risk (is a watch-only fight actually watchable); Phase 5 is the first point real judgment is possible at all, since the vehicle framing means nothing before that is meant to be conclusive.
