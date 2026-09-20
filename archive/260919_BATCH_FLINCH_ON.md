`npm run batch -- --flinch true --n 1000` (default 3-policy x 3-draft matrix), compared against a
fresh `--flinch false` run of the same matrix (byte-identical to `260918_BASELINE_BATCH_PRE_MULTI_ANSWER.md`
except for the new `flinched slams` line) — see `../DESIGN_MULTIPLE_ANSWERS.md` for what this flag
does and `../DECISIONS.md` for whether this measurement led anywhere.

Read alongside two narrower runs not reproduced here in full (numbers folded into the summary below):
a Bracer-vs-Hollow swap holding rook+cairn fixed, and a damage-duo-vs-slam-answer-duo comparison
(rook+vex+cairn vs bracer+hollow+cairn) meant to test the design doc's own kill condition ("if damage
heroes pull ahead pool-wide, cut the flinch, don't retune it").

## Headline: flinch is nearly inert at today's tuning

Across all 9 policy/roster cells, `flinched slams` sits at 2.3%-3.2% — only about 1 in 35 slams ever
gets touched by a chain hit at all. `run completion rate` and `windup death rate` move by well under
1 point in every cell, both directions, consistent with seed noise rather than a real effect:

```
                                          flinch off -> flinch on
never-spend   bracer+hollow+rook+cairn+ward   16.1% -> 16.0%  (windup death 8.2% -> 8.1%)
never-spend   bracer+hollow+rook+vex+ward     13.6% -> 13.7%  (windup death 5.1% -> 5.0%)
never-spend   hollow+rook+vex+cairn+ward       4.8% ->  5.1%  (windup death 13.1% -> 12.7%)
always-heal   bracer+hollow+rook+cairn+ward   18.4% -> 19.2%  (windup death 8.8% -> 8.6%)
always-heal   bracer+hollow+rook+vex+ward     19.3% -> 19.3%  (windup death 5.2% -> 4.9%)
always-heal   hollow+rook+vex+cairn+ward      13.9% -> 14.1%  (windup death 10.1% -> 9.8%)
always-upgrade bracer+hollow+rook+cairn+ward  42.9% -> 43.0%  (windup death 5.6% -> 5.6%)
always-upgrade bracer+hollow+rook+vex+ward    46.4% -> 46.7%  (windup death 2.8% -> 2.8%)
always-upgrade hollow+rook+vex+cairn+ward     11.5% -> 11.9%  (windup death 11.4% -> 11.2%)
```

The flag does the right thing mechanically — it just doesn't move the pool-wide numbers yet. Full
`--flinch true` output is below the fold.

## The isolated squad tests found something the unit-math argument missed

Holding rook+cairn fixed and swapping only the tank (Bracer's guard vs Hollow's stun) was meant to
isolate the slam-answer question. It did — and it went the OPPOSITE way `config.ts`'s numbers predict
for a single fight in isolation:

```
policy=always-heal roster=bracer+rook+cairn   completion=6.2%   windup death=10.2%
policy=always-heal roster=hollow+rook+cairn   completion=13.6%  windup death=8.8%
```

Hollow's trio completes runs at better than double Bracer's rate, even though Bracer's trio does show
the higher windup-specific death rate the per-fight unit-mismatch argument predicts (a guard rung
buys ~2.9 slams per chain, a freeze rung buys ~3.2 seconds against a 6.5s cycle — see the plan this
file was written under for the arithmetic). The per-fight prediction held on the one metric it was
about; it did not carry over to run outcomes, and the reason is structural, not statistical:

