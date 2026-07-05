# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-05

---

## What we're making

A **casual mobile roguelike autobattler** where the core fun is **watching unpredictable, destructive combat outcomes** that emerge from a few simple player decisions.

- **Team:** 2 people + AI, experiment stage.
- **Platform:** mobile, casual audience.
- **Current focus:** does this feel fun to us? Monetization and UA come later.
- **Core insight:** fun = the tension between **mastery** (decisions visibly shape outcomes) and **chaos** (surprise, spectacle, replayability). A great outcome is both *surprising AND attributable* — the player can look at the result and feel "that happened because of what I decided."

## The design spine

> 5 individual heroes → a 9 Kings-style draft builds them up over the run → build-up charges ultimates → a **timed ultimate** is the mid-fight call → chain reactions + morale/stress breaks supply the chaos.

## Settled — do not re-litigate

- **Fun = balanced mastery + chaos.** Chaos without agency is a slot machine; agency without chaos is a solved puzzle.
- **Depth comes from impactful *few* actions, not more actions.** Inputs stay simple (few taps); the decision *behind* an input must out-complex the input.
- **The 5 are individual characters**, not anonymous groups/archetypes — the ultimate charger belongs to a character, and individuals keep Darkest Dungeon-style personal morale drama available.
- **Mid-fight form = the Timed Ultimate.** Ultimates charge as heroes fight; the player decides *when to fire*. It must carry a trade-off so "fire the instant it's ready" is *sometimes wrong* (else it becomes auto-castable decoration — the Heroes Charge trap).
- **Mastery is distributed** across run-long draft + pre-fight setup + mid-fight timing. The ultimate is one lever among several.
- **Synergy between characters/items is wanted** — a core roguelike variance engine, simple to trigger, deep in outcome. It should be *watch-legible* (you see it fire), not menu-deep. (This is NOT TFT; only the TFT *framing* was dropped.)
- **9 Kings' simple-input / deep-output draft rhythm IS the design, not a violation of it.** Take the draft loop; the grid-placement layer and defensive-throne structure are separable and not automatically adopted.
- **The "5-second to understand" rule is ad-creative-only** — it is not a gameplay-loop constraint.
- **Combat should look chaotic and destructive** — watching the fight is half the fun; the mid-fight call is the other half.

## Game loop

```
A SINGLE RUN
  BUILD Squad(5) ──▶ FIGHT (watch!) ──▶ UPGRADE / Shop ──┐
        ▲                                                │
        └────────────────────────────────────────────────┘
  Run ends when: squad wipes OR final boss beaten.
```

- **BUILD:** start with a squad of 5. Simple decisions — pick who, pick where (formation/positioning), maybe a tactical stance (aggressive/defensive).
- **FIGHT (the spectacle):** control exists at two moments —
  - *Pre-fight:* setup — squad picks, positioning, stance. (Exact depth still open.)
  - *Mid-fight:* the Timed Ultimate — one tap, "when to fire."
  - Combat is chaotic, destructive, visually exciting. Variance injectors on top of the player's call: environmental hazards, outsized crits/dodges, fuzzy character AI, chain reactions, morale/stress breaks.
- **UPGRADE:** between rounds, upgrade characters or buy from a shop. Options are *highly* random — you adapt to what's offered, not execute a pre-planned build. Modeled on **9 Kings' draft-and-build loop**: one simple choice per round, deep outcomes. What you build up over the run **feeds the ultimate** (build-up → charge → the timed call).

## Design pillars

1. **Simple inputs, complex outputs, traceable outcomes** — few decisions, wildly different results, and the player can always trace the outcome back to a choice. Never feels arbitrary.
2. **The spectacle IS the game** — watching your squad fight is as fun as setting it up; acting mid-fight steers the spectacle. This is the ad moment, the share moment, the "one more game" moment.
3. **Balanced tension — mastery AND chaos** — the player is a coach who also makes the occasional in-match call: not a spectator, not a quarterback calling every play.
4. **Roguelike freshness** — random shops/events/environment mean no two runs feel the same, while player setup and mid-fight choices still steer the story.
5. **Casual-mobile-first** — inputs simple, the decision behind them deep.

## Reference games (by relevance)

