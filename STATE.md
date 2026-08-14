# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-15

---

## What we're making

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1's chain mechanic, just rebuilt — see Design status and Next up.

## Where we are right now

Prototype #1's core loop is stable: a run drafts 5 of the 6-hero pool once, then fields 3 fresh each fight — never short-handed, but death is permanent and narrows the draft over the run. Each of the 5 fights is its own authored encounter. The chain — the mechanic the lead moment is built on — was just rebuilt: a persistent per-hero charge bar replaces the old heat/ignition-roll system, and a backfire coin flip replaces heat gifts as the source of real unpredictability. Batch-tuned to match the prior mechanic's ~28% completion baseline, but **not yet played and judged by either maker in this form** — Next up #1. Revision history: DECISIONS.md.

## The shared lead moment

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — assemble, press play, watch. The draft, field pick, and pre-fight read all ship with an accept-default, so the minimum path is Play → watch → Play.
- **"Pay off far bigger than expected"** — a pre-fight projection states a concrete expectation, a post-fight recap compares it to what happened; full spectacle is reserved for a 3+-hit chain.
- **"Couldn't fully predict"** — three dice: ±25% per-hit variance, a fired chain's length, and — loudest — whether it backfires, revealed only at the instant it fires.
- **"Looked like it might fail first"** — a run can genuinely be lost; a chain firing from a losing position is a real, measured share, and a backfire can now cause the losing position outright.
- **"Claim as mine"** — the friend treats RNG as pure luck; attribution is Tu's need specifically. The draft states the lever directly (`chainAffinity` pips), and field-pick shows carried-in charge, so a player can act on who's closest to a chain.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept | Validated by early probes and the friend-validation session — DECISIONS.md. |
| Core loop — fight mechanics | Per-hero HP bars, job counters; a bruiser wind-up + enrage clock create jeopardy. Chain: a per-hero charge bar fills from that hero's job, fires deterministically on threshold. A fired chain repeats the hero's action, escalating; a coin flip decides enemy vs. backfire, same magnitude either way. `chainAffinity` sets magnitude, not fill speed. Charge persists all run, bench included. Code: `sim/fight.ts`. |
| The run — shape | 5 fights, attrition, coin economy. A roster of 5 drafts once at run start; 3 field each fight (`sim/roster.ts`), never short-handed. A fielded hero recovers less HP between fights than a benched one. |
| Enemies — shape | 5 authored encounters (`sim/encounters.ts`), each its own shape: Pack, The Wall, Twins, Executioner, Champion. |
| Optional layer — concept | Validated by the emergence-only probe; must stay fully optional — forcing it failed 4/4 in testing. |
| Optional layer — contents | The run-start draft (5 of 6), a fresh field pick each fight (now showing carried-in charge), one coin-spend decision per fight — all accept-default. |
| Prototype #1 — scope | A vehicle, not the real game. Batch-tuned, not yet played/judged in its current (post-chain-rebuild) form. `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Run-scoped, never permanent. **Default draft, always-heal, n=1500:** completion ~28% (re-tuned to the pre-rebuild baseline); chain fires in ~79% of fights, ~10% backfire; fights 1–3 stay risk-free for a double-tank draft (known gap). |
| Stakes — concrete devices | Coin, earned per win (more on a fired chain), lost on a run loss, spent on healing or a damage upgrade. **New gap:** heal's protection against a backfire loss is weak — `always-heal`/`never-spend` now complete an indistinguishable share of runs. Bank-or-push and a rival scoreboard remain open. |
| Real game build | Not started — gated behind Next up #1. |

## Next up

