# Chain shape leverage — findings and open design menu

A session record so this can be picked up cold in a later session. Written 2026-08-23. See
DECISIONS.md for whatever from this session got confirmed and logged (check the date), and
STATE.md's "Open questions"/"Unverified bets" for how this connects to the standing questions —
this file does not replace either, it's the detailed record neither is meant to hold.

## The question

Tu's report: *"the chain mechanic has very little impact on in-game strategic decision — I don't
feel it differs much when choosing heroes. Not sure if I'm not understanding the game, haven't
played enough, or it truly doesn't matter."*

Candidate explanations, each demanding a different fix:

| If the truth is | The fix is |
|---|---|
| the lever genuinely doesn't move outcomes | change `sim/config.ts` / `heroes.ts` |
| it moves outcomes but is invisible | the pick screen and projection |
| it moves outcomes but the effect is too small to feel | play more, or amplify it |

Nothing in the repo separated these before this session.

## What was built

**`prototype/src/batch/chainLeverage.ts`** — a batch measurement REPORT (not a check; stays out of
`npm run check`, same discipline as `batch/affinity.ts`), wired as `npm run measure:chain-leverage`.
Supports `--block 1|2|3|4|5|all` and `--quick` (divides every block's n for fast local iteration —
don't trust `--quick` numbers, only use them to check the harness itself still runs).

**`prototype/src/batch/arm.ts`** — extracted the arm-comparison machinery (`runArm`, `printArm`,
`mcnemar`, `mean`, `ArmResult`) out of `affinity.ts` so both reports share it; no behavior change to
`affinity.ts`'s own output.

**Seed reservation:** `300_000`–`399_999`, disjoint from `chaindist.ts` (≤`93_599`) and
`affinity.ts` (`200_000`–`239_999`) — noted in both those files' headers now.

**Two small side-fixes made while building this:**
- `batch/fieldPolicies.ts`'s `scoreChainCoefficient` docstring corrected — it claimed to be "the
  TRUE chain-output ranking," which stopped being true after the 2026-08-20 Step 3 pass
  (`chainAffinity` now drives only `backfireChanceFor`, never magnitude). Docstring now says so;
  the function itself is untouched (still used by `affinity.ts`'s A5 arm as a named historical
  comparison).
- Seed-reservation notes added to `affinity.ts`'s and `chaindist.ts`'s header docstrings.

Full sweep runtime: ~3.5 minutes (~200k simulated fights). `npm run check` passes clean after these
changes — nothing here touches shipped sim behavior.

## The verdict (full run, not `--quick`)

**Block 1 — is the mechanic load-bearing at all?** Chain OFF (`chainContinuationScale: 0`) craters
run completion **22.1% → 0.0%** — fight 5 (Champion, the finale) win rate goes to **0%**. You
cannot beat the finale without a chain firing. Backfire risk barely matters (removing it: only
+3.3pt). Magnitude scale matters a lot (0.5x vs 2x target: 13.1pt swing). So the mechanic itself is
enormous — it's *which shape* that's in question, not whether chains matter.

**Block 2 — does hero pick change what the chain does, on average?** Forcing the whole roster onto
one shape (monoculture) moves completion by only **5.0 points** (real, z=-2.57 on the worst arm,
but small). Scrambling who-gets-which-shape vs. the shipped assignment: **1.9 points** — inside
noise. Chain shape is close to EV-neutral on the population mean, exactly as the 2026-08-20
equal-EV normalization (`CHAIN_EV_TARGET_DAMAGE`/`_HEAL` in `heroes.ts`) was built to make it.

**Block 3 — is a shape better against a *specific* encounter?** Swept all 11 encounters x 4
attacker shapes (isolated fights, firing hero preloaded to near-threshold charge so its chain fires
reliably). **10 of 11 encounters are flat** (≤5pt spread). One isn't: **Champion**, the same fight
Block 1 identified as where the whole mechanic's leverage concentrates. There, front-loaded beats
short-fuse-steep by **12 points** (49.8% vs 37.8%). A real, conditional edge — just untaught, and
invisible everywhere except that one fight.

**Block 4 — decision headroom (oracle vs. default vs. pessimal).** Field-pick (which 3 of 5 heroes
to send into a given fight): an oracle that simulates every option and picks the best beats the
accept-default fielding by only **1.5 points** — inside the ~2.7pt noise floor at n=200. Draft
(which 5 of 6 to keep for the whole run): **14.5 points** of headroom — the single biggest lever
measured this session, bigger than chain shape's population-average effect.

**Block 5 — runs needed to notice each effect (80% power).**

| Effect | Runs to notice | Hours (@4min/run) |
|---|---|---|
| chain on vs. off | 28 | ~2h |
| shape, at Champion specifically | 265 | ~18h |
| shape, averaged over the whole game | 1,103 | ~74h |
| shipped vs. scrambled shape assignment | 7,877 | ~525h |
| field-pick oracle vs. default | 9,492 | ~633h |
| draft (5 of 6) max vs. min | 97 | ~6h |

**Headline conclusion:** Tu's feeling is correct, and mostly can't be fixed by playing more — the
population-average "does my chain-shape pick matter" effect needs ~75+ hours to notice by feel,
practically undetectable. The one place a real, learnable choice survives is the finale, and even
that takes a genuinely heavy session (~18h) to notice unaided, which is why it reads as invisible
in practice despite being real.

## The open design menu — unresolved, next session's starting point

Discussed after the verdict; **nothing has been chosen yet.**

- **A — let chain shape be flavor, not strategy; point the "does my pick matter" feeling at the
  draft lever instead** (14.5pt, ~6h — already the closest to noticeable).
  **Rejected by Tu**: the studio is investing in chain as the *core* mechanic, so pretending shape
  doesn't matter isn't an acceptable answer, however honest it would be to the numbers.

- **B — teach the one edge that already exists.** Champion already rewards front-loaded over
  short-fuse-steep by a real 12 points; surface that specific matchup to the player (pick screen,
  or an in-fight tell) rather than leaving it to be discovered blind.
  **Tu's reaction: underwhelming as a standalone fix** — doesn't feel like enough investment payoff
  given chain is meant to be the core mechanic, not a one-fight footnote.

- **C — the early fights may be the real bottleneck, not the shape math.** Fights 1–4 are already
  known to be near-100% win rate for any reasonable draft (`chaindist.ts`'s own documented KNOWN
  GAP), and Block 4 found field-pick is *also* nearly inert (1.5pt) — not just chain shape. If
  almost nothing is contested before the finale, no lever gets a chance to matter earlier, because
  there's no room to be wrong. Raising real risk in fights 1–4 might make chain shape's existing
  Champion-style edge show up in more fights for free, without touching the chain math at all.
  **My recommendation to check first** — cheapest to test (existing encounter table / difficulty
  ramp knobs), and if right, it makes *every* lever (shape, fielding, even draft) more felt at once.

- **D — repurpose shape as a risk/variance axis instead of a win-rate axis.** Equal EV doesn't have
  to mean "inert" — it could mean "steady vs. gamble": one shape stays a safe, reliable payoff,
  another swings wide (mostly smaller, occasionally huge), and the choice is judged by spread of
  outcomes across runs, not by mean win rate. Close in spirit to what `chainAffinity`/backfire risk
  already tries to do — which Block 1 found *also* barely moves outcomes (3.3pt), so this would
  need the same kind of deliberate widening to actually register.

- **E — reintroduce a small, deliberate, bounded EV spread between shapes** (~10–15%, tied to
  identifiable matchups) instead of full equalization — without recreating the pre-2026-08-20
  dominance-ladder bug (Vex strictly beating Rook on every axis) that the equalization was built to
  fix in the first place.

**Resume-here pointer:** the most likely next action is either (a) building a Block-C-style
measurement — raise fights 1–4's difficulty/variance and re-run something like Blocks 3/4 to see if
per-lever headroom grows across more fights, or (b) Tu picking a direction among C/D/E (they're not
mutually exclusive — C could be paired with either D or E) to design further.

## Where the full methodology lives

The plan that built the measurement harness (block-by-block design, seed allocation, reuse
decisions) is at `C:\Users\ASUS\.claude\plans\i-feel-like-the-floofy-fox.md` on Tu's machine — that
plan file gets overwritten by future planning sessions, so treat this document as the durable
record and that one as disposable working notes if it's still there.

## Decision/state status as of this write-up

- **DECISIONS.md**: nothing from this session was logged as of this file's writing — Tu ruled out
  option A but hasn't chosen among C/D/E. Check DECISIONS.md's date against 2026-08-23 to see if
  that changed after this file was written.
- **STATE.md**: not synced in this session (only regenerated on explicit request). Its "Open
  questions" line about whether chain shape reads as attribution is now partially answered by this
  session's objective/batch measurement — `ATTRIBUTION_TEST.md`'s own played/perceptual protocol is
  still unrun. Worth a sync next time someone's actually sitting down to update STATE.md, not
  before.

## Postscript, 2026-08-27 — the CLOCK/WOUNDED harness is deleted

`src/batch/enrageLeverage.ts` and its `npm run measure:enrage` script were removed along with
CLOCK and WOUNDED themselves (see DECISIONS.md). Its findings are recorded in that log, not here.

To rebuild the same kind of measurement for a future lever: the reusable A/B rig survives at
`src/batch/arm.ts` (`runArm` / `printArm` for paired same-seed arms with McNemar significance,
`runsToDetect` / `printDetectability` for "how many runs before a human could notice this").
`src/batch/chainLeverage.ts` is the working example of a report built on it. The pattern that
mattered: define each arm as a `Partial<FightConfig>` override, run every arm over an identical
seed sequence, and verify the baseline arm reproduces `checks/chaindist.ts`'s pinned band before
trusting any delta.

---

# Burster vs grinder — the verdict (2026-08-27)

Tu's question: *"is my feeling that burster is obviously the better choice than grinder right or
wrong?"* Measured by `npm run measure:shape-verdict` (`src/batch/shapeVerdict.ts`, built this
session). Burster/grinder split on **fuse length**, Tu's own read and the same definition the
retired `enrageLeverage.ts` used:

- **burster** — `shortFuseSteep` ("short fuse", Hollow) + `shortFuseFlat` ("front-loaded", Vex)
- **grinder** — `longFuseFlat` ("long fuse", Bracer) + `longFuseSteep` ("back-loaded", Rook)

Verdict thresholds were **pre-registered in the report before it ran** (5pt completion margin,
McNemar |z| >= 2), so the output could not be read to confirm either way.

## The answer: WRONG on win rate — but for a more interesting reason than "the math equalized them"

| Measure | Burster | Grinder | Margin |
|---|---|---|---|
| Run completion, n=1500 paired seeds | 32.7% | 30.9% | **+1.8pt burster**, McNemar z=1.16 |
| Fight 5 (Champion) win rate | 37.7% | 34.4% | +3.3pt burster |
| Shape-isolated single fights, chain fires at t≈0 | 86.9% | 87.8% | −0.9pt (grinder) |
| Shape-isolated single fights, chain fires mid-fight | 87.6% | 87.9% | −0.3pt (grinder) |

Both below the 5pt bar, and the two levels point in *opposite* directions — which is itself the
finding: there is no consistent edge to find. Runs needed to notice the run-completion margin at 80%
power: **10,498 (~700h)**. The fight-5 margin: 3,224 (~215h). Tu's feeling is not tracking outcomes;
it cannot be, at that size.

