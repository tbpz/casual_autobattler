# CLAUDE.md — how to work with the context files

This project's design context lives in four files with **different rules**:

- **[STATE.md](STATE.md)** — what is true *right now*, and what to do next. Present tense. Rewritten wholesale, never appended to. Two layers: layer 1 (above the rule) is a 60-second re-orientation read; layer 2 is the working index of status, bets, open questions, and pointers.
- **[DECISIONS.md](DECISIONS.md)** — the append-only history of decisions and their rationale. Dated, newest at top. Never edited or deleted, only added to.
- **[REFERENCE.md](REFERENCE.md)** — the near-static material: the game's mechanical shape, reference games, standing constraints. Edited only when it is actually wrong; **a sync never regenerates it**.
- **[CHEATSHEET.md](CHEATSHEET.md)** — the current rules and numbers of every mark, relic, card, duo and role ability, one line each. Derived from the code, never the source of truth; kept current automatically (see "Keeping CHEATSHEET.md current").

Placement rules:

- If a line needs history to make sense, it belongs in DECISIONS.md, not STATE.md.
- If a line explains *how a mechanism works*, it belongs in the code — `prototype/src/sim/config.ts` holds every tunable in one place. STATE names where a piece stands and points; it never paraphrases behaviour.
- A line earns a place in STATE only if it would change what the reader does next session. Everything else is reference.

The `decision-log` and `state-sync` skills referenced below live in `.claude/skills/` and are tracked with this repo.

## On session start — the READ protocol

1. **Read `STATE.md` first, always.** It is the current direction. Layer 1 alone is enough to orient; read layer 2 when the task needs it.
2. **Read `REFERENCE.md` only when you need the game's mechanical shape** — it is stable, so re-reading it every session is wasted.
   Read `CHEATSHEET.md` when you need a card, relic, mark or ability number — it is current by rule.
3. **Do not read `DECISIONS.md` top-to-bottom.** Only grep it to answer a "why did we decide X?" question.
4. **Staleness check:** if `DECISIONS.md` has entries newer than `STATE.md`'s `Last synced` date, STATE is behind — trust the newer DECISIONS entries, tell the user STATE is stale, and offer to re-sync.
5. `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
6. `DECISIONS.md` has an in-place archive boundary: entries below the `ARCHIVE` rule predate the 2026-07-18 pivot and describe a superseded game design. Discount grep hits below that line as history, not live rationale, unless the question is specifically about the pre-pivot era.

## During the session — the DECISION protocol

I cannot reliably detect on my own when a decision is final — in design talk, things that sound settled often get reversed. So: **propose, don't silently commit.**

1. When something sounds like a decision, **surface it**: "That sounds like a decision: *X over Y*. Log it?"
2. **Only on the user's confirmation**, append one entry to `DECISIONS.md` immediately — do not batch it, and do not edit `STATE.md` for it.
   - **Invoke the `decision-log` skill**, which carries the entry format, the word budget, and the rules that keep entries small and grep-safe. Never write a DECISIONS.md entry freehand.
3. Never auto-write a decision the user hasn't confirmed. Their confirmation is what makes the log auditable.

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

## Keeping CHEATSHEET.md current

Update `CHEATSHEET.md` in the same change, **without asking**, whenever a change touches a rule or number it lists:

- A constant in `prototype/src/sim/config.ts` that a mark, relic, card, duo or chain ability uses.
- A definition in `prototype/src/sim/cards/defs/`.
- The relic, upgrade or offer-gate rules in `sim/relics.ts`, `sim/roles.ts`, `sim/cards/index.ts`.
- A card, relic, mark or ability added, removed or renamed.

How:

1. Edit only the affected lines. Keep the shape: bullets, one rule per line, no explanation, no context, no history.
2. Take values from the code, not memory. Check derived numbers (e.g. 3 burn × 5 = 15).
3. Set the `Last updated` line to the current date and time (`date +"%Y-%m-%d %H:%M"`).
4. Say it in one line in the reply. It needs no DECISIONS entry and is not a STATE sync.
