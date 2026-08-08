# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-08

---

## What we're making

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1's fight mechanism — see Design status and Next up.

## Where we are right now

Prototype #1's core loop and run shape are stable; the fight's jeopardy-and-cascade mechanism is still being iterated by play, judged against `PROTOTYPE_PLAN.md`'s criteria. Every hero now carries roughly equal throughput within its role, differing only in shape, so squad choice is a real lever rather than a dominance ladder; a batch sweep of all 20 possible squads shows no blind-spam winner and no near-impossible pick, aside from two named exceptions. It's batch-tuned and smoke-tested but **not yet played and judged by either maker** — Next up #1. Revision history: DECISIONS.md.

## The shared lead moment

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — assemble, press play, watch. No reading or choice is required for the payoff; the squad pick and pre-fight read both ship with an accept-default, so the minimum path is Play → watch → Play.
- **"Pay off far bigger than expected"** — a pre-fight projection states a concrete expectation, a post-fight recap compares it to what happened, and full spectacle is reserved for a 3+-hit chain (rate: Design status, Stakes row).
- **"Couldn't fully predict"** — two independent dice (ignite? how long?): RNG is the floor in the mandatory core loop, emergent combination is the ceiling in the optional layer. Per-hit damage also carries ±25% variance.
- **"Looked like it might fail first"** — a run can genuinely be lost, and a real share of successful ignitions fire while the pool is low (numbers: Design status, Stakes row).
- **"Claim as mine"** — the friend doesn't read for or generate attribution, treating RNG as pure luck; attribution is Tu's need specifically. The squad-pick screen states the cascade lever directly (`chainAffinity` pips plus a one-line identity), so a player can *choose* to build toward it the way a Dota player builds Daedalus — not just receive it by accident.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept | Validated by early probes and the friend-validation session — DECISIONS.md. |
| Core loop — fight mechanics | Per-hero HP bars, job counters; a bruiser wind-up + enrage clock create jeopardy. Ignition: a per-hero HEAT meter (highest-heat hero, weighted by `chainAffinity`), spent every roll. Chain damage scales off the hot hero's damage and `chainAffinity`. Pool trades on equal throughput per role; healing is capped against the target's own max HP; enrage also scales with enemy HP destroyed. Batch-tuned, not yet played (Next up #1). Code: `sim/fight.ts`, `heroes.ts`, `projection.ts`. |
| The run — shape | 5 fights, attrition, coin economy. Auto-recovery restores a *fraction* of each hero's max HP (`autoRecoverFraction`), not flat. |
| Optional layer — concept | Validated by the emergence-only probe; must stay fully optional — forcing it failed 4/4 in testing. |
| Optional layer — contents | One coin-spend decision, accept-default. Squad pick (3 of 6) sets a fight's risk band and cascade frequency/size via `chainAffinity`. Bench and later-fight effects unspecified. |
| Prototype #1 — scope | A vehicle, not the real game. Smoke-tested, not yet played/judged. `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Run-scoped, never permanent; jeopardy is squad-dependent. **Default squad, n=2000:** completion ~23% (~2.4 deaths/run); dip ~32%; ignition ~60%; full-spectacle (chain≥3) ~23%; ~43% of ignitions below 40% pool. **All 20 squads (n=500 each):** completion spans 0–59%, 18 of 20 in 15–59%; two (`rook+vex+ward`, `bracer+cairn+ward`) are documented extreme-risk exceptions. Bands: `checks/chaindist.ts`. |
| Stakes — concrete devices | Coin, earned per win, lost on a run loss, spent on healing or an upgrade. A bank-or-push escalation and rival scoreboard remain open, undecided. |
| Blended single-mechanic approach | Rejected — DECISIONS.md. |
| Real game build | Not started — gated behind Next up #1. |

## Next up

1. **Play the current revision and judge it**, against `PROTOTYPE_PLAN.md`'s two completion criteria (differentiated reactions; can it surprise its makers). Check: can the player name their "Daedalus" pick at squad-pick time; does a near-loss cascade feel like the described moment. `npm run dev` in `prototype/`.
2. **Keep tuning by playing and the batch harness** — `checks/chaindist.ts` pins current bands, including the two named extreme-risk squads.
3. **Ask the friend:** does losing the run's coin satisfy his "lose something on failure" ask, or did he mean permanent loss?
4. **Reconcile the 5-vs-3 squad-size contradiction:** early DECISIONS.md entries fix the squad at 5 + bench; the build uses N=3 — neither superseded nor reconciled.
5. **Whether attrition needs a bench** — check once the build is played, now that it's load-bearing.
6. Re-evaluate which old design-spine elements belong in the optional layer, once the rest above are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Squad:** N=3 a side. 6-hero pool, two per role (tank: Bracer/Hollow; damage: Rook/Vex; support: Cairn/Ward), each pair trading equal throughput for shape — burst vs. cadence, fragility, `chainAffinity`.
- **Scoreboard:** per-hero HP bars, a job counter (soaked/dealt/restored), a labelled `CHAIN` bar per hero.
- **Beats:** opening exchange → dip (tank's line breaking, or bruiser wind-up + enrage clock) → ignition → chain → resolve, by wipe, not a timer.
- **The cascade:** an escalating crit/proc chain — one hero goes "hot," each hit rolls for a bonus hit raising the next one's odds (capped at 7), scaling off that hero's damage and `chainAffinity`.
- **Ignition eligibility:** a per-hero HEAT meter, spent per roll, weighted by `chainAffinity`. Highest-heat living hero above threshold rolls, resetting on fire or fizzle.
- Two independent dice (ignite? how long?) — a cascade can fire and the fight can still be lost. The cascade is the big win, not the only win.
- Enemies do not cascade. The squad pick sets a fight's risk band and the cascade's frequency/size — Design status.
- No reading needed for the full payoff — squad pick and pre-fight read both accept-default.

**The run — five fights:**

- Win all 5 to complete; run out of living heroes and it ends.
- HP and death carry between fights. Auto-recovery restores a *fraction* of max HP, not flat. Death is permanent for the run.
- Coin: earned per win, more on a cascade; spent on one decision (heal now, or bank a damage upgrade), accept-default. Lost on a run loss.
- Difficulty ramp: enemy HP rises per fight (`difficultyRampFactor`); per-hit damage rises more gently (`difficultyDamageRampFactor`); enrage also scales with the fraction of enemy HP already destroyed, so killing fast still faces real pressure.

**Optional layer (fully skippable):** the squad pick, plus unspecified candidates — recruitment beyond the 6-hero pool, synergies beyond the risk-and-cascade dial, and older ideas (5 heroes + bench, a draft, hex terrain, medieval roles, drag-placement, diagnose-adjust-retry) — Next up #6. Skipping this layer still gets the full payoff.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only — the biggest bet, de-risked by the RNG-only probe's lean-in.
- Attrition can spiral without a wider roster — worth checking now it's load-bearing (Next up #5).
- Combat is readable, chaos visual-only: weighted targeting (a holding tank draws 3× attacks, capped to one tank even in a double-tank squad) and ±25% per-hit variance.
- Mastery is a ceiling, never a gate — coin economy and squad pick both satisfy this.
- Optional-layer decisions must resist a single dominant move — true for 18 of the 20 possible squads; two remain documented extreme-risk exceptions, not blocking.
- Depth comes from few, impactful actions — the core loop needs none beyond press-play; the run adds one.
- Opponent squads are full-info puzzles with multiple solutions — no fog-of-war.

## Reference games (by relevance)

| Priority | Game | Why |
|---|---|---|
| 🥇 | Balatro | Score-climb + synergy layer — structural model. |
| 🥇 | Into the Breach | Full-info, multi-solution puzzle — optional-layer model. |
| 🥇 | Slay the Spire | Offer-variance refills the learn-loop. |
| 🥈 | Dota (crit/PRD) | Cascade shape, `chainAffinity`. |
| 🥈 | Darkest Dungeon, Heroes 3, TFT | Attrition, placement anchors. |
| 🥈 | PES/bots, Kingdom Rush | Watch-only AI, single-hero unpredictability. |
| 🥉 | Super Auto Pets, Mechabellum, Archero, Habby | Mobile packaging reference. |

## Open questions

**Top priority — shapes the build:**

- What the optional layer may modify in the fight beyond `chainAffinity` — base heat weights, escalation step, cap.
- How the optional layer surfaces — auto-revealed over time, or sought out.
- Whether attrition needs a bench to avoid spiraling (Next up #5).

**Non-blocking:** heat-weight/threshold constants (`sim/config.ts`, strawman values, Next up #2); an elected bank-or-push escalation and/or a rival-bot scoreboard; whether coin loss satisfies "lose something on failure" (Next up #3); the 5-vs-3 contradiction (Next up #4); deploy-zone size if drag-placement is kept; roster curation tightness.

**Longer-horizon:** attributability UI, variance injectors beyond the cascade, meta-progression across runs, combat's visual language, alternate win conditions.

**Parked:** mid-fight tactical call.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are.
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — original fight draft; beat-sheet sequence still current, mechanics superseded (see DECISIONS.md).
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — build doc: scope, stack, constants, phases, play/judge criteria.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned one fight into a full run.
- `STRATEGY.md` — deprecated, not current.
- `prototype/` — the code: `src/sim/`, `src/render/`, `src/batch/` (tuning harness), `src/checks/` (`npm run check`). Run via `npm run dev`.
