# Design canvas — hand-off

**Canvas:** https://claude.ai/artifact/73dix2PGsz2Y7BBDMNbzny
**Current artboards:** Main (turn 1, resting), MidChain (Rook's chain firing on Executioner),
Freeze (Hollow's stun holding Executioner), EndCard (the chain's end card).
**Last published:** 2026-09-16 — Version 1.
**Source files:** `design/canvas/*.dc.html`, `design/canvas/canvas.json` — edit these, then re-seed
and republish (see the `design` skill). Don't hand-edit the seeded `fight-field-layout.html`; it's
a build output, regenerated from these on every publish.

## What this covers

The fight screen only, as four still frames — the screen STATE.md's Next up #1 is asking Tu to
play-test (chain identity, Bracer's guard, Hollow's stun). Every size, gap, and colour on the
canvas is copied from the real numbers in `prototype/src/style.css` and `prototype/src/render/fightView.ts`,
using the token names introduced in the 2026-09-16 token pass (`--track-bg`, `--surface`, `--heal`,
`--freeze`, `--accent-0..5`, `--back-rank-scale`, `--tracer-ms`).

## What it does not cover

- **No motion.** Slam timing, chain pulses, how fast a freeze ticks — these are frozen moments, not
  an animated preview. Timing stays a conversation in words.
- **No runtime sizing.** Each hero's card width, in the real game, is worked out live from that
  hero's health as a share of everyone's health; the canvas uses fixed widths that look right for
  this one roster. Applying a canvas change to the code still means re-deriving that rule by hand.
- Squad shown: Bracer + Hollow + Rook vs. Executioner + 2 Guards — chosen because it puts both of
  STATE.md's provable effects (Bracer's guard, Hollow's stun) in the same fight.

## When Tu changes something on the canvas

Read this file back into the session (`design/canvas/*.dc.html` after a re-`--extract`, or ask me
to read the published page) before touching the code — I compare the new numbers against
`style.css`'s `:root` tokens and `fightView.ts`'s size constants, then apply the diff. I don't
re-derive the whole file from scratch.
