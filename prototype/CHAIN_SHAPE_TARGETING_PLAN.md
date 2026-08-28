# Chain shape → chain targeting — design plan

> **Status:** brainstorming. Not approved, not executed, nothing logged in `DECISIONS.md`.
> **What this document is:** the design case for replacing chain *shape* with chain *targeting*,
> written to be picked up cold across several sessions and edited in place until it's ready to build.
> **Scope:** game mechanic only. No code, no implementation steps.
> **Companions:** `prototype/CHAIN_SHAPE_MATCHUPS.md` (what shape was supposed to do) and
> `prototype/CHAIN_SHAPE_LEVERAGE_FINDINGS.md` (the measurements that say it doesn't, plus the other
> directions that were considered and set aside). This document deliberately covers one direction only.
> **Home:** `prototype/CHAIN_SHAPE_TARGETING_PLAN.md`, alongside the two companions above. Edit it in
> place across sessions; answer §6 as the answers arrive.

---

## 1. Context — what's broken and why

### What the chain is

A hero's charge bar fills during a fight. When it crosses the threshold, that hero fires a **chain**:
a burst of bonus hits where each hit rolls dice to see whether there's another one. The hits get
bigger as the chain runs. Nobody knows how long it will go — that's the moment the whole prototype
exists to deliver: *"it paid off far bigger than I expected."*

A coin flip at ignition decides whether the chain aims at the enemy or **backfires** onto your own
side, same numbers, wrong direction.

That part works. It was played and judged, and the verdict was that the surprise lands.

### What chain shape was supposed to add

Each of the six heroes was given a different chain **shape** — how long its fuse runs and how
back-loaded the damage is. Every attacker's chain was normalised to be worth the same expected
damage (76) so no hero has a "bigger" chain. The pick was meant to be *shape*, not size.

At a reference attacker, the four attacker shapes pay out like this:

| Hero | Shape | Per-hit damage schedule | Biggest hit | Whiffs entirely |
|---|---|---|---|---|
| Hollow (tank) | short fuse, steep | 22, 131, 240 | 240 | 40% |
| Vex (damage) | short fuse, flat | 35, 70, 105, 140 | 140 | 35% |
| Bracer (tank) | long fuse, flat | 6, 11, 17, 23, 28, 34, 40, 45, 53, 60 | 60 | 22% |
| Rook (damage) | long fuse, back-loaded | 5, 11, 16, 22, 27, 51, 75, 99, 124 | 124 | 28% |

The theory was that "many small bodies vs. one big body" would make shape matter, because a chain hit
always strikes the **front-most living enemy** and **overkill is thrown away**. A 60-damage hit into a
48 HP grunt wastes 12. So long/flat chains should clear crowds efficiently, and short/steep chains
should want one fat health bar.

### What actually happened

Three findings, all measured:

**It doesn't move outcomes.** Of the eleven encounters, ten show no meaningful difference between the
four shapes. Forcing the whole roster onto a single shape moves run completion by 5 points; scrambling
which hero gets which shape moves it 1.9 points, inside noise. To notice the shape choice by feel would
take roughly 75 hours of play.

**It can't be seen.** Wasted overkill — the mechanic the whole theory rests on — is silently discarded.
Nothing on screen ever tells you a hit threw damage away. So even where the rule bites, you can't
learn it.

**It teaches something false.** Because the shapes carry equal value across unequal fuse lengths, a
short fuse *must* land bigger individual hits. Hollow's biggest hit is 1.94x Bracer's on identical
expected value, and Hollow whiffs entirely far more often. "Burster looks better" is a correct read of
what the screen shows and a wrong read of what it's worth.

### The diagnosis

Tu's report: *"I can't answer why I should go short fuse at all. Facing an enemy, I don't know what to
choose, so I pick randomly."*

Compare Dota, where every component is one clause and names its own condition: armour reduction is for
when they have an armoured tank; lifesteal is for when you need to sustain in the jungle; a hex is for
when your team lacks disables. The game is complex; each piece is simple. Crucially, **armour reduction
isn't better — it's better against armour.** The value is conditional on something you can see.

Chain shape was built the exact opposite way. Every attacker's chain is worth the same expected damage
by construction — not approximately, but as an equation solved at the start of every fight.

**You cannot build a mental model of a choice that has no right answer, and the design made "no right
answer" literally true.**

That is the root cause. It is not a comprehension failure and not a UI failure. And it is upstream of
the attribution problem: if no pick is right anywhere, nothing that happens can be claimed as yours.

---

## 2. The proposal — targeting, not timing

### The core move

Stop loading strategy and surprise onto the same axis.

Right now chain **length** carries both. It's the dice that make the cascade thrilling, *and* it's
supposed to be the strategic pick. That's why strategy has no room — any strategic weight put on length
competes with the randomness that makes it fun.

So split them:

- **Length and escalation stay exactly as they are.** That's the cascade. Don't touch it.
- **Shape stops being "when the damage arrives" and becomes "where the damage goes."**

### The rules

Every *attacker's* chain currently hits the front-most living enemy. Make *that* the hero's identity
instead:

| Hero | Rule | The one-clause model | Right when | Wrong when |
|---|---|---|---|---|
| **Bracer** | **Spread** — each hit moves to a new target | *Clears crowds* | Several small bodies | One big body |
| **Hollow** | **Focus** — every hit on the same target, overkill carries over | *Deletes one thing* | One fat health bar | open — see Q6 |
| **Rook** | **Siege** — always hits the highest-HP enemy | *Ignores chaff, goes for the wall* | A big body behind small ones | Everything is the same size |
| **Vex** | open — see §6 | — | — | — |
| **Cairn** | **Triage** — always heals the most hurt ally | *Saves whoever's closest to dying* | Chip damage on one hero | — |
| **Ward** | **Triage** — same rule, and it swings on the same beat | *Saves whoever's closest to dying* | Chip damage on one hero | — |