**A run draws 5 of 11 encounters by tier (`encounters.ts`'s `encounterOrderFor`) — 2 early, 2 mid, 1
finale — and 3 of the 11 have `bruisers: []`, meaning no slam at all** (Pack, Anvil: early tier;
Ambush: mid tier). The early tier is only 3 encounters wide (Pack, The Wall, Anvil) and two of the
three have no bruiser, so a random 2-of-3 draw expects ~1.33 bruiser-less fights from the early slots
alone; mid tier adds another ~0.33 expected (Ambush, 1 of 6). **About a third of an average run's
fights carry no slam at all.**

Guard's whole payoff is redirecting a wind-up — in a bruiser-less fight, every charge a Bracer chain
buys is spent on nothing. Stun targets the front-most living enemy regardless of role (`fight.ts`'s
`frontMostAliveId`), so it denies whatever's attacking — grunt or bruiser — in every single fight.
The guard-charge-spent rate in the full matrix (18.9%-31.1%, this file and the prior baseline) already
showed most charges going unused; this is the mechanism, not noise. The unit-mismatch argument was
real but second-order — the tier structure is the bigger lever.

**Caveat:** this is a fixed 3-hero draft with no bench (`cli.ts`'s "passing exactly 3 degrades to no
bench" note) — deaths are unusually costly here (`deaths by fight: f1=2.00` in both squads, i.e. a
run averages losing 2 of 3 heroes just clearing fight 1), which is not how the shipped 5-hero draft
plays. Treat this as isolating the tank swap, not as a played-game number.

## Kill condition: not tripped, but not clean either

```
                                    flinch off -> flinch on
rook+vex+cairn (damage duo)         3.7% -> 4.5%   (flinched slams 0.0% -> 8.9%)
bracer+hollow+cairn (slam-answer duo)  18.3% -> 18.3%  (byte-identical output both arms)
```

`bracer+hollow+cairn`'s output is IDENTICAL on and off — expected, since neither guard nor stun ever
calls `flinchWindup` (`fight.ts`'s `resolveChainHit` only calls it from the `strikeAll`/`poundBiggest`
cases), so this squad has zero mechanical path for the flag to matter. That's a clean sanity check on
the flag's scope, not a finding.

`rook+vex+cairn` gained +0.8 points of completion (3.7% -> 4.5%) — real in direction (`flinched
slams` jumped from 0% to 8.9%, the highest of any squad tested, since both its heroes are
flinch-capable), but small, and this squad's own baseline completion is so low (3.7%, no tank at all,
`dip rate: 100%`) that a fair pool-wide comparison needs the full 5-hero drafts, not this pair. At
today's tuning, damage is not visibly "pulling ahead pool-wide" — but the effect is real enough,
and the sample small enough, that this isn't a clean pass either. Re-check at full draft scale before
trusting it either way.

## Full `--flinch true` matrix output

