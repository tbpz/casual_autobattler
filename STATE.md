# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-10-16

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — a run opens on a fight, and every screen but the round 1 rune pick is accept-default.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — the round screen and fighter popup name each role's skill and the enemy before the player picks who fights.

## Where it stands

A run grows over 20 rounds through runes (a round 1 pick, later picks and duos, one pool of 40 short-named runes) and each role's ability options. The screens drawn on the canvas to make the game explain itself to a first-time player are built in the prototype: a face-off round screen with the runes in a box titled RUNES, a squad screen, a fighter popup, underlined terms with animated cards, a bare fight screen where a skill shows as one fixed-size bubble on its unit, a drawn line for every hit, a heavy finish on the slam, ✕ eyes on a fallen unit, runes drawn as round emblems with a full list that states the limit, and a run-over screen. None has been played by a first-time player, every canvas frame still awaits Tu's approval, and the fight looks and the runes box have not been seen on a phone. Fight, rune and ability mechanics are batch-verified.

## Next up

1. **Play it:** run `npm run dev` on a phone with a different build each time, then put it in front of the playtest friend and ask whether the bubble on the unit alone explains the skill and its count, how its edge states (brighter glow from 5, MAX, STOPPED, BACKFIRE) read, whether they find the underlines, the icons and the popup unprompted, whether a slam reads as the biggest hit, whether a fallen unit reads as out of the fight, whether the names and the RUNES title row read as runes, and whether the rune they pick reads as the same thing in the round screen's box; also open the round 1 pick ("Choose a rune") and the drop step at the limit, neither seen in a browser yet.
2. **Fix what that shows, then get the frames approved** (open calls 8–12 and 10b in `design/HANDOFF.md`, and 6.1 to 6.3); carry the underline marks and the skill rename onto the reward pick 6.1 (call 12); redraw frame 5.3 to the built slam.
3. **Fix the runes that rarely fire:** Shard fires only when a freeze ends; Brim, Pyre, Gelid, Rampart and Hoar fire in under half their held fights (the "rarely fires" line of `npm run batch -- --offers build`).
4. **Rebalance outliers** from the synergy block (Smite is the weakest rune by a wide margin; recheck whether Exposed's runes still trail Burn's) and **pick a target for chains' share of damage** (about 44% of player damage now).
5. **Send the `export` file from each play**; the healer-only stalemate waits behind #1.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, trickle, threshold, one chain at a time | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Chain frequency — per-fight reset, time trickle, tougher enemies | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/runShape.ts` |
| Fatigue — per-unit, sets backfire odds and chain size | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/fatigue.ts` |
| Chain abilities — 12; each role has 3 ability options, 2 drawn per run | batch-verified | `sim/roles.ts`, `sim/progress.ts`, `checks/abilities.ts` |
| Fight screen — bare arena, a fixed-size skill bubble with the charge flowing into it, thin charge bar, ⏸ and tap to pause, result overlay with best moment | built | `render/fightView.ts`, `render/bubble.ts`, `render/app.ts`, `render/pauseClock.ts`, `design/HANDOFF.md` |
| Hit lines and slam finish — a quick drawn line per hit; a slam ends on a strike beam, lunge, ring and heavy shake | built | `render/fightView.ts`, `style.css`, `design/HANDOFF.md` |
| Shield on the HP bar — segment, ghosts, break flash | built | `render/hpBar.ts`, `render/fightView.ts`, `checks/hpBar.ts` |
| Round screen — face-off, enemy badges, bench shelf, empty slot when a unit falls, squad screen | built | `render/roundScreen.ts`, `render/squadScreen.ts`, `render/roundParts.ts` |
| Runes display — round emblem, a box with a RUNES title row and count, `+N` fold, full list stating the limit, drop step at the limit | built | `render/upgrades.ts`, `render/offerScreen.ts`, `render/roundScreen.ts`, `design/HANDOFF.md` |
| Fighter popup — switcher, skill tile, fatigue card; fallen units open it from the fight only | built | `render/fighterPopup.ts` |
| Term marks and explainer cards — 11 cards, scenes generated from the canvas | built | `render/termCards.ts`, `design/tools/port-term-cards.js` |
| Win flow — the result overlay's Continue goes straight to the reward (rune pick on round 1, offers after) | built | `render/app.ts` |
| Run over screen — how close it was, best moment of the run, runes, squad | built | `render/runOverScreen.ts`, `render/fightSummary.ts` |
| Face style — fatigue eyes, villain eyes, ✕ eyes on a fallen unit in a fight, charge bar, guard pips at the body's side | built | `render/faces.ts`, `render/fightView.ts`, `design/tools/faces.js` |
| Skill naming — on popups, cards and the fight bubble; not on the reward pick or in `sim/` | built | `design/HANDOFF.md` (call 12) |
| Unit names — seeded draw from a pool | built | `sim/roles.ts`, `render/runSession.ts` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Card engine — hooks, cascades, depth cap | batch-verified | `sim/cards/engine.ts`, `checks/cards.ts` |
| Rune pool (cards in code) — 34 later picks incl. 6 duos; names are one short word each | batch-verified | `sim/cards/defs/`, `checks/cardpool.ts` |
| Rune intro gate — a rune waits for its marks; a duo waits for its parts | batch-verified | `sim/offers.ts`, `sim/cards/index.ts`, `checks/offers.ts` |
| Rune fire rate — "rarely fires" line in the synergy block | batch-verified | `batch/synergy.ts` |
| Offer pool — 3 per win, rune weight capped, Recruit kept common | batch-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Rune limit — the round 1 pick counts toward it and can be dropped | batch-verified | `sim/offers.ts`, `sim/progress.ts` (`heldCount`), `sim/config.ts` (`cardCap`) |
| Rune text — mark words coloured, offer names where a needed mark comes from | built | `render/heroPickShared.ts`, `sim/offers.ts`, `design/HANDOFF.md` |
| First picks — 6 runes, pick 1 of 3 as the round 1 reward | batch-verified | `sim/relics.ts`, `sim/cards/defs/relic.ts` |
| Opening — round 1 first, rune pick as round 1 reward | played-verified | `render/app.ts`, `render/relicScreen.ts`, `render/runSession.ts`, `sim/run.ts` |
| Run export — `export` link on every screen writes the run as JSON | played-verified | `render/app.ts`, `log/runLog.ts`, `checks/runLog.ts` |
| Synergy report — best runes and pairs, per-first-pick rounds | batch-verified | `batch/synergy.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — ~6% run completion, n=3000 greedy, 2026-10-02 | batch-verified | `checks/runShape.ts`, `batch/cli.ts` |
| Real game build | not started | — |

