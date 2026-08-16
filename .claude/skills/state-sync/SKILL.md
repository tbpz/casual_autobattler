---
name: state-sync
description: Regenerate STATE.md wholesale from the current STATE plus newer DECISIONS entries. Use when the user asks to "sync", "re-sync", "update the state", or "regenerate STATE.md", or after telling them STATE is stale. Carries the reader framework, the subtractive removal-list step, the four sizing rules that replace a word budget, and the required section skeleton.
---

# Regenerating STATE.md

`STATE.md` is the snapshot of what is true *right now* for this project. It is rewritten wholesale, never appended to. This skill is the only place the full regeneration protocol lives — `CLAUDE.md` just points here.

## Who it is for

Two readers, one file, two depths:

- **Tu**, re-orienting after a break or when the direction feels lost. He reads **layer 1** — the top four sections — and stops. Target: 60 seconds to state what we're making, what we're betting on, and what the next action is.
- **Claude**, at session start, working in-direction and advising on decisions. Reads both layers, then follows pointers into the code and `DECISIONS.md` for whatever the task needs.

Both readers know the game and can read TypeScript. So STATE never explains a mechanism — it says where a piece stands and names the file. Writing for a hypothetical cold reader is what made the old file long and unread.

## The reader framework

The questions a reader arrives with, in the order they ask them. Every line in STATE answers one; a line answering none is cut or moved.

| # | Question | Home |
|---|---|---|
| 1 | What is this, for whom? | STATE — layer 1 |
| 2 | What are we trying to make true? | STATE — layer 1 |
| 3 | Where does it stand? | STATE — both layers |
| 4 | What do I do next? | STATE — layer 1 |
| 5 | What's still open? | STATE — layer 2 |
| 6 | What must I not undo, and why? | **`DECISIONS.md` — STATE carries a pointer, never the content** |
| 7 | How do I work here? | STATE — layer 2 |

Q6 is the one STATE does not answer. Settled ground and its rationale are `DECISIONS.md`'s entire job; restating them in STATE is what bloats it.

## The four sizing rules

These replace a word budget. **Each is checkable while writing a single line**, not after drafting a document — which is the point. A word cap can only be discovered at the end, so it forces a measure-then-trim pass that re-emits the whole file. These don't.

1. **Admission test.** A line earns its place only if it would change what the reader does next session. Three failure modes, each with a destination:
   - *mechanism / how a thing works* → the code (`prototype/src/sim/config.ts` holds every tunable in one place)
   - *rationale, history, "we moved from X to Y"* → `DECISIONS.md`
   - *unchanged across two syncs and never used* → cut, or move to `REFERENCE.md`
2. **Slots, not words.** Each section has a hard **item count**, listed in the skeleton below. You know you're at item 5 when you type item 5.
3. **One line, one claim.** Every bullet and every table cell is a single line. If it wants a second sentence, that is the signal it is reference: the sentence goes to `DECISIONS.md` or the code, and the item keeps a pointer. Same rule `decision-log` uses for the same reason.
4. **Pointer over restatement.** Name the file or the DECISIONS entry. Never paraphrase it and then cite it too — that pays for the fact twice.

**Length is an output, not a target.** Applied honestly these land STATE near 500–600 words. Do not count words, do not report a count, and do not trim to hit a number. If a draft comes out long, the admission test was applied too loosely — fix that, not the word count.

## The two litmus tests (apply while drafting)

1. **Checkable-claim test:** the *claim* a line makes must be true/false on its face — "built and batch-verified, not played" is checkable; "the chain works well" is not. The *detail behind* the claim is always a pointer. (This is not a ban on pointers: a line may say where a thing lives, it just may not need another file to be understood.)
2. **Different-path test:** would this line be written the same way if the project had arrived at today's state by a completely different route? If it only makes sense as a contrast with what came before — "as of 2026-08-08...", "no longer...", "up from...", a numbered chronology — it is history. Cut it; `DECISIONS.md` already says it, usually better.

## The regeneration protocol

1. **First, build a removal list** — before drafting new prose, go through the current `STATE.md` and mark every line that fails the admission test or either litmus test. This makes sync **subtractive by default**, not just additive.
2. **Rewrite `STATE.md` from scratch** — do not edit it line by line. Regenerate the whole document from the current STATE *minus the removal list*, plus the `DECISIONS.md` entries added since its last sync.
3. **One pass.** Draft it once, applying the four sizing rules per line as you write. There is no second trimming pass and no word count to hit.
4. **Deprecated ideas fall away by omission** — simply don't write them again. No "❌ deprecated" tombstones; deprecations live in `DECISIONS.md`.
5. Keep it **present tense, one-fact-one-place**. Keep the section headers stable across rewrites so the reader's eye always knows where to look — see the skeleton below.
6. **`Where it stands` is a snapshot, not a chronicle.** ≤4 present-tense sentences: current direction and what is actively being worked. No dates, no step numbers, no "first X, then Y" sequence — that is what `DECISIONS.md` is for.
7. `Last synced` is a bare date, nothing else: `> **Last synced:** YYYY-MM-DD`. Not a changelog line.
8. **Check every cross-reference.** Every "see X" must name a `##` header that exists verbatim in the rewritten file, and every file path named must exist on disk. A pointer to a renamed or removed target is a bug — fix it before presenting.
9. Present the rewrite, with the removal list, for the user to audit. The user maintains nothing by hand — draft, they verify.

## The section skeleton

Stable headers. Layer 1 is the 60-second read and ends at the rule; layer 2 is the working index.

| Section | Shape | Slots |
|---|---|---|
| What this is | what's being made, for whom, by whom | ≤4 lines |
| What we're betting on | the lead moment, then its load-bearing clauses | quote + ≤4 lines |
| Where it stands | present-tense prose | ≤4 sentences |
| Next up | ordered, #1 unambiguous and actionable today | ≤5 lines |
| *— layer break (`---`) —* | | |
| Status by piece | table: Piece \| State \| Where it lives | one row per piece |
| Unverified bets | the risk register: what could still collapse | ≤5 lines |
| Open questions | only ones that gate a Next up item | ≤5 lines |
| How to work here | commands, key files, protocol pointers | ≤6 lines |

**State vocabulary** for the status table, so the column stays scannable: `not started`, `built`, `batch-verified`, `played-verified`, `blocked`.

## Guardrails

- Never repeat the same fact in two places in STATE — redundancy is where contradictions breed.
- **Live status lives in exactly one place.** If a fact has an evolving status, it belongs in `Status by piece`; every other mention points there instead of restating it. A second copy is how sync drift starts.
- **STATE never explains a mechanism.** If a reader needs to know how the chain resolves, they open `sim/fight.ts`. If STATE is describing behavior, it has taken on the code's job.
- Sections may be renamed as the project's phase changes, but the shape — two layers, one status table, one bets list, one open-questions list — should persist.
- `REFERENCE.md` is **not** regenerated by a sync. It holds near-static material (the design spine, reference games) and is edited only when it is actually wrong.
- `STRATEGY.md` is deprecated pending a rewrite; do not treat it as current.
