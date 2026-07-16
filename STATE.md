# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-15

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
- **Win condition = annihilate (prototype baseline).** A fight is won by wiping the enemy squad. The other objectives (rout-the-commander, breakthrough-to-the-edge, hold-or-survive) are a **deferred per-encounter variety lever**, not in the first prototype. Consequence: annihilate adds no spatial pressure of its own, so **terrain and encounter authoring carry the entire positioning burden** — they are what must make the naive deathball fail.
- **Spatial model = hex-grid sim, MOBA-style render (sim/skin split).** The simulation reasons in a **fine hex grid** (range, AoE, pathing, adjacency, chokepoints); the player sees **smooth, continuous, real-time MOBA-style motion** over an arena skin, with the grid hidden except on telegraph (range rings, AoE footprints, aggro lines). Hex, not square (uniform distance, roughly circular ranges/AoE). Continuous *simulation* is rejected; the continuous feel survives only as a presentation layer.
- **Pre-fight setup happens *on* the battle map, as free placement inside a bounded zone.** Setup and battlefield are **one screen** — the player **drag-places** each fielded hero onto any legal hex within an **authored deployment zone** (free within the zone, TFT-style; *not* a separate dropdown screen, *not* coarse row×lane, *not* free-place-anywhere). Legal hexes exclude walls, the enemy side, and (by default) enemy-held high ground. The **deploy zone is the per-encounter balancing knob** — it governs elevation access, dominant-option avoidance, and how much placement carries versus the draft. Zone size/expressiveness is a prototype dial.
- **Terrain = authored structure, in the prototype.** Real hand-authored geometry (chokepoints, corridors, high ground, impassable walls) gives positioning consequence and carries the burden annihilate can't. Drawn from a **small hand-authored map library**, not procedural. **"Variance" = a different authored map per round** (a fresh puzzle each round); the map is fixed across retries so retries stay same-difficulty. **In-fight random hazards stay deferred** (that's OQ-8's terrain-as-variance, kept separate to protect attribution). Standing test: a terrain feature must **raise a question with several answers, never announce its own answer.**
- **Elevation is risk/reward, not pure upside.** High ground grants a ranged/sight advantage *and* a matching exposure (more incoming / more targetable), so occupying it is a **bet, never a free pick** — the tile is self-balancing on every map, no global "can't-stand-here" rule needed. (Exact parameter values are a prototype dial.)
- **Encounter authoring = anti-solutions, not solutions.** An encounter = **one primary threat + a terrain feature the enemy exploits + a different terrain feature that lets the player counter** (terrain in counter-pairs). Threats are composed from a small reusable library of **threat primitives** (AoE artillery / backline assassin / tank wall / high-ground archers / kite-skirmisher), each punishing a specific naive habit. **Difficulty scales by the number of interacting threats, never by bigger stats.** Every encounter must pass the **4-point authoring test**: (1) name the lesson in one sentence; (2) the deathball loses *to that lesson*, loudly; (3) ≥2 *distinct* setups win (different levers, not flavors of one); (4) a wrong setup loses *readably* (one dominant cause of death). Deterministic sim makes this test runnable.
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

- **BUILD:** on the battle map itself, **drag-place** your 5 fielded heroes onto legal hexes inside an authored **deployment zone** (free placement within the zone). Setup and battlefield share one screen, so you place while reading the terrain you're countering.
- **WATCH FIGHT (watch to learn):** two squads meet on an authored hex map and fight autonomously — **the player does not act during the fight.** Win by wiping the enemy squad. Combat renders as continuous MOBA-style motion, readable and visually lively. Light variance injectors add texture without deciding the fight: morale/stress breaks, fuzzy AI, chain reactions. (Random hazards deferred.)
- **DIAGNOSE + RETRY (on loss):** read why it failed, adjust the squad/setup, and retry the same round on the same map. Retries cost from a **limited attempt budget** and stay the same difficulty each try.
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
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers (Ascension) refilling the learn-loop; education-primary PvE roguelike; **pure-annihilate win condition, still deeply strategic** |
| 🥇 | Balatro | Deep education made *casual* — simple inputs, huge outputs; one-dev proof it ships |
| 🥈 | Darkest Dungeon | Risk/reward; stress/morale as a variance generator; character attachment; stories from failure; **model for the deferred unit-attrition economy** |
| 🥈 | Heroes 3 | Hex/turn combat logic under an arena skin — visual anchor for the hex-sim layer |
| 🥈 | TFT | On-board placement (free within your half) as a conscious, attributable, casual-mobile input — **model for the on-map deploy-zone setup**; plus hex outlines fading in combat + smooth hex-to-hex motion for the MOBA-render skin |
| 🥈 | PES / bot games | Proof that watching high-variance AI-vs-AI is entertaining |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch autobattler shape — but both **async-PvP**; studied for form, set aside as PvP-dependent |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later) |

