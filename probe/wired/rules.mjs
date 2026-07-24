// ─────────────────────────────────────────────────────────────────────────────
// WIRED PROBE — shared engine + token library. Source of truth for toy.mjs.
//
// The browser side (play.html, layers.html) gets its own mirror of this file
// at ../shared/wired-engine.js (ES module imports are unreliable over
// file://, so it can't just import this directly) — if you change a token
// rule here, port the same change there. guided.html still keeps its own
// separate inline copy (LIB, mulberry32, add/emit/pump, resolveWithSteps) —
// port there too if you touch it.
//
// This is ARM 3 of 3 in the three-arm fun probe (STATE.md "Next up" step 2) —
// the actual bet, not another isolated arm. Arm 1 (probe/emergence/) was pure
// deterministic reactor chains: real lean-in, but a solved build stays solved
// forever (DECISIONS 2026-07-22). Arm 2 (probe/rng/) was pure independent
// dice: real jackpot-chase, but non-renewing — collapses once "pick the
// biggest pieces" is solved and only chance is left (DECISIONS 2026-07-24).
//
// The 2026-07-20 "division of labor" decision is the wiring diagram this file
// implements literally: **RNG decides *when/whether* a cascade fires — a
// TRIGGER token rolls dice on its own turn and *maybe* shouts an event.
// Emergent combination decides *what the cascade becomes* — an AMPLIFIER
// token is a deterministic reactor (arm 1's exact on[event] shape) that hears
// the event and pays out / chains further. Same event, both engines. This is
// NOT arm 1 and arm 2 running side by side (a bolt-on) — it's arm 1's engine
// with arm 2's dice as its only event source, so the depth of the amplifier
// chain you build is what a lucky roll gets to multiply into.
//
// TRIGGERS (roll dice on their turn — the floor, the friend's half):
//   F Footman   — guaranteed +5 chips, no roll. The safe floor.
//   G Gambler   — 40% chance: shout SPARK.
//   B Berserker — 3 independent 50% swings; each hit shouts its own SPARK.
//   M Marksman  — 15% chance: shout SURGE (the jackpot fire). Else +2 chips.
//   U Duelist   — shouts SPARK; 25% of the time, upgrades that to a SURGE.
//
// AMPLIFIERS (deterministic reactors — the ceiling, Tu's half):
//   D Drummer        — ON spark: echoes another SPARK (max 3 echoes).
//   O Cadence        — ON every 2nd spark heard: shouts SURGE.
//   P Powdermaster   — ON surge: +14 chips.
//   W Warlord        — ON surge: +1 mult (the runaway lever).
//   S StandardBearer — ON spark: +1 chip.
//   I Interceptor    — ON surge: +10 chips AND consumes it — later reactors miss it.
//   A Alchemist      — TURN: burns all current chips → +1 mult per 12 burned.
//
// A trigger with no amplifier behind it fires into an empty room — the roll
// happened but nothing converts it. An amplifier with no trigger feeding it
// never wakes up. The bet is that engineering *both halves together* is what
// produces "I set it up, luck fired it, it ran away past what I planned."
// ─────────────────────────────────────────────────────────────────────────────

export const BUDGET = 2000; // event safety cap.
export const SLOTS = 5;     // hard row cap — pool below is intentionally bigger.

// Standard mulberry32 PRNG (same as probe/rng/rules.mjs) — deterministic given
// a seed, so a `play` trace is reproducible, but "play again" draws a fresh
// seed and re-rolls every trigger.
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

