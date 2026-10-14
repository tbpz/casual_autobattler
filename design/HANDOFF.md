# Design canvas — hand-off

**Canvas:** https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny
**Source files:** `design/canvas/*.dc.html`, `design/canvas/canvas.json` — edit these, then republish (see
"Publishing" below). Don't hand-edit `fight-field-layout.html`; it's a build output, regenerated on publish.

## What's on the canvas (reorganised 2026-10-11)

Twenty-two frames in six rows, numbered `section.item` in the order a player meets them. Still pictures, except the term cards (3.1–3.8), which loop CSS animations (3.9 became a still row on 2026-10-15). No interaction. Every body wears the face style: see "Face style" below.
Colours and sizes are copied from the real code (`prototype/src/style.css`, `render/roundScreen.ts`, `render/fightView.ts`), so a change here is a real proposal.
Units, HP and fatigue values are made up for the picture, not read from a run.

**Old numbers.** `DECISIONS.md` is never edited, so it still uses the numbers the frames had when they were drawn. Old to new:

| Old | New | Frame |
|---|---|---|
| 9 | 1.1 | RoundFaceOff |
| 9e | dropped 2026-10-14 | RoundFaceOffBench (see "Dropped frames" below; the shelf spec lives under "Bench shelf") |
| 1.3, 1.4, 1.5, 1.6 (2026-10-13 and 2026-10-14 entries in `DECISIONS.md` use these) | 1.2, 1.3, 1.4, 1.5 | RoundFaceOffPack, Vanguard, Warden, Fallen |
| 9a, 9b, 9c, 9d | 2.1, 2.2, 2.3, 2.4 | FighterPopup Bram, Sol, Anvil, Term |
| 13–21 | 3.1–3.9 | Term cards: Slam, Guard, Exposed, Frozen, Burn, Shield, Chain, Backfire, Fatigue |
| 12 | 4.1 | SquadScreen |
| 4 | 5.1 | MidFill |
| 7 | 5.2 | ShieldBar |
| 6 | 6.1 | OfferAfter |
| 7.1, 7.2 (2026-10-14 only) | dropped 2026-10-15 | FatigueOptions and FightFaces: what they showed now lives on the round and fight screens and in "Face style" |
| 1, 2, 3, 5, 8, 10, 11 | dropped 2026-10-11 | see "Dropped frames" below |

### 1 · Round screen — before every fight

**1.1 RoundFaceOff** — **proposal, drawn 2026-10-09, not built, awaiting Tu's approval.** Round 1 of the face-off round screen. It replaces the role-band round screen the game has today (old frames 1–3, dropped).
   Why: playtest friends couldn't tell what the screen was. Root cause: the pick screen draws a *menu* (role bands, a small red strip on top) while the fight screen draws a
   *face-off*, so nothing says "two squads, about to fight"; neither side is named; numbers and chips are bare ("605/605", "guard") with the sentence behind a tap that
   nothing says is a tap; the encounter blurb was built but thrown away (`_encounterBlurb` in `roundScreen.ts`); and enemy damage/slam/heal were never shown.
   Frame: a one-line goal sentence (first rounds only), a tinted ENEMY zone (body, `HP 605`, `Damage 8`, the encounter blurb), a VS line, a tinted YOUR SQUAD zone
   (**redrawn 2026-10-10:** named fighters, made-up names Bram / Ivy / Sol, with the role as a small coloured tag; plain role-coloured bodies with ground shadows in two
   ranks as the fight screen draws them, Tank in front and the other two behind to each side; `HP / Damage` numbers; no role one-liners, no "3 fighters" count). Every squad member has open, alert eyes while fresh (fatigue shows in the lids; see "Face style"). Button reads "Fight!".
   Numbers are real: Anvil at round 1 comes from `roundEnemySide`, units from `ROLE_POOL`.
   **2026-10-11 term pass:** every game term the round really shows is bold and coloured: slam (twice), exposes (twice), Guard, shield. Mark words keep their mark colours; slam, Guard and Chain share the term colour `#c5e86c`.
   The first-round hint line ("Tap a word with ⓘ to see what it does") was tried and removed the same day (Tu). Expose and Mend stay muted and unmarked (not on the term list). Styles are the `.term` / `.term.tap` classes in the frame's helmet.
   **2026-10-11 fighter-popup pass (Tu):** the CHAINS rows are gone (too much for a new player); one muted line under the goal line, above both the enemy and your squad, reads "Tap any fighter to see what it does" (it first sat inside the squad box, which read as "your fighters only", but the enemy is tappable too).
   Tapping a fighter, or the enemy, opens a popup: frames 2.1–2.4.
   **2026-10-11 marker change (Tu):** the circled `i` after a tappable term was too busy. Tappable terms now carry a dotted underline in their own colour
   (`.term.tap` on frames 1.1, 2.1–2.4 and 3.1–3.9), chosen over a tinted tag label in a side-by-side. Terms without `.tap` (for example inside their own
   term card) stay coloured and bold, with no underline.
   **2026-10-09 review round (Tu):** "Hits for" was dropped as a term nobody uses, so every stat reads `HP 605` / `Damage 8` (a unit's damage per regular attack; attack
   speed is deliberately not shown). A slam shows its number: `💥 Slam: charges up, then hits for 24` (2x the regular damage, `windupDamageMultiplier`).

