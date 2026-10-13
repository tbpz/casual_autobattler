# Design canvas — hand-off

**Canvas:** https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny
**Source files:** `design/canvas/*.dc.html`, `design/canvas/canvas.json` — edit these, then republish (see
"Publishing" below). Don't hand-edit `fight-field-layout.html`; it's a build output, regenerated on publish.

## What's on the canvas (reorganised 2026-10-11)

Twenty-two frames in six rows, numbered `section.item` in the order a player meets them. Still pictures, except the term cards (3.1–3.9), which loop CSS animations. No interaction.
Colours and sizes are copied from the real code (`prototype/src/style.css`, `render/roundScreen.ts`, `render/fightView.ts`), so a change here is a real proposal.
Units, HP and fatigue values are made up for the picture, not read from a run.

**Old numbers.** `DECISIONS.md` is never edited, so it still uses the numbers the frames had when they were drawn. Old to new:

| Old | New | Frame |
|---|---|---|
| 9 | 1.1 | RoundFaceOff |
| 9e | 1.2 | RoundFaceOffBench |
| 9a, 9b, 9c, 9d | 2.1, 2.2, 2.3, 2.4 | FighterPopup Bram, Sol, Anvil, Term |
| 13–21 | 3.1–3.9 | Term cards: Slam, Guard, Exposed, Frozen, Burn, Shield, Chain, Backfire, Fatigue |
| 12 | 4.1 | SquadScreen |
| 4 | 5.1 | MidFill |
| 7 | 5.2 | ShieldBar |
| 6 | 6.1 | OfferAfter |
| 1, 2, 3, 5, 8, 10, 11 | dropped 2026-10-11 | see "Dropped frames" below |

### 1 · Round screen — before every fight

**1.1 RoundFaceOff** — **proposal, drawn 2026-10-09, not built, awaiting Tu's approval.** Round 1 of the face-off round screen. It replaces the role-band round screen the game has today (old frames 1–3, dropped).
   Why: playtest friends couldn't tell what the screen was. Root cause: the pick screen draws a *menu* (role bands, a small red strip on top) while the fight screen draws a
   *face-off*, so nothing says "two squads, about to fight"; neither side is named; numbers and chips are bare ("605/605", "guard") with the sentence behind a tap that
   nothing says is a tap; the encounter blurb was built but thrown away (`_encounterBlurb` in `roundScreen.ts`); and enemy damage/slam/heal were never shown.
   Frame: a one-line goal sentence (first rounds only), a tinted ENEMY zone (body, `HP 605`, `Damage 8`, the encounter blurb), a VS line, a tinted YOUR SQUAD zone
   (**redrawn 2026-10-10:** named fighters, made-up names Bram / Ivy / Sol, with the role as a small coloured tag; plain role-coloured bodies with ground shadows in two
   ranks as the fight screen draws them, Tank in front and the other two behind to each side; `HP / Damage` numbers; no role one-liners, no "3 fighters" count). No fatigue pips while every unit is fresh. Button reads "Fight!".
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

**1.2 RoundFaceOffBench** — **proposal, drawn 2026-10-11 (revised the same day), not built, awaiting Tu's approval.** Why (Tu): the one-line bench strip goes unnoticed, so players skip changing squad;
   the bench must still look less important than the fighting squad. Tu's rulings: swapping stays one layer deeper on the squad screen (4.1); no swap suggestion on the round screen (a weak suggestion is a bother, the player decides);
   the old strip is discarded. What is drawn: a **bench shelf inside the YOUR SQUAD box**, under the fighters, behind a dashed line. The header is `BENCH` (muted) and `Change squad ›` in the bold blue the old strip used.
   Each benched unit is a **preview only**: a 22px dimmed circle in its role colour (the colour says the role, so no role word) with a small muted name under it (revision 3, for liveliness) and a thin HP bar below that; a fallen unit is a grey circle with a red ✕ and no bar.
   No fatigue on bench units. The shelf is one tap target to the squad screen with nothing pre-chosen. Two phones: mid-run (4 fielded of 6, 2 benched) and the squad cap (5 fielded of 8, 3 benched), to show the preview stays small when the bench is full.
   Names, HP and fatigue are made up. **Frame 1.1** carries the empty shelf at round 1 ("Empty. New recruits wait here.", no `Change squad ›` since there is nothing to change).
   The squad cap is `maxSlots` (5 fielded). Open points: (a) should a bench circle show fatigue (default: no, it is a preview); (b) check the 22px circles are readable and tappable on a phone.

