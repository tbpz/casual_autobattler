# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-15

---

## What we're making

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1's chain mechanic and how wide a run's draw is — see Design status and Next up.

## Where we are right now

Prototype #1 plays end to end: a run drafts 5 of the 6-hero pool once, fields 3 fresh each fight, and plays 5 fights drawn from a wider authored encounter pool. The chain carries the lead moment — how long it runs, not who fires it, decides the payoff. Depth against run-to-run thinness is bought by widening what a run draws from, encounters first. The build is batch-tuned and mechanically verified but **not yet played and judged by either maker** — Next up #1.

## The shared lead moment

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — assemble, press play, watch. Draft, field pick, and pre-fight read are all accept-default, so the minimum path is Play → watch → Play.
- **"Pay off far bigger than expected"** — a pre-fight projection states an expectation and a post-fight recap compares it to what happened; how loudly a chain is performed is tiered to how long it ran (see Design status).
- **"Couldn't fully predict"** — the dice: ±25% per-hit variance, whether a fired chain backfires (revealed only as it fires), which encounters the run draws, and — loudest — how long a chain runs.
- **"Looked like it might fail first"** — a run can genuinely be lost; a chain can fire from a losing position, and a backfire can create one outright.
- **"Claim as mine"** — the friend treats RNG as pure luck; attribution is Tu's need. The draft states the lever (`chainAffinity` pips), field pick shows carried-in charge, and the drawn encounter is named before the pick — so a player can act on who's closest to a chain, and against what.

## Design status

Single source of truth for each piece.

| Piece | Status |
|---|---|
| Core loop — fight mechanics | A per-hero charge bar fills from that hero's job and fires on threshold; a coin flip then decides enemy or backfire, same magnitude either way. Escalation is back-loaded, so chain *length* sets the payoff spread; `chainAffinity` tilts magnitude only, never fill speed. A chain heal has its own higher cap. Charge persists all run, bench included. Code: `sim/fight.ts`. |
| Feedback and spectacle | No chain is silent: a callout starts at one chain-length threshold, the full shake-and-callout spectacle at a higher one, so a long chain reads as categorically different rather than bigger. The ignition tell scales to the firing hero's `chainAffinity`. A hero falling, a lost run, and a won fight (tiered flawless/regular/narrow, plus a near-miss beat) each get their own callout or recap. Code: `render/fightView.ts`. |
| The run — shape | 5 fights, attrition, coin economy. A roster of 5 drafts once at run start; 3 field each fight (`sim/roster.ts`), never short-handed. A fielded hero recovers less HP between fights than a benched one. |
| Enemies — shape | An 11-encounter authored pool (`sim/encounters.ts`), tiered early/mid/finale — names in that file. A run draws 5 without replacement within tier (`encounterOrderFor`). Encounters differ in shape, not size: wind-up intervals, enemy healing. Name and blurb show before the field pick. |
| Optional layer | Contents in The design spine. Must stay fully optional — forcing it failed 4/4 in testing. |
| Prototype #1 — scope | A vehicle for judging the lead moment, not the real game. **Completion criteria:** specific, differentiated reactions ("the chain ended flat"), never "seems fine"; it surprises its makers; after 6 runs something is still untried. |
| Stakes — shape | Run-scoped, never permanent. **Default draft, always-heal, n=1500:** completion ~23%. Chains fire in most fights. Fights 1-3 stay close to risk-free for a double-tank draft — narrowed, not closed, pinned in `checks/chaindist.ts`. |
| Stakes — concrete devices | Coin, earned per win (more on a fired chain), lost on a run loss, spent on healing or a damage upgrade. **Open gap:** the heal spend doesn't measurably beat skipping it against a backfire. Bank-or-push and a rival scoreboard remain open. |
| Real game build | Not started — gated behind Next up #1. |

## Next up

