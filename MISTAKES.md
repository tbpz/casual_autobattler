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

### [2026-10-28 #2] Sorted bets from tuning by what a "no" would cause; Tu reversed all four calls

- **Said:** A line is a bet if a "no" would make us drop or redirect something. On that test I
  called "comes back right after" and "run 20 shows something new" bets, and "a new player wins
  about 1 in 4" and "a run fits a short sitting" tuning, since each is a number.
- **Actually:** A "no" on a goal every good game must hit changes how we reach it, never the goal.
  And a number can hide a stance a good game could take the other way: let new players lose, or
  build for a long evening. Tu's test: a bet is a choice a good game could make the other way.
- **Caught by:** Tu, who answered the opposite on all four and asked for my reasoning.
- **Why:** I judged by the consequence of a fail, and read the number instead of the choice behind it.
- **Tag:** judged a line by its consequence instead of by whether a good game could choose otherwise

### [2026-10-28 #1] Sorted the whole unverified bets list after reading only 6 of its 11 lines

- **Said:** I gave a bet-or-tuning table for "the current unverified list" and a work order from
  it. Tu agreed to it.
- **Actually:** BETS.html has 11 unverified lines; the tag-stripped dump I read was cut at 120
  lines, so the table missed the last five, including four that needed sorting.
- **Caught by:** Myself, when reading the full file to make the edit.
- **Why:** I treated a truncated read as the whole file and did not count the folds.
- **Tag:** claimed a whole list from a truncated read

### [2026-10-23 #3] Proposed moving the archive line at each pivot, but replaced entries are scattered through the log

- **Said:** When Tu asked about DECISIONS.md length, I suggested putting a new archive line in place
  when something big is dropped (like the merge heroes), so the replaced era sits below it.
- **Actually:** An archive line only marks off entries that sit together at the bottom of the file.
  The merge-hero entries are spread across 2026-10-19 to 2026-10-23, mixed in with live ones, and
  moving them would break the append-only rule and the BETS.md links.
- **Caught by:** Myself, while working out the edit to apply it.
- **Why:** I thought of a pivot as a point in time, but entries are replaced one at a time, not in
  one block.
- **Tag:** proposed a fix without checking it against how the file is actually laid out

### [2026-10-23 #2] Recommended the Life Mage feeding other mages' orbs, but chains already fill them fast

- **Said:** After Tu rejected the lifeline idea, I put "Orb feeder" first as the recommended Life
  Mage job: when nobody needs healing, its orb flies to the Storm or Frost Mage, and its merge fills
  every other mage's orbs.
- **Actually:** Mages already skill 2.3 to 2.9 times a fight and merge 1.2 to 1.5 times (my own
  100-run measurement), so the other mages' orbs fill quickly without help. A gift orb changes
  nothing a player sees.
- **Caught by:** Tu rejected it: "The chain already happen so fast that adding an orb to the allies
  seems no impact."
- **Why:** I tested the idea against "is the Life Mage ever idle?" but not against how fast the
  other mages fill their orbs, a number I already had on screen.
- **Tag:** proposed a mechanic without checking it against numbers I already had

### [2026-10-23 #1] Recommended the Life Mage's lifeline and Rebirth, which pay off only in a fight about to be lost

- **Said:** In the Mages plan I proposed the Life Mage saves an ally who would fall (Lifeline) and
  brings back a fallen unit (Rebirth), and marked it as the recommended option.
- **Actually:** Both only matter when someone is about to die. In every other fight the Life Mage
  would do nothing a player notices, which is the same fault as the Healer-lookalike Tu started with.
- **Caught by:** Tu rejected it: "Your recommendation makes the life mage only worth in a fight that
  risky dying one. The rest of that it is useless."
- **Why:** I designed for the moment that looks dramatic and never asked what the unit does in an
  ordinary fight, which is most of them.
- **Tag:** proposed a mechanic without checking it pays off in every fight

---

### [2026-10-21 #1] Proposed Beasts "bleed" as a new mechanic, but it is Exposed or Burn renamed

