---
name: decision-log
description: Append one entry to DECISIONS.md when Tu states or picks a decision. Use whenever CLAUDE.md's DECISION protocol fires — no confirmation needed. Carries the entry budget, the one-claim-per-bullet formatting rule, and the decision-not-diff test that keeps entries small and grep-safe.
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

1. Only fires for a choice Tu stated or picked (`CLAUDE.md` DECISION protocol) — never for my own un-adopted suggestion, never batched. No "log it?" question first.
2. **Check the decision against the verified list in `BETS.html`.** If it breaks a verified bet, stop and flag it to Tu as `CLAUDE.md`'s DECISION protocol says (which bet, how it breaks, the proof link). Do not write the entry until he answers. If he drops or replaces the bet, the entry says the bet is overturned.
3. Draft the entry in the standard format: `## [YYYY-MM-DD] [game|workflow] Title` → **Decision** / **Why** / **Replaces**, each field as short one-claim bullets rather than a single dense paragraph. Tag `[game]` when it settles what the player gets (rules, numbers, units, UI, art) and `[workflow]` when it settles how we work (context files, skills, logging, process). The tag is part of the heading, so a `BETS.html` link anchor includes it (`2026-10-23-game-title-words`).
4. Apply both tests above while drafting — cut diff-shaped lines, cut anything `git log -p` already has, point at code for live constants instead of quoting them.
5. **Hold the budget: ~250 words / ~1,800 bytes per entry, hard cap 350 words.** Report the word count in the one-line note that says what was logged — a measurement, not a feeling, same discipline `state-sync` uses for `STATE.md`'s cap.
6. Insert at the **top** of the log, immediately below the header block — never at the bottom, never mixed into the middle.
7. **If the decision settles or adds a bet, update `BETS.html` in the same change** — the rules are in `CLAUDE.md`, "Keeping BETS.html current". A verified bet needs a link to the entry just written: an inline `<a class="proof" href="DECISIONS.md#anchor">` link with the date as its text, at the end of its line in `BETS.html`; check the anchor exists.
8. **If the decision drops or replaces a whole system** (a mechanic, screen or unit kind), add one line to the "Dropped systems" list in the `DECISIONS.md` header: the system, the date, and a link to the new entry. That list is not an entry and is edited in place; it is how a later grep hit on the old entries is recognised as history.
9. Never edit, reorder, or delete an existing entry to make room. If an existing entry is now stale or contradicted, that's handled by a *new* entry that says so and points at the current source of truth — not by touching the old one.

## Guardrails

- **Live status has no home in DECISIONS.** DECISIONS records why a choice was made, not what a setting currently is — that's `STATE.md`'s job (constants) or the code's (values). An entry that would go stale on the next tuning pass is a sign it's carrying a setting, not a decision — cut the number, keep the principle.
- **Grep-cost is a design constraint, not an afterthought.** Every bullet should be independently readable out of context, since that's exactly the form a `grep` match returns it in.
- The pre-2026-07-18 pivot entries below the archive rule in `DECISIONS.md` are frozen history, not a style template — they predate this skill and are long for reasons the archive banner explains, not reasons to imitate.
