# Chain shape → chain targeting — implementation plan

## Context

`prototype/CHAIN_SHAPE_TARGETING_PLAN.md` holds five sessions of settled design work: replace each
hero's chain *shape* with a chain *targeting rule* (Bracer spreads, Hollow focuses, Rook sieges,
Vex executes, both healers keep the heal rule they already have and get called Triage). Q1, Q2,
Q3, Q4 and Q6 are answered. Q5, Q7 and Q8 are deferred to a measurement pass. Nothing is in
`DECISIONS.md` yet and `STATE.md` still describes chain shape as the live problem.

This is a big change, so the work is split into phases with a real stopping point between each.
Nothing about targeting gets built until Phase 0 answers a question that turned up while reading
the code — see below.

### The thing found while reading the code, and why it comes first

Both design docs say the same thing, and both are wrong about it:

> `CHAIN_SHAPE_MATCHUPS.md:12` — *"a chain hit always strikes the front-most living enemy, and
> **overkill is wasted** ... A 60-damage hit into a 40 HP grunt throws away 20."*

`applyDamageFrom` (`prototype/src/sim/fight.ts:41-55`) does not throw it away. It carries the
leftover 20 onto the *next living enemy in the list*, and keeps carrying until the whole enemy
side is out of HP. So a chain hit today already behaves like a cleave. Damage is only ever lost
when it runs past the very last body — which is exactly what the batch rig measures and calls
"overkill spilled past the last body" (20.4% for burster, 9.8% for grinder, recorded in
`CHAIN_SHAPE_LEVERAGE_FINDINGS.md:214`).

That matters three ways:

1. The "many small bodies vs. one big body" theory the whole shape design rested on has almost no
   mechanism behind it in the code. This is a strong candidate for why ten of eleven encounters
   measured flat — a better one than the "fights 1-4 are too easy" explanation currently written
   down.
2. Q6's "focus commits and wastes" and Q4's execute are therefore **new behaviour to build**, not
   existing behaviour to reveal.
3. The plan's §1 diagnosis ("equal expected value by construction is the root cause") may be
   partly wrong, or at least not the whole story. Building four targeting rules on top of a
   mistaken reading of what went wrong is the exact failure the phasing is meant to prevent.

So Phase 0 measures it before anything else is designed around it.

### What Phase 0's result could do to everything after it

This isn't a formality — it's a real fork. Two outcomes, and they lead to different plans:

**If turning off the spill makes the per-encounter differences open up:** the crowd-vs-one-body
idea was real all along, just invisible because of the bug. That undercuts the reason for building
four new targeting rules — the cheaper move is to fix the spill bug, keep the six existing shapes,
and re-measure them against `CHAIN_SHAPE_MATCHUPS.md`'s table before writing a single targeting
rule. Phase 1 as written would not start; a smaller phase (re-measure shape, bug fixed) would go
in its place first.

Even then, there's a catch: the two fights the original measurement blamed most — Warden and Glass
Pair — have only one or two enemy bodies each, so there's nothing for a hit to spill onto there.
Fixing the bug likely rescues the crowd fights (Pack, Ambush) and does nothing for Warden or Glass
Pair. Targeting might still be the right answer for those, just not for the reason currently
written down.

**If turning it off changes nothing:** the diagnosis holds, and Phase 1 goes ahead as written.

Either way, none of Phase 0's actual work is wasted — the lockout fix, the wasted-damage
reporting, and the softer per-encounter measures are useful no matter which way this lands. What's
genuinely at risk of a rewrite is everything from Phase 1 on. **Read Phase 0's result and decide
which fork you're on before opening Phase 1 in a later session.**

---

## Phase 0 — clear the ground, and find out what the spill was hiding

No targeting rule is written in this phase. Four pieces of work, then a stop.

### 0.1 Fix the chain lockout

`fight.ts:476` skips dead heroes, and `fight.ts:545` (the only place `hotHeroId` is cleared during
a fight) sits inside that skipped branch. So when the hot hero dies mid-chain, `hotHeroId` stays
set forever: no other hero can ever fire again that fight (the check at `fight.ts:588`), no
`chainEnd` is sent, and every later snapshot names a dead hero as hot, so the chain HUD sticks on
screen. It happens in 3.7–5.0% of chains and costs 8–16 seconds of a ~20 second fight.

Fix: after the player loop, if `hotHeroId` names a hero that is no longer alive, send `chainEnd`
and clear `hotHeroId`/`hotChainShape`.

