# State — Tu's masterpiece search

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-11-10

## What this is

The search for what Tu's masterpiece game looks like, made for Tu first.

- Tu is the only player whose feeling counts for now; others come later.
- Fixed base, not bets: a mobile game, simple and relaxing for a tired evening yet still pulling Tu back; `BETS.html` Setup lists which games are fun only and which are his masterpieces.
- Directions are tested with small throwaway sketches, each played once; the roguelike autobattler prototype is kept but not built on.
- Done means Tu finishes a sitting and comes back for another, evening after evening (`BETS.html`, Objective).

## What we're betting on

> **"I can see a place I can't reach yet, and I want to find the way there."**

- Three map bets are verified: map discovery pulls Tu to finish a sitting, a find is worth having when it changes how he moves, and a find is fun when using it needs a new idea.
- The new idea comes from the world working by rules Tu can guess from what he sees, then test (DECISIONS 2026-11-07 and 2026-11-10).
- **Coming back** is tested as five different maps, one per evening, about 10 minutes each; creatures Tu catches follow him and come along to the next map.
- Each evening must also give a "that's smart" moment; every rare find needs two things used together.

## Where it stands

Tu played map 1 of the evenings sketch once: new things and he wanted the next map, but no "that's smart" moment. Map 1 is reworked with a new layout and new puzzles, checked, and on the sketch page; Tu's old map 1 save is cleared. Its new rules stay hidden from Tu until he has played it. Map 2 is built only after Tu has played the new map 1.

## Next up

1. **Tu plays the new map 1 one evening, to the end**, on his phone, then answers the questions in the first tuning fold of `BETS.html`.
2. **Log the result**, then write down the new map 1's hidden rules in DECISIONS.
3. **Build map 2** with a new world thing, bringing Tu's followers along.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Map sketches 1 to 3 | played-verified (map bet passed on 1; all plain) | `sketches/map-1/` to `sketches/map-3/` |
| Map sketch 4 | batch-verified, never played | `sketches/map-4/index.html` |
| Map sketch 5 | played-verified (moves bet passed; still plain) | `sketches/map-5/index.html` |
| Map sketches 6 and 7 | played; idea bet tries 1 and 2, not passes | `sketches/map-6/`, `sketches/map-7/` |
| Map sketch 8 | played-verified (idea bet passed; a little plain) | `sketches/map-8/index.html` |
| Evenings sketch, map 1 (reworked) | batch-verified, browser-checked, not played | `sketches/evenings/index.html` |
| Evenings sketch, maps 2 to 5 | not started | — |
| The prototype as a whole: not built on, kept as it is | built | `prototype/`, `prototype/COMMANDS.md` |

## Bets

The objective, the setup, the three pillars, the verified list, the bets in test order, the tuning targets and the parked lines live in [BETS.html](BETS.html) (open it in a browser); click a line there for the few questions to answer afterwards.

## Open questions

- What sketch or game can test "less to keep in my head"? Waits until the evenings sketch is played.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the prototype's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**; every entry is tagged `[game]` or `[workflow]`, its header lists the dropped systems, and entries below its archive rule predate the 2026-07-18 pivot.
- Decisions Tu states are logged at once via the `decision-log` skill, except one that breaks a verified bet: that is flagged to Tu first (`CLAUDE.md`, DECISION protocol). A "feels wrong" note is named and diagnosed before anything is built.
- A sketch is one self-contained `index.html` under `sketches/`, published to the one sketch page (`CLAUDE.md`, "Publishing sketches"). The evenings check: `node sketches/evenings/check-evenings.js sketches/evenings/index.html` (about 25 s).
- The evenings sketch keeps one save for all its maps, so a republish keeps Tu's followers; each new map goes into the same file, and bumping `MAP_VER` clears that map's save.
- Never show a puzzle's answer before Tu plays it: a sketch's rules block and its check script stay out of chat, STATE and DECISIONS until he has played.
- Branch: all work is on `dev/merge-heroes`; `main` is behind it, and merging to `main` is not decided. The prototype still runs (`npm run dev`, `npm run check`; links in `prototype/COMMANDS.md`); canvas: https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, recipe in [design/HANDOFF.md](design/HANDOFF.md).
