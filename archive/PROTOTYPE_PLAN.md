# Prototype Implementation Plan — Casual Roguelike Autobattler

> **RETIRED 2026-08-15 — history only, not current.** Superseded by the build itself: Phases 0–5 all shipped, and both constants tables below already self-declare "Superseded 2026-08-04" (`../DECISIONS.md` 2026-08-08 made `config.ts`/`heroes.ts` the sole authority for tuning constants). The two passages that were still live — the two completion criteria, and the pre-registered "thin on repeat play is expected" note — now live in `../STATE.md`'s Design status and Next up. Kept here, not deleted, for history.

> **What this file is:** the build doc for prototype #1. **Rewritten 2026-07-31**, superseding the 2026-07-14 version in full. The old version targeted the pre-2026-07-15 single-spine design — hex-grid tactical movement, terrain, A* pathing, a 9-Kings draft. That design is gone: `STATE.md` now files hex terrain and draft as optional-layer *candidate content*, not a core-loop requirement, and the fight actually specified in `FIGHT_SCRIPT.md` has no spatial movement at all — it's two aggregate meters and a proc chain. This version is derived from `FIGHT_SCRIPT.md` and the [2026-07-31 DECISIONS.md entry](../DECISIONS.md). Not part of the STATE/DECISIONS discipline — a build doc, expected to go stale, re-derive by hand as the build teaches things.
>
> **Partially superseded 2026-08-04** (not yet logged to DECISIONS.md — pending confirmation): the first playable build was judged not fun — no legible cause for HP loss, the "turnaround" was a hidden timer, and there was nothing to assemble. The Scope and constants tables below are updated in place to reflect what was actually built in response; see the bottom of this doc for what changed and why.

---

## What this build is for

**Prototype #1 is a vehicle, not a hypothesis test** (2026-07-31). Its job is to actualize the lead moment — turn "I assemble my squad, press play, and watch it pay off far bigger than I expected" into something on screen — so it can be judged and adjusted with real taste instead of argued about in the abstract. It does not have a single pass/fail claim.

Two completion criteria stand in for a test:

1. **It produces specific, differentiated reactions when watched** — "the chain ended flat," "8 seconds of opening is too long," "I didn't notice the ignition." If the honest reaction is only "seems fine," the vehicle failed as an instrument — the fix is more fidelity in one named channel, not more features.
2. **It must be able to surprise its makers.** If it can only show what `FIGHT_SCRIPT.md` and `DECISIONS.md` already specified, it's a rendering of the docs, not something to learn from.

**Pre-registered expectation (2026-07-30):** Tu plays this first, and the core loop is explicitly the friend/casual half of the design — the RNG-only probe already showed Tu's satisfaction with pure watch-and-press-play is real but non-renewing. If prototype #1 feels thin to Tu on repeat play, **that is the expected result, not a failure signal.** The judgment to make while playing is *does the 30-second shape land and read*, not *do I want to keep playing* — the second question is what the friend session is for.

## Scope

**In:**

- One fight, full beat sheet per `FIGHT_SCRIPT.md` §1–§4: opening exchange → dip → ignition → chain → resolve, two aggregate HP meters. **Updated 2026-08-04:** length is no longer a fixed ~30s — the fight resolves by wipe, not a timer (see below).
- A full run: 5 fights, win all 5 or run out of living heroes (2026-07-31).
- Attrition: HP and death both carry between fights. HP is recoverable (free auto-recovery between fights, no input); death is permanent — max squad HP is the sum of living heroes' individual max HP (no longer a flat 100 × N now that heroes have distinct HP values, see below).
- Coin economy: earned per fight won (+bonus if a cascade fired), spendable on exactly **one decision point** with a working accept-default — heal now, or bank toward a damage upgrade. Doing nothing still works (auto-recovery alone).
- A **headless batch-sim mode**: run N runs with no rendering, report win rate per fight, run-completion rate, chain-length distribution, and how often a cascade decided the outcome. This is what turns tuning from argument into measurement, per the standing "learn by building" rule. **Extended 2026-08-04** with three more metrics: gate-cross rate, failsafe rate, and fraction of wins with no chain (see below).
- **Added 2026-08-04, moved in from "Out":** hero roles (tank/damage/support, each with distinct HP/damage/attack cadence) and a run-start squad pick (3 of 6, pre-filled with a working default). Both were judged necessary for the fight to be legible at all — see the note at the bottom of this doc.

**Out (explicitly, per Q30 except where noted):**

