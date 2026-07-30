# Fight Script — a concrete draft of the core loop's 30 seconds

> **What this file is:** a scratch draft, not part of the STATE/DECISIONS discipline (like `PROTOTYPE_PLAN.md`). Its job is to turn the core loop from relationships ("RNG triggers, emergence amplifies") into a picturable scene: a clock, a named number, and a screen.
>
> **Status (2026-07-31):** the reaction pass is done. Five things settled 2026-07-29 — fight length, the scoreboard, the cascade mechanic, the PRD ignition gate, and cascade-as-big-win-not-only-win — **logged in [DECISIONS.md](DECISIONS.md) (2026-07-29)** and folded into [STATE.md](STATE.md). Squad size (N=3, parameterized) settled 2026-07-30. What a bonus hit does, the dip's cost, and whether enemies cascade all settled 2026-07-31, alongside the run-level shape — **logged in [DECISIONS.md](DECISIONS.md) (2026-07-31)**. This file remains the home of the **strawman tuning constants** — STATE deliberately doesn't carry them, since they're meant to change every time the build is played. Remaining open items are collected in §6; the squad-pick step (§5) is deliberately deferred.

---

## 1. The beat sheet (the clock)

**Settled: ~30s per fight** (pending DECISIONS log).

A single fight, scripted second-by-second. Squad: **N=3 a side** — a tuning constant, not a commitment (see below). One screen, no camera cuts.