Touches:
- `sim/fight.ts` — the new sweep, next to the tank-holding update at `:574`.
- `sim/events.ts:85` — add `"sourceDied"` to `chainEnd`'s `reason` list.
- `batch/chainOutcomes.ts:71,285` — `lockout` stops being derived from a timestamp comparison and
  becomes the real reason; keep the name so existing output stays comparable.
- `checks/chaindist.ts:306-357` — the reason-honesty check needs the new value.
- `render/fightView.ts:894-957` — `showChainEnd` needs a branch; treat it like `noTarget` (straight
  to the card, no failure beat).

### 0.2 Report wasted damage on the event stream

Nothing today records what a hit *meant* to do versus what it did. `applyDamageFrom` already
computes it and drops it (`fight.ts:56`).

- `applyDamageFrom` returns `lost` alongside `died`/`applied`.
- `resolveChainHit` (`fight.ts:370-420`) returns `intended` alongside `amount`.
- `chainHit` gains `intended: number`. `damage` keeps meaning what actually went in.

This changes no behaviour at all — it is reporting only, and it is what makes every later claim
about waste checkable. It also closes a real inconsistency: `attack` events carry the rolled
damage before clamping (`fight.ts:252`) while `chainHit` carries the clamped figure, so the two
event types disagree about what "damage" means.

### 0.3 Add the switch that stops chain hits spilling

New tunable in `sim/config.ts`: `chainHitSpillsOverkill`, default `true` (exactly today's
behaviour). When `false`, a chain hit applies at most its target's remaining HP and the rest is
lost. Implemented as an argument on `applyDamageFrom` so normal attacks and wind-up hits are
untouched.

### 0.4 Teach the per-encounter rig to read easy fights

`batch/shapeVerdict.ts`'s Block 2 already runs the exact matrix needed — 11 encounters × 4 shapes
× 2 fire timings, one hero's setting varied, `fightIndex=0` so no difficulty ramp confuses the
rows (`shapeVerdict.ts:355-463`). Its problem is that it reads win rate, which is pinned at ~100%
in fights 1-4, so every shape scores the same there for reasons that have nothing to do with
shape.

Extend `Block2Cell` (`shapeVerdict.ts:349-372`) to also report, per cell:
- mean fraction of player HP left at fight end (from `FightResult.finalPlayerHeroes`),
- mean fight duration (`FightResult.durationSec`),
- realised chain damage against intended (from 0.2's new field).

An easy fight still shows which answer was better on all three. This is what replaces spending the
difficulty decision here, and it keeps the difficulty baseline still while targeting is measured
against it.

### Phase 0 stop — the question to answer before Phase 1 starts

Run `npm run measure:shape-verdict -- --block 2` and `--block 3` twice, once with
`chainHitSpillsOverkill` true and once false, and compare.

- **If the per-encounter differences between shapes open up when the spill is off** — the spill was
  hiding shape, §1's diagnosis needs rewriting, and it is worth asking whether shape deserves a
  second look before targeting replaces it. See "What Phase 0's result could do to everything
  after it" above for the concrete branch.
- **If they stay flat** — the diagnosis stands, the direction is sound, and Phase 1 proceeds with
  the spill switched off for chain hits (which is what Q4 and Q6 assume anyway).

Either way you now have a measured number instead of an assumption. Do not start Phase 1 without
it.

---

## Phase 1 — build the four rules in the sim, behind a switch. No screen work.

The whole phase is headless. Nothing on screen changes, so a rule that fails the gate costs no UI
work.

### 1.1 The rule as data

New type in `sim/config.ts`:

```ts
export type ChainTargeting = "front" | "spread" | "focus" | "siege" | "execute" | "triage";
```

- `HeroDef` (`sim/heroes.ts:9-39`) and `HeroState` (`sim/types.ts:30-135`) each gain
  `chainTargeting`. `makeHeroState` (`heroes.ts:339`) copies it across, same as `chainProfile`.
- `ChainPlan` (`types.ts:20-28`) gains `targeting`, resolved once per fight in `resolveChainPlan`
  (`fight.ts:180-187`) — the same pattern the profile already uses, so a batch arm that swaps a
  hero's rule can never measure a half-applied one.
- New tunable `chainTargetingEnabled` (default `false` at first). When off, `resolveChainPlan`
  forces every attacker to `"front"` and every healer to `"triage"`, which reproduces today's
  behaviour exactly. This is the A/B the whole gate rests on, and Phase 1 should prove it is
  byte-identical to no change before trusting any number — copy
  `shapeVerdict.ts:151-174`'s identity-transform guard.

Assignment per `CHAIN_SHAPE_TARGETING_PLAN.md` §2: Bracer spread, Hollow focus, Rook siege, Vex
execute, Cairn and Ward triage.

### 1.2 Per-chain state in `runFight`

Focus and execute lock one body at ignition; spread has to remember who it already hit. Add
alongside the existing chain locals at `fight.ts:437-458`:

- `chainLockedTargetId: string | null` — chosen in the ignition block (`fight.ts:594-604`), where
  `chainBackfire` is already decided, so the lock is picked on the correct side from the start.
  Focus locks the front-most body; execute locks the lowest-HP body.
- `chainStruckIds: Set<string>` — cleared at ignition, added to on each landed hit.
- `hotAccelerating: boolean` — see 1.4.

### 1.3 The rules, inside `resolveChainHit`

`resolveChainHit` (`fight.ts:370-420`) is the single place both target picks live, and it already
receives everything a rule needs. Replace the one line at `:404` with a switch over
`plan.targeting`, against `backfire ? player : enemy`:

| Rule | Target |
|---|---|
| `front` | first living body in list order (today) |
| `spread` | first living body in list order not in `chainStruckIds` |
| `focus` | `chainLockedTargetId`, if still alive |
| `siege` | highest current HP among living bodies, re-picked every hit |
| `execute` | `chainLockedTargetId`, if still alive |
| `triage` | lowest-HP living ally, re-picked every hit — unchanged, `fight.ts:383-403` |

Two notes:
- This replaces `pickWeightedTargetId` on the backfire path. Today a backfire is a weighted random
  walk re-rolled every hit, biased toward whichever tank is holding. Q2 decided the rule mirrors
  instead, and because fielding sorts tank → damage → support (`heroes.ts:331`), a mirrored focus
  or siege points at your own tank.
- Healers are held completely fixed (Q3), including the one place their behaviour differs from
  attackers': a heal chain with a full squad *ends* (`fight.ts:386-387` returns null →
  `reason: "noTarget"`), where an attacker chain will now keep rolling and whiff. That asymmetry
  is deliberate and already written down in Q3.

