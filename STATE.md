# State — Tu's masterpiece search

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-11-02

## What this is

The search for what Tu's masterpiece game looks like, made for Tu first.

- Tu is the only player whose feeling counts for now; others come later.
- Fixed base, not bets: a mobile game, simple and relaxing for a tired evening yet still pulling Tu back (`BETS.html`, Setup).
- The roguelike autobattler prototype is one sketch toward it; Tu has had enough of it, and it is no longer built on.
- Done means Tu finishes a sitting and comes back for another, evening after evening (`BETS.html`, Objective).

## What we're betting on

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Lasting progress** — something carries from one sitting to the next; what it is is not settled.
- **Unpredictable** — the size of a chain is the biggest surprise; how hard each hit lands, backfire and which enemies show up add the rest.
- **Losable** — a run can genuinely be lost, and a backfire can create a losing position outright.
- **Attributable** — a rune combo the player built is the strongest source of "mine".

## Where it stands

Bets are tested through the games Tu already plays, or small new sketches, not through the prototype. Whether the game has runs is settled as not mattering: Tu likes games with and without runs, and runs are not what keep him in one. What does keep him is still open; lasting progress toward a goal that keeps counting is the closest lead. Five bets wait in `BETS.html`, two more are parked until the game has runs, and the three tuning targets wait with the prototype.

## Next up

1. **Settle what lasting thing carries from one sitting to the next**, keeping in mind that Tu quits when progress he worked for stops counting.
2. **Pick how "less to keep in my head" is tested now:** its "Fair test when" line still needs a prototype dev link, so it needs one that uses a game Tu plays or a small sketch.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| The prototype as a whole — not built on, kept as it is | built | `prototype/`, `prototype/COMMANDS.md` |
| Fight engine — charge, chains, fatigue, marks, chain abilities, enemy targeting | batch-verified | `sim/fight.ts`, `sim/config.ts`, `sim/roles.ts`, `checks/` |
| Armies — Undead, Beasts, Mages, each fighting its own way | batch-verified | `sim/armies.ts`, `checks/armies.ts` |
| Runes — the shared pool, Mage-only runes in three builds, offers and the rune limit | batch-verified; Mage payoff runes not played | `sim/cards/`, `sim/offers.ts`, `CHEATSHEET.md` |
| Run shape — 20 rounds, mini-bosses at 7 and 14, boss at 20 | batch-verified | `sim/rounds.ts`, `checks/runShape.ts` |
| Screens — fight, round, squad, rewards, army pick, popups, run over | built; several canvas frames await Tu's approval | `render/`, `design/HANDOFF.md` |
| `check:offers` fails on Rampart | blocked | `checks/offers.ts` |
| Run export — the `export` link saves a run as JSON | played-verified | `log/runLog.ts` |
| Bot batch and difficulty numbers | batch-verified | `batch/`, `checks/runShape.ts` |
| Lasting progress between sittings | not started | `BETS.html` (Verified, C) |

## Bets

The objective, the three pillars, the verified list, the bets in test order, the tuning targets in work order, and the parked pillar D lines live in [BETS.html](BETS.html) (open it in a browser); click a line there for the few questions to answer afterwards.

## Open questions

- What lasting thing carries from one sitting to the next? Needed for Next up #1.
- What game or sketch can test "less to keep in my head"? Needed for Next up #2.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the prototype's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**; every entry is tagged `[game]` or `[workflow]`, its header lists the dropped systems, and entries below its archive rule predate the 2026-07-18 pivot.
- Decisions Tu states are logged at once via the `decision-log` skill, except one that breaks a verified bet: that is flagged to Tu first (`CLAUDE.md`, DECISION protocol). A "feels wrong" note is named and diagnosed before anything is built.
- This file is regenerated at the end of a task that logged a decision, via the `state-sync` skill; `REFERENCE.md` is not.
- Branch: all prototype work is on `dev/merge-heroes`; `main` is behind it, and merging to `main` is not decided.
- The prototype still runs for reference: `npm run dev` to play, `npm run check` for regressions, `npm run batch` for the bot; every dev link and flag is in `prototype/COMMANDS.md`.
- Design: canvas at https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, sources in `design/canvas/`, open calls and the publish recipe in [design/HANDOFF.md](design/HANDOFF.md).
