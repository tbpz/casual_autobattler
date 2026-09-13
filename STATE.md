# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-13

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

The fight is legible and the player can name a true cause. Chain identity has a fifth design: each
hero's chain now does something different (strikes every enemy, pounds the biggest, guards the
squad, stuns, mends everyone, or mends the worst-hurt) instead of a bigger or smaller number — built
and batch-verified, not yet played. The run stays deliberately easier than intended, pending a
difficulty decision. The field pick still collapses to a forced answer under attrition, and the coin
spend still goes unused.

## Next up

1. **Play-test the new chain-effect design.** At the squad pick screen, read each hero's two-line
   chain block cold and name one enemy you'd bring it against, before checking `sim/encounters.ts`
   for a match. See DECISIONS.md's 2026-09-13 entry.
2. Decide whether the field-pick collapse is upstream of #1 — chain identity lives on the
   field-pick screen, so a forced pick is a lever nobody pulls.
3. Decide difficulty: the run still reads easier than intended — re-tune, or accept it.
4. Decide whether the coin spend becomes something worth using, or is cut — it appeared in none of the 12 played cards.
5. Widen the pool beyond encounters — offers/modifiers next, heroes after.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge accrual, threshold, persistence | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain identity — six per-hero effects and their backfires, replaces four failed levers | batch-verified | `sim/fight.ts`, `sim/config.ts`, `sim/heroes.ts` |
| Chain legibility — pacing, HUD, pips, end card, now per-effect | built | `render/playback.ts`, `render/fightView.ts` |
| Charge bar — the one lever reaching "change it" | played-verified | `render/fieldPickScreen.ts` |
| In-fight threat — bruiser wind-up, now also the target of guard/stun | batch-verified | `sim/fight.ts` |
| Field pick — collapses to a forced answer under attrition | played-verified | `sim/roster.ts`, `render/fieldPickScreen.ts` |
| Coin spend — absent from all 12 played cards | played-verified | `sim/run.ts`, `render/runScreens.ts` |
| Pre-play chain signal — expected count + effect | batch-verified | `sim/projection.ts` |
| Enemies — the 11-encounter tiered pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~20% completion for the default draft, all checks passing | batch-verified | `checks/chaindist.ts` |
| Real game build | not started | — |

## Unverified bets

- A per-hero chain EFFECT, not a per-hero number, can become a pick a player reasons about before
  the fight — built and batch-verified, not yet played. See DECISIONS.md's 2026-09-13 entry.
- The fight keeps enough pressure with no in-fight escalation beyond the bruiser wind-up.
- The coin spend has a purpose worth keeping.
- One backfire should not durably shrink the live roster — Rook sat out 8 straight fights after a single betrayal.
- Combat stays watch-only as more levers get added.

## Open questions

- Does the six-effect chain design actually read at the pick screen — can each hero's line be
  matched to an enemy cold, before playing? Gates Next up #1.
- What makes a field pick live when attrition has already forced the answer?
- Does the coin spend need a real answer to a backfire, or should it be cut?
- Does the fight still reliably terminate — stun/guard can suppress enemy actions for stretches;
  worth a fresh failsafe-rate check post-rebuild.
- How much further to retune fights 1-3 against a double-tank draft?

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not regenerated by a sync.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `ATTRIBUTION_TEST.md` protocol), `npm run check` for regressions, `npm run batch -- --n 1000` for distributions — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable in one place), `src/render/`, `src/batch/`, `src/checks/`.