### 1.4 The whiff, and splitting the hot flag

Q1 and Q6 both need a hit with no valid target to still fire, still show its escalated number, and
land on nothing — and the first such hit ends the hero's speed-up.

- `resolveChainHit` returns `targetId: string | null`; `null` means whiff. `intended` is still the
  full escalated number, `amount` is 0.
- The caller (`fight.ts:505-526`) sends a `chainHit` with `targetId: null`, `damage: 0`, the real
  `intended`, and counts it in `bonusHitsLanded` — a whiff must consume a fuse slot or the chain
  can never reach its cap.
- `chainHit.targetId` becomes `string | null`, which touches `fightView.ts:536` and
  `batch/chainOutcomes.ts`.
- **The hot flag splits in two** (§3). `fight.ts:477`'s `isHot` currently does two jobs at once:
  it decides whether to roll another chain hit (`:484`) and it grants the 0.6× beat interval
  (`:479`). Keep `hotHeroId` meaning "a chain is running" — the screen reads it (`fight.ts:617`).
  Add `hotAccelerating`, set true at ignition and cleared on the first whiff; line `:479` reads it
  instead. Skip this and Q1's decision silently turns into "the chain ends early", which is the
  option Q1 rejected.

### 1.5 Overkill under targeting

Turn `chainHitSpillsOverkill` off when `chainTargetingEnabled` is on, so all four rules pay the
same shape of cost — focus and execute waste what overshoots their locked body, spread wastes what
overshoots each fresh body. Phase 0's number is what confirms or changes this; if Phase 0 says the
spill was load-bearing for spread, keep spill on for spread only and record why.

### 1.6 The measurement rig

New file `prototype/src/batch/targetingVerdict.ts`, script `measure:targeting`, modelled closely
on `shapeVerdict.ts`. Seed block **600_000–699_999** (unclaimed; note in passing that
`affinity.ts:116`'s comment claiming 500_000 is "well clear of every reserved range" is now false,
since `shapeVerdict.ts` claims 500_000–599_999 — a one-line comment fix, not a real collision).

Copy the three self-checks from `shapeVerdict.ts:145-213` before any block runs, including the one
that reproduces `chaindist.ts`'s pinned [15%, 40%] completion band with targeting off.

