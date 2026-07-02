# Casual Autobattler — Project Strategy

## Snapshot
- **Genre:** Casual mobile auto-roguelite — roguelike run structure + autobattler combat; squad/formation building, permadeath, meta-progression
- **Market:** US; ads-first monetization → hybrid (ads + IAP) when retention is proven
- **Team:** 2 people + AI; experiment stage — proving the model before scaling
- **Distribution:** Friend owns this — paid install ads to acquire first cohort, scale on creative performance

## The Bet
Lower the entry barrier of a deep/strategic genre for casual players → fresh creative hook drives cheap install CPIs → scale via paid UA. The shape is proven (Archero / Habby catalog). The arbitrage is real but lives in the **hook**, not the genre — a novel, showable hook = cheap installs; a generic one = commodity Archero CPI.

## Status
- Strategy validated as sound; concept defined and stable
- `prototype.html` exists — treat as an *intent sketch only*; it drifted complex (21 classes, 8 stats, 11 status effects) despite the casual goal; not the design spec
- Nothing built toward the real hook yet — **that's the current gap**

## Watch-outs
- Low-CPI bet depends on a **fresh hook**, not genre supply — same lever as "make it fun"
- Architect a **hybrid economy now** (coins, sinks, rewarded-ad slots) even if IAP ships dormant — can't bolt it on later
- Write a **design pillar** and use it: *"when in doubt, cut it; a non-gamer must read the screen in 5 seconds"* — devs drift complex by default (prototype proved it)
- **Fun-to-us ≠ fun-to-a-stranger in 60 seconds** — keep both bars, not just the first one

## Next
**Open decision — choose the fantasy (this defines everything downstream):**
- *"I'm powerful"* — squad snowballs into something absurd; spectacle-first; most ad-friendly
- *"I'm a collector"* — discover and assemble a roster you love; strong IAP tail
- *"I'm clever"* — outsmart fights with the right formation; cerebral, invisible, hard to ad — **steer away from leading with this for casual+ads; let it be the retention tail, not the hook**

**Then execute in this order:**
1. Fill in the sentence: *"This game lets me ___, and the ad moment is ___"*
2. Build **only** that one 30-second "money moment" — not 21 classes, just the atom of fun
3. Cut a 15-second clip (even faked) → run a cheap CPI test → validate before full build
