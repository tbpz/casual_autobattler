# CLAUDE.md — how to work with the context files

This project's design context lives in two files with **opposite rules**:

- **[STATE.md](STATE.md)** — what is true *right now*. Present tense. Small. Rewritten wholesale, never appended to.
- **[DECISIONS.md](DECISIONS.md)** — the append-only history of decisions and their rationale. Dated, newest at top. Never edited or deleted, only added to.

Placement rule: if a line needs history to make sense, it belongs in DECISIONS.md, not STATE.md.

## On session start — the READ protocol

1. **Read `STATE.md` first, always.** It is the current direction.
2. **Do not read `DECISIONS.md` top-to-bottom.** Only grep it to answer a "why did we decide X?" question.
3. **Staleness check:** if `DECISIONS.md` has entries newer than `STATE.md`'s `Last synced` date, STATE is behind — trust the newer DECISIONS entries, tell the user STATE is stale, and offer to re-sync.
4. `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
5. `DECISIONS.md` has an in-place archive boundary: entries below the `ARCHIVE` rule predate the 2026-07-18 pivot and describe a superseded game design. Discount grep hits below that line as history, not live rationale, unless the question is specifically about the pre-pivot era.

## During the session — the DECISION protocol

I cannot reliably detect on my own when a decision is final — in design talk, things that sound settled often get reversed. So: **propose, don't silently commit.**

1. When something sounds like a decision, **surface it**: "That sounds like a decision: *X over Y*. Log it?"
2. **Only on the user's confirmation**, append one entry to `DECISIONS.md` immediately — do not batch it, and do not edit `STATE.md` for it.
   - **Invoke the `decision-log` skill**, which carries the entry format, the word budget, and the rules that keep entries small and grep-safe. Never write a DECISIONS.md entry freehand.
3. Never auto-write a decision the user hasn't confirmed. Their confirmation is what makes the log auditable.

## Rewriting STATE.md

`STATE.md` is regenerated **only when the user asks** ("sync", "update the state") — never automatically, because a wholesale rewrite is high-stakes and the user should be present to audit it. When asked, **invoke the `state-sync` skill**, which carries the full protocol, the word budget, and the section caps. Never regenerate `STATE.md` freehand.
