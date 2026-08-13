---
name: state-sync
description: Regenerate STATE.md wholesale from the current STATE plus newer DECISIONS entries. Use when the user asks to "sync", "re-sync", "update the state", or "regenerate STATE.md", or after telling them STATE is stale. Carries the subtractive removal-list step, both litmus tests, the 1,700-word budget with per-section caps, and the required section skeleton.
---

# Regenerating STATE.md

`STATE.md` is the snapshot of what is true *right now* for this project. It is rewritten wholesale, never appended to. This skill is the only place the full regeneration protocol lives — `CLAUDE.md` just points here.

## The two litmus tests (apply while drafting)

Every line in `STATE.md` must pass both:

1. **Self-containment test:** the line must be checkable as true/false without opening any other file. If a line needs history to make sense, it belongs in `DECISIONS.md`, not `STATE.md`.
2. **Different-path test:** would this line be written the same way if the project had arrived at today's state by a completely different route? If it only makes sense as a contrast with, or a chronicle of, what came before — "as of 2026-08-08...", "no longer...", "up from...", a numbered chronology of steps — it is history. Cut it; `DECISIONS.md` already says it, usually better.

## The regeneration protocol

1. **First, build a removal list** — before drafting new prose, go through the current `STATE.md` and mark every line that is (a) history under the different-path test, (b) a restatement of a fact that already has a home elsewhere in the file, or (c) unchanged across two syncs running without ever having changed the reader's next action. This makes sync **subtractive by default**, not just additive.
2. **Rewrite `STATE.md` from scratch** — do not edit it line by line. Regenerate the whole document from the current STATE *minus the removal list*, plus the DECISIONS entries added since its last sync.
3. **Deprecated ideas fall away by omission** — simply don't write them again. Do not add "❌ deprecated" tombstones to STATE; deprecations live in DECISIONS.
4. Keep it **present tense, one-fact-one-place, self-contained** (obey both litmus tests above). Keep the section headers stable across rewrites so the user's eye always knows where to look — see the section skeleton below.
5. **Hold the budget: 1,700 words hard cap, ~1,400 target**, and no section over its cap below. If the draft is over, cut before presenting — a sync that hands back an over-budget file has not done its job.

   | Section | Cap |
   |---|---|
   | What we're making | 80 |
   | Where we are right now | 150 |
   | The shared lead moment (or successor) | 250 |
   | Probe status / live-status table (or successor) | 400 |
   | Next up | 250 |
   | The design spine | 350 |
   | Working assumptions | 150 |
   | Reference games | 100 |
   | Open questions | 120 |
   | Related files | 80 |

6. **`Where we are right now` is a snapshot, not a chronicle.** ≤5 present-tense sentences: current direction and what's actively being worked on. No dates, no step numbers, no "first X, then Y, then Z" chronology — that sequence is what DECISIONS.md is for.
7. `Last synced` is a bare date, nothing else: `> **Last synced:** YYYY-MM-DD`. It is not a changelog line — if there's something worth saying about what changed, it goes in DECISIONS.md, not squeezed into this line.
8. **Check every cross-reference.** Every "see X" in the rewritten file must name a `##` header that exists verbatim in the rewritten file. A pointer to a section that was renamed or removed is a bug — fix it before presenting.
9. **Report the count.** State the total word count and each section's count against its cap in the sync summary, so staying in budget is a measurement, not a feeling.
10. Present the rewrite (with the removal list and word counts) for the user to audit. The user maintains nothing by hand — draft, they verify.

## Guardrails

- Keep `STATE.md` under its budget — **1,700 words hard cap, ~1,400 target**. If it's growing, it's carrying history that belongs in DECISIONS. This is a measured number, not a feeling: a sync reports the count.
- Never repeat the same fact in two places in STATE — redundancy is where contradictions breed.
- **Live status lives in exactly one place.** If a fact has an evolving status (e.g. a probe's result, an arm's outcome), give it one home — a dedicated table or section — and have every other mention *point* there instead of restating it. A second copy is how sync drift starts: one gets updated, the other doesn't, and STATE ends up contradicting itself.
- A resync regenerates `STATE.md` into this section skeleton (stable headers, so the reader's eye always knows where to look): What we're making → Where we are right now → The shared lead moment (or its successor north-star) → Probe status (or its successor live-status table) → Next up → The design spine → Working assumptions → Reference games → Open questions → Related files. Sections may be renamed as the project's phase changes, but the shape — one current-direction paragraph, one live-status table, one hypotheses list, one open-questions list — should persist.
- `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