Focus's "wrong when" cell used to read *"a crowd of grunts."* That doesn't hold: with overkill carrying
over, focus chews through five 48 HP bodies at near-zero waste, and against one big body the carryover
clause never fires at all. Focus as written has no bad matchup. See Q6.

**The two healer rows describe today's code, not a proposal.** Every other row is a change this pass would
make; Cairn's and Ward's is what already ships. A healer chain heals the lowest-HP living ally, re-picked
on every hit (`sim/fight.ts:383`) — so healers were never on front-most targeting, and this table is the
first place that rule is written down. Nothing about them changes. They are listed because a hero missing
from the rules table reads as a hero with no rule, and the roster is six.

Both healers share the one rule; giving them a real axis of their own — spread a heal across the squad
versus dump it into one hero — is Q3's job and is deliberately not done here. Holding them fixed is also
what makes §4's gate attributable: if per-encounter results move, the attacker rules are the only thing
that could have moved them.

Their **"wrong when" blank is a different kind of blank from Hollow's.** Hollow's cell says *open — see Q6*
because the question was asked and focus has no answer yet — that is a live design bug. The healers' `—`
means the question wasn't asked this pass. It has an answer (see Q3), it just isn't load-bearing while
their rule is frozen.

### The three parts that ship together

Targeting is not one change, it's three — and all three are load-bearing. Chain shape already proved
what happens when you ship only the first: a mechanism that works in the simulation and does not exist
for the player.

**1. The rule** — what the chain does, per the table above. This is the mechanic.

**2. The readout** — when a hit wastes damage, the fight has to say so. A hit that reads
`40 (12 wasted)` is how the rule gets learned, and it gets learned by *watching* rather than by reading
a tooltip. Overkill is already thrown away today and has never once been shown; that silence is half of
why shape's whole "many bodies vs. one body" theory never reached anyone. A spread chain should also
visibly walk across different health bars, so the rule is legible from the motion alone.

A spread chain also has to show its target pool emptying, because Q1 rules that hits with no fresh body
are simply lost. Two parts, both needed: **every enemy already struck by the current chain gets visibly
marked**, so the player watches the valid-target pool shrink hit by hit; and when it empties, **the hit
still fires, still shows its escalated number, and reads as landing on nothing.** The first teaches the
rule before the sting arrives; the second confirms it.

Both parts exist for the same reason — a big number resolving to no damage, with nothing on screen
explaining it, reads as a bug. That misread is worse than the mechanic being invisible: a player who
thinks the game is broken stops reasoning about it at all. The end card has to separate hits that landed
from hits that whiffed for the same reason; a flat "9-hit chain" next to a tiny damage total is the same
misread in summary form.

**3. The name** — the pick screen leads with the rule, and shape appears only as the rule's
consequence. *"Rook — Siege. Goes for the biggest body. Slow to start, brutal if it runs."* No
sparkline, no "long fuse, back-loaded, knee at 5" — that is a specification, and nobody builds a
mental model out of a specification. Dota's pieces are simple because each is one clause, not because
each does little.

The stronger reason is that §3 makes shape *derived*. Once it is, shape carries no decision
information: Bracer's long/flat curve is not a second axis, it is a redundant re-encoding of "spread."
Showing it as a stat invites the player to reason about a variable that isn't one — they ask what
"flat" adds on top of "spread," the answer is nothing, and the screen gives them no way to learn that.
A sparkline would also be the only numeric thing on the card, and numbers read as the important part.
That is the exact route by which "burster looks better" happened in §1.

So shape still gets *said* — how long a chain runs is what sets expectations for the cascade, and the
cascade is what this prototype exists to deliver. It gets said as an effect of the rule, in plain
language, never as a stat:

- **Bracer — Spread.** Clears crowds. Many small hits, and it rarely ends early.
- **Hollow — Focus.** Deletes one thing. Three hits, and the last one is enormous.
- **Rook — Siege.** Goes for the biggest body. Slow to start, brutal if it runs.
- **Cairn — Triage.** Heals whoever's worst off. A long, steady fuse and the safest coin flip in the pool.
- **Ward — Triage.** Same rule, and it swings while it heals — at a real backfire risk to match.

The hero identity lines are written as specs today — "long fuse, flat growth", "front-loaded chain" —
and all of them get rewritten in this voice.

The healers' two lines are a rewrite, not a new promise: the rule, the fuse and the backfire risk are all
what Cairn and Ward already do (`sim/heroes.ts:276`, `:283`). Cairn holds the pool's lowest chain affinity
and Ward one of its highest, which is what "safest coin flip" and "a real backfire risk" are naming.

Ship the rule without the readout and the player can't learn it. Ship both without the name and they
can't reason about it before the fight, which is where the decision actually happens.

### Why this should work where shape didn't

**The condition is already on screen.** How many health bars are there, and how big? You don't need
teaching to *see* it — only to know it matters. That's the Dota property: the condition is visible and
the arithmetic is doable.

**It's genuinely conditional — for spread.** Spread into one 420 HP body throws most of its chain away
(Q1). The other half of that sentence used to read "focus into five 48 HP grunts throws most of its
damage away," and it isn't true: carryover makes focus efficient there too. Making focus conditional as
well is Q6, and the axis doesn't work without it.

