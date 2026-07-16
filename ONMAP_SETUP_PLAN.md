# Implementation Plan — On-Map Setup + Risk/Reward Elevation

> **What this file is:** a working implementation plan for the two decisions logged **2026-07-15** in [DECISIONS.md](DECISIONS.md):
> 1. *OQ-6 (form) — pre-fight setup is on-map placement into an authored bounded deploy zone.*
> 2. *Elevation is intrinsically risk/reward, not pure upside.*
>
> Like `PROTOTYPE_PLAN.md`, this is a **build doc, not part of the STATE/DECISIONS discipline** — expected to go stale as it's built. Derived from the code as it stands today (headless deterministic sim + Pixi render + plain-HTML loop wrapper).

---

## The idea in one paragraph

Today the player sets up on a **separate dropdown screen** (`main.ts:45` `renderBuildScreen`) that shows no map — they pick a hero for each authored slot (`rounds.ts:27` `ENCOUNTER_1_SLOTS`) blind to the terrain, then see the battlefield only once the fight starts. We're collapsing setup and battlefield into **one screen**: the player sees the map (with the enemy squad already placed for reading), and **drag-places** their fielded heroes onto **any legal hex inside an authored, bounded deployment zone**. Simultaneously, high ground stops being pure upside — a unit standing on it reaches further **but takes more incoming damage**, so occupying it is a bet.

## Constraints carried from this session (do not violate)

- **One screen.** Setup happens on the battle map; the enemy squad is shown in place so the player reads the board while placing.
- **Free placement within a bounded zone.** Not dropdowns, not coarse row×lane, not free-place-anywhere. Legal hexes = an **authored per-round deploy zone**, excluding walls, the enemy side, and (by default) enemy-held high ground.
- **The deploy zone is the balancing knob.** Its size/shape is authored per encounter and is a prototype tuning dial — it governs elevation access, dominant-option avoidance, and how much placement can carry vs. the draft.
- **Elevation self-balances.** +reach **and** +exposure. Parameter values are a dial, not fixed here. Never a global "can't stand here" rule.
- **Watch-only ⇒ legibility.** The exposure cost must be visible at placement time (telegraph) and readable in outcome (bigger damage numbers / recap). No hidden math.
- **Determinism preserved.** Placement only produces each unit's `startHex`; the sim stays a pure function of `(map, units, seed)` (`engine.ts:42`). No wall-clock, no new RNG.
- **Sim/skin split preserved.** Pixel space lives only in the render layer (`hexLayout.ts`). Deploy-zone legality is game/sim-layer data (hexes), never pixels.

---

## Data-model changes (game layer)

**`rounds.ts` — replace authored slots with an authored deploy zone + field size.**

- `RoundDef.playerSlots: DeploymentSlot[]` → **`deployZone: readonly Hex[]`** (the legal placement hexes) + **`fieldSize: number`** (how many heroes to place; currently 5).
- Delete `DeploymentSlot`, `ENCOUNTER_1_SLOTS`, `LEGACY_SLOTS`.
- Add an authoring helper so zones aren't hand-typed hex-by-hex, e.g. `deployZoneFromCols(map, minCol, maxCol, { excludeHighground: true })` — enumerate map tiles in the column range, drop walls/highground/out-of-bounds, return the hex list. Zones can then be tuned by changing a column bound.
- **The Overlook** zone = the player side west of the col-4 wall belt (cols 0–3, passable, non-highground). This *is* the expressiveness we wanted: the flank gap (row 0) and the center lanes are all in-zone, so the player can freely choose to seed an archer at the flank-gap mouth to sneak it toward the high ground — a counter the old row×lane slots couldn't express.
- **Round 2 (legacy map)** gets an equivalent left-side zone.

**`runController.ts` — replace slot assignment with hex placement.**

