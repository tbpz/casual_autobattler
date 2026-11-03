# State — Tu's masterpiece search

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-11-03

## What this is

The search for what Tu's masterpiece game looks like, made for Tu first.

- Tu is the only player whose feeling counts for now; others come later.
- Fixed base, not bets: a mobile game, simple and relaxing for a tired evening yet still pulling Tu back; `BETS.html` Setup lists which games are fun only and which are his masterpieces.
- Directions are tested with small throwaway sketches, each played once; the roguelike autobattler prototype is kept but not built on.
- Done means Tu finishes a sitting and comes back for another, evening after evening (`BETS.html`, Objective).

## What we're betting on

> **"I can see a place I can't reach yet, and I want to find the way there."**

- **Real new things to find** keep Tu in a game; he stops when they run out, and harder difficulty doesn't bring him back.
- **Map discovery** is the reason he names most for his masterpieces (Hollow Knight, Zelda, Pokemon, Diablo 2).
- **The fight moment** makes a sitting fun but does not bring him back the next evening.

## Where it stands

The map bet is on a one-off 4th try, its last. Map sketch 4 is built, checked with numbers and published, and waits for Tu's one play. It aims at the Pokemon and Hollow Knight moment: a wall you meet long before its helper, and rare ones you track down by their trails.

## Next up

1. **Play map sketch 4 to the end, once, on the phone:** https://claude.ai/artifact/MFarQqFKSrJqLZrbStvCeF. Then answer bet #1's questions in `BETS.html`.
2. **Pick the next sketch from the answer:** grow the map sketch if it passes; if it fails, drop the bet and try builds to unlock (the bet's other way).
3. **Pick how "less to keep in my head" is tested** with a sketch or a game Tu plays.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Map sketch 1 | played-verified (too plain; try 1) | `sketches/map-1/index.html` |
| Map sketch 2 | played-verified (less plain, still no pull; try 2) | `sketches/map-2/index.html` |
| Map sketch 3 | played-verified (better, still plain; try 3) | `sketches/map-3/index.html` |
| Map sketch 4 | batch-verified, not played (try 4, the last) | `sketches/map-4/index.html`, phone link in Next up |
| The prototype as a whole: not built on, kept as it is | built | `prototype/`, `prototype/COMMANDS.md` |

## Bets

The objective, the setup, the three pillars, the verified list, the bets in test order, the tuning targets and the parked lines live in [BETS.html](BETS.html) (open it in a browser); click a line there for the few questions to answer afterwards.

## Open questions

- What sketch or game can test "less to keep in my head"? Needed for Next up #3.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the prototype's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**; every entry is tagged `[game]` or `[workflow]`, its header lists the dropped systems, and entries below its archive rule predate the 2026-07-18 pivot.
- Decisions Tu states are logged at once via the `decision-log` skill, except one that breaks a verified bet: that is flagged to Tu first (`CLAUDE.md`, DECISION protocol). A "feels wrong" note is named and diagnosed before anything is built.
- A sketch is one self-contained `index.html` under `sketches/`, published to the one sketch page (`CLAUDE.md`, "Publishing sketches"). Check a map before Tu plays: `node sketches/map-4/check-map4.js <sketch html>`.
- This file is regenerated at the end of a task that logged a decision, via the `state-sync` skill; `REFERENCE.md` is not.
- Branch: all work is on `dev/merge-heroes`; `main` is behind it, and merging to `main` is not decided.
- The prototype still runs: `npm run dev` to play, `npm run check` for regressions; every dev link and flag is in `prototype/COMMANDS.md`. Canvas: https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, recipe in [design/HANDOFF.md](design/HANDOFF.md).