| Priority | Game | What to study |
|---|---|---|
| 🥇 | Football Manager / 9King | "Set up and watch" loop; variance from simulation; in-match calls (subs, tactical shifts) that visibly affect outcome |
| 🥇 | Darkest Dungeon | Risk/reward; stress/morale as variance generator; character attachment; stories from failure |
| 🥈 | PES (bot games) | Proof that watching high-variance AI-vs-AI is genuinely entertaining |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes |
| 🥈 | Heroes Charge / Dota Legends | The charged manual-cast ultimate is casual-viable — AND a cautionary tale: shallow timing made it auto-castable, pushing mastery into the meta. Ours must avoid that. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later) |

## Open questions

- **OQ-1 — Defense or offense? 🔴 FOUNDATIONAL, resolve first.** Are the 5 a *defended point* that enemy waves attack (9 Kings "hold the throne"), or an *attacking squad* that pushes out and brawls? Choosing "individuals" did not answer this. Determines spatial layout and whether 9 Kings' structure applies at all. Gates everything downstream.
- **OQ-2 — What does the run-long build-up actually BUILD, given 5 fixed individuals? 🔴 (resolve with OQ-1.)** Upgrade the 5 (levels/gear/ultimate ranks)? Add non-hero elements (buildings/traps/summons)? Recruit from a bench? Tension: too little = not enough roguelike variety; adding stuff *around* the heroes sneaks the kingdom/board back in and reopens OQ-1.
- **OQ-3 — How many ultimates are LIVE at once? ⚠️ TOP PRIORITY next.** One shared meter (a single decisive tap — cleanest, most casual) or 5 independent buttons (richer, 5 "when" decisions, but risks overload)? Sets how heavy the mid-fight moment is. A shared resource pool may resolve this *and* supply the fire-trade-off in one move.
- **OQ-4 — The fire-on-cooldown trade-off. 🔴** What concrete mechanic makes casting-on-cooldown suboptimal? Candidates: overcharge (hold for more, risk the hero dies first); shared ultimate resource pool (can't fire all 5); reaction window (interrupt an enemy ult / catch a morale break); placement (cast now hits 2, wait hits 5 but they scatter).
- **OQ-5 — FM-style spectacle vs. 9 Kings-style solver? 🟡 (never debated).** FM = watchable spectacle (the match you bet on); 9 Kings = tactical optimization (solve the board). Our pillars lean spectacle; the mechanics we're assembling (draft, synergy, ultimate timing) lean optimization. Does the design deliver the *watch-it-unfold* half, or is it a solver with a light show?
- **OQ-6 — What is the specific FORM of the PRE-fight decision?** Squad picks + positioning + stance — how deep? Must stay simple to grasp but feel decisive.
- **OQ-7 — How do we make outcomes feel attributable amid the chaos?** What UI/feedback/framing lets the player credit their own decision (highlight the moment their choice mattered, post-fight recap)?
- **OQ-8 — What are the specific variance injectors?** We want environmental randomness on top of decisions but haven't designed concretes (weather? terrain? morale? equipment breakage?). Morale/stress is the leading candidate — needs individuals ✓.
- **OQ-9 — What's the meta-progression?** Between runs, what carries over — new characters? base/hamlet upgrades?
- **OQ-10 — What does "destructive" look like?** Visual language of chaos: explosions, ragdolls, arena destruction, screen shake. What makes a fight satisfying to watch?

## Next up

Immediate priority: make something that **feels fun to us**. No CPI/UA yet.

1. **Resolve OQ-1 + OQ-2 together (field framing).** Defense vs. offense, and what the draft builds given 5 fixed individuals. Gate everything downstream.
2. **Resolve OQ-5 (the thrill question).** Make sure the "watch it unfold" half is real, not a solver with a light show.
3. **Resolve OQ-3 (one shared meter vs. 5 buttons)** — a shared pool may resolve this and OQ-4 at once.
4. **Resolve OQ-4 (the fire-on-cooldown trade-off).**
5. Then: define variance injectors, build a minimal chaotic-destructive combat prototype with one real mid-fight decision, and play it — can we point at an outcome and say why it happened (chaos, our choice, or both)?

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current; do not rely on it.
