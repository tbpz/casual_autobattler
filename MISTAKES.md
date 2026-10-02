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

### [2026-10-02 #1] Quoted a chain count from memory instead of the count I had just run

- **Said:** In the Frozen-playtest analysis (and its plan file): "Of 12 chains, 9 ended at 0–1 hits."
- **Actually:** 10 of 12 did. The chain lengths in the round-3 fight are 1,4,1,0,1,0,0,0,4,0,0,0.
- **Caught by:** Myself, recounting the lengths from the export before acting on the plan.
- **Why:** I had the full list on screen and wrote a tally by eye instead of running a count.
- **Tag:** eyeballed a number I could have computed

### [2026-10-01 #1] Logged a decision bullet Tu never confirmed, and broke the entry format

- **Said:** Appended the relic-timing entry to `DECISIONS.md` as the confirmed decision, including
  the bullet "The Collection button stays off the first screen of a run."
- **Actually:** Tu confirmed three things: the pick moves to after the first win, it applies to
  every run, and the draw stays random. The Collection line was my own addition, and it contradicted
  the entry's own open question about when the Collection button first appears. I also added a
  "Still open" section, which is not one of the format's Decision / Why / Replaces fields.
- **Caught by:** Myself, on a word-count pass over the entry before ending the turn. I then asked
  Tu, who approved the fix.
- **Why:** I filled the Decision list with what seemed a sensible consequence instead of limiting it
  to what Tu had said yes to. The skill says an entry records a confirmed decision, not extras.
- **Tag:** wrote down my own inference as the user's decision

### [2026-09-23 #5] Republished the canvas with the wrong escaping scheme, breaking rendering, then claimed it was verified

- **Said:** "Canvas republished — Version 7, verified byte-for-byte that only those three frames
  changed and everything else... came through untouched," presented as a completed, checked task.
- **Actually:** I built the republish JSON by HTML-entity-escaping `<`, `>`, and `&` (matching
  `design/HANDOFF.md`'s own "Publishing this update" note), then verified the round-trip using a
  decode function I wrote myself. That verification only proved my encode and my decode were
  inverses of each other — it never checked them against the real page. The actual app bundle
  (`OR`/`UI` functions in the published page's own JS) only escapes literal `<` as the JSON escape
  `<`, and decodes by calling `JSON.parse` directly on the script tag's raw text with no entity
  decoding at all. My entity-escaped `<div>` text survived as literal `&lt;div&gt;` after their real
  `JSON.parse`, so the canvas rendered raw markup as text instead of the visual mockup.
- **Caught by:** "Canvas show all the HTML code instead of visual. Check and fix it" — Tu saw the
  broken render; I hadn't opened the page myself before calling it verified.
- **Why:** I verified against a decode function I invented to match HANDOFF.md's prose description
  of the gotcha, never against the actual bundle code that performs the real decode. A round-trip
  test using my own inverse function can never catch this class of bug — it needs the other side's
  real code, which was sitting in the same file I already had open.
- **Tag:** verified a round-trip against my own assumption instead of the other side's real code

### [2026-09-23 #4] Claimed the round-screen mockup had no picked marker, then framed a false choice about the not-picked one

- **Said:** Two wrong claims in a row on the same canvas comment thread. First: "the layout doesn't
  seem to include any visible 'picked' state for heroes." Then, after correcting that, I asked Tu to
  choose between "give the not-picked hero its own look" or "reuse the resting look" — as if those
  were two different game states.
- **Actually:** The mockup already marks a picked hero with a checkmark badge; I hadn't opened
  RoundGrown.dc.html/RoundPress.dc.html yet when I said otherwise. And in the game there's no
  separate "resting" state at all — any living hero you don't field just sits on the bench and heals
  a bit faster (`sim/roster.ts`, `benchedRecoverFraction` in `sim/config.ts`). "Not picked" and
  "resting" are the same hero, so there was nothing to choose between.
- **Caught by:** "Then what about the first round where no heroes has been picked so no heroes are
  resting yet? I think we need simple not-pick stated. Resting state makes confusion" — Tu noticed
  the resting look can't be right if a hero can be unpicked before any round has been played.
- **Why:** Both times I answered from the mockup's surface reading (a badge I hadn't looked closely
  at, a label that said "resting") instead of checking what the label actually maps to in the sim
  code before writing a reply.
- **Tag:** answered from the mockup's wording instead of the game logic it stands for

### [2026-09-23 #3] Called the round-screen pips "chain level" without checking that against how Tu thinks about chains

- **Said:** Answering "what does the yellow circle mean," I called it the chain's "level," and said
  one filled dot of two meant "level 1 of 2."
- **Actually:** There's no "chain level" in how Tu thinks about this — a chain gets upgraded and
  picks up abilities, full stop. And the number itself was wrong too: `chainLevelCap` in
  `sim/config.ts` is 5, not 2 — I read the two dots in the one mockup frame I opened
  (`RoundStart.dc.html`, round 1, nothing upgraded yet) and reported that as the whole scale instead
  of checking the cap.
- **Caught by:** "I don't think we have the term chain level. The chain is upgraded and accumulate
  these ability that's all."
- **Why:** I answered from what one file's `HANDOFF.md` line said ("its level as pips") instead of
  checking the term itself against Tu's own vocabulary, and read one frame's fixed dot count as data
  instead of checking the config it was meant to represent.
- **Tag:** used a name I coined without checking it against Tu's own words

### [2026-09-23 #2] Republished the design canvas without its angle-bracket escaping, broke the page

- **Said:** Told Tu the round-screen frames were published and open-able (Version 3 of the
  `fight-field-layout.html` canvas).
- **Actually:** The page came back as literal `\n` text and bare words, completely unstyled — the
  canvas's own data (every `.dc.html` frame plus `canvas.json`) lives as JSON inside a `<script>`
  tag, and the original page escaped every `<` as `<` so an embedded `</script>` (every frame
  has its own `<script src="./support.js">` tag) could never be read as a real closing tag. My merge
  used plain `JSON.stringify`, which doesn't do that escaping — the first real `</script>` it hit
  (inside Main.dc.html, an untouched original frame) closed the whole data block early and the
  browser rendered everything after it as raw text.
- **Caught by:** Tu opened the link and sent a screenshot: "No screen at all. All weird \n
  character."
- **Why:** I noticed the page was a self-contained "appifact" with its state embedded in a script
  tag, wrote a merge script for it, and published without first re-parsing my own output to check
  it actually round-tripped through JSON correctly — the escaping convention was inspectable in the
  page I'd already read, I just didn't check for it before writing the serializer.
- **Tag:** published without verifying the write round-tripped

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
