# Friend-Test Protocol — running and de-noising the 3 probes

> **What this is:** the live session runbook for sitting the friend down with the RNG, emergence, and wired probes and reading the result correctly. Use it during the session.
> **Relationship to the canon:** this executes the "Friend validation" line of STATE.md's "Next up" step 2. It does not overturn anything. Any *decision* that falls out of a session gets proposed to Tu and, only on confirmation, logged to DECISIONS.md — not written here (see §9).
> **Tonight:** session 2026-07-26 · judging bar **lean-in** ("do I not want to stop?") · wired arm **base only** (`wired/layers.html` out of scope) · framing **blind** (no naming which arm is which) · result status **friend-only, n=1 — not yet logged**.

---

## 0. The one principle that governs everything

The friend's signal is **not symmetric** with Tu's. Two reasons, and they set what each arm is actually for:

1. **He is the fresh player.** Tu designed the emergence puzzle, so Tu's own boredom on it is unreliable (he knows the solve). The friend doesn't. That makes **the friend the only trustworthy judge of the emergence/building moment — in both directions** (lean-in *and* bounce both count as real evidence).
2. **He is the RNG-lover.** On the RNG arm his *enjoyment* is nearly a foregone conclusion, so "did he have fun" tells you little. The informative test there is the **"claim as mine"** clause: does the payoff feel like *his call*, or like *the dice did it*?

So: **his emergence verdict is high-signal; his RNG enjoyment is low-signal but his RNG attribution is high-signal.** Read every result through that lens — and it's exactly why the wired arm carries the highest-value comparison tonight (§8).

**Discipline carried from DECISIONS 2026-07-22:** a felt signal is trusted only after it's checked against structure. A lean-in is trustworthy self-report. A bounce or a "that was mine" claim gets checked against the toy's actual math (the session log, or the `explore`/`node toy.mjs` harness) before it becomes a verdict.

---

## 1. The three arms tonight

Fixed run order — write this table on paper before he arrives; it's the yardstick that lets you discount noise in the moment.

**RNG → Emergence → Wired (base)**