1. **Play a full run and judge it** against the completion criteria in Design status: does a near-full charge bar create dread; does a backfire read instantly as "wrong"; does a long chain feel categorically bigger than a short one; does an unfamiliar encounter change what gets fielded? `npm run dev` in `prototype/`. **Pre-registered:** the core loop is the friend/casual half, so finding it thin on repeat play is the expected result, not a failure signal — judge *does the shape land and read*, not *do I want to keep playing*.
2. **Widen the pool beyond encounters** — offers/modifiers next, heroes after; both wait on #1's verdict.
3. **Give the coin spend real teeth against backfire**, or accept its purpose has shifted (see Design status). Needs a played verdict before guessing at a fix.
4. **Tune fights 1-3 for real risk against a double-tank draft.**
5. **Keep tuning `chargeThreshold`/`backfireChance`** by playing and by the batch harness — batch-verified only so far.
6. **Ask the friend:** does losing the run's coin satisfy his "lose something on failure" ask, or did he mean permanent loss?
7. Re-evaluate which old design-spine elements belong in the optional layer, once the rest above are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Draft:** 5 of a 6-hero pool at run start, one per pair traded for shape (tank: Bracer/Hollow; damage: Rook/Vex; support: Cairn/Ward) — burst vs. cadence, fragility, `chainAffinity`.
- **Field:** 3 of the living draft, chosen fresh each fight against the encounter just drawn (accept-default auto-fills by role and current HP).
- **Scoreboard:** per-hero HP bars, a job counter, a labelled `CHAIN` bar per hero that persists across fights.
- **Beats:** opening exchange → dip (tank break, or wind-up + enrage) → a chain fires → resolve, by wipe.
- **The cascade:** an escalating hit chain (mechanism: Design status), each hit rolling for the next one's odds, capped.
- Enemies do not cascade. The draft and field pick set risk; carried-in charge sets who's closest to the next cascade.

**The run — five fights:**

- Win all 5 to complete; lose a fight, or run out of living roster to field a full squad, and the run ends.
- HP, charge, and death all carry between fights. Death is permanent; charge is untouched by HP recovery.
- Coin is earned per fight and spent between them (see Design status).
- Which questions a run asks depends on the encounters drawn; a small global ramp remains as a batch-tuning multiplier.

**Optional layer (fully skippable):** the run-start draft, the field pick, and the coin spend, plus candidates not yet specified — offers/modifiers, recruitment beyond the pool, synergies beyond the cascade dial, older ideas (hex terrain, drag-placement, deploy zones).

## Working assumptions (non-binding; any may be reopened by a build)

- Combat is watch-only — the biggest bet, de-risked by the RNG-only probe.
- The draft/field split keeps attrition from spiraling without erasing it.
- Combat is readable, chaos visual-only: weighted targeting (a holding tank draws 3× attacks) and ±25% per-hit variance.
- Mastery is a ceiling, never a gate; opponent squads are full-info puzzles with multiple solutions.
- Optional-layer decisions must resist a single dominant move; one single-tank draft is a documented exception.
- Depth comes from few, impactful actions — the run adds only draft, field pick, and coin spend.
- A no-telegraph backfire flip reads as clearer dread than a stack of rolls — unverified by play.
- A drawn encounter keeps the field pick a live read rather than a memorised answer — unverified by play.

## Reference games (by relevance)

| Priority | Game | Why |
|---|---|---|
| 🥇 | Balatro | Score-climb, synergy layer, expanding option pool. |
| 🥇 | Into the Breach | Full-info puzzle — the field pick answers a drawn encounter. |
| 🥇 | Slay the Spire | Offer-variance refills the learn-loop. |
| 🥈 | Dota (crit/PRD) | Cascade shape. |
| 🥈 | Darkest Dungeon, Heroes 3, TFT | Attrition, placement anchors. |
| 🥈 | PES/bots, Kingdom Rush | Watch-only AI. |
| 🥉 | Super Auto Pets, Mechabellum, Archero, Habby | Mobile packaging. |

## Open questions

**Top priority — shapes the build:**

- Whether the encounter pool is wide enough to keep a run unsolved, or offers/heroes are needed next.
- How much further to retune fights 1-3 and `chargeThreshold`/`backfireChance` before playing seriously.
- Whether the coin spend needs new leverage against a backfire, or its purpose has shifted.
- What the optional layer may modify beyond `chainAffinity` — charge weights, escalation curve, cap.
- How the optional layer surfaces — auto-revealed over time, or sought out.

**Non-blocking:** bank-or-push and/or a rival scoreboard; whether coin loss satisfies "lose something"; roster curation tightness.

**Longer-horizon:** attributability UI, variance injectors, meta-progression, combat's visual language, alternate win conditions.

**Parked:** mid-fight tactical call.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are.
- [CHAIN_AXIS_PLAN.md](CHAIN_AXIS_PLAN.md) — the plan behind this work; all three chunks done on `main`. Chunks 1-2 are on `origin/main`; Chunk 3 is not.
- `archive/` — retired working docs, kept for `DECISIONS.md`'s references.
- `prototype/` — the code: `src/sim/` (`roster.ts` — draft/field; `encounters.ts` — the encounter pool, see Design status), `src/render/`, `src/batch/` (tuning harness), `src/checks/` (`npm run check`). Run via `npm run dev`.