**It keeps everything that already works.** Length is still rolled live, hit by hit. Escalation still
explodes past the knee. You still don't know how big a chain will get — you now just know what it will
*do*. The cascade and the surprise are untouched.

**It makes an existing mechanic load-bearing.** Wasted overkill is already in the game and was already
supposed to drive this axis. This is what finally connects it to a decision.

### The encounter pool it has to answer

The eleven encounters, and what each should reward:

| Enemy | What it is | Wants |
|---|---|---|
| **Pack** | 5 grunts, 48 HP each | **Spread** |
| **Ambush** | 4 fast raiders, 40 HP, hitting every 0.6s | **Spread** — urgent, can't afford waste |
| **Vanguard** (finale) | 240 HP body + 3 outriders, hunts your weakest | **Spread** + steady heal |
| **The Wall** | one 310 HP body, nothing else | **Focus / Siege** |
| **Anvil** | one 420 HP body, no telegraph at all | **Focus / Siege** — purest version |
| **Twins** | two 150 HP bodies, offset spikes | **Focus** — kill one, halve the incoming |
| **Duelist** | one body, wind-up fires twice as often | **Focus** — every second is another spike |
| **Warden** | heals itself 6 per beat | **Focus** — the textbook burst check |
| **Glass Pair** | two 90 HP bodies hitting for 14 | **Focus** — 90 HP dies to one steep hit |
| **Champion** (finale) | 230 HP body + two 62 HP guards | **Mixed** — clear guards, then siege |
| **Executioner** | hunts your lowest-HP hero, ignores your tank | **Mixed** — heal question more than a chain question |

**Immediate finding: the pool leans 6:3 toward focus.** If targeting becomes the axis, a spread pick is
under-served across a run — which either needs the pool rebalanced or spread compensated. Recorded here
as a live problem, not a solved one. See §5.

---

## 3. What targeting forces to change

Tu's question: do length, total expected damage, and the steep/gradual distribution need to change?

### Chain length — keep the numbers, stop treating it as a free choice

A targeting rule has a natural appetite for length:

- **Spread** scales with the *number* of hits — each hit is a new body. Spread on a 3-hit fuse clears
  nothing.
- **Focus and siege** scale with *hit size* — they want a big number, which means short and/or steep.

So length stops being an independent axis and becomes a consequence of the rule. The good news is that
**the existing fuses already line up**: Bracer is long and flat (spread), Hollow is short and steep
(focus), Rook is long and back-loaded (siege). Assign rules to fit the curves you already have and no
retuning is needed for the first pass.

**Risk if length stays a free choice:** the mismatched combinations — short spread, long focus — are
strictly worse than their siblings with no compensating upside. That is the dominated-pick problem the
2026-08-20 equalisation existed to kill, re-entering through another door.

### Damage distribution — steepness should become derived, not picked

- Focus and siege → steep is correct. Big number into a big bar.
- Spread → flat is correct. Even hits across even bodies.

**Risk if steepness stays an independent axis alongside targeting:** you get four combinations where
only two make sense, and the player has to filter noise to find signal. That's the problem this whole
plan is trying to solve — the current shape system already reads as two shapes rather than the five
designed.

**Consequence for the screen:** because length and steepness are both derived here, shape is no longer
information the player can act on, and it is not displayed as a stat. See §2, part 3 — the pick screen
leads with the rule and states shape only as its effect.

### Total expected damage — the number can stay, what it *means* cannot

The 76-damage target is fine as a nominal anchor. What breaks is *where it is true*.

Today "every chain is worth 76" is solved from the hero's own shape before the fight starts, with no
knowledge of the enemy. The moment targeting makes realised value depend on enemy composition, that
equation stops describing anything — the answer now depends on which encounter you drew.

So the equalisation has to move from a per-fight guarantee to a **pool-level property**:

> Every rule averages the same value **across the eleven encounters**. No rule is better over a run.
> But within any single encounter the gap between the best and worst rule should be *large* — target
> 15–25 points, against the ≤5 measured today.

This is how a Dota item is balanced: not weaker overall, weaker in specific games.

**Risk if this stays as-is:** the current equalisation is already calibrated against a payout that only
materialises about half the time, and it survives on a coincidence — burster over-realises its value
while wasting more to overkill, and the two errors nearly cancel. The findings doc says plainly: *"that
is luck, not design."* Targeting deliberately blows up overkill and makes it encounter-dependent, which
ends the coincidence. Whichever rule has the friendliest waste profile across the pool then wins
globally, invisibly, because the equation still says they're equal. A hidden dominance ladder is worse
than the visible one that was fixed.

**This is not an optional companion change. Targeting forces it.**

### The hot flag — it has to become two flags

One boolean (`isHot`, `sim/fight.ts:477`) currently does two jobs: it decides whether a chain rolls
another hit (`:484`) and it grants the 0.6x beat interval that makes a chaining hero visibly speed up
(`:479`, `cfg.hotBeatIntervalFactor`). Q1's decision needs those apart — after a whiff the chain must keep
rolling while the speed-up stops.

Left fused, "the whiff ends the speed-up" silently collapses into "the chain ends early," which is the
candidate Q1 rejected. The split itself is small: keep `hotHeroId` meaning "a chain is running" — the
render layer reads it to know who is chaining (`sim/fight.ts:617`) — and add a separate "still
accelerating" flag that the first whiff clears. The trigger already exists: `sim/fight.ts:488`
distinguishes *"the roll passed but `resolveChainHit` found no valid target"* from the other ways a
chain ends.

---

## 4. The measurement gate

Targeting is worth building only if it clears a pre-registered bar. The bar:

> **Per-encounter spread between the best and worst targeting rule goes from ≤5 points to 15+ points,
> while the pool-wide average stays flat across rules.**

Both halves matter. Spread without a flat average is a dominance ladder. A flat average without spread
is the status quo.

Two conditions have to hold before that number means anything:

**Fights 1–4 must be able to punish you.** They're currently near-certain wins for any sensible draft,
which is the leading explanation for why ten of eleven encounters measured flat — the question exists on
paper but never costs anything. If they stay free, a correct targeting design will *also* measure flat
and be wrongly discarded. Difficulty is already an open decision (roughly 9 points were handed back and
deliberately not re-compensated). Spend it here.

**The chain lockout has to be fixed first.** When a hero dies mid-chain, the chain system currently dies
with it for the rest of that fight — 4–5% of chains, and when it happens the mechanic is dead for 8–16
seconds of a ~20 second fight. Today that's noise. If chain identity becomes the strategic core, it's a
random deletion of the exact thing being measured.

---

## 5. Risks

**Backfire risk lives in one clause, and it is worse than "shrinks the roster."** Q2 mirrors the rule
onto your own side, and checking that against the code moved this risk rather than enlarging it.
Fielding sorts tank → damage → support (`sim/heroes.ts:331`), so a mirrored siege aims at your
highest-HP hero and a mirrored focus seeds on your front-most — both your tank — while spread lands one
hit per hero across a three-body field and then whiffs. Two of the three rules mirror *toward*
survivability. All of the danger is focus's **carryover**: a full-length Hollow chain is 393 damage
(22+131+240, §1) against a fielded squad worth 390 HP at full (Bracer 195 + Rook 85 + Cairn 110), and a
wiped player side ends the fight as a loss (`sim/fight.ts:523`). Mid-fight, already chipped, it needs
far less. So the standing bet — "one backfire should not durably shrink the live roster," written after
one betrayal benched Rook for eight straight fights — is collided with by exactly one clause, and the
failure mode is worse than the bet's wording: a wipe, not a benching. Q6 is the lever. See §6.

**The pool leans focus, 6:3.** Six encounters want one thing dead fast, three want a crowd cleared. Left
alone, spread is the weaker pick over a run even with per-fight equalisation, because the *fights* aren't
evenly distributed. Either the encounter pool gets rebalanced or spread gets compensated somewhere.

**Front-most targeting may be load-bearing.** Chains currently hit the front-most enemy, which shapes
kill order and therefore incoming damage. "Highest HP" and "new target each hit" change which enemies
die first across every fight in the pool. That's a bigger perturbation than the damage numbers suggest —
don't assume it's local.

**The whiff reads as a bug.** Q1 puts a fully escalated number on screen that resolves to no damage.
Without both halves of the readout in §2, the honest player reaction is "that's broken," not "spread was
the wrong pick." Cheaper to get wrong than shape's invisibility was, and worse — a player who thinks the
game is buggy stops reasoning about it entirely.

**Focus has no bad matchup as written.** Carryover makes it efficient against crowds and irrelevant
against a single body, so it is close to a strict upgrade on today's front-most rule everywhere. A rule
with no bad matchup cannot produce per-encounter spread — it lifts every encounter equally, which is
exactly what §4's gate is built to detect. Since Q2 mirrors the rule onto your own side, carryover is
also the one clause that can lose a run outright — see the backfire bullet above. Q6 answers both.

**Shipping the rule alone.** The readout and the name (§2) are not polish to be added later — without
them this becomes shape again: correct in the simulation, absent from the game. If the scope has to be
cut, cut a *rule* and keep all three parts for the rules that remain.

---

## 6. Open design questions

To be resolved across sessions. Q1 and Q2 are settled; everything else is open. Each question carries
candidate answers, then a **My read** line — that line is opinion, not a decision, and should be argued
with. Fill in **Decision** when you settle one, and add a line to §7.

---

### Q1 — What happens when a spread chain runs out of bodies?

Bracer has ~10 hits. Pack has 5 grunts. Anvil has 1. Opened as *"the single biggest balance lever in the
design"* — settling it showed that was true only because focus had no cost of its own to carry (Q6).

| Candidate | What it costs |
|---|---|
| **Remaining hits are lost** | Harshest. Spread into one big body genuinely throws its chain away, which is the cost that makes focus worth picking. Can feel infuriating. |
| **Chain ends early** | Cleanest to read — you see it stop and know why — and it makes fuse length itself conditional on the encounter. But spread then never has a *bad* moment, only a small one. |
| **Falls back to the last target** | Never feels bad, and removes the cost entirely. Spread becomes strictly safe and the tradeoff mostly evaporates. |

**Correction (2026-08-28):** the first two rows overstate the gap between them. Hits-lost and ends-early
deal identical damage — a hit with no target is worth zero either way. Only the third row is a real
numeric fork. See the decision below.

**My read:** hits are lost. It's the only one of the three that creates a real cost, and it has a
better surprise structure than it looks — you still get the full suspense of the chain rolling on, and
*then* the sting of realising it landed on nothing. That's a memorable way to learn the rule, which is
exactly what shape never had. The risk is that it's the most punishing thing in the game and it lands
on a roll you didn't control; if playtesting says it's rage-inducing rather than instructive, "chain
ends early" is the fallback.

**Decision (2026-08-28): remaining hits are lost — and the first whiffed hit ends the hero's speed-up.**

