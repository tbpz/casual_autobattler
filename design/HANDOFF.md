# Design canvas — hand-off

**Canvas:** https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny
**Source files:** `design/canvas/*.dc.html`, `design/canvas/canvas.json` — edit these, then republish (see
"Publishing" below). Don't hand-edit `fight-field-layout.html`; it's a build output, regenerated on publish.

## What's on the canvas (2026-09-30 cleanup; frame 7 added 2026-10-01; frame 8 added 2026-10-02; frames 9–12 added 2026-10-09)

Twelve frames, as still pictures: no motion, no interaction. Colours and sizes are copied from the real code
(`prototype/src/style.css`, `render/roundScreen.ts`, `render/fightView.ts`), so a change here is a real proposal.
Units, HP and fatigue values are made up for the picture, not read from a run.

1. **RoundStart** — round screen, round 1, one unit per role, all fresh.
2. **RoundGrown** — round 12: 3 tanks, a fallen Damage 2, a not-picked Healer 2, a slamming enemy the tank's chain answers.
3. **RoundPress** — same round, TANK header held down: the expanded card with one sentence per ability, the encounter line,
   "made stronger" in words, and each unit's own fatigue tier and backfire chance.
4. **MidFill** — fight screen: chain shown as a ring around each player body, role-coloured bodies, fatigue pips beside each body.
5. **FatiguePips** — the chosen fatigue display, all four tiers on both screens, plus a legend of the tier ranges.
6. **OfferAfter** — the reward-pick screen. The layout is built (2026-09-30, `render/offerScreen.ts`, `style.css` `.offer-row`): full-width rows, each with a
   category rail (Chain, Stats, Squad, Recovery, Reaction), a named role pill, the change as a big headline, and a quiet "↳" line linking an
   offer to what the run holds. Every row has the same frame; nothing is gold, so no kind looks like the answer.
   **Redrawn and built 2026-10-02, awaiting Tu's approval:** four rows (Chain, Execute, Hunter's mark, Stats). The "reads / makes" chip lines are gone. A mark word is
   coloured where it sits in the card's own text (exposed pink, frozen blue, burn orange, shield teal, from `style.css` `--mark-*`). The "↳" line stays only
   when the card needs a mark from elsewhere, and it names the source ("From your Damage's expose"). A card that only makes a mark has no "↳" line.
   Built in `render/offerScreen.ts` (`markWordsHtml` in `render/heroPickShared.ts`, `MARK_WORDS` in `sim/cards/index.ts`) and `cardWorksWith` in `sim/offers.ts`.
7. **ShieldBar** — built 2026-10-01 (`render/fightView.ts`, `render/hpBar.ts`, `style.css` `.hp-shield-fill`; `DECISIONS.md` "Shield shows as a segment on the HP bar"), with number placement A. The frame's own label on the published canvas still says "proposal, not built". Nine states of the HP bar with a
   teal shield segment (today's badge, under max, over max with rescale, a hit eating shield, draining while over max, a break flash, a 4-point
   sliver, the Aegis cap, an enemy), plus the number-placement choice. Bars are drawn wider than on a phone.
