# State — Casual Roguelike Autobattler

> **What this file is:** the single snapshot of what is true *right now*. Present tense only.
> **Read this first** in every session. For *why* a thing is the way it is, see [DECISIONS.md](DECISIONS.md).
> **Last synced:** 2026-07-20 (RNG/emergence knob reframed as division of labor, not a fork)

---

## What we're making

A **casual mobile roguelike autobattler**, **single-player PvE** (PvE itself is a working hypothesis, not settled — see below), currently in a **discovery phase**: the core fun has not yet been identified.

- **Team:** 2 people (+ a friend contributing inspiration/direction) + AI, experiment stage.
- **Platform:** mobile, casual audience.
- **Current focus:** find and verify what is actually fun, by play — not by more design reasoning. Monetization and UA come later.
- **Core insight (open question, not a finding):** an earlier version of this file asserted "fun = mastery + chaos, learning is the hook" as settled. It was never verified by play — the resulting prototype bored its own makers. That assertion is retracted to a hypothesis. See **OQ-0** below.

## Why the prototype felt flat (working diagnosis)

Fun lives in **spikes** — a beat you lean *toward* (anticipation → payoff) or *away from* (dread → relief). The prototype has no spike anywhere, so the boredom has no single location: it reads as flat everywhere. The cause is that the design optimized hard for one pole (**mastery**, operationalized as *attributability* — being able to trace exactly why you won or lost) and every step toward that pole cut the other pole (**chaos** / surprise / stakes):

- losing costs nothing (free same-difficulty retry) → winning means nothing;
- nothing surprising happens on screen (variance off, minimal juice);
- nothing you draft ever visibly pays off (thin draft).

The intended goal was the *tension* between mastery and chaos; in practice the tension collapsed to the mastery pole, one locally-reasonable decision at a time. **Picking a pole ("mastery") or a mechanic is not a usable design objective** — neither can reject a proposed feature, so neither constrains the drift. The usable objective is a **moment** (see Next up).

## The alignment lens: engines as a sorting label

A set-up-and-watch autobattler can draw fun from three engines — **Watching** (spectacle/vicarious thrill), **Building** (synergy/combo assembly), **Gambling** (stakes/tension of a result that could go wrong) — plus a **Character-drama** flavor of stakes (Darkest Dungeon-style attachment/loss). Games in this genre tend to pick one engine as the lead and use the others as support. **This lens is a sorting label, not the thing to choose:** name the *moment* you want first, then tag it with an engine afterward to check whether the two makers' moments match or conflict. Which engine leads *this* game is undecided and falls out of the chosen moment.

## How we decide right now (discovery process)

1. ~~**Co-founder alignment on one lead *moment***~~ — **done, 2026-07-19.** Both makers independently recalled felt beats and converged on one shared lead moment (see below). See [DECISIONS.md 2026-07-19](DECISIONS.md).
2. **Fun probes** (not yet started — current step) — small, disposable, ugly toys that test the RNG-triggers-legible-chains bridge hypothesis (RNG decides *when/whether* a cascade fires; emergent combination decides *what it becomes*) via a three-arm comparison — RNG-only, emergence-only, both-wired-together — played and judged only by "do I not want to stop?", for both makers.
3. **Cast the lead** — whichever probe produces a lean-in (for both makers) becomes the lead mechanic; others become support or get cut. Further mechanics are derived *after*, judged by "does this serve the moment?"
4. **Only then re-Settle** — re-promote validated hypotheses to binding decisions and resync this file around the proven fun.

**Standing rule during discovery:** no new "do-not-re-litigate" decisions are minted until a probe (step 2) earns one. See [DECISIONS.md 2026-07-18](DECISIONS.md).

## The shared lead moment (found 2026-07-19)

> **"I assemble my squad, press play, and watch it pay off far bigger than I expected — a cascade I set in motion but couldn't fully predict, that looked like it might fail first, and that I can still claim as mine."**