- **Said:** In the plan for armies that fight differently, I wrote that Beasts' bite adds bleed to the
  enemy and the enemy "melts", and called it Slay the Spire's poison deck.
- **Actually:** The game already has Burn (a mark that damages over time) and Exposed (a mark that
  makes the enemy take more). Bleed was one of them with a new name, so it changed nothing a player
  sees. The same fault Tu had just named in the first two armies.
- **Caught by:** Tu rejected the plan: "Beast design is just like exposes with a different name."
- **Why:** I checked the idea against the fight's lines and numbers but not against the marks the
  game already has, so a renamed mark passed as a new mechanic.
- **Tag:** presented a renamed existing thing as new

---

### [2026-10-17 #2] Said the other first picks complete "about 35%" of runs, but they average 26%

- **Said:** In the balance discussion, the plan, and the new DECISIONS.md entry I wrote that runs
  with Wanderer complete 73% against about 35% for the other first picks.
- **Actually:** The batch (n=3000, `--offers build`) gives the other five 647 completed in 2492 runs,
  26%. They are far apart: Augur 37%, Rime 31%, Frenzy 23%, Citadel 23%, Pyre 15%. The 35% was
  roughly the overall rate, Wanderer's runs included.
- **Caught by:** me, reading the `relics` line of the baseline batch before changing anything.
- **Why:** I copied the figure from the earlier 2026-10-17 DECISIONS entry and never worked it out
  from the per-pick counts the batch prints.
- **Tag:** eyeballed a number I could have computed

---

### [2026-10-17 #1] Said about 10 playtest runs would show how a human compares with the bot

- **Said:** In the balance discussion I wrote that the playtest friend should play about 10 runs,
  export each one, and compare their win rate with the bot's.
- **Actually:** 10 runs is far too few for a win rate: 1 win and 4 wins both fit "1 in 4". Round
  reached per run carries more information than win or lose.
- **Caught by:** me, while writing the plan to log the 1-in-4 target.
- **Why:** I reached for the same "play a few runs and compare" step I use for other checks without
  working out how many runs a win rate needs.
- **Tag:** eyeballed a number I could have computed

---

### [2026-10-16 #4] Read "a skill silently disappears" as Claude's own skills, not the game's skill bubble

- **Said:** After scanning session logs I wrote a plan saying no skill ever ended silently, and that
  Tu was probably seeing two Claude skills run back to back with no words between them.
- **Actually:** Tu meant the in-game skill (the chain): its bubble vanishes with no STOPPED and no
  result bubble. The project's own words for it are "skill" and "bubble", and `STATE.md` says so.
- **Caught by:** Tu rejected the plan: "I mean the skill which is a chain in the game. Not claude skill".
- **Why:** I searched for the word "skill" in tooling first and never checked it against this
  project's own meaning of the word.
- **Tag:** misread a project word

---

### [2026-10-16 #3] Published canvas frames 6.3A, 6.3C and 6.3D with the upgrade shelf's cells squashed to 0–2px

- **Said:** After publishing version 96 I reported 6.3A–D as "published, read back, all five frames
  are on it", and said the frames rendered correctly.
- **Actually:** In the live canvas 6.3A and 6.3D (the one Tu picked) drew every named emblem on top
  of the next: `cell(u, w, fs)` took a width, but the frames called `HELD.map(cell)`, which passes the
  array index as `w`, so each cell was 0 to 8px wide. The read-back I did only checked that the
  files and artboards were in the page, not how they looked.
- **Caught by:** Tu: "your screen looks a bit broken when multiple icons overlap on each other".
  I then opened the live canvas in Chrome and found the collapsed shelf.
- **Why:** I changed a helper's signature after the screenshots, re-rendered only B and C, and
  never looked at A and D again before publishing.
- **Tag:** published without looking at the final render

### [2026-10-16 #2] Drew the slam option frame with the built number at 1.1×, but the build draws it at 1.3 to 2.0×

