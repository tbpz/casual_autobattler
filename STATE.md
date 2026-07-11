# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-11

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE**, where the core fun is **watching a readable fight, learning why it went the way it did, and applying the lesson to your next setup.**

- **Team:** 2 people + AI, experiment stage.
- **Platform:** mobile, casual audience.
- **Current focus:** does this feel fun to us? Monetization and UA come later.
- **Core insight:** fun = the tension between **mastery** (decisions visibly shape outcomes) and **chaos** (visual spectacle + roguelike variety). A great outcome is both *surprising AND attributable* — and here **attributable is primary**: the player watches to understand the cause, then adapts. Learning is the hook, not the coin-flip.

## The design spine

> 5 individual heroes (+ a bench) → a 9 Kings-style draft builds up fielded *and* benched heroes over the run → two squads meet on contained terrain → the player watches a **readable, watch-only fight** → if it fails, **diagnose, adjust the squad, and retry within a limited attempt budget** → the lesson feeds the next setup. (A mid-fight tactical call is a *parked secondary experiment*, not part of the core loop.)

## Settled — do not re-litigate

- **Education-primary, single-player PvE.** The reason to watch is to learn and improve the next setup. Suspense ("will I win?") is a secondary, early-run/execution effect, not the core hook.
- **Fun = balanced mastery + chaos.** Chaos here means *visual liveliness + roguelike offer-variance*, not outcome-uncertainty. Chaos without agency is a slot machine; agency without chaos is a solved puzzle.
- **Depth comes from impactful *few* actions, not more actions.** Inputs stay simple (few taps); the decision *behind* an input must out-complex the input.
- **The 5 are individual characters**, not anonymous groups/archetypes — personal build-up and Darkest Dungeon-style morale drama both attach to individuals.
- **Combat is watch-only in the primary loop.** The player does not act *during* the fight; player agency lives in **draft + pre-fight setup + between-attempt tuning**. Because there is no in-fight input, readable, watchable combat is now *make-or-break*.
- **The learn loop.** Set up a squad → watch a readable fight resolve → on failure, **diagnose, adjust the squad, and retry.** Retries are rationed by a **limited number of attempts**, tuned so **each retry is the same difficulty** (clean attribution: the player's change is the only variable). **Unit attrition is a deferred, separate mechanic**, not in the first prototype.
- **Opponent squads are readable puzzles with multiple valid solutions.** Full information — no fog-of-war. The skill is reading and countering a *visible* board and building a counter creatively, not guessing a hidden one. (Into the Breach model.)
- **A bench exists, and the roster is roguelike, not a collection.** Every run starts from a **fixed default starter squad**; all power is **built in-run** via the draft. The unlocked hero **pool is unlimited** and grows via run-completion rewards and buying, but unlocking/buying only **widens variety** — it never hands over pre-leveled power. Before a run, the player **brings a limited subset** of the pool as this run's draftable heroes.
- **Per-hero persistence (within a run).** Build-up welds to the *individual* hero, not the fielded slot; a benched hero keeps everything they earned and returns fully built. Everything resets to the default starter each new run.
- **Field framing = squad vs. squad on contained terrain.** Two squads meet in the middle of a terrain (no long march). Medieval-war roles: frontline tanks, backline ranged, mobile flankers. Not a defended point holding off waves.
- **Mid-fight tactical decision is demoted to a parked secondary experiment.** Not a hard constraint. Revisited only if the retry-and-tune loop proves too thin; substitution is dropped as its committed form.
- **Mastery is distributed** across the run-long draft + pre-fight setup + between-attempt tuning. No single lever carries it.
- **Combat must be readable.** Education requires the player to trace what happened. "Chaotic/destructive" = *visual* liveliness only (free movement, varied terrain, varied skills/units). Light RNG is wanted but capped so it never makes the fight unreadable.
- **Synergy between characters/items is wanted** — a core roguelike variance engine, simple to trigger, deep in outcome, *watch-legible* (you see it fire). (This is NOT TFT; only the TFT *framing* was dropped.)
- **9 Kings' simple-input / deep-output draft rhythm IS the design.** Take the draft loop; the grid-placement layer and defensive-throne structure are separable and not automatically adopted.
- **The "5-second to understand" rule is ad-creative-only** — not a gameplay-loop constraint.

## Game loop

```
A SINGLE RUN
  BUILD Squad(5 from bench) ──▶ WATCH FIGHT (readable, no input) ──▶ WIN? ──yes──▶ DRAFT / Upgrade ──┐
        ▲                                                            │                                │
        │                                                            no                               │
        │                                                            ▼                                │
        └──── DIAGNOSE + ADJUST squad + RETRY (spend an attempt) ◀───┘                                │
        ▲                                                                                             │
        └───────────────────────────────────────────────────────────────────────────────────────────┘
  Run ends when: attempts run out on a round OR the final boss is beaten.
```

- **BUILD:** field 5 from your bench. Simple decisions — pick who, pick where (formation/positioning: front/back/flank), maybe a stance.
- **WATCH FIGHT (watch to learn):** two squads meet on contained terrain and fight autonomously — **the player does not act during the fight.** Combat is readable and visually lively. Light variance injectors add texture without deciding the fight: environmental hazards, morale/stress breaks, fuzzy AI, chain reactions.
- **DIAGNOSE + RETRY (on loss):** read why it failed, adjust the squad/setup, and retry the same round. Retries cost from a **limited attempt budget** and stay the same difficulty each try.
- **DRAFT / UPGRADE (on win):** one simple 9 Kings-style choice per round, deep outcomes — highly random offers you adapt to. Builds up **both** fielded and benched heroes (recruit / upgrade).

## Design pillars

1. **Simple inputs, complex outputs, traceable outcomes** — few decisions, wildly different results, always traceable back to a choice. Never feels arbitrary.
2. **You watch to learn** — the fight is readable so the player sees *why* it went the way it did, then adjusts and retries. This is the education loop, and it is the core hook.
3. **Balanced tension — mastery AND chaos** — the player is a coach who **tunes between attempts**, not a spectator and not a quarterback calling every play. Mastery lives in setup, draft, and diagnosing-then-adjusting between tries.
4. **Roguelike freshness** — random shops/events/environment and combinatorial synergy depth mean no two runs feel the same; setup and between-attempt tuning still steer the story.
5. **Casual-mobile-first** — inputs simple, the decision behind them deep.

## Reference games (by relevance)

| Priority | Game | What to study |
|---|---|---|
| 🥇 | Into the Breach | Fully-readable PvE roguelike that stays unsolvable *without* an opponent — combinatorial depth as the refill; **full-information, multi-solution puzzle encounters** |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers (Ascension) refilling the learn-loop; education-primary PvE roguelike |
| 🥇 | Balatro | Deep education made *casual* — simple inputs, huge outputs; one-dev proof it ships |
| 🥈 | Darkest Dungeon | Risk/reward; stress/morale as a variance generator; character attachment; stories from failure; **model for the deferred unit-attrition economy** |
| 🥈 | PES / bot games | Proof that watching high-variance AI-vs-AI is entertaining |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch autobattler shape — but both **async-PvP**; studied for form, set aside as PvP-dependent |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later) |

