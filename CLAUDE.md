# CLAUDE.md — how to work with the context files

This project's design context lives in two files with **opposite rules**. Read this first, then follow it every session.

- **[STATE.md](STATE.md)** — the snapshot of what is true *right now*. Present tense. Small. Rewritten wholesale, never appended to.
- **[DECISIONS.md](DECISIONS.md)** — the append-only history of decisions and their rationale. Dated. Never edited or deleted, only added to (newest at top).

The litmus test that keeps STATE trustworthy: **every line in STATE.md must be checkable as true/false without opening any other file.** If a line needs history to make sense, it belongs in DECISIONS.md, not STATE.md.

---

## On session start — the READ protocol

1. **Read `STATE.md` first, always.** It is the current direction.
2. **Do not read `DECISIONS.md` top-to-bottom.** Only consult it to answer a "why did we decide X?" question — grep it for the relevant entry.
3. **Staleness check:** `STATE.md` has a `Last synced` date; `DECISIONS.md` entries are dated. If DECISIONS has entries *newer* than STATE's last-synced date, STATE is behind — **trust the newer DECISIONS entries, tell the user STATE is stale, and offer to re-sync** (see the STATE regeneration protocol below).

## During the session — the DECISION protocol

I cannot reliably detect on my own when a decision is final — in design talk, things that sound settled often get reversed. So the rule is **propose, don't silently commit:**

1. When something sounds like a decision, **surface it to the user**: "That sounds like a decision: *X over Y*. Log it?"
2. **Only on the user's confirmation**, append one entry to `DECISIONS.md` immediately — do not batch it to later, and do not edit `STATE.md` for it yet.
   - Entry format: `## [YYYY-MM-DD] Title` → **Decision** / **Why** / **Replaces**. Add it at the **top** of the log (below the header).
   - Use today's real date.
3. Never auto-write a decision the user hasn't confirmed. The user's confirmation is the source of truth — that is what makes the log auditable.

## When the state has changed — the STATE regeneration protocol

`STATE.md` is regenerated **only when the user asks** (e.g. "sync", "update the state"). It does not update automatically and is not tied to "end of session" (I can't detect session end). This is deliberate: regenerating STATE is a high-stakes wholesale rewrite the user should be present to audit.

When asked to sync:

1. **Rewrite `STATE.md` from scratch** — do not edit it line by line. Regenerate the whole document from the current STATE plus the DECISIONS entries added since its last sync.
2. **Deprecated ideas fall away by omission** — simply don't write them again. Do not add "❌ deprecated" tombstones to STATE; deprecations live in DECISIONS.
3. Keep it **present tense, one-fact-one-place, self-contained** (obey the litmus test above). Keep the section headers stable across rewrites so the user's eye always knows where to look.
4. Update the `Last synced` date to today.
5. Present the rewrite for the user to audit. The user maintains nothing by hand — I draft, they verify.

## Guardrails

- Keep `STATE.md` small enough to read in ~3 minutes. If it's growing, it's carrying history that belongs in DECISIONS.
- Never repeat the same fact in two places in STATE — redundancy is where contradictions breed.
- `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