// Each token: sweep(s, t, rng) runs once when reached left-to-right (its
// "turn") — triggers use rng to decide whether/what to shout; amplifiers have
// no sweep (or a non-rolling one, e.g. Alchemist). on[event](s, t) reacts
// whenever that event is shouted, deterministically — returning `true`
// CONSUMES the event, so reactors later in row order never see it.
export const LIB = {
  F: { name: "Footman",        role: "trigger",   short: "TURN: guaranteed +5 chips. No roll — the safe floor.",
       sweep: (s) => add(s, "chips", 5) },
  G: { name: "Gambler",        role: "trigger",   short: "TURN: 40% chance → shouts SPARK.",
       sweep: (s, t, rng) => { if (rng() < 0.40) emit(s, "spark", t); } },
  B: { name: "Berserker",      role: "trigger",   short: "TURN: 3 independent 50% swings, each a separate SPARK.",
       sweep: (s, t, rng) => { for (let i = 0; i < 3; i++) if (rng() < 0.50) emit(s, "spark", t); } },
  M: { name: "Marksman",       role: "trigger",   short: "TURN: 15% chance → shouts SURGE (the jackpot fire). Else +2 chips.",
       sweep: (s, t, rng) => { if (rng() < 0.15) emit(s, "surge", t); else add(s, "chips", 2); } },
  U: { name: "Duelist",        role: "trigger",   short: "TURN: shouts SPARK; 25% of the time upgrades it to a SURGE instead.",
       sweep: (s, t, rng) => { emit(s, rng() < 0.25 ? "surge" : "spark", t); } },
  D: { name: "Drummer",        role: "amplifier", short: "ON spark: echoes another SPARK (max 3 echoes).",
       on: { spark: (s, t) => { if (t.count < 3) { t.count++; emit(s, "spark", t); } } } },
  O: { name: "Cadence",        role: "amplifier", short: "Counts sparks heard. ON every 2nd: shouts SURGE.",
       on: { spark: (s, t) => { t.count++; if (t.count >= 2) { t.count = 0; emit(s, "surge", t); } } } },
  P: { name: "Powdermaster",   role: "amplifier", short: "ON surge: +14 chips.",
       on: { surge: (s) => add(s, "chips", 14) } },
  W: { name: "Warlord",        role: "amplifier", short: "ON surge: +2 mult. The runaway lever.",
       on: { surge: (s) => add(s, "mult", 2) } },
  S: { name: "StandardBearer", role: "amplifier", short: "ON spark: +1 chip.",
       on: { spark: (s) => add(s, "chips", 1) } },
  I: { name: "Interceptor",    role: "amplifier", short: "ON surge: +10 chips AND consumes it — later reactors miss it.",
       on: { surge: (s) => { add(s, "chips", 10); return true; } } },
  A: { name: "Alchemist",      role: "amplifier", short: "TURN: burns all current chips → +1 mult per 12 burned.",
       sweep: (s) => { const bonus = Math.floor(s.chips / 12); s.chips = 0; add(s, "mult", bonus); } },
};
export const ALPHABET = Object.keys(LIB);

// ── engine ───────────────────────────────────────────────────────────────────
export function add(s, key, n) {
  if (!n) return;
  s[key] += n;
  if (s.trace) s.log.push(`      ${key} += ${n}  → chips=${s.chips} mult=${s.mult}`);
}
export function emit(s, type, source) {
  s.queue.push({ type, source });
}
export function pump(s, row) {
  while (s.queue.length && s.events < BUDGET) {
    const ev = s.queue.shift();
    s.events++;
    if (ev.type === "surge") s.surges++;
    if (s.trace) s.log.push(`  • event '${ev.type}' (from ${ev.source.def.name})`);
    for (const t of row) {
      const h = t.def.on && t.def.on[ev.type];
      if (h) {
        const consumed = h(s, t, ev);
        if (s.trace && consumed) s.log.push(`      ↳ ${t.id} consumed the ${ev.type} — later reactors miss it`);
        if (consumed) break;
      }
    }
  }
}
export function resolve(ids, seed, { trace = false } = {}) {
  const rng = mulberry32(seed >>> 0);
  const row = ids.map((id, i) => ({ id, def: LIB[id], idx: i, count: 0 }));
  const s = { chips: 0, mult: 1, events: 0, surges: 0, queue: [], log: [], trace };
  for (const t of row) {
    if (t.def.sweep) {
      if (s.trace) s.log.push(`SWEEP ${t.id} (${t.def.name})`);
      t.def.sweep(s, t, rng);
    }
    pump(s, row);
  }
  pump(s, row); // final drain
  const ignited = s.events >= BUDGET;
  return { score: s.chips * s.mult, chips: s.chips, mult: s.mult, ignited, events: s.events, surges: s.surges, seed, log: s.log };
}
