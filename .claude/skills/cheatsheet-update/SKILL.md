---
name: cheatsheet-update
description: Update CHEATSHEET.md in the same change as any edit to a card, relic, mark, duo or role ability rule or number. Use whenever CLAUDE.md's "Keeping CHEATSHEET.md current" triggers fire. No need to ask first.
---

# Updating CHEATSHEET.md

`CHEATSHEET.md` lists the current rules and numbers of every mark, relic, card, duo and role ability, one line each. It is copied from the code and is never the source of truth, so it must follow the code in the same change.

## What counts as a trigger

- A constant in `prototype/src/sim/config.ts` that a mark, relic, card, duo or chain ability uses.
- A definition in `prototype/src/sim/cards/defs/`.
- The relic, upgrade or offer-gate rules in `sim/relics.ts`, `sim/roles.ts`, `sim/cards/index.ts`.
- A card, relic, mark or ability added, removed or renamed.

## Steps

1. Edit only the affected lines. Keep the shape: bullets, one rule per line, no explanation, no context, no history.
2. Take values from the code, not memory. Check derived numbers (e.g. 3 burn × 5 = 15).
3. Set the `Last updated` line to the current date and time (`date +"%Y-%m-%d %H:%M"`).
4. Say it in one line in the reply. It needs no DECISIONS entry and is not a STATE sync.
