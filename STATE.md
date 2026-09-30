# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-09-30

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
reward cards; chain abilities leave marks, and squad-wide payoff cards read them. Chains now fire
every fight from a zero start, and each unit carries a fatigue that sets its backfire odds and how
strong its chains are. All of it runs headless and in the browser and is batch-verified, but no full
run has been played by hand since the rework.

## Next up

1. **Play a run with the rework** — do chains feel like the show now, does fatigue make push-or-rest
   a real choice, and is the round screen readable with fatigue tiers and the Rest card?
2. **Find out why Deep freeze, Spread and Open wound rarely trigger** — taken often, they fire almost
   never even at ~5 chains a fight; see `npm run batch` output, "payoff triggers".
3. **Pick a target for chains' share of damage** — it is 32% of player damage now; Tu chose to see
   the numbers first.
4. **Fix the healer-only stalemate** — a squad down to healers can't kill the enemy, and the fight
   runs to the 180s limit (0.3% of fights).
5. Fix or drop the two wording bugs: the recap says "for 0" when a guard/stun chain saves someone,
   and the guard's "against" line repeats its "does" line against a single bruiser.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, trickle, threshold, one chain at a time | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain frequency — per-fight reset, time trickle, tougher enemies | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/runShape.ts` |
| Fatigue — per-unit, sets backfire odds and chain size | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/fatigue.ts` |
| Chain identity — a role's base effect plus earned abilities, role-wide | played-verified | `sim/roles.ts`, `sim/progress.ts`, `sim/fight.ts` |
| Chain legibility — pacing, HUD, pips, end card, per-effect | played-verified | `render/playback.ts`, `render/fightView.ts` |
| Round screen — squad pick, HP bar, fatigue tier ring, popover card | built | `render/roundScreen.ts`, `design/HANDOFF.md` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Payoff cards — squad-wide, read marks | batch-verified | `sim/payoffs.ts`, `sim/fight.ts` |
| Payoff intro gate — a card waits until its marks are met | batch-verified | `sim/offers.ts`, `checks/offers.ts` |
| Offer pool — 3 reward cards per win, weighted by round | played-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~9% run completion, n=1000 greedy, 2026-09-30, post-rework | batch-verified | `checks/runShape.ts`, `batch/cli.ts` |
| Multi-answer counterplay — needs re-reading against roles | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Real game build | not started | — |

## Unverified bets

- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Fatigue's mid-level peak makes "push or rest" a real choice, not always-rest or always-push.
- Marks and payoffs make a build that beats its parts in real play, not just in the batch.
- The intro gate doesn't starve early runs of payoff cards or make them feel samey.
- Twenty rounds feel like a run, not a drag, and three roles carry enough variety.

## Open questions

- What share of a fight's outcome should chains decide? Gates Next up #3.
- Why are three payoff cards taken but almost never triggered? Gates Next up #2.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers greedy` (add `--set key=number,...` to sweep a value) — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan), `src/render/`, `src/batch/`, `src/checks/`.
