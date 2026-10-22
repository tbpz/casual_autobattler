# State — Casual Roguelike Autobattler

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-10-22

## What this is

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- Team: 2 people (+ a friend contributing) + AI. Platform: mobile, casual audience.
- Prototype #1 is a vehicle for judging the lead moment, not the real game.

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — a run opens on one choice, the army, then a fight, and every screen after it but the round 1 rune pick is accept-default.
- **Unpredictable** — chain length is the loudest dice; per-hit variance, backfire, and the encounter draw are the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — the round screen and fighter popup name each role's skill and the enemy before the player picks who fights.

## Where it stands

A run opens on a pick between three armies, all built: the Undead raise skeletons, five at most; the Mages build orbs that work alone every 2 seconds and merge into one big shot; the Beasts fill one shared PACK bar, and a full bar sends the whole pack on one enemy at once. Merge heroes are built on the branch `dev/merge-heroes`, not merged into `main`, and are off while an army is picked. No first-time player has played any of it, and every canvas frame still awaits Tu's approval.

## Next up

1. **Play each rebuilt army:** `npm run dev` on a phone, then with the playtest friend; all three armies are ready now; send the `export` file from each play; the questions to ask are under "Options sets" in `design/HANDOFF.md`.
2. **Fix what the play shows, then get the canvas frames approved:** open calls 8 to 12 and 10b in `design/HANDOFF.md`, frames 6.1 to 6.3 and 10.0A to 11.12; redraw frame 5.3 to the built slam.
3. **Decide what happens to the merge heroes now that an army switches them off:** leave them dormant, bring them back as a late reward inside an army run, or drop the branch.
4. **Fix the rune pool's two known faults, then rebalance:** the "rarely fires" line of `npm run batch -- --offers build`, and `check:offers` failing on Rampart (Tu's call); then the Mages' 11.8% completion (Tu's call whether to retune), outlier first picks, a target for chains' share of damage, and the bot's completion target (a new player should win about 1 run in 4, `DECISIONS.md`).

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Fight mechanics — charge, trickle, threshold, one chain at a time | batch-verified | `sim/fight.ts`, `sim/config.ts` |
| Enemy targeting — normal hits lock on the Tank; three enemy groups reach the backline; slams hit anyone | batch-verified | `sim/fight.ts`, `sim/encounters.ts`, `checks/tankLock.ts` |
| Chain frequency — per-fight reset, time trickle, tougher enemies | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/runShape.ts` |
| Fatigue — per-unit, sets backfire odds and chain size | batch-verified | `sim/roster.ts`, `sim/config.ts`, `checks/fatigue.ts` |
| Chain abilities — 12; each role has 3 ability options, 2 drawn per run; a backfired freeze never picks its own user | batch-verified | `sim/roles.ts`, `sim/progress.ts`, `checks/abilities.ts`, `DECISIONS.md` (2026-10-20, backfired freeze) |
| Armies in code — Undead, Beasts and Mages: a pick before round 1, every unit re-skinned | batch-verified | `sim/armies.ts`, `sim/fight.ts`, `sim/config.ts`, `checks/armies.ts`, `DECISIONS.md` (2026-10-21, 2026-10-22) |
| Undead fights — Raise, Bone Wall, Command; skeletons rise per skill hit, five at most, upgrade at the limit, soak enemy hits first | batch-verified | `sim/fight.ts` (`raiseArmySkeleton`, `skeletonWallTargetId`), `sim/config.ts` (`undead*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-21, three Undead entries) |
| Undead fight screen — warrior and shield bodies in the front row, HORDE count, rise ring, +N upgrade badge, a strike line per skeleton on Command | built | `render/fightView.ts`, `render/armyLook.ts` (`skeletonLook`), `style.css`, `design/HANDOFF.md` (12.0B) |
| Mages fights — Frost Orb, Storm Orb, Life Orb; orbs add per skill hit, work on a 2 s beat, a hit that finds three out merges them into one shot and they start again, orbs left at a skill's end stay | batch-verified | `sim/fight.ts` (`mageOrbHit`, `tickOrbs`), `sim/config.ts` (`mage*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-22, two entries) |
| Mages fight screen — orbs round the body, a merged orb that shows only for the shot, a lightning bolt per zap, pointed hats | built | `render/fightView.ts` (`buildOrbs`, `updateOrbs`, `fireBolt`), `render/armyLook.ts`, `style.css`, `design/HANDOFF.md` (12.0D) |
| Beasts fights — no skill bar per beast; one PACK bar fills, a full bar sets off a pounce (Bear Pin, Wolves Maul, Stags Tend), led by the Bear, on the pack's average fatigue | batch-verified | `sim/fight.ts` (`pounceBeasts`, `resolvePounceHit`, the pack sweep in `runFightLoop`), `sim/config.ts` (`beast*`), `checks/armies.ts`, `DECISIONS.md` (2026-10-22, Beasts built) |
| Beasts fight screen — PACK bar under the squad, POUNCE bubble over the Bear, a jump per beast, numbers pop as each lands | built | `render/fightView.ts` (`buildPackBar`, `updatePack`, `showPounce`), `style.css`, `design/HANDOFF.md` (12.0C) |
| Army pick screen, bodies, popups and cards (canvas 10.x, 11.x) | built | `render/armyScreen.ts`, `render/armyLook.ts`, `render/fighterPopup.ts`, `render/armyCardData.ts` (made by `design/tools/gen-armies.js`), `design/HANDOFF.md` (10–11) |
| Starting squad — a plain run starts with six units, three fielded; Undead and Mages start with six, Beasts with seven and field five | batch-verified | `sim/roles.ts` (`makeStartingRoster`), `sim/armies.ts` (`makeArmyRoster`), `sim/config.ts` (`startingPerRole`, `packSlots`), `checks/squadPick.ts`, `checks/armies.ts` |
| Squad rows — the Tank in front (a hero with two or more Tank pieces too), the rest behind, one 36px size (30px for Beasts but the Bear), FRONT and BACK words, on the round and fight screens | built | `render/fightView.ts` (`appendSquadRows`), `render/roundParts.ts` (`squadRowsHtml`), `design/HANDOFF.md` |
| Fight screen — bare arena, a fixed-size skill bubble with the charge flowing into it, thin charge bar, ⏸ and tap to pause, result overlay with best moment | built | `render/fightView.ts`, `render/bubble.ts`, `render/app.ts`, `render/pauseClock.ts`, `design/HANDOFF.md` |
| Hit lines and slam finish — a quick drawn line per hit; a slam ends on a strike beam, lunge, ring and heavy shake | built | `render/fightView.ts`, `style.css`, `design/HANDOFF.md` |
| Shield on the HP bar — segment, ghosts, break flash | built | `render/hpBar.ts`, `render/fightView.ts`, `checks/hpBar.ts` |
| Round screen — face-off, enemy badges, bench shelf, empty slot when a unit falls | built | `render/roundScreen.ts`, `render/roundParts.ts` |
| Squad screen — swap by two taps or by dragging a row; a fighter dropped on the bench leaves an empty slot | built | `render/squadScreen.ts`, `design/HANDOFF.md` (4.1) |
| Runes display — round emblem, a box with a RUNES title row and count, `+N` fold, full list stating the limit, drop step at the limit | built | `render/upgrades.ts`, `render/offerScreen.ts`, `render/roundScreen.ts`, `design/HANDOFF.md` |
| Fighter popup — switcher, skill tile, fatigue card; an ARMY tile above the skill tile for an army unit; fallen units open it from the fight only | built | `render/fighterPopup.ts` |
| Term marks and explainer cards — 11 cards, scenes generated from the canvas | built | `render/termCards.ts`, `design/tools/port-term-cards.js` |
| Win flow — the result overlay's Continue goes straight to the reward (rune pick on round 1, merge pick after a mini-boss in a plain run, offers after) | built | `render/app.ts` |
| Run over screen — how close it was, best moment of the run, runes, squad | built | `render/runOverScreen.ts`, `render/fightSummary.ts` |
| Face style — fatigue eyes (hollow glowing eyes for Undead), villain eyes, ✕ eyes on a fallen unit in a fight, charge bar, guard pips at the body's side | built | `render/faces.ts`, `render/fightView.ts`, `design/tools/faces.js` |
| Skill naming — on popups, cards and the fight bubble; not on the reward pick or in `sim/` | built | `design/HANDOFF.md` (call 12) |
| Unit names — seeded draw from a pool | built | `sim/roles.ts`, `render/runSession.ts` |
| Marks — each chain ability leaves one | batch-verified | `sim/fight.ts`, `checks/marks.ts` |
| Card engine — hooks, cascades, depth cap | batch-verified | `sim/cards/engine.ts`, `checks/cards.ts` |
| Rune pool (cards in code) — 34 later picks incl. 6 duos; names are one short word each | batch-verified | `sim/cards/defs/`, `checks/cardpool.ts` |
| Rune intro gate — a rune waits for its marks; a duo waits for its parts | built, `check:offers` fails on Rampart | `sim/offers.ts`, `sim/cards/index.ts`, `checks/offers.ts` |
| Rune fire rate — "rarely fires" line in the synergy block | batch-verified | `batch/synergy.ts` |
| Offer pool — 3 per win, rune weight capped, Recruit kept common | batch-verified | `sim/offers.ts`, `render/offerScreen.ts` |
| Rune limit — the round 1 pick counts toward it and can be dropped | batch-verified | `sim/offers.ts`, `sim/progress.ts` (`heldCount`), `sim/config.ts` (`cardCap`) |
| Rune text — mark words coloured, offer names where a needed mark comes from | built | `render/heroPickShared.ts`, `sim/offers.ts`, `design/HANDOFF.md` |
| First picks — 5 runes, pick 1 of 3 as the round 1 reward | batch-verified | `sim/relics.ts`, `sim/cards/defs/relic.ts` |
| Opening — the army pick, then round 1, rune pick as the round 1 reward | built | `render/app.ts`, `render/armyScreen.ts`, `render/relicScreen.ts`, `render/runSession.ts`, `sim/run.ts` |
| Run export — `export` link on every screen writes the run as JSON, army included | played-verified | `render/app.ts`, `log/runLog.ts`, `checks/runLog.ts` |
| Synergy report — best runes and pairs, per-first-pick rounds, merge-hero lines | batch-verified | `batch/synergy.ts`, `batch/report.ts` |
| Rest card — cuts one unit's fatigue | batch-verified | `sim/offers.ts`, `checks/fatigue.ts` |
| Offer safety net — a revive/recruit/Rest when the roster has no cushion | batch-verified | `sim/offers.ts` |
| 20-round plan — mini-bosses at 7/14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Enemy shapes — the encounter pool | batch-verified | `sim/encounters.ts` |
| Difficulty — plain squad 25.5% run completion with the build bot (n=3000, 2026-10-17); Undead 32% (n=800, 2026-10-21), Beasts 20.4% with the pounce and Mages 11.8% (n=800, 2026-10-22) | batch-verified | `checks/runShape.ts`, `batch/cli.ts` (`--army`) |
| Merge heroes — a mini-boss win offers three units into one of ten heroes; built, off while an army is picked | built on branch `dev/merge-heroes`, not merged; `check:heroes` passes | `sim/heroes.ts`, `sim/fight.ts`, `render/mergeScreen.ts`, `render/heroLook.ts`, `design/HANDOFF.md` (8–9), `DECISIONS.md` (2026-10-20) |
| Real game build | not started | — |