- Bench / draft beyond the single run-start pick (`FIGHT_SCRIPT.md` §5's fuller vision remains deferred).
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

**Superseded 2026-08-04** — the side-level DPS budget model below (and `FIGHT_SCRIPT.md` §3's own worked check, which assumed it) no longer describes the build. Combat is now per-hero attack beats, not a continuous rate: each hero has its own HP/damage/attack interval (`sim/heroes.ts` for the player pool, `sim/config.ts`'s `bruiser`/`grunt` archetypes for enemies), a normal attack targets the front-most living enemy (deterministic for the player, weighted-random favoring the enemy's tank), and the fight resolves by wipe, not a 30s timer. The eligibility gate, both PRD tables, and the bonus-hit formula are unchanged. Current values live in `sim/config.ts` and `sim/heroes.ts`, tuned via the batch harness to land run-completion near the targets below — table not duplicated here since, per this doc's own header, constants are expected to move by playing.

| Constant | Value |
|---|---|
| Eligibility gate | player pool ≤ 40% of current (fight-start) max |
| Bonus hit damage | 20 × (bonus hits so far), capped at 100 |
| Fight end | resolves by wipe; a `maxFightSec` failsafe (180s) exists only so the sim can never hang — batch-verified at 0% incidence |

## Run-level constants

**Superseded 2026-08-04** in the same rewrite. Table not duplicated here for the same reason as above — see `sim/config.ts`'s `DEFAULT_RUN_CONFIG`. What changed structurally, not just numerically:

- **Max squad HP** is the sum of the chosen heroes' individual max HP (they're no longer uniform), not a flat 100 × N.
- **Difficulty ramp** now scales enemy HP only, not damage — scaling both compounded far faster than intended (batch-measured: fight-3 win rate collapsed from ~100% to ~13% before this fix).
- **Heal/upgrade costs were re-tuned** (raised, and heal's HP-per-use lowered) after the batch harness showed "always heal" trivializing run completion (~93-98%) against a ~50% engaged target — support's in-combat healing plus a full between-fight auto-recovery made the old heal cost/amount too cheap on top of both.
- Current tuning: passive (`never-spend`) run-completion ≈ 33% (target ~25%), engaged policies span ≈ 41-74% (target ~50%) depending on which lever is pulled — heal remains the strongest lever since it most directly counters permanent-death attrition. Still strawmen, per the standing "tune by playing" rule.

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

## 2026-08-04 — legibility rewrite

Phase 5 ran (Tu played first, per the plan above) and the verdict was that the build wasn't fun: no visible cause for HP loss, the turnaround was an authored timer rather than something caused, and the run had nothing to assemble. Diagnosis: the fight had no actors — `sim/fight.ts`'s old `applyDistributedDamage` spread a side-level DPS scalar across heroes with no attacker, no target, no attack event, so nothing on screen could explain why HP moved. Changed, all in service of making the fight causally legible without adding required reading:

- **Per-hero attack beats** replaced side-level DPS — every HP change now traces to a specific attacker/target pair (`attack`/`heal` events).
- **An enemy bruiser** (one big, slow, hard-hitting body) replaced the old enemy-DPS-decay curve as the dip's mechanism — the turnaround is now "you killed the big one," not a hidden clock.
- **Wipe-only resolution** replaced the 30s timer and its `rng.chance(0.5)` tie-break — every fight now ends in a body count the player watched happen.
- **Three roles** (tank/damage/support) gave targeting a reason and gave the support's heal a visible cause for a rising meter.
- **A run-start squad pick** (3 of 6, pre-filled default) made "assemble your squad" literal — it had been unbuilt, not merely optional.
- **A pre-fight read and an eligibility-gate mark on the meter** manufacture the expectation the cascade is meant to exceed — without a prediction to violate, "far bigger than expected" has nothing to be bigger than.
- **A post-fight recap line** ("SPARK chained ×4 — 240 damage") gives the player a causal account after the fact, not just during.

This is a change to the fight's *mechanism*, not the specified moment — see STATE.md's design-spine and the risk this puts pressure on (per-hero combat + wipe-only resolution can snowball, which cuts against "the cascade is the big win, not the only win"). Guarded by three new batch metrics (`fractionWinsWithNoChain`, `gateCrossRate`, `failsafeRate`) rather than by hope; current numbers hold `fractionWinsWithNoChain` ≈ 79%, comfortably non-trivial. Pending logging to `DECISIONS.md` on confirmation.