- **Said:** On canvas frame 5.8 (the slam options, published as version 79) the captions and
  HANDOFF said the slam number is "−15 at 1.1×" today and option E makes it "1.6×".
- **Actually:** `.damage-popup.windup` says `font-size: 1.1em`, but `showPopup` overrides it inline
  with `(1 + frac)em`, where `frac` is damage over the victim's max HP, floored at 0.3. The built
  number is 1.3 to 2.0×, so a "1.6×" option would have shrunk the biggest hits.
- **Caught by:** me, reading `showPopup` while planning the build Tu had approved. Asked Tu how
  to size the number (he chose +45% over the built size, capped at 2.6×), built it, and removed 5.8.
- **Why:** I took the size from the CSS rule and never read where the popup's font size is set.
- **Tag:** described a picture before checking the numbers

### [2026-10-16 #1] Said a Revive brings back "the unit that fell last", but it names the last fallen in roster order

- **Said:** In the plan Tu approved for the fallen-hero popup I wrote "Revive picks the unit that
  fell **last** (`fallen[fallen.length - 1]`)" and planned a card line saying so.
- **Actually:** `roster.heroes` is never reordered when a unit dies, so `fallen[fallen.length - 1]`
  is the last fallen unit in roster order, not the last to die. With two down, the player has no
  way to predict which one the offer names.
- **Caught by:** me, rereading `sim/offers.ts` and `sim/roster.ts` before writing the card text.
  Drew the card with the true rule ("names one fallen fighter at a time; you do not pick which"),
  and `design/HANDOFF.md` 2.6 states it and lists it as open point (c).
- **Why:** I read the index expression as "the most recent" and wrote the plan line from that
  reading without checking how the array is ordered.
- **Tag:** described a picture before checking the numbers

### [2026-10-15 #3] Said the slam on the fight frame lands for −30, but frame 1.3's slam is 15

- **Said:** In the plan Tu approved for the fight frames I wrote "TAKES THE SLAM, −30 (Vanguard
  damage × 2, read from the 1.3 file)".
- **Actually:** Frame 1.3's own header says Vanguard damage 7 and slam 2x = 15. I had not opened it
  when I wrote the number; "read from the 1.3 file" was not true when I wrote it.
- **Caught by:** me, reading the 1.3 header while building the frame. Drew −15, told Tu in the
  reply, and the frame's note and `design/HANDOFF.md` state it.
- **Why:** I wrote the plan from memory of the round-screen numbers and attached a source I had not
  checked.
- **Tag:** described a picture before checking the numbers

### [2026-10-15 #2] Said the 8-chip row would show the first hero half-cut, but the overflow is smaller than one chip

- **Said:** In the plan and the question to Tu I described the scrolled 8-chip row as "the first hero
  half-cut under a left fade, the Acolyte fully visible".
- **Actually:** Only about 29px overflows, less than one 37px chip. With the Acolyte fully shown,
  Bram's circle is fully out of view and Ivy is the faded chip.
- **Caught by:** me, reading the headless screenshot before publishing. Told Tu in the reply; the
  frame's note and `design/HANDOFF.md` state it.
- **Why:** I planned the picture from the idea of a cut chip and did not do the width arithmetic
  until after Tu had chosen.
- **Tag:** described a picture before checking the numbers

### [2026-10-15 #1] Said Guard's chain gets stronger with each hit, but its charge is flat

- **Said:** In the first popup rewrite (canvas version 62) Bram's Chain line read "Each hit is
  stronger", the wording I had written for the damage skill.
- **Actually:** Guard adds a flat charge per repeat. Only the size of a damage, heal or shield
  effect escalates per hit (`prototype/src/sim/fight.ts`, the comment "A flat charge per rung").
- **Caught by:** me, reading `fight.ts` when Tu asked for wording that fits each fighter. Fixed in
  version 63 ("Each repeat covers one more slam").
- **Why:** I carried one skill's wording over to all three roles without checking the Tank's
  mechanism first.
- **Tag:** generalised one case to the others without checking

