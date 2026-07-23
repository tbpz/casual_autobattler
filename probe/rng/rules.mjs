// ─────────────────────────────────────────────────────────────────────────────
// RNG-ONLY PROBE — shared engine + token library. Source of truth for toy.mjs.
//
// play.html duplicates this by hand (ES module imports are unreliable over
// file://) — if you change token rules here, port the same change into the
// inline <script> in play.html (LIB, mulberry32, resolve/resolveWithSteps).
//
// This is ARM 2 of 3 in the three-arm fun probe (STATE.md "Next up" step 2).
// Arm 1 (probe/emergence/) was strictly deterministic — zero randomness,
// surprise came only from tokens reacting to each other. Its result (DECISIONS
// 2026-07-22): genuine lean-in, plus a structural ceiling — a solved
// deterministic build stays solved forever, so replay value collapses no
// matter how tokens are rebalanced.
//
// This arm is the deliberate mirror: STRICT LUCK-ONLY. Every token rolls its
// own dice and pays out to ONLY ITS OWN chip contribution. No token ever
// reacts to another token's roll, no shared multiplier, no event queue —
// score is just the sum of independent per-unit payouts. That's a design
// constraint, not a simplification: the moment a proc triggers ANOTHER
// token's ability, you're building arm 3 (RNG-triggers-emergence) by
// accident, and the three-arm comparison stops being clean. Confirmed with
// the user 2026-07-24.
//
// Predicted failure mode this arm exists to expose (the mirror of arm 1's
// solved-forever): independent rolls re-roll every replay, so this should
// NOT go stale the way emergence did — but pure luck risks feeling
// unattributable ("the dice did it, not me" — fails the shared moment's
// "claim as mine" clause) and ceiling-less (a better build barely moves the
// outcome — a slot machine). The explore harness below exists to check that
// felt failure against real structure, exactly as emergence's burnout was
// checked against its diversity stats before being trusted as a verdict.
// ─────────────────────────────────────────────────────────────────────────────

export const SLOTS = 5; // hard row cap — pool below is intentionally bigger.

// Standard mulberry32 PRNG — deterministic given a seed, so a `play` trace is
// reproducible, but "play again" draws a fresh seed and re-rolls. This one
// property (same setup → DIFFERENT number every time) is exactly what arm 1
// structurally could never do.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Each token: roll(rng) fires once when its slot is reached, left to right.
// It touches ONLY its own contribution — no shared state, no reading what
// another token did, no emitting anything another token can hear. That's the
// whole difference from rules.mjs in probe/emergence/.
export const LIB = {
  F: { name: "Footman",   short: "Guaranteed +6. Zero variance — the safe floor.",
       roll(rng) { return { amount: 6, jackpot: false, detail: "guaranteed +6" }; } },
  C: { name: "Conscript", short: "Guaranteed +3, plus 20% chance of +5 more.",
       roll(rng) {
         const bonus = rng() < 0.20;
         const amount = 3 + (bonus ? 5 : 0);
         return { amount, jackpot: false, detail: bonus ? "+3 base, bonus hit → +5 more" : "+3 base, no bonus" };
       } },
  G: { name: "Gambler",   short: "35% chance of +24, otherwise nothing.",
       roll(rng) {
         const hit = rng() < 0.35;
         return { amount: hit ? 24 : 0, jackpot: false, detail: hit ? "HIT → +24" : "miss → +0" };
       } },
  B: { name: "Berserker", short: "3 independent swings, each 50% for +4.",
       roll(rng) {
         let amount = 0, hits = 0;
         for (let i = 0; i < 3; i++) if (rng() < 0.5) { amount += 4; hits++; }
         return { amount, jackpot: false, detail: `${hits}/3 swings connected → +${amount}` };
       } },
  U: { name: "Duelist",   short: "+8 base, 25% crit triples it to +24.",
       roll(rng) {
         const crit = rng() < 0.25;
         const amount = crit ? 24 : 8;
         return { amount, jackpot: false, detail: crit ? "CRIT → 8×3 = +24" : "+8, no crit" };
       } },
  M: { name: "Marksman",  short: "15% chance of a +40 jackpot, otherwise +2.",
       roll(rng) {
         const jackpot = rng() < 0.15;
         return { amount: jackpot ? 40 : 2, jackpot, detail: jackpot ? "JACKPOT → +40" : "+2, no jackpot" };
       } },
  Z: { name: "Zealot",    short: "50% chance of +5 AND rolling again (capped at 6 rolls).",
       roll(rng) {
         let amount = 0, rolls = 0;
         while (rolls < 6 && rng() < 0.5) { amount += 5; rolls++; }
         return { amount, jackpot: rolls >= 5, detail: rolls ? `chained ${rolls}x → +${amount}` : "no chain, +0" };
       } },
  K: { name: "Assassin",  short: "10% chance of a +60 crit, otherwise +1.",
       roll(rng) {
         const crit = rng() < 0.10;
         return { amount: crit ? 60 : 1, jackpot: crit, detail: crit ? "CRIT → +60" : "+1, no crit" };
       } },
};
export const ALPHABET = Object.keys(LIB);

// ── engine ───────────────────────────────────────────────────────────────────
// Note the shape difference from emergence's resolve(): no queue, no pump, no
// event consumption. Each unit rolls once, in order, against the SAME seeded
// stream (so the whole run is reproducible from one seed) — but never reads
// or writes anything another unit touched.
export function resolve(ids, seed, { trace = false } = {}) {
  const rng = mulberry32(seed >>> 0);
  const log = [];
  const perUnit = [];
  let score = 0;
  let jackpots = 0;
  for (const id of ids) {
    const def = LIB[id];
    const r = def.roll(rng);
    score += r.amount;
    if (r.jackpot) jackpots++;
    perUnit.push({ id, name: def.name, amount: r.amount, jackpot: r.jackpot, detail: r.detail });
    if (trace) log.push(`${id} (${def.name}): ${r.detail}  → running total ${score}`);
  }
  return { score, perUnit, jackpots, seed, log };
}
