# Mistake Log — Casual Roguelike Autobattler

> **What this file is:** a record of times I (Claude) stated something and had to reverse it —
> because Tu pushed back, asked a question that exposed it, or I caught it myself.
> **Rules:** append-only, same as `DECISIONS.md` — never edit or delete an existing entry, only add
> new ones. Newest at the top.
> **Why it exists:** once there are enough entries, Tu will look for a pattern in the `Tag` field
> and decide what to fix systematically. How that fix happens isn't decided yet — this file only
> collects the raw material.
> **Time:** a bare date plus a same-day sequence number (`2026-09-20 #1`), not a clock time — there
> is no reliable access to time-of-day mid-session, and a fabricated one would be worse than this.
> **Logging:** I add an entry myself, without being asked, the moment a mistake happens — see
> `CLAUDE.md`'s "When I make a mistake" section for the standing rule.
>
> Entry format: `### [date #N] Title` → **Said** / **Actually** / **Caught by** / **Why** / **Tag**.

---

### [2026-09-23 #1] First safety-net fix forced a recruit into round 1 of every run

- **Said:** Fixed "a run can end from one early death because the offer draw skipped revive/recruit"
  by forcing a safety-net offer whenever living units are at or below the round's fielded squad size.
- **Actually:** That condition (`living <= slots`) is true from round 1 of every run — a run starts
  with exactly as many units as it fields, before anyone has ever died. The fix forced a recruit or
  revive into every single win's offers until the player took one, crowding out the small-early/
  big-late variety the offer pool is supposed to have.
- **Caught by:** Replaying the same seed in the browser after the first fix and reading round 1's own
  offer screen — it showed "Recruit a tank" and "Recruit a damage" on a fully healthy round 1, which
  is what exposed the over-trigger.
- **Why:** I guarded against the state that made the bug POSSIBLE ("no cushion") instead of the state
  that made it ACTUAL ("no cushion AND something has already gone wrong") — the two are identical the
  moment a run starts, and only diverge once a death happens.
- **Tag:** guarded the possible case, not the actual one

### [2026-09-21 #1] Asked Tu to re-decide two calls he'd already made

- **Said:** Two questions before planning — how far the charge bar should drop on the field-pick
  row, and whether to re-tune the Warden's damage in the same pass as its fix.
- **Actually:** Both were already settled. Tu had approved "current HP outranks the charge bar,"
  which decides that the bar goes below HP; how thin or grey it ends up is craft, not a decision.
  And he asked for a defect fix on the Warden — re-tuning its damage is a separate change that
  obviously shouldn't ride along, so the default was never in doubt.
- **Caught by:** "Why you ask me about the charge bar?"
- **Why:** I treated "this has some risk attached" as the test for whether to ask. The right test
  is whether two answers would lead to materially different work. Neither would have.
- **Tag:** handed back a call I should have made

### [2026-09-20 #4] Tuned each fight alone, didn't check what five of them add up to

- **Said:** A table of new enemy-damage numbers, each picked so that one fight's own average win
  rate would sit near 75%.
- **Actually:** Applied together across a real 5-fight run, those numbers dropped how often a run
  finishes from 18.3% to 7.6%. Five fights each won 75% of the time don't combine into a run won
  75% of the time — the chance of clearing all five multiplies down. Every number had to come back
  to 80% of the original raise to bring the run back to where it already was.
- **Caught by:** "Have you measure how the winrate changes after this implementation?"
- **Why:** I checked each fight's own number but never checked what they added up to across a full
  run before showing the table as a plan.
- **Tag:** checked one part, not the whole result

### [2026-09-20 #3] Overrated "you focus, they spread" as the reason you win

- **Said:** Across the two entries below, I treated the fact that your attacks always hit one
  enemy while theirs spread across three of your heroes as the main reason you always win.
- **Actually:** Measured directly: aiming every point of enemy damage at your weakest hero, best
  case, still kills at most 0-2 heroes and never wipes your squad. The real reason is simpler —
  enemies don't deal enough damage, full stop: 9% to 92% of your team's health over a whole fight,
  never the 100% needed to win. That pattern only decides the few fights that were already close.
- **Caught by:** "Is there any chance that the enemies['] total damage output is already as low so
  even when they focus they would still lose?"
- **Why:** Same root as the entry below — I let a more interesting, code-level explanation crowd
  out the plainer, correct one, because I hadn't measured the two against each other.
- **Tag:** trusted the code's shape over a real test

### [2026-09-20 #2] Blamed the tank threshold and enemy count, both wrong

- **Said:** "The reason isn't that the numbers are too small — it's a one-sided race," and named
  the tank threshold (`tankBreakFraction`) the main thing to fix.
- **Actually:** Moving that number from 0.03 to 0.5 changed nothing about who wins — only who
  visually takes the hits. A separate guess, that splitting the same total enemy damage across
  more or fewer bodies mattered, also changed nothing on its own.
- **Caught by:** "So what do you intend to do to fix it?" — pushed me to actually run the test
  instead of reasoning about it.
- **Why:** I saw an asymmetry in the code (your attacks always hit one enemy, theirs spread across
  three of your heroes) and assumed it must be the cause, without testing it in isolation first.
- **Tag:** trusted the code's shape over a real test

### [2026-09-20 #1] Called the easy numbers the root cause, not the reason

- **Said:** "Nine of eleven fights can't be lost — that's the root cause."
- **Actually:** That only restated the measurement in different words. It didn't say what about
  the game makes it that way. I hadn't looked at the targeting code yet.
- **Caught by:** "No I mean why they can be lost."
- **Why:** "The numbers are too easy" sounds like an explanation but isn't one — it's the same fact
  said again. I moved to a summary before I'd actually found the cause.
- **Tag:** answered what, not why
