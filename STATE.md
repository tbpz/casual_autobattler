# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-04

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

The fight is legible and the player can name a true cause, but the charge bar is still the only
lever reaching "I'd do it differently." No in-fight escalation beyond the bruiser wind-up, and the
run stays deliberately easier than it was, un-retuned, pending a difficulty decision. Chain
identity has now failed four separate candidate levers at full-scale measurement — payoff size,
backfire risk, shape, and targeting — each measured, none surviving. The field pick still
collapses to a forced answer under attrition, and the coin spend still goes unused.

## Next up

1. **Chain identity has no working lever after four full design-and-measure passes** (size, risk,
   shape, targeting). No new candidate is proposed — this needs a genuinely different idea, or a
   decision to leave the pick uncontested. See DECISIONS.md's 2026-09-04 entry and
   `CHAIN_SHAPE_TARGETING_PLAN.md` §7's last entry before starting a fifth attempt.
2. Decide whether the field-pick collapse is upstream of #1 — chain identity lives on the
   field-pick screen, so a forced pick is a lever nobody pulls.
3. Decide difficulty: re-compensate the ~9pt the CLOCK/WOUNDED removal gave back, or accept it. One
   pinned check is failing until this is settled.
4. Decide whether the coin spend becomes something worth using, or is cut — it appeared in none of the 12 played cards.
5. Widen the pool beyond encounters — offers/modifiers next, heroes after.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, chain, backfire | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain legibility — pacing, HUD, pips, end card | played-verified | `render/playback.ts`, `render/fightView.ts` |
| Charge bar — the one lever reaching "change it" | played-verified | `render/fieldPickScreen.ts` |
| Chain targeting — built behind a flag, failed its own gate; flag off | batch-verified | `sim/fight.ts`, `sim/config.ts`, `batch/targetingVerdict.ts` |
| Backfire risk — measured across all role pairs and in isolation, failed as a balance lever | batch-verified | `sim/config.ts` (`backfireChanceFor`), `batch/backfireRisk.ts` |
| In-fight threat — bruiser wind-up only | batch-verified | `sim/fight.ts` |
| Field pick — collapses to a forced answer under attrition | played-verified | `sim/roster.ts`, `render/fieldPickScreen.ts` |
| Coin spend — absent from all 12 played cards | played-verified | `sim/run.ts`, `render/runScreens.ts` |
| Pre-play chain signal — expected count + shape | batch-verified | `sim/projection.ts` |
| Enemies — the 11-encounter tiered pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~33% completion, un-retuned, one check failing | batch-verified | `checks/chaindist.ts` |
| Real game build | not started | — |

## Unverified bets

- A chain-identity pick (size, risk, shape, then targeting) can become a real pick-time axis —
  four designs tried, all four failed at full-scale measurement.
- The fight keeps enough pressure with no in-fight escalation at all.
- The coin spend has a purpose worth keeping.
- One backfire should not durably shrink the live roster — Rook sat out 8 straight fights after a single betrayal.
- Combat stays watch-only as more levers get added.

## Open questions

- Is there any chain-identity pick-time axis left to try, after four separate candidates all
  failed, or is the charge bar the only lever this mechanic will ever have? See DECISIONS.md's
  2026-09-04 entry.
- What makes a field pick live when attrition has already forced the answer?
- Does the coin spend need a real answer to a backfire, or should it be cut?
- Does the fight still reliably terminate without escalation — 0.1% of fights now run to `maxFightSec`.
- How much further to retune fights 1-3 against a double-tank draft?

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not regenerated by a sync.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `ATTRIBUTION_TEST.md` protocol), `npm run check` for regressions, `npm run batch -- --n 1000` for distributions — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable in one place), `src/render/`, `src/batch/`, `src/checks/`.
