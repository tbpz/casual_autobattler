# Design canvas — hand-off

**Canvas:** https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny
**Current artboards:** Main (turn 1, resting), MidChain (Rook's chain firing on Executioner),
Freeze (Hollow's stun holding Executioner), EndCard (the chain's end card).
**Last published:** 2026-09-24 — Version 10, removing the SAFE/TIGHT verdict and chain-count line
from all three round-screen frames (RoundStart, RoundGrown, RoundPress) and normalizing the Play
button back to the one blue it always is in the real code, since that button's colour used to
track the now-removed verdict (see the revision note under "Round screen" below). Version 9
(2026-09-23) swapped HP and charge on the round-screen tokens: HP is now the bar under the circle,
charge is now the ring around it. Version 7 (same day) shipped this same change with the wrong
script-block escaping and rendered as raw text instead of a mockup; Version 8 reverted to Version 6
to restore a working page before Version 9 redid the change with the correct escaping (see the
gotcha note under
"Publishing this update" and MISTAKES.md 2026-09-23 #5). Version 6 (same day) replaced the "resting"
not-picked look in RoundGrown and RoundPress with the dimmed/hollow-badge look. Version 3 (same day)
added the three round-screen frames (Version 1 was 2026-09-16, the original four fight frames;
Versions 2, 4, 5 don't exist in this repo's history — the canvas's own version count starts from
whenever it was first opened, not from this file).
**Source files:** `design/canvas/*.dc.html`, `design/canvas/canvas.json` — edit these, then re-seed
and republish (see the `design` skill — not present in this repo or `~/.claude` as of this pass; the
2026-09-23 republish was done by hand instead, see "Publishing this update" below). Don't
hand-edit the seeded `fight-field-layout.html`; it's a build output, regenerated from these on every
publish.

## What this covers

Two screens, as still frames — no motion, no interaction, every number and colour copied from the
real code so a size or colour change here is a real proposal, not a sketch.

### Fight screen (frames 1–4: Main, MidChain, Freeze, EndCard)

The screen STATE.md's Next up #1 asks Tu to play-test (chain identity, Bracer's guard, Hollow's
stun). Sizes and colours come from `prototype/src/style.css` and `prototype/src/render/fightView.ts`,
using the token names from the 2026-09-16 token pass (`--track-bg`, `--surface`, `--heal`,
`--freeze`, `--accent-0..5`, `--back-rank-scale`, `--tracer-ms`).

**Stale naming, not yet fixed:** these four frames still show Bracer/Hollow/Rook/Executioner, the
named-hero pool the 2026-09-23 roles/rounds rebuild (DECISIONS.md) replaced with Tank/Damage/Healer
units. The fight view's code and CSS are unaffected by that rebuild (see Open call #1 below for
what a role-based fight screen would mean), so redrawing these four is a separate pass, not part of
this one.

### Round screen (frames 5–7: RoundStart, RoundGrown, RoundPress) — new this pass

Redesigns `render/roundScreen.ts`, the pick-your-squad-and-play screen, in response to Tu's read
that it's too much text to bother reading, repeats the role name on every row (`Tank 1` next to
`tank`), has no plan for a role with several units, and puts a role's chain description far below
the units it belongs to.