## Unverified bets

- Chains every fight still feel unpredictable, rather than averaging out into a steady trade.
- Push or rest stays a real choice, and players bench a tired hero by hand and notice the bench shelf.
- An army picked before the first fight gives a run an identity a new player feels from fight 1, and runes, first picks and duos add a goal worth chasing.
- A cascade stays readable on a phone screen, and skeletons, a pack pounce and orbs make each army fight differently from the plain squad.
- A first-time player finds the underlined terms, the stat icons and the enemy badges, taps a fighter to pause and open its popup, reads the eyes as fatigue, enemy and fallen, links a skill to its unit from the bubble, reads the squad as a front row and a back row, and sees a slam as the biggest hit, without being told.

## Open questions

- Does the face-off round screen let a first-time player say who fights whom and what each side can do, does the fight's bubble name who did what, and does an empty slot that blocks Fight break accept-default? Answered by Next up #1.
- Does an army chosen before the first fight give a run an identity a first-time player feels, and does the round 1 rune pick still belong after it? Answered by Next up #1.
- Do the Undead's five skeletons, the Mages' orbs and the Beasts' five jumps stay readable and fair on a phone (the merged orb beside a neighbour's body, the bolts, the pounce numbers, the one bubble over the Bear), and do the old runes read right with skills that leave no mark? Answered by Next up #1.
- Does the Exposed build still win less than Burn or Frozen, and is that its runes or a multiplier on a flat damage number? Needed for Next up #4.
- What fire rate is healthy for a rune that fires only on a moment (Heir, Vigil)? Needed for Next up #4.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the game's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**, never top-to-bottom; entries below its archive rule predate the 2026-07-18 pivot, and older entries use the old rune names (the old → new table is in `design/HANDOFF.md` under 6.1).
- Decisions are proposed, never silently logged — on a confirmed yes, append via the `decision-log` skill.
- This file is regenerated only when asked, via the `state-sync` skill; `REFERENCE.md` is not.
- Commands: `npm run dev` to play (`?army=undead`, `?army=beasts`, `?army=mages` or `?army=none` skips the pick; the corner `export` link saves the run as JSON), `npm run check` for regressions, `npm run batch -- --n 1000 --offers build` for the bot; every dev link and batch flag is in `prototype/COMMANDS.md`.
- Code: `prototype/src/sim/` (`config.ts` holds every tunable, `rounds.ts` the round plan, `armies.ts` the armies, `heroes.ts` the merge heroes, `cards/` the card engine and definitions), `src/render/`, `src/batch/`, `src/checks/`, `src/log/` (the export).
- Design: canvas at https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, sources in `design/canvas/`; what is built where, the open calls and the publish recipe are in [design/HANDOFF.md](design/HANDOFF.md), which also maps the old frame numbers that `DECISIONS.md` still uses to the new ones.