Plain "hits are lost" is not the harsh option this question assumed. The chain and the speed-up are the
same flag today (`sim/fight.ts:477`, read at `:484` and `:479`): a hero stays hot until its chain ends, and while hot
its beat interval is multiplied by `hotBeatIntervalFactor` (0.6) *and* it still lands its ordinary
attack on every beat. So a chain that rolls nine hits into an empty field collects the full length
reward anyway — the same chain damage as ending early, plus roughly five seconds of compressed normal
attacks for Bracer. As posed, hits-lost was the **more generous** of the two candidates, not the harsher
one, and this question was not the balance lever the heading claims.

The decision keeps the presentation that made hits-lost attractive — the chain rolls on, escalating, and
lands on nothing — and adds the cost that was assumed to already be there: **the first hit with no valid
target drops the hero back to its base interval** for the rest of the chain. Suspense-then-sting is
preserved, and now it is paid for.

Two riders. It requires splitting the hot flag in two (§3) — skip that and the decision silently becomes
"chain ends early." And it must not read as a bug (§2, part 2): a fully escalated number resolving to no
damage needs the used-target marks and the explicit whiff, or the player concludes the game is broken
rather than that spread was the wrong pick.

---

### Q2 — Does the targeting rule apply when a chain backfires?

| Candidate | What it costs |
|---|---|
| **Mirror the rule** | A spread backfire chips three of your heroes; a focus backfire dumps everything into one and probably kills them for the run. One rule, no exceptions. Worsens roster shrink. |
| **Backfires keep current targeting** | Safer for run health, but the rule now has an exception the player must hold in their head — spending some of the legibility this whole design is buying. |
| **Mirror it, but a backfire can't land a killing blow** | Consistent *and* survivable — leaves the hero at 1 HP instead of dead. Costs some of the stakes' honesty. |

**Correction (2026-08-28):** the middle row mislabels the status quo. A backfire does not use
front-most targeting today — `resolveChainHit` picks `pickWeightedTargetId(player, rng, cfg)`
(`sim/fight.ts:404`), re-rolled on *every* hit and weighted toward a tank while it holds aggro
(`:89`). Today's backfire is already a random, tank-biased spread. So the fork was never "the rule
versus front-most," it was "the rule versus a random walk" — and "keep current targeting" would have
preserved an exception that is itself unreadable.

**My read:** mirror it. Consistency is most of what makes a mental model, and mirroring gives focus a
real downside that spread doesn't have — power and risk on the same axis, which is the two-sided price
the design has been missing everywhere else. The concern is genuine though: this collides with the
standing bet that one backfire shouldn't durably shrink the roster (one betrayal already benched a hero
for eight straight fights). The no-killing-blow variant is the hedge if measurement says focus
backfires are ending runs outright.

**Rider from Q1 (2026-08-28):** if the rule mirrors, Q1's cost mirrors with it — a spread backfire runs
out of bodies after three heroes, so the hero would lose its speed-up while chipping its own side.
Whether that penalty should apply backwards is part of this question, not settled by Q1.

**Decision (2026-08-28): mirror the rule, symmetrically, with no hedge attached.**

Consistency is most of what makes a mental model, and mirroring is the only candidate that gives focus
a downside spread doesn't have — power and risk on the same axis, which is the two-sided price this
design has been missing everywhere else.

**The rule's target *selection* mirrors too**, and that matters more than the damage numbers do.
Fielding sorts tank → damage → support (`sim/heroes.ts:331`), so a mirrored siege aims at your
highest-HP hero and a mirrored focus seeds on your front-most — both your tank. Only spread scatters.
Mirroring therefore concentrates a backfire onto your most survivable body for two rules out of three,
which is gentler than this question assumed when it was written. §5 is re-sized to match.

**The Q1 rider resolves symmetrically.** A backfired spread chain that runs out of your own bodies
still drops the hero to its base interval on the first whiffed hit. The chain accomplished nothing for
you either way, the cost is a couple of seconds of cadence and never lethal, and an exception here
would spend exactly the legibility that picking mirror was meant to buy.

**It ships bare.** Neither hedge is attached: not the third row's no-killing-blow clause, not a
backfire-only cap on carryover. Both would pre-spend a lever before anything is measured, and both are
exceptions of the kind the first paragraph just declined. The run-health risk mirror creates is real —
a full-length focus backfire out-damages the entire fielded squad (§5) — but it lives entirely inside
focus's carryover clause, which is Q6's to write. That is the hedge: not an exception bolted onto Q2,
but a rule Q6 may word differently.

---

### Q3 — Do the two healers get rules as well?

Spread-a-heal-across-the-squad versus dump-it-into-one-hero is a real conditional axis: chip damage
everywhere wants the first, one hero about to die wants the second. The alternative is that healers stay
out of this pass entirely.

**My read:** attackers only for the first pass. Keeps the measurement clean — any change in
per-encounter spread is then attributable to the attacker rules alone, with nothing to disentangle. The
healer axis looks good and is worth building second, once the attacker axis has proved it clears the
gate in §4.

**Decision (2026-08-28): attackers only. Healers keep exactly the behaviour they have — but the rule they
already have gets named and stated in §2 alongside the attackers'.**

Two separate things, and the split is the whole answer. The *mechanic* is untouched: no spread-versus-dump
heal axis is built this pass, for the reason above — hold healers fixed and any per-encounter movement in
§4 is attributable to the attacker rules alone, with nothing to disentangle. The *statement* is not
untouched: healers now appear in §2's rules table and identity lines, because a hero absent from the table
reads as a hero with no rule, and the roster is six.

The heading's premise was slightly off. Healers do not lack a rule — they have an unnamed one. A healer
chain heals the lowest-HP living ally, re-picked on every hit (`sim/fight.ts:383`), and both healers run
that identical path; they differ in stats and chain profile, not targeting. So this pass names what exists
(**Triage**) rather than inventing anything. The real question — should Cairn and Ward have *different*
rules — is what waits.

