# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-10-11

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

A run grows over 20 rounds through a relic, reward cards, role upgrades and duo cards, and the squad pick starts as last round's squad. The work now is making the game explain itself to a new player. On the canvas the round screen is a face-off with named fighters: tapping a fighter opens a popup, underlined game terms open animated cards, and the bench is a small preview shelf inside the squad box, with swapping on its own squad screen. The canvas is ordered by play flow (frames 1.1 to 6.1): the round screen, popup, term cards and squad screen (1.1–4.1) are drawn and await Tu's approval, the reward-pick frame (6.1) has no underlined terms yet, and card firing and the Exposed rebalance wait behind them.

## Next up

1. **Finish the self-explaining round screen on canvas:** get frames 1.1, 1.2, 2.1–2.4, 3.1–3.9 and 4.1 approved (open calls 8–10 in `design/HANDOFF.md`), then carry the underline marks onto the reward-pick frame 6.1.
2. **Build it:** the face-off screen in `render/roundScreen.ts`, a squad screen route in `render/app.ts`, unit names in `sim/roles.ts`, then the fighter popup, the bench shelf, and the term marks and cards.
3. **Fix the cards that rarely fire:** Glass fires only when a freeze ends; Overflow, Ember heart, Cold snap, Bulwark and Deep freeze fire in under half their held fights (the "rarely fires" line of `npm run batch -- --offers build`).
4. **Rebalance outliers** from the synergy block (Punish is the weakest card by a wide margin; recheck whether Exposed's cards still trail Burn's) and **pick a target for chains' share of damage** (about 44% of player damage now).
5. **Play more runs** (`npm run dev`) with a different build each time and send the `export` file, then run a second outside playtest on the new round screen; the healer-only stalemate and the two recap wording bugs ("for 0" on a guard/stun save; the guard's repeated "against" line) wait behind this.

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
| Round screen — squad pick starts as last round's squad, fatigue, relic and card chips, duo hints | built | `render/roundScreen.ts`, `sim/roster.ts`, `design/HANDOFF.md` |
| Face-off round screen, bench shelf and squad screen — frames 1.1, 1.2 and 4.1 drawn, not approved | not started | `design/canvas/RoundFaceOff.dc.html`, `design/canvas/RoundFaceOffBench.dc.html`, `design/canvas/SquadScreen.dc.html`, `design/HANDOFF.md` |
| Fighter popup — frames 2.1–2.4 drawn, not approved | not started | `design/canvas/FighterPopup*.dc.html`, `design/HANDOFF.md` |
| Term marks and explainer cards — 9 terms; underlined on frame 1.1, cards 3.1–3.9 drawn, not approved | not started | `design/canvas/Term*.dc.html`, `design/canvas/RoundFaceOff.dc.html`, `design/HANDOFF.md` |
| Unit names — names of their own are decided; units are named from the role label today | not started | `sim/roles.ts` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Card engine — hooks, cascades, depth cap | batch-verified | `sim/cards/engine.ts`, `checks/cards.ts` |
| Card pool — 34 cards incl. 6 duos | batch-verified | `sim/cards/defs/`, `checks/cardpool.ts` |
| Card intro gate — a card waits for its marks; a duo waits for its parts | batch-verified | `sim/offers.ts`, `sim/cards/index.ts`, `checks/offers.ts` |
| Card fire rate — "rarely fires" line in the synergy block | batch-verified | `batch/synergy.ts` |
| Offer pool — 3 per win, card weight capped, Recruit kept common | batch-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Card text — mark words coloured, offer names where a needed mark comes from | built | `render/heroPickShared.ts`, `sim/offers.ts`, `design/HANDOFF.md` |
| Relics — 6, pick 1 of 3, held all run | batch-verified | `sim/relics.ts`, `sim/cards/defs/relic.ts` |
| Opening — round 1 first, relic as round 1 reward | played-verified | `render/app.ts`, `render/relicScreen.ts`, `render/runSession.ts`, `sim/run.ts` |
| Run export — `export` link on every screen writes the run as JSON | played-verified | `render/app.ts`, `log/runLog.ts`, `checks/runLog.ts` |
| Synergy report — best cards and pairs, per-relic rounds | batch-verified | `batch/synergy.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~6% run completion, n=3000 greedy, 2026-10-02 | batch-verified | `checks/runShape.ts`, `batch/cli.ts` |
| Real game build | not started | — |

## Unverified bets

- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Push or rest stays a real choice, and players bench a tired hero by hand and notice the bench shelf (the batch bot rotates; the pick screen keeps last round's squad).
- Cards, duos and relics give a run an identity and a combo worth chasing.
- A cascade stays readable on a phone screen.
- A first-time player finds the underlined terms and taps a fighter for its popup without being told.

## Open questions

- Does the face-off round screen, with its fighter popup and term cards, let a first-time player say who fights whom and what each side can do? Answered by Next up #1 and #5.
- Where do unit names come from: a fixed pool, random, or picked by the player? Gates the build in Next up #2.
- Does the Exposed build still win less than Burn or Frozen, and is that its cards or a multiplier on a flat damage number? Gates Next up #4.
- What fire rate is healthy for a card that fires only on a moment (Lay bare, Second wind)? Gates Next up #3.
- Do today's relics set a run's identity, and do eased fatigue and common Recruit feel survivable by hand? Answered by Next up #5.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom; entries below its archive rule predate the 2026-07-18 pivot.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (the corner `export` link saves the run as JSON; `?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers build` (add `--set key=number,...` to sweep a value, `--cards a,b` to restrict the pool) — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan, `cards/` the card engine and definitions), `src/render/`, `src/batch/`, `src/checks/`, `src/log/` (the export).
- Design: canvas at https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, sources in `design/canvas/`; frames, open calls and the publish recipe are in [design/HANDOFF.md](design/HANDOFF.md), which also maps the old frame numbers that `DECISIONS.md` still uses to the new ones.
