# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-10-23

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.
- Tu is the only judge for now; outside playtests are paused.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — a run opens on one choice, the army, then a fight, and every screen after it but the round 1 rune pick is accept-default.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — a rune combo the player built is the strongest source of "mine"; the round screen and fighter popup also name each role's skill and the enemy before the player picks who fights.

## Where it stands

The moment lands in plain runs from two sources: a chain that goes unexpectedly well, and runes that combine well, the second stronger because the player built it. The three armies (Undead, Mages, Beasts) are built and fight differently, and they are where run variety comes from. Tu's Mage play found the synergy but a weak army identity, so the Mage runes now act on the orbs themselves, in three rival builds (big merges, many merges, the core orb); they are batch-verified but unplayed. The Undead and Beasts have no runes of their own yet, no outside player has played the current build, and every canvas frame still awaits Tu's approval.

## Next up

1. **Play a Mage run and judge the identity, not the synergy:** `?army=mages`; does picking a build (Vessel, Fuse or Kernel) change how the run plays, at the rune pick and in the fight (BETS unverified #3, and #1 stays open); also Tu's call on Mage balance, now above the old target, and on Vessel trailing Fuse; `DECISIONS.md` (2026-10-23, Mage runes must act on the orbs).
2. **If it comes back, do the same for the Undead and Beasts** (their runes must act on their own mechanic, BETS verified B); if not, look again before building more.
3. **Fix the rune pool's two known faults, then rebalance:** the "rarely fires" line of `npm run batch -- --offers build`, and `check:offers` failing on Rampart (Tu's call); then outlier first picks and a target for chains' share of damage; the bot's completion target waits for playtests (`DECISIONS.md`, 2026-10-17).
4. **Fix what Tu's play shows on the army screens, then get the canvas frames approved:** open calls 8 to 12 and 10b in `design/HANDOFF.md`, frames 6.1 to 6.3 and 10.0A to 11.12; redraw frame 5.3 to the built slam; draw Static's jump and Overload's volley if they do not read; look at Vessel's fourth orb place on a phone.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, trickle, threshold, one chain at a time | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Enemy targeting — normal hits lock on the Tank; three enemy groups reach the backline; slams hit anyone | batch-verified | `sim/fight.ts`, `sim/encounters.ts`, `checks/tankLock.ts` |
| Chain frequency — per-fight reset, time trickle, tougher enemies | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/runShape.ts` |
| Fatigue — per-unit, sets backfire odds and chain size | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/fatigue.ts` |
| Chain abilities — 12; each role has 3 ability options, 2 drawn per run; a backfired freeze never picks its own user | batch-verified | `sim/roles.ts`, `sim/progress.ts`, `checks/abilities.ts`, `DECISIONS.md` (2026-10-20, backfired freeze) |
| Armies in code — Undead, Beasts and Mages: a pick before round 1, every unit re-skinned | batch-verified | `sim/armies.ts`, `sim/fight.ts`, `sim/config.ts`, `checks/armies.ts`, `DECISIONS.md` (2026-10-21, 2026-10-22, 2026-10-23) |
| Mage runes — 7 runes and 2 duos in three builds (big merges, many merges, core orb), acting on the orbs; offered only in a Mages run, one of each win's three offers is always one | batch-verified, not played | `sim/cards/defs/mage.ts`, `sim/fight.ts` (`orbCapOf`), `sim/offers.ts` (`CardDef.army`, `armyOfferSlots`), `checks/armies.ts`, `DECISIONS.md` (2026-10-23, Mage runes must act on the orbs) |
| Undead and Beasts runes — runes that act on each army's own mechanic, and marks from army skills | not started | `sim/armies.ts`, `sim/cards/defs/`, `DECISIONS.md` (2026-10-23, armies feed the rune engine) |
| Undead fights — Raise, Bone Wall, Command; skeletons rise per skill hit, five at most, upgrade at the limit, soak enemy hits first | batch-verified | `sim/fight.ts` (`raiseArmySkeleton`, `skeletonWallTargetId`), `sim/config.ts` (`undead*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-21, three Undead entries) |
| Undead fight screen — warrior and shield bodies in the front row, HORDE count, rise ring, +N upgrade badge, a strike line per skeleton on Command | built | `render/fightView.ts`, `render/armyLook.ts` (`skeletonLook`), `style.css`, `design/HANDOFF.md` (12.0B) |
| Mages fights — Frost Orb, Storm Orb, Life Orb; a core orb on every mage and no plain attack, every orb works on a 2 s beat, a hit that finds the loose orbs full merges them; only a merged shot leaves a mark (Burn, Frozen, Shield) | batch-verified; Punish and Shield bash never fire for the Frost Mage | `sim/fight.ts` (`mageOrbHit`, `beatOrb`, `tickOrbs`), `sim/armies.ts` (`ARMY_UNITS`), `sim/config.ts` (`mage*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-22, 2026-10-23) |
| Mages fight screen — a core orb at each mage's left, loose orbs round the body (a fourth place above it with Vessel), a merged orb to its right that shows only for the shot, a lightning bolt per zap, a green drain line per Life orb, pointed hats | built | `render/fightView.ts` (`buildOrbs`, `updateOrbs`, `showOrbTick`, `fireBolt`), `render/armyLook.ts`, `style.css`, `design/HANDOFF.md` (12.0D) |
| Beasts fights — no skill bar per beast; one PACK bar fills, a full bar sets off a pounce (Bear Pin, Wolves Maul, Stags Tend), led by the Bear, on the pack's average fatigue | batch-verified | `sim/fight.ts` (`pounceBeasts`, `resolvePounceHit`, the pack sweep in `runFightLoop`), `sim/config.ts` (`beast*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-22, Beasts built) |
| Beasts fight screen — PACK bar under the squad, POUNCE bubble over the Bear, a jump per beast, numbers pop as each lands | built | `render/fightView.ts` (`buildPackBar`, `updatePack`, `showPounce`), `style.css`, `design/HANDOFF.md` (12.0C) |
| Army pick screen, bodies, popups and cards (canvas 10.x, 11.x) | built | `render/armyScreen.ts`, `render/armyLook.ts`, `render/fighterPopup.ts`, `render/armyCardData.ts` (made by `design/tools/gen-armies.js`), `design/HANDOFF.md` (10–11) |
| Starting squad — a plain run starts with six units, three fielded; Undead and Mages start with six, Beasts with seven and field five | batch-verified | `sim/roles.ts` (`makeStartingRoster`), `sim/armies.ts` (`makeArmyRoster`), `sim/config.ts` (`startingPerRole`, `packSlots`), `checks/squadPick.ts`, `checks/armies.ts` |
| Squad rows — the Tank in front, the rest behind, one 36px size (30px for Beasts but the Bear), FRONT and BACK words, on the round and fight screens | built | `render/fightView.ts` (`appendSquadRows`), `render/roundParts.ts` (`squadRowsHtml`), `design/HANDOFF.md` |
| Fight screen — bare arena, a fixed-size skill bubble with the charge flowing into it, thin charge bar, ⏸ and tap to pause, result overlay with best moment | built | `render/fightView.ts`, `render/bubble.ts`, `render/app.ts`, `render/pauseClock.ts`, `design/HANDOFF.md` |
| Hit lines and slam finish — a quick drawn line per hit; a slam ends on a strike beam, lunge, ring and heavy shake | built | `render/fightView.ts`, `style.css`, `design/HANDOFF.md` |
| Shield on the HP bar — segment, ghosts, break flash | built | `render/hpBar.ts`, `render/fightView.ts`, `checks/hpBar.ts` |
| Round screen — face-off, enemy badges, bench shelf, empty slot when a unit falls | built | `render/roundScreen.ts`, `render/roundParts.ts` |
| Squad screen — swap by two taps or by dragging a row; a fighter dropped on the bench leaves an empty slot | built | `render/squadScreen.ts`, `design/HANDOFF.md` (4.1) |
| Runes display — round emblem, a box with a RUNES title row and count, `+N` fold, full list stating the limit, drop step at the limit | built | `render/upgrades.ts`, `render/offerScreen.ts`, `render/roundScreen.ts`, `design/HANDOFF.md` |
| Fighter popup — switcher, skill tile, fatigue card; an ARMY tile above the skill tile for an army unit; fallen units open it from the fight only | built | `render/fighterPopup.ts` |
| Term marks and explainer cards — 11 cards, scenes generated from the canvas | built | `render/termCards.ts`, `design/tools/port-term-cards.js` |
| Win flow — the result overlay's Continue goes straight to the reward (rune pick on round 1, offers after) | built | `render/app.ts` |
| Run over screen — how close it was, best moment of the run, runes, squad | built | `render/runOverScreen.ts`, `render/fightSummary.ts` |
| Face style — fatigue eyes (hollow glowing eyes for Undead), villain eyes, ✕ eyes on a fallen unit in a fight, charge bar, guard pips at the body's side | built | `render/faces.ts`, `render/fightView.ts`, `design/tools/faces.js` |
| Skill naming — on popups, cards and the fight bubble; not on the reward pick or in `sim/` | built | `design/HANDOFF.md` (call 12) |
| Unit names — seeded draw from a pool | built | `sim/roles.ts`, `render/runSession.ts` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Card engine — hooks, cascades, depth cap; five orb hooks for the Mages | batch-verified | `sim/cards/engine.ts`, `sim/cards/types.ts`, `checks/cards.ts` |
| Rune pool (cards in code) — 34 later picks incl. 6 duos, plus the Mage-only runes above; names are one short word each | batch-verified | `sim/cards/defs/`, `checks/cardpool.ts` |
| Rune intro gate — a rune waits for its marks; a duo waits for its parts; an army rune shows only in its army's run; Vessel and Fuse shut each other out | built, `check:offers` fails on Rampart | `sim/offers.ts`, `sim/cards/index.ts`, `checks/offers.ts` |
| Rune fire rate — "rarely fires" line in the synergy block | batch-verified | `batch/synergy.ts` |
| Offer pool — 3 per win, rune weight capped, Recruit kept common, one slot for the army's own rune in an army run | batch-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Rune limit — the round 1 pick counts toward it and can be dropped | batch-verified | `sim/offers.ts`, `sim/progress.ts` (`heldCount`), `sim/config.ts` (`cardCap`) |
| Rune text — mark words coloured, offer names where a needed mark comes from | built | `render/heroPickShared.ts`, `sim/offers.ts`, `design/HANDOFF.md` |
| First picks — 5 runes, pick 1 of 3 as the round 1 reward | batch-verified | `sim/relics.ts`, `sim/cards/defs/relic.ts` |
| Opening — the army pick, then round 1, rune pick as the round 1 reward | built | `render/app.ts`, `render/armyScreen.ts`, `render/relicScreen.ts`, `render/runSession.ts`, `sim/run.ts` |
| Run export — `export` link on every screen writes the run as JSON, army included | played-verified | `render/app.ts`, `log/runLog.ts`, `checks/runLog.ts` |
| Synergy report — best runes and pairs, per-first-pick rounds | batch-verified | `batch/synergy.ts`, `batch/report.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — plain squad 26.0% run completion with the build bot (n=400, 2026-10-23); Undead 32% (n=800, 2026-10-21), Beasts 20.4% (n=800, 2026-10-22), Mages 36.1% with the orb runes (n=800, 2026-10-23) | batch-verified | `checks/runShape.ts`, `batch/cli.ts` (`--army`) |
| Real game build | not started | — |

## Bets

The four pillars, the top test, and the verified and unverified bets, in order, live in [BETS.html](BETS.html) (open it in a browser); click an unverified bet there for the few questions to answer after a run. The first-time-player questions are under `## Options sets` in `design/HANDOFF.md`.

