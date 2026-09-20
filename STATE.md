# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-20

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — every screen is accept-default, so the minimum path is Play → watch → Play.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — attribution is Tu's need, not the friend's; the draft states the lever and the encounter is named before the field pick.

## Where it stands

The fight is legible and the player can name a true cause, but only two of the six chain effects can
touch the game's one threat type (a bruiser's slam) — the other four never read or write that state,
so the pick still reads as one obvious answer; a fix is designed but not yet built
(archive/DESIGN_MULTIPLE_ANSWERS.md). Every encounter can be lost by some squad, with stakes spread
across all five fights instead of concentrated in the finale — Anvil is the one holdout, still
unloseable at its authored shape. The field pick still collapses to a forced answer under attrition,
and the coin spend still goes unused in real play.

## Next up

1. **Build the multi-answer chain design** — dual-pressure encounters, enemy-side setup, encounter-aware
   pick copy (flinch itself is cut, DECISIONS.md 2026-09-19) — per `archive/DESIGN_MULTIPLE_ANSWERS.md`.
   Genuinely next now: the difficulty pass that had to come first (DECISIONS.md 2026-09-20) is done.
2. Decide Anvil's fate — give it a threat (a wind-up, a telegraph) or cut it from the pool; its damage
   was pushed as far as this pass's approach reaches and it's still unloseable (DECISIONS.md 2026-09-20).
3. Decide whether the field-pick collapse under attrition is upstream of #1.
4. Decide whether the coin spend becomes something worth using in real play, or is cut — its simulated
   batch gap closed (DECISIONS.md 2026-09-20), but that's a different question from played-game use.
5. Widen the pool beyond encounters — offers/modifiers next, heroes after.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge accrual, threshold, persistence | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain identity — six per-hero effects and their backfires, replaces four failed levers | batch-verified | `sim/fight.ts`, `sim/config.ts`, `sim/heroes.ts` |
| Multi-answer counterplay — dual-pressure encounters, enemy-side setup, encounter-aware pick copy | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Chain legibility — pacing, HUD, pips, end card, per-effect | built | `render/playback.ts`, `render/fightView.ts` |
| Charge bar — the one lever reaching "change it" | played-verified | `render/fieldPickScreen.ts` |
| In-fight threat — bruiser wind-up; guard's redirect and Hollow's freeze both provable | batch-verified | `sim/fight.ts`, `render/fightView.ts` |
| Field pick — collapses to a forced answer under attrition | played-verified | `sim/roster.ts`, `render/fieldPickScreen.ts` |
| Coin spend — absent from all 12 played cards | played-verified | `sim/run.ts`, `render/runScreens.ts` |
| Pre-play chain signal — expected count + effect | batch-verified | `sim/projection.ts` |
| Enemies — the 11-encounter tiered pool, each retuned so some squad can lose it | batch-verified | `sim/encounters.ts`, `npm run measure:encounters` |
| Difficulty — ~19% completion for the default draft, losses spread across all five fights | batch-verified | `checks/chaindist.ts` |
| Real game build | not started | — |

## Unverified bets

- Enemy-anchored, multi-route counterplay (`archive/DESIGN_MULTIPLE_ANSWERS.md`) makes a hero's chain
  effect a live pick, not a forced one — designed 2026-09-18, not yet built or played.
- Raising each encounter's steady damage, not adding new in-fight escalation, is enough to keep a fight
  feel tense while watching — batch-verified at the squad level (`npm run measure:encounters`), not yet played.
- One backfire should not durably shrink the live roster — Rook sat out 8 straight fights after a single betrayal.
- Combat stays watch-only as more levers get added.
- Hollow's freeze base duration (`sim/config.ts`'s `chainStunBaseSec`) is a retuned strawman, not yet
  fully re-tuned against the harder batch.

## Open questions

- Does the multi-answer design actually produce two live routes per encounter at the pick screen,
  once built? Gates Next up #1.
- Does Anvil need an added threat, or should it be cut from the pool? Gates Next up #2.
- What makes a field pick live when attrition has already forced the answer? Gates Next up #3.
- Does the coin spend need a real answer to a backfire, or should it be cut? Gates Next up #4.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not regenerated by a sync.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `ATTRIBUTION_TEST.md` protocol), `npm run check` for regressions, `npm run batch -- --n 1000` for distributions, `npm run measure:encounters` for the per-squad/per-encounter difficulty matrix — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable in one place), `src/render/`, `src/batch/`, `src/checks/`.
