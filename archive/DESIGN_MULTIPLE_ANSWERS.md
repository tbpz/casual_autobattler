# Giving a fight more than one right answer

Written 2026-09-18, not yet built or decided. Everything here is proposal, to be judged by reading
it cold and then by playing it once built — check `../DECISIONS.md` for whether any part of this
has since been confirmed as a decision.

## The complaint

Tu's read: the chain choice is clear but too obvious. "Slam → Bracer" is a fine thought to have, but
it should not be the *only* way to deal with a slam. There should be several ways to resolve it —
some standing out more than others, but none of them the obvious only choice, the way Bracer is now.
Player should want to try a new way because it looks promising, not because the old way ran out.

`REFERENCE.md` already says opponent squads are "full-info puzzles with **multiple solutions**", and
that optional-layer decisions "must resist a single dominant move." This complaint is that rule not
being met, not a new want.

## Why it's true — three causes, stacked

**1. The screen prints the answer.** Each hero carries a fixed line, and the enemy carries a blurb,
and they share a word. Bracer's line is `"Good against slams."`; Twins' blurb is `"Two slams,
offset."` Nothing is being read — the words are being matched. The line is identical on every
screen and every encounter regardless of which enemy is drawn.

**2. Each enemy asks exactly one question.** All 11 encounter blurbs are one rhetorical question
each — one trait in, one effect out.

**3. The one that matters: only two of the six chain effects can touch a slam at all.** This is true
in the code, not just in the wording. A bruiser's wind-up state is read and written by exactly two
effects: `guard` redirects the whole slam onto the guardian; `stun` cancels the wind-up outright.
The other four — `strikeAll`, `poundBiggest`, `mendAll`, `mendOne` — are plain damage or healing
against a side; they never touch the wind-up. So "there should be several ways" is currently false
in the mechanics, not just unclear on the pick screen. No rewording creates a route that doesn't
exist. Cause 3 has to move first; 1 and 2 are cheap once it does.

Also worth stating: a slam today is all-or-nothing. It lands whole, gets redirected whole, or gets
cancelled whole. There's no such thing as three-quarters of an answer.

## The design

### A — a slam becomes a number you can chip at

> **Built 2026-09-18, cut 2026-09-19.** Measured nearly inert — 2.3%-3.2% of slams ever chipped,
> run completion inside seed noise — and removed outright rather than retuned. See DECISIONS.md's
> 2026-09-19 entry and `260919_BATCH_FLINCH_ON.md` for the numbers. Don't rebuild this as written;
> a different mechanism is needed for the damage-effect route against a slam.

A bruiser winds up for 1.5 seconds before the slam lands. Today that window is dead time. Give the
slam a damage figure set when the wind-up starts, and let a chain hit landing during that window
knock it down — hit the boss mid-wind-up and the slam that lands is smaller. Call that a **flinch**.

**Only a chain hit flinches a wind-up. A normal attack does not.** This restriction matters — see
Risks, below.

That turns one threat into six answers, in four different currencies:

| Hero | Route | Covers |
|---|---|---|
| Bracer `guard` | takes the slam instead | all of one slam |
| Hollow `stun` | cancels the wind-up | all of one slam |
| Rook `poundBiggest` | lands on the biggest body — usually the slammer — flinching it hard | most of one slam |
| Vex `strikeAll` | hits every body, flinching all slammers a little | a little of every slam |
| Cairn / Ward | heals the slam back off after it lands | part of it, after the fact |
| nobody | eat it on raw HP | all of it, at a price |

Neither guard nor stun is a sure thing — both depend on the chain firing inside that 1.5s window,
which nobody can call in advance. That uncertainty is the point: it's the same dice the project
already bets on elsewhere.

### B — every encounter pushes on two things at once

No new mechanics — the pieces an encounter is built from already exist and are just used one at a
time today: headcount, per-body HP, damage, cadence, slam cadence, slam offset, slam aim (weighted
vs. always-the-weakest), enemy self-healing.

**Rule: every encounter's blurb names two pressures, and no single chain effect covers both.** Twins
gets grunts added, so it's slams *and* chip damage — Bracer covers the slam, Cairn covers the chip,
neither covers both. Warden already has both a slam and self-healing in the code; its blurb should
say so instead of naming only the heal. The Wall is one huge body and nothing else, so its second
pressure is your own attrition over a long fight — it needs a clock, not a second enemy trait.

Exact per-encounter numbers are a tuning pass, not part of this design — they land once the rule is
agreed.

### C — heroes leave state behind that another hero's chain can use

Only one chain runs at a time — whoever's charge is highest fires, and everyone else waits their
turn. So two chains almost never overlap; setup between heroes only works if it survives past the
chain that made it. Two things already do: a freeze lasts seconds after the chain that cast it ends,
and guard charges wait indefinitely instead of expiring.

