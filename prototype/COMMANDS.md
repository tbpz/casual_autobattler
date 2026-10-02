# Commands

```
npm install
npm run dev                        # play it — http://localhost:5173
npm run check                      # determinism + beatsheet + run-shape + offers + projection + marks + fatigue regression checks
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
npm run batch -- --n 300 --offers greedy --set chargeThreshold=45,enemyHpScale=1.8
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

## Cards, abilities and relics (2026-10-01)

```
npm run batch -- --n 3000 --offers build --cards shatter,execute,frostbolt
                                    # --cards restricts the offer pool to those cards, in that order
                                    # (RunConfig.cardPool) — try one mark's cards alone. Unknown ids throw.
npm run lab -- --cards shatterguard,brittle,crack --abilities tank:guard+stun+brace,damage:expose+scorch
                                    # hold cards / give a role abilities for one fight; card triggers print as
                                    # "CARD x <- cause (depth n)", so a cascade shows in the log.
```

In the browser, the lab takes the same thing from the URL:
`?lab=1&cards=shatterguard,brittle&abilities=tank:guard+stun`.

The batch report now ends with a **synergy** block (`src/batch/synergy.ts`): best and
worst cards by win-over-expected per fight, the best card *pairs* by lift over the better
card (a pair that wins far more together than either alone is a duo waiting to be
named), a "rarely fires" line (cards that raised no trigger in over half the fights they
were held for — Aegis and Mercenary are passive and left out), and per-relic mean rounds won.
Read it off `--offers build`; `greedy` rarely takes cards. "card triggers" replaces the old "payoff triggers" line.

New checks, all part of `npm run check`: `check:cards` (the event engine: order,
cascade cap, cause tags, determinism), `check:abilities` (the six new chain abilities,
the upgrade pools and the per-run draw), `check:cardpool` (every card fires in a forced
scenario; relics; duo unlock rules), `check:collection` (the cross-run collection's
storage rules).

**Export log (2026-10-02).** Every screen's bottom-right corner reads `seed N · export`;
clicking `export` downloads `run-<seed>-r<rounds>-<HHMM>.json` with the run so far — relic,
cards and each role's abilities going into every round, the offers shown and taken, and per
fight the chains, card triggers, per-unit damage/soak/heal and the full event list. A later
export from the same run is a superset of an earlier one. Built by `src/log/runLog.ts`,
pinned by `check:runlog`.

The collection lives in `localStorage` under `autobattler.collection.v1` and is opened
from the relic screen that starts every run.
