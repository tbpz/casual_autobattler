# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-10-01

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — a run opens on a fight, and every screen but the relic pick is accept-default.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — the round screen names each role's chain and the enemy before the player picks who fights.

## Where it stands

A run grows over 20 rounds through a relic, reward cards, role upgrades and duo cards; cards are "when X, do Y" rules that can set each other off. The sim is batch-verified, but no full run has been played by hand since the card rework. The work now is a friendlier opening: a run starts straight on round 1, and the relic pick becomes round 1's reward — designed, not built. The shield segment on the HP bar is built but not yet seen in a browser.

## Next up

1. **Build the new opening** as the three newest `DECISIONS.md` entries specify: round 1 first, relic pick as its reward, no pre-selection, Collection after the first run.
2. **Play a run** (`npm run dev`): do the opening, relic, offer, cascade, recap and shield screens work, and do you want to try a combo next run?
3. **Rebalance outliers** from the batch synergy block (`npm run batch -- --offers build`): Punish is the weakest card, Restless the weakest relic.
4. **Pick a target for chains' share of damage** — it is about 38% of player damage now.
5. Fix the healer-only stalemate and the two recap wording bugs ("for 0" on a guard/stun save; the guard's repeated "against" line).

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, trickle, threshold, one chain at a time | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain frequency — per-fight reset, time trickle, tougher enemies | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/runShape.ts` |
| Fatigue — per-unit, sets backfire odds and chain size | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/fatigue.ts` |
| Chain abilities — 12; each role has 3 upgrade options, 2 drawn per run | batch-verified | `sim/roles.ts`, `sim/progress.ts`, `checks/abilities.ts` |
| Chain legibility — pacing, HUD, pips, end card, cascade popups | built | `render/playback.ts`, `render/fightView.ts` |
| Shield on the HP bar — segment, ghosts, break flash | built | `render/hpBar.ts`, `render/fightView.ts`, `checks/hpBar.ts` |
| Round screen — squad pick, fatigue, relic and card chips, duo hints | built | `render/roundScreen.ts`, `design/HANDOFF.md` |
| Round screen onboarding — fatigue detail shows before a player has seen it | not started | `render/roundScreen.ts` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Card engine — hooks, cascades, depth cap | batch-verified | `sim/cards/engine.ts`, `checks/cards.ts` |
| Card pool — 34 cards incl. 6 duos | batch-verified | `sim/cards/defs/`, `checks/cardpool.ts` |
| Card intro gate — a card waits for its marks; a duo waits for its parts | batch-verified | `sim/offers.ts`, `checks/offers.ts` |
| Offer pool — 3 per win, card weight capped | batch-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Relics — 6, pick 1 of 3, held all run | batch-verified | `sim/relics.ts`, `sim/cards/defs/relic.ts` |
| New opening — round 1 first, relic as round 1 reward, Collection after first run | not started | `render/app.ts`, `render/relicScreen.ts`, `render/runSession.ts`, `sim/run.ts` |
| Collection — cross-run, duo silhouettes | built | `sim/collection.ts`, `render/collectionScreen.ts` |
| Synergy report — best cards and pairs, per-relic rounds | batch-verified | `batch/synergy.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~8% run completion, n=3000 greedy, 2026-10-01 | batch-verified | `checks/runShape.ts`, `batch/cli.ts` |
| Multi-answer counterplay — needs re-reading against roles | not started | `archive/DESIGN_MULTIPLE_ANSWERS.md` |
| Real game build | not started | — |

## Unverified bets

- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Fatigue's mid-level peak makes "push or rest" a real choice, not always-rest or always-push.
- Cards and duos give a combo worth chasing next run — the bet this whole pass exists for.
- A relic picked after one fight gives the run an identity, not just one more upgrade.
- A cascade stays readable on a phone screen.

## Open questions

- What does each relic's text say to a player who has seen only one fight? Gates Next up #1.
- Do today's relics set a run's identity, or do some need to be bigger rule changes? Answered by Next up #2.
- What share of a fight's outcome should chains decide? Gates Next up #4.
- Are Smoke, Bulwark and Kindling fairly strong, or is the pool uneven? Gates Next up #3.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom.
- `DECISIONS.md` has an archive rule; entries below it predate the 2026-07-18 pivot.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (`?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers build` (add `--set key=number,...` to sweep a value, `--cards a,b` to restrict the pool) — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan, `cards/` the card engine and definitions), `src/render/`, `src/batch/`, `src/checks/`.
