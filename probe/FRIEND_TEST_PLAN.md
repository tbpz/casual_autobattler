# Friend Test Plan — running the fun probes with the collaborator

> **What this is:** a session runbook for sitting the friend down with the probe toys and reading the result correctly. Use it live during the session.
> **Relationship to the canon:** this executes the "Friend validation" line of STATE.md "Next up" step 2. It does not overturn anything. Any *decision* that falls out of a session gets logged to DECISIONS.md afterward (see §6), not written here.
> **Status of the arms:** emergence-only (`probe/emergence/`) and RNG-only (`probe/rng/`) are built and have guided walkthroughs. The wired-together arm (arm 3) is **not built yet** — Phase 2 below is planned, not runnable today.

---

## 0. The one principle that governs everything

The friend's signal is **not symmetric** with Tu's. Two reasons, and they set what each arm is actually for:

1. **He is the fresh player.** Tu designed the emergence puzzle, so Tu's own boredom on it is unreliable (he knows the solve). The friend doesn't. That makes **the friend the only trustworthy judge of the emergence/building moment — in both directions** (lean-in *and* bounce both count as real evidence).
2. **He is the RNG-lover.** On the RNG arm his *enjoyment* is nearly a foregone conclusion, so "did he have fun" tells you little. The informative test there is the **"claim as mine"** clause: does the payoff feel like *his call*, or like *the dice did it*?

So: **his emergence verdict is high-signal; his RNG enjoyment is low-signal but his RNG attribution is high-signal.** Read every result through that lens.

**Discipline carried from DECISIONS 2026-07-22:** a felt signal is trusted only after it's checked against structure. A lean-in is trustworthy self-report. A bounce or a "that was mine" claim gets checked against the toy's actual math (the `explore`/`node toy.mjs` harness, or the session log) before it becomes a verdict.

---

## 1. Ground rules for running the session

