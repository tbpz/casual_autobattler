# Design Questions — filling in the core loop

> **What this file is:** a working doc, like `FIGHT_SCRIPT.md` — not part of the STATE/DECISIONS discipline. FIGHT_SCRIPT specified 30 seconds of *one fight*. This file is one level up: it's the questions that turn "one fight" into an actual core *loop*, plus the gaps inside the fight that FIGHT_SCRIPT left unopened.
>
> **Status (2026-07-29):** drafted, not yet answered. React section by section like FIGHT_SCRIPT — each blocking question carries a strawman; agreeing, rejecting, or replacing it is enough. Whatever survives becomes the input to the build. Anything that turns into a real decision gets proposed to `DECISIONS.md` before `STATE.md` is touched.

**Already settled — don't re-answer:** fight length (~30s), the beat sheet, the scoreboard (two aggregate HP meters), the cascade as an escalating proc chain, two-stage PRD ignition, cascade-as-big-win, run-scoped stakes, mandatory jeopardy, the layered structure. See `STATE.md` and `FIGHT_SCRIPT.md`.

---

## 1. What a hero is
*Blocking. Everything in §5 and §6 is answered in terms of heroes.*

1. Are the three heroes distinguishable from each other at all, or are they three identical bodies? — *Strawman: distinguishable, because "I assemble my squad" and "claim as mine" both collapse if they aren't.*
2. If distinguishable, by **what** — role (tank/damage/support), attack pattern, position in the formation, or just skin? — *Strawman: three roles, one of each, fixed formation.*
3. How does a glancing player with zero reading tell them apart? Silhouette, color, size, animation? — *Strawman: silhouette + position; no text, no icons.*
4. Does a hero carry anything out of a fight — damage taken, a wound, a level — or does every fight start fresh? — *Strawman: fresh every fight in the core loop.*
5. Does a hero pick its target by a rule the player could ever notice (nearest / weakest / opposite lane), or is targeting invisible plumbing?

## 2. What the cascade actually is on screen
*Blocking, and the highest-value section — this is the lead moment itself.*

6. **What does a bonus hit do?** Repeat the same attack, strike a new target, hit everything, or grow in damage each step? — *This is the single most load-bearing unanswered question in the project.*
7. Which hero goes hot — random, always the same role, the one performing best, or the last one standing?
8. Does the chain escalate **visibly** as it runs, or is bonus hit #5 identical on screen to #1? — *Strawman: it escalates — that's what sells "far bigger than I expected."*
9. Can one chain kill multiple enemies? Does a kill mid-chain change the chain (extend it, reset it, nothing)?
10. Is it unmistakable *which body* produced the payoff? (This is the attribution clause — "I can claim it as mine.")
11. What punctuates the chain **ending** — does it just stop, or is there a beat?

## 3. What the enemy is
*Blocking. There's nothing to be surprised by until this exists.*

12. Is the enemy a mirror squad, a themed squad, or one big threat?
13. **Can the enemy cascade too?** — *This is a fork, not a detail: "no" makes the cascade the player's signature; "yes" makes it a weather system that happens to everyone.*
14. What makes fight #2's enemy different from fight #1's — more HP, more bodies, different composition, different behavior?

## 4. The fight's shape
*Blocking — two gaps in the beat sheet itself.*

15. **What reliably produces the dip?** A mirror 3v3 gives a coin flip, not a dip at t≈8s every fight — yet jeopardy is mandatory *and* must be a real sim state, not staged. — *Strawman: the enemy front-loads (hits harder/faster, dies easier) and fades as its bodies drop.*
16. What ends a fight if nobody is wiped out — a 30s timer with the higher meter winning, or something else?
17. What does **losing** look like, and does the player watch it play out or get cut off?

## 5. The loop between fights
*Blocking. This is the actual "core loop" and none of it exists yet.*

18. What does the player see in the seconds right after a fight resolves?
19. What is the thing that accumulates across a run — a score, coins, a streak, survivors?
20. Does the player ever *spend* or *choose* anything with it in the core loop, or does it purely go up? — *Remember the constraint: the core loop must deliver its full payoff with zero choices.*
21. How many fights is a run, and what ends it — a fixed count, a loss, or a target?
22. On a loss: retry the same fight, lose the run, or lose what accumulated?
23. Does anything at all carry between runs, or is this a pure high-score loop? — *Note: the friend's observed behavior was 200+ rounds chasing a bare high score.*

## 6. Where variety comes from
*Blocking. Right now the only variance in the whole design is two dice on the cascade — that can't carry a session.*

24. Does the player's squad change during a run? If the core loop allows no choices, how?
25. Does the fight setup vary between fights — enemy count, composition, starting positions?
26. Is ordinary combat fully deterministic between cascades? If so, five fights with the same squad are literally identical — is that acceptable for the prototype?
27. How long before it gets boring, and what's the first thing that would fix that?

## 7. Prototype scope
*Answer these last; they decide which of the above can be stubbed.*

28. What is this prototype trying to **prove**? (The dip reads as losing? The cascade feels big? The loop sustains 10 minutes?)
29. Who plays it, and how do you judge the result — you, the friend, or both?
30. What's explicitly out of scope — squad-pick, the optional layer, art, sound?

---

## Suggested order

Answer **#6** (what a bonus hit does), **#13** (can the enemy cascade), and **#19** (what accumulates) first — the rest hang off them.

## How to use this doc

React section by section — agreeing, rejecting, or replacing each strawman is enough. Whatever survives becomes the input to the build. Anything that's a real decision rather than a working assumption gets proposed to `DECISIONS.md` before `STATE.md` is touched.