## Open questions

- **OQ-6 — What is the specific FORM of the PRE-fight decision?** Squad picks + positioning (front/back/flank) + stance — how deep? Must stay simple to grasp but feel decisive. It's the player's main setup lever.
- **OQ-7 — How do we make outcomes feel attributable?** Readability is settled; the specific UI/feedback/framing that lets the player credit their own decision (highlight the moment a choice mattered, post-fight recap) is still open. Sharper now that the retry loop lives or dies on clean attribution.
- **OQ-8 — What are the specific variance injectors?** Readable, light, never fight-deciding. Candidates: terrain/environment hazards, morale/stress breaks (leading), fuzzy AI, chain reactions. Constraint: keep fight variance low enough that a retry cleanly tests the player's change.
- **OQ-9 — What's the meta-progression?** Partially set: heroes *unlock* across runs (widening the pool), but power resets each run. What else carries over between runs, if anything?
- **OQ-10 — What does the combat look like? 🔴 (elevated to make-or-break.)** With combat watch-only, the fight must carry entertainment *and* be legible enough to diagnose, on its own. Visual language of *readable* liveliness: movement, terrain, skills, chain reactions, hit feedback.
- **OQ-13 — What is the retry loop's shape? 🔴** Is the attempt budget **per-round or per-run**? How many attempts? What exactly happens when attempts run out (round loss = run over)? How is "same difficulty each retry" enforced?
- **OQ-14 — How tight is the pre-run roster curation?** The dial between "adapt to what's offered" and "pre-plan a build": how big/constrained is the draftable subset you bring into a run?

**Parked experiment (not open, deliberately shelved):** the **mid-fight tactical call** — revisit only if the retry-and-tune loop proves too thin. The real test is whether combat *develops* emergently enough (full information) to make any in-fight reaction worthwhile.

## Next up

Immediate priority: make something that **feels fun to us**. No CPI/UA yet.

1. **Build the minimal prototype of the core loop:** squad setup → readable watch-only fight → on loss, diagnose + adjust + retry within a limited attempt budget → one draft choice on win. Play it: can we watch a fight, *learn* something, adjust, and clear the round — and does clearing feel *earned*, not brute-forced?
2. **Resolve OQ-13 (retry-loop shape)** through prototype feel — attempts count, per-round vs per-run, fail condition.
3. **Resolve OQ-6 (pre-fight setup depth) + OQ-14 (curation tightness).**
4. **Define OQ-8 (variance injectors) + OQ-10 (combat readability)** — now make-or-break since combat is watch-only.
5. **If the retry loop proves thin, run the parked mid-fight experiment.**

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current; do not rely on it.