8. **MarkSlots** — **built 2026-10-02, option A** (`style.css` `.mark-row` / `.guard-pips`; comments in `render/fightView.ts`). The bug: the Exposed / Burn badge
   row and a guarding tank's pip row were in-flow rows that didn't exist until needed, so a mark landing grew the card and shoved the centre line, the
   player row and the callout band. Tu picked A of three (B: reserved rows, +30px of field even at rest; C: a stack beside the body); B and C were removed from
   the frame. The frame shows the bug and A as "nothing held" / "marks landed" pairs with dashed guide lines showing what moved, plus six edge cases.
   How A is built: both are absolute **slot** children (not perch children, so the back-rank dim and hit-pop don't touch them). Badges are centred on the
   body's bottom edge. The guard pips sit in a dark pill at 25% down the body, not centred, so a frozen guarding tank still shows its centred freeze timer.
   Five pips (`GUARD_PIP_CAP`) just fit a 52px tank body. Cost: the badges cover a slice of the chain ring at 6 o'clock and the lower edge of small bodies.
   The frame is generated from a scratch script, so edit the `.dc.html` by hand from here on.

9. **RoundFaceOff** — **proposal, drawn 2026-10-09, not built, awaiting Tu's approval.** Round 1 of the face-off round screen that would replace frames 1–3.
   Why: playtest friends couldn't tell what the screen was. Root cause: the pick screen draws a *menu* (role bands, a small red strip on top) while the fight screen draws a
   *face-off*, so nothing says "two squads, about to fight"; neither side is named; numbers and chips are bare ("605/605", "guard") with the sentence behind a tap that
   nothing says is a tap; the encounter blurb was built but thrown away (`_encounterBlurb` in `roundScreen.ts`); and enemy damage/slam/heal were never shown.
   Frame: a one-line goal sentence (first rounds only), a tinted ENEMY zone (body, `HP 605`, `Hits for 8`, the encounter blurb), a VS line, a tinted YOUR SQUAD zone
   (role icon in each body, `HP / Hits` numbers to compare, a plain one-liner per role), then one tappable row per role holding the special as a sentence first and
   the old name muted after it, with an `i` mark. Mark words are coloured as on the offer cards. No fatigue pips while every unit is fresh. Button reads "Fight!".
   Numbers are real: Anvil at round 1 comes from `roundEnemySide`, units from `ROLE_POOL`.
   **2026-10-09 review round (Tu):** "Hits for" was dropped as a term nobody uses, so every stat reads `HP 605` / `Damage 8` (a unit's damage per regular attack; attack
   speed is deliberately not shown). A slam shows its number: `💥 Slam: charges up, then hits for 24` (2x the regular damage, `windupDamageMultiplier`).
10. **RoundFaceOffGrown** — same proposal at round 12 vs Executioner + 2 Guards: the slam gets its own plain line, units show a number only where a role has two, a worn unit
   shows pips and its tier word, relic/cards row kept, and the Tank's `i` details are open. The bench is **not** drawn here any more: a one-line strip,
   `BENCH 2 units · 1 worn, 1 fallen · Change squad ›`, is the only way to the squad screen (frame 12). The popover no longer repeats the sentences (they sit on the row);
   it holds how the moves fare against this enemy, plain meanings for the coloured words (Exposed, Frozen), "made stronger", and each same-role unit's backfire odds,
   and sits between the Tank row and the strip so it hides nothing important. Player HP/damage and fatigue are made up; enemy numbers and backfire odds are real.
11. **RoundFaceOffFull** — the squad cap: round 17, **5 fielded** (`maxSlots`) of 8 units, vs Warden + 2 Acolytes. Bodies shrink to 38px with name and `HP / Damage` stacked so five fit; the
   special-moves rows stay one per **role** (3 rows, not 5). The Warden heals on its beat instead of attacking, so it gets no `Damage` chip, only `✚ Heals its most hurt ally for 6
   instead of attacking` and its slam (28). Enemy numbers are real (571 HP; Acolyte 150 HP, damage 7); player numbers are made up.
12. **SquadScreen** — the bench on its own screen, two phones: **resting** (FIGHTING 5 of 5, BENCH 3 with a fallen unit dimmed and untappable; rows show HP, fatigue pips and the tier word
   always) and **mid-swap** (a bench unit chosen, the five fielding units dashed-glow, banner "Tap who Tank 3 replaces", Done greyed until the swap is made). Decided with Tu: swapping
   happens here only (the round screen's squad is a read-only preview), and a swap is two taps (bench unit, then who it replaces; any unit for any unit, no role lock).
   The bench rule is stated in one line with real numbers: "Each round, a unit on the bench heals 60% of its HP and loses 20 fatigue. A fighting unit heals 40%"
   (`benchedRecoverFraction`, `fatigueBenchRest`, `autoRecoverFraction`). This also answers old open call 4 (the bench-heals-faster hint). Generated from a scratch script; edit the file by hand from here on.

Round-screen idea, in one paragraph (frames 1–3, the version currently built): units are grouped by role. One band per role holds its icon, one chip per ability
the chain has picked up ("guard", "freeze"), a `+N` badge once the chain has been made stronger (never the word "level"), and a ✓
against the enemy's threat when it matters. Under that, the units are round tokens: HP is the bar under the circle, fatigue is
the pips beside it, and the number is the unit. Tapping a token picks or drops it. The FIGHTING strip replaces a "Pick N to fight"
sentence.

## Fatigue display — chosen and built 2026-09-30

**Tier pips:** 4 pips beside each token (pick screen) and each body (fight screen), lit up to the unit's tier. Colours:
fresh grey `#8a8fa3` (1 pip), worn `#ffcf4d` (2), frayed `#e8913c` (3), breaking `#ff4d4d` (4). Tier ranges come from
`sim/config.ts` `fatigueTierFloors [25, 50, 80]`, so fresh 0–24, worn 25–49, frayed 50–79, breaking 80–100.

Built 2026-09-30, matching the canvas: `render/heroPickShared.ts` (`fatiguePipsHtml`, `FATIGUE_TIER_PIPS`) builds the stack;
`roundScreen.ts` puts it beside each living token; `fightView.ts`'s `makeHeroSlot` puts it beside each player body; `style.css` has
`.fatigue-pips`. `checks/fatigue.ts` pins the lit counts. What that means on screen:
- **The ring.** The pick screen has no ring (charge resets to 0 every fight, so it has nothing to show); the old tier-coloured ring is gone.
  The fight screen keeps the charge ring. The tier word stays under a pick-screen token once a unit is no longer Fresh.
- **Backfire dots.** The old per-role "backfire risk" dots are gone from the code and from the canvas. Backfire chance is per unit now,
  and only appears in RoundPress's expanded card, in the code's own wording ("Tank 2: worn — 9% backfire.").
- **Fresh lights 1 grey pip**, so the stack never reads as empty. Open call: 0 lit pips for fresh is the alternative.
- Pips don't move during a fight. Fatigue changes only between fights (`sim/roster.ts`).

## Open calls for Tu

1. **Icons.** 🛡 ⚔ ✚ 💥 ⚡ are emoji: fast to mock up, but they render differently per phone/OS. Plain drawn shapes cost more.
2. **Full sentences behind a press.** RoundPress reveals the chain's full wording only on a press. Touch has no hover; is that acceptable?
3. **Per-unit damage/speed numbers** were dropped (every unit of a role shares them). Gone for good, or behind the same press?
4. **The bench-heals-faster hint** was dropped with the old "resting" look. `benchedRecoverFraction` still exists in `sim/config.ts`.
   Does the rule need a hint on the round screen?
5. **Shield number placement** (frame 7). A: the HP label gains a teal `⛊40`. B: a small teal tag sits at the bar's right end. Cards 2–9 use A.
6. **Shield rescale side effects** (frame 7, cards 3, 5, 8). The rescale shrinks the blue HP fill while shielded (Aegis: half the bar), and it
   grows back as the shield drains with no HP change. Acceptable, or would an overlay read better?
7. **Coloured mark words on cards** (frame 6, 2026-10-02). Approve the new look, or change it? Open point: a mark introduced by a maker card is now
   introduced only by its coloured word in the description, since the "Makes ✦ exposed" line is gone.

8. **Face-off round screen and squad screen** (frames 9–12). Approve the look? Open points: (a) "Fight!" vs "Play"; (b) the per-unit `Damage` number returns on the round
   screen (it was dropped from the old one, see call 3), is that fine; (c) "Special moves" is a new label for what the code calls a chain ability, and nothing yet says *when*
   a special fires (the ring filling in the fight); (d) role one-liners ("Soaks up hits") and the slam line ("charges up, then hits for 24") are new wording; (e) the squad screen
   is a new screen and a new route, and today a tap just toggles a pick, so the swap rule changes when this is built; (f) a roster with no one on the bench (round 1) hides the strip.
   Settled 2026-10-09: "Hits" wording, attack speed not shown, bench on its own screen, two-tap swap.

## What the canvas does not cover

- No motion: slam timing, chain pulses, freeze ticking, the token-tap swap.
- No runtime sizing. A body's width in the real game comes from its HP as a share of the side's total; the canvas uses fixed widths.
- The four old fight-screen frames (turn 1, mid-chain, freeze, end card) were dropped on 2026-09-30: they showed the old CHAIN bar and the
  named-hero pool (Bracer/Hollow/Rook) that the roles rebuild replaced. If a chain-in-progress or end-card picture is needed again, redraw it
  from the running game. They're still in git history.

## Publishing

The canvas page is a self-contained "appifact". Its editable state — every `.dc.html` source plus `canvas.json` — lives in a
`<script type="application/json" id="appifact-doc">` block inside one HTML file (`{"title", "content": {"files": {...}}, "comments"}`), and
saving republishes the whole page as a new version. The recipe that worked:

1. `Artifact read` the live URL. It saves the full page to a local file and tells you the path. Don't paste the page into the conversation.
2. `JSON.parse` the `appifact-doc` block, add / replace / delete entries in `content.files`, leave everything else alone.
3. Re-encode with `JSON.stringify`, then replace **only `<`** with the six characters `<` (backslash, u, 0, 0, 3, c). Never HTML
   entities, and don't touch `>` or `&`. This is what the page's own `OR()` does, and it's what keeps a source file's `<script>` line from
   closing the outer script tag early. Before trusting it, check that re-encoding the untouched block reproduces it byte for byte.
4. The saved file has a viewer wrapper (`<!doctype html><html><head>…<body>` in front of the real page, `</body></html>` after it). Publish
   the inner page only: slice from the second `<!doctype html>` to before the final `</body></html>`.
5. `Artifact publish` with `url` set to the canvas URL, then read the new version back and confirm the block parses and the files match.

Gotchas from earlier passes (details in MISTAKES.md, 2026-09-23 #2 and #5): plain `JSON.stringify` without the `<` swap breaks the page
(unstyled text, then raw markup as visible text if entity-escaped). Verify against the bundle's real encode function, never against a
decoder written to match this prose. When testing the round trip from a shell one-liner, write the script to a file instead: quoting
mangled the `<` replacement once and made a correct page look broken.

## When Tu changes something on the canvas

Read the change back into the session (re-read the published page, or the `design/canvas/*.dc.html` files after an extract) before
touching the code. Compare the new numbers against `style.css`'s `:root` tokens and `fightView.ts`'s size constants, then apply the diff. Don't
re-derive the whole file from scratch.
