# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-29

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — every screen is accept-default, so the minimum path is Play → watch → Play.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — the round screen names each role's chain and the enemy before the player picks who fights.

## Where it stands

A run starts from three role-named units (Tank, Damage, Healer) and grows over 20 rounds through
reward cards drawn after each win. The fight, chain bars, recap, round screen, and offer screen all
work in the browser, but only the first three rounds have been played by hand. A 300-seed headless
run finishes about 2% of the time — a first-pass number, not a tuned one. Three round-screen and
chain-upgrade changes are decided and drawn as mockups but not yet built.

## Next up

1. **Build the three decided changes** — HP bar + charge ring, press-and-hold ability card, and
   upgrades that add abilities instead of swapping them (mockups: `design/canvas/Round*.dc.html`).
2. **Playtest a full run** — the 20-round arc, the mini-boss/boss step-up, and offer variety are
   unchecked past round 3.
3. **Re-read the multi-answer chain design against roles** — `archive/DESIGN_MULTIPLE_ANSWERS.md`
   was written for named heroes; check its claims for a role's base chain plus earned upgrades.
4. Fix or drop the two wording bugs: the recap says "for 0" when a guard/stun chain saves someone,
   and the guard's "against" line repeats its "does" line against a single bruiser.
5. Correct `REFERENCE.md`'s core-loop section by hand (not a sync) once the run shape has settled.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, threshold, persistence | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain identity — a role's base effect plus earned upgrades, role-wide | played-verified | `sim/roles.ts`, `sim/progress.ts`, `sim/fight.ts` |
| Chain legibility — pacing, HUD, pips, end card, per-effect | played-verified | `render/playback.ts`, `render/fightView.ts` |
| Round screen — squad pick merged with the pre-fight read | played-verified | `render/roundScreen.ts` |
| Round screen — HP bar, charge ring, press-and-hold card | not started | `design/canvas/Round*.dc.html`, `design/HANDOFF.md` |
| Chain upgrades add abilities, never swap | not started | `sim/offers.ts` (still has `chainSwap`) |
| Offer pool — 3 reward cards per win, weighted by round | played-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Offer safety net — a revive/recruit when the roster has no cushion | played-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~2% run completion under a fixed heuristic | batch-verified | `checks/runShape.ts` |
| Multi-answer counterplay — needs re-reading against roles | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Real game build | not started | — |

## Unverified bets

- The difficulty curve holds up under real play, not just the fixed heuristic `checks/runShape.ts` uses.
- Role-wide upgrades don't stack up faster than a real player can still be surprised by.
- Three roles carry enough variety once the novelty passes; the offer pool is the lever if not.
- Twenty rounds feel like a run, not a drag.

## Open questions

- Does the multi-answer design still hold once "a hero's chain" becomes "a role's chain"? Gates Next up #3.
- Does a full run feel like twenty rounds worth playing, and are three roles enough? Gates Next up #2.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop, see Next up) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers greedy` — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan), `src/render/`, `src/batch/`, `src/checks/`.
