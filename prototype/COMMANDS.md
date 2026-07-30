# Commands

```
npm install
npm run dev                        # play it — http://localhost:5173
npm run check                      # determinism + beatsheet + chain-distribution regression checks
npm run fight -- --seed 7          # one fight, headless, prints the event log
npm run run -- --seed 7 --policy always-heal
                                    # one 5-fight run, headless, prints per-fight summary
npm run batch -- --n 1000          # distribution report across the 3-policy x 2-deathPolicy matrix
npm run batch -- --n 1000 --policy always-upgrade --death onlyOnLoss
                                    # a single policy/deathPolicy combo
npm run build                      # tsc + vite production build
```

See `../PROTOTYPE_PLAN.md` for what each phase/command is for, and
`src/sim/config.ts` for every tunable constant in one place.
