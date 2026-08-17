# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-08-17

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

Prototype #1 plays end to end and has now been played and judged for the first time: the shape lands — both the payoff and the backfire genuinely surprise — but the read failed, on perception and on attribution. A render-only pass fixes perception (dilated inter-hit pacing, a dedicated chain HUD, an end card on every chain) and adds a first attribution-transparency step; both are mechanically verified but not yet replayed by a maker. Attribution itself — real player influence over the chain's dominant payoff axis — is still open, gated on that replay. Depth against run-to-run thinness still waits on the same verdict before widening the pool further.

## Next up

1. **Replay the fixed build and re-judge** — `npm run dev` in `prototype/`. Judge the two split questions separately: does the chain read now, and is attribution still absent?
2. If attribution still fails: pick an ownership lever. Any candidate must not reopen the payoff-axis or fake-decision-filter constraints — grep `DECISIONS.md` for both.
3. Widen the pool beyond encounters — offers/modifiers next, heroes after; waits on #1's repeat-play verdict.
4. Give the coin spend real teeth against backfire, or accept its purpose has shifted — needs a played verdict.
5. Tune fights 1–3 for real risk against a double-tank draft.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, chain, backfire | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain legibility — pacing, HUD, pips, end card | built | `render/playback.ts`, `render/fightView.ts` |
| The run — draft, field pick, attrition | batch-verified | `sim/roster.ts`, `sim/run.ts` |
| Enemies — the 11-encounter tiered pool | batch-verified | `sim/encounters.ts` |
| Optional layer — draft, field pick, coin spend | built | `render/squadPickScreen.ts`, `fieldPickScreen.ts` |
| Stakes — run-scoped coin economy | built | `sim/run.ts`, `sim/config.ts` |
| Difficulty — ~23% completion at n=1500 | batch-verified | `checks/chaindist.ts` |
| Prototype #1 — re-judged after the legibility fix | not started | Next up #1 |
| Real game build | not started | — |

## Unverified bets

- Combat is watch-only — the first played session found attribution absent under it; unresolved until a lever is chosen.
- Chain length, not hero identity, carries the payoff — the surprise lands on a first play, but the same session found it takes zero player input.
- A no-telegraph backfire flip reads as dread rather than confusion — tangled with the same perception issues the legibility fix targets, needs its own re-judge.
- A drawn encounter keeps the field pick a live read rather than a memorised answer.
- The draft/field split keeps attrition from spiralling without erasing it.

## Open questions

- Is the encounter pool wide enough to keep a run unsolved, or are offers/heroes needed next?
- Does the coin spend need new leverage against a backfire, or has its purpose shifted?
- Which lever should carry player influence over the chain — loaded continuation odds, the escalation knee, charge-as-choice, backfire risk, or an in-fight beat that revises watch-only?
- How much further to retune fights 1–3 against a double-tank draft?

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not regenerated by a sync.
- Commands: `npm run dev` to play, `npm run check` for regressions, `npm run batch -- --n 1000` for distributions — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable in one place), `src/render/`, `src/batch/`, `src/checks/`.