**1.3–1.5 Enemy lineups** — **proposal, drawn 2026-10-13 and revised the same day, not built, awaiting Tu's approval.** Frame 1.1 shows only round 1 (one enemy), so these three show the screen at the hardest lineups
   (Tu: "variance screens, the most complicated lineups"). Files `RoundFaceOffPack / Vanguard / Warden.dc.html`, copies of 1.1's shell with the goal line left off (first rounds only).
   **Revision (Tu):** tapping a fighter or enemy already opens its popup (2.1–2.4), so the round screen does not explain. Each enemy body shows its name, HP bar and two numbers under it, as icons on one line (a heart for HP, a sword for Damage; see "Stat icons" below)
   (kept so the two sides can be compared at a glance; the Warden's second number is a green plus and 6, Heal, as the Healer's is on 2.2). A **badge** on the body's top-right edge says "this one has something special": 💥 = it slams, ✚ (green) = it heals. No badge, nothing special. Two badges stack **vertically** (Tu, 2026-10-13): side by side, the right one drifted toward Acolyte 2 and the slam read as the Acolyte's.
   The sentences ("charges up, then hits your weakest unit for 15", "heals its most hurt ally") and the per-kind rows are gone from the round screen; the popup holds them. The encounter blurb stays as the one sentence. Numbers are real: `ENCOUNTERS` × `roundEnemySide` at that round.
   - **1.3 Pack, round 15:** the most bodies (5 Skirmishers, no badges). Your side is 1.2's mid-run phone.
   - **1.4 Vanguard, round 14:** a mini-boss (new `MINI-BOSS` tag) plus 3 Outriders; a 💥 badge marks the Vanguard.
   - **1.5 Warden, round 17:** the Warden carries two badges, ✚ and 💥, plus Acolytes ×2. Your side is 1.2's squad-cap phone (5 fielded, 3 benched), the tallest the screen gets (about 700px).
   Open points: (a) does a new player notice the badges and tap for the popup (the hint line says to tap, but nothing says what a badge means until they do); (b) the badges are emoji and render differently per phone (call 1), and 20px is small on a phone; (c) the badge sits on the body's edge and can touch a neighbour in a tight row (the Outriders' stat lines were too close on 1.4, fixed 2026-10-13 by giving small bodies a 56px column); (d) closed 2026-10-13: Anvil on 1.1 now uses the same icon line as the others; (e) The Reckoning (boss, round 20) is not drawn: it adds nothing the Vanguard doesn't; (f) the popup for an enemy with a slam or a heal is not drawn yet (2.3 shows Anvil, which has neither).

