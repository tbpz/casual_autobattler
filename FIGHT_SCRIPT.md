# Fight Script — a concrete draft of the core loop's 30 seconds

> **What this file is:** a scratch draft, not part of the STATE/DECISIONS discipline (like `PROTOTYPE_PLAN.md`). Its job is to turn the core loop from relationships ("RNG triggers, emergence amplifies") into a picturable scene: a clock, a named number, and a screen. Everything below is a **strawman** — react to it (agree / change the number / reject the mechanic) rather than treating it as settled. Nothing here is a decision until you say so; if something below does firm up, it gets logged to DECISIONS and folded into STATE the normal way.
>
> Written in response to "which detail design am I lacking to visualize the core loop." The four gaps identified were: (1) a beat sheet / clock, (2) a named number, (3) what a cascade concretely is, (4) how jeopardy is guaranteed without being fake. This draft proposes an answer to all four so you have something to react to instead of a blank page.

---

## 1. The beat sheet (the clock)

A single fight, scripted second-by-second. Placeholder squad: **3v3**, one screen, no camera cuts.

| t | Beat | What's on screen |
|---|---|---|
| 0:00 | **Press play.** | Squads snap into position. No animation yet — this is the "I chose this" freeze-frame. |
| 0:00–0:08 | **Opening exchange.** | Both squads trade normal attacks. The named number (see §2) moves in small, boring increments. Nothing surprising happens — this is establishing footage, not filler to be skipped. |
| 0:08–0:16 | **The dip.** | The player's squad visibly loses the exchange — HP bars trend red, a hero goes down, the number stalls or reverses. **This must read as "losing" to someone glancing at the screen with no rules knowledge.** This is jeopardy (§4), and it is mandatory every fight, not just when the dice cooperate. |
| 0:16–0:20 | **The trigger.** | Somewhere inside (or right at the end of) the dip, the RNG check fires. Visually: a distinct tell — screen-shake, a flash, a name-callout — so "something just happened" reads even to a player who wasn't watching closely. |
| 0:20–0:27 | **The cascade.** | The named number breaks its previous pace — not a nudge, a runaway. Numbers should look qualitatively different in this window than in the opening exchange (bigger font pop, faster tick, a distinct sound). This is the "far bigger than expected" clause and it needs to be *visually* distinguishable from the 0:00–0:16 window or it won't read as a spike. |
| 0:27–0:30 | **Resolve.** | Win/loss lands, run-scoped stakes settle (something is banked or lost — see STATE's stakes-shape decision), retry button appears. |

**Open for you to react to:** is ~30s the right length, or does a mobile casual session want ~10–15s fights (more retries per sitting) or ~45–60s (more room for the dip to feel earned)? This single number resets a lot of the rest of the pacing math.

---

## 2. The named number (the scoreboard)

Balatro is picturable because one number (chips × mult vs. the blind) carries the whole screen. This loop needs its equivalent. Strawman candidate: **Squad Power Remaining**, shown as a single bar or meter per side, not raw HP-per-hero (too many numbers to track at a glance).

- Normal exchange: moves in small steps, roughly symmetric between both sides.
- The dip: player's meter drops faster than the enemy's — this is what makes the loss *visible*, not just implied by unit deaths.
- The cascade: player's meter either rockets back up or the enemy's collapses — the number itself does something it wasn't doing a second ago.

**Open for you to react to:**
- Is the number **squad power / HP-remaining** (a defense-flavored comeback), or is it closer to Balatro's **accumulating score vs. a target** (an offense-flavored jackpot)? These read very differently on screen and imply different cascade mechanics (§3).
- Is there one number, or two (player meter + enemy meter, read against each other)?

---

## 3. What the cascade concretely *is* (squad-fight terms, not token-row terms)

The probes tested cascades as abstract token rows. A squad fight needs the cascade to be something specific units do. Candidates, pick one (or name your own) rather than leaving it abstract:

- **A. Chain-kill snowball** — one kill grants the killer a stacking buff (attack speed / damage) that makes the next kill faster, which stacks again. Reads as a single hero "popping off." Easiest to make legible (camera/highlight can follow one unit).
- **B. Revive/rally wave** — one or more "dead" heroes on the player's side comes back or gets a burst heal simultaneously, flipping the meter in one beat. Reads as "the team turns it around together," which may match "a cascade I set in motion" better than a solo carry does.
- **C. Escalating crit/proc chain** — each hit has a small chance to trigger a bonus hit, and bonus hits raise the chance further, so a proc either fizzles harmlessly or runs away exponentially. Closest to the friend's originally-cited Dota/crit reference and to the RNG-only probe's shape — you already know this one is fun for him, but it's the design that scored weakest on Tu's own "decision-density" read since it isn't a decision, it's a trigger.

**Magnitude:** whichever mechanic, name the size of the spike relative to a normal exchange — e.g. "the cascade should do in 5 seconds what would otherwise take 20," or "a cascade swing should be enough to flip a 70%-lost fight into a win, but not enough to win from a 95%-lost fight" (i.e., it amplifies, it doesn't guarantee).

**Open for you to react to:** which of A/B/C (or a fourth option) feels closest to the shared lead moment when you picture it? This is probably the single highest-leverage answer in this whole doc, since the render, the sound design, and the "what does the optional layer's synergy actually modify" question all key off it.

---

## 4. How jeopardy is guaranteed without being fake (the trigger rule)

STATE commits to two things that need one mechanism to both be true: **the dice decide when the cascade fires**, and **the fight must always look lost first**. Left unspecified, these two rules can contradict each other (a roll could fire at t=2, before anything looks at risk).

Strawman resolution — a **two-stage gate**, not a single roll:

- **Stage 1 — eligibility gate (deterministic, not random):** the cascade cannot become *possible* until the sim detects a jeopardy condition — e.g. player squad power has dropped below some threshold (40%? 30%?) relative to the enemy's. Before that threshold, the RNG check isn't even being rolled. This is what guarantees "looks lost first" without it being staged/fake — it's a real state the sim reaches through normal combat resolution, not a scripted animation.
- **Stage 2 — trigger roll (random, per tick, once eligible):** once eligible, each tick rolls a chance for the cascade to fire. This is what supplies "couldn't fully predict when."

**What happens on the fights where it never fires** is the other open half of this: does the player just lose (jeopardy without rescue, some fraction of the time), and if so what fraction feels fair for a casual audience? A cascade that fires 100% of the time once eligible isn't a cascade, it's a scripted comeback — but 100% *of eligible fights ending in a win* may be exactly what a floor-for-the-friend needs. This trade needs a number, not just a shape.

**Open for you to react to:**
- What's the eligibility threshold (how bad does it need to look before the cascade becomes possible)?
- Once eligible, does the cascade fire in 100% of fights (guaranteed-once-eligible, dice only decide *when* inside a fixed window) or can a fight be eligible and still lose (dice decide *whether*, not just *when* — true jeopardy, at the cost of the floor's reliability)? This is a real, felt tradeoff, not a technicality.

---

## Squad-pick step (the one interaction in an otherwise zero-decision loop)

Not one of the four core gaps, but needed to make the beat sheet's t=0 concrete: pick from how many heroes, in how many taps, with what default? Strawman: a bench of ~6–8 (per `PROTOTYPE_PLAN.md`'s OQ-14 provisional value), auto-filled with a sane default squad, one tap to accept or swap a slot. Comes from the optional layer per STATE's layering — the core loop only needs the *accept-default* path to work end to end.

---

## How to use this doc

Read top to bottom, react section by section — agreeing, rejecting, or replacing each strawman is enough; you don't need to write essays back. Whatever survives becomes the input to the build (and, for anything you'd call a real decision rather than a working assumption, gets proposed to DECISIONS.md the normal way before STATE.md is touched).
