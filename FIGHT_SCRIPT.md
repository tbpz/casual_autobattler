# Fight Script — a concrete draft of the core loop's 30 seconds

> **What this file is:** a scratch draft, not part of the STATE/DECISIONS discipline (like `PROTOTYPE_PLAN.md`). Its job is to turn the core loop from relationships ("RNG triggers, emergence amplifies") into a picturable scene: a clock, a named number, and a screen.
>
> **Status (2026-07-29):** the reaction pass is done. Five things are settled — fight length, the scoreboard, the cascade mechanic, the PRD ignition gate, and cascade-as-big-win-not-only-win — and are **logged in [DECISIONS.md](DECISIONS.md) (2026-07-29)** and folded into [STATE.md](STATE.md) (synced 2026-07-29). This file remains the home of the **strawman tuning constants** — STATE deliberately doesn't carry them, since they're meant to change every time the build is played. Remaining open items are collected in §6; the squad-pick step (§5) is deliberately deferred.

---

## 1. The beat sheet (the clock)

**Settled: ~30s per fight** (pending DECISIONS log).

A single fight, scripted second-by-second. Placeholder squad: **3v3**, one screen, no camera cuts.

| t | Beat | What's on screen |
|---|---|---|
| 0:00 | **Press play.** | Squads snap into position. No animation yet — this is the "I chose this" freeze-frame. |
| 0:00–0:08 | **Opening exchange.** | Both squads trade normal attacks. The two meters (§2) move in small, boring, roughly symmetric increments. Nothing surprising happens — this is establishing footage, not filler to be skipped. |
| 0:08–0:16 | **The dip.** | The player's squad visibly loses the exchange — the player's meter drops faster, a hero falls over. **This must read as "losing" to someone glancing at the screen with no rules knowledge.** This is jeopardy (§4), and it is mandatory every fight, not just when the dice cooperate. |
| 0:16–0:20 | **Ignition.** | Somewhere inside (or right at the end of) the dip, the PRD roll fires and one hero goes **hot**. Visually: a distinct tell — screen-shake, a flash, a name-callout — so "something just happened" reads even to a player who wasn't watching closely. |
| 0:20–0:27 | **The chain.** | The hot hero's hits start chaining (§3). The enemy meter breaks its previous pace — not a nudge, a collapse. Numbers should look qualitatively different in this window than in the opening exchange (bigger font pop, faster tick, a distinct sound). **This window is where the fight is won or lost**, because a short chain fizzles and the dip stands. |
| 0:27–0:30 | **Resolve.** | Win/loss lands, run-scoped stakes settle (something is banked or lost — see STATE's stakes-shape decision), retry button appears. |

Note the rename: the old "trigger / cascade" beats are now **ignition / chain**, because §3+§4 split those into two mechanically distinct things.

---

## 2. The named number (the scoreboard)

**Settled: HP-remaining, two aggregate meters — one per side** (pending DECISIONS log). Not Balatro-style accumulating-score-vs-target; this is a defense-flavored comeback, not an offense-flavored jackpot.

- Normal exchange: both meters move in small steps, roughly symmetric.
- The dip: player's meter drops faster than the enemy's — this is what makes the loss *visible*, not just implied by unit deaths.
- The chain: the enemy's meter collapses. The number itself does something it wasn't doing a second ago.

**Why one meter per side and not six per-hero bars** (answering the question raised on this section): six bars have no shared scale, so a glancing player can't tell who's winning — they'd have to read and compare. Two aggregates give a single tug-of-war read, which is what a zero-reading core loop needs. Per-hero state is still visible, but **as bodies, not as numbers**: a hero at zero falls over on screen. That's what carries the 0:08–0:16 "a hero goes down" jeopardy beat without adding a second thing to track.

Consequence to watch during the build: aggregating HP means a squad at 40% could be three wounded heroes or one healthy one — very different fight states, same meter. If that ambiguity turns out to matter, the fix is a segmented bar (one segment per hero) rather than six separate bars, which keeps the single-glance read.

---

## 3. What the cascade concretely *is*

**Settled: option C — escalating crit/proc chain** (pending DECISIONS log). Rejected: A (chain-kill snowball), B (revive/rally wave).

Concretely, and split into the two independently-tunable halves that §4 needs:

**Ignition** — the gated event. When the fight reaches jeopardy (§4) and the PRD roll lands, **one hero goes hot**. Camera/highlight follows that hero.

**The chain** — what "hot" means. Each of the hot hero's hits rolls for a **bonus hit**; each bonus hit that lands raises the chance for the next one; a failed roll ends the chain and the hero cools off. Strawman numbers, to be tuned by feel:

| Bonus hits so far | Chance the next one lands |
|---|---|
| 0 (first roll after ignition) | 35% |
| 1 | 50% |
| 2 | 65% |
| 3 | 80% |
| 4+ | 90% (cap) |

So a chain either fizzles at length 0–1 (~65% of ignitions, most of the time nothing much happens) or, once it gets past two, tends to run away. That shape — usually a damp squib, occasionally exponential — is what supplies "far bigger than I expected," because the *expected* outcome genuinely is small.

**Magnitude target:** a long chain should do in ~5 seconds what a normal exchange does in ~20. Sized so that a runaway chain flips a fight that looked ~70% lost, but cannot win one that's ~95% lost. It amplifies; it does not guarantee.

**Why this split matters** (this is the load-bearing part): ignition and chain-length are *two separate dice*. That means **a cascade can fire and the fight can still be lost** — the chain fizzled. Without this, mandatory jeopardy plus a single cascade roll would make cascade-fire-rate and win-rate the exact same number, leaving the design one dial and no way to lose a fight the dice "rescued." With it, the two come apart and the jeopardy stays real.

Known cost, accepted going in: C is a trigger, not a decision — it scored weakest on Tu's own decision-density read. That's consistent with the layered structure, since the core loop is explicitly the friend/casual half and decision-density is the optional layer's job. **The open follow-on is what the optional layer gets to modify here** — the base chance, the escalation step, the cap, which hero can go hot, or what a bonus hit does. See §6.

---

## 4. How jeopardy is guaranteed without being fake (the trigger rule)

**Settled: the cascade does not fire every fight, and its chance uses Dota-style pseudo-random distribution — rising each time it fails to proc, never reaching 100%** (pending DECISIONS log). This answers the §4 fork: the dice decide **whether**, not just **when**. A 100%-once-eligible comeback is scripted, and scripted kills the moment.

The mechanism is a **two-stage gate**:

- **Stage 1 — eligibility (deterministic):** the cascade cannot become possible until the sim detects jeopardy — player squad HP below a threshold relative to the enemy's. Before that, nothing is rolled. This guarantees "looks lost first" without staging it: it's a real state reached through normal combat resolution, not an animation. **Threshold still open — see §6.**
- **Stage 2 — ignition roll (PRD):** once eligible, roll for ignition. The chance is *not* fixed — it climbs with each fight that ended without an ignition, and is capped below 100%.

### How the PRD is being read

Dota's crit PRD counts consecutive non-procs *within* combat. Here it's read as counting **across fights** — the counter persists between fights and resets on ignition. That's the only reading consistent with "should not fire on every fight": if the counter reset each fight and rolled per tick, a fight has enough ticks that ignition would become near-certain every time, which is the scripted-comeback outcome this answer rejects. Flag if that's not what was meant.

Strawman constants, one fight = one roll:

| Fights since last ignition | Ignition chance |
|---|---|
| 0 | 55% |
| 1 | 80% |
| 2+ | 92% (cap) |

Long-run: ignition in **~65%** of fights. Three consecutive fights with no ignition happens ~1.6% of the time — rare enough to not feel abandoned, possible enough that the floor isn't a guarantee.

Layered with §3's chain (~65% of ignitions fizzle), the rough shape is: most fights ignite, most ignitions fizzle, and the runaway chain — the actual lead moment — lands somewhere around **1 fight in 4**. That frequency is a guess and is exactly the kind of number that should be set by playing, not by arithmetic.

### The cascade is the big win, not the only win

**Settled** (pending DECISIONS log). Jeopardy is escapable by ordinary combat — the dip is real but survivable, and a player can grind back out of a close fight with no cascade at all. The cascade is the *big* version of winning, not the only version.

Rejected alternative: cascade-as-only-exit, which would have made every fizzled chain a loss and forced cascade-fire-rate and win-rate to be the same number by construction (~35–45% loss rate on the constants above — too punishing for casual mobile).

**The cost, accepted going in:** if you can sometimes just play out of the dip, the dip is no longer reliably *scary*. "Looked like it might fail first" is a load-bearing clause of the lead moment, so it now depends on tuning the dip to still **read** as losing even when it's in fact escapable. Watch this during the build — if that tuning proves impossible, this is the piece to revisit first.

---

## 5. Squad-pick step

**Not yet decided** — deferred, not answered.

The strawman on the table: a bench of ~6–8 (per `PROTOTYPE_PLAN.md`'s OQ-14 provisional value), auto-filled with a sane default squad, one tap to accept or swap a slot. Comes from the optional layer per STATE's layering — the core loop only needs the *accept-default* path to work end to end.

Not a blocker for building §1–§4: the core loop can be built with a hardcoded 3v3 and a Play button, and the pick step slotted in later.

---

## 6. What's still open

Carried forward from the sections above, roughly in order of how much they block the build:

1. **The eligibility threshold** — how far below the enemy the player's meter has to fall before ignition is even possible. 40%? 30%? Can be looser now that the dip is escapable without a cascade.
2. **Whether the across-fights PRD reading in §4 is what was meant.**
3. **What the optional layer modifies in §3** — base chance, escalation step, cap, which hero can go hot, or what a bonus hit does. Doesn't block the core loop, but it's the hinge the whole optional layer hangs off, so worth an early answer.
4. **The squad-pick step** (§5).

All the numbers in §3 and §4 are strawmen for tuning by feel, not open questions in the same sense — they're meant to be changed by playing the build, which is the standing "learn by building" rule.

---

## How to use this doc

React section by section — agreeing, rejecting, or replacing each strawman is enough. Whatever survives becomes the input to the build. Anything that's a real decision rather than a working assumption gets proposed to DECISIONS.md before STATE.md is touched.
