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
npm run batch -- --n 1000 --offers build --set mergeEnabled=0
                                    # the same with merge heroes turned off, to compare (mergeEnabled=1 is the default);
                                    # the report's "merge heroes" lines show how many runs made a hero and how they finished
npm run batch -- --n 1000 --offers build --army undead
                                    # the same as an army run: --army undead|beasts|mages|none (none, or no flag, is the plain squad)
npm run build                      # tsc + vite production build
```

See `../STATE.md` for current status and `../DECISIONS.md` for why things are
the way they are; `src/sim/config.ts` holds every tunable constant in one
place, `src/sim/rounds.ts`'s `ROUND_PLAN` holds the round-by-round difficulty
curve, and `src/sim/offers.ts` holds the post-win reward pool.

`npm run dev` with `?test=1&seed=N` adds the full chain / death log to the
run-over screen and pins/displays the run seed; both are no-ops without the
query params.

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
were held for — Aegis is passive and left out), and per-relic mean rounds won.
Read it off `--offers build`; `greedy` rarely takes cards. "card triggers" replaces the old "payoff triggers" line.

New checks, all part of `npm run check`: `check:cards` (the event engine: order,
cascade cap, cause tags, determinism), `check:abilities` (the six new chain abilities,
the upgrade pools and the per-run draw), `check:cardpool` (every card fires in a forced
scenario; relics; duo unlock rules).

**Export log (2026-10-02).** Every screen's bottom-right corner reads `seed N · export`;
clicking `export` downloads `run-<seed>-r<rounds>-<HHMM>.json` with the run so far — relic,
cards and each role's abilities going into every round, the offers shown and taken, and per
fight the chains, card triggers, per-unit damage/soak/heal and the full event list. A later
export from the same run is a superset of an earlier one. Built by `src/log/runLog.ts`,
pinned by `check:runlog`.


**Merge heroes (2026-10-20, branch dev/merge-heroes).** `check:heroes` pins each hero's gift and skill in a small fight, the
merge rules (when it is offered, which units it uses, the full-squad rule), Dragon growth and the Twin's copy. Dev links:
`?offer=7&seed=10` opens the merge pick (round 7 is the first mini-boss), `?round=8&merge=necromancer&seed=10` plays on to round 8
having taken that hero (the first it can make if it cannot make that one), and `&fight=1` starts that round's fight at once.
Seeds that reach round 7 with the default picks: 10, 11, 21, 23, 24, 30.

**Armies (2026-10-20, branch dev/merge-heroes).** A run opens on a pick between Undead, Beasts and Mages (`render/armyScreen.ts`); every unit is then that army's
own (`sim/armies.ts`). `check:armies` pins the starting squads, the Undead's horde (Raise, Bone Wall, Command, the five-skeleton limit and upgrade, the order of enemy hits, both backfires), the Beasts' pounce (one PACK bar, the Bear leading, Pin, Maul, Tend, gained skills, the backfire), the Mages' orbs (the core orb, no plain attack, add, merge, clear, the beat, the Life drain and Great Drain, backfire) and that a seed replays the same run for each army. Merge heroes are off while an army is picked. Dev links: `?army=undead`, `?army=beasts` or
`?army=mages` starts as that army without the pick, `?army=none` plays the plain squad; a link that jumps ahead (`?round=`, `?offer=`, `?fight=1`,
`?runover=1`, `?fall=`) skips the pick and plays the plain squad unless it names an army, so the merge links above still work. Army cards are
generated from the canvas by `node design/tools/gen-armies.js` (it also redraws canvas frames 10.x and 11.x).