**1.2–1.4 Enemy lineups** — **proposal, drawn 2026-10-13 and revised the same day, renumbered from 1.3–1.5 on 2026-10-14, not built, awaiting Tu's approval.** Frame 1.1 shows only round 1 (one enemy), so these three show the screen at the hardest lineups
   (Tu: "variance screens, the most complicated lineups"). Files `RoundFaceOffPack / Vanguard / Warden.dc.html`, copies of 1.1's shell with the goal line left off (first rounds only). They also carry the bench shelf (see "Bench shelf" below), which is why the old bench frame was dropped.
   **Revision (Tu):** tapping a fighter or enemy already opens its popup (2.1–2.4), so the round screen does not explain. Each enemy body shows its name, HP bar and two numbers under it, as icons on one line (a heart for HP, a sword for Damage; see "Stat icons" below)
   (kept so the two sides can be compared at a glance; the Warden's second number is a green plus and 6, Heal, as the Healer's is on 2.2). A **badge** on the body's top-right edge says "this one has something special": 💥 = it slams, ✚ (green) = it heals. No badge, nothing special. Two badges stack **vertically** (Tu, 2026-10-13): side by side, the right one drifted toward Acolyte 2 and the slam read as the Acolyte's.
   The sentences ("charges up, then hits your weakest unit for 15", "heals its most hurt ally") and the per-kind rows are gone from the round screen; the popup holds them. The encounter blurb stays as the one sentence. Numbers are real: `ENCOUNTERS` × `roundEnemySide` at that round.
   - **1.2 Pack, round 15:** the most bodies (5 Skirmishers, no badges). Your side is mid-run: 4 fielded, 2 benched.
   - **1.3 Vanguard, round 14:** a mini-boss (new `MINI-BOSS` tag) plus 3 Outriders; a 💥 badge marks the Vanguard. Your side is the same mid-run squad.
   - **1.4 Warden, round 17:** the Warden carries two badges, ✚ and 💥, plus Acolytes ×2. Your side is the squad cap (5 fielded, 3 benched), the tallest the screen gets (about 700px).
   Open points: (a) does a new player notice the badges and tap for the popup (the hint line says to tap, but nothing says what a badge means until they do); (b) the badges are emoji and render differently per phone (call 1), and 20px is small on a phone; (c) the badge sits on the body's edge and can touch a neighbour in a tight row (the Outriders' stat lines were too close on 1.3, fixed 2026-10-13 by giving small bodies a 56px column); (d) closed 2026-10-13: Anvil on 1.1 now uses the same icon line as the others; (e) The Reckoning (boss, round 20) is not drawn: it adds nothing the Vanguard doesn't; (f) the popup for an enemy with a slam or a heal is not drawn yet (2.3 shows Anvil, which has neither).

