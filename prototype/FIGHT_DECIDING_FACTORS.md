# What actually decides a fight — the ranked list

Written 2026-09-04. Tu's question after four failed chain-identity levers (payoff size, backfire
risk, chain shape, chain targeting — see `CHAIN_SHAPE_LEVERAGE_FINDINGS.md` and four `DECISIONS.md`
entries): each one changed something that may simply not be among the things that decide a fight.
Nobody had ever measured that directly — every earlier file asked "does THIS ONE lever work," each
against its own bar, with no shared scale to line them up on.

Built by `prototype/src/batch/decidingFactors.ts` (`npm run measure:deciding-factors`). Runs at both
levels Tu asked for: one fight's win or loss, and the whole 5-fight run. Two rows below are cited
from a companion file built the same day in a separate session, `batch/chainProof.ts` — see that
file's own header for what it measured and its own caveats.

## The one-sentence answer

**Chain length and chain aim are the two biggest things in the whole game — bigger than the draft,
bigger than the field pick, bigger than anything a hero pick has ever moved. The four failed levers
didn't fail because the chain doesn't matter. They failed because they tried to make a HERO decide
those two things, and both are decided by a coin flip instead.**

## The ranked list

Whole-run numbers first — this is the scale that matches how the four failed levers were judged.
Each row is its own arm-vs-arm measurement (not a share of one pie; see Limits, below).

| # | Factor | Kind | Run-level swing | Source |
|---|---|---|---|---|
| 1 | How long a fired chain runs | dice | **45.2pt** completion | measured here |
| 2 | Which way a fired chain aims (backfire) | dice | **42.0pt** completion | cited, `chainProof.ts` |
| 3 | Whether the chain mechanic exists at all | dice | **33.0pt** completion | cited, `chainProof.ts` |
| 3 | Whether a chain ever fires before the fight ends | dice | **32.5pt** completion | measured here |
| 5 | Coin spend (best policy vs. never spending) | player choice | **20.5pt** completion | measured here |
| 6 | Draft — which 5 of 6 heroes you keep | player choice | **17.1pt** completion | cited, `check:chaindist` |
| 7 | Field pick — which 3 of 5 you send in | player choice | **15.0pt** completion | measured here |
| 8 | *dead lever* — chain payoff size | dead lever | 13.2pt completion | re-measured here |
| 9 | *dead lever* — chain targeting (spread/focus/siege/execute) | dead lever | 8.8pt completion | re-measured here |
| 10 | The enemy's wind-up spike | dice | 7.7pt completion | measured here |
| 11 | Who the enemy happens to hit | dice | 7.4pt completion | measured here |
| 12 | Carried-in HP (how generous fight-to-fight recovery is) | state | 5.7pt completion | measured here |
| 13 | *dead lever* — chain shape (fuse length/steepness) | dead lever | 0.6pt completion | re-measured here |
| 14 | Per-hit damage variance (±25%) | dice | 0.5pt completion | measured here |
| 15 | *dead lever* — backfire risk (differ by hero) | dead lever | 0.4pt completion | re-measured here |

At the single-fight level (Block 2, run at the HP level a real finale is actually fought at —
93.7%, see Block 1 below), the same shape holds: **which way a chain aims** is the one factor with a
real pool-wide footprint across the 11 encounters (25.3 points, worst single encounter 71 points on
Champion). Every other factor is a rounding error pool-wide and only shows up at all on Champion,
the one encounter that isn't already settled — see Block 1.

## Why the four failed levers land near the bottom

Every one of the four (rows 8, 9, 13, 15) tried to make a hero's PICK decide something. Rows 1-4 —
the four biggest things in the whole game — are decided by dice at the moment a chain fires, not by
which hero is holding the bar. A hero's identity currently touches none of the top four rows at all:

- **How long it runs** and **whether it fires** are governed by the charge threshold and the
  continuation roll — the same for every hero once charge crosses the line.
- **Which way it aims** is a flat coin flip (`backfireChanceFor`) that differs only a little by
  hero — row 15 measured that difference directly, and it's the smallest number on the whole list.

So this isn't four unrelated failures. It's one pattern: the chain mechanic is the loudest thing in
the game, and every attempt so far tried to put a hero's fingerprint on a part of it that isn't
touched by hero choice at all — length, existence, and aim are dice; only *shape* and *risk-by-hero*
were ever hero-specific, and those are exactly the two rows sitting at the bottom.

## Block 1 — which of the 11 encounters can actually be lost

The accept-default squad (Bracer/Rook/Cairn), at three carried-in HP levels — full, and two levels
sampled from 600 real 5-fight runs (not guessed): 96.8% median HP entering fight 3, 93.7% entering
the finale. **Only Champion is ever in doubt, at any HP level tested** — 71.0% win rate at full HP,
dropping to 41.2% at the HP level a real finale actually arrives at. The other 10 encounters are
either a near-certain win (>=95%, most are 100%) or, for Vanguard, a near-certain loss (0% at every
HP level).