- **Block 1 — no simulation.** Per rule and per encounter, what the rule can realise on paper:
  how much of a full-length chain a locked 48 HP grunt can absorb, how many fresh bodies spread
  has to walk. This is where Q8's claim (Bracer converts 85 of 317 into Pack) is checked in
  arithmetic before it is checked in fights.
- **Block 2 — the per-encounter matrix.** 11 encounters × 5 rules (front-most as the control, plus
  the four) × 2 fire timings, holding the firing hero's stats and curve fixed and moving only the
  rule. Reports Phase 0.4's four measures per cell, plus the best-worst spread per encounter and
  the pool-wide mean per rule.
- **Block 3 — full runs.** Three arms via `arm.ts`'s `runArm`/`transformRoster`: today's shipped
  setup, targeting on, front-most everywhere. Completion, McNemar paired z, deaths per backfire.
- **Block 4 — how long it would take to notice.** `printDetectability`, same as every other report.

Bars written into the file **before it is run**, same discipline as `shapeVerdict.ts:118-122`:
reuse its `VERDICT_BAR_PT = 5` and `VERDICT_BAR_Z = 2`, and add the targeting bar from §4 — per
encounter, best rule minus worst rule ≥ 15 points; pool-wide, the spread between rules ≤ 5 points.

### Phase 1 stop — the gate

Read Q8's Block 1 result **first**. If spread converts a small fraction of its chain into Pack and
Ambush, that is a problem with Bracer's curve, not with targeting, and the 15-point test would
report a tuning fault as an answer about targeting. Fix or note it before reading Block 2.

Then read the gate:

- **Per-encounter spread ≥15 points and pool-wide spread ≤5 points** → targeting works. Phase 2.
- **Per-encounter spread stays small** → targeting does not do what shape failed to do either.
  Stop, write it up, do not build the screen work.
- **Pool-wide spread large** → one rule is simply better over a run. That is Q5's question arriving
  early; rebalance the encounter pool or compensate spread before going further.

---

## Phase 2 — only if the gate passes: the readout and the names

§5 is explicit that the rule alone is how shape failed. All of this ships together or not at all.

### 2.1 Marks on bodies (snapshot-driven)

Every other body marker in this codebase is derived from `TickSnapshot`, not tracked in the
renderer, so it survives pause, step and scrub (`fightView.ts:440-448`). Follow that:

- `TickSnapshot` (`events.ts:135-168`) gains `chainStruckTargetIds: string[]` and
  `chainLockedTargetId: string | null`, both filled in at `fight.ts:609-623` next to
  `chainDamageSoFar` and `chainShape`, both null/empty when `hotHeroId` is null.
- `updateSide` (`fightView.ts:475-516`) toggles a `.chain-marked` class, copying the existing
  `.charging` line at `:495`.
- CSS beside `.body.charging` (`style.css:459-472`), which is already an outline-plus-pulse
  telegraph — the right visual family.

Spread's mark shows the pool of fresh bodies shrinking. Focus and execute mark their one locked
body from hit one, so when it dies the player is watching the exact corpse the rest of the chain is
about to be spent on.

### 2.2 The wasted number, and the whiff

- `showChainHit` (`fightView.ts:818-872`) — the popup string at `:851` becomes
  `-40 (12 wasted)` when `intended > damage`. `showPopup` (`:1069-1094`) sets `textContent`, so
  styling the suffix separately means two child spans; watch `.damage-popup.chain`'s
  `border-left` (`style.css:958-965`).
- A whiff renders the full escalated number with no impact flash and no flinch, marked as landing
  on nothing. The pip system already has a `.missed` state (`style.css:744`) to build from.

### 2.3 The end card

`renderChainEndCard` (`fightView.ts:981-1016`) currently shows `N hits, total damage, kills,
shape label`. Add a second detail line splitting hits that landed from hits that whiffed, and total
damage from total wasted. `.chain-end-card` is `white-space: nowrap` (`style.css:874`) and
`CHAIN_END_CARD_HOLD_MS = 1700` sits against a 1.6s animation — both need adjusting if the card
grows.

### 2.4 The names

- Rewrite all six `identity` strings in `heroes.ts:252,259,266,273,280,287` to the lines §2 part 3
  already drafts, leading with the rule and stating shape only as its effect. (Rook's current line
  is stale anyway — it claims "highest affinity in the pool" as a payoff, which stopped being true
  in the 2026-08-20 pass.)
- Show the identity line on the field pick too — `fieldPickScreen.ts:110-125` omits it entirely
  today, and that is the screen where the pick is actually made.