- **Don't prime him.** Do not say "we think RNG is your half" or "this one is supposed to feel unattributable." Let the toy speak. The blurbs in the guided flow already say what's needed.
- **Watch behavior over words.** The real datum is whether he presses **Play again** without being asked, leans toward the screen, or reaches for the mouse. Self-reported "yeah that was fun" is weaker than an unprompted "wait, let me try one more."
- **Let him narrate.** Ask him to think out loud. The gold is spontaneous lines like "oh that's because I put X before Y" (attribution present) vs. "huh, guess I got lucky" (attribution absent).
- **One arm per sitting if possible.** Don't A/B them back-to-back in five minutes — fatigue and contrast effects muddy the read. If both in one session, take a real break between.
- **Capture the log.** At the end of each arm, have him click **Copy session log** and paste it to you. It records rows, scores, guesses (emergence) or best-so-far chase (RNG) — the structural check for §0's discipline.
- **Files:** open the `guided.html` for each arm directly in a browser (double-click / file://). The guided flow is the friend-facing one; `play.html` is the raw sandbox and is a confound for a first sitting — don't start him there.

---

## 2. Sequencing (the live decision)

**Recommended default — emergence guided first, then RNG guided, arm 3 later.** Rationale: emergence is the one thing only he can measure (fresh-player read on the puzzle), so harvest it first; frame the ask *narrow* ("borrow your eyes on this puzzle toy for 10 min," **not** "is this our game") so a bounce on his least-favorite half doesn't read as a verdict on the project or sour him.

**Alternative — wait and give him arm 3 first.** STATE's open worry: testing him on emergence-only in isolation asks him to judge his least-favorite half alone, risking a false negative. If you'd rather not spend his goodwill on a half-answer, hold until the wired arm exists and let Phase 2 be his first contact. Cost: you lose the clean fresh-player read on emergence-alone.

Pick one before the session. RNG-only in isolation is the **lowest-value** of the three (his enjoyment there is predetermined) — run it for the attribution read, not as a make-or-break.

---

## 3. Phase 1 · Emergence-only (`probe/emergence/guided.html`)

**How to run:** 6 stages, each a prebuilt row. He **guesses the score, then presses Play.** Stages 1–4 teach the chain (shout/react → echo → mult). Stage 5 is a real either/or pick for one slot (compare both). Stage 6 is the free sandbox: all 15 soldiers, pick any 5, "go find the best combo."

**What to watch:**
- **The guess gap.** The whole point is guess-vs-actual. Big gaps + a delighted reaction = the "paid off bigger than I expected" beat landing. Accurate guesses = the build is legible but unsurprising (fails the moment).
- **Sandbox pull.** Does he keep rebuilding rows in stage 6 hunting a better combo? Unprompted iteration = the target lean-in (this is what Tu felt).
- **The ceiling moment.** Does he find the crit engine, realize it's *the* answer, and stop? That's the predicted solved-forever wall — expected, not a failure.

**The decisive question (ask only after he's done, in his words):**
> "Did you want to keep trying combos, or did it feel solved?"

**Expected outcomes → action:**

| What happens | Reading | Action |
|---|---|---|
| Leans in on the sandbox, *then* hits solved-forever like Tu | **Fresh-player corroboration** of the 07-22 result — strongest version of the emergence signal | Confirms emergence is a real ceiling engine that can't stand alone. Reinforces the bridge bet. Nothing reopens. Log the corroboration. |
| Leans in and *keeps* finding builds (no wall) | His ceiling is higher than Tu's — emergence-alone may carry further than assumed | Note it; softens but doesn't overturn "emergence needs RNG." Worth a DECISIONS entry if strong. |
| Bounces / "too complex" / no pull | **Ambiguous** — could be the moment failing, or just his least-favorite half + rules load | **Weak evidence — do NOT treat as rejection.** Check the session log: did he ever build the crit engine? If he never reached it, it's a reach problem, not a fun verdict. This is the false-negative STATE warns about. |
| Accurate guesses throughout, no surprise | The chain is legible but doesn't over-deliver — "pay off bigger than expected" clause not met by emergence alone | Real signal that emergence needs the RNG trigger to supply the surprise. Feeds the bridge. |

---

## 4. Phase 1 · RNG-only (`probe/rng/guided.html`)

**How to run:** 6 stages, each adds one gambling soldier. **No score-guessing** — the felt test is **the chase**: press Play several times on the same row, watch **best-so-far** and the last-20-rolls bars. Stage 4 is the +60 jackpot (keep rolling until it hits). Stage 5 asks "does your choice matter, or does luck wash it out?" Stage 6 is the sandbox (8 soldiers, pick 5) with the explicit prompt: *"when a big number lands, notice whether it feels like your call paid off, or like the dice did it despite you."*

**What to watch:**
- **The chase pull.** Does "best so far" climbing make him press again unprompted? That's RNG's version of lean-in — but expected, since he loves dice. Necessary, not sufficient.
- **Attribution language (the real datum).** On a big roll: "*my* row did that" / "I stacked the jackpots" = attribution present (surprising — challenges the slot-machine prediction). "Lol lucky" / "the dice did it" = attribution absent (matches prediction).
- **Stage 5 read.** Does he feel his pick mattered, or did variance drown it? "Barely mattered which I took" = the ceiling-less failure mode showing up.

**The decisive question (after he's done):**
> "When the big one hit — did it feel like *you* made that happen, or like it happened *to* you?"

**Expected outcomes → action:**

| What happens | Reading | Action |
|---|---|---|
| Chases hard **and** "that was my build" | Surprising — challenges the predicted unattributable slot-machine | **Check against the log before trusting it** (was his best row actually better than a random one, or is he fooling himself?). If it holds, RNG-alone is more viable than assumed — worth a DECISIONS entry. |
| Chases but "the dice did it" / "lucky" | Matches the prediction exactly — even the RNG-lover can't claim a pure-luck outcome | **Cleanest possible result.** Confirms RNG-alone fails "claim as mine." Strongest motivation for the wired arm. Log it. |
| No pull at all | RNG-alone rejected outright (mirror of emergence needing a partner) | Clean — both halves proven insufficient solo. Log it. |
| Stage 5: "didn't matter which I picked" | Ceiling-less confirmed — a better build barely moves the outcome | Confirms RNG needs emergence's depth wired in to reward playing better. |

---

## 5. Phase 2 · Wired-together (arm 3 — NOT BUILT YET)

This is the decisive arm and the actual bet: **RNG triggers, emergence amplifies.** Build it before this phase (STATE "Next up" step 2). His RNG-lover attribution read is what makes-or-breaks here — the whole hypothesis is that a dice-fired cascade satisfies *both* the chaos-lover and the system-engineer from the same event.

**What to watch:** the full moment firing at once — "I set it up, luck fired it, it ran away past what I planned, and it's still mine."

**Expected outcomes → action:**

| What happens | Reading | Action |
|---|---|---|
| Both makers lean in **and** attribution holds | Bridge hypothesis validated on both makers | **Green light.** Cast the lead, re-Settle the validated hypotheses, resume construction. This is the win the whole plan aims at. |
| Lean-in but attribution muddy (can't tell setup from luck) | Concept works, *execution* off | Iterate the wiring — not a concept death. |
| Tu leans in, friend doesn't (or vice versa) | Late-surfacing **divergence** — moments secretly conflict, or moment isn't buildable | Expensive: reopen OQ-0 / alignment. |
| Neither leans in | The shared-moment bet itself is in question | Back to discovery. |

---

## 6. Rolling the results up into a decision

**The rule (from STATE, unchanged):** whichever arm produces lean-in **for both makers** becomes the lead mechanic; others become support or get cut; re-Settle only after.

**How Phase 1 feeds that:**
- Emergence and RNG are each expected to prove **insufficient alone** (emergence: solved-forever; RNG: unattributable/ceiling-less). Confirming both cleanly is a *success* — it's the empirical case for why the bridge is needed, not a dead end.
- The one result that would change course: a *clean, log-verified* lean-in **with attribution** on either arm in isolation. That would reopen "both, wired together" and is worth a decision entry.

**What to log to DECISIONS.md afterward** (only on Tu's confirmation, per CLAUDE.md — propose, don't auto-write):
- The sequencing choice you made in §2, once the session is done and it's real.
- Each arm's verdict for the friend (lean-in / bounce / attribution present-or-absent), checked against the session log.
- Any surprise that overturns a prediction (e.g., RNG-alone felt attributable to him).

**Then resync STATE.md** (only when Tu asks) around the new state of OQ-0's probe-validation half.

---

## 7. Session checklist (tear-off)

- [ ] Decide sequencing (§2) before he arrives.
- [ ] Open the right `guided.html` in a browser; don't start him in `play.html`.
- [ ] Don't prime. Ask him to think out loud.
- [ ] Watch for unprompted **Play again** / rebuilds — that's the datum, not "was it fun."
- [ ] Emergence: track the guess-vs-actual gap. RNG: listen for "mine" vs. "the dice did it."
- [ ] Ask the one decisive question per arm (§3, §4) only *after* he's done.
- [ ] Have him click **Copy session log**; paste it to you.
- [ ] Check any bounce / any "that was mine" against the log before trusting it (§0 discipline).
- [ ] Propose the DECISIONS entries to Tu; don't auto-write. Resync STATE only when asked.