**1.5 RoundFaceOffFallen** — **proposal, drawn 2026-10-14 as 1.6, not built, awaiting Tu's approval.** The round after a fielded unit dies (Tu: the canvas had no such screen). File `RoundFaceOffFallen.dc.html`, two phones. Tu's rulings:
   the dead unit's slot stays **empty** with a placeholder (a dashed squad-blue ring, `+`, "Empty", "Tap to fill") and **Fight is disabled** (grey, reads `Pick 1 from the bench`, with the line "Rex fell last round. Fill the empty slot to fight." above it);
   the fill path is a tap on the empty slot, the shelf or `Change squad ›`, which opens the squad screen (4.1), so the round screen's squad stays read-only.
   - **Left: the round screen**, YOUR SQUAD zone only (Bram, Ivy, Sol and an empty slot where Rex stood; a `3 of 4` count; shelf with Kit alive, Wren and Rex fallen).
   - **Right: the squad screen**, FIGHTING `3 of 4` with a glowing dashed empty row ("Tap a bench unit to put it here"), BENCH with Kit tappable and the two fallen units dimmed, `Done` greyed and relabelled `Fill 1 empty slot`. With an empty slot the fill is **one tap** on a bench unit (4.1's swap is two taps).
   **This reverses `DECISIONS.md` 2026-10-02 "The pick screen keeps last round's squad"** (an empty slot fills itself, `carryOverFieldPick` in `sim/roster.ts`) and makes Fight not accept-default in this one case. **Canvas only: the code still auto-fills. Not logged in DECISIONS until Tu approves the frame.**
   Open points: (a) no living unit on the bench: does Fight go ahead short-handed, or is it blocked? (`canFieldSquad` decides today); (b) two units dead at once: two empty slots, button `Pick 2 from the bench`, not drawn; (c) the headless sim and batch bot keep auto-filling (`defaultFieldPick`), only the screen changes;
   (d) is `Pick 1 from the bench` clear enough as a disabled-button label, or should the line above do the work.

**Bench shelf (drawn 2026-10-11, revised the same day; its own frame, old 1.2, was dropped 2026-10-14 because 1.2–1.4 show it).** Why (Tu): the one-line bench strip goes unnoticed, so players skip changing squad;
   the bench must still look less important than the fighting squad. Tu's rulings: swapping stays one layer deeper on the squad screen (4.1); no swap suggestion on the round screen (a weak suggestion is a bother, the player decides);
   the old strip is discarded. What is drawn: a **bench shelf inside the YOUR SQUAD box**, under the fighters, behind a dashed line. The header is `BENCH` (muted) and `Change squad ›` in the bold blue the old strip used.
   Each benched unit is a **preview only**: a 22px dimmed circle in its role colour (the colour says the role, so no role word) with a small muted name under it (revision 3, for liveliness) and a thin HP bar below that; a fallen unit is a grey circle with a red ✕ and no bar.
   No fatigue on bench units. The shelf is one tap target to the squad screen with nothing pre-chosen. Drawn on 1.2 and 1.3 (4 fielded of 6, 2 benched), 1.4 (the squad cap, 5 fielded of 8, 3 benched, showing the preview stays small when the bench is full) and 1.5 (a bench with one living and two fallen units).
   Names, HP and fatigue are made up. **Frame 1.1** carries the empty shelf at round 1 ("Empty. New recruits wait here.", no `Change squad ›` since there is nothing to change).
   The squad cap is `maxSlots` (5 fielded). Open points: (a) should a bench circle show fatigue (default: no, it is a preview); (b) check the 22px circles are readable and tappable on a phone.

**Stat icons (2026-10-13, Tu: more compact).** On the round-screen frames (1.1–1.4) HP and Damage are a drawn heart and sword followed by the number, on one line, instead of the words `HP` / `Damage`
   (light grey, so the heart can't be mistaken for the pink exposed mark or the ❤ Ember heart chip). Drawn as small SVGs, not emoji, so they look the same on every phone. **The Healer shows a green plus and its heal number (6) instead of a Damage number**:
   it heals instead of attacking (`healPerBeat` 6 in `sim/roles.ts`), as popup 2.2 already showed; the Warden does the same on 1.4. The popups (2.1–2.4) and term cards keep the words, so the popup is where a player learns what each icon means.
   The squad screen (4.1) shows HP only, unchanged. Stale dimmed copies of 1.1 behind the popups and cards still show the old words until they are recopied (call 10b).
   Open point: a first-time player may not know what the heart and sword mean before the first tap; is a one-time word or legend needed on round 1?

**Boss markers (2026-10-14, Tu: the diamonds looked plain).** The round strip at the top of every round-screen frame (1.1–1.4, and the copies behind 2.1–2.4 and 3.1–3.9) marks the two mini-bosses (rounds 7, 14) and the boss (round 20) with small skull badges instead of rotated squares.
   **Boss:** a 22px dark badge with a red ring, a bone-white skull with two red horns and glowing red eyes; its glow pulses on a 2s loop (`bossPulse`). **Mini-boss:** a 14px badge, a smaller plain skull, no horns. A mini-boss still ahead has a dim red ring; the one being fought (the Vanguard on 1.3) has a bright ring and a still glow;
   a beaten one has a blue ring (the progress fill's colour) and a grey skull with ✕ eyes. 1.3's `MINI-BOSS` text tag also carries the small skull. Drawn as SVG, not emoji, so they look the same on every phone; CSS is in each frame's helmet (`.bm`).
   **Canvas only:** `render/roundScreen.ts` still draws the old strip, so the canvas is a proposal, not what the game shows. Open point: at 14px a skull is small; check it is readable on a real phone.

### 2 · Fighter popup — tap a fighter on 1.1 (later, mid-fight too)

**2.1–2.4 FighterPopup** — **proposal, drawn 2026-10-11, not built, awaiting Tu's approval.** Files `FighterPopupBram / Sol / Anvil / Term.dc.html`, each over a dimmed copy of frame 1.1 (copied, not linked). Meant to open from the round screen and, later, mid-fight. Parts, top to bottom: a switcher row of four chips (Bram, Ivy, Sol, then the enemy
   set apart; the open one ringed; tap to jump), the body with name, role tag and a one-line job between ‹ › arrows (step to the previous/next, wraps round; swipe does the same),
   an `HP now/max` chip (always both numbers, e.g. `140/190`) with a thin HP bar, a `Damage` chip (the Healer shows `Heal 6` instead, it heals on its beat rather than attacking: `performHeroAction`),
   a fatigue line (tier word, a tappable term), a CHAIN part (name, the sentence, how it fires: the bar under the health fills, up to 7 hits, each stronger; then, with the chain, the odds: "Keeps going: 70% after the first hit,
   up to 90% later. Max 7 hits." from `chainChanceByHitsSoFar` / `chainMaxHits`, and "Backfire 3%: the whole chain hits your own squad instead"), and UPGRADES ("No upgrades yet" at round 1).
   Fatigue and Backfire (words and numbers) use a warning orange `#ff9f43` (`.term.danger`, `.dng`), kept apart from the enemy red, the Breaking-tier red and the term green.
   - **2.1** Bram (Tank), shown mid-fight and hurt (140/190), the full example. **2.2** Sol (Healer), hurt (64/100). **2.3** Anvil (enemy): no chain, fatigue or upgrades.
   - **2.4** the second level: the Guard card on top of Bram's popup. There is no back button (Tu, 2026-10-11): the faded popup behind is the way back, and the card's ✕, "Got it" or a tap outside returns to it.
     Words inside a card stay untappable, so the depth is screen → popup → card, 2 levels. The card's animated scene is a labelled placeholder (it is card 3.2's).
   - Numbers: Tank 190/7, Damage 80/8, Healer 100/heal 6 from `ROLE_POOL`; Expose 18 per hit, Mend 4.5 per hit from CHEATSHEET; fresh backfire 3%. Generated from a scratch script; edit by hand from here on.

### 3 · Term cards — tap an underlined word on 1.1 or a popup

**3.1 TermSlam** — **proposal, drawn 2026-10-11, not built, awaiting Tu's approval.** The explainer card a tap on "slam" opens, over a dimmed copy of frame 1.1
   (copied, not linked: recopy if 1.1 changes). Card parts: an animated scene, the term name, a short meaning, and close (✕, "Got it", or a tap outside).
   The scene is a 3.5s CSS loop in the fight screen's look, following the real slam tells in `style.css` / `render/fightView.ts`: the dark SLAM bar creeps up;
   at 0.6s it commits (turns `--windup` red and drains over `windupTelegraphSec` 1.5s, the Executioner pulses `.body.charging`, Ivy gets the dashed `.body.targeted`
   ring, the aim line grows, "SLAM INCOMING"); at 2.1s the hit lands for **24** (Executioner damage 12 × `windupDamageMultiplier` 2) and Ivy's HP bar drops 30%.
   Words inside a card keep their colour but can't be tapped (2026-10-11, to stop card-to-card loops); a card that leans on another term says the plain meaning itself. Closing always returns to the screen. Checking the motion: headless `--screenshot`
   with `--virtual-time-budget` does not advance opacity/transform animations, so pause `document.getAnimations()` at set times in a Playwright page instead.
   The 9 terms that get cards (Tu, 2026-10-11): Slam, Guard, Exposed, Frozen, Burn, Shield, Chain (charge explained inside it), Backfire, Fatigue.
   No tapping during a fight.

**3.2–3.9 Term cards: Guard, Exposed, Frozen, Burn, Shield, Chain, Backfire, Fatigue** — **proposal, drawn 2026-10-11, not built, awaiting Tu's approval.** Same card
   shell as 3.1, each over the same dimmed frame 1.1; Frozen, Burn, Backfire and Fatigue don't appear on 1.1, so it is only a stand-in there (Tu's call), said in
   each frame's note. Generated from a scratch script from TermSlam's shell; edit the files by hand from here on. Each file's CSS header lists its numbers and sources.
   - **3.2 Guard:** the slam commits on Ivy, the aim line swings green (`.aim-line.swing-save`) to Bram, "TAKES THE SLAM", −24, one of Bram's yellow guard pips empties, ✦1 on the slammer.
   - **3.3 Exposed:** the same Ivy hit (damage 8) lands three times: −8, then −13 at ✦5, then −18 at the ✦10 cap (`exposedDamagePerStack` 0.12).
   - **3.4 Frozen:** the slam commits, Bram's Freeze lands, the bar cancels with the shatter flare, the body takes the `.body.frozen` tint and a draining freeze ring, then thaws.
   - **3.5 Burn:** ♨4 ticks for 12, 9, 6, 3 a second apart (`burnDamagePerStack` 3, `burnDecayPerTick` 1).
   - **3.6 Shield:** Sol's overheal leaves ⛊20 on Bram (bar rescales); a 12 hit takes shield only (⛊8), the next breaks it with a flash and 4 comes off HP.
   - **3.7 Chain:** rings fill at different speeds (charge, explained here); Ivy's closes and glows, then hits 18, 23, 29, 34 (`chainEscalationStepMultiplier` 0.3), orange from the 3rd; "IVY'S CHAIN ×4".
   - **3.8 Backfire:** Ivy's ring fires under the red vignette (`.arena.chain-backfire`); 18 and 23 land on Bram, with exposed on Bram too (a backfire picks from your own side, weighted toward a holding Tank: `pickWeightedTargetId`).
   - **3.9 Fatigue (rebuilt 2026-10-15, a still row, no loop):** one unit (Ivy) at fatigue 0, 25, 50, 80 with the eyes of each tier, the tier word, CHAIN HITS +0/+9/+18/+28% (`fatigueMagnitudeMult`) and BACKFIRE 3/7/12/23% (`backfireChanceFor`), and one line "A round on the bench: −20 fatigue". The old five-phase loop taught the pips and overlapped when frozen; the title icon is now a pair of eyes.

### 4 · Squad screen — opened from the bench shelf (Change squad ›)

**4.1 SquadScreen** — the bench on its own screen, two phones: **resting** (FIGHTING 5 of 5, BENCH 3 with a fallen unit dimmed and untappable; rows show the unit's face (its eyes show fatigue; 2026-10-15, replacing the pips), HP and the tier word
   always) and **mid-swap** (a bench unit chosen, the five fielding units dashed-glow, banner "Tap who Olo replaces", Done greyed until the swap is made). Decided with Tu: swapping
   happens here only (the round screen's squad is a read-only preview), and a swap is two taps (bench unit, then who it replaces; any unit for any unit, no role lock).
   **Redrawn 2026-10-11** to match the bench decision (`DECISIONS.md` "The bench is a small preview shelf"): units have names of their own (Bram, Ivy, Sol, Rex, Moss fighting; Olo, Mira, fallen Dax on the bench, the same eight as 1.4's squad),
   plain role-coloured circles with no emoji, and the role word in its colour under the name. It is reached from the bench shelf on the round screen (the blue `Change squad ›`, or a tap on the shelf) with nothing pre-chosen.
   The bench rule is stated in one line with real numbers: "Each round, a unit on the bench heals 60% of its HP and loses 20 fatigue. A fighting unit heals 40%"
   (`benchedRecoverFraction`, `fatigueBenchRest`, `autoRecoverFraction`). This also answers old open call 4 (the bench-heals-faster hint). Generated from a scratch script (rows repeat); edit the file by hand from here on.
   Proposal, not built, awaiting Tu's approval.

### 5 · Fight screen — watching the fight (built)

**5.1 MidFill** — the fight screen, **rebuilt 2026-10-15 with every state present, in two phones** (proposal, not built; it was the built look before): the face style, guard pips and countdowns above the body, the chain charge as a bar under the HP bar, no rings or pips. The states are listed under "Face style". Built from `prototype/src/style.css` sizes; the scene generator was a scratch script, edit by hand from here on.

**5.2 ShieldBar** — built 2026-10-01 (`render/fightView.ts`, `render/hpBar.ts`, `style.css` `.hp-shield-fill`; `DECISIONS.md` "Shield shows as a segment on the HP bar"), with number placement A. **Faces added 2026-10-15** (Fresh eyes on the Tanks, a villain eye on the one enemy; the chain rings removed, and no chain bar is drawn here so the picture stays on the shield); the frame is now a proposal, not the built look.
   Nine states of the HP bar with a
   teal shield segment (today's badge, under max, over max with rescale, a hit eating shield, draining while over max, a break flash, a 4-point
   sliver, the Aegis cap, an enemy), plus the number-placement choice. Bars are drawn wider than on a phone.

### 6 · Reward pick — after a win

**6.1 OfferAfter** — the reward-pick screen. The layout is built (2026-09-30, `render/offerScreen.ts`, `style.css` `.offer-row`): full-width rows, each with a
   category rail (Chain, Stats, Squad, Recovery, Reaction), a named role pill, the change as a big headline, and a quiet "↳" line linking an
   offer to what the run holds. Every row has the same frame; nothing is gold, so no kind looks like the answer.
   **Redrawn and built 2026-10-02, awaiting Tu's approval:** four rows (Chain, Execute, Hunter's mark, Stats). The "reads / makes" chip lines are gone. A mark word is
   coloured where it sits in the card's own text (exposed pink, frozen blue, burn orange, shield teal, from `style.css` `--mark-*`). The "↳" line stays only
   when the card needs a mark from elsewhere, and it names the source ("From your Damage's expose"). A card that only makes a mark has no "↳" line.
   Built in `render/offerScreen.ts` (`markWordsHtml` in `render/heroPickShared.ts`, `MARK_WORDS` in `sim/cards/index.ts`) and `cardWorksWith` in `sim/offers.ts`.

## Face style — applies to every frame (2026-10-14 and 2026-10-15)

The look Tu approved for fatigue and for enemies, built as frames 7.1 and 7.2 (dropped 2026-10-15 once the round and fight screens carried it). Logged in `DECISIONS.md` (2026-10-14: fatigue is shown as eyes; enemies get villain eyes; guard pips and the freeze countdown above the body; the chain charge as a bar under the HP bar). The eye code is `design/tools/faces.js` (use it for any new frame: `node design/tools/faces.js squad <role hex> <tier> <size>`, or `require` it). The prototype is not changed.
   History: Tu found the four-pip stack did not explain itself, sat in a place that meant nothing and read as progress. Round 1 a word badge and an overheat glow (the glow could be mistaken for a chain firing: light around a body already means "happening now", `style.css` `.body.hot`, `.charge-ring.near-full`, `.body.charging`); round 2 cracks ("decoration, not expressing fatigue"); round 3 body language, each option pairing a tired signal with a pushing-hard one; round 4 one hero per option and everything visible with animation off; round 5 steam dropped, eyes kept, tested on a real fight screen; round 6 villain eyes and labels above the body; 2026-10-15 applied to the screens.
   - **The squad's eye.** Two plain eyes on every squad body: a white eye with a round pupil. Fresh = open and alert. Tired: the lids drop (Worn 30%, Frayed 55%, Breaking 75%) and dark bags show. Strong: the lids sit flat and low over sharp pupils (a hard stare), the whites go red-rimmed (Frayed orange `#e8913c`, Breaking red `#ff4d4d`), the Breaking pupils are small with a glint. Frayed and Breaking could sway 1° and 2° (only a loop; none is drawn on the frames now).
   - **Size.** Real body sizes (`style.css` `--role-size`, `--back-rank-scale`): Tank 52px, Damage and grunt 34px, Support 40px, Bruiser 68px; the back rank x0.72 (Damage 24.5px, Healer 28.8px). Under about 34px the **size-tuned eye** is used (bigger eyes, a solid lid band, the rim as a tinted fill with a stroke never thinner than 1px, no bags, bigger pupils); scaled down, the plain eye turned into dark slits at 24.5px and 29px. The frames keep their drawn sizes (some differ from the real ones); `faces.js` picks plain or tuned by the drawn size.
   - **The villain eye.** Enemies have eyes too. It differs in kind from the squad's: a slanted almond with **no white**, a glowing pale-yellow iris and a fixed scowl (inner corner low); it never changes with state. Rule: *a white eye is one of my squad and its lids show fatigue; a dark eye with no white is an enemy.* The Executioner, Vanguard and Warden get a stronger scowl (1.35). V1 glowing slits is used; **V2 cat eye** (yellow whites, a black vertical slit, a heavy lid; the strongest read at the smallest size) and **V3 hollow** (a black almond with one white-hot dot) were drawn as candidates and are available in `faces.js` (`villainFace(size, scowl, variant)`).
   - **No word or number on the body.** The tier word, the chain boost (`fatigueMagnitudeMult`: +0, +9, +18, +28% at fatigue 0, 25, 50, 80) and the backfire chance (`backfireChanceFor`: 3, 7, 12, 23%) live in the fighter popup (2.1, 2.2) and the Fatigue card (3.9). A squad-screen row (4.1, 1.5) also keeps the tier word.
   - **The chain charge is a thin bar under the HP bar**, not a ring around the body. A body is a plain circle on both screens.
   - **Guard pips and the freeze countdown sit a little above the body**, off the face: the pips as a pill just above the head, the countdown above the freeze ring (a red ring on a hero, the blue `--freeze #7ec8ff` on an enemy); frozen and guarding, both show, stacked with the countdown on top. Mark badges stay on the bottom edge. This supersedes the 2026-10-02 MarkSlots choice (pips 25% down the body).
   - **Dropped:** word badge, glow, cracks, steam, sweat drops, an energy bar under HP, a rim colour, a heat fill or ring (they read as progress), colour draining from the body (a dimmed body already means "fallen"; can be drawn on request).
   **Where it is applied (2026-10-15).** Tiers are made up and spread so all four appear: 1.1 everyone Fresh (round 1); 1.2 Ivy Worn; 1.3 Ivy Frayed, Bram Worn; 1.4 and 4.1 Ivy Frayed, Sol Worn, Bram Worn, Rex Breaking, Moss Fresh (4.1 keeps the tier word in each row); 1.5 Ivy Worn; every enemy has the villain eye. **Bench circles on the round screen stay plain** (Tu: no eyes; at 22px a face would be a few pixels wide). **4.1 (my decision, Tu asked for one): faces replace the pips**, benched and fielded alike, because that is where fatigue is managed; fallen units stay grey with the ✕.
   **5.1 is the fight screen with every state, in two phones.** A, a chain is firing: Ivy's glow and the dimmed squad (`.arena.chain-live`, which also dims the eyes), the Executioner winding up a slam, Bram guarding (3 pips above his head, a shield on his HP bar), a frozen hero and a frozen enemy (countdowns above the rings), Exposed and Burn badges, the chain bar under every squad HP bar, all four tiers on the squad. B, a moment later with no chain live (no dimming, the faces at full colour): a frozen guarding Tank (both labels stacked), a downed hero (`.body.down`, 35% opacity), a hurt Executioner. 5.2 (the shield bar) gets Fresh eyes and one villain eye, the rings removed. The popups (2.1 to 2.4) and term cards (3.1 to 3.9) gain faces on every body so no frame shows a faceless body next to a face; the popup sentence about "the ring" now says the bar under the unit's health.
   **Not done (still the old look):** the guard pips on 3.2 and the ❄ pill on 3.4 keep their old placement; the chain rings on 3.7 and 3.8 stay; the popups' tiny grey fatigue square beside "Fatigue: Fresh"; the prototype (`render/heroPickShared.ts` `fatiguePipsHtml`, `render/roundScreen.ts`, `render/fightView.ts` `makeHeroSlot`, `style.css`, `checks/fatigue.ts`). **Known conflicts:** the front-rank Tank sits about 14px under the centre line, so the pips above its head touch it (a frozen guarding Tank reaches well past it); the transient hero status popups (`.hero-status`, `top:-14px`, about 1s) use the same strip and would overlap a pill (raise the popup by the pill's height). Open: the frozen tint turns an enemy's yellow iris pale blue; a struck back-rank body pops forward to full size so its face changes size for a moment; a first-time player and a real phone are untested.

## Dropped frames (2026-10-11)

- **Old 7.1 (FatigueOptions) and 7.2 (FightFaces), dropped 2026-10-15 (Tu: no separate screen for what the round and fight screens now show).** 7.1 drew the squad eye tiers at the real body sizes, the size-tuned eyes and three villain-eye candidates; 7.2 was a simulated fight screen with three variants (eyes on heroes only, on enemies too, only when tired; Tu chose enemies too) and an overlay panel. Their spec is in "Face style" and `design/tools/faces.js`; the frames themselves are in git history and in canvas versions 57 and 58.

Seven frames were removed in the reorganisation. They are still in git history (last present at commit `4db6b07`).

- **Old 1.2 (RoundFaceOffBench), dropped 2026-10-14 (Tu: redundant).** It showed the bench shelf on two phones (mid-run, 4 fielded of 6; squad cap, 5 fielded of 8). The lineup frames 1.2–1.4 draw the same two squads with the same shelf, so nothing was lost; its spec lives on under "Bench shelf". Last present at commit `adc4b46`.

- **Old 1–3 (RoundStart, RoundGrown, RoundPress)** — the role-band round screen the game has today: units grouped by role, one band per role with its icon and one chip per picked-up ability,
  a `+N` badge once a chain was made stronger (never the word "level"), round tokens with the HP bar under the circle, fatigue pips beside it, a FIGHTING strip in place of a "Pick N to fight" sentence,
  and RoundPress's held-down TANK band with the full text and each unit's backfire chance. Replaced by 1.1 and the bench shelf (decision 2026-10-10); the code in `render/roundScreen.ts` still draws the old version until 1.1 is built.
- **Old 5 (FatiguePips)** — the four-tier pip display; built, details in "Fatigue display" below (superseded by the face style, 2026-10-15).
- **Old 8 (MarkSlots)** — the mark-badge and guard-pip layout bug next to the three fixes; Tu picked option A (2026-10-02), built. A mark badge sits on the body's bottom edge; the guard pips sit in a dark pill 25% down the body. **Superseded 2026-10-14 by frame 7.2 for the guard pips (and the freeze countdown): both now sit a little above the body, off the face; the bottom-edge mark badges stay.**
  Both are absolute slot children, not perch children (`style.css` `.mark-row` / `.guard-pips`; comments in `render/fightView.ts`). Five pips (`GUARD_PIP_CAP`) just fit a 52px tank body.
  Cost: the badges cover a slice of the chain ring at 6 o'clock and the lower edge of small bodies.
- **Old 10 (RoundFaceOffGrown) and old 11 (RoundFaceOffFull)** — the face-off at round 12 (vs Executioner + 2 Guards, details popover open) and at round 17 (five fielded, the squad cap, vs Warden + 2 Acolytes). Both still showed the old bench strip and the chain rows.
  What survives: 1.2–1.4 draw a mid-run bench and the five-fielded cap; the popup (2.1–2.4) holds the chain, matchup and backfire detail. Facts from them worth keeping: a Warden heals on its beat instead of attacking, so it gets no `Damage` chip, only
  `✚ Heals its most hurt ally for 6 instead of attacking` and its slam (28); at five fielded, bodies shrink to 38px with name and `HP / Damage` stacked.

## Fatigue display — chosen and built 2026-09-30

> **Superseded 2026-10-15 by the face style (see "Face style"): the prototype still builds these pips until the faces are built.** Earlier note, 2026-10-14: Tu dislikes these pips (no word, odd place, reads as progress). Frames 7.1 and 7.2 draw the replacement: eyes whose lids drop and whose whites go red-rimmed ("tired but wired"); earlier rounds' badge, glow, cracks and steam were dropped on Tu's feedback. The pips below stay in the code and on frames 2.1, 2.2, 3.9, 4.1, 5.1 until it is approved.

**Tier pips:** 4 pips beside each token (pick screen) and each body (fight screen), lit up to the unit's tier. Colours:
fresh grey `#8a8fa3` (1 pip), worn `#ffcf4d` (2), frayed `#e8913c` (3), breaking `#ff4d4d` (4). Tier ranges come from
`sim/config.ts` `fatigueTierFloors [25, 50, 80]`, so fresh 0–24, worn 25–49, frayed 50–79, breaking 80–100.

Built 2026-09-30: `render/heroPickShared.ts` (`fatiguePipsHtml`, `FATIGUE_TIER_PIPS`) builds the stack;
`roundScreen.ts` puts it beside each living token; `fightView.ts`'s `makeHeroSlot` puts it beside each player body; `style.css` has
`.fatigue-pips`. `checks/fatigue.ts` pins the lit counts. What that means on screen:
- **The ring.** The pick screen has no ring (charge resets to 0 every fight, so it has nothing to show); the old tier-coloured ring is gone.
  The fight screen keeps the charge ring. The tier word stays under a pick-screen token once a unit is no longer Fresh.
- **Backfire dots.** The old per-role "backfire risk" dots are gone from the code and from the canvas. Backfire chance is per unit now,
  and appears in the popup (2.1) and the Fatigue card (3.9); the built round screen shows it only in its expanded card, in the code's own wording ("Tank 2: worn — 9% backfire.").
- **Fresh lights 1 grey pip**, so the stack never reads as empty. Open call: 0 lit pips for fresh is the alternative.
- Pips don't move during a fight. Fatigue changes only between fights (`sim/roster.ts`).

## Open calls for Tu

1. **Icons.** 🛡 ⚔ ✚ 💥 ⚡ are emoji: fast to mock up, but they render differently per phone/OS. Plain drawn shapes cost more. The stat icons below (heart, sword, plus) are already drawn shapes; the 💥 and ✚ enemy badges on 1.3 and 1.4 are still emoji. The boss and mini-boss skulls on the round strip (2026-10-14) are drawn SVG.
2. ~~Full sentences behind a press~~ — closed 2026-10-11: it was about the held-down TANK band on the old round screen (dropped). The popup (2.1–2.4) replaces it.
3. **Per-unit damage/speed numbers** were dropped from the old round screen (every unit of a role shares them). `Damage` returned on 1.1 (call 8b); attack speed stays out.
4. **The bench-heals-faster hint** — answered on 4.1, which states the rule in one line with real numbers. Does the round screen also need it?
5. **Shield number placement** (frame 5.2). A: the HP label gains a teal `⛊40`. B: a small teal tag sits at the bar's right end. The frame's inner cards 2–9 use A.
6. **Shield rescale side effects** (frame 5.2, inner cards 3, 5, 8). The rescale shrinks the blue HP fill while shielded (Aegis: half the bar), and it
   grows back as the shield drains with no HP change. Acceptable, or would an overlay read better?
7. **Coloured mark words on cards** (frame 6.1, 2026-10-02). Approve the new look, or change it? Open point: a mark introduced by a maker card is now
   introduced only by its coloured word in the description, since the "Makes ✦ exposed" line is gone.

8. **Face-off round screen and squad screen** (frames 1.1, the bench shelf on 1.2–1.4, and 4.1). Approve the look? Open points: (a) "Fight!" vs "Play"; (b) the per-unit `Damage` number returns on the round
   screen (it was dropped from the old one, see call 3), is that fine; (c) nothing yet says *when* a chain fires (the ring filling in the fight): the popup says how it fires, 1.1 no longer carries the "Special moves" label;
   (d) the slam line ("charges up, then hits for 24") is new wording; (d2) where unit names come from in the game (a fixed pool, random, or chosen): the canvas uses made-up names (Bram, Ivy, Sol, Rex, Moss, Olo, Mira, Dax), the code still builds `Tank 1` etc. from the role label (`sim/roles.ts:101`);
   (e) the squad screen is a new screen and a new route, and today a tap just toggles a pick, so the swap rule changes when this is built; (f) a roster with no one on the bench (round 1) shows the empty shelf, no `Change squad ›`.
   Settled 2026-10-09: "Hits" wording, attack speed not shown, bench on its own screen, two-tap swap.
   Settled 2026-10-10: frame 1.1's squad zone (units with names of their own, role as a small tag, no role one-liners, bodies in ranks with shadows); see `DECISIONS.md`.

9. **Tappable terms and the term cards** (frames 1.1 and 3.1–3.9, 2026-10-11). Approve the look? Open points: (a) the term colour `#c5e86c` for slam, Guard and Chain;
   (b) closed 2026-10-11: the matchup and backfire lines that lived in old frame 10's popover now live in the popup (2.1); (c) closed 2026-10-11: old frame 10's enemy named "Guard" is gone with the frame (rename it if it returns);
   (d) closed: "Special moves" became "Chains", then the CHAINS rows left 1.1 (code wording untouched);
   (e) frame 1.1 says "No slam to fear" with slam marked, so the first card a player may open is for a move this enemy lacks; (f) the meaning says "When their SLAM bar
   turns red", which is the real tell but new wording; (g) Exposed shows stacks arriving without their source, to keep the scene on what exposed does;
   (g2) terms inside a card are not tappable, so a player can never hop between cards; Guard, Fatigue and Backfire now spell out the other term in a few words; (h) the card icons ⛨ ✦ ❄ ♨ ⛊ ⛓ ⚠ are text glyphs and render differently per OS (see call 1).

10. **Fighter popup** (frames 1.1, 2.1–2.4, 2026-10-11). Approve the shape? Open points: (a) tapping in a fight goes against "No tapping during a fight": does the fight pause
   while the popup is open?; (b) frames 3.1–3.9 still show the old frame 1.1 behind them (Tu said frame 1.1 only), recopy later; (c) closed 2026-10-11: old frames 10 and 11, which showed chain rows, are dropped;
   (d) closed 2026-10-13: the Healer shows a plus and 6 (Heal) on 1.1–1.4, matching the popup;
   (e) a first-time player may not read the hint line, and you removed a hint before: is a line enough?; (f) "Upgrades" is empty on round 1 and has no "what it could learn" hint;
   (g) the popup opens a term card (2 levels), which reverses the 2026-10-11 rule that cards never link on; (h) the keep-going number moves with fatigue (up to +10%, `fatigueContinuationBonus`),
   like backfire does, so the popup must redraw both when fatigue changes; (i) the danger orange `#ff9f43` is close to burn's orange `#ff8a3d`: check they can't be confused.

11. **Face style** (2026-10-15). Applied to the round screens (1.1 to 1.5), the squad screens (4.1 and 1.5's), the fight screens (5.1, 5.2), and as faces-only to every body in the popups and term cards. Settled by Tu: eyes for fatigue, size-tuned eyes under about 34px, villain eyes on enemies, guard pips and the countdown above the body, the chain charge as a bar under the HP bar, bench circles stay plain. Open: (a) the villain eye, V1 (used) or V2 (the strongest at the smallest size);
   (b) the two label conflicts: the pips touch the centre line above the front-rank Tank, and overlap the transient hero status popups; (c) the items still in the old look (3.2, 3.4, 3.7, 3.8, the popups' fatigue square) and the term cards' frozen-state overlap problem: a follow-up pass? Decisions are in `DECISIONS.md` (2026-10-14, four entries).

## What the canvas does not cover

- No motion except the term cards (3.1–3.8): slam timing on the fight screen, chain pulses, freeze ticking, the swap taps.
- **Animation only plays in the Interact tool, and only on up to 10 artboards at a time** (read from the canvas page's own code, 2026-10-14; not yet confirmed in the browser). The editor injects `animation:none!important` on every design element while editing, so the term cards (3.1 to 3.8) are frozen in the normal editing view (and show several states at once: overlapping badges, empty HP fills, an always-visible "SLAM INCOMING"; not fixed); far-away artboards beyond the live cap are static too.
  Design every frame so it reads with animation off: a signal that exists only inside an `@keyframes` (base `opacity:0`) is invisible there. Verify with `*{animation:none!important}` on a scratch copy, not by pausing at a phase (the 2026-10-14 mistake in `MISTAKES.md`).
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