- **Remove `chainShapeSparkline`** from both pick screens (`squadPickScreen.ts:122`,
  `fieldPickScreen.ts:121`). §3 makes shape derived from the rule, so the sparkline is a
  re-encoding of information the rule already carries, and it would be the only numeric thing on
  the card. `heroPickShared.ts:19-27` can go with it; the backfire pips stay.
- `sim/projection.ts:197-226`'s `chainLine` states the rule instead of `profile.label`.

---

## Phase 3 — the deferred questions, in order

1. **Q8** — Bracer's curve against its own best matchup. Already measured in Phase 1 Block 1;
   decide from that number.
2. **Q5** — does the encounter pool get rebalanced toward spread, or does spread get compensated?
   Read Phase 1 Block 2's pool-wide row, plus the Twins and Glass Pair recheck §2 flags.
3. **Q7** — is being hot too much of a free ride? Reaches into the charge mechanic; keep it out
   until targeting has cleared or failed.
4. **Difficulty** — the ~9 points handed back, and the failing pin in `chaindist.ts:575-581`. Note
   that `npm run check` chains with `&&`, so while that pin fails `check:projection` never runs at
   all.
5. **Q3 reopened** — a real healer axis (spread a heal versus dump it into one hero).

---

## Doc work

### The correction

After Phase 0's number, fix the false overkill claim where it appears: `CHAIN_SHAPE_MATCHUPS.md:12-17`
and `CHAIN_SHAPE_TARGETING_PLAN.md` §1 and §2. Add a session-log line to §7 recording what the
measurement said. Commit the already-modified plan file first so this correction is a separate,
readable change.

### DECISIONS.md — two entries, appended only on Tu's confirmation

Per `CLAUDE.md`'s decision protocol these get proposed, not silently written, and drafted through
the `decision-log` skill (~250 words each, one claim per bullet, numbers only as dated evidence).

**Entry A — the direction and the rules.** The move from shape to targeting; the four attacker
rules and which hero holds each; the rule mirrors on a backfire with no hedge; a chain that runs
out of targets keeps rolling, loses those hits, and drops its speed-up on the first whiff; chain
hits stop spilling overkill onto the next body (stated as the change it is, with Phase 0's measured
number as the evidence); healers held fixed and their existing rule named Triage; the hot flag
splits in two; shape stops being shown as a stat.

**Entry B — the deferrals.** Q5, Q7 and Q8 deferred to one measurement pass, and the ordering rule
that Q8 is read before the gate is read.

**When:** after Phase 0, before Phase 1. Waiting that long lets Entry A state the overkill fact
correctly and carry a real measured number instead of an assumption — which is what the log's own
convention asks for. Five sessions of decisions being unlogged is the cost; Phase 0 is short.

### STATE.md — one sync, after the gate

Regenerate via the `state-sync` skill once Phase 1's gate has been read, not before — the gate is
what changes `Where it stands` and reorders `Next up`. Expect these to move: the chain-shape row in
`Status by piece`, "Pick chain shape's replacement lever" as Next up #1, the "chain shape can become
a real pick-time axis" bet, and the chain-lockout fix.

---

## Verification

Per phase, all from `prototype/`:

```
npm run check                          # after every phase — determinism, beatsheet, chaindist, projection
npm run measure:shape-verdict -- --block 2   # Phase 0: the spill comparison, run twice
npm run measure:shape-verdict -- --block 3   # Phase 0: lockout rate should reach 0
npm run measure:targeting -- --block all     # Phase 1: the gate
npm run batch -- --n 1000              # Phase 1: completion holds inside chaindist's [15%, 40%] band
npm run dev                            # Phase 2 only: play it and judge the readout
```

Two things to hold to throughout, both borrowed from how this repo already works:

- **Every new arm proves its baseline first.** `chainLeverage.ts:184-194`, `shapeVerdict.ts:197-207`
  and `CHAIN_SHAPE_LEVERAGE_FINDINGS.md:161-163` all say the same thing: an arm with the new
  setting switched off must reproduce `chaindist.ts`'s pinned band before any difference between
  arms is trusted.
- **`--quick` numbers are never real.** At n=75 the shape measurement pointed the opposite way to
  the truth. Full runs only for anything that gets written down.

One known failure to expect, not to fix here: `checks/chaindist.ts:575-581` (leave-out-bracer
completion at 17.7% against a ~15% note) is deliberately left failing pending the difficulty
decision. It should still be the *only* failure after every phase.
