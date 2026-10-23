# CLAUDE.md — how to work with the context files

This project's design context lives in five files with **different rules**:

- **[BETS.md](BETS.md)** — the bets, under four pillars (what the game must be great at) and one top test. The verified bets are the game's quality standard, grouped by pillar; the unverified ones are one list ordered first to last to verify, each tagged with its pillar. One line per bet, no explanation. Every verified bet carries a proof link to the DECISIONS entry that settled it. Carries a `Last updated` line.
- **[STATE.md](STATE.md)** — what is true *right now*, and what to do next. Present tense. Rewritten wholesale, never appended to. Two layers: layer 1 (above the rule) is a 60-second re-orientation read; layer 2 is the working index of status, open questions, and pointers. Bets live in BETS.md, not here.
- **[DECISIONS.md](DECISIONS.md)** — the append-only history of decisions and their rationale. Dated, newest at top. Never edited or deleted, only added to.
- **[REFERENCE.md](REFERENCE.md)** — the near-static material: the game's mechanical shape, reference games, standing constraints. Edited only when it is actually wrong; **a sync never regenerates it**.
- **[CHEATSHEET.md](CHEATSHEET.md)** — the current rules and numbers of every mark, relic, card, duo and role ability, one line each. Derived from the code, never the source of truth; kept current automatically (see "Keeping CHEATSHEET.md current").

Placement rules:

- If a line needs history to make sense, it belongs in DECISIONS.md, not STATE.md.
- If a line explains *how a mechanism works*, it belongs in the code — `prototype/src/sim/config.ts` holds every tunable in one place. STATE names where a piece stands and points; it never paraphrases behaviour.
- A line earns a place in STATE only if it would change what the reader does next session. Everything else is reference.

The `decision-log`, `state-sync`, `cheatsheet-update`, `canvas-update` and `browser-check` skills referenced below live in `.claude/skills/` and are tracked with this repo.

## On session start — the READ protocol

1. **Read `STATE.md` first, always.** It is the current direction. Layer 1 alone is enough to orient; read layer 2 when the task needs it.
2. **Read the verified list in `BETS.md` before proposing any design solution.** It is the quality
   standard. Say which verified bet a proposal could break, or that it breaks none. The unverified
   list is read when deciding what to work on next.
3. **Read `REFERENCE.md` only when you need the game's mechanical shape** — it is stable, so re-reading it every session is wasted.
   Read `CHEATSHEET.md` when you need a card, relic, mark or ability number — it is current by rule.
