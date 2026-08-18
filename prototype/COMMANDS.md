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
npm run build                      # tsc + vite production build
```

See `../STATE.md` for current status and `../DECISIONS.md` for why things are
the way they are; `src/sim/config.ts` holds every tunable constant in one
place.
