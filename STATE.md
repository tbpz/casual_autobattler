# State — Tu's masterpiece search

> **What this file is:** where the project stands right now, and what to do next. Present tense only.
> **Read this first** in every session. Layer 1 ends at the rule — that's the 60-second read. Layer 2 is the working index.
> **Last synced:** 2026-11-07

## What this is

The search for what Tu's masterpiece game looks like, made for Tu first.

- Tu is the only player whose feeling counts for now; others come later.
- Fixed base, not bets: a mobile game, simple and relaxing for a tired evening yet still pulling Tu back; `BETS.html` Setup lists which games are fun only and which are his masterpieces.
- Directions are tested with small throwaway sketches, each played once; the roguelike autobattler prototype is kept but not built on.
- Done means Tu finishes a sitting and comes back for another, evening after evening (`BETS.html`, Objective).

## What we're betting on

> **"I can see a place I can't reach yet, and I want to find the way there."**

- **Map discovery** pulls Tu to finish a sitting, and **a find is worth having when it changes how he moves**: both verified.
- **The bet now being tested:** a find is fun when using it needs an idea Tu didn't have before, a "that's smart" moment. Map 8 is the last of its three tries.
- **Where "smart" comes from, from Tu's own Zelda moments:** the world works by rules he can guess from what he sees, and he tests the guess (DECISIONS 2026-11-07).
- **Coming back** needs real new things left to find; a bigger map or more moves runs out, and the goal for now is at least 5 sittings.

## Where it stands

Tu played map sketch 8 once: one smart moment, but he got stuck and it felt unfair, so that sitting does not count as the third try. The cause was found in the code and fixed: one height rule now holds for everyone, anything that is up looks up the same way, and the old wreck reads as a wooden boat. The fixed map 8 is checked and on the sketch page, waiting for Tu's replay. Its world rules stay hidden from Tu until he has played the fixed version.

## Next up

1. **Tu replays map 8 once on his phone, to the end**, then answers the three questions in the first fold of `BETS.html`.
2. **Log the result**, and only then write down map 8's hidden rules in DECISIONS; the bet passes, or is dropped as its third try.
3. **Pick how "less to keep in my head" is tested** with a sketch or a game Tu plays.

---

## Status by piece

| Piece | State | Where it lives |
|---|---|---|
| Map sketches 1 to 3 | played-verified (map bet passed on 1; all plain) | `sketches/map-1/` to `sketches/map-3/` |
| Map sketch 4 | batch-verified, never played | `sketches/map-4/index.html` |
| Map sketch 5 | played-verified (moves bet passed; still plain) | `sketches/map-5/index.html` |
| Map sketch 6 | played; idea bet try 1, not a fair test | `sketches/map-6/index.html` |
| Map sketch 7 | played; idea bet try 2, plain and easy | `sketches/map-7/index.html`, `sketches/map-7/looks.html` |
| Map sketch 8 | played once, not a fair test; fixed, batch-verified, waiting for replay | `sketches/map-8/index.html` |
| The prototype as a whole: not built on, kept as it is | built | `prototype/`, `prototype/COMMANDS.md` |

## Bets

The objective, the setup, the three pillars, the verified list, the bets in test order, the tuning targets and the parked lines live in [BETS.html](BETS.html) (open it in a browser); click a line there for the few questions to answer afterwards.

## Open questions

- What sketch or game can test "less to keep in my head"? Needed for Next up #3.

## How to work here

- Read order: this file → [REFERENCE.md](REFERENCE.md) for the prototype's shape (stale on the core loop) → [DECISIONS.md](DECISIONS.md) **by grep only**; every entry is tagged `[game]` or `[workflow]`, its header lists the dropped systems, and entries below its archive rule predate the 2026-07-18 pivot.
- Decisions Tu states are logged at once via the `decision-log` skill, except one that breaks a verified bet: that is flagged to Tu first (`CLAUDE.md`, DECISION protocol). A "feels wrong" note is named and diagnosed before anything is built.
- A sketch is one self-contained `index.html` under `sketches/`, published to the one sketch page (`CLAUDE.md`, "Publishing sketches"). Map 8's check: `node sketches/map-8/check-map8.js sketches/map-8/index.html`.
- Never show a puzzle's answer before Tu plays it: map 8's rules block, `check-map8.js` and the map 8 plan name its answers, so nothing from them goes into chat, STATE or DECISIONS until he has played the fixed version.
- This file is regenerated at the end of a task that logged a decision, via the `state-sync` skill; `REFERENCE.md` is not.
- Branch: all work is on `dev/merge-heroes`; `main` is behind it, and merging to `main` is not decided. The prototype still runs (`npm run dev`, `npm run check`; links in `prototype/COMMANDS.md`); canvas: https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny, recipe in [design/HANDOFF.md](design/HANDOFF.md).