4. **Do not read `DECISIONS.md` top-to-bottom.** Only grep it to answer a "why did we decide X?" question.
5. **Staleness check:** if `DECISIONS.md` has entries newer than `STATE.md`'s `Last synced` date, STATE is behind — trust the newer DECISIONS entries, tell the user STATE is stale, and offer to re-sync.
6. `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
7. `DECISIONS.md` has an in-place archive boundary: entries below the `ARCHIVE` rule predate the 2026-07-18 pivot and describe a superseded game design. Discount grep hits below that line as history, not live rationale, unless the question is specifically about the pre-pivot era.

## During the session — the DECISION protocol

I cannot reliably detect on my own when a decision is final — in design talk, things that sound settled often get reversed. So: **propose, don't silently commit.**

1. When something sounds like a decision, **surface it**: "That sounds like a decision: *X over Y*. Log it?"
2. **Only on the user's confirmation**, append one entry to `DECISIONS.md` immediately — do not batch it, and do not edit `STATE.md` for it.
   - **Invoke the `decision-log` skill**, which carries the entry format, the word budget, and the rules that keep entries small and grep-safe. Never write a DECISIONS.md entry freehand.
   - If the decision settles or adds a bet, `BETS.md` changes in the same step (see "Keeping BETS.md current").
3. Never auto-write a decision the user hasn't confirmed. Their confirmation is what makes the log auditable.

## When Tu says something feels wrong

A "feels wrong" note is a symptom, not a spec. Building is cheap here, so the trap is answering
every feeling with a build and never learning whether the last one worked.

Before writing any code for it:

1. **Name the gap with him:** what he expected to feel, what he felt, and at which moment (screen,
   second, unit). If his note doesn't say, ask one short question. This is a text question even for
   a UI feeling — it asks what he felt, not which look he wants.
2. **Offer 2–3 possible causes**, each with the cheapest way to tell them apart — often a replay,
   an `export` file, a batch number or a throwaway probe, not a build.
3. **Tie it to the bet:** say which pillar in `BETS.md` and which unverified bet (or open question in
   `STATE.md`) this serves, and which verified bet the fix could break. If it serves none, say so
   plainly — it may be widening the game, not deepening it.
4. **Build only after he picks a cause**, and say up front how we'll know it worked (his replay, a
   friend's playtest, a batch number).

Also:

- If the fix is a look, motion or tap choice, the options still go on the canvas (see "Choosing UI,
  animation and interaction" below).
- If a new big system is about to start while the last one has been played by no one but Tu, say
  so before building.
- When he asks for a quick, clearly scoped change ("make it 20% faster"), that is not a feeling —
  just do it.

## When I make a mistake

A mistake here means: I stated something, then had to reverse it — because Tu pushed back, asked a
question that exposed it, or I caught it myself. When that happens:

1. Append one entry to `MISTAKES.md` immediately, in the format its own header describes. No need
   to ask first — Tu has already said logging alone doesn't need his sign-off.
2. Tell him in one line that it happened and point at the entry. Don't make it a bigger
   interruption than that.
3. Never edit or delete a past entry, even a stale one — same append-only rule as `DECISIONS.md`.
   A pattern found later gets a new note, not a rewrite of the old one.

Finding a pattern across entries and deciding what to fix is a separate, later step — not
triggered by this file alone.

## Rewriting STATE.md

`STATE.md` is regenerated **only when the user asks** ("sync", "update the state") — never automatically, because a wholesale rewrite is high-stakes and the user should be present to audit it. When asked, **invoke the `state-sync` skill**, which carries the reader framework, the section skeleton, and the four sizing rules. Never regenerate `STATE.md` freehand.

There is **no word budget**. Length is an output of the sizing rules, not a target: draft it once, applying the admission test per line as you write. Do not count words, do not report a count, and never do a second pass to trim to a number — a measure-then-trim loop re-emits the whole file for nothing, and the compression it forces is what made the old STATE unreadable.

Cutting lines is fine; cramming words into a line is not — the plain-language rules in `~/.claude/CLAUDE.md` still apply here.

## Keeping BETS.md current

Update `BETS.md` in the same change as the DECISIONS entry that settles a bet, **without asking** —
the decision itself was already confirmed.

- A bet is **verified** only by Tu's play, a played test, or a measurement, and every verified bet
  carries a proof link to the DECISIONS entry. No entry, no verified bet.
- A verified bet moves from the unverified list to the verified list, under its pillar, with its link.
- A bet that fails is removed from the unverified list; if it taught a standard, that standard goes
  into the verified list under its pillar as its own line, linking the entry.
- A new bet names its pillar and goes into the unverified list, tagged. One that fits no pillar is
  flagged to Tu as widening the game, not deepening it. **Where it ranks is Tu's call**; propose a
  position, never reorder the list silently.
- A new pillar, or a change to one, is Tu's call and a decision (propose it, then log it).
- One line per bet, no explanation. Bump the `Last updated` date on every change.
- The proof is a reference-style link whose text is the entry's date, like `[2026-08-06][7]`. Its
  definition, `[7]: DECISIONS.md#<heading-anchor>`, goes in the block at the bottom of the file, so
  no long anchor sits in a list line. Check the anchor matches a real heading.
- A line in the verified list is never reworded to fit a new idea. If a new decision contradicts one,
  say so to Tu first; it is a decision, not an edit.

## Keeping CHEATSHEET.md current

Update `CHEATSHEET.md` in the same change, **without asking**, whenever a change touches a rule or number it lists:

