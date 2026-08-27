# Commands

```
npm install
npm run dev                        # play it — http://localhost:5173
npm run check                      # determinism + beatsheet + chain-distribution regression checks
npm run fight -- --seed 7          # one fight, headless, prints the event log
npm run run -- --seed 7 --policy always-heal
                                    # one 5-fight run, headless, prints per-fight summary
npm run batch -- --n 1000          # distribution report across the 3-policy x 3-draft matrix
npm run batch -- --n 1000 --policy always-upgrade --squad burst
                                    # a single policy/draft combo
npm run measure:affinity -- --n 1500 --block A|B|C|all
                                    # does chainAffinity actually win more, or is the pick-screen
                                    # appeal purely visual? a REPORT, not a check — not part of
                                    # `npm run check`. See src/batch/affinity.ts's header.
npm run measure:chain-leverage -- --block 1|2|3|4|5|all
                                    # is the chain mechanic load-bearing, does hero pick change what
                                    # it does, and how many runs would it take to notice? REPORT.
                                    # See src/batch/chainLeverage.ts's header.
npm run measure:shape-verdict -- --block 1|2|3|4|all
                                    # is burster actually a better pick than grinder? equal-EV says
                                    # no; this measures the three things that math can't see.
                                    # REPORT. See src/batch/shapeVerdict.ts's header.
                                    # (--quick on either measure:* is a harness smoke test only —
                                    # the numbers it prints are not trustworthy.)
npm run build                      # tsc + vite production build
```

See `../STATE.md` for current status and `../DECISIONS.md` for why things are
the way they are; `src/sim/config.ts` holds every tunable constant in one
place.

`npm run dev` with `?test=1&seed=N` runs the attribution self-test protocol —
see `ATTRIBUTION_TEST.md`. Holds each fight's recap behind a "Show what
happened" button and pins/displays the run seed; both are no-ops without the
query params.
