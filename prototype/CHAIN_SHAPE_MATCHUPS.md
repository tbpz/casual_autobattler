# Chain shape — the intended matchup table

Written 2026-08-27, from a session reconstructing *what the shape design was supposed to do*.
Companion to `CHAIN_SHAPE_LEVERAGE_FINDINGS.md` (which holds the measurement that says it
doesn't). This file holds the design intent in one place so the next lever pass can check a
candidate against a concrete list instead of against "shape should matter."

Not a decision record — nothing here is logged in `DECISIONS.md`. It is the theory, written down.

## The mechanic that drives the table

A chain hit always strikes the **front-most living enemy**, and **overkill is wasted**
(`sim/fight.ts`'s `resolveChainHit` → `frontMostAliveId`, damage clamped by `applyDamageFrom`).
A 60-damage hit into a 40 HP grunt throws away 20.

That is the whole reason "many small bodies" vs. "one big body" was expected to be a real axis
for shape: long/flat chains clear a crowd efficiently, short/steep chains want one fat health bar.

## The six picks

| Hero | Shape | Chain behaviour |
|---|---|---|
| **Bracer** (tank) | long fuse, flat | ~10 hits, all similar size |
| **Hollow** (tank) | short fuse, steep | 3 hits, each ~5x the last |
| **Rook** (damage) | long fuse, back-loaded | 9 hits, nothing much until hit 5, then it explodes |
| **Vex** (damage) | short fuse, front-loaded | 4 modest hits, no big finish |
| **Cairn** (support) | steady heal | long, even, safest — lowest backfire risk |
| **Ward** (support) | hybrid heal | longest fuse, but riskiest — highest backfire chance |

Source: `sim/heroes.ts`'s `CHAIN_PROFILES`. All six converge on the same expected net value
within their kind (`CHAIN_EV_TARGET_DAMAGE` / `CHAIN_EV_TARGET_HEAL`) — only timing differs.

## The intended answer per enemy

| Enemy | What it does | The shape that should answer it | Why |
|---|---|---|---|
| **Pack** (early) | 5 grunts, 48 HP each | **Bracer** — long, flat | Ten medium hits clear five bodies. A steep chain dumps a huge number into one 48 HP grunt and wastes most of it. |
| **The Wall** (early) | One 310 HP body, nothing else | **Rook** — back-loaded | One target means zero overkill. There's a fat health bar to pour the late explosion into. Nothing rushes you. |
| **Anvil** (early) | One 420 HP body, no telegraph at all | **Rook** — back-loaded | The purest version of Wall's question. No wind-up means no danger, so the long build is free. This is the fight where "slow is fine" is supposed to be obvious. |
| **Twins** (mid) | Two 150 HP bodies, spikes offset | **Hollow** — short, steep | Kill one fast and you halve the incoming spikes. A slow chain lets both keep firing. Speed is worth more than total damage here. |
| **Executioner** (mid) | Hunts your lowest-HP hero, ignores your tank | **Cairn** fielded, plus a fast finish | Your squishy is the target no matter what you do, so you need the steady heal keeping them topped up while something else ends the fight. |
| **Ambush** (mid) | 4 fast, fragile raiders (40 HP, hitting every 0.6s) | **Bracer** — long, flat | Same logic as Pack, but urgent — incoming damage is heavy, so you need bodies cleared quickly *and* efficiently. Overkill you can't afford. |
| **Duelist** (mid) | One body, wind-up fires twice as often | **Hollow** — short, steep | Every extra second is another spike. The chain that ends the fight soonest wins; a chain that pays on hit 9 pays after you're already hurt. |
| **Warden** (mid) | Heals itself 6 per beat | **Hollow** — short, steep | The textbook burst check. Spread your damage thin and it just heals it back. You need it dead in one burst. The clearest intended shape matchup in the pool. |
| **Glass Pair** (mid) | Two 90 HP bodies hitting for 14 | **Hollow** or **Vex** — short | 90 HP dies to one steep chain. Removing one immediately halves the incoming damage. The most punishing fight to be slow in. |
| **Champion** (finale) | 230 HP body + two 62 HP guards | **Vex** — front-loaded | Mixed bodies. You need to clear the guards without wasting damage, then keep pressure on the big one. |
| **Vanguard** (finale) | 240 HP body + 3 fast outriders, hunts your weakest | **Bracer** + **Cairn** | Executioner and Ambush at once. Clear the outriders efficiently while the heal keeps your squishy off the bottom of the list. |

Source for enemy stats: `sim/encounters.ts`'s `ENCOUNTERS`.

## What the measurement said

Only **one** of the eleven survived. Champion showed a real 12-point edge for front-loaded over
short-fuse-steep (49.8% vs 37.8%). The other ten were flat — under 5 points across all four
attacker shapes. See `CHAIN_SHAPE_LEVERAGE_FINDINGS.md`, Block 3.

The two that hurt most are **Warden** and **Glass Pair**. Those are the fights the design leaned
on hardest — Warden's entire existence is "burst or lose," Glass Pair's is "kill fast or bleed."
If shape mattered anywhere it should have shown there.

Working explanation (option C in the findings file, still unverified): fights 1–4 are near-100%
wins for any sensible draft, so Warden and Glass Pair are won regardless of what you bring. The
question is real on paper; you are never in enough danger for the wrong answer to cost anything.

## How to use this file

When a replacement lever for shape is proposed, walk it down the table and ask which rows it
would move. A lever that only lights up Champion is the status quo. A lever that makes Warden,
Glass Pair, and Duelist punish the slow shapes is the one worth building.
