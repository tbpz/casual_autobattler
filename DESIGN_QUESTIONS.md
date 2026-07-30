# Design Questions — filling in the core loop

> **What this file is:** a working doc, like `FIGHT_SCRIPT.md` — not part of the STATE/DECISIONS discipline. FIGHT_SCRIPT specified 30 seconds of *one fight*. This file is one level up: it's the questions that turn "one fight" into an actual core *loop*, plus the gaps inside the fight that FIGHT_SCRIPT left unopened.
>
> **Status (2026-07-31):** 12 of 30 answered. The first draft (2026-07-29) grouped questions by *topic* and marked six of seven sections "Blocking," which made all 27 questions look equally urgent and equally answerable by argument. Neither was true — most hang off a small dependency chain, and several are hero-texture questions no one can have real taste about before something is on screen. The 2026-07-30 pass reordered around **actual dependency** (Part 1), then **downstream detail** (Part 2), then **things to stub and let the build decide, not deliberate** (Part 3). Question numbers are unchanged from the original draft so old references still resolve. Answers land inline, marked **→ Answered**; the strawman/question text stays so the reasoning is still visible. Full detail lives in `FIGHT_SCRIPT.md` and `PROTOTYPE_PLAN.md`; real decisions are logged in `DECISIONS.md` (2026-07-31).
>
> React question by question, same as before — agreeing, rejecting, or replacing a strawman is enough. Anything that turns into a real decision gets proposed to `DECISIONS.md` before `STATE.md` is touched.

**Already settled — don't re-answer:** fight length (~30s), the beat sheet, the scoreboard (two aggregate HP meters), the cascade as an escalating proc chain, two-stage PRD ignition, cascade-as-big-win, run-scoped stakes, mandatory jeopardy, the layered structure, squad size (N=3 a side for the prototype, parameterized), what a bonus hit does (grows in damage, same hero, retargets on kill), whether enemies cascade (no, prototype), the run shape (5 fights, win-all-or-out-of-heroes, attrition, coin with two spends, lose-the-run on a loss), and prototype #1's scope (a vehicle covering the full run, one optional-layer lever). See `STATE.md`, `FIGHT_SCRIPT.md`, `PROTOTYPE_PLAN.md`, and `DECISIONS.md` (2026-07-31).

---

## Part 0 — What this prototype is for

*Answer this first. It isn't one question among 30 — it's the filter that decides which of the rest need a real answer and which can be stubbed.*

- **Q28.** What is this prototype trying to **prove**? (The dip reads as losing? The cascade feels big? The loop sustains 10 minutes?) — → **Answered 2026-07-31:** it doesn't prove a stated claim — it's a **vehicle**, built to actualize the lead moment into something real enough to judge and adjust. Logged in `DECISIONS.md`; success criteria (specific reactions, and the ability to surprise its makers) in `PROTOTYPE_PLAN.md`.
- **Q29.** Who plays it, and how do you judge the result — you, the friend, or both? — → **Answered:** both; Tu plays first. Pre-registered expectation in `PROTOTYPE_PLAN.md`: the core loop is the friend/casual half, so Tu finding it thin on repeat play is expected, not a failure signal.
- **Q30.** What's explicitly out of scope — squad-pick, the optional layer, art, sound? — → **Answered:** squad-pick, most of the optional layer, art, and sound are out. One optional-layer lever (the coin spend) is in. Full scope table in `PROTOTYPE_PLAN.md`.

---

## Part 1 — Blockers: can't write code without these

*Ordered by actual dependency, not by topic. Each answer unlocks the questions below it — this is the load-bearing chain the rest of the doc hangs off.*

- **Q6.** **What does a bonus hit do?** Repeat the same attack, strike a new target, hit everything, or grow in damage each step? — *This is the single most load-bearing unanswered question in the project — it's the lead moment itself.* — → **Answered 2026-07-31:** grows in damage each step, crit-style (20 × N, capped at 100), same hero throughout, retargets on kill. Logged in `DECISIONS.md`; detail in `FIGHT_SCRIPT.md` §3.
- **Q13.** **Can the enemy cascade too?** — *This is a fork, not a detail: "no" makes the cascade the player's signature; "yes" makes it a weather system that happens to everyone.* — → **Answered 2026-07-31:** no, not in the prototype — written side-agnostic so it's a flag to enable later, not a rewrite. Logged in `DECISIONS.md`.
- **Q19.** What is the thing that accumulates across a run — a score, coins, a streak, survivors? — → **Answered:** coin, spent to upgrade the squad within the run. Logged in `DECISIONS.md`.
- **Q15.** **What reliably produces the dip?** A mirror squad gives a coin flip, not a dip at t≈8s every fight — yet jeopardy is mandatory *and* must be a real sim state, not staged. — *Strawman: the enemy front-loads (hits harder/faster, dies easier) and fades as its bodies drop.* — → **Strawman adopted for the build (not a logged decision):** enemy damage decays linearly from 16/sec at t=0 to 2/sec at t=30. Worked check in `FIGHT_SCRIPT.md` §3.
- **Q20.** Does the player ever *spend* or *choose* anything with the run-accumulator in the core loop, or does it purely go up? — *Remember the constraint: the core loop must deliver its full payoff with zero choices.* — → **Answered 2026-07-31:** yes, one decision point — heal now or bank toward a damage upgrade — with a working accept-default (do nothing = auto-recovery only). Logged in `DECISIONS.md`.
- **Q16.** What ends a fight if nobody is wiped out — a 30s timer with the higher meter winning, or something else? — → **Strawman adopted for the build (not a logged decision):** 30s timer, higher meter wins.
- **Q21.** How many fights is a run, and what ends it — a fixed count, a loss, or a target? — → **Answered 2026-07-31:** 5 fights; win all 5, or run out of living heroes. Logged in `DECISIONS.md`.
- **Q22.** On a loss: retry the same fight, lose the run, or lose what accumulated? — → **Answered 2026-07-31:** lose the run — coin is lost, nothing carries to the next run. Logged in `DECISIONS.md`.