1. **Play the rebuilt chain and judge it**, against `PROTOTYPE_PLAN.md`'s two completion criteria: does a near-full charge bar create legible dread without knowing which way it'll go; does a backfire read instantly as "wrong" vs. a real chain; does carried-in charge change what gets fielded. `npm run dev` in `prototype/`.
2. **Give the coin spend real teeth against backfire**, or accept its purpose has shifted — the heal spend no longer measurably outperforms skipping it (`checks/chaindist.ts`'s known gap). Needs a played verdict before guessing at a fix.
3. **Tune fights 1–3 for real risk against a double-tank draft** — still close to 100% regardless of the rebuild.
4. **Keep tuning `chargeThreshold`/`backfireChance`** by playing and the batch harness — both are freshly re-set strawmen, batch-verified only.
5. **Ask the friend:** does losing the run's coin satisfy his "lose something on failure" ask, or did he mean permanent loss?
6. Re-evaluate which old design-spine elements belong in the optional layer, once the rest above are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Draft:** 5 of a 6-hero pool at run start, one per pair traded for shape (tank: Bracer/Hollow; damage: Rook/Vex; support: Cairn/Ward) — burst vs. cadence, fragility, `chainAffinity`.
- **Field:** 3 of the living draft, chosen fresh each fight (accept-default auto-fills by role and current HP).
- **Scoreboard:** per-hero HP bars, a job counter, a labelled `CHAIN` bar per hero that persists across fights.
- **Beats:** opening exchange → dip (tank line breaking, or wind-up + enrage) → a chain fires → resolve, by wipe.
- **The cascade:** an escalating hit chain (mechanism: Design status), each hit rolling for the next one's odds (capped at 7), scaling off damage/heal and `chainAffinity`.
- Two dice remain once it fires (how long? which way?) — a cascade can fire and the fight still be lost, or a backfire can lose it outright.
- Enemies do not cascade. The field pick and draft set risk; carried-in charge sets who's closest to the next cascade.
- No reading needed for the full payoff — draft, field pick, and pre-fight read all accept-default.

**The run — five fights:**

- Win all 5 to complete; lose a fight, or run out of living roster to field a full squad, and the run ends.
- HP, charge, and death all carry between fights. Death is permanent; charge is untouched by HP recovery.
- Coin: earned per win, more on a fired chain; spent on healing or a damage upgrade. Lost on a run loss.
- Difficulty comes from each fight's own authored encounter; a small global ramp remains as a batch-tuning multiplier.

**Optional layer (fully skippable):** the draft, the field pick, plus unspecified candidates — recruitment beyond the pool, synergies beyond the cascade dial, older ideas (hex terrain, drag-placement).

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only — the biggest bet, de-risked by the RNG-only probe's lean-in.
- The draft/field split keeps attrition from spiraling without erasing it — worth checking now it's built and played (Next up #1).
- Combat is readable, chaos visual-only: weighted targeting (holding tank draws 3× attacks) and ±25% per-hit variance.
- Mastery is a ceiling, never a gate — coin economy, draft, and field pick satisfy this.
- Optional-layer decisions must resist a single dominant move — true for most of the 6 drafts; one single-tank draft is a documented extreme-risk exception.
- Depth comes from few, impactful actions — the run adds only draft, field pick, and coin spend.
- Opponent squads are full-info puzzles with multiple solutions — no fog-of-war.
- A no-telegraph backfire flip reads as clearer dread than the old roll stack — unverified by play.

## Reference games (by relevance)

| Priority | Game | Why |
|---|---|---|
| 🥇 | Balatro | Score-climb + synergy layer — structural model. |
| 🥇 | Into the Breach | Full-info puzzle — now literal: field pick answers a known encounter each fight. |
| 🥇 | Slay the Spire | Offer-variance refills the learn-loop. |
| 🥈 | Dota (crit/PRD) | Cascade shape. |
| 🥈 | Darkest Dungeon, Heroes 3, TFT | Attrition, placement anchors. |
| 🥈 | PES/bots, Kingdom Rush | Watch-only AI. |
| 🥉 | Super Auto Pets, Mechabellum, Archero, Habby | Mobile packaging reference. |

## Open questions

**Top priority — shapes the build:**

- How much further to retune fights 1–3 (double-tank risk) and `chargeThreshold`/`backfireChance` before playing seriously.
- Whether the coin spend needs new leverage against a backfire, or its purpose has legitimately shifted.
- What the optional layer may modify beyond `chainAffinity` — base charge weights, escalation step, cap.
- How the optional layer surfaces — auto-revealed over time, or sought out.

**Non-blocking:** charge-weight/threshold/backfireChance constants (`sim/config.ts`); a bank-or-push escalation and/or rival scoreboard; whether coin loss satisfies "lose something" (Next up #5); deploy-zone size if drag-placement is kept; roster curation tightness.

**Longer-horizon:** attributability UI, variance injectors beyond the cascade, meta-progression across runs, combat's visual language, alternate win conditions.

**Parked:** mid-fight tactical call.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are.
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — original fight draft; beat-sheet sequence still current, mechanics superseded.
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — build doc: scope, stack, constants, phases, play/judge criteria.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned one fight into a full run.
- `STRATEGY.md` — deprecated, not current.
- `prototype/` — the code: `src/sim/` (`roster.ts` — draft/field; `encounters.ts` — the 5 fights), `src/render/`, `src/batch/` (tuning harness), `src/checks/` (`npm run check`). Run via `npm run dev`.