**The idea:** group units by role. One band per role — icon, one small chip per ability the chain has
picked up (each chip: an icon plus a one-word verb — "guard", "freeze"), a `+N` badge only once the
chain has been made stronger (never the word "level" — Tu's read, 2026-09-23 session), a small risk
mark, and (only when it matters against this fight) a ✓ against the enemy's threat. Under that, the
role's units as round tokens: a bar under the circle for HP, a ring around the circle for charge, and
a number — nothing else. Tapping a token picks or drops it, same as today. The FIGHTING strip
replaces the "Pick N to fight" sentence.
**2026-09-23 revision:** HP and charge swapped shapes — HP used to be the ring, charge the bar. The
bar now carries HP (matching the fight screen's own HP bar) and the ring carries charge (DECISIONS.md
2026-09-23, "HP moves to the round-screen bar, charge moves to the ring").
**2026-09-23 revision:** the SAFE/TIGHT/ROUGH verdict word and chain-count line below the FIGHTING
strip are gone — Tu didn't want a fight prediction on this screen. The projection code
(`sim/projection.ts`) and the after-fight recap's "(projected Ns to spare)" note are unaffected;
only this screen's read of it was removed.

A role starts with one chip (its base ability). Taking a "gains" offer adds a second chip next to it
— the chain now does both, it never swaps one ability for another. Taking a "stronger" offer doesn't
add a chip; it raises the `+N` badge, since it boosts everything the chain already does rather than
being an ability of its own.

- **RoundStart.dc.html** — round 1: one unit per role, all picked, an encounter with no
  slammer (so no role's chain earns a ✓ against it — shows the neutral case). Every role still has
  just its one starting chip and no `+N` — nothing's been picked up yet.
- **RoundGrown.dc.html** — round 12: 5 fight slots, 3 tanks (one hurt, one critical), a fallen
  Damage 2 sitting greyed in its row instead of a separate "Fallen:" line, a not-picked Healer 2
  (same body, HP bar, and charge ring as a fielded unit, dimmed, with a hollow badge where the ✓
  would sit), a slamming enemy the tank's chain answers. This is the frame that answers "what
  happens with more instances of a role." Also shows the two chip states: TANK has two chips
  (guard, freeze) plus `+1`; HEALER still has one chip but `+2`.
  **2026-09-23 revision:** the not-picked look used to be a "resting" treatment (dashed ring, "z"
  badge, "+HP" instead of a charge sliver) — Tu found that confusing, since a hero can be unpicked
  from round 1 on, before anyone has rested. Replaced with the dimmed/hollow-badge look above,
  which reads as "not picked" at any point, not just after a round. The old look was standing in
  for `benchedRecoverFraction` (`sim/config.ts`) — a benched hero heals faster than a fielded one.
  That's now dropped from the screen entirely; whether it needs a hint somewhere is an open call
  below (#5).
- **RoundPress.dc.html** — same round as RoundGrown, with the TANK band held down: an expanded card
  drops in below the header showing the full sentences (`chainEffectLines`'s `does`, one line per
  ability the chain has, `chainVsEncounterLine`'s per-encounter line, how many times it's been made
  stronger in words, the backfire risk in words) that the header only hints at otherwise. Nothing on
  the card is new text — it's the same words the screen shows today, just one tap away instead of
  always on screen.

Numbers on all three: role stat blocks from `sim/roles.ts`'s `ROLE_POOL` (Tank 190 HP, Damage 80 HP,
Healer 100 HP), backfire pip counts approximated from `heroPickShared.ts`'s `backfireRiskPips`
(chainAffinity spread 0.8–1.3), the HP bar's severity thresholds at 75%/40% same as today's
`hpSeverity`, the charge ring's "near threshold" cutoff at 75% same as `chargeBarHtml`'s existing
rule. The enemy squad, HP totals, and exact charge percentages are made up for the picture, not read
from a real run.

## What it does not cover

- **No motion.** Slam timing, chain pulses, how fast a freeze ticks, the token-tap swap animation —
  these are frozen moments, not an animated preview. Timing stays a conversation in words.
- **No runtime sizing.** A body's width, in the real game, is worked out live from its HP as a
  share of the side's total; the canvas uses fixed widths that look right for the one roster shown.
  Applying a canvas change to the code still means re-deriving that rule by hand.
- Fight-screen squad: Bracer + Hollow + Rook vs. Executioner + 2 Guards (see the stale-naming note
  above). Round-screen squads: role units per `sim/roles.ts`, not any specific played run.

## Open calls for Tu (from the design plan, unresolved — see the plan file this session wrote)

1. **Role colour vs. per-unit colour.** The fight screen colours each body by its *position*
   (`fightView.ts`'s `accentFor`); the round-screen frames colour each token by its *role* (gold =
   tank, purple = damage, green = healer), since the chain is now shared by role. Frames 1–4 and
   5–7 disagree on what a colour means until one side changes. Keep the round screen's role colours
   and leave the fight screen alone, or bring the fight screen's colouring over to match?
2. **Icons.** 🛡 ⚔ ✚ 💥 ⚡ are emoji — fast to mock up, but they render differently per phone/OS.
   Plain drawn shapes (a shield outline, a sword) would look identical everywhere but cost more to
   build. Emoji to start, swap later if it matters?
3. **Full sentences behind a press.** RoundPress shows the chain's full wording only appears once
   the header is held down. Touch has no hover, so a press is the only way to reveal it without
   putting it back on screen by default — is that an acceptable trade, or does the sentence need to
   stay visible somewhere?
4. **Per-unit damage/speed numbers** (`7dmg / 1.3s`) are dropped entirely in this design, since every
   unit of a role shares them — they don't help choose between Tank 1 and Tank 2. Gone for good, or
   kept behind the same press as the chain sentence?
5. **The bench-heals-faster hint.** Dropped with the "resting" look (2026-09-23 revision above) —
   a not-picked hero now looks the same whether the round has just started or a hero has been on
   the bench for a while. Does the faster-heal rule still need a hint on this screen, or was it
   fine to drop since it's a minor upside, not something a pick decision hinges on?

## Publishing this update

The canvas page (`fight-field-layout.html`) is a self-contained "appifact": its own editable state
— every `.dc.html` source plus `canvas.json` — lives inside a `<script id="appifact-doc">` block in
that one file (`{"title", "content": {"files": {...}}}`, one entry per source file), and saving
republishes the whole page as a new version. The `design` skill that's meant to do this (re-seed,
then publish) isn't present in this repo or `~/.claude`, so the 2026-09-23 republish was done by
parsing that JSON block out of the live page, adding the three new `.dc.html` entries and the
updated `canvas.json` to its `files` map, and republishing the whole file back to the same URL —
without touching anything else in the page (the editor code, the other four frames, `comments`).
Same recipe next time the skill still isn't findable.

**Gotcha found doing this by script (2026-09-23), corrected (2026-09-23):** the first version of
this note said all three of `<`, `>`, `&` get HTML-entity-escaped inside that JSON block. That's
wrong and, followed literally, breaks the page (Version 7 shipped raw markup as visible text instead
of a render — see MISTAKES.md 2026-09-23 #5). The real scheme, read from the page's own bundle code
(search the file for `HI="appifact-doc"` to find `OR`/`UI`): only `<` is touched, and it's replaced
with the JSON string escape `<` (six characters: backslash, u, 0, 0, 3, c) — never the HTML
entity `&lt;`. `>` and `&` are left alone entirely. Reading the block back is a plain `JSON.parse` of
the script tag's raw text with no decoding step at all. That one substitution is still what stops a
source file's own `<script src="./support.js"></script>` line from closing the outer `<script
id="appifact-doc">` tag early — every `<` in the text (including the ones starting `</script>`) is
gone after the replace, so the literal byte sequence `</script` can no longer occur. Plain
`JSON.stringify` doesn't do this substitution — re-running it over the parsed object and writing
that straight back out will corrupt the page. Before trusting any such recipe again: verify against
the actual encode/decode functions in the bundle, not against a decode function written to match
this file's prose.

## When Tu changes something on the canvas

Read this file back into the session (`design/canvas/*.dc.html` after a re-`--extract`, or ask me
to read the published page) before touching the code — I compare the new numbers against
`style.css`'s `:root` tokens and `fightView.ts`'s size constants, then apply the diff. I don't
re-derive the whole file from scratch.
