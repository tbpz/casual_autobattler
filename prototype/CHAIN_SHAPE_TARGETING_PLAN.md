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
always strikes the **front-most living enemy** and was believed to throw overkill away — a 60-damage
hit into a 48 HP grunt was believed to waste 12. So long/flat chains should clear crowds efficiently,
and short/steep chains should want one fat health bar. **This turned out to be false — see the fourth
finding below.**

### What actually happened

Three findings, all measured:

**It doesn't move outcomes.** Of the eleven encounters, ten show no meaningful difference between the
four shapes. Forcing the whole roster onto a single shape moves run completion by 5 points; scrambling
which hero gets which shape moves it 1.9 points, inside noise. To notice the shape choice by feel would
take roughly 75 hours of play.

**It can't be seen.** Nothing on screen ever tells you a hit threw damage away. So even where the rule
bites, you can't learn it. (This finding survives the fourth one below unchanged: even on the rare hit
that runs past the last body, nothing reports it.)

**It teaches something false.** Because the shapes carry equal value across unequal fuse lengths, a
short fuse *must* land bigger individual hits. Hollow's biggest hit is 1.94x Bracer's on identical
expected value, and Hollow whiffs entirely far more often. "Burster looks better" is a correct read of
what the screen shows and a wrong read of what it's worth.

**The mechanism the theory rests on barely exists (found 2026-08-29, Phase 0 of
`CHAIN_TARGETING_IMPLEMENTATION_PLAN.md`).** `applyDamageFrom` does not throw a killing blow's leftover
damage away — it carries it onto the next living body on that side, same as a cleave. A chain hit only
loses damage when it runs past the very last body on a side, which is rare. Measured directly: turning
that spill off (`chainHitSpillsOverkill: false`) and re-running the per-encounter matrix left the
per-shape spreads the same size they were with it on — no latent "many small bodies vs. one big body"
signal was hiding behind the bug. This is a stronger candidate than "fights 1-4 are too easy" for why
ten of eleven encounters showed no meaningful difference above: the theory this whole section is built
on had almost no mechanism behind it in the code, not just an invisible one.

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
| **Hollow** | **Focus** — every hit on the same target, chosen at ignition; overkill thrown away | *Deletes one thing* | One fat health bar | several small bodies |
| **Rook** | **Siege** — always hits the highest-HP enemy | *Ignores chaff, goes for the wall* | A big body behind small ones | Everything is the same size |
| **Vex** | **Execute** — every hit on the lowest-HP enemy alive at ignition; overkill thrown away | *Removes the cheapest body* | Small bodies in front of a big one | Everything is big |
| **Cairn** | **Triage** — always heals the most hurt ally | *Saves whoever's closest to dying* | Chip damage on one hero | — |
| **Ward** | **Triage** — same rule, and it swings on the same beat | *Saves whoever's closest to dying* | Chip damage on one hero | — |

**The two healer rows describe today's code, not a proposal.** Every other row is a change this pass would
make; Cairn's and Ward's is what already ships. A healer chain heals the lowest-HP living ally, re-picked
on every hit (`sim/fight.ts:383`) — so healers were never on front-most targeting, and this table is the
first place that rule is written down. Nothing about them changes. They are listed because a hero missing
from the rules table reads as a hero with no rule, and the roster is six.

Both healers share the one rule; giving them a real axis of their own — spread a heal across the squad
versus dump it into one hero — is Q3's job and is deliberately not done here. Holding them fixed is also
what makes §4's gate attributable: if per-encounter results move, the attacker rules are the only thing
that could have moved them.

The healers' `—` in that column means the question wasn't asked this pass. It has an answer (see Q3),
it just isn't load-bearing while their rule is frozen.

### The three parts that ship together

Targeting is not one change, it's three — and all three are load-bearing. Chain shape already proved
what happens when you ship only the first: a mechanism that works in the simulation and does not exist
for the player.

**1. The rule** — what the chain does, per the table above. This is the mechanic.

**2. The readout** — when a hit wastes damage, the fight has to say so. A hit that reads
`40 (12 wasted)` is how the rule gets learned, and it gets learned by *watching* rather than by reading
a tooltip. Focus and execute have to make wasting overkill happen before they can show it (§1's fourth
finding, 2026-08-29) — today's chain hit carries a killing blow's leftover damage onto the next body
instead of dropping it. A spread chain should also visibly walk across different health bars, so the
rule is legible from the motion alone.

