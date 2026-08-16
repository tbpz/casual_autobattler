# CLAUDE.md — how to work with the context files

This project's design context lives in three files with **different rules**:

- **[STATE.md](STATE.md)** — what is true *right now*, and what to do next. Present tense. Rewritten wholesale, never appended to. Two layers: layer 1 (above the rule) is a 60-second re-orientation read; layer 2 is the working index of status, bets, open questions, and pointers.
- **[DECISIONS.md](DECISIONS.md)** — the append-only history of decisions and their rationale. Dated, newest at top. Never edited or deleted, only added to.
- **[REFERENCE.md](REFERENCE.md)** — the near-static material: the game's mechanical shape, reference games, standing constraints. Edited only when it is actually wrong; **a sync never regenerates it**.

Placement rules:

- If a line needs history to make sense, it belongs in DECISIONS.md, not STATE.md.
- If a line explains *how a mechanism works*, it belongs in the code — `prototype/src/sim/config.ts` holds every tunable in one place. STATE names where a piece stands and points; it never paraphrases behaviour.
- A line earns a place in STATE only if it would change what the reader does next session. Everything else is reference.

The `decision-log` and `state-sync` skills referenced below live in `.claude/skills/` and are tracked with this repo.

## On session start — the READ protocol

1. **Read `STATE.md` first, always.** It is the current direction. Layer 1 alone is enough to orient; read layer 2 when the task needs it.
2. **Read `REFERENCE.md` only when you need the game's mechanical shape** — it is stable, so re-reading it every session is wasted.
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

## Rewriting STATE.md

`STATE.md` is regenerated **only when the user asks** ("sync", "update the state") — never automatically, because a wholesale rewrite is high-stakes and the user should be present to audit it. When asked, **invoke the `state-sync` skill**, which carries the reader framework, the section skeleton, and the four sizing rules. Never regenerate `STATE.md` freehand.

There is **no word budget**. Length is an output of the sizing rules, not a target: draft it once, applying the admission test per line as you write. Do not count words, do not report a count, and never do a second pass to trim to a number — a measure-then-trim loop re-emits the whole file for nothing, and the compression it forces is what made the old STATE unreadable.