## Why it isn't the trivial "equal EV means equal outcome"

The equal-EV normalization is real and it checks out — every attacker's chain is worth the same
**expected gross damage per fired chain**: 100.0 / 100.2 / 100.5 / 99.9 for the four shapes at a
fixed reference attacker (damage 6, affinity 1.0). But the live fight pays out only about half of
that, and the shortfall is **shape-dependent in one direction while the costs run the other way**.
Two large unpriced effects nearly cancel:

**Burster's unpriced advantage — it realizes more of its EV.**

| | Burster | Grinder |
|---|---|---|
| EV realization (realized ÷ analytic E[gross]) | **54.0%** | **43.0%** |
| Chains cut short (fight end or lockout) | 32.6% | 35.9% |
| Mean chain length vs analytic | 1.05 hits | 2.58 hits |

**Grinder's unpriced advantage — burster wastes and kills its own.**

| | Burster | Grinder |
|---|---|---|
| Overkill spilled past the target side's last body | **20.4%** | **9.8%** |
| Dud rate (chain fires, lands zero hits) | 40.5% | 28.4% |
| Player deaths per backfire (permanent for the run) | **0.57** | **0.34** |

Net: +1.8pt, inside noise. Both shapes are being mispriced by the same normalization, in opposite
directions, by amounts that happen to be close to equal. That is luck, not design — and it means the
equalization is load-bearing on an assumption it never verified.

**Tempo is confirmed dead as the currency, again.** Making the chain fire mid-fight rather than at
t≈0 moved the margin by 0.6pt. Front-loading buys nothing here — the same conclusion the
CLOCK/WOUNDED pass reached from the other direction (DECISIONS.md, 2026-08-27), now measured on the
shape axis directly rather than through a tempo tax.

## So what IS the feeling tracking? Concentration, and it is forced by the design

Equal EV across unequal fuse lengths *requires* a short fuse to land bigger individual hits. At the
reference attacker:

| Shape | Per-hit schedule | Biggest hit | Dud rate |
|---|---|---|---|
| short fuse (burster) | 22, 131, 240 | **240** | 40.0% |
| front-loaded (burster) | 35, 70, 105, 140 | 140 | 35.0% |
| long fuse (grinder) | 6, 11, 17, 23, 28, 34, 40, 45, 53, 60 | **60** | 22.0% |
| back-loaded (grinder) | 5, 11, 16, 22, 27, 51, 75, 99, 124 | 124 | 28.0% |