- `assignment: Record<slotId, heroId|null>` → **`placements: Record<heroId, Hex>`** (a fielded hero and where they stand). Unplaced/benched heroes simply aren't keys.
- `assign(slotId, heroId)` → **`placeHero(heroId, hex)`** / **`unplaceHero(heroId)`**. `placeHero` validates: hex ∈ `deployZone`, hex not already occupied by another placement, and `#placed < fieldSize` (or it's a move of an already-placed hero). Placing onto an occupied hex = swap (keep the existing swap-friendly UX from `assign`, `runController.ts:57`).
- `canStartFight()` → `Object.keys(placements).length === round.fieldSize` (legality/distinctness already guaranteed by `placeHero`).
- `buildPlayerRoster()` (`runController.ts:78`) → map each `[heroId, hex]` to `effectiveUnitDef(hero, "player", hex)` instead of reading `slot.hex`.
- **Retry** already returns to BUILD keeping prior state (`retry()`, `runController.ts:115`); keep the previous placement so the player *moves* pieces rather than re-placing all five. (Optional, low-priority: render a faint **ghost of the previous attempt's placement** — noted in the OQ-6 decision as a not-committed attribution aid.)

---

## Sim change — risk/reward elevation

**`combat.ts` — add the exposure side of high ground.**

- Keep `effectiveRange` / `HIGHGROUND_RANGE_BONUS` (`combat.ts:27`) as the *reach* upside.
- Add the *downside*: `export function incomingDamageMultiplier(target: UnitState, map: GameMap): number` → `1 + HIGHGROUND_EXPOSURE` when `target` stands on `highground`, else `1`. Start `HIGHGROUND_EXPOSURE = 0.25` (a tunable const; value is a dial).

**`engine.ts` — apply it at the single damage site (`engine.ts:109`).**

- `const dealt = Math.round(damage * incomingDamageMultiplier(target, map));` then `target.hp = Math.max(0, target.hp - dealt)` and report `dealt` in the `attack` event. `Math.round` keeps it deterministic; the event already drives the on-body `-N` tracer (`arenaRenderer.ts:170`), so exposure shows up as visibly bigger hits on elevated units — legibility for free.
- Net effect on high ground: **+1 range, +25% damage taken.** A glass-cannon tile: seize it for reach, pay for it in fragility. Self-balancing on every map, no per-map authoring needed.
- **Alternatives if +damage-taken feels wrong in play** (don't build yet, just noting the design space): "no cover on highground" (LOS-based) or "targetable from further" — both are more code and less legible; damage-taken is the cheapest legible first cut.

**Tests:** a headless sim test — identical units, one on highground, assert it dies faster to the same attacker; and assert same-seed determinism still holds byte-for-byte.

---

## Render change — the setup stage (the big chunk)

Today `ArenaRenderer` (`arenaRenderer.ts`) draws the map + plays back sim snapshots. Setup needs the *same map* plus interaction. Plan:

**1. Extract shared map drawing.** Pull `drawMap` (`arenaRenderer.ts:94`) and `centerCamera` (`:107`) into reusable form (free functions in `hexLayout.ts` or a small `mapView` helper) so both the playback renderer and the new setup renderer share one source of truth for tile geometry/camera.

**2. New `render/setupStage.ts`.** Composes the shared map view and adds:
- **Enemy preview:** draw `round.enemyRoster` units statically at their `startHex` (reuse the body-drawing style from `arenaRenderer.ts:154` `drawBody`) so the player reads the board they're countering. Static, non-interactive.
- **Deploy-zone highlight:** tint/outline every hex in `round.deployZone` (a legal-drop overlay layer). This is the visible answer to the user's original complaint — the player now *sees* where they can place.
- **Bench tray:** a strip of draggable tokens for benched heroes not yet placed (HTML alongside the canvas, or a Pixi container docked at the edge — HTML tray is simpler and mobile-friendly).
- **Placement tokens:** draggable player tokens on the board for placed heroes.

**3. Pointer interaction (Pixi federated events, touch-capable).**
- Add **`pixelToAxial(point)`** to `hexLayout.ts` — the inverse of `axialToPixel` (`hexLayout.ts:14`) followed by hex rounding. `hexRound` already exists in `hex.ts:78` but is private → **export it** and reuse (don't reimplement rounding).
- On drag-end: convert pointer → world coords (**subtract `world.position`**, `arenaRenderer.ts:117`; no scale today) → `pixelToAxial` → snap. If the snapped hex ∈ deploy zone and unoccupied, call `controller.placeHero`; else reject (snap back, brief invalid flash). Dragging a placed token off the board / back to the tray = `unplaceHero`.
- Live feedback while dragging: highlight the hovered legal hex green / illegal red.

**4. Fight gate:** enable the Fight button on `controller.canStartFight()` (all `fieldSize` placed).

**Mobile note:** `HEX_SIZE=34` → ~68px hexes, tokens ~27px radius. Fine for touch, but verify tap-drag on a real device during playtest; Pixi's federated pointer events cover mouse+touch uniformly.

---

## Wiring — `main.ts`

- Replace `renderBuildScreen` (`main.ts:45`) entirely: mount `setupStage` into `#app`, hand it the controller + current round; it renders the map, enemy preview, zone, tray, and tokens, and calls `controller.placeHero/unplaceHero` on drag. Keep the briefing text + attempts counter as an overlay (`main.ts:64-72`).
- WATCH (`main.ts:90`) and RESULT (`main.ts:157`) screens are unchanged. On "Fight!", `controller.runFight()` reads placements → sim, same as today.
- Delete the per-slot `<select>` handlers (`main.ts:75`).

## Content + checks

- **Author deploy zones** for both rounds (via the `deployZoneFromCols` helper) and eyeball them on the setup screen.
- **Zone-legality check** (new, static like `checks/encounter1.ts`): every deploy-zone hex is in-bounds, passable, on the player side, not highground; and at least one zone hex has a path to the enemy (no walled-off pockets) using `findPath`.
- **Update the 4-point authoring test** (`checks/encounter1.ts`): it currently builds player setups from slots; re-express the "naive deathball" and the ≥2 winning solves as **hex placements within the new zone**. The test must still pass headlessly (deathball loses to the highground-archer lesson; ≥2 distinct placements win; wrong placement loses readably) — now *including* the elevation exposure change, which may shift the tuning.
- **`pixelToAxial` round-trip test:** `axialToPixel` → `pixelToAxial` returns the original hex for every tile (guards the drag-snap math).

---

## Sequencing

Ordered by risk-isolation — each phase is independently verifiable.

1. **Sim: elevation exposure** (`combat.ts` + `engine.ts` + test). Small, isolated, headless-testable. Independent of the UI work.
2. **Game layer: deploy zone + placement** (`rounds.ts`, `runController.ts` + tests). Headless-testable via `canStartFight`/`buildPlayerRoster`; no rendering yet.
3. **Render: setup stage** (`hexLayout.ts` `pixelToAxial` + `hex.ts` export `hexRound` + `render/setupStage.ts`, shared map-draw extraction). The heavy visual chunk; de-risk drag-snap early with the round-trip test.
4. **Wire `main.ts`** — swap dropdown for setup stage; play the full loop end to end.
5. **Author zones + update checks + playtest.** Run the 4-point test with exposure on; then play it: does on-map placement make the puzzle legible, and does high ground feel like a *bet*?

## What to watch in playtest (from the decisions)

- **Zone size** — the attribution↔expression dial. Too big → placement is fiddly and hard to attribute between retries; too small → back toward coarse slots. Tune the column bound.
- **Does placement swallow the draft?** (OQ-6 residual / lever-balance risk.) If a clever opening position solves most encounters, positioning has become the only lever and the roguelike draft is decoration. Watch whether wins trace to *placement* or to *who/what you brought*. Not fixed by code — observed here, resolved later.
- **Is `+1 range / +25% taken` the right elevation ratio?** Whether high ground reads as a real bet or as still-obviously-good (or now useless). Pure tuning of the two consts.

## Out of scope (explicitly not this plan)

- Variance injectors (OQ-8), combat visual polish (OQ-10), roster curation (OQ-14), retry-budget shape (OQ-13) — all unchanged here.
- The between-retry **placement ghost** is optional and low-priority; build only if attribution feels muddy in playtest.
</content>
