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
reward cards; chain abilities leave marks, and squad-wide payoff cards read them. Chains fire too
rarely — often once a match, and only after the fight is decided — so the next work makes every
hero chain every fight and replaces per-role backfire with per-unit fatigue; both are decided, not
built. The marks-and-payoffs work runs headless and in the browser but is uncommitted and unplayed.

## Next up

1. **Commit the marks-and-payoffs work** — `git status` shows it uncommitted.
2. **Build the chain-frequency rework** — batch-check that every hero chains at least once and the
   first chain lands while the fight is undecided; see DECISIONS.md 2026-09-30 "Chains fire every fight".
3. **Build fatigue** on top of it — see DECISIONS.md 2026-09-30 "Fatigue replaces per-role backfire odds".
4. **Re-batch payoff triggers, then play a run** — do Deep freeze, Spread and Open wound fire now,
   and does a build form?
5. Fix or drop the two wording bugs: the recap says "for 0" when a guard/stun chain saves someone,
   and the guard's "against" line repeats its "does" line against a single bruiser.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, threshold, persistence | played-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain frequency — per-fight reset, time trickle, smaller chains | not started | DECISIONS.md 2026-09-30 |
| Fatigue — per-unit, sets backfire odds and chain size | not started | DECISIONS.md 2026-09-30 |
| Chain identity — a role's base effect plus earned abilities, role-wide | played-verified | `sim/roles.ts`, `sim/progress.ts`, `sim/fight.ts` |
| Chain legibility — pacing, HUD, pips, end card, per-effect | played-verified | `render/playback.ts`, `render/fightView.ts` |
| Round screen — squad pick, HP bar, charge ring, press-and-hold card | built | `render/roundScreen.ts`, `design/HANDOFF.md` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Payoff cards — squad-wide, read marks | batch-verified | `sim/payoffs.ts`, `sim/fight.ts` |
| Payoff intro gate — a card waits until its marks are met | batch-verified | `sim/offers.ts`, `checks/offers.ts` |
| Offer pool — 3 reward cards per win, weighted by round | played-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Offer safety net — a revive/recruit when the roster has no cushion | played-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~10% run completion, n=300 greedy, 2026-09-30, pre-rework | batch-verified | `checks/runShape.ts`, `batch/cli.ts` |
| Multi-answer counterplay — needs re-reading against roles | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Real game build | not started | — |

## Unverified bets

- Marks and payoffs make a build that beats its parts in real play, not just in the batch.
- The intro gate doesn't starve early runs of payoff cards or make them feel samey.
- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Fatigue's mid-level peak makes "push or rest" a real choice, not always-rest or always-push.
- Twenty rounds feel like a run, not a drag, and three roles carry enough variety.

## Open questions

- What share of a fight's outcome should chains decide? Sets the tuning target for Next up #2.
- Does more chains per fight alone fix the rarely-firing payoff cards? Gates Next up #4.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers greedy` — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan), `src/render/`, `src/batch/`, `src/checks/`.