```
=== policy=never-spend roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   16.0%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=97.4%  f4=95.7%  f5=17.5%
  dip rate:              13.4%  (tank line ever broke, or no tank)
  chain rate:            83.2%  (fraction of fights a chain fired)
  full-spectacle rate:   32.6%  (should track wins-with-chain>=3, below)
  windup death rate:     8.1%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    43.8%
  wins with no chain:    34.1%  (big win, not only win)
  chain length hist:     0:1510  1:651  2:508  3:395  4:207  5:203  6:254  7:1128
  mean fight duration:   21.12s  (stddev 8.36s)
  duration percentiles:  p10=12.2s p25=14.2s median=21.0s p75=26.6s p90=30.9s p99=36.5s
  mean deaths per run:   4.25
  deaths by fight:       f1=0.00  f2=0.09  f3=0.15  f4=0.23  f5=3.78
  chains while losing:   14.6%  (<40% pool when fired)
  backfire rate:         19.9%  (fraction of fights with >=1 backfire)
  chains backfired:      13.3%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   29.3%  (1335/4564 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.7%  (244/8967 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=never-spend roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   13.7%
  win rate by fight:     f1=100.0%  f2=97.8%  f3=98.9%  f4=96.3%  f5=14.7%
  dip rate:              14.0%  (tank line ever broke, or no tank)
  chain rate:            77.7%  (fraction of fights a chain fired)
  full-spectacle rate:   28.8%  (should track wins-with-chain>=3, below)
  windup death rate:     5.0%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    41.5%
  wins with no chain:    37.2%  (big win, not only win)
  chain length hist:     0:1697  1:647  2:493  3:376  4:258  5:317  6:268  7:818
  mean fight duration:   18.10s  (stddev 5.98s)
  duration percentiles:  p10=11.1s p25=13.0s median=17.1s p75=21.4s p90=28.0s p99=30.0s
  mean deaths per run:   4.36
  deaths by fight:       f1=0.00  f2=0.12  f3=0.07  f4=0.22  f5=3.95
  chains while losing:   15.4%  (<40% pool when fired)
  backfire rate:         19.1%  (fraction of fights with >=1 backfire)
  chains backfired:      14.0%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   19.0%  (682/3589 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        3.0%  (223/7316 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=never-spend roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   5.1%
  win rate by fight:     f1=100.0%  f2=97.1%  f3=90.1%  f4=81.8%  f5=7.1%
  dip rate:              24.9%  (tank line ever broke, or no tank)
  chain rate:            81.7%  (fraction of fights a chain fired)
  full-spectacle rate:   30.2%  (should track wins-with-chain>=3, below)
  windup death rate:     12.7%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    42.9%
  wins with no chain:    32.5%  (big win, not only win)
  chain length hist:     0:1534  1:677  2:491  3:284  4:195  5:188  6:210  7:981
  mean fight duration:   20.91s  (stddev 10.10s)
  duration percentiles:  p10=10.3s p25=14.3s median=20.0s p75=26.0s p90=33.1s p99=44.9s
  mean deaths per run:   4.78
  deaths by fight:       f1=0.00  f2=0.17  f3=0.59  f4=0.95  f5=3.07
  chains while losing:   20.5%  (<40% pool when fired)
  backfire rate:         20.5%  (fraction of fights with >=1 backfire)
  chains backfired:      14.6%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.3%  (176/7762 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-heal roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   19.2%
  win rate by fight:     f1=100.0%  f2=98.7%  f3=97.3%  f4=97.4%  f5=20.5%
  dip rate:              12.9%  (tank line ever broke, or no tank)
  chain rate:            85.5%  (fraction of fights a chain fired)
  full-spectacle rate:   36.4%  (should track wins-with-chain>=3, below)
  windup death rate:     8.6%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    48.4%
  wins with no chain:    29.0%  (big win, not only win)
  chain length hist:     0:1316  1:622  2:545  3:401  4:219  5:252  6:289  7:1238
  mean fight duration:   22.09s  (stddev 9.31s)
  duration percentiles:  p10=13.0s p25=15.2s median=21.3s p75=26.8s p90=34.0s p99=37.2s
  mean deaths per run:   4.08
  deaths by fight:       f1=0.00  f2=0.07  f3=0.15  f4=0.15  f5=3.72
  chains while losing:   13.4%  (<40% pool when fired)
  backfire rate:         20.0%  (fraction of fights with >=1 backfire)
  chains backfired:      12.5%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   31.1%  (1480/4759 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.7%  (259/9454 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-heal roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   19.3%
  win rate by fight:     f1=100.0%  f2=97.2%  f3=99.4%  f4=97.8%  f5=20.4%
  dip rate:              13.5%  (tank line ever broke, or no tank)
  chain rate:            77.4%  (fraction of fights a chain fired)
  full-spectacle rate:   29.6%  (should track wins-with-chain>=3, below)
  windup death rate:     4.9%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    42.5%
  wins with no chain:    37.1%  (big win, not only win)
  chain length hist:     0:1686  1:627  2:488  3:382  4:256  5:315  6:254  7:874
  mean fight duration:   18.24s  (stddev 6.00s)
  duration percentiles:  p10=11.5s p25=13.0s median=17.4s p75=21.7s p90=28.0s p99=30.3s
  mean deaths per run:   4.12
  deaths by fight:       f1=0.00  f2=0.15  f3=0.05  f4=0.14  f5=3.77
  chains while losing:   15.0%  (<40% pool when fired)
  backfire rate:         20.1%  (fraction of fights with >=1 backfire)
  chains backfired:      14.3%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   20.3%  (782/3852 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        3.2%  (233/7364 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-heal roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   14.1%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=94.1%  f4=90.9%  f5=16.8%
  dip rate:              17.4%  (tank line ever broke, or no tank)
  chain rate:            83.2%  (fraction of fights a chain fired)
  full-spectacle rate:   34.5%  (should track wins-with-chain>=3, below)
  windup death rate:     9.8%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    47.3%
  wins with no chain:    28.4%  (big win, not only win)
  chain length hist:     0:1374  1:672  2:545  3:326  4:192  5:204  6:254  7:1181
  mean fight duration:   21.91s  (stddev 10.62s)
  duration percentiles:  p10=11.3s p25=15.0s median=20.6s p75=26.5s p90=34.1s p99=51.4s
  mean deaths per run:   4.34
  deaths by fight:       f1=0.00  f2=0.10  f3=0.34  f4=0.51  f5=3.40
  chains while losing:   15.4%  (<40% pool when fired)
  backfire rate:         22.5%  (fraction of fights with >=1 backfire)
  chains backfired:      14.4%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.8%  (229/8194 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-upgrade roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   43.0%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=97.4%  f4=96.3%  f5=46.6%
  dip rate:              10.5%  (tank line ever broke, or no tank)
  chain rate:            83.4%  (fraction of fights a chain fired)
  full-spectacle rate:   33.5%  (should track wins-with-chain>=3, below)
  windup death rate:     5.6%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    45.2%
  wins with no chain:    32.5%  (big win, not only win)
  chain length hist:     0:1488  1:616  2:504  3:393  4:231  5:215  6:272  7:1143
  mean fight duration:   20.86s  (stddev 8.75s)
  duration percentiles:  p10=11.6s p25=14.0s median=20.8s p75=26.6s p90=30.6s p99=36.4s
  mean deaths per run:   2.96
  deaths by fight:       f1=0.00  f2=0.09  f3=0.15  f4=0.20  f5=2.52
  chains while losing:   14.1%  (<40% pool when fired)
  backfire rate:         20.0%  (fraction of fights with >=1 backfire)
  chains backfired:      13.3%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   26.1%  (1237/4741 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.7%  (227/8412 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-upgrade roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   46.7%
  win rate by fight:     f1=100.0%  f2=97.8%  f3=98.9%  f4=96.3%  f5=50.3%
  dip rate:              10.6%  (tank line ever broke, or no tank)
  chain rate:            78.1%  (fraction of fights a chain fired)
  full-spectacle rate:   30.0%  (should track wins-with-chain>=3, below)
  windup death rate:     2.8%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    43.2%
  wins with no chain:    35.0%  (big win, not only win)
  chain length hist:     0:1639  1:619  2:508  3:370  4:277  5:316  6:297  7:848
  mean fight duration:   17.88s  (stddev 5.91s)
  duration percentiles:  p10=11.1s p25=12.9s median=17.3s p75=21.4s p90=27.8s p99=29.6s
  mean deaths per run:   2.74
  deaths by fight:       f1=0.00  f2=0.12  f3=0.07  f4=0.22  f5=2.32
  chains while losing:   14.3%  (<40% pool when fired)
  backfire rate:         19.6%  (fraction of fights with >=1 backfire)
  chains backfired:      14.1%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   15.6%  (606/3884 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        3.1%  (217/6896 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
=== policy=always-upgrade roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   11.9%
  win rate by fight:     f1=100.0%  f2=97.1%  f3=90.1%  f4=87.2%  f5=15.6%
  dip rate:              24.4%  (tank line ever broke, or no tank)
  chain rate:            82.5%  (fraction of fights a chain fired)
  full-spectacle rate:   30.4%  (should track wins-with-chain>=3, below)
  windup death rate:     11.2%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    43.1%
  wins with no chain:    32.3%  (big win, not only win)
  chain length hist:     0:1495  1:688  2:516  3:289  4:217  5:195  6:215  7:993
  mean fight duration:   20.48s  (stddev 9.57s)
  duration percentiles:  p10=9.9s p25=14.0s median=19.8s p75=26.0s p90=33.0s p99=43.2s
  mean deaths per run:   4.49
  deaths by fight:       f1=0.00  f2=0.17  f3=0.59  f4=0.70  f5=3.02
  chains while losing:   20.0%  (<40% pool when fired)
  backfire rate:         21.2%  (fraction of fights with >=1 backfire)
  chains backfired:      15.0%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
  flinched slams:        2.5%  (186/7504 — the count of slams landed is real either way; flinched stays 0 unless run with --flinch true, see this file's docstring)
```