## Unverified bets

- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Push or rest stays a real choice, and players bench a tired hero by hand and notice the bench shelf.
- Runes, first picks and duos included, give a run an identity and a combo worth chasing.
- A cascade stays readable on a phone screen, a slam reads as the biggest hit, and a tap on a fighter that pauses the fight feels natural.
- A first-time player finds the underlined terms, the stat icons and the enemy badges, opens a fighter's popup, reads the eyes as fatigue, enemy and fallen, links a skill to the unit that did it from the bubble on its head, and reads a picked rune as the same emblem in the round screen's box, without being told.

## Open questions

- Does the face-off round screen, with its stat icons, enemy badges, eyes, popup and term cards, let a first-time player say who fights whom and what each side can do, and does the fight's bubble name who did what? Answered by Next up #1.
- Does an empty slot that blocks Fight until it is filled feel clear, or does it break accept-default? Answered by Next up #1.
- Does the Exposed build still win less than Burn or Frozen, and is that its runes or a multiplier on a flat damage number? Gates Next up #4.
- What fire rate is healthy for a rune that fires only on a moment (Heir, Vigil)? Gates Next up #3.
- Do today's six first-pick runes set a run's identity, and do eased fatigue and common Recruit feel survivable by hand? Answered by Next up #1.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core
  loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom; entries below its archive rule predate the 2026-07-18 pivot. Older entries use the old rune names; the old → new table is in `design/HANDOFF.md` under 6.1.
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (the corner `export` link saves the run as JSON; `?test=1&seed=N` runs the `archive/ATTRIBUTION_TEST.md` protocol; `?round=N`, `?offer=N`, `?runover=1` and `?fall=N` jump to a screen for screenshots),
  `npm run check` for regressions, `npm run batch -- --n 1000 --offers build` (add `--set key=number,...` to sweep a value, `--cards a,b` to restrict the pool) — full list in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan, `cards/` the card engine and definitions), `src/render/`, `src/batch/`, `src/checks/`, `src/log/` (the export).
- Design: canvas at https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, sources in `design/canvas/`; what is built where, the open calls and the publish recipe are in [design/HANDOFF.md](design/HANDOFF.md), which also maps the old frame numbers that `DECISIONS.md` still uses to the new ones.
