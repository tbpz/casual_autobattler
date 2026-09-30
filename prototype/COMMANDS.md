# Commands

```
npm install
npm run dev                        # play it — http://localhost:5173
npm run check                      # determinism + beatsheet + run-shape + offers + projection + marks regression checks
npm run fight -- --seed 7          # one fight, headless (starting tank+damage+support squad vs. round 1), prints the event log
npm run lab -- --roles tank,damage,support --charge 0,90,0 --encounter 3 --seed 7
                                    # one hand-picked fight, headless — arbitrary role squad, arbitrary
                                    # encounter, per-unit starting charge %. See src/lab/labFight.ts.
npm run run -- --seed 7 --offers greedy
                                    # one full 20-round run, headless, prints per-round summary.
                                    # --offers: first | random | greedy | build (default first)
                                    # "build" = greedy that also chases connected payoff cards and ability gains
npm run batch -- --n 1000 --offers greedy
                                    # distribution report across N runs at one offer policy
npm run batch -- --n 300 --offers greedy --set chargeThreshold=45,enemyHpScale=1.6
                                    # --set key=number,... overrides numeric fight/run config for this
                                    # invocation only (a tuning sweep without editing config.ts)
npm run build                      # tsc + vite production build
```

See `../STATE.md` for current status and `../DECISIONS.md` for why things are
the way they are; `src/sim/config.ts` holds every tunable constant in one
place, `src/sim/rounds.ts`'s `ROUND_PLAN` holds the round-by-round difficulty
curve, and `src/sim/offers.ts` holds the post-win reward pool.

`npm run dev` with `?test=1&seed=N` holds each round's recap behind a "Show
what happened" button and pins/displays the run seed; both are no-ops
without the query params.

`npm run dev` with `?lab=1` opens the lab instead of the real game — pick a
role per slot, any encounter, a starting charge % per unit, and watch;
optionally run two such fights side by side on one shared clock. See
`src/lab/`.