**Two facts to carry into that later pass**, both discovered while writing the rule down, neither one
resolved here:

- Today's rule is greedy per hit. Heal the lowest, they stop being the lowest, the next hit moves on — so a
  long heal chain already tops the squad off in ascending order. "Spread a heal across the squad" is close
  to the status quo; "dump it into one hero" is the option that would actually be new.
- A healer chain **ends** when the squad is near full HP. The heal clamps against the target's missing HP,
  and with no room `resolveChainHit` returns null and the chain stops on that hit — `chainEnd` with reason
  `noTarget` (`sim/fight.ts:386`, `:528`). That is the reverse of what Q1 just decided for attackers, where
  a chain with nothing to hit keeps rolling and loses the hits. Two heroes' chains currently end early and
  four don't; whether that asymmetry is a flaw or a healer's correct behaviour is Q3's to settle when it
  reopens.

---

### Q4 — What is Vex's rule?

"Execute" (always hit the lowest-HP enemy) is the obvious fourth and it's structurally broken: as the
chain runs, escalation makes the hits *bigger* while the targets get *smaller*, so the rule fights
itself. The escalation curve only ascends and cannot express the descending damage execute wants.

| Candidate | What it costs |
|---|---|
| **Leave Vex on front-most for now** | One hero is temporarily uninteresting — but Vex doubles as a control: if targeting works, Vex should measurably underperform. |
| **Give Vex a rule that wants ascending damage** | Keeps all four attackers live. Needs a new condition designed from scratch — e.g. hits whatever your own heroes are already attacking, or hits the enemy about to act. |
| **Build execute properly, with a descending curve** | Execute is the most legible rule of the four ("finishes wounded things"). Most faithful to the idea, and the only option needing new escalation machinery. |

**My read:** leave Vex unchanged for the first pass. Three rules are enough to prove or kill the axis,
and having one hero deliberately outside the system is a free control — if the measurement shows Vex
holding its own against spread/focus/siege, the axis isn't working and no amount of designing Vex's
rule will save it. Execute is worth building after, and it's the one that justifies new machinery.

**Correction (2026-08-28):** two claims in the framing above don't hold. The **My read** directly above
rests on the first of them and is superseded by the revised read further down — read that one, not this
one.

*"Escalation makes the hits bigger while the targets get smaller"* is true for three encounters, not
eleven. Execute re-picks the lowest-HP **living** enemy, so each kill hands the chain a target larger
than the one before — the target sequence ascends alongside the damage curve rather than against it.
Waste does grow hit by hit against a uniform crowd (Pack, five 48 HP bodies). Against a mixed field —
Champion (230 + 2×62), Vanguard (240 + 3×50) — the ascent absorbs the escalation. The rule fights
itself only where every body is the same size.

**And small bodies really are the dangerous ones here.** Damage per second per point of HP, computed
from `sim/encounters.ts`. Not a monotonic ordering — Glass (90 HP) outranks Skirmisher (48 HP), and
Honor Guard (62) outranks Guard (55) — but a clean split at 100 HP:

| Under 100 HP | dps/HP | | Over 100 HP | dps/HP |
|---|---|---|---|---|
| Raider | 0.208 | | Twin | 0.049 |
| Outrider | 0.143 | | Champion | 0.048 |
| Glass | 0.111 | | Executioner | 0.048 |
| Honor Guard | 0.085 | | Vanguard | 0.046 |
| Skirmisher | 0.083 | | Duelist | 0.041 |
| Guard | 0.082 | | Warden | 0.029 |
| Acolyte | 0.073 | | Wall | 0.027 |
| | | | Anvil | 0.007 |

Every body under 100 HP is worth at least 1.5x any body over it. So killing the smallest first is the
tempo-optimal way to cut incoming damage per point of damage spent — and **siege is its genuine
mirror**, which makes Vex ↔ Rook an axis rather than a flavour difference.

**Revised candidates (2026-08-28):**

| Candidate | What it costs |
|---|---|
| **Leave Vex on front-most** (the original read above) | Still cheap, but the control it buys does not need a roster slot — a front-most baseline runs in the batch rig without occupying a hero. |
| **Execute** — always hit the lowest-HP living enemy | The tempo rule the pool's danger split rewards. Two blockers, below. |
| **Punish** — hit whatever enemy is currently winding up | The literal reading of "finish a dangerous enemy". Needs machinery that doesn't exist, and collapses onto siege where the biggest body is also the dangerous one. |
| **Execute with a descending curve** | Most faithful to the original fantasy; the only option needing new escalation machinery. |

**Blocker 1 — Q4 is downstream of Q6.** Execute is arithmetically focus-with-carryover *minus the
carry*: same greedy kill order, surplus discarded at each kill instead of passed on. So Q6 decides
which of Hollow and Vex is redundant:

- **Q6 keeps carryover** → focus dominates. Pack: focus kills 5, execute 3. Twins: focus kills both,
  execute one. Anvil / Wall / Duelist: identical. Vex is a worse Hollow.
- **Q6 picks "commits and wastes"** → execute strictly upgrades focus, and Hollow is the dead pick.

The one gap neither branch closes is **short chains into mixed fields**: 35 + 70 = 105 kills a 62 HP
Honor Guard, while the same 105 of focus goes into a 230 HP Champion and kills nothing. Vex whiffs 35%
and holds the pool's largest opening hit (35, against Hollow's 22, Bracer's 6, Rook's 5). *Converts a
fizzle into a kill* is Vex's real identity, and it lands in the mixed encounters §2's pool table
currently assigns to nobody.