Load-bearing clauses (each is a test a mechanic must pass — see [DECISIONS.md 2026-07-19](DECISIONS.md) for the full recall and synthesis):
- **Watch-native** — assemble, press play, watch; not fighting watch-only combat as a compromise.
- **"Pay off far bigger than expected"** — rejects mere stat-scaling; demands a genuine over-delivery, not a bigger number.
- **"Couldn't fully predict"** — resolved as **both, wired together** (see below): RNG triggers, emergent combination amplifies. Open question is execution, not choice.
- **"Looked like it might fail first"** — real stakes are required; a free same-difficulty retry that costs nothing undercuts this clause directly.
- **"Claim as mine"** — attributable; rejects illegible chaos and pure coin-flip outcomes.

**Mastery is a ceiling, never a gate:** variance/RNG supplies a *floor* (a highlight is reachable even playing badly); synergy-depth supplies a *ceiling* (rewards playing better). Both makers want attribution/credit when a payoff lands; only one (Tu) cares about playing-better as an end in itself, and that instinct is scoped to competitive/PvP contexts (Dota), not this game.

**RNG vs. emergence is not a fork — it's a division of labor (decided 2026-07-20):** **RNG triggers** (friend's stated favorite — bash/crit/non-targeted-skill procs — decides *when/whether* a cascade fires) and **emergent combination amplifies** (Tu's stated favorite — deterministic systems colliding into unplanned behavior — decides *what the cascade becomes*). This is the same shape as the floor/ceiling resolution above, and the same shape every 🥇 reference game already uses (Balatro, Slay the Spire, Into the Breach all run RNG + emergent systems together, never one alone). **What's still open is execution, not which one to pick:** does the wired-together bridge hypothesis actually satisfy both makers better than either half alone? The probe (see "Next up") runs a three-arm comparison — RNG-only, emergence-only, both-together — to test this without losing attribution.

## The design spine (hypothesis, not settled)

> 5 individual heroes (+ a bench) → a 9 Kings-style draft builds up fielded *and* benched heroes over the run → two squads meet on contained terrain → the player watches a **readable, watch-only fight** → if it fails, **diagnose, adjust the squad, and retry within a limited attempt budget** → the lesson feeds the next setup. (A mid-fight tactical call is a *parked secondary experiment*, not part of the core loop.)

This is the shape the prototype currently implements. It is retained here as a *reference hypothesis* — the concrete thing that was built and found boring — not as a locked target.

## Working hypotheses (pending validation — not binding)

> Formerly "Settled — do not re-litigate." Demoted 2026-07-18: none of these were verified by play before being declared settled, and the prototype built from them bored its own makers. Each line below is still checkable true/false on its own — it is the *bindingness* that changed, not the content. Any of these may be reopened by a probe; do not treat absence of a probe as confirmation.

- **Education-primary, single-player PvE.** Hypothesis: the reason to watch is to learn and improve the next setup, with suspense as secondary.
- **Fun = balanced mastery + chaos.** Hypothesis: chaos means visual liveliness + roguelike offer-variance, not outcome-uncertainty.
- **Depth comes from impactful *few* actions, not more actions.**
- **The 5 are individual characters**, not anonymous groups/archetypes.
- **Combat is watch-only in the primary loop.** The single biggest untested bet — the whole design stakes readability-during-watching as make-or-break, and this has not been probed as a bare toy.
- **The learn loop:** set up → watch → on failure diagnose, adjust, retry within a limited, same-difficulty attempt budget. Two of the project's own top reference games (Slay the Spire, Balatro) do **not** use free same-difficulty retries — this tension is unresolved.
- **Opponent squads are readable, full-information puzzles with multiple valid solutions** (no fog-of-war).
- **A bench exists; the roster is roguelike, not a collection** — fixed starter squad each run, unlimited unlockable pool, power built in-run only.
- **Per-hero persistence within a run** — build-up welds to the individual hero, not the fielded slot.
- **Field framing = squad vs. squad on contained terrain**, medieval-war roles (tank/ranged/flanker), win by annihilate.
- **Spatial model = hex-grid sim, MOBA-style render (sim/skin split).**
- **Pre-fight setup = on-map drag-placement into an authored bounded deploy zone.**
- **Terrain = authored structure**, drawn from a small hand-authored map library, fixed across retries.
- **Elevation is risk/reward**, not pure upside.
- **Encounter authoring = anti-solutions** (one primary threat + a terrain feature the enemy exploits + a different terrain feature the player can use to counter), validated by a 4-point test.
- **Mid-fight tactical decision is a parked secondary experiment**, not in the core loop.
- **Mastery is distributed** across draft + pre-fight setup + between-attempt tuning.
- **Combat must be readable** — chaos is visual-only, capped RNG.
- **Synergy between characters/items is wanted** as a watch-legible variance engine.
- **9 Kings' simple-input/deep-output draft rhythm is the design**; the grid-placement/throne-defense layer is not automatically adopted. (Note: the current draft implementation, `prototype/src/game/draft.ts`, is a thin recruit-one / +25%-stat offer — much shallower than "9 Kings-style" implies; this gap is itself a suspect for the boredom.)
- **The "5-second to understand" rule is ad-creative-only**, not a gameplay-loop constraint.

## Game loop (as currently implemented — reference, not a locked target)

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

- **BUILD:** on-map drag-placement of 5 fielded heroes into a bounded deployment zone.
- **WATCH FIGHT:** autonomous, watch-only, hex-sim/MOBA-render, variance injectors currently **off**.
- **DIAGNOSE + RETRY (on loss):** adjust, retry same round/map/difficulty, rationed by an attempt budget.
- **DRAFT / UPGRADE (on win):** one 9 Kings-style choice per round (currently: recruit-one or +25%-stat upgrade).

## Design pillars (hypothesis, inherited from the retracted core insight)

1. Simple inputs, complex outputs, traceable outcomes.
2. You watch to learn.
3. Balanced tension — mastery and chaos.
4. Roguelike freshness.
5. Casual-mobile-first.

These are carried forward as *candidate* pillars, not confirmed ones — they fall out of the same unverified core insight as everything in "Working hypotheses" above.

## Reference games (by relevance)

| Priority | Game | What to study |
|---|---|---|
| 🥇 | Into the Breach | Fully-readable PvE roguelike that stays unsolvable *without* an opponent — combinatorial depth as the refill; **full-information, multi-solution puzzle encounters**. Signature moment: **the solve clicks** — you see the one placement that breaks the enemy's whole turn. Note: no free same-difficulty retry — losing costs the run. |
| 🥇 | Slay the Spire | Offer-variance + difficulty tiers refilling the learn-loop; education-primary PvE roguelike; **pure-annihilate win condition, still deeply strategic**. Note: heavy RNG, permadeath run structure — tension in genuine friction with this project's determinism + free-retry hypotheses. |
| 🥇 | Balatro | Deep education made *casual* — simple inputs, huge outputs; one-dev proof it ships. Primary engine = **building**; signature moment: **the build pops** — the combo runs away past what you needed. |
| 🥈 | Darkest Dungeon | Risk/reward; stress/morale as a variance generator; character attachment; stories from failure. A friend's stated inspiration — pulls toward **stakes/character-drama**; signature moment: **it could all be lost** — a hero one bad beat from gone for good. In tension with "casual mobile." |
| 🥈 | Heroes 3 | Hex/turn combat logic under an arena skin — visual anchor for the hex-sim layer. |
| 🥈 | TFT | On-board placement as a conscious, attributable, casual-mobile input; hex-to-hex motion for the MOBA-render skin. A friend's stated inspiration — pulls toward **building** (synergy/trait economy). |
| 🥈 | PES / bot games | Proof that watching high-variance AI-vs-AI is entertaining — the **watching** engine; signature moment: **the chaos goes off** — an absurd unpredicted blowout you want to run again. Unverified in this project. |
| 🥈 | Kingdom Rush | How a single controllable hero creates unpredictable outcomes. |
| 🥉 | Super Auto Pets / Mechabellum | The set-up-and-watch autobattler shape — but both **async-PvP**, studied for form, set aside as PvP-dependent. |
| 🥉 | Archero / Habby catalog | Casual roguelike mobile packaging; monetization; low-CPI creative (later). |
| — | **Draft Showdown** (App Store, id6743368869) | The trigger for this discovery phase. Real-time PvP draft-autobattler; the maker found it "much more fun" than this prototype. Runs on **building + gambling** as co-leads (fast draft, real stakes via lives, no free retry, chain-synergy combos), watching as payoff. Deterministic, full-information puzzle-solving is **absent** from it. |

## Open questions

### OQ-0 — What is the fun? Which lead *moment*? 🔴 (top priority — everything below is downstream of this)

**Partially resolved.** Diagnosis (2026-07-19): the prototype has **no spike** — it throttles all three candidate engines at once (watching: variance off / minimal juice; building: anemic draft; gambling: free same-difficulty retry), so the boredom cannot be attributed to any one of them from play. Two sub-parts:
- **Co-founder alignment — done, 2026-07-19.** Both makers independently recalled felt moments and converged on one shared lead moment (see "The shared lead moment" above). No divergence found; one open knob remains (RNG vs. emergent combination as the surprise source).
- **Personal/probe validation — open, now the active work.** The shared moment has real torque only once tested by disposable probes rather than reasoning — not yet started. See "Next up."

Note on who can judge what: a maker who **designed** the deterministic full-information puzzle already knows the answer, so their own boredom is **unreliable evidence for the building/puzzle moment** — that one needs a fresh player. Stakes and spectacle moments can be felt by self-play even knowing the solve.

Nothing below this line should be treated as blocking or unblocking work — OQ-0's remaining half (probe validation) is what's currently blocking everything.

### Previously "resolved through prototype feel" — now reopened pending OQ-0

- **OQ-13 — retry loop shape** (per-round vs per-run attempts, count, same-difficulty enforcement) — reopened; in direct tension with the gambling/stakes moment.
- **OQ-6 residual — deploy-zone size/expressiveness**, whether placement swallows the draft — reopened.
- **OQ-14 — pre-run roster curation tightness** — reopened.

### Longer-horizon (unchanged, still not blocking, now also downstream of OQ-0)

- **OQ-7 — attributability UI** (recap, telegraphs, retry diff/ghost).
- **OQ-8 — variance injectors** (morale/stress, fuzzy AI, chain reactions, later terrain hazards) — directly relevant to the watching/spectacle moment.
- **OQ-9 — meta-progression** across runs.
- **OQ-10 — combat's concrete visual language** — directly relevant to the watching/spectacle moment.
- **OQ-15 follow-on — alternate win conditions** as encounter variety.

**Parked experiment (unchanged):** the mid-fight tactical call — revisit only if a probe suggests the loop needs it.

## Next up

Immediate priority: **discovery, not construction.** Do not resume building the loop until OQ-0's probe-validation half has a real answer.

1. ~~Run the co-founder alignment session~~ — **done, 2026-07-19.** See "The shared lead moment" above.
2. **Fun probes (current step, not yet started).** Build small disposable toys that restore what the flat prototype throttled: watch-only combat with juice/variance restored, real stakes (no free same-difficulty retry), and a synergy system deep enough to test "run away past what I planned." Run a **three-arm comparison** — RNG-only, emergence-only, RNG-triggers-emergence-together — to test whether the wired-together bridge hypothesis (dice decides *when*, setup decides *what*) beats either half alone, for both makers. Judge each probe by lean-in ("do I not want to stop?"), not argument.
3. **Cast the lead**, derive further mechanics from it (each judged by "does this serve the moment?"), then re-Settle validated hypotheses and resync this file around the proven fun.

## Related files

- [DECISIONS.md](DECISIONS.md) — why things are the way they are (append-only history).
- `PROTOTYPE_PLAN.md` — build doc for the now-reopened design; expected to go stale, describes the prototype-as-built, not a current target.
- `STRATEGY.md` — **deprecated**, pending a future rewrite. Not current; do not rely on it.