## Open questions

- Does picking a Mage build (big merges, many merges, core orb) change how a run plays, and does Vessel's build trail Fuse's only in the bot or in play too? Answered by Tu's play, Next up #1.
- Do Static's jump, Overload's volley and Vessel's fourth orb place read on a phone with no motion of their own? Answered by Tu's play, Next up #4.
- Do the Undead's five skeletons, the Mages' orbs and the Beasts' five jumps stay readable and fair on a phone? Answered by Tu's play, Next up #4.
- Does the Exposed build still win less than Burn or Frozen, and is that its runes or a multiplier on a flat damage number? Needed for Next up #3.
- What fire rate is healthy for a rune that fires only on a moment (Heir, Vigil)? Needed for Next up #3.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom; every entry is tagged `[game]` or `[workflow]`, its header lists the dropped systems, entries below its archive rule predate the 2026-07-18 pivot, and older entries use the old rune names (the old → new table is in `design/HANDOFF.md` under 6.1).
- Decisions Tu states are logged at once via the `decision-log` skill, except one that breaks a verified bet: that is flagged to Tu first (`CLAUDE.md`, DECISION protocol). A "feels wrong" note is named and diagnosed before anything is built (`CLAUDE.md`, "When Tu says something feels wrong"). This file is regenerated at the end of a task that logged a decision, via the `state-sync` skill; `REFERENCE.md` is not.
- Branch: all current work is on `dev/merge-heroes`, which carries the armies; `main` is behind it, and merging to `main` is not decided.
- Commands: `npm run dev` to play (`?army=undead`, `?army=beasts`, `?army=mages` or `?army=none` skips the pick; the corner `export` link saves the run as JSON), `npm run check` for regressions, `npm run batch -- --n 1000 --offers build` for the bot; every dev link and batch flag is in `prototype/COMMANDS.md`. The lab (`?lab=1`) has no army, so a Mage rune is tried in a `?army=mages` run.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan, `armies.ts` the armies, `cards/` the card engine and definitions), `src/render/`, `src/batch/`, `src/checks/`, `src/log/` (the export).
- Design: canvas at https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, sources in `design/canvas/`; what is built where, the open calls and the publish recipe are in [design/HANDOFF.md](design/HANDOFF.md), which also maps the old frame numbers that `DECISIONS.md` still uses to the new ones.