## Open questions

The 🔨 prototype-spec gate is **cleared** — OQ-15 (win condition), OQ-16 (map/terrain), OQ-17 (spatial resolution), and OQ-19 (puzzle authoring) are all resolved and live in Settled above. **Nothing blocks building/iterating the prototype.** The remaining questions are resolved *through* the prototype, not before it.

### Resolved through prototype feel (build first, then answer)

- **OQ-13 — What is the retry loop's shape? 🔴** Is the attempt budget **per-round or per-run**? How many attempts? What exactly happens when attempts run out (round loss = run over)? How is "same difficulty each retry" enforced?
- **OQ-6 — form decided; size/balance open.** The *form* of the pre-fight decision is settled: on-map free placement inside a bounded deploy zone (see Settled). What remains for prototype feel: **how large/expressive the deploy zone is** (the attribution↔expression tradeoff), and **does rich placement swallow the draft?** — if a clever opening position solves most encounters, positioning becomes the only lever and the roguelike draft turns cosmetic. Mastery must stay distributed.
- **OQ-14 — How tight is the pre-run roster curation?** The dial between "adapt to what's offered" and "pre-plan a build": how big/constrained is the draftable subset you bring into a run?

### Longer-horizon (not blocking the first build)

- **OQ-7 — How do we make outcomes feel attributable?** Readability is settled; the specific UI/feedback/framing that lets the player credit their own decision (highlight the moment a choice mattered, telegraph threats pre-fight, post-fight recap, a between-retry placement diff/ghost) is still open. Sharper now that the retry loop lives or dies on clean attribution.
- **OQ-8 — What are the specific variance injectors?** Readable, light, never fight-deciding. Candidates: morale/stress breaks (leading), fuzzy AI, chain reactions, and *later* in-fight terrain hazards. Constraint: keep fight variance low enough that a retry cleanly tests the player's change.
- **OQ-9 — What's the meta-progression?** Partially set: heroes *unlock* across runs (widening the pool), but power resets each run. What else carries over between runs, if anything?
- **OQ-10 — What does the combat look like? 🔴 (elevated to make-or-break.)** Now bounded by the sim/skin split: continuous MOBA-style motion over a hidden hex grid. Still open: the concrete visual language of *readable* liveliness — movement, terrain, skills, chain reactions, hit feedback.
- **OQ-15 follow-on — alternate win conditions as encounter variety.** Rout-the-commander / breakthrough / hold-or-survive return later as per-encounter objective types. Not scoped yet; revisit after the annihilate baseline proves the loop.

**Parked experiment (not open, deliberately shelved):** the **mid-fight tactical call** — revisit only if the retry-and-tune loop proves too thin. Watch-only is a deliberate bet the prototype exists to test: *how far pre-fight setup alone can carry the puzzle.* The real test is whether combat *develops* emergently enough (full information) to make any in-fight reaction worthwhile.

## Next up

Immediate priority: make something that **feels fun to us**. No CPI/UA yet. The core-loop prototype exists (headless deterministic sim → watchable fight → BUILD/WATCH/RETRY/DRAFT loop → authored Encounter 1).

1. **Rebuild pre-fight setup to the decided form:** replace the current separate-screen dropdown with **on-map placement into a bounded deploy zone** (drag heroes onto legal hexes on the battle map). Add the **elevation exposure downside** to the sim so high ground is risk/reward, not pure `+range`.
2. **Resolve through prototype feel:** OQ-6 residual (deploy-zone size/expressiveness + whether placement over-dominates the draft), OQ-13 (retry-loop shape), OQ-14 (curation tightness).
3. **Define OQ-8 (variance injectors) + OQ-10 (combat readability)** — make-or-break since combat is watch-only.
4. **If the retry loop proves thin, run the parked mid-fight experiment.**
5. **Judge:** can we watch → *learn* → adjust → clear a round, and does clearing feel *earned*, not brute-forced?

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `PROTOTYPE_PLAN.md` — build doc, expected to go stale. **Note:** its OQ-6 provisional ("row × lane, not free hex-drop") is now **overturned** by the 2026-07-15 on-map-placement decision.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current; do not rely on it.
</content>
</invoke>