---

## Part 2 — Downstream: answer once Part 1 is settled

*These only make sense in terms of Part 1's answers — don't force them before Part 1 lands. Grouped by what they hang off.*

**Hero identity — hangs off Q6 (what a bonus hit does):**

- **Q1.** Are the heroes distinguishable from each other at all, or are they identical bodies? — *Strawman: distinguishable, because "I assemble my squad" and "claim as mine" both collapse if they aren't.*
- **Q2.** If distinguishable, by **what** — role (tank/damage/support), attack pattern, position in the formation, or just skin? — *Strawman: three roles, one of each, fixed formation.*
- **Q4.** Does a hero carry anything out of a fight — damage taken, a wound, a level — or does every fight start fresh? — *Strawman: fresh every fight in the core loop.* — → **Answered 2026-07-31, reversing the strawman:** HP and death both carry (attrition). HP is recoverable via free auto-recovery between fights; death is permanent for the run. Logged in `DECISIONS.md`; forces a rule change to the dip beat itself (a hero falls only in the bad-case dip, not every dip) — see `FIGHT_SCRIPT.md` §1.
- **Q5.** Does a hero pick its target by a rule the player could ever notice (nearest / weakest / opposite lane), or is targeting invisible plumbing?

**Cascade detail — hangs off Q6/Q13:**

- **Q7.** Which hero goes hot — random, always the same role, the one performing best, or the last one standing?
- **Q8.** Does the chain escalate **visibly** as it runs, or is bonus hit #5 identical on screen to #1? — *Strawman: it escalates — that's what sells "far bigger than I expected."*
- **Q9.** Can one chain kill multiple enemies? Does a kill mid-chain change the chain (extend it, reset it, nothing)?
- **Q10.** Is it unmistakable *which body* produced the payoff? (This is the attribution clause — "I can claim it as mine.")
- **Q11.** What punctuates the chain **ending** — does it just stop, or is there a beat?

**Enemy detail — hangs off Q13:**

- **Q12.** Is the enemy a mirror squad, a themed squad, or one big threat?
- **Q14.** What makes fight #2's enemy different from fight #1's — more HP, more bodies, different composition, different behavior?

**Fight-end detail:**

- **Q17.** What does **losing** look like, and does the player watch it play out or get cut off?

**Between-fight detail:**

- **Q18.** What does the player see in the seconds right after a fight resolves?
- **Q23.** Does anything at all carry between runs, or is this a pure high-score loop? — *Note: the friend's observed behavior was 200+ rounds chasing a bare high score.*

---

## Part 3 — Don't deliberate these: stub a placeholder, let the build answer them

*Taste about hero-level texture doesn't exist in the abstract — it arrives when bodies move on a screen. These are the questions where every reasonable answer sounds equally fine, which is itself the signal to stop arguing and go build. Pick the strawman, ship a stub, and let watching the build settle it.*

- **Q3.** How does a glancing player with zero reading tell heroes apart? Silhouette, color, size, animation? — *Stub: silhouette + position; no text, no icons. Three colored shapes with identical stats is enough to start.*
- **Q24.** Does the player's squad change during a run? If the core loop allows no choices, how?
- **Q25.** Does the fight setup vary between fights — enemy count, composition, starting positions?
- **Q26.** Is ordinary combat fully deterministic between cascades? If so, several fights with the same squad are literally identical — is that acceptable for the prototype?
- **Q27.** How long before it gets boring, and what's the first thing that would fix that?

---

## How to use this doc

Work top to bottom: **Part 0** decides what the build needs to prove, which tells you how much of **Part 1** needs a real answer versus a rough guess to unblock code. **Part 2** resolves itself once Part 1 is settled — don't pre-answer it. **Part 3** isn't a queue to work through at all; stub it now, revisit after the build is playable. Anything that becomes a real decision along the way gets proposed to `DECISIONS.md` before `STATE.md` is touched.