One rule, one number, and it reads on screen: **a frozen body takes more from the next chain hit
that lands on it.** It can't brace. That makes Hollow-then-Rook a real pairing — and it's stated as
something the *enemy* has (can't brace while frozen), not as a bigger number on Rook, which is the
distinction that mattered every time a lever like this died before (see Risks).

### D — the pick screen stops naming the answer

Drop the fixed "against" line. Replace it with what this hero's effect would do **against the
encounter just drawn**, written for every candidate, so several read as live at once. Against Twins:

- Bracer — "Eats one slam per link. Two slammers, so it covers one at a time."
- Rook — "A chain landing mid-wind-up knocks the slam down hard. One slammer at a time."
- Vex — "A chain hits both slammers at once, so both wind-ups land smaller."
- Cairn — "Heals back about one slam's worth per chain."

**Never print one comparable number per hero.** Comparable numbers reduce a pick to picking the
biggest, which is exactly what killed the payoff-size lever before. Print the shape of what happens,
not its size.

## What this must not become

Four chain-identity levers have already died in this project: payoff size, backfire-as-risk, chain
shape, and chain targeting. All four described something the hero's own chain does — a number, a
curve, a risk, an aim rule — with no enemy on the other side of it to be weak to, so there was
nothing for a player to remember. None of the above repeats that shape. Every part here names
something the *enemy* has: a wind-up that can be interrupted, a second pressure, a body that can't
brace. That's the distinction the project's own postmortem drew.

Two real risks, named rather than assumed away:

**Damage could become the best defensive stat again.** That's the documented failure from earlier in
the project: every threat was time-metered, so killing faster reduced all of them at once and
nothing charged a price for raw damage. Flinching is exactly that shape. The guard against it is
that only chain hits flinch — a chain is uncertain and fires only a handful of times a fight. If the
batch shows damage heroes pulling ahead pool-wide once this is built, the flinch is wrong and should
be cut, not retuned.

**None of it matters if the fight is already decided before the pick screen.** A prior measurement
found 10 of 11 fights settled before any pick-time lever gets a turn. That's a different problem from
whether the win rates are currently tuned right, and needs its own answer — not assumed to be fixed
by this work.

One more principle, because it's what makes a second route feel worth trying rather than just
available: **the obvious answer should stay obvious, but become merely adequate.** Bracer-against-
slams is the floor — reliable, small. The routes worth reaching for are the ones that might fail and
might end the fight early.

## How we'd know it worked

Two gates. The batch can't judge the part that matters most, so it isn't the deciding one.

**The read gate — the real one.** At the field-pick screen, cold, per encounter: name two routes
worth considering, and say which is the safe one and which might pay bigger. If only one route comes
to mind, the design failed regardless of what any batch run says.

**The batch guard — a floor, not a target.** Pool-wide spread between heroes stays small — no hero
becomes dominant across all 11 encounters. Per-encounter spread rises. Run at full scale
(`--n 1000`+), not `--quick`.

## Files this touches when built

- `prototype/src/sim/fight.ts` — wind-up state gains a damage figure set at telegraph start; a chain
  rung landing during a live wind-up knocks it down; a frozen body takes more from a chain hit.
- `prototype/src/sim/config.ts` — the new tunables, alongside the rest. Drop the fixed `against`
  strings out of `chainEffectLines`.
- `prototype/src/sim/encounters.ts` — a second pressure per encounter; blurbs rewritten to name both.
- `prototype/src/sim/projection.ts` — the per-hero, per-encounter line that replaces `against`.
- `prototype/src/render/fieldPickScreen.ts` and `render/heroPickShared.ts` — render that line; the
  hero row becomes encounter-aware for the first time.
- `prototype/src/render/fightView.ts` — a flinched slam has to read as flinched on screen, or the
  route is invisible and nobody can attribute their pick to it.
- `prototype/src/checks/chaindist.ts` — assertions that a flinch is provable, matching the shape of
  the existing guard and freeze checks.

## Before building

Do not tune the win rates first. Part B is a difficulty change to all 11 fights on its own, before
the flinch adds another — any tuning pass now gets undone by the thing it was tuning for. What comes
first is a baseline snapshot to compare against later, not a fix: see
`260918_BASELINE_BATCH_PRE_MULTI_ANSWER.md` in this folder.

Leave alone while building: the two pinned squads (`rook+vex+ward` near 0% completion,
`bracer+cairn+ward` near 5-8%) and the `chaindist.ts` guard that's deliberately left failing —
moving either would hide the effect this design is meant to be judged against.
