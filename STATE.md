# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-23

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — every screen is accept-default, so the minimum path is Play → watch → Play.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — the round screen names each role's chain and the encounter before the squad-mix pick, not a run-start draft.

## Where it stands

The six named heroes, the run-start draft, and the coin spend are gone — a run now starts from three
role-named units and grows through 20 rounds via reward cards drawn after each win (DECISIONS.md
2026-09-23, "Three roles and a 20-round run..."). Played through a full round in the browser after
building: the fight, chain bars, recap, and offer screen all confirmed working. A 300-seed headless
population currently completes about 2% of runs — a first-pass number, not yet a tuned one. The old
multi-answer chain design and the six-hero encounter-pool tuning both targeted a design that no
longer exists and need to be re-read against roles before either is live again.

## Next up

1. **Re-read the multi-answer chain design against roles** — `archive/DESIGN_MULTIPLE_ANSWERS.md` was
   written for named heroes (Bracer's guard vs. Hollow's stun); check whether its claims still hold
   for a role's base chain vs. its earned upgrade before treating it as next.
2. **Playtest a full run** — only three rounds have been played end-to-end since the rebuild; the
   20-round arc, the mini-boss/boss step-up, and the offer variety are all unverified past round 3.
3. Decide whether the offer pool needs widening — three roles may read as thin once the novelty
   passes (see Unverified bets).
4. Decide whether the two rough edges found by playing (see Unverified bets) are worth a pass.
5. `REFERENCE.md`'s core-loop section still describes the six-hero draft and the 5-fight run — it
   needs a direct correction (not a sync) once the new shape has had more play time to settle.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge accrual, threshold, persistence | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain identity — a role's base effect plus one earned upgrade, both role-wide | played-verified | `sim/roles.ts`, `sim/progress.ts`, `sim/fight.ts` |
| Chain legibility — pacing, HUD, pips, end card, per-effect | played-verified | `render/playback.ts`, `render/fightView.ts` |
| Round screen — squad-mix pick merged with the pre-fight read | played-verified | `render/roundScreen.ts` |
| Offer pool — 3 reward cards per win, weighted by round | played-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Offer safety net — guarantees a revive/recruit when the roster has no cushion | played-verified | `sim/offers.ts`, DECISIONS.md 2026-09-23 |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool, reused from the old design | batch-verified | `sim/encounters.ts` |
| Difficulty — ~2% run completion under a fixed heuristic, first pass | batch-verified | `checks/runShape.ts` |
| Multi-answer counterplay — needs re-reading against roles before it's live | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Real game build | not started | — |

## Unverified bets

- A run's difficulty curve holds up under real (not heuristic) play — three rounds played by hand so
  far, ~2% completion measured headless (`checks/runShape.ts`).
- Role-wide upgrades don't compound faster than a real player can be surprised by, once someone is
  actually choosing instead of a fixed heuristic.
- Three roles carry enough variety on their own once the novelty passes; the offer pool is the lever
  if not.
- The guard chain's round-screen "against" line reads as a near-duplicate of its "does" line against
  a single bruiser — found by playing, not fixed.
- The post-fight recap reports a fired guard/stun chain as "for 0" — it only has real phrasing for
  damage/heal chains, so a real save reads like a dud.

## Open questions

- Does the multi-answer design's claims still hold once "a hero's chain" becomes "a role's chain"?
  Gates Next up #1.
- Does a full run played by hand feel like the twenty rounds it's built to be, or does it drag?
  Gates Next up #2.
- Is three roles enough, or does the offer pool need to carry more of the variety? Gates Next up #3.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (currently stale on the
  core loop, see Next up #5) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot and describe a
  superseded design.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log`
  skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not
  regenerated by a sync.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `ATTRIBUTION_TEST.md` protocol), `npm
  run check` for regressions, `npm run batch -- --n 1000 --offers greedy` for distributions — full
  list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` holds the round plan),
  `src/render/`, `src/batch/`, `src/checks/`.
