# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-08-09

---

## What we're making

A **casual mobile roguelike autobattler**, single-player PvE (hypothesis, not settled).

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI.
- **Platform:** mobile, casual audience.
- **Current focus:** prototype #1's fight mechanism — see Design status and Next up.

## Where we are right now

Prototype #1's core loop is stable: a run drafts 5 of the 6-hero pool once, then fields 3 of the living draft fresh each fight — never short-handed, but death is permanent and narrows the draft's options over the run. Each of the 5 fights is its own authored encounter rather than one enemy scaled bigger, and heat (the cascade's fuel) can flow between allies instead of staying private to one hero. Batch-tuned but **not yet played and judged by either maker** — Next up #1. Two gaps are visible from batch data alone: a double-tank draft still reads close to risk-free through fight 3, and ignition fires more often than "rare, prized" intends. Revision history: DECISIONS.md.

## The shared lead moment

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

- **Watch-native** — assemble, press play, watch. No reading or choice is required for the payoff; the draft, the per-fight field pick, and the pre-fight read all ship with an accept-default, so the minimum path is Play → watch → Play.
- **"Pay off far bigger than expected"** — a pre-fight projection states a concrete expectation, a post-fight recap compares it to what happened, and full spectacle is reserved for a 3+-hit chain (rate: Design status, Stakes row).
- **"Couldn't fully predict"** — two independent dice (ignite? how long?): RNG is the floor, emergent combination the ceiling. Per-hit damage carries ±25% variance, and heat flowing between allies adds a third: who ignites can vary fight to fight, not just whether ignition fires.
- **"Looked like it might fail first"** — a run can genuinely be lost, and a real share of successful ignitions fire while the pool is low (numbers: Stakes row).
- **"Claim as mine"** — the friend treats RNG as pure luck; attribution is Tu's need specifically. The draft screen states the cascade lever directly (`chainAffinity` pips, identity, heat-gift role), so a player can *choose* to build toward it — not just receive it by accident.

## Design status

The current state of each piece — the single source of truth for it.