| Arm | The one question | How it runs | Decisive question (ask only after he's done) |
|---|---|---|---|
| **RNG-only**<br>`rng/guided.html → play.html` | Does the jackpot-chase hook him? | 6 stages, each adds one gambling soldier. No score-guessing — the felt test is the chase: press Play repeatedly on the same row, watch best-so-far and the last-20-rolls bars. Stage 4 is the +60 jackpot. Stage 5 asks whether his pick mattered or luck washed it out. Stage 6 is the sandbox (8 soldiers, pick 5). | "When the big one hit — did it feel like *you* made that happen, or like it happened *to* you?" |
| **Emergence-only**<br>`emergence/guided.html → play.html` | Does engineering a deterministic cascade hook him? | 6 stages, each a prebuilt row. **He guesses the score, then presses Play** — the guess-vs-actual gap is the whole thing being tested. Stages 1–4 teach the chain (shout/react → echo → mult). Stage 5 is a real either/or pick for one slot. Stage 6 is the free sandbox: all 15 soldiers, pick any 5, go find the best combo. | "Did you want to keep trying combos, or did it feel solved?" |
| **Wired**<br>`wired/guided.html → play.html` | Does a dice-triggered built cascade land as "mine"? | 6 stages. No score to guess — the dice make every run different. See the caveat below; the bar here is different for him than it was for Tu. | "When the big one hit — was that your build paying off, or the dice?" |

---

## 2. The wired caveat — read this before his session

Tu already found base wired flat — "spam spark and hope." So a flat reaction from the friend is **ambiguous**: same structural flatness, or genuine rejection?

But the open hypothesis is that **his floor-need may enjoy the exact low-agency chase Tu found boring.** So base wired asks: does the person who wants a highlight-while-playing-badly enjoy the thing that bored the person who wants decision-density? Read his session as a test of *that*, not of depth.

- **If he's flat too** → the bridge needs a decision layer for both of you.
- **If he leans in where Tu didn't** → the floor/ceiling split is showing up live, and that's strong support for the bridge as designed.

---

## 3. Confound catalog — ranked by how likely it fakes a result

1. **Abstraction / skin confound** *(high)*. The probes render as letters, a number, and a text log — not the game's fiction (squads, terrain, a watched fight). The shared moment is explicitly watch-native. He can reject "this is a spreadsheet," a presentation artifact, not a verdict on the mechanic.
   **Mitigation:** one framing sentence up front naming the skin as placeholder; lead every arm with `guided.html` so the mechanic, not the abstraction, is what he meets first.

2. **Rules-overload confound** *(high)*. Emergence has 15 dense tokens — consume, charges, slot-1-only, retroactive mult caps. If he can't hold the system in his head, confusion reads as "don't like it."
   **Mitigation:** always start in `guided.html` (staged, one idea at a time). Only hand over the raw sandbox once he's shown he follows the pieces.

3. **The base-wired ambiguity.** Covered in §2 — managed by reading his wired session against the friend-specific bar, not the depth bar Tu used on himself.

4. **Single-session RNG variance.** RNG and wired use unseeded rolls. A cold streak means he may never see a jackpot or surge, and the chase can't hook on misses alone.
   **Mitigation:** get him ~15–20 attempts per build before judging the chase. Don't let him quit after four cold rolls — note it and have him re-roll a fresh build instead.

5. **Animation cap kills the biggest payoffs — fixed.** All three used to dump straight to a bare final number past 140 animated steps — exactly the runaway/ignited runs, the moment you most want him to watch.
   **Patched:** `emergence/{play,guided}.html` and `wired/{play,guided}.html` now fast-forward through big cascades on a ~2.5s budget instead of jumping to a static number. `rng/*` never had this cap; `wired/layers.html` is untouched since tonight is base-only.

6. **Order / fatigue / contrast effects.** Three probes back to back — whichever runs last gets a tired read, and a rich arm makes the next feel shallow by contrast.
   **Mitigation:** fixed order above, short breaks between arms, and stop at two if he's flagging — a fresh read of two beats a tired read of three.

7. **Demand characteristics & his RNG bias.** He's your collaborator with a stated RNG favorite — he may play to please you, or lean toward "the RNG one."
   **Mitigation:** blind framing — don't name which arm is which, don't reveal your results, and never prompt a replay. An *unprompted* "one more" is your cleanest lean-in evidence.

8. **Clauses these probes can't test.** There's no stakes / dread→relief and no watched fight anywhere in these probes — they're infinite free-reroll score sandboxes. "It's not visceral" or "I didn't feel tension" is out of scope tonight, not a failure of the approach.

9. **"Guess the score" can read as a quiz.** Emergence's guess-the-score step is a measurement instrument, not inherently fun — it can feel like being tested. It's built into `guided.html` itself (not just the sandbox), so there's no file choice that avoids it.
   **Mitigation:** frame it as "there's no wrong guess, the gap is the whole point" before he starts stage 1 — take the quiz-feeling off the table with words, since you can't route around it structurally.

---

## 4. Pre-flight

- [ ] Open each `guided.html` once yourself — confirm it loads over `file://` and the walkthrough advances.
- [ ] Speed selector set to **fast** in each (`rng`, `emergence`, `wired` all default to **normal**) — less dead time between rolls.
- [ ] Row 1 of the arm table (§1) copied to paper as your scoring sheet, plus the five reaction buckets (§7).

---

## 5. Framing — say once, then go quiet

> "These are three rough feel-tests, not the real game. The soldiers-as-letters and the score number are placeholders — ignore how plain it looks. Just play each one and tell me if you want to keep going or you're done. There's no right answer and nothing you say can be wrong. Think out loud if you can — I'll mostly just watch."

Do **not** say which is the RNG one, which is your favorite, or what you found. Do **not** ask "wasn't that cool?" or "want to play again?" — let replays be spontaneous. After this one ask, go quiet: no running commentary, no reactions to his reactions.

---

## 6. Ground rules while running the session

- **Watch behavior over words.** The real datum is whether he presses **Play again** without being asked, leans toward the screen, or reaches for the mouse. Self-reported "yeah that was fun" is weaker than an unprompted "wait, let me try one more."
- **Let him narrate, but don't prompt reactions.** The gold is spontaneous lines like "oh that's because I put X before Y" (attribution present) vs. "huh, guess I got lucky" (attribution absent).
- **Capture the log.** At the end of each arm, have him click **Copy session log** and paste it to you — available in all three `guided.html` files (also in `wired/play.html`, but not in `rng/play.html` or `emergence/play.html`). It records rows, scores, guesses (emergence) or best-so-far chase (RNG/wired) — the structural check for §0's discipline.
- **Files:** open the `guided.html` for each arm directly in a browser (double-click / `file://`). The guided flow is the friend-facing one; `play.html` is the raw sandbox and is a confound for a first sitting — don't start him there.

---

## 7. Reading his reactions live — two axes

### Engagement (bucket every reaction as it happens)

| Bucket | Read | What it looks like |
|---|---|---|
| **LEAN-IN** | Target signal | Replays unprompted, "one more," starts theory-crafting builds. |
| **UNDERSTOOD & DONE** | Real negative — count it | "I get it, I'm good." A genuine signal the approach doesn't hold him. |
| CONFUSED | Noise | "Wait, what does this do?" — comprehension load, not a verdict. Re-teach, retry. |
| SKIN-BOUNCE | Noise | "It's just numbers / looks boring." Presentation, not the mechanic. Note and discount. |
| COLD-LUCK | Noise | Bored after only misses — variance. Get him more attempts before judging. |

Only LEAN-IN and UNDERSTOOD-AND-DONE count toward a verdict. If an arm produced only noise-bucket reactions, you learned nothing about that arm — don't log a result for it.

### Attribution (the decisive end-of-arm question, §1)

- **Present:** "my row did that" / "I stacked the jackpots" / "I put X before Y."
- **Absent:** "lol lucky" / "the dice did it" / "guess I got lucky."

This axis matters most on RNG and wired — per §0, it's the high-signal read where engagement alone isn't.

---

## 8. Outcome → action, per arm

### RNG-only

| What happens | Reading | Action |
|---|---|---|
| Chases hard **and** "that was my build" | Surprising — challenges the predicted unattributable slot-machine | Check against the log before trusting it (was his best row actually better than a random one, or is he fooling himself?). If it holds, RNG-alone is more viable than assumed — worth a DECISIONS entry. |
| Chases but "the dice did it" / "lucky" | Matches the prediction exactly — even the RNG-lover can't claim a pure-luck outcome | Cleanest possible result. Confirms RNG-alone fails "claim as mine." Strongest motivation for the wired arm. Log it. |
| No pull at all | RNG-alone rejected outright (mirror of emergence needing a partner) | Clean — both halves proven insufficient solo. Log it. |
| Stage 5: "didn't matter which I picked" | Ceiling-less confirmed — a better build barely moves the outcome | Confirms RNG needs emergence's depth wired in to reward playing better. |

### Emergence-only

| What happens | Reading | Action |
|---|---|---|
| Leans in on the sandbox, *then* hits solved-forever like Tu | Fresh-player corroboration of the 2026-07-22 result — strongest version of the emergence signal | Confirms emergence is a real ceiling engine that can't stand alone. Reinforces the bridge bet. Nothing reopens. Log the corroboration. |
| Leans in and *keeps* finding builds (no wall) | His ceiling is higher than Tu's — emergence-alone may carry further than assumed | Note it; softens but doesn't overturn "emergence needs RNG." Worth a DECISIONS entry if strong. |
| Bounces / "too complex" / no pull | Ambiguous — could be the moment failing, or just his least-favorite half + rules load | Weak evidence — do NOT treat as rejection. Check the session log: did he ever build the crit engine? If he never reached it, it's a reach problem, not a fun verdict. |
| Accurate guesses throughout, no surprise | The chain is legible but doesn't over-deliver — "pay off bigger than expected" clause not met by emergence alone | Real signal that emergence needs the RNG trigger to supply the surprise. Feeds the bridge. |

### Wired (base)

| What happens | Reading | Action |
|---|---|---|
| Leans in **and** attribution holds ("my build, dice just fired it") | The floor/ceiling split showing up live — the bridge working for the RNG-lover too | Strongest possible result tonight. Log it — worth a DECISIONS entry. |
| Flat, like Tu's own read | Ambiguous per §2 — could be shared structural flatness, or genuine rejection | Check the log: did he ever reach a chained/runaway cascade, or only flat single triggers? If he never reached one, it's a reach problem, not a verdict. |
| Leans in but attribution is muddy (can't tell setup from luck) | Concept works, execution off | Iterate the wiring — not a concept death. |
| Chases the dice but credits luck, same as RNG-only | The floor-need doesn't distinguish wired from pure RNG for him | Note it — the emergence layer may not be legible enough at base depth to register as "his build." |

---

## 9. Rolling the results up into a decision

Only **lean-in** and **understood-and-done** count toward a verdict. If an arm produced only noise-bucket reactions, you learned nothing about the arm — don't log a result for it.

The highest-value comparison tonight is **RNG vs. wired-base, for him.** If the jackpot-chase hooks him but the built cascade doesn't, his half of the moment lives in the floor and the bridge may be over-built for him. If wired hooks him *more*, the bridge is working for the RNG-lover too — the strongest possible result tonight.

**What to propose logging to DECISIONS.md afterward** (only on Tu's confirmation, per CLAUDE.md — propose, don't auto-write):
- Each arm's verdict for the friend (lean-in / bounce / attribution present-or-absent), checked against the session log.
- Any surprise that overturns a prediction (e.g., RNG-alone felt attributable to him).

Anything logged is marked **friend-only, n=1** — a signal to point the next probe at, not a settled result. Then the Probe-status table in `STATE.md` gets resynced on Tu's next ask, not automatically.

---

## 10. Session checklist (tear-off)

- [ ] Load all three `guided.html` + `play.html` from disk; click through one full guided run and one sandbox run of each.
- [ ] Confirm animation, score, and log all render, and speed is set to fast.
- [ ] Paper/notes ready with the arm table (§1) and the five reaction buckets (§7) so you tag live, not from memory afterward.
- [ ] Don't prime him — no naming which arm is which, no revealing your results, no prompted replays.
- [ ] Ask the decisive question per arm (§1) only *after* he's done with it.
- [ ] Have him click **Copy session log** on each `guided.html`; paste it to you.
- [ ] Check any bounce / any "that was mine" claim against the log before trusting it (§0 discipline).
- [ ] Success tonight = for at least RNG and wired, you can name which bucket his dominant reaction fell in, confident it wasn't confusion, skin-bounce, or cold-luck.
- [ ] Propose the DECISIONS entries to Tu; don't auto-write. Resync STATE only when asked.