**Stat icons (2026-10-13, Tu: more compact).** On the round-screen frames (1.1, 1.2, 1.3–1.5) HP and Damage are a drawn heart and sword followed by the number, on one line, instead of the words `HP` / `Damage`
   (light grey, so the heart can't be mistaken for the pink exposed mark or the ❤ Ember heart chip). Drawn as small SVGs, not emoji, so they look the same on every phone. **The Healer shows a green plus and its heal number (6) instead of a Damage number**:
   it heals instead of attacking (`healPerBeat` 6 in `sim/roles.ts`), as popup 2.2 already showed; the Warden does the same on 1.5. The popups (2.1–2.4) and term cards keep the words, so the popup is where a player learns what each icon means.
   The squad screen (4.1) shows HP only, unchanged. Stale dimmed copies of 1.1 behind the popups and cards still show the old words until they are recopied (call 10b).
   Open point: a first-time player may not know what the heart and sword mean before the first tap; is a one-time word or legend needed on round 1?

### 2 · Fighter popup — tap a fighter on 1.1 (later, mid-fight too)

**2.1–2.4 FighterPopup** — **proposal, drawn 2026-10-11, not built, awaiting Tu's approval.** Files `FighterPopupBram / Sol / Anvil / Term.dc.html`, each over a dimmed copy of frame 1.1 (copied, not linked). Meant to open from the round screen and, later, mid-fight. Parts, top to bottom: a switcher row of four chips (Bram, Ivy, Sol, then the enemy
   set apart; the open one ringed; tap to jump), the body with name, role tag and a one-line job between ‹ › arrows (step to the previous/next, wraps round; swipe does the same),
   an `HP now/max` chip (always both numbers, e.g. `140/190`) with a thin HP bar, a `Damage` chip (the Healer shows `Heal 6` instead, it heals on its beat rather than attacking: `performHeroAction`),
   a fatigue line (tier word, a tappable term), a CHAIN part (name, the sentence, how it fires: the ring fills, up to 7 hits, each stronger; then, with the chain, the odds: "Keeps going: 70% after the first hit,
   up to 90% later. Max 7 hits." from `chainChanceByHitsSoFar` / `chainMaxHits`, and "Backfire 3%: the whole chain hits your own squad instead"), and UPGRADES ("No upgrades yet" at round 1).
   Fatigue and Backfire (words and numbers) use a warning orange `#ff9f43` (`.term.danger`, `.dng`), kept apart from the enemy red, the Breaking pip red and the term green.
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
   - **3.9 Fatigue:** one unit at fatigue 0, 25, 50, 80, then a bench round (−20): tier word and pips change, CHAIN HITS +0/+9/+18/+28/+21% (`fatigueMagnitudeMult`) and
     BACKFIRE CHANCE 3/7/12/23/15% (`backfireChanceFor`).

### 4 · Squad screen — opened from the bench shelf (Change squad ›)

**4.1 SquadScreen** — the bench on its own screen, two phones: **resting** (FIGHTING 5 of 5, BENCH 3 with a fallen unit dimmed and untappable; rows show HP, fatigue pips and the tier word
   always) and **mid-swap** (a bench unit chosen, the five fielding units dashed-glow, banner "Tap who Olo replaces", Done greyed until the swap is made). Decided with Tu: swapping
   happens here only (the round screen's squad is a read-only preview), and a swap is two taps (bench unit, then who it replaces; any unit for any unit, no role lock).
   **Redrawn 2026-10-11** to match the bench decision (`DECISIONS.md` "The bench is a small preview shelf"): units have names of their own (Bram, Ivy, Sol, Rex, Moss fighting; Olo, Mira, fallen Dax on the bench, the same eight as 1.2's squad-cap phone),
   plain role-coloured circles with no emoji, and the role word in its colour under the name. It is reached from the bench shelf on the round screen (the blue `Change squad ›`, or a tap on the shelf) with nothing pre-chosen.
   The bench rule is stated in one line with real numbers: "Each round, a unit on the bench heals 60% of its HP and loses 20 fatigue. A fighting unit heals 40%"
   (`benchedRecoverFraction`, `fatigueBenchRest`, `autoRecoverFraction`). This also answers old open call 4 (the bench-heals-faster hint). Generated from a scratch script (rows repeat); edit the file by hand from here on.
   Proposal, not built, awaiting Tu's approval.

### 5 · Fight screen — watching the fight (built)

**5.1 MidFill** — fight screen: chain shown as a ring around each player body, role-coloured bodies, fatigue pips beside each body.
   The four pips are the fatigue display chosen and built 2026-09-30 (see "Fatigue display" below).

**5.2 ShieldBar** — built 2026-10-01 (`render/fightView.ts`, `render/hpBar.ts`, `style.css` `.hp-shield-fill`; `DECISIONS.md` "Shield shows as a segment on the HP bar"), with number placement A.
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

## Dropped frames (2026-10-11)

Seven frames were removed in the reorganisation. They are still in git history (last present at commit `4db6b07`).

- **Old 1–3 (RoundStart, RoundGrown, RoundPress)** — the role-band round screen the game has today: units grouped by role, one band per role with its icon and one chip per picked-up ability,
  a `+N` badge once a chain was made stronger (never the word "level"), round tokens with the HP bar under the circle, fatigue pips beside it, a FIGHTING strip in place of a "Pick N to fight" sentence,
  and RoundPress's held-down TANK band with the full text and each unit's backfire chance. Replaced by 1.1 and 1.2 (decision 2026-10-10); the code in `render/roundScreen.ts` still draws the old version until 1.1 is built.
- **Old 5 (FatiguePips)** — the four-tier pip display; built, details in "Fatigue display" below.
- **Old 8 (MarkSlots)** — the mark-badge and guard-pip layout bug next to the three fixes; Tu picked option A (2026-10-02), built. A mark badge sits on the body's bottom edge; the guard pips sit in a dark pill 25% down the body.
  Both are absolute slot children, not perch children (`style.css` `.mark-row` / `.guard-pips`; comments in `render/fightView.ts`). Five pips (`GUARD_PIP_CAP`) just fit a 52px tank body.
  Cost: the badges cover a slice of the chain ring at 6 o'clock and the lower edge of small bodies.
- **Old 10 (RoundFaceOffGrown) and old 11 (RoundFaceOffFull)** — the face-off at round 12 (vs Executioner + 2 Guards, details popover open) and at round 17 (five fielded, the squad cap, vs Warden + 2 Acolytes). Both still showed the old bench strip and the chain rows.
  What survives: 1.2 draws a mid-run bench and the five-fielded cap; the popup (2.1–2.4) holds the chain, matchup and backfire detail. Facts from them worth keeping: a Warden heals on its beat instead of attacking, so it gets no `Damage` chip, only
  `✚ Heals its most hurt ally for 6 instead of attacking` and its slam (28); at five fielded, bodies shrink to 38px with name and `HP / Damage` stacked.

## Fatigue display — chosen and built 2026-09-30

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

1. **Icons.** 🛡 ⚔ ✚ 💥 ⚡ are emoji: fast to mock up, but they render differently per phone/OS. Plain drawn shapes cost more. The stat icons below (heart, sword, plus) are already drawn shapes; the 💥 and ✚ enemy badges on 1.4 and 1.5 are still emoji.
2. ~~Full sentences behind a press~~ — closed 2026-10-11: it was about the held-down TANK band on the old round screen (dropped). The popup (2.1–2.4) replaces it.
3. **Per-unit damage/speed numbers** were dropped from the old round screen (every unit of a role shares them). `Damage` returned on 1.1 (call 8b); attack speed stays out.
4. **The bench-heals-faster hint** — answered on 4.1, which states the rule in one line with real numbers. Does the round screen also need it?
5. **Shield number placement** (frame 5.2). A: the HP label gains a teal `⛊40`. B: a small teal tag sits at the bar's right end. The frame's inner cards 2–9 use A.
6. **Shield rescale side effects** (frame 5.2, inner cards 3, 5, 8). The rescale shrinks the blue HP fill while shielded (Aegis: half the bar), and it
   grows back as the shield drains with no HP change. Acceptable, or would an overlay read better?
7. **Coloured mark words on cards** (frame 6.1, 2026-10-02). Approve the new look, or change it? Open point: a mark introduced by a maker card is now
   introduced only by its coloured word in the description, since the "Makes ✦ exposed" line is gone.

8. **Face-off round screen and squad screen** (frames 1.1, 1.2, 4.1). Approve the look? Open points: (a) "Fight!" vs "Play"; (b) the per-unit `Damage` number returns on the round
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
   (d) closed 2026-10-13: the Healer shows a plus and 6 (Heal) on 1.1, 1.2 and 1.3–1.5, matching the popup;
   (e) a first-time player may not read the hint line, and you removed a hint before: is a line enough?; (f) "Upgrades" is empty on round 1 and has no "what it could learn" hint;
   (g) the popup opens a term card (2 levels), which reverses the 2026-10-11 rule that cards never link on; (h) the keep-going number moves with fatigue (up to +10%, `fatigueContinuationBonus`),
   like backfire does, so the popup must redraw both when fatigue changes; (i) the danger orange `#ff9f43` is close to burn's orange `#ff8a3d`: check they can't be confused.

## What the canvas does not cover

- No motion except the term cards: slam timing on the fight screen, chain pulses, freeze ticking, the swap taps.
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
