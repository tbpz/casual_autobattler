# Prototype Implementation Plan — Casual Roguelike Autobattler

> **What this file is:** a working implementation plan for the first prototype, derived from [STATE.md](STATE.md) as of 2026-07-14. Not part of the STATE/DECISIONS discipline — this is a build doc, expected to go stale as Phase 0+ progresses. Re-derive or update by hand as needed; it is not auto-synced.

## Stack

**Web / TypeScript.** Deterministic hex sim in pure TS (no deps) + PixiJS render layer (continuous MOBA-style motion skin) + plain HTML/CSS for setup/draft UI. Runs via Vite dev server, opens in any browser including mobile. Chosen for fastest iteration and easiest AI-assisted development; eventual mobile-native port is a later concern once the loop proves fun.

## Guiding constraints (from STATE.md)

1. **Sim/skin split is the architecture, not just the render.** A deterministic hex-grid **sim** (the brain) and a continuous MOBA-style **render** (the skin) are separate modules with a hard boundary — the sim never imports Pixi, the render only reads sim output. This is what makes the fight *runnable headless* for the 4-point authoring test.
2. **Determinism is a feature.** Seeded RNG + fixed tick. Same setup + same seed = byte-identical fight. This is what makes retries "same difficulty," makes attribution clean, and makes encounter-authoring testable. **First build ships with variance injectors OFF** (OQ-8 deferred) so attribution is crystal — add capped variance only once the loop feels real.
3. **The fight is make-or-break and must be readable.** Get a *watchable* fight on screen as early as possible; it's the riskiest assumption.
4. **Annihilate adds no spatial pressure — terrain + encounter authoring carry it.** So the first real content deliverable is *one encounter that passes the 4-point test*, not a pile of units.

## Provisional answers to open questions (dials to tune while playing, not decisions yet)

- **OQ-13 (retry loop):** 3 attempts **per round**; map + enemy setup fixed across retries; run ends when a round's attempts are spent.
- **OQ-6 (pre-fight depth):** pick 5 from bench, assign each to a **row (front/mid/back) × lane (left/center/right)** — coarse placement, not free hex-drop, for readability. Maybe one stance toggle later.
- **OQ-14 (curation):** hardcode a fixed bench of ~6–8 heroes for the prototype; roster-curation dial comes later.

## Phase 0 — Scaffold + the deterministic sim spine *(headless, no graphics)*

The riskiest and most valuable core. Build and test it with zero rendering.

- Vite + TypeScript project, no game framework yet. `sim/` is a pure module with no DOM/Pixi imports.
- **Hex model:** axial coords `(q, r)`, distance, neighbors, line-of-sight.
- **Map:** authored as JSON — tiles tagged `open | wall(impassable) | highground | cover`. Load one hand-authored test map.
- **Units:** `id, team, hex, role, hp, dmg, range, moveSpeed, atkSpeed`. Two roles to start: **melee tank**, **ranged archer**.
- **Tick loop:** fixed timestep → target acquisition (aggro) → hex A* pathing → move → attack → damage → death. Seeded PRNG threaded through (unused at first, but wired).
- **Output contract (the sim/skin boundary):** each run produces (a) per-tick unit **snapshots** for the render to interpolate, and (b) a structured **event log** (who hit/killed/died where) for recap + attribution.
- **Milestone:** run a fight from the CLI/console, print the event log and winner. Same seed → identical log, every time.

## Phase 1 — The render skin *(watch the fight)*

De-risk the make-or-break early.

- PixiJS layer that reads sim snapshots and **interpolates** to smooth continuous motion over an arena skin. Grid hidden by default.
- Telegraphs on demand: range rings, aggro lines, AoE footprints (fade in/out).
- Hit feedback: damage flashes, death animations, HP bars.
- Playback controls: play / pause / **step** / speed — essential for *learning* and diagnosing.
- **Milestone:** watch the Phase-0 fight play out smoothly and legibly. First gut-check on "is this readable/lively?"

## Phase 2 — The loop wrapper *(BUILD → WATCH → WIN?/LOSE → DRAFT/RETRY)*

Plain HTML/CSS screens around the fight — the actual game loop from STATE.

- **BUILD screen:** field 5 from the bench onto the row×lane grid → produces the sim's initial setup.
- **WATCH:** hand off to Phase-1 render.
- **Resolve:** on win → one **9 Kings-style draft** choice (recruit/upgrade, 3 random offers) → next round. On loss → **DIAGNOSE + RETRY**: back to BUILD with an attempt consumed; map/enemy fixed.
- **Attempt budget + run state** (per OQ-13 provisional values).
- **Milestone:** a full mini-run is playable end to end — set up, watch, lose, adjust, retry, win, draft, next round.

## Phase 3 — Author encounter #1 + attribution UI *(the real content test)*

This is where "does it feel fun/earned" actually gets tested.

- Implement 2–3 **threat primitives** from STATE's library (start with **high-ground archers behind a chokepoint** — punishes the naive deathball walking in single-file).
- Author the map as a **terrain counter-pair**: the feature the enemy exploits (choke + high ground) *and* a feature that lets the player counter (a flank path / cover approach).
- Run it through the **4-point authoring test** (deterministic sim makes this checkable): (1) name the lesson; (2) deathball loses loudly to that lesson; (3) ≥2 distinct setups win; (4) wrong setups lose readably with one dominant cause.
- **Attribution UI (OQ-7 first pass):** a post-fight recap — "your backline died first to archer volleys" — so the player can credit their own next change.
- **Milestone:** the encounter passes all 4 points in headless test *and* feels earned when played.

## Phase 4 — Playtest, tune, and answer the open questions through feel

- Play it ourselves. Tune the provisional dials (attempt count, placement depth, curation).
- Judge: can we watch → *learn* → adjust → clear, and does clearing feel earned, not brute-forced?
- Then, and only then: log resolved OQs to DECISIONS, add capped variance injectors (OQ-8), expand the threat/map library.

## Critical path & sequencing note

Phases 0→1→2 are strictly ordered (each needs the prior). **Phase 0 is the highest-leverage work** — a clean deterministic sim with a good output contract makes everything downstream cheap; a messy one poisons attribution, retries, and the authoring test simultaneously. Resist the temptation to render before the sim's event-log contract is solid.

The first genuinely-informative playtest arrives at the **end of Phase 3**, not before — a watchable fight (Phase 1) tells us about readability, but "is the *loop* fun" needs the authored encounter.