- A constant in `prototype/src/sim/config.ts` that a mark, relic, card, duo or chain ability uses.
- A definition in `prototype/src/sim/cards/defs/`.
- The relic, upgrade or offer-gate rules in `sim/relics.ts`, `sim/roles.ts`, `sim/cards/index.ts`.
- A card, relic, mark or ability added, removed or renamed.

**Invoke the `cheatsheet-update` skill**, which carries the editing steps. It needs no DECISIONS entry and is not a STATE sync.

## Keeping the design canvas current

Sessions often make a quick UI adjustment straight in the prototype. Update the canvas in the same
change, **without asking**, whenever a change alters how the built game looks or behaves on screen
(colours, sizes, layout, wording, motion or timing) in a file `design/HANDOFF.md` "Built in the
prototype" names: the `render/*.ts` screen modules, `style.css`, `screens.css`, `termCards.css`.
Refactors with no visible change, dev-only URL params and screens no frame draws are not triggers.

- By default the frames are redrawn to match. If the code differs only because of a limit of the
  build, not a design call, note it under "Where the build differs from the canvas" instead.
- Publish once, at the end of the task, before saying it is done. The steps are in `design/HANDOFF.md`
  under "Publishing"; the rule under "Changing the design canvas" below still applies.

**Invoke the `canvas-update` skill**, which carries the editing steps. It needs no DECISIONS entry and is not a STATE sync.

## Editing files

Python is not installed on Tu's laptop — `python` is only the Microsoft Store stub. Never use
`python` for file edits or scripts. Use the Edit/Write tools; for a scripted bulk edit across many
files, use `node` (installed, since the prototype is TypeScript) with the script in the scratchpad.

## Testing UI in a browser

On Tu's company-managed Windows laptop (`C:\Users\tu.vu`), launching the wrong browser can lock his
JumpCloud account. It happened on 2026-10-09 after 10 headless Chrome screenshots. Company policy
puts the JumpCloud Go extension into every Google Chrome profile, including throwaway headless ones.

- **Never launch** the installed Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`),
  headless or not. Also never use agent-browser or its bundled "Chrome for Testing" — this rule
  overrides the `agent-browser` skill.
- **For how to take screenshots or click through a page, invoke the `browser-check` skill.** It
  carries the safe headless command and the Claude in Chrome route. If neither works, ask — never
  fall back to launching Chrome yourself.

## Changing the design canvas

Tu sees canvas changes only through the canvas link, never in the local files. So a change to
`design/canvas/` is not finished until it is published there and the live page has been read back
— the steps are in `design/HANDOFF.md` under "Publishing".

- Any plan that touches `design/canvas/` lists "publish to the canvas link" as a step.
- If I stop before publishing, I say plainly that the canvas still shows the old version.

## Choosing UI, animation and interaction: draw, don't ask

Tu cannot judge a look, a motion or a tap flow from a question in words. For these choices only,
**do not ask — draw each option as its own screen on the canvas** and let him pick by looking.

- **In scope:** how the game looks (layout, colour, size, wording in place), how it moves
  (animation, timing, motion), and how it responds to the player (taps, gestures, screen flow,
  pause and popup behaviour).
- **Out of scope** (these stay normal questions): game rules, numbers, balance, names of mechanics,
  code or file structure.
- **The rule:** for an in-scope choice, never use AskUserQuestion or a text question, in plan mode
  or out. Draw one screen per option, publish to the canvas link, say in one line which frames to
  look at, then stop until he picks.
- **Drawing is still asking.** Never build, redraw into the real frames, or log an option he has not
  chosen. If there is only one sensible option it is not a choice: draw it as a proposal, as usual.
- **In plan mode** the canvas cannot be edited, so the plan's first step is "draw the options on the
  canvas and publish, then stop for Tu's pick". Build steps come after his pick.
- **Not affected:** "That sounds like a decision. Log it?" stays a text question (it confirms, it
  does not choose between looks). Open points that can't be settled by looking (for example "check
  on a real phone") stay as text in HANDOFF.

**Invoke the `canvas-options` skill**, which carries the steps. It needs no DECISIONS entry until
Tu picks.