Spread and focus both need this, and it's one piece of work, not two — they just fill the same marker
differently. A spread chain has to show its target pool emptying, because Q1 rules that hits with no
fresh body are simply lost: **every enemy already struck by the current chain gets visibly marked**, so
the player watches the valid-target pool shrink hit by hit. A focus chain has to show its one held
target the same way, marked from the first hit — so when that target dies, the player is watching the
exact body the rest of the chain is about to waste itself on. Either way, when the chain has nothing
left to hit, **the hit still fires, still shows its escalated number, and reads as landing on nothing**
(Q6). The marking teaches the rule before the sting arrives; the whiff confirms it.

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
- **Hollow — Focus.** Picks one enemy and stays on it. Three hits, the last one enormous — and wasted
  if that enemy is already down.
- **Vex — Execute.** Picks the weakest enemy and finishes it. Fast, and most of it is wasted if
  nothing is weak.
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

**It's genuinely conditional — for both rules now.** Spread into one 420 HP body throws most of its
chain away (Q1), and focus into five 48 HP grunts throws most of its chain away too (Q6) — the held
target dies on an early hit and the rest lands on a corpse. Both halves of the axis now carry a real
cost, which is what makes it an axis rather than a flavour difference.

**It keeps everything that already works.** Length is still rolled live, hit by hit. Escalation still
explodes past the knee. You still don't know how big a chain will get — you now just know what it will
*do*. The cascade and the surprise are untouched.

