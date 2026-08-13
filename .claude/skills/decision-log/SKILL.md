---
name: decision-log
description: Append one entry to DECISIONS.md after the user confirms a decision. Use whenever CLAUDE.md's DECISION protocol step 2 fires — "log it?" has been answered yes. Carries the entry budget, the one-claim-per-bullet formatting rule, and the decision-not-diff test that keeps entries small and grep-safe.
---

# Appending to DECISIONS.md

`DECISIONS.md` is the append-only history of decisions and their rationale. This skill is the only place the full append protocol lives — `CLAUDE.md` just points here, the same way it points to `state-sync` for `STATE.md`.

Append-only means entries are never edited or deleted once written. That makes what goes *into* an entry the only lever this skill has — get it wrong and it's wrong forever, which is exactly what happened before this skill existed: numeric settings logged as "current" went stale the next tuning pass, with no way to correct them.

## The two tests (apply while drafting)

**1. Decision, not diff.** An entry records the *principle adopted* and *the evidence that forced it* — not a changelog of what values moved.
- Numbers are allowed only as **frozen, dated evidence**: "measured 100% run completion, 0.00 deaths/run at n=2000" is correct forever, because it's scoped to a measurement event that already happened.
- Numbers are **never** recorded as **resulting settings**: "set `difficultyRampFactor` 1.06 → 1.12" goes stale the moment the next tuning pass changes it, and — because entries can't be edited — becomes a silent contradiction sitting in the log forever. Current constants live in code (`prototype/src/sim/config.ts`, `heroes.ts`); point there instead of restating the value.
- If a line is fully recoverable from `git log -p <file>`, cut it and name the commit or file instead of transcribing the diff into prose.

**2. One claim per bullet.** Write short bullets, one claim each — not a single paragraph-length bullet carrying the whole decision. This is what keeps `grep` useful: `CLAUDE.md`'s "grep it, don't read it" rule only holds if a grep hit is a line, not a 2–4KB block of prose. A reader (or an agent) grepping a keyword should land on one checkable claim, not the entire entry.

## The append protocol

1. Only fires after the user has confirmed a proposed decision (`CLAUDE.md` DECISION protocol step 2) — never speculatively, never batched.
2. Draft the entry in the standard format: `## [YYYY-MM-DD] Title` → **Decision** / **Why** / **Replaces**, each field as short one-claim bullets rather than a single dense paragraph.
3. Apply both tests above while drafting — cut diff-shaped lines, cut anything `git log -p` already has, point at code for live constants instead of quoting them.
4. **Hold the budget: ~250 words / ~1,800 bytes per entry, hard cap 350 words.** Report the word count when presenting the drafted entry — a measurement, not a feeling, same discipline `state-sync` uses for `STATE.md`'s cap.
5. Insert at the **top** of the log, immediately below the header block — never at the bottom, never mixed into the middle.
6. Never edit, reorder, or delete an existing entry to make room. If an existing entry is now stale or contradicted, that's handled by a *new* entry that says so and points at the current source of truth — not by touching the old one.

## Guardrails

- **Live status has no home in DECISIONS.** DECISIONS records why a choice was made, not what a setting currently is — that's `STATE.md`'s job (constants) or the code's (values). An entry that would go stale on the next tuning pass is a sign it's carrying a setting, not a decision — cut the number, keep the principle.
- **Grep-cost is a design constraint, not an afterthought.** Every bullet should be independently readable out of context, since that's exactly the form a `grep` match returns it in.
- The pre-2026-07-18 pivot entries below the archive rule in `DECISIONS.md` are frozen history, not a style template — they predate this skill and are long for reasons the archive banner explains, not reasons to imitate.