| t | Beat | What's on screen |
|---|---|---|
| 0:00 | **Press play.** | Squads snap into position. No animation yet — this is the "I chose this" freeze-frame. |
| 0:00–0:08 | **Opening exchange.** | Both squads trade normal attacks. The two meters (§2) move in small, boring, roughly symmetric increments. Nothing surprising happens — this is establishing footage, not filler to be skipped. |
| 0:08–0:16 | **The dip.** | The player's squad visibly loses the exchange — the player's meter drops faster. **This must read as "losing" to someone glancing at the screen with no rules knowledge.** This is jeopardy (§4), and it is mandatory every fight, not just when the dice cooperate. The dip's cost is HP, not a body — **a hero falls only in the bad-case dip, not every dip** (decided 2026-07-31, forced by attrition: with permanent death and N=3, a body lost every fight empties the squad by fight 3, making the 5-fight run unreachable by construction). |
| 0:16–0:20 | **Ignition.** | Somewhere inside (or right at the end of) the dip, the PRD roll fires and one hero goes **hot**. Visually: a distinct tell — screen-shake, a flash, a name-callout — so "something just happened" reads even to a player who wasn't watching closely. |
| 0:20–0:27 | **The chain.** | The hot hero's hits start chaining (§3). The enemy meter breaks its previous pace — not a nudge, a collapse. Numbers should look qualitatively different in this window than in the opening exchange (bigger font pop, faster tick, a distinct sound). **This window is where the fight is won or lost**, because a short chain fizzles and the dip stands. |
| 0:27–0:30 | **Resolve.** | Win/loss lands, run-scoped stakes settle (something is banked or lost — see STATE's stakes-shape decision), retry button appears. |

Note the rename: the old "trigger / cascade" beats are now **ignition / chain**, because §3+§4 split those into two mechanically distinct things.

### Squad size: N=3, and it stays changeable

**Decided 2026-07-30: build at N=3, parameterized.** Three is the prototype value; it is a strawman constant like the PRD table, to be moved by playing rather than by argument. Before this it was an unargued placeholder — it had never been reasoned about at all.

Why 3 is the right *starting* value:

- **Attribution.** "I can claim it as mine" needs the hot body to be unmistakable. Six bodies on a phone screen with no camera cuts turns "which one did that" into a reading task, and reading is what the core loop forbids.
- **It's the composition floor.** §1's role strawman is tank/damage/support, one each. Three is the smallest number where a squad is a composition rather than a pile.
- **The dip reads harder.** One body falling is 33% of the side — glanceable at t≈8s. At five a side it's 20%, and the mandatory dip weakens.
- **Legible tick rate.** Ten attackers in 30 seconds moves the meters as noise, not as beats.
- **It's the cheap direction to be wrong in.** 3→5 later is additive (widen the slots, an optional-layer effect); 5→3 is subtractive.

**The cost, named going in:** squad size is a dial on the escapability tension in §4. Down a body at 3v3 you are at 2v3 — a steeper hole to climb out of by ordinary combat than 4v5. The same property that makes the dip *read* as losing makes it more likely to *be* losing. So N is one of the first levers to try if the dip proves inescapable, ahead of revisiting cascade-as-big-win.

**What "parameterized" has to mean in the build** — the point is to change N by editing one number, not by editing the fight:

- Two constants, not one: player-side N and enemy-side N are separate, so asymmetric fights (3v4, 3v2) stay available as the §6-adjacent variety lever without a refactor.
- Squads are lists. No `hero1/hero2/hero3` fields, no per-slot code paths, no three hardcoded screen positions — formation layout is computed from N.
- **Every threshold is a fraction of the side's total, never a body count.** This covers the eligibility gate, the dip trigger, and "a hero falls over." A rule written as "when one hero is down" silently means something different at N=5.
- **HP and DPS are side-level budgets divided among N**, not per-hero values multiplied by N. Otherwise raising N raises both total HP and total damage, and the 30-second fight length drifts out from under the beat sheet.

Still unreconciled, and not blocking: `[2026-07-04]` and `[2026-07-11]` fix the squad at **5 + bench**, and `STATE.md` still lists "5 individual heroes + bench" as optional-layer candidate content. Either those are superseded, or the optional layer's headline effect is widening 3→5. In writing it is currently neither.

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

**The chain** — what "hot" means. Each of the hot hero's hits rolls for a **bonus hit**; each bonus hit that lands raises the chance for the next one; a failed roll ends the chain and the hero cools off.

**What a bonus hit does (Q6, decided 2026-07-31):** it does **more damage than the last** — crit-style escalation, not a repeated attack, a new target, or a hit-everything nuke (the three rejected candidates). Fired by the **same hero** throughout, so attribution stays on one unmistakable body (§10). **Retargets when its current target dies**, so a long chain collapses the enemy meter rather than overkilling one corpse. Strawman: **bonus hit *N* does 20 × N damage, capped at 100** (20, 40, 60, 80, 100, 100…). Chosen because flat-repeat damage can't reach the magnitude target below in 4–6 hits; geometric growth can, and growth is also what makes the chain *look* different at hit #5 than at hit #1 (§8).

Strawman ignition-roll numbers, to be tuned by feel:

| Bonus hits so far | Chance the next one lands |
|---|---|
| 0 (first roll after ignition) | 35% |
| 1 | 50% |
| 2 | 65% |
| 3 | 80% |
| 4+ | 90% (cap) |

So a chain either fizzles at length 0–1 (~65% of ignitions, most of the time nothing much happens) or, once it gets past two, tends to run away. That shape — usually a damp squib, occasionally exponential — is what supplies "far bigger than I expected," because the *expected* outcome genuinely is small.

**Magnitude target:** a long chain should do in ~5 seconds what a normal exchange does in ~20. Sized so that a runaway chain flips a fight that looked ~70% lost, but cannot win one that's ~95% lost. It amplifies; it does not guarantee.

### Fight-level constants (strawman, 2026-07-31)

A first-pass, internally-consistent set — chosen so the fight actually produces the beat sheet above, not just numbers that sound reasonable in isolation. Every value here is expected to move once played; what shouldn't move without re-checking is the *relationship* between them.

| Constant | Value |
|---|---|
| Hero HP | 100 each |
| Player squad damage | 9/sec, side total (flat) |
| Enemy damage | 16/sec at t=0, decaying linearly to 2/sec at t=30 — this is the dip's mechanism (§4/§9) |
| Enemy HP (fight 1) | 300 |
| Eligibility gate (§4 threshold) | player pool ≤ **40%** of current max |

Worked check against the beat sheet, at a full 3-hero squad (player pool 300, enemy pool 300):

- **t=8** (end of opening exchange): player ≈62%, enemy ≈76% — behind, not yet alarming.
- **t≈14.5**: player pool crosses 40% — **eligibility gate opens**, right where the beat sheet calls for ignition (0:16–0:20).
- **t=16** (end of dip, if no ignition): player ≈35%, enemy ≈52% — reads as losing at a glance.
- **t=30, no cascade fired:** both sides land around 10% — a genuine coin flip, which is what makes the cascade the *big* win rather than the *only* win (§9), by construction rather than by hope.
- **At ignition, enemy pool ≈130 HP.** A chain of 3 bonus hits (120 damage) plus the underlying 9/sec closes it comfortably; a chain of 2 is marginal; a fizzle leaves the t=30 coin flip standing.

**Note:** the eligibility gate is relative to *current* max, so a squad entering a fight already wounded (attrition, see the run-level doc) reaches jeopardy faster — cascade becomes reachable earlier in a fight than in a fresh one. Watch whether this skips the opening-exchange beat when the squad is badly hurt.

**Why this split matters** (this is the load-bearing part): ignition and chain-length are *two separate dice*. That means **a cascade can fire and the fight can still be lost** — the chain fizzled. Without this, mandatory jeopardy plus a single cascade roll would make cascade-fire-rate and win-rate the exact same number, leaving the design one dial and no way to lose a fight the dice "rescued." With it, the two come apart and the jeopardy stays real.

Known cost, accepted going in: C is a trigger, not a decision — it scored weakest on Tu's own decision-density read. That's consistent with the layered structure, since the core loop is explicitly the friend/casual half and decision-density is the optional layer's job. **The open follow-on is what the optional layer gets to modify here** — the base chance, the escalation step, the cap, or which hero can go hot (what a bonus hit *does* is now answered, above). See §6.

**Q13 — can the enemy cascade too? Decided 2026-07-31: no, not in the prototype.** Keeps the cascade the player's signature rather than a weather system that happens to everyone, and keeps the win-rate math tractable for a first build. Deliberately cheap to reverse: the chain logic (above) is written per-side rather than player-only, so enabling it later is a flag, not a rewrite.

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

Layered with §3's chain, the rough shape is: most fights ignite, most ignitions fizzle at length 0–1, and a genuine runaway (3+ bonus hits, the actual lead moment) is rarer than that framing suggests.

**Correction (2026-07-31):** the "~1 fight in 4" estimate above contradicted its own chain table. 65% ignition × 35% chance the *first* bonus hit lands ≈ 23% of fights get exactly one bonus hit — that's not a runaway, it's a fizzle. Working the chain table through properly, a chain of **3+** bonus hits lands in roughly **7% of fights**. If the lead moment feels too rare once playable, **raise the base chain chance (currently 35% in §3) first** — that's the more direct lever than the ignition-rate table above, and doesn't reopen the "does it fire every fight" question this section exists to answer.

### The cascade is the big win, not the only win

**Settled** (pending DECISIONS log). Jeopardy is escapable by ordinary combat — the dip is real but survivable, and a player can grind back out of a close fight with no cascade at all. The cascade is the *big* version of winning, not the only version.

Rejected alternative: cascade-as-only-exit, which would have made every fizzled chain a loss and forced cascade-fire-rate and win-rate to be the same number by construction (~35–45% loss rate on the constants above — too punishing for casual mobile).

**The cost, accepted going in:** if you can sometimes just play out of the dip, the dip is no longer reliably *scary*. "Looked like it might fail first" is a load-bearing clause of the lead moment, so it now depends on tuning the dip to still **read** as losing even when it's in fact escapable. Watch this during the build — if that tuning proves impossible, this is the piece to revisit first.

---

## 5. Squad-pick step

**Not yet decided** — deferred, not answered.

The strawman on the table: a bench of ~6–8 (per `PROTOTYPE_PLAN.md`'s OQ-14 provisional value), auto-filled with a sane default squad, one tap to accept or swap a slot. Comes from the optional layer per STATE's layering — the core loop only needs the *accept-default* path to work end to end.

Not a blocker for building §1–§4: the core loop can be built with a default N=3 squad and a Play button, and the pick step slotted in later.

---

## 6. What's still open

Carried forward from the sections above, roughly in order of how much they block the build:

1. **The eligibility threshold** — set as a strawman at 40% of current max (§3). Can be looser now that the dip is escapable without a cascade.
2. **Whether the across-fights PRD reading in §4 is what was meant.**
3. **What the optional layer modifies in §3** — base chance, escalation step, cap, or which hero can go hot (what a bonus hit *does* is answered). Doesn't block the core loop, but it's the hinge the whole optional layer hangs off, so worth an early answer.
4. **The squad-pick step** (§5).
5. **The 5-vs-3 squad-size contradiction, still unreconciled:** `[2026-07-04]` and `[2026-07-11]` in DECISIONS.md fix the squad at 5 + bench; `STATE.md` still lists "5 individual heroes + bench" as optional-layer candidate content; the build uses N=3. Either those old entries are superseded, or the optional layer's headline effect is widening 3→5 — currently neither is written down.
6. **Whether attrition needs a bench to avoid spiraling.** Pulled forward by the 2026-07-31 attrition decision (DECISIONS.md): permanent death with only 3 heroes and no bench may be a pure downward spiral over a 5-fight run. To be settled by building, per the standing rule — but flagged here because it wasn't anticipated when attrition was decided.

All the numbers in §3 and §4 are strawmen for tuning by feel, not open questions in the same sense — they're meant to be changed by playing the build, which is the standing "learn by building" rule.

---

## How to use this doc

React section by section — agreeing, rejecting, or replacing each strawman is enough. Whatever survives becomes the input to the build. Anything that's a real decision rather than a working assumption gets proposed to DECISIONS.md before STATE.md is touched.