### [2026-10-14 #1] Said a frozen frame of the fatigue options shows the pose, but the steam was animation-only

- **Said:** On frame 7.1 (canvas version 55) I wrote "the pictures loop; a still frame shows the
  pose", and told Tu I had checked it in stills.
- **Actually:** Tu saw no steam and no animation. The steam and the sweat drops had a base
  `opacity:0` and appeared only inside the animation. The canvas editor turns every CSS animation
  off while editing (`animation:none!important` for any tool except Interact), so in that view only
  the squash or the eyes were visible. Only 10 of the 23 artboards are live at once, so far-away
  frames are frozen too.
- **Caught by:** Tu asking why he saw no steam or animation.
- **Why:** I froze the frame at a phase (paused with a negative delay), which still shows steam,
  instead of with `animation:none`, which is what the editor does. I did not read how the canvas
  runs a design's animation before building a frame that depends on it.
- **Tag:** verified a different condition from the one the reader sees

### [2026-10-11 #2] Said the canvas was updated when it was only edited locally

- **Said:** After moving the "Tap any fighter" hint, I listed the changed files and offered to
  check them in a browser next. Tu had asked me to "update the canvas".
- **Actually:** Only the local `design/canvas/*.dc.html` files and `HANDOFF.md` had changed. The
  canvas link, the only place Tu looks, still showed the old screen until Tu asked "have you
  published it?" and I then published (version 39). Tu said this was the second time that day.
- **Caught by:** Tu asking whether it was published.
- **Why:** My plan listed only file edits and a browser check, with no publish step. I never opened
  the "Publishing" section of `design/HANDOFF.md`, whose line 4 says to republish after editing. I
  treated "update the canvas" as "edit the source files".
- **Tag:** treated local edit as done without doing the step the reader depends on

### [2026-10-11 #1] Said a backfire lands on the front unit

- **Said:** The approved plan for the Backfire term card: the hits "land on Bram instead (the front
  unit)".
- **Actually:** A backfire picks its target from your own side with `pickWeightedTargetId` in
  `sim/fight.ts`, the same weighted pick an enemy attack uses, which favours a holding Tank. So Bram
  is the likely target, not a fixed one. The word "front" came from a `config.ts` comment that
  calls this the "front" rule.
- **Caught by:** Myself, checking the card's claims against `sim/fight.ts` before publishing.
- **Why:** I took the rule's name in a comment as a description of what it does, without reading
  the function.
- **Tag:** described code behaviour without checking the shipped setting

### [2026-10-02 #3] Said a forced Rest offer catches a squad that is never benched

- **Said:** After the keep-last-squad change: "the forced Rest offer still steps in once they're
  worn enough."
- **Actually:** `restForceAnyAt` ships at 0, so Rest is forced only when the freshest units the
  roster could field are all past the sweet spot. A rested hero on the bench means no forced Rest.
- **Caught by:** Myself, reading `config.ts` and the 2026-10-02 fatigue entry before logging the
  decision.
- **Why:** I read the `wornEnough` code in `sim/offers.ts` without checking which branch the shipped
  config takes.
- **Tag:** described code behaviour without checking the shipped setting

### [2026-10-02 #2] Wrote a fix plan for the off-centre chain text before checking it happens

- **Said:** The first plan for "chain text starts off to the left on mobile" named two causes: the
  box gets squeezed to half the arena width, and the browser measures the sideways shift too early.
  It then listed a CSS change to fix them.
- **Actually:** Neither happens. In Chrome at 390px wide and in a WebKit (Safari engine) test
  browser at iPhone size, the title stays within 3px of the middle on every frame, and the 3px is the
  screen shake. The box is not squeezed, and the new text is set before the pop-in starts.
- **Caught by:** Tu rejected the plan: "Check first to confirm."
- **Why:** I read the CSS, found two ways a centred box can go wrong, and wrote them up as the cause
  without running the page to see whether either one actually happens.
- **Tag:** named a cause from reading code, without reproducing the bug

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