**Blocker 2 — execute is the worst rule to mirror.** Q2 shipped bare on the finding that a mirrored
focus and a mirrored siege both aim at your tank. Execute breaks that finding: it aims at your weakest.
Fielded squad is Bracer 195 / Rook 85 / Cairn 110, and a two-hit backfire is 35 + 70 = 105 — a common
low roll:

| Mirrored rule | Result at 105 damage |
|---|---|
| Spread | Rook at 15, nobody dies |
| Focus | into Bracer, survives |
| Siege | into Bracer, survives |
| **Execute** | **Rook dead** |

Execute is the only rule where a short, frequent backfire kills a hero outright, and it kills the
fragile one by construction — the standing bet's exact wording (*"one backfire should not durably
shrink the live roster"*, written after one betrayal benched Rook for eight fights). It also duplicates
`windupTargeting: "lowestHp"`, which Executioner and Vanguard use — the mechanic the pool uses to
signal cruelty.

**Revised read (2026-08-28):** take the bet — Vex gets a rule, and execute is the right one. But do not
write the decision until Q6 lands, because Q6 decides whether execute is a strict downgrade on focus or
a strict upgrade on it. When it is written, state Vex's condition as *small bodies in front of a big
one*, not *crowds* — the mixed lane, not spread's. And put the two-hit backfire on §4's measurement
list as the likeliest reason Q2's no-killing-blow hedge has to reopen.

**Punish stays live rather than discarded.** Eight of the eleven encounters telegraph
(`windupTelegraphSec` 1.5s, `windupDamageMultiplier` 2.0), killing the charger cancels the spike, and
the value is measurable as damage *prevented* rather than dealt. Its bad matchup is already in the pool
— Pack, Ambush and Anvil have no wind-up at all, which would hand spread the lane §5's 6:3 lean says it
needs. It is the answer if the fantasy wanted is the literal one; execute is the answer if the bet is
about tempo.

**Decision:** _unanswered — gated on Q6._

---

### Q5 — Does the encounter pool get rebalanced toward spread, or does spread get compensated?

Follows from the 6:3 focus lean in §5. Six encounters want one thing dead fast, three want a crowd
cleared, two are mixed. Left alone, spread is the weaker pick over a whole run even with per-fight
equalisation, because the *fights themselves* aren't evenly distributed.

**My read:** defer this one until after the first measurement. The measurement tells you the actual size
of the imbalance, and guessing at it beforehand risks over-correcting a problem that per-fight spread
may already largely handle. Worth flagging now so it isn't discovered late.

**Decision:** _unanswered_

---

### Q6 — What is focus's bad matchup?

Opened while settling Q1. Focus as written has none. *"Every hit on the same target, overkill carries
over"* means five 48 HP grunts die at near-zero waste, so the crowd matchup isn't bad. And against one
420 HP body the carryover clause never fires, so the single-body matchup isn't special either. Focus
comes out close to a strict upgrade on today's front-most rule, everywhere.

That asymmetry is upstream of Q1. Because focus carried no cost, spread was the only rule holding any
conditionality, which is why Q1 ended up described as "the single biggest balance lever in the design" —
it was carrying the whole axis on its own.

| Candidate | What it costs |
|---|---|
| **Focus commits and wastes** — it keeps hitting its chosen target, overkill discarded, until the chain ends | Symmetric with spread: spread strands hits in an empty field, focus strands hits in a dead body. Both rules then have a bad matchup, and Q1 stops carrying the axis alone. Loses the "deletes one thing cleanly" fantasy. |
| **Carryover, but capped** — surplus carries to the next body only once per chain | Keeps most of the fantasy while putting a ceiling on crowd efficiency. Harder to state in one clause, which is the property §2 is buying. |
| **Leave focus as-is** | Simplest, and honest if measurement says the pool-wide average stays flat anyway. Risks the hidden dominance ladder §3 warns about. |

**My read:** give focus a real cost. §4's gate wants 15+ points of per-encounter spread, and a rule with
no bad matchup can't produce it — it lifts every encounter equally, which measures as flat. That is the
same failure chain shape already had, arriving from the other side.

**Promoted by Q2 (2026-08-28): Q6 is load-bearing twice.** It was opened as a per-encounter-spread
problem. Mirroring the rule onto your own side makes it a run-health problem as well — carryover is the
one clause that lets a backfire out-damage the whole fielded squad, 393 against 390 (§5), and "focus
commits and wastes" caps a focus backfire at one death by construction, with no exception needed
anywhere. Q2 shipped without a hedge on the strength of that. If Q6 keeps carryover, Q2's
no-killing-blow variant becomes the fallback and has to be reconsidered there.

**Also gates Q4 (2026-08-28).** Execute — the candidate Vex's rule — is focus-with-carryover minus the
carry: same greedy kill order, surplus discarded at each kill. So whichever way this question lands,
one of Hollow and Vex is dominated by the other. Keep carryover and Vex is a worse Hollow; take
"commits and wastes" and Hollow is the dead pick. Q4 cannot be written before this one.

**Decision:** _unanswered_

---

### Q7 — Is being hot too much of a free ride?

Raised and parked while settling Q1. Firing a chain currently grants three things at once: the bonus
hits, the hero's ordinary attack continuing on every beat, and a 40% faster cadence for as long as the
chain runs. Nothing is given up. And the cadence reward scales with chain *length* regardless of whether
that length accomplished anything — which is what made plain hits-lost come out generous.

Q1 takes one bite out of this, but only in the whiff case. The general question — whether a chain should
cost the hero anything at all — is untouched, and it is bigger than targeting.