**It builds the mechanic shape only ever assumed.** Wasted overkill was supposed to drive shape's axis
and never actually did (§1's fourth finding, 2026-08-29) — `chainHitSpillsOverkill` has to be switched
off for a chain hit before "overkill thrown away" in the rules table above is true of anything. That is
new behaviour this proposal has to build, not an existing mechanic it connects to a decision (see
`CHAIN_TARGETING_IMPLEMENTATION_PLAN.md`'s Phase 1, §1.5).

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
| **Champion** (finale) | 230 HP body + two 62 HP guards | **Mixed** — execute clears the guards, siege takes the body |
| **Executioner** | hunts your lowest-HP hero, ignores your tank | **Mixed** — execute clears the two Guards; heal question more than a chain question |

**Needs rechecking after Q6: Twins and Glass Pair.** Both are labelled *Focus* above on reasoning written
before Q6 — kill one 150/90 HP body, keep the fight from getting worse. With carryover gone, focus into
either pair now wastes whatever the killing hit overshot, the same as it does into Pack. Whether that
still beats spread in these two rows is a measurement question, not re-derived here — but if it doesn't,
the 6:3 lean below softens, which is a live input to Q5.

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

**Vex is the one exception.** Its drafted curve was sized as a fourth attacker's share of the pool's
damage budget, not for a rule that locks onto the weakest living enemy — a target that's rarely bigger
than 40-90 HP. Q4 measures the result: Hollow's curve into a 48 HP grunt realises about 48 of 393
damage, and Vex's own drafted curve does no better by shape alone. Left as-is deliberately (Q4); flagged
here so this section's "no retuning needed" isn't read as covering all four attackers.

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

**Backfire risk mirrors toward survivability, and Q6 closed the one clause that didn't.** Q2 mirrors the
rule onto your own side. Fielding sorts tank → damage → support (`sim/heroes.ts:331`), so a mirrored
siege aims at your highest-HP hero and a mirrored focus commits to your front-most — both your tank —
while spread lands one hit per hero across a three-body field and then whiffs. All three rules mirror
*toward* survivability now. The one clause that didn't was focus's carryover — a full-length Hollow
chain was 393 damage (22+131+240, §1) against a fielded squad worth 390 HP at full (Bracer 195 + Rook 85
+ Cairn 110), and a wiped player side ends the fight as a loss (`sim/fight.ts:523`). With carryover gone
(Q6), a focus backfire commits to the tank and throws the rest away: one death at most, by construction,
never a wipe. That was the standing bet's exact failure mode — "one backfire should not durably shrink
the live roster," written after one betrayal benched Rook for eight straight fights — and it no longer
happens.

**Execute's backfire risk is closed the same way (Q4, 2026-08-29).** Execute was the exception to the
paragraph above while it could re-target after a kill — mirrored onto your own side, it would chase your
weakest hero from body to body, and a common two-hit backfire (105) was enough to kill Rook outright
where every other rule left the squad standing. Locking execute's target at ignition, the same way focus
was locked, closes it: a mirrored execute can only ever kill the one hero it locked onto. One death at
most, same guarantee as focus. No hedge added.

**The pool leans focus, 6:3.** Six encounters want one thing dead fast, three want a crowd cleared. Left
alone, spread is the weaker pick over a run even with per-fight equalisation, because the *fights* aren't
evenly distributed. Either the encounter pool gets rebalanced or spread gets compensated somewhere.

**Front-most targeting may be load-bearing.** Chains currently hit the front-most enemy, which shapes
kill order and therefore incoming damage. "Highest HP" and "new target each hit" change which enemies
die first across every fight in the pool. That's a bigger perturbation than the damage numbers suggest —
don't assume it's local.

**The whiff reads as a bug.** Both Q1 and Q6 put a fully escalated number on screen that resolves to no
damage — spread out of bodies, focus into a corpse. Without both halves of the readout in §2, the honest
player reaction is "that's broken," not "wrong pick." Cheaper to get wrong than shape's invisibility
was, and worse — a player who thinks the game is buggy stops reasoning about it entirely.

**Shipping the rule alone.** The readout and the name (§2) are not polish to be added later — without
them this becomes shape again: correct in the simulation, absent from the game. If the scope has to be
cut, cut a *rule* and keep all three parts for the rules that remain.

---

## 6. Open design questions

To be resolved across sessions. All eight now carry a **Decision**; Q5, Q7 and Q8 are deferred
pending the batch rig rather than answered. Each question carries candidate answers, then a
**My read** line — that line is opinion, not a decision, and should be argued with. Fill in
**Decision** when you settle one, and add a line to §7.

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

**Confirmed (2026-08-28): the hedge was never spent.** Q6 removed carryover — a focus backfire now
commits to one target and throws the rest away, one death at most. The bare ship holds with no
amendment; the no-killing-blow variant stays unneeded.

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

**Landed (2026-08-28): the second branch.** Q6 settled on commits-and-wastes, so execute — same greedy
kill order, surplus discarded rather than carried — strictly upgrades focus. This isn't Vex's blocker
anymore; it's Hollow's. The open question is no longer *what is Vex's rule*, it's *what keeps Hollow
distinct from execute if Vex gets it*.

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

**Revised read (2026-08-28):** take the bet — Vex gets a rule, and execute is the right one. State Vex's
condition as *small bodies in front of a big one*, not *crowds* — the mixed lane, not spread's. And put
the two-hit backfire on §4's measurement list as the likeliest reason Q2's no-killing-blow hedge has to
reopen — that risk is execute's own (a short, frequent backfire killing Rook outright) and Q6 landing on
commits-and-wastes doesn't touch it, since it never involved carryover in the first place.

**Punish stays live rather than discarded.** Eight of the eleven encounters telegraph
(`windupTelegraphSec` 1.5s, `windupDamageMultiplier` 2.0), killing the charger cancels the spike, and
the value is measurable as damage *prevented* rather than dealt. Its bad matchup is already in the pool
— Pack, Ambush and Anvil have no wind-up at all, which would hand spread the lane §5's 6:3 lean says it
needs. It is the answer if the fantasy wanted is the literal one; execute is the answer if the bet is
about tempo.

**Decision (2026-08-29): Vex gets execute, and execute locks its target at ignition exactly as focus
does.**

The rule: at ignition, pick the lowest-HP living enemy and hold it for the whole chain. Overkill is
thrown away, remaining hits fire into the corpse and whiff, the first whiff drops the hero's speed-up —
identical shape to Q6's focus. The only difference between the two rules is which body gets locked.

This closes both blockers above, and both close for the same reason: execute's only remaining advantage
over focus was that it could move to a new target after a kill while focus couldn't. Take that ability
away and:

- **Blocker 1 closes.** "Execute strictly upgrades focus" rested entirely on the retarget. Locked, the
  roster's three attackers run the same move — commit the whole chain to one body and remove it — with
  three different answers to *which* body: front-most (Hollow), highest HP (Rook), lowest HP (Vex). A
  choice, not a ladder.
- **Blocker 2 closes.** A mirrored execute can now only kill the one hero it locked onto at ignition —
  one death at most, by construction, the same guarantee Q6 already gave focus. Q2's declined
  no-killing-blow hedge stays unneeded, and the two-hit-backfire risk comes off §4's watch list (§5).

**An alternative was raised and set aside: hit the back-most enemy instead of the lowest-HP one.**
Rejected on the roster order — every encounter puts bruisers first and grunts last on purpose
(`sim/encounters.ts:254-256`), specifically so front-targeting reliably hits a bruiser. A back-most rule
would walk past exactly the fights built around "there's a dangerous body, kill it fast" — Executioner
and Vanguard — and spend the whole chain on Guards and Outriders instead. It also collapses onto
lowest-HP in practice anyway, since the grunts are the smallest bodies in every mixed encounter.

**Left open on purpose: Vex's curve.** Locking onto the weakest body caps how much of a chain can ever
land — Hollow's curve into a 48 HP grunt realises about 48 of its 393 total, and Vex's own drafted curve
does no better by shape alone (§3). The call this session is to accept that waste as the price of a
guaranteed early kill and leave the curve as-is rather than resize it now. Revisit if §4's measurement,
or play, says it reads as broken rather than as a cost.

Nothing in this decision goes to `DECISIONS.md`. The gate (Q1 and Q2, met since Q6) stays open and
unexercised — Tu's call this session, same treatment as Q5 and Q7.

---

### Q5 — Does the encounter pool get rebalanced toward spread, or does spread get compensated?

Follows from the 6:3 focus lean in §5. Six encounters want one thing dead fast, three want a crowd
cleared, two are mixed. Left alone, spread is the weaker pick over a whole run even with per-fight
equalisation, because the *fights themselves* aren't evenly distributed.

**My read:** defer this one until after the first measurement. The measurement tells you the actual size
of the imbalance, and guessing at it beforehand risks over-correcting a problem that per-fight spread
may already largely handle. Worth flagging now so it isn't discovered late.

**Decision (2026-08-28): defer — measure first, decide after.**

No rebalancing and no compensation gets written now. Run the batch rig once targeting ships, and answer
this from what it reports rather than a guess made ahead of it — guessing risks over-correcting a gap
per-fight equalisation may already mostly close. This is also why the question can't be settled from
today's numbers anyway: §2 already flagged that Twins and Glass Pair were labelled *Focus* on reasoning
Q6 has since undercut, so the 6:3 lean itself is provisional until that recheck happens. Same
measurement pass answers both — and Q8, which is deferred to the same run.

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

**Settled by Q2 (2026-08-28): Q6 was load-bearing twice, and both are resolved.** It was opened as a
per-encounter-spread problem — commit-and-wastes now gives focus that. Mirroring the rule onto your own
side (Q2) made it a run-health problem too: carryover was the one clause that could let a backfire
out-damage the whole fielded squad, 393 against 390 (§5). With carryover gone, a focus backfire commits
to one target and throws the rest away — one death at most, by construction. Q2's no-killing-blow hedge,
shipped as a fallback in case this landed the other way, is confirmed unneeded.

**Also settles Q4's blocker (2026-08-28).** Execute — the candidate for Vex's rule — is
focus-with-carryover minus the carry: same greedy kill order, surplus discarded at each kill. Landing on
"commits and wastes" means execute strictly upgrades focus, which makes Hollow the dead pick, not Vex.
Q4's question is no longer *what is Vex's rule* — it's *what keeps Hollow distinct from execute*.
**Resolved 2026-08-29:** execute gave up its retarget and locks a target at ignition too, same as focus
— see Q4.

**Decision (2026-08-28): focus commits and wastes, mirroring Q1.**

The chain picks one target at ignition and holds it for the whole chain. Overkill is thrown away, not
carried to the next enemy. Once the held target is dead, the chain keeps rolling — each remaining hit
still fires, still shows its full escalated number, and lands on nothing — and the first such hit ends
the hero's speed-up, exactly Q1's rider. This is Q1's answer applied to the other rule: "spread strands
hits in an empty field, focus strands hits in a dead body" (§5's own framing, line 657). Focus now has a
real bad matchup — several small bodies, where the held target dies early and the rest of the chain is
wasted — which is what §4's gate needs to find anything at all.

A candidate was considered and set aside: **the chain stops the instant the held target dies**, rather
than rolling on into the corpse. It was rejected on two counts. First, it hides the payoff instead of
paying a cost — a target that dies to hit one denies the player hits two and three entirely, so the
faster focus succeeds, the less of "the last hit is enormous" the player ever sees; commit-and-waste
still fires that hit and shows the number, just tagged as wasted. Second, the underlying cost is
identical either way — a hit into a dead target is worth zero whether the chain rolls into it or stops
before it — so stopping early buys nothing except a different, softer way to pay the same price, which
is exactly the "cleanest to read... never has a bad moment" shape Q1 already rejected for spread. Paying
the two rules' shared weakness in two different ways would also have cost the one-clause consistency
the whole targeting plan is buying.

**Rider.** This requires the same hot-flag split Q1 needs (§3): the "still accelerating" flag has to be
distinct from "a chain is running," cleared on the first whiff. Skip that and this decision silently
becomes "chain stops on the kill" — the variant just rejected.

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

**Decision (2026-08-28): defer.**

Nothing about the hot flag's cadence bonus changes this pass. Q1 already takes one bite out of it — the
first whiff ends the speed-up — but whether firing a chain should cost the hero anything beyond that
reaches past targeting into the charge mechanic itself, and answering it now would contaminate §4's
reading of targeting specifically. Revisit once targeting has cleared or failed the gate, same as Q5.

---

### Q8 — Does spread clear its own best matchup?

Opened while working Q4. Bracer's ten hits are 6, 11, 17, 23, 28, 34, 40, 45, 53, 60 (§1). One hit per
body into Pack — five grunts at 48 HP — delivers 6+11+17+23+28 = 85 and kills nothing; Q1 then loses
the remaining five hits, 232 damage. So spread converts 85 of 317 in the encounter §2's pool table
labels *Wants: Spread*. Ambush (4×40 HP) is the same shape with one body fewer.

**Less alarming after Q6.** Hollow's committed chain into the same encounter is 22+131+240 = 393, but a
single 48 HP grunt can only absorb 48 of it before the rest lands on a corpse — one grunt dead, roughly
48 realised. Spread's 85 is still weak against its own labelled matchup, but it's still ahead of focus's
48 here. Both rules do badly on Pack; spread just does badly less.

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

**Decision (2026-08-29): defer — measure before choosing, same as Q5 and Q7.**

None of the four candidates gets written now. Q8 is a claim about Bracer's numbers, not about
targeting, and the four fixes cost different things — front-loading erodes the flat curve §3 leans
on, a second lap partly reverses Q1, re-scaling the crowd spends difficulty that is already an open
decision. Guessing which one is needed before knowing the size of the gap risks paying one of those
prices for nothing.

What the deferral does buy is an ordering rule: **check this in the batch rig before §4's gate is
read, not after.** If spread converts 85 of 317 into its own labelled matchup, the gate's 15-point
spread test will report a tuning fault as a verdict on targeting. Confirming it first is what keeps
the gate honest — the same batch run that answers Q5's Twins/Glass Pair recheck can answer this.

Revisit if the rig confirms the gap. Accept it if the rig says spread clears the gate anyway.

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
- **2026-08-28** — Q6 settled: focus commits and wastes, mirroring Q1 exactly — one target held for the
  whole chain, overkill discarded, remaining hits fire into the corpse and whiff, first whiff drops the
  hero's speed-up. A candidate where the chain stops the instant the target dies was raised, argued, and
  rejected: it hides the payoff hit instead of costing anything (the zero-damage cost is identical either
  way), and it would have paid focus's and spread's shared weakness in two different shapes. Two things
  this unblocks: §5's backfire risk resizes from a possible wipe (393 into a 390 HP squad) to one death
  at most, confirming Q2's declined no-killing-blow hedge was never needed; and Q4's blocker resolves
  onto its harder branch — execute strictly upgrades focus, so Hollow, not Vex, is now the redundant
  hero, left unanswered for a future session. §2's rules table, identity lines, and readout section
  updated for the second conditional rule; §5's "no bad matchup" risk removed. Q8 rechecked against the
  new rule — focus realises about 48 of its 393-damage chain into Pack's Wants:Spread encounter, still
  behind spread's 85, so both rules do badly there and Q8 stands as written. `DECISIONS.md` gate (Q1 and
  Q2) was already met; still deliberately **not** exercised — Tu's call this session, held until Q4 also
  settles which hero holds which rule.
- **2026-08-28** — Q5 settled: defer. No rebalancing or compensation written now; answer from the batch
  rig once targeting ships, not from a guess made ahead of it. Tied to Q6's Twins/Glass Pair recheck
  (§2) — the 6:3 lean this question responds to is itself provisional until that recheck runs, so one
  measurement pass settles both. Logged in this document only, per Tu's instruction — nothing added to
  `DECISIONS.md`.
- **2026-08-29** — Phase 0 of `CHAIN_TARGETING_IMPLEMENTATION_PLAN.md` run before any targeting rule was
  built: §1's and §2's overkill claim was checked against the code and found false — `applyDamageFrom`
  already carries a killing blow's leftover damage onto the next living body, so a chain hit behaves
  like a cleave today; damage is only lost when it runs past a side's last body. Measured with the spill
  switched off (`chainHitSpillsOverkill: false`, new tunable) via
  `npm run measure:shape-verdict -- --block 2`: per-encounter win-rate and player-HP-left spreads across
  the four shapes stayed the same size with the spill on or off, so no "many small bodies vs. one big
  body" signal was hiding behind the bug. §1's diagnosis stands and Phase 1 proceeds as written, with the
  spill switched off for chain hits under targeting (§2's rules and §3's overkill sections corrected to
  say this is a mechanism to build, not one to reveal). Also fixed this session: the chain lockout bug
  (a hot hero dying mid-chain left no hero able to fire again for the rest of that fight, 3.7-5.0% of
  chains) and the chainHit event now carries `intended` alongside `damage` so a hit's waste is reportable.
  Nothing added to `DECISIONS.md` — no design decision changed, only a diagnosis correction and bug
  fixes; `CHAIN_SHAPE_MATCHUPS.md` corrected to match.
- **2026-08-28** — Q7 settled: defer, same as Q5. Being hot's cadence bonus stays untouched this pass —
  Q1 already ends it on the first whiff, but the bigger question of whether a chain should cost the hero
  anything beyond that belongs to the charge mechanic, not targeting, and would contaminate §4's
  measurement if answered now. Revisit once targeting clears or fails the gate. Logged in this document
  only — nothing added to `DECISIONS.md`.
- **2026-08-29** — Q4 settled: Vex gets execute, and execute locks its target at ignition exactly as
  focus does — same shape as Q6's rule, only the choice of body differs. This closes both of Q4's
  blockers at once, because both traced to the same cause: execute could re-target after a kill and
  focus couldn't. Locked, the three attacker rules become one move (commit the whole chain to a body,
  remove it) with three different target choices, so Hollow stops being redundant with Vex; and a
  mirrored execute can only kill the one hero it locked onto, so the two-hit-backfire risk that could
  kill Rook outright is gone, same guarantee Q6 already gave focus. §5's backfire risk paragraph and
  Q6's reciprocal note updated to match. A back-most targeting alternative was raised and rejected —
  every encounter seeds bruisers first and grunts last on purpose (`sim/encounters.ts:254-256`), so
  back-most would miss the Executioner and Vanguard fights it was meant to help with and collapse onto
  lowest-HP everywhere else anyway. Left open on purpose: Vex's curve was never sized for a target
  capped around 40-90 HP — Hollow's curve realises about 48 of 393 into a 48 HP grunt, and Vex's does no
  better by shape alone (§3) — accepted as the cost of a guaranteed early kill rather than resized this
  pass. §2's rules table, identity lines, and pool table filled in for Vex. Nothing added to
  `DECISIONS.md`; the gate (Q1 and Q2, met since Q6) stays open, same treatment as Q5 and Q7.
- **2026-08-29** — Q8 settled: defer, same as Q5 and Q7. Bracer's spread converting 85 of 317 into
  Pack is a claim about one hero's curve, not about targeting, and the four fixes each spend
  something real — the flat curve §3 derives from the rule, Q1's cost, or difficulty that is already
  an open decision. What the deferral fixes is the order: check this in the batch rig *before* §4's
  gate is read, or the gate reports a tuning fault as a verdict on targeting. Folded into the same
  measurement pass as Q5's Twins/Glass Pair recheck. §6's preamble corrected — it still claimed only
  Q1 and Q2 were settled. Nothing added to `DECISIONS.md`; the gate (Q1 and Q2, met since Q6) stays
  open, Tu's call, same as the last four sessions.
