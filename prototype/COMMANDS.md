# Commands

```
npm install
npm run dev                        # play it — http://localhost:5173
npm run check                      # determinism + beatsheet + chain-distribution regression checks
npm run fight -- --seed 7          # one fight, headless, prints the event log
npm run lab -- --heroes bracer,rook,cairn --charge 0,90,0 --encounter 3 --seed 7
                                    # one hand-picked fight, headless — arbitrary squad, arbitrary
                                    # encounter, per-hero starting charge %. See src/lab/labFight.ts.
npm run run -- --seed 7 --policy always-heal
                                    # one 5-fight run, headless, prints per-fight summary
npm run batch -- --n 1000          # distribution report across the 3-policy x 3-draft matrix
npm run batch -- --n 1000 --policy always-upgrade --squad burst
                                    # a single policy/draft combo
npm run measure:chain-proof -- --block 1|2|3|4|all
                                    # does the chain mechanic change outcomes at all, is chain
                                    # length really the loudest dice, and can a backfire lose a
                                    # fight outright? REPORT. See src/batch/chainProof.ts's header.
npm run measure:deciding-factors -- --block 0|1|2|3|4|5|all
                                    # ranks EVERY input to a fight's outcome — dice, carried
                                    # state, and player choices — on one shared scale, at both
                                    # the single-fight and whole-run level. REPORT. See
                                    # src/batch/decidingFactors.ts's header.
                                    # (--quick on any measure:* is a harness smoke test only —
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

`npm run dev` with `?lab=1` opens the lab instead of the real game — pick any
3 heroes, any encounter, a starting charge % per hero, and watch; optionally
run two such fights side by side on one shared clock. See `src/lab/`.