**My read:** not this pass. It reaches past targeting into the charge mechanic, and changing it would
contaminate the §4 measurement. Worth a look once targeting has cleared or failed the gate.

**Decision:** _unanswered_

---

### Q8 — Does spread clear its own best matchup?

Opened while working Q4. Bracer's ten hits are 6, 11, 17, 23, 28, 34, 40, 45, 53, 60 (§1). One hit per
body into Pack — five grunts at 48 HP — delivers 6+11+17+23+28 = 85 and kills nothing; Q1 then loses
the remaining five hits, 232 damage. So spread converts 85 of 317 in the encounter §2's pool table
labels *Wants: Spread*. Ambush (4×40 HP) is the same shape with one body fewer.

The cause is ordering, not the rule. Spread's hits are smallest exactly when its target pool is
largest: the early hits land where they cannot kill, and the hits big enough to kill a grunt arrive
after the pool is exhausted.

| Candidate | What it costs |
|---|---|
| **Front-load Bracer's curve** | Cheapest fix, contained to one hero. Erodes the "long fuse, flat" identity §3 leans on to make shape derivable from the rule. |
| **Let spread take a second lap once the pool empties** | Fixes it everywhere at once. Partly reverses Q1, settled the same day, and removes most of spread's cost. |
| **Re-scale the crowd encounters down** | Keeps both the hero and Q1 intact. Perturbs difficulty, which is already an open decision with ~9 points hanging on it. |
| **Accept it** | Honest if measurement says spread clears §4's gate anyway. Risks the gate reading a tuning bug as a verdict on targeting. |

**My read:** measure before choosing. If this holds, §4's gate is compromised before it runs — spread
measures weak for a reason that has nothing to do with targeting, and the 15-point spread test reads as
a dominance ladder rather than a tuning bug. Worth confirming in the batch rig ahead of the gate; not
worth designing around yet.

**Decision:** _unanswered_

---

## 7. Session log

Append one line per session. Newest at the bottom.

- **2026-08-28** — Document created. Diagnosis agreed: equal-EV-by-construction is why chain shape has
  no mental model. Targeting adopted as the single direction to develop. Q1–Q5 opened with a marked
  recommendation on each, none answered. Nothing logged in `DECISIONS.md` yet — the direction itself
  becomes loggable once Q1 and Q2 are settled.
- **2026-08-28** — Presentation settled: the pick screen leads with the targeting rule and states shape
  only as the rule's consequence, in plain language — no sparkline, no spec vocabulary. Reasoning: §3
  makes shape derived, so it carries no decision information, and showing it as a stat invites the
  player to reason about a non-axis. Replaces §2's earlier "the sparkline and the numbers can live
  underneath." Q1–Q5 still unanswered; still nothing in `DECISIONS.md`.
- **2026-08-28** — Q1 settled: remaining hits are lost, with the first whiff ending the hero's speed-up.
  Found while writing it up that plain hits-lost is *more generous* than ending early, not harsher —
  identical chain damage, and hot (0.6x beat interval plus the ordinary attack every beat) runs for the
  whole fuse either way. Forces the hot flag to split in two (§3). Whiff readout specified in §2: mark
  used targets as the chain walks, then show the whiff explicitly, so it doesn't read as a bug. Q6
  opened — focus as written has no bad matchup, which is why Q1 was carrying the whole axis alone; §2's
  focus row corrected. Q7 opened and parked — being hot is currently pure upside. Nothing in
  `DECISIONS.md`: the gate is Q1 *and* Q2, and Q2 is still open.
- **2026-08-28** — Q2 settled: mirror the rule, symmetrically, shipped bare. The Q1 rider resolves with
  it — a backfired spread chain still loses its speed-up on the first whiff, no exception. Three
  corrections came out of checking the decision against the code: a backfire today is weighted-random
  and re-rolled per hit, not front-most (`sim/fight.ts:404`), so the fork was rule-versus-random-walk;
  mirroring aims siege and focus at your own tank, so it is gentler than §5 assumed; and focus's
  carryover can put 393 damage into a 390 HP field, making the failure mode a wipe rather than a
  benching. §5's backfire bullet re-sized. Q6 promoted to load-bearing twice — it is now the hedge Q2
  declined to hard-code. The `DECISIONS.md` gate (Q1 *and* Q2) is met and deliberately **not**
  exercised: an append-only entry saying "focus carries overkill over" is one Q6 could partly reverse.
  Log the direction once Q6 lands.
- **2026-08-28** — Q4 worked, not settled. Two claims in its framing corrected: execute's targets
  *ascend* after each kill, so "escalation fights itself" holds only for a uniform crowd; and
  damage-per-second-per-HP splits cleanly at 100 HP across the pool (`sim/encounters.ts`), so
  lowest-HP is a fair proxy for dangerous and siege is execute's true mirror. Vex gets a rule and
  execute is it — but the decision is **gated on Q6**, because execute is focus-with-carryover minus
  the carry, so carryover makes Vex redundant and commit-and-waste makes Hollow redundant; Q6 now
  carries the reciprocal note. Execute's mirror is the pool's worst: a two-hit backfire (105) kills
  Rook outright where focus, siege and spread all leave the squad standing — the standing bet's exact
  failure mode, and the likeliest reason Q2's declined hedge reopens. Punish (hit whatever is winding
  up) kept live as the alternative if the literal "dangerous" fantasy is what's wanted. Q8 opened —
  spread delivers 85 of 317 into Pack and kills nothing, so §4's gate may measure spread weak for a
  reason unrelated to targeting. Nothing in `DECISIONS.md`; the gate is still Q6.