Burster's biggest single number is **1.94x** grinder's, on identical expected value, and burster is
**nothing at all 37.5%** of the time against grinder's 25.0%. Burster is louder *and* more often a
whiff. Tu's read is a correct read of what the screen shows; it is just not a read of what the shapes
are worth. Nothing in the pick screen or the fight tells the player that a 240 and a 60 are the same
purchase.

## Side finding: the Champion edge this document found in August has largely evaporated

Block 2 uses the same rig as the 2026-08-23 session's Block 3 (Rook preloaded, `fightIndex=0`,
n=600/cell), so the two are directly comparable. That session found Champion was the one encounter
with real conditional leverage: front-loaded 49.8% vs short-fuse-steep 37.8%, a **12pt** spread, and
recommended teaching it (option B above).

Now, post-CLOCK/WOUNDED-removal:

| Champion, chain fires at t≈0 | short fuse | front-loaded | long fuse | back-loaded |
|---|---|---|---|---|
| win rate | 76.5% | 79.2% | **82.5%** | 78.5% |

The spread is **6.0pt**, not 12, and the top of the ranking is now a *grinder* shape rather than
front-loaded. The direction between the original two shapes survives (front-loaded still beats short
fuse, by 2.7pt), but the fight is no longer tight — every shape moved from the 37–50% band into the
76–83% band, because the difficulty the removal gave back was deliberately not re-compensated
(DECISIONS.md, 2026-08-27). Some of the reordering is likely that slack rather than a real flip in
which shape is better.

Either way, **option B ("teach the one edge that already exists") is no longer standing on a 12pt
effect.** Whether it comes back is downstream of the difficulty decision, which is still open.

## Side finding, not folded into the verdict: the hot-hero-death chain lockout

`fight.ts`'s per-hero loop skips dead heroes, so when the hot hero dies mid-chain `hotHeroId` is
never cleared — the chain freezes and the chain trigger (which requires `hotHeroId === null`) is
**locked out for the rest of that fight**. No other hero can fire, however full its charge bar.

Measured, at run level: **3.7% of burster chains and 5.0% of grinder chains**, and when it happens
the chain system is dead for a mean **15.7s (burster) / 8.4s (grinder)** of a ~20s fight. Asymmetric
in the predicted direction — a longer fuse is exposed for more beats — but far too small to be what
Tu felt.

Deliberately **not fixed** this session: the numbers above describe the game as played. Fixing it
(clear `hotHeroId`, emit a `chainEnd` with a new reason) is its own decision, and it would move
these numbers.

## What was built

- **`src/batch/chainOutcomes.ts`** — per-chain decomposition off the event stream: EV realization,
  overkill spill, dud rate, end-reason histogram with the derived `lockout` bucket, chain wall-clock,
  and backfire death cost. Incremental (never retains `RunResult`s), keys rows on the profile id the
  chain actually fired under, and changes no sim behaviour.
- **`src/batch/shapeVerdict.ts`** — `npm run measure:shape-verdict`, four blocks plus a
  three-guard self-verification preamble. A REPORT, not a check.
- **`src/batch/arm.ts`** — gained a third aggregator on every arm (the decomposition above).
  `printArm` never prints it, so `affinity.ts`'s and `chainLeverage.ts`'s output is unchanged.
- Seed block **500_000–599_999** reserved; noted in `chainLeverage.ts`'s header too.

**Measurement error caught mid-session, worth not repeating:** the first pass divided realized chain
damage by `CHAIN_EV_TARGET_DAMAGE` (76). That is the expected **net** value — gross minus a symmetric
backfire's harm — so it understated realization, and by a *different* factor per hero (Rook's
backfire chance is 18% against Bracer's 7.75%). The aggregator now accumulates each chain's own
analytic E[gross] from the profile it fired under and the firing hero's stats, so pooling across
heroes and shapes stays exact. `76` is the right yardstick only for a whole-population net figure,
never for realized damage on non-backfire chains.

**A `--quick` run said the opposite.** At n=75 the same comparison read −10.7pt *for grinder* with
z=1.57. The full n=1500 run put it at +1.8pt for burster. `--quick` is a harness smoke test and
nothing else; the report now prints a distinct INCONCLUSIVE branch when a margin clears the point bar
but the paired test doesn't, so an underpowered run can't be misread as a null result.

## Open, for the next session

- Chain shape's price still does not exist, and this pass closes one more route: it is not a win-rate
  edge waiting to be surfaced. STATE's Next-up #1 stands — a **conditional** price, not a rebalance.
- The equalization is calibrated against a payout that materializes ~50% of the time. Worth deciding
  whether `CHAIN_EV_TARGET_DAMAGE` should be re-anchored to *realized* value rather than analytic,
  which would change what "equal EV" even means.
- Whether to fix the lockout.
