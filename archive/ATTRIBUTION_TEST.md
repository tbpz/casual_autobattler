# Attribution self-test

A play protocol for converting "I don't feel attribution" into a located break — which lever, at
which link in the causal chain. See DECISIONS.md for the entry logging this (once confirmed) and
STATE.md's Next up #1, which this answers.

Run with instrumentation on: `npm run dev` then open with `?test=1` (holds the recap behind a
button so you can't read the game's explanation before writing your own) and optionally
`&seed=N` (pins and displays the run seed, bottom-right corner of every screen, for reproducing a
specific fight — e.g. `http://localhost:5173/?test=1&seed=12345`).

## Probe C first — the noise floor (no playing required)

Run `npm run check:chaindist` and read off, before judging anything you feel while playing:

- **Draft spread (non-trap drafts):** max completion vs. floor completion across the 6 possible
  5-hero drafts. As of 2026-08-20: max 22.5% (leave-out=rook) vs. floor 19.5% (leave-out=cairn) —
  **a ~3-point spread**. If the spread you see stays this tight, the draft pick (L1) barely moves
  the outcome, and a DICED verdict on L1 cards is telling the truth, not a personal failure to
  read the game.
- **Extreme-risk single-tank drafts** (leave-out=bracer or leave-out=hollow): 10.5% / 8.2% —
  clearly a different, much worse regime. So L1 does matter at the extremes (don't leave out your
  only tank); it just doesn't discriminate much among the other four.
- Re-run this before each session — if a config change moved these numbers, the numbers above are
  stale.

## Before playing — the baseline card (5 min, once)

Write, without opening the code:

- For each of the 6 heroes: one sentence on what its chain does *differently*.
- "A fight is usually decided by ___."
- "The thing I control most is ___."

Then diff against `src/sim/heroes.ts`'s `CHAIN_PROFILES` and the `identity` strings on
`PLAYER_HERO_POOL`. This is the calibration read for lever L1 at link "state it" — a caveat, not a
score: you wrote the sim, so this link is not a fair test of what a real player would know. If your
own recall is fuzzy here, that's still useful data — it means the pick screen isn't teaching the
shape either.

## The five levers

| | Lever | Where it lives |
|---|---|---|
| **L1** | Draft — 5 of 6, once per run | squad-pick screen |
| **L2** | Field pick — which 3 fight (body/role/HP) | field-pick screen |
| **L3** | Field pick — whose **charge bar** is close, i.e. who is likely to fire at all | the charge bar on each hero row, carries across fights |
| **L4** | Chain **shape** of whoever fires (fuse length, escalation knee) | the CHAIN sparkline/label on each hero row |
| **L5** | Coin spend — heal / upgrade / skip | spend screen after a win |

## The five links

1. **State it** — before playing, can I say what this pick will change?
2. **Predict it** — can I call the result, or the deciding event, in advance?
3. **See it** — while watching, do I perceive the thing I chose actually happening?
4. **Connect it** — after, can I name my choice as the cause?
5. **Change it** — can I name a *specific* different action I'd take next time?

Each break implies a different fix: link 1/2 → the pick screen and the model; link 3 → pacing and
tells; link 4 → delay and simultaneity; link 5 → the numbers themselves.

## Per-fight card (fill for ~12 fights, ~3–5 runs)

Copy this block per fight. **Everything in ① and ③ is written before you're allowed to see the
answer** — that's what `?test=1` enforces at ③.

```
FIGHT ___  seed ___  encounter ___

① AT FIELD PICK (before confirming)
  Fielded: ___
  Because: ___                              (must name a mechanism, not a mood)
  Call it: win / lose / too close — decided by: ___
  Who chains, how big: ___

② WHILE WATCHING (two marks only, nothing written)
  Felt decided: early / middle / end / never
  Surprised me: Y / N

③ IMMEDIATELY AFTER (recap still hidden)
  Result: won / lost
  Decided by: ___                            (one sentence)
  That was: mine / luck / the game's / can't tell
  Next time here I would: ___                (specific action, or "NOTHING")

④ REVEAL (tap "Show what happened", then score)
  Outcome call: hit / miss
  Who-chains call: hit / miss
  My cause vs. ground truth: true / false / can't verify
  CODE: OWNED / FOOLED / DICED / BLIND / MOOT
```

### The five codes

| Code | Pattern | Means | Points at |
|---|---|---|---|
| **OWNED** | named a decision, true | attribution present | keep doing this |
| **FOOLED** | named a decision, false | mis-attribution | the tells are lying — check fightView.ts/playback.ts against sim/fight.ts |
| **DICED** | named randomness, true | honest luck dominance | signal < noise in sim/config.ts — no UI fix works |
| **BLIND** | named nothing / "they were too strong" | opacity | pacing, tells, recap — a legibility pass |
| **MOOT** | decided by something with no lever (encounter draw, attrition from 2 fights ago) | out of scope for this fight | the run layer, not the fight |

### Protocol rules

- Never edit ① after seeing the fight.
- Don't re-read earlier cards mid-session — anchoring manufactures false consistency.
- Stop at 12 cards even mid-run; a partial run's cards are still valid.

## End of session — the lever × link grid (10 min, once)

Score each cell **works / weak / broken / N/A**, informed by the cards:

```
            state   predict   see   connect   change
L1 draft     N/A      ·        ·       ·         ·
L2 bodies    N/A      ·        ·       ·         ·
L3 charge    N/A      ·        ·       ·         ·
L4 shape     N/A      ·        ·       ·         ·
L5 coin      N/A      ·        ·       ·         ·
```

L1's "state" column is N/A for you specifically (see baseline-card caveat above) — get a friend to
fill that one cell if you want it covered.

**This grid is the deliverable.** It replaces "attribution is absent" with a located break.

## Two probes, after the cards (~15 min)

**Probe A — blind shape ID.** The instant a chain starts, call out which shape is firing (long
fuse / short fuse / back-loaded / front-loaded / steady) *before* the end card reveals the label.
5 tries. A miss means L4 is invisible at link "see it" — no amount of number-tuning will be felt
until that's fixed.

**Probe B — same seed, opposite pick.** Pin a seed, play fight 1 twice against the same encounter:
once fielding the short-fuse pair, once the long-fuse pair. Did they feel different? Could you
tell them apart blind? Caveat: the run's RNG stream diverges the moment the actors differ
(same seed does not mean same rolls once the field pick changes), so this is a *perception* check,
not an outcome measurement — Probe C already covers outcome.

## Reading the result

| Dominant pattern | Diagnosis | Next pass goes to |
|---|---|---|
| Mostly DICED + Probe C flat | lever real but smaller than noise | `sim/config.ts` — chain length's spread, or a new lever. Not the UI. |
| Mostly BLIND + Probe A fails | lever exists, never perceived | `fightView.ts` / `playback.ts` |
| Mostly FOOLED | tells actively mislead | whatever the HUD/end card claims vs. `resolveChainHit` |
| Mostly MOOT | fights decided upstream | the run layer — attrition, encounter draw, `roster.ts` |
| Link 2 fails, 3–5 pass | can see it, can't call it | `chainMagnitudeTarget` equalized EV on purpose (2026-08-20 Step 3) — may need revisiting, worth a DECISIONS entry either way |

Whatever comes back is a played verdict — the thing STATE.md's open questions are waiting on.
