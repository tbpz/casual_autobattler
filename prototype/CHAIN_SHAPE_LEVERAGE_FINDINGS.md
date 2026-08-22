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
