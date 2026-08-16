# Reference — Casual Roguelike Autobattler

> **What this file is:** the near-static material — the game's mechanical shape and the taste anchors behind it.
> **How it differs from [STATE.md](STATE.md):** STATE is regenerated every sync and answers "where are we, what's next". This file changes only when it is actually *wrong*, and a sync never rewrites it.
> **For *why* any of it is this way, see [DECISIONS.md](DECISIONS.md).** For how anything actually resolves, read the code — `prototype/src/sim/`.

---

## The design spine

**Core loop (mandatory) — one fight:**

- **Draft:** 5 of a 6-hero pool at run start, one per pair traded for shape (tank: Bracer/Hollow; damage: Rook/Vex; support: Cairn/Ward) — burst vs. cadence, fragility, `chainAffinity`.
- **Field:** 3 of the living draft, chosen fresh each fight against the encounter just drawn (accept-default auto-fills by role and current HP).
- **Scoreboard:** per-hero HP bars, a job counter, a labelled `CHAIN` bar per hero that persists across fights.
- **Beats:** opening exchange → dip (tank break, or wind-up + enrage) → a chain fires → resolve, by wipe.
- **The cascade:** an escalating hit chain, each hit rolling for the next one's odds, capped.
- Enemies do not cascade. The draft and field pick set risk; carried-in charge sets who's closest to the next cascade.

**The run — five fights:**

- Win all 5 to complete; lose a fight, or run out of living roster to field a full squad, and the run ends.
- HP, charge, and death all carry between fights. Death is permanent; charge is untouched by HP recovery.
- Coin is earned per fight and spent between them.
- Which questions a run asks depends on the encounters drawn; a small global ramp remains as a batch-tuning multiplier.

**Optional layer (fully skippable):** the run-start draft, the field pick, and the coin spend, plus candidates not yet specified — offers/modifiers, recruitment beyond the pool, synergies beyond the cascade dial, older ideas (hex terrain, drag-placement, deploy zones).

Forcing the optional layer failed 4/4 in testing — it must stay fully optional.

---

## Reference games (by relevance)

| Priority | Game | Why |
|---|---|---|
| 🥇 | Balatro | Score-climb, synergy layer, expanding option pool. |
| 🥇 | Into the Breach | Full-info puzzle — the field pick answers a drawn encounter. |
| 🥇 | Slay the Spire | Offer-variance refills the learn-loop. |
| 🥈 | Dota (crit/PRD) | Cascade shape. |
| 🥈 | Darkest Dungeon, Heroes 3, TFT | Attrition, placement anchors. |
| 🥈 | PES/bots, Kingdom Rush | Watch-only AI. |
| 🥉 | Super Auto Pets, Mechabellum, Archero, Habby | Mobile packaging. |

---

## Standing design constraints

- Mastery is a ceiling, never a gate; opponent squads are full-info puzzles with multiple solutions.
- Optional-layer decisions must resist a single dominant move; one single-tank draft is a documented exception.
- Depth comes from few, impactful actions — the run adds only draft, field pick, and coin spend.
- Run-to-run depth comes from widening what a run draws from, not from a difficulty ladder.
- Stakes are run-scoped, never permanent.
