---
name: canvas-update
description: Update the design canvas frames in the same change as any edit to how the built game looks or behaves on screen (colours, sizes, layout, wording, motion, timing), then publish to the canvas link. Use whenever CLAUDE.md's "Keeping the design canvas current" triggers fire. No need to ask first.
---

# Updating the design canvas

Tu sees the design only through the canvas link, so a UI change that never reaches the canvas leaves it showing a game that no longer exists. The canvas is current only once it is published.

## What counts as a trigger

A change to how the built game looks or behaves on screen (colours, sizes, layout, wording, motion or timing) in a file that `design/HANDOFF.md` "Built in the prototype" names: the `render/*.ts` screen modules, `style.css`, `screens.css`, `termCards.css`, `render/faces.ts`.

Not a trigger:

- A refactor with no visible change.
- Dev-only URL params (`?round=N` and the like).
- A screen no frame draws (for example the round recap).
- A canvas-to-code port. `design/tools/port-term-cards.js` already goes that way.

## Steps

1. Find the frames the change touches from the "Built in the prototype" table in `design/HANDOFF.md`, then grep `design/canvas/*.dc.html` for the class, colour, number or string that changed.
2. Decide where it goes. By default the frames are redrawn. Only when the code differs because of a limit of the build, not a design call, add one line to "Where the build differs from the canvas" in HANDOFF and leave the frames as they are.
3. Edit only the affected parts of the `.dc.html` files. Take values from the code, not memory. Keep every frame readable with animation off (see "What the canvas does not cover" in HANDOFF). For a face, use `design/tools/faces.js`.
4. Update that frame's entry in HANDOFF in place with a short dated note of what changed. Change the `canvas.json` label only if its text is now wrong.
5. Publish once, at the end of the task, not after each edit, using the steps under "Publishing" in HANDOFF, and read the live page back to confirm the files match. To check a frame by eye, use the `browser-check` skill.
6. Say it in one line in the reply, for example "Canvas: 5.2 and 5.3 updated to the drawn hit line, published." It needs no DECISIONS entry and is not a STATE sync.

If you stop before publishing, or publishing fails, say plainly that the canvas still shows the old version.