| Piece | Status |
|---|---|
| Core loop — concept | Validated by early probes and the friend-validation session — DECISIONS.md. |
| Core loop — fight mechanics | Per-hero HP bars, job counters; a bruiser wind-up + enrage clock create jeopardy. Ignition: highest-heat living hero above threshold rolls, weighted by `chainAffinity`, heat spent every roll. Heat also flows between allies via each hero's `heatGift` — ignition identity isn't fixed at draft time. Code: `sim/fight.ts`, `heroes.ts`, `projection.ts`. |
| The run — shape | 5 fights, attrition, coin economy. A roster of 5 heroes drafts once at run start; 3 field each fight (`sim/roster.ts`). Death is permanent, but a fight is never short-handed since the draft is wider than what's fielded. A fielded hero recovers less HP between fights than a benched one, so resting a hurt hero is a real, incentivized choice. |
| Enemies — shape | 5 authored encounters (`sim/encounters.ts`), one per fight, each a different shape rather than one archetype scaled up: Pack (many small attackers, no bruiser), The Wall (one huge slow body), Twins (two offset telegraphed bruisers), Executioner (wind-up hunts the lowest-HP hero directly, bypassing tank aggro), Champion (hardest, standard-shape finale). |
| Optional layer — concept | Validated by the emergence-only probe; must stay fully optional — forcing it failed 4/4 in testing. |
| Optional layer — contents | The run-start draft (5 of 6) and a fresh field pick each fight (3 of the living draft, full info against that fight's known encounter), plus one coin-spend decision per fight — all accept-default. Later-fight effects beyond this unspecified. |
| Prototype #1 — scope | A vehicle, not the real game. Smoke-tested, not yet played/judged. `PROTOTYPE_PLAN.md`. |
| Stakes — shape | Run-scoped, never permanent. **Default draft, always-heal, n=1500:** completion ~28%; fights 1–3 win rate ~100%; fight 4 ~93%; fight 5 ~30%; ignition ~89%; chains from a losing position ~21% (below this pass's ≥35% aim — open, Next up). **All 6 drafts (n=600 each):** completion ~2–30%; a single-tank draft is a documented extreme-risk exception. Full bands: `checks/chaindist.ts`. |
| Stakes — concrete devices | Coin, earned per win (more on ignition), lost on a run loss, spent on healing the roster or banking a damage upgrade. A bank-or-push escalation and rival scoreboard remain open, undecided. |
| Real game build | Not started — gated behind Next up #1. |

## Next up

1. **Play the current revision and judge it**, against `PROTOTYPE_PLAN.md`'s two completion criteria (differentiated reactions; can it surprise its makers). Check: does fielding 3 each fight feel like a real puzzle against a known encounter; does a near-loss cascade feel like the described moment; does an ignition on an unexpected hero (via a heat gift) read as a discovery rather than noise. `npm run dev` in `prototype/`.
2. **Tune fights 1–3 for real risk against a double-tank draft** — currently close to 100% win rate regardless of play (Design status, Stakes row); `checks/chaindist.ts` names this gap explicitly.
3. **Tune ignition/full-spectacle frequency back down** toward "rare, prized" — heat gifts pushed both well above this pass's own target even after one fraction cut (`heroes.ts`'s `heatGift` values).
4. **Keep tuning by playing and the batch harness** — `checks/chaindist.ts` pins current bands, including the two named gaps above.
5. **Ask the friend:** does losing the run's coin satisfy his "lose something on failure" ask, or did he mean permanent loss?
6. Re-evaluate which old design-spine elements belong in the optional layer, once the rest above are playable.

## The design spine

**Core loop (mandatory) — one fight:**

- **Draft:** 5 of a 6-hero pool at run start, one per pair traded for shape (tank: Bracer/Hollow; damage: Rook/Vex; support: Cairn/Ward) — burst vs. cadence, fragility, `chainAffinity`, `heatGift`.
- **Field:** 3 of the living draft, chosen fresh each fight (accept-default auto-fills by role and current HP).
- **Scoreboard:** per-hero HP bars, a job counter (soaked/dealt/restored), a labelled `CHAIN` bar per hero.
- **Beats:** opening exchange → dip (tank line breaking, or bruiser wind-up + enrage clock) → ignition → chain → resolve, by wipe, not a timer.
- **The cascade:** an escalating crit/proc chain — one hero goes "hot," each hit rolls for a bonus hit raising the next one's odds (capped at 7), scaling off that hero's damage and `chainAffinity`.
- **Ignition eligibility:** a per-hero HEAT meter, spent per roll, weighted by `chainAffinity`; highest-heat living hero above threshold rolls. Heat can also arrive as a gift from another hero's action.
- Two independent dice (ignite? how long?) — a cascade can fire and the fight still lost. The cascade is the big win, not the only win.
- Enemies do not cascade. The field pick and the draft together set a fight's risk band and the cascade's odds.
- No reading needed for the full payoff — draft, field pick, and pre-fight read all accept-default.

**The run — five fights:**

- Win all 5 to complete; lose a fight, or run out of living roster to field a full squad, and the run ends.
- HP and death carry between fights. Death is permanent. A fielded hero recovers less HP between fights than a benched one.
- Coin: earned per win, more on a cascade; spent on healing or a damage upgrade, accept-default. Lost on a run loss.
- Difficulty comes from each fight's own authored encounter, not a single scaled archetype; a small global ramp remains as a batch-tuning multiplier.

**Optional layer (fully skippable):** the draft, the field pick, plus unspecified candidates — recruitment beyond the pool, synergies beyond the cascade dial, older ideas (hex terrain, drag-placement). Skipping this layer still gets the full payoff.

## Working assumptions (non-binding hypotheses, any may be reopened by a build)

- Combat is watch-only — the biggest bet, de-risked by the RNG-only probe's lean-in.
- The draft/field split keeps attrition from spiraling without erasing it — worth checking now it's built and played (Next up #1).
- Combat is readable, chaos visual-only: weighted targeting (a holding tank draws 3× attacks, capped to one tank even double-tanked) and ±25% per-hit variance.
- Mastery is a ceiling, never a gate — coin economy, draft, and field pick satisfy this.
- Optional-layer decisions must resist a single dominant move — true for most of the 6 drafts; one single-tank draft is a documented extreme-risk exception, not blocking.
- Depth comes from few, impactful actions — the core loop needs none beyond press-play; the run adds two (draft, field pick) plus the coin spend.
- Opponent squads are full-info puzzles with multiple solutions — no fog-of-war.

## Reference games (by relevance)

| Priority | Game | Why |
|---|---|---|
| 🥇 | Balatro | Score-climb + synergy layer — structural model. |
| 🥇 | Into the Breach | Full-info puzzle — now literal: field pick answers a known encounter each fight. |
| 🥇 | Slay the Spire | Offer-variance refills the learn-loop. |
| 🥈 | Dota (crit/PRD) | Cascade shape, `chainAffinity`. |
| 🥈 | Darkest Dungeon, Heroes 3, TFT | Attrition, placement anchors. |
| 🥈 | PES/bots, Kingdom Rush | Watch-only AI, single-hero unpredictability. |
| 🥉 | Super Auto Pets, Mechabellum, Archero, Habby | Mobile packaging reference. |

## Open questions

**Top priority — shapes the build:**

- How much further to retune fights 1–3 (double-tank risk) and heat-gift fractions (ignition frequency) before the numbers are worth playing seriously.
- What the optional layer may modify in the fight beyond `chainAffinity`/`heatGift` — base heat weights, escalation step, cap.
- How the optional layer surfaces — auto-revealed over time, or sought out.

**Non-blocking:** heat-weight/threshold/heatGift-fraction constants (`sim/config.ts`, `heroes.ts`, strawman values); an elected bank-or-push escalation and/or a rival-bot scoreboard; whether coin loss satisfies "lose something on failure" (Next up #5); deploy-zone size if drag-placement is kept; roster curation tightness.

**Longer-horizon:** attributability UI, variance injectors beyond the cascade, meta-progression across runs, combat's visual language, alternate win conditions.

**Parked:** mid-fight tactical call.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are.
- [FIGHT_SCRIPT.md](FIGHT_SCRIPT.md) — original fight draft; beat-sheet sequence still current, mechanics superseded (see DECISIONS.md).
- [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) — build doc: scope, stack, constants, phases, play/judge criteria.
- [DESIGN_QUESTIONS.md](DESIGN_QUESTIONS.md) — the question set that turned one fight into a full run.
- `STRATEGY.md` — deprecated, not current.
- `prototype/` — the code: `src/sim/` (`roster.ts` — draft/field; `encounters.ts` — the 5 fights), `src/render/`, `src/batch/` (tuning harness), `src/checks/` (`npm run check`). Run via `npm run dev`.