This is the reason four separate levers all read flat: a lever can only move a fight that isn't
already decided, and 10 of 11 fights are decided before any lever gets a turn. It also means every
Block 2 number above is really a story about ONE encounter (Champion) generalized across a pool that
mostly can't register it — which is exactly what the four failed levers' own per-encounter breakdowns
already showed (chain shape's one surviving edge, and targeting's two-of-eleven pass rate, both sat
on Champion specifically).

**Caveat on Vanguard's 0%:** this reads Vanguard at `fightIndex=0` (the isolation convention every
prior batch file here uses, to separate "this encounter's own shape" from the difficulty ramp) — a
real run only ever meets Vanguard as fight 5, with the ramp's HP/damage multiplier already applied,
which would make it even harder, not easier. Whether Vanguard is genuinely unwinnable for this squad
in real play, or only in this isolated, ramp-free reading, is not settled by this file — worth a
direct check before treating "Vanguard always loses" as a fact about the shipped game.

## Two findings this sweep wasn't looking for

**Field-pick headroom looks much bigger than it used to be.** The 2026-08-23 measurement
(`CHAIN_SHAPE_LEVERAGE_FINDINGS.md`, Block 4) found oracle-best vs. oracle-worst field pick worth
only 1.5 points — "barely clears the noise floor." This sweep, same method (perfect-fielding-strategy
oracle, k=3 rollouts, n=200), now reads **15.0 points**. The game underneath has changed a lot since
August (CLOCK/WOUNDED removed, the chain rebuilt, chain targeting added behind its flag) — this is
likely real drift, not a measurement mistake, but it deserves its own dedicated re-check before
anyone treats field pick as "still basically inert." If it holds up, field pick just became a much
more promising lever than any of the four that were tried.

**`always-upgrade` is a much stronger coin policy than anyone flagged.** 50.7% run completion against
30.1% (never spend) and 32.5% (always heal) — a bigger gap than draft, bigger than field pick, bigger
than any dead lever. `upgradeDpsBonus` (+2 flat damage per attack, every player hero, for the rest of
the run, stacking every purchase) may simply be worth more than its `upgradeCoinCost` (45) prices it
at, relative to `healHpAmount`'s (+25 HP) own cost (10). Not one of the four claims this file set out
to answer, but it fell out of Block 3's coin-spend row and is worth a look on its own.

## Limits — read before acting on any single row

- **One factor at a time.** Every row swings one thing and holds everything else at its shipped
  default. Factors interact (a chain that can't fire also can't back fire), so the rows do not sum to
  the whole outcome — this ranks which inputs matter most, it does not split the result into shares
  that add to 100%.
- **Two rows are cited, not independently re-run** (chain existence, chain aim at run level) — see
  `chainProof.ts`'s own header for its Claim 1/Claim 3 methodology. Its Claim 2 (is chain length the
  loudest dice) did **not** get a clean answer there, for two named confounds. This file's own
  "how long a fired chain runs" row (top of the list) sidesteps both: it drives length through
  `chainContinuationScale`, which the equal-EV magnitude math never reads, so nothing gets silently
  rescaled underneath it the way `chainProof.ts`'s own length-freeze did.
- **`fightIndex=0` isolation.** Every Block 1/2 single-fight cell fixes `fightIndex=0` to separate an
  encounter's own shape from the difficulty ramp — the same convention `targetingVerdict.ts` and
  `backfireRisk.ts` use. A real fight 5 draws the same encounter scaled harder, so Champion's and
  Vanguard's numbers here are a floor on their real difficulty, not the whole story.
- **Perceptibility** (Block 5's own runs-to-notice numbers) confirms the shape: the top four dice
  factors need under 20 runs (about an hour) to notice; several of the dead levers need thousands of
  hours. The four failed levers weren't just small — they were built on quantities nobody could ever
  have felt by playing, on top of not moving completion much either.

## What this points at for a fifth attempt

None of the four failed levers is worth trying again in its old form — the ranking says exactly why.
The one real, sizeable, currently-unowned factor on this list that has never been offered to a player
as a pick at all is **row 11: who the enemy happens to hit** (7.4 points at run level, the same order
of magnitude as the charge bar — the one lever that already works). Nothing in the game today lets a
draft or a field pick change that. Worth naming as a candidate direction, separate from chain
identity entirely: a hero, an upgrade, or a draft trait that makes the enemy's aim less random (or
more, as a genuine tradeoff) — the kind of stat this sweep found the game has never priced at all.

Also worth a look before any new lever design starts: the field-pick headroom re-check and the
`always-upgrade` coin finding above, both of which touch existing decisions (`STATE.md`'s open
question on the field pick collapsing to a forced answer, and the standing coin-spend "worth
using or cut" question) more directly than a new chain lever would.

## How to reproduce

`npm run measure:deciding-factors -- --block 0|1|2|3|4|5|all`, `--quick` for a harness smoke test
only (its numbers are not trustworthy — see the file's own header). Full run: ~5 minutes, ~450k
simulated fights. Seed block `1_000_000-1_499_999`, allocation in the file's own header.
