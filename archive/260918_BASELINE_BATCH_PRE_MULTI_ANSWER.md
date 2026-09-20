Baseline `npm run batch -- --n 1000` (default 3-policy x 3-draft matrix), recorded before building the
multi-answer chain design (see `../DESIGN_MULTIPLE_ANSWERS.md`) — for comparing against, not for tuning.

> casual-autobattler-prototype@0.0.0 batch
> tsx src/batch/cli.ts batch --n 1000

=== policy=never-spend roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   16.1%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=97.4%  f4=95.7%  f5=17.6%
  dip rate:              13.6%  (tank line ever broke, or no tank)
  chain rate:            83.3%  (fraction of fights a chain fired)
  full-spectacle rate:   32.8%  (should track wins-with-chain>=3, below)
  windup death rate:     8.2%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    43.8%
  wins with no chain:    34.2%  (big win, not only win)
  chain length hist:     0:1512  1:650  2:505  3:389  4:209  5:202  6:258  7:1131
  mean fight duration:   21.16s  (stddev 8.68s)
  duration percentiles:  p10=12.2s p25=14.2s median=21.0s p75=26.6s p90=31.1s p99=36.8s
  mean deaths per run:   4.25
  deaths by fight:       f1=0.00  f2=0.09  f3=0.15  f4=0.23  f5=3.78
  chains while losing:   14.9%  (<40% pool when fired)
  backfire rate:         19.8%  (fraction of fights with >=1 backfire)
  chains backfired:      13.2%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   29.2%  (1335/4565 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=never-spend roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   13.6%
  win rate by fight:     f1=100.0%  f2=97.8%  f3=98.9%  f4=96.1%  f5=14.7%
  dip rate:              14.1%  (tank line ever broke, or no tank)
  chain rate:            77.7%  (fraction of fights a chain fired)
  full-spectacle rate:   28.6%  (should track wins-with-chain>=3, below)
  windup death rate:     5.1%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    41.3%
  wins with no chain:    37.3%  (big win, not only win)
  chain length hist:     0:1693  1:658  2:497  3:374  4:255  5:318  6:261  7:817
  mean fight duration:   18.09s  (stddev 5.98s)
  duration percentiles:  p10=11.1s p25=13.0s median=17.1s p75=21.4s p90=28.0s p99=30.0s
  mean deaths per run:   4.37
  deaths by fight:       f1=0.00  f2=0.12  f3=0.07  f4=0.22  f5=3.95
  chains while losing:   15.3%  (<40% pool when fired)
  backfire rate:         19.0%  (fraction of fights with >=1 backfire)
  chains backfired:      14.0%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   18.9%  (682/3603 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=never-spend roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   4.8%
  win rate by fight:     f1=100.0%  f2=97.1%  f3=90.1%  f4=81.3%  f5=6.8%
  dip rate:              24.9%  (tank line ever broke, or no tank)
  chain rate:            81.6%  (fraction of fights a chain fired)
  full-spectacle rate:   30.3%  (should track wins-with-chain>=3, below)
  windup death rate:     13.1%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    43.0%
  wins with no chain:    32.5%  (big win, not only win)
  chain length hist:     0:1528  1:675  2:488  3:282  4:200  5:189  6:213  7:980
  mean fight duration:   20.93s  (stddev 10.17s)
  duration percentiles:  p10=10.3s p25=14.3s median=20.1s p75=26.0s p90=33.1s p99=44.9s
  mean deaths per run:   4.80
  deaths by fight:       f1=0.00  f2=0.17  f3=0.59  f4=0.97  f5=3.06
  chains while losing:   20.5%  (<40% pool when fired)
  backfire rate:         20.7%  (fraction of fights with >=1 backfire)
  chains backfired:      14.8%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-heal roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   18.4%
  win rate by fight:     f1=100.0%  f2=98.7%  f3=97.2%  f4=97.4%  f5=19.7%
  dip rate:              13.1%  (tank line ever broke, or no tank)
  chain rate:            85.6%  (fraction of fights a chain fired)
  full-spectacle rate:   36.3%  (should track wins-with-chain>=3, below)
  windup death rate:     8.8%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    48.4%
  wins with no chain:    29.1%  (big win, not only win)
  chain length hist:     0:1312  1:618  2:552  3:403  4:223  5:254  6:293  7:1225
  mean fight duration:   22.08s  (stddev 9.31s)
  duration percentiles:  p10=13.0s p25=15.2s median=21.3s p75=26.8s p90=34.0s p99=37.2s
  mean deaths per run:   4.13
  deaths by fight:       f1=0.00  f2=0.07  f3=0.16  f4=0.15  f5=3.75
  chains while losing:   13.5%  (<40% pool when fired)
  backfire rate:         20.0%  (fraction of fights with >=1 backfire)
  chains backfired:      12.5%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   31.0%  (1477/4763 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-heal roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   19.3%
  win rate by fight:     f1=100.0%  f2=97.2%  f3=99.4%  f4=97.6%  f5=20.5%
  dip rate:              13.2%  (tank line ever broke, or no tank)
  chain rate:            77.4%  (fraction of fights a chain fired)
  full-spectacle rate:   29.4%  (should track wins-with-chain>=3, below)
  windup death rate:     5.2%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    42.2%
  wins with no chain:    37.2%  (big win, not only win)
  chain length hist:     0:1688  1:632  2:490  3:386  4:248  5:317  6:244  7:875
  mean fight duration:   18.23s  (stddev 5.98s)
  duration percentiles:  p10=11.5s p25=13.0s median=17.4s p75=21.5s p90=28.0s p99=30.1s
  mean deaths per run:   4.12
  deaths by fight:       f1=0.00  f2=0.15  f3=0.05  f4=0.15  f5=3.76
  chains while losing:   14.8%  (<40% pool when fired)
  backfire rate:         20.2%  (fraction of fights with >=1 backfire)
  chains backfired:      14.4%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   20.4%  (770/3783 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-heal roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   13.9%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=94.1%  f4=90.5%  f5=16.6%
  dip rate:              17.4%  (tank line ever broke, or no tank)
  chain rate:            83.3%  (fraction of fights a chain fired)
  full-spectacle rate:   34.9%  (should track wins-with-chain>=3, below)
  windup death rate:     10.1%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    47.3%
  wins with no chain:    28.5%  (big win, not only win)
  chain length hist:     0:1376  1:660  2:539  3:325  4:188  5:212  6:259  7:1183
  mean fight duration:   21.88s  (stddev 10.33s)
  duration percentiles:  p10=11.4s p25=15.0s median=20.6s p75=26.5s p90=34.1s p99=50.5s
  mean deaths per run:   4.35
  deaths by fight:       f1=0.00  f2=0.10  f3=0.34  f4=0.53  f5=3.39
  chains while losing:   15.1%  (<40% pool when fired)
  backfire rate:         22.8%  (fraction of fights with >=1 backfire)
  chains backfired:      14.6%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-upgrade roster=bracer+hollow+rook+cairn+ward (n=1000) ===
  run completion rate:   42.9%
  win rate by fight:     f1=100.0%  f2=98.3%  f3=97.4%  f4=96.3%  f5=46.5%
  dip rate:              10.6%  (tank line ever broke, or no tank)
  chain rate:            83.4%  (fraction of fights a chain fired)
  full-spectacle rate:   33.6%  (should track wins-with-chain>=3, below)
  windup death rate:     5.6%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    45.1%
  wins with no chain:    32.6%  (big win, not only win)
  chain length hist:     0:1489  1:612  2:501  3:395  4:232  5:218  6:271  7:1144
  mean fight duration:   20.86s  (stddev 8.75s)
  duration percentiles:  p10=11.6s p25=14.0s median=20.8s p75=26.6s p90=30.7s p99=36.4s
  mean deaths per run:   2.97
  deaths by fight:       f1=0.00  f2=0.09  f3=0.15  f4=0.20  f5=2.53
  chains while losing:   14.2%  (<40% pool when fired)
  backfire rate:         20.1%  (fraction of fights with >=1 backfire)
  chains backfired:      13.4%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   26.0%  (1238/4754 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-upgrade roster=bracer+hollow+rook+vex+ward (n=1000) ===
  run completion rate:   46.4%
  win rate by fight:     f1=100.0%  f2=97.8%  f3=98.9%  f4=96.1%  f5=50.0%
  dip rate:              10.7%  (tank line ever broke, or no tank)
  chain rate:            78.1%  (fraction of fights a chain fired)
  full-spectacle rate:   29.7%  (should track wins-with-chain>=3, below)
  windup death rate:     2.8%  (a wind-up was the killing blow)
  failsafe rate:         0.0%  (target: 0%)
  wins with chain>=3:    42.9%
  wins with no chain:    35.0%  (big win, not only win)
  chain length hist:     0:1642  1:627  2:502  3:378  4:276  5:310  6:289  7:849
  mean fight duration:   17.89s  (stddev 5.91s)
  duration percentiles:  p10=11.0s p25=12.9s median=17.3s p75=21.4s p90=27.8s p99=29.6s
  mean deaths per run:   2.75
  deaths by fight:       f1=0.00  f2=0.12  f3=0.07  f4=0.22  f5=2.33
  chains while losing:   14.3%  (<40% pool when fired)
  backfire rate:         19.7%  (fraction of fights with >=1 backfire)
  chains backfired:      14.2%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   15.4%  (601/3905 — bounded by opportunity, not by the mechanism; see this file's docstring)
=== policy=always-upgrade roster=hollow+rook+vex+cairn+ward (n=1000) ===
  run completion rate:   11.5%
  win rate by fight:     f1=100.0%  f2=97.1%  f3=90.1%  f4=86.9%  f5=15.2%
  dip rate:              24.3%  (tank line ever broke, or no tank)
  chain rate:            82.6%  (fraction of fights a chain fired)
  full-spectacle rate:   30.3%  (should track wins-with-chain>=3, below)
  windup death rate:     11.4%  (a wind-up was the killing blow)
  failsafe rate:         0.1%  (target: 0%)
  wins with chain>=3:    43.0%
  wins with no chain:    32.4%  (big win, not only win)
  chain length hist:     0:1494  1:683  2:530  3:285  4:217  5:195  6:219  7:982
  mean fight duration:   20.51s  (stddev 9.63s)
  duration percentiles:  p10=9.9s p25=14.0s median=19.8s p75=26.0s p90=33.0s p99=44.9s
  mean deaths per run:   4.50
  deaths by fight:       f1=0.00  f2=0.17  f3=0.59  f4=0.72  f5=3.02
  chains while losing:   20.3%  (<40% pool when fired)
  backfire rate:         21.4%  (fraction of fights with >=1 backfire)
  chains backfired:      15.1%  (tracks the pool's chain-weighted mean backfireChanceFor)
  guard charges spent:   0.0%  (0/0 — bounded by opportunity, not by the mechanism; see this file's docstring)
