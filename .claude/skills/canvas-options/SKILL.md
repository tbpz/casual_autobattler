---
name: canvas-options
description: Draw the options of a UI, animation or interaction choice as separate screens on the design canvas for Tu to review, instead of asking him questions. Use whenever a look, motion, timing, layout, tap or screen-flow choice has two or more sensible options. Not for rules, numbers or code structure.
---

# Drawing options on the canvas

Tu decides UI, animation and interaction by looking, not by reading a question. The precedent is
frame 5.8 (2026-10-16): six looping phones, A today and B to F the options, over the same slam;
he picked F. Do that instead of asking.

## Steps

1. **One artboard per option.** Each option is its own full phone screen: its own `.dc.html` file in
   `design/canvas/` and its own artboard in `canvas.json`. Label each with a letter and one line saying
   what differs. If the thing exists today, option A is today's look. Every option shows the **same
   scene**, so only the option varies. Take values from the code, not memory. Faces from
   `design/tools/faces.js`.
2. **Numbering and placement.** The set takes the next free number in the section it would change,
   with letters (`5.8A`, `5.8B`), in a row next to the frames it would change. Never edit the real
   frames to show an option.
3. **Motion.** An animation option is a looping CSS animation and must also read with animation off:
   the base style is a still of its key moment (the editor freezes animation; see "What the canvas does
   not cover" in HANDOFF). Tu sees motion in the Interact tool, which animates up to 10 artboards at
   once, so keep a set to 10 or fewer.
4. **HANDOFF.** Add one entry for the set: what the choice is, what each letter shows, marked
   "options, awaiting Tu's pick".
5. **Publish** with the steps under "Publishing" in HANDOFF, read the live page back, then reply in
   one line, for example "Canvas: 5.8A–F, six slam finishes, published. Pick one, or a mix." Then
   stop. Do not build or pick one yourself.
6. **After the pick:** redraw the chosen option into the real frames (and build it if asked), remove
   the option artboards from the canvas and `canvas.json`, record them under "Dropped frames" in
   HANDOFF (as 5.8 was), publish, and offer to log the decision per the DECISION protocol.

If you stop before publishing, say plainly that the canvas does not show the options yet.
