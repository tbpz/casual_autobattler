# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-08-22

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

Prototype #1 plays end to end and was played and judged once: the shape lands, but the read failed on perception and on attribution. Both failures now have a built, batch-verified fix: chain legibility (dilated pacing, dedicated HUD, end card) and a reworked chain lever where magnitude is equalized per kind and each hero's fuse length + escalation shape is the pick-time axis, with a pre-play chain-likelihood line now shown on every pick screen. Neither fix has been played yet. A structured re-judge protocol (`ATTRIBUTION_TEST.md`) is built and ready to run it.

## Next up

1. **Run the `ATTRIBUTION_TEST.md` protocol on the fixed build** — `npm run dev` in `prototype/`, `?test=1`. Does the shape lever read as a real choice, or does chain length's own swing still swamp it?
2. If attribution still fails: `ATTRIBUTION_TEST.md`'s own lever × link grid and code table name exactly which lever and which link broke — follow that, not a fresh guess.
3. Widen the pool beyond encounters — offers/modifiers next, heroes after; waits on #1's verdict.
4. Give the coin spend real teeth against backfire, or accept its purpose has shifted — needs a played verdict.
5. Tune fights 1–3 for real risk against a double-tank draft.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, chain, backfire | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain legibility — pacing, HUD, pips, end card | batch-verified | `render/playback.ts`, `render/fightView.ts` |
| Chain shape lever — uniform EV per kind, fuse/escalation as the pick axis | batch-verified | `sim/heroes.ts`, `sim/config.ts`, `render/heroPickShared.ts` |
| Pre-play chain signal — expected count + shape, on squad/field/pre-fight screens | batch-verified | `sim/projection.ts` |
| The run — draft, field pick, attrition | batch-verified | `sim/roster.ts`, `sim/run.ts` |
| Enemies — the 11-encounter tiered pool | batch-verified | `sim/encounters.ts` |
| Optional layer — draft, field pick, coin spend | built | `render/squadPickScreen.ts`, `fieldPickScreen.ts` |
| Stakes — run-scoped coin economy | built | `sim/run.ts`, `sim/config.ts` |
| Difficulty — ~23% completion at n=1500 | batch-verified | `checks/chaindist.ts` |
| Prototype #1 — re-judged after the legibility + shape-lever fixes | not started | Next up #1 |
| Real game build | not started | — |

## Unverified bets

- Combat is watch-only — the first played session found attribution absent under it; unresolved until the fixes above are played.
- Chain length (how far the random walk runs) is still the dominant source of raw payoff variance; whether choosing a hero's fuse/escalation shape reads as real influence over that, rather than just getting lucky, is what the next session tests.
- A no-telegraph backfire flip reads as dread rather than confusion — tangled with the same perception issues the legibility fix targets, needs its own re-judge.
- A drawn encounter keeps the field pick a live read rather than a memorised answer.
- The draft/field split keeps attrition from spiralling without erasing it.

## Open questions

- Is the encounter pool wide enough to keep a run unsolved, or are offers/heroes needed next?
- Does the coin spend need new leverage against a backfire, or has its purpose shifted?
- Does chain shape read as attribution now that magnitude is equalized, or does chain length's own variance still swamp it — `ATTRIBUTION_TEST.md`'s grid is built to answer this.
- How much further to retune fights 1–3 against a double-tank draft?

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not regenerated by a sync.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `ATTRIBUTION_TEST.md` protocol), `npm run check` for regressions, `npm run batch -- --n 1000` for distributions — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable in one place), `src/render/`, `src/batch/`, `src/checks/`.
