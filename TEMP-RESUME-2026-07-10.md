# Temporary resume file — OQ-1 / OQ-2 discussion (2026-07-10)

> **This is a scratch file, not part of the STATE/DECISIONS system.** Nothing here is confirmed —
> no entries have been logged to DECISIONS.md yet. Delete this file once the discussion below
> either gets confirmed (log to DECISIONS.md + sync STATE.md) or gets superseded.
>
> Purpose: resume this exact conversation thread on another device.

---

## Where we left off

Working through STATE.md's open questions OQ-1 and OQ-2, with OQ-5 (solver vs. spectacle) surfacing
as the real fork underneath both. **Nothing below is settled** — this is the live argument, not a
conclusion.

## Round 1 — my initial challenge to your OQ-1/OQ-2 answers

**Your answers going in:**
- OQ-1: Offense — an attacking squad actively fighting.
- OQ-2: All of them — upgrade heroes, add new heroes, AND add non-hero support.

**My pushback:**
- OQ-1 "offense" hides an unresolved fork: squad-vs-fortified-enemy vs. squad-vs-squad (symmetric).
  These have different spatial layouts.
- Offense strains positioning-as-decision (OQ-6) and attribution (OQ-7) — a mobile brawl swirls,
  harder to point at "why I won."
- "All of them" for OQ-2 dissolves the question — it was meant to *constrain* the roguelike-variety
  engine, not host three parallel systems (hero upgrade / roster / base-building).
- "Add new hero" contradicts the settled "5 fixed individuals" decision (2026-07-04).
- "Non-hero support" risks reopening OQ-1 by sneaking base/kingdom framing back in.
- Flagged the real tension: offense (lean, mobile squad) vs. all-of-OQ-2 (sprawling base+roster)
  fight each other structurally.

## Round 2 — your answers to the pushback

- **OQ-1: squad vs. squad**, resolved. Framed as medieval-war-style: frontline tanks, backline
  archers, mobility knights flanking from the side.
- Positioning still matters — compared explicitly to **TFT's positioning**.
- Attribution isn't the problem — the objective can just be "I won because I defeated all enemies."
- Watchability isn't an issue — no long march needed, two squads just meet in the middle of a
  terrain.
- **OQ-2: confirmed "the good way"** (draft offers, one choice per round — not parallel systems).
- "Add new hero" doesn't contradict 5-fixed-individuals: the **slots** are fixed, the **characters**
  filling them can change round to round — "drafting the suitable one to win the round is like a
  chess match."
- "Non-hero support" reopening OQ-1 — disagreed: if terrain/environment matters to two squads
  meeting on a battlefield, that's still fine, not base-building.

## Round 3 — my second-pass challenge (where we are now)

**Conceded (these hold up):**
- Camera/arena: two squads meeting on contained terrain, no march — fine, not a watchability problem.
- Terrain-as-variance is genuinely good — mobile-compatible, doesn't sneak in a base, feeds OQ-8/OQ-10.
- Squad vs. squad as the resolved frame for OQ-1 — accepted.

**The crack that's still open — this is the live thread to pick back up:**

> Every rebuttal (TFT-style positioning, chess-match drafting, role-based frontline/backline/flank)
> reaches for **pre-fight optimization** logic. Stacked together they reconstruct TFT's fun
> (economy/optimization), which was explicitly dropped as a reference on 2026-07-04 — only its
> *synergy* concept was kept, not its solver framing.

Three concrete consequences raised, unresolved:

1. **Spectacle risk (Pillar 2):** if comp + counter-draft + positioning are all optimized pre-fight,
   the winner is largely decided before the fight starts. Watching becomes confirmation, not
   suspense.
2. **Positioning-legibility vs. chaos are the same slider:** TFT-style positioning payoff needs
   *clean* combat to read; "chaotic, destructive" combat (the settled 2026-07-04 decision) undercuts
   that same legibility. Can't max both.
3. **Heroes Charge trap risk:** if the fight is mostly won at setup, the mid-fight ultimate-timing
   decision — the designated mastery lever — becomes decoration, and mastery migrates entirely into
   the pre-fight solve. This is the exact cautionary tale already named in STATE.md re: Heroes Charge
   / Dota Legends.

Also raised: "I won because I defeated all enemies" answers the **win condition**, not
**attribution**. Attribution's real question is "can the player credit the mid-fight decision, or
did setup already decide the outcome before the ultimate ever fired?" — not "did the player know
they won."

**On the chess-match/swap-roster idea specifically:**
- Collides with the run-long build-up spine: build-up can't stick to a hero who gets benched/swapped
  round to round. Either build-up attaches to **roles/slots** (= archetypes, already dropped) or gets
  discarded on swap (= breaks the build-up→ultimate-charge spine).
- Suggested reconciliation (not yet agreed): FM-style model — a **growing bench of heroes that
  persist** (build-up sticks per-hero across the run), and each round you **field the right 5** from
  the bench for the matchup. Keeps chess-drafting AND build-up AND attachment, but this is *not*
  "5 fixed" anymore — it's a bench/roster, which is bigger scope and needs its own answer for where
  new heroes come from. **Not decided.**

## The open fork to resume on — OQ-5, sharpened

**Is the fight decided at setup (solve), or in the watching (spectacle)?** Both rounds of answers
kept reaching for solver tools (TFT positioning, counter-drafting, role comps) while defending
spectacle-leaning pillars. That contradiction hasn't been resolved yet — it needs a explicit call:

- **Solver-leaning:** setup (draft + counter-pick + position) decides ~80% of the outcome; chaos is
  garnish; ultimate is a tiebreaker. Honest and shippable, but Pillar 2 ("the spectacle IS the game")
  becomes marketing framing, not a mechanical truth — would need to be renegotiated.
- **Spectacle-leaning:** chaos keeps the outcome live until the end; the mid-fight ultimate is where
  the player *seizes* a swinging fight; pre-fight setup is *influence that tilts odds*, not a solve
  that pre-computes the winner. Positioning becomes a soft lean, not a TFT-style precise solution.

My read going in: the pillars point spectacle-leaning, but the concrete mechanic proposals
(TFT positioning, chess-drafting) keep pulling solver-leaning — worth naming directly which one you
actually want, since right now the answers are trying to have both.

**Next question to pick up when resuming:** *Where do you actually want the fight decided — at
setup, or in the watching?* Everything downstream (how hard positioning bites, how strong chaos
needs to be, what the ultimate is actually for, whether the bench/roster idea is worth its added
scope) hangs off that answer.

---

## Reminder for whoever resumes this

- Nothing in this file has been logged to DECISIONS.md. If/when a call gets made on OQ-5 (and by
  extension OQ-1/OQ-2), follow the normal protocol: surface it as a decision, get explicit
  confirmation, then log it to DECISIONS.md (dated, top of file) — do not touch STATE.md until the
  user explicitly asks to sync.
- Delete this file once superseded by a real DECISIONS.md entry (or a STATE.md sync).
