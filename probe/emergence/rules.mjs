// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCE PROBE — shared engine + token library. Source of truth for toy.mjs.
//
// play.html duplicates this by hand (ES module imports are unreliable over
// file://) — if you change token rules here, port the same change into the
// inline <script> in play.html (LIB, add, pump/drain, resolve/resolveWithSteps).
//
// v2 (2026-07-21): rewritten after the v1 probe converged — "add every token
// that fits" was always the best move (8 slots, 11 free/additive tokens, no
// cost). Runaway factor among informed (all-engine) builds was ~2.3x, i.e.
// flat. Fix: real scarcity (5 slots, 15 tokens) + tokens with COST/anti-synergy
// (Alchemist, Interceptor, Tyrant, Vanguard) so "include everything" is
// impossible and "include the obvious engine" is not automatically best.
// Executioner's old chip-threshold escalation (which re-homogenized every
// full build toward the same ceiling) is replaced with a flat charge limit —
// bounded per-instance, but no longer a governor that converges all builds.
// ─────────────────────────────────────────────────────────────────────────────

export const BUDGET = 2000; // event safety cap — with per-token charge limits
                             // now in place, this should rarely if ever trip.
export const SLOTS = 5;     // hard row cap — pool below is intentionally bigger.

// Each token: sweep(s,t) runs once when reached left-to-right (its "turn").
// on[event](s,t,ev) reacts whenever that event is shouted; returning `true`
// CONSUMES the event, so reactors later in row order never see it — this is
// the anti-synergy primitive (two reactors can compete for the same event).
export const LIB = {
  F: { name: "Footman",        short: "TURN: +5 chips.",
       sweep: (s) => add(s, "chips", 5) },
  B: { name: "Berserker",      short: "TURN: shouts HIT.  ON hit: +3 chips.",
       sweep: (s, t) => emit(s, "hit", t),
       on: { hit: (s) => add(s, "chips", 3) } },
  D: { name: "Drummer",        short: "ON hit: echoes another HIT (max 3x).",
       on: { hit: (s, t) => { if (t.count < 3) { t.count++; emit(s, "hit", t); } } } },
  M: { name: "Marksman",       short: "ON every 2nd hit heard: shouts CRIT.",
       on: { hit: (s, t) => { t.count++; if (t.count >= 2) { t.count = 0; emit(s, "crit", t); } } } },
  U: { name: "Duelist",        short: "TURN: shouts CRIT.  ON crit: +12 chips.",
       sweep: (s, t) => emit(s, "crit", t),
       on: { crit: (s) => add(s, "chips", 12) } },
  W: { name: "Warlord",        short: "ON crit: +1 mult.",
       on: { crit: (s) => add(s, "mult", 1) } },
  S: { name: "StandardBearer", short: "ON kill: +2 mult.",
       on: { kill: (s) => add(s, "mult", 2) } },
  X: { name: "Executioner",    short: "ON crit: shouts KILL. Only has 2 charges — then it's spent.",
       on: { crit: (s, t) => { if (t.charges > 0) { t.charges--; emit(s, "kill", t); } } } },
  Z: { name: "Zealot",         short: "ON kill: shouts CRIT.",
       on: { kill: (s, t) => emit(s, "crit", t) } },
  Q: { name: "Quartermaster",  short: "TURN: +2 chips per token already gone before it.",
       sweep: (s, t) => add(s, "chips", 2 * t.leftFired) },
  O: { name: "Oracle",         short: "Counts hits heard. TURN: +mult per 3 heard.",
       on: { hit: (s, t) => { t.count++; } },
       sweep: (s, t) => add(s, "mult", Math.floor(t.count / 3)) },
  A: { name: "Alchemist",      short: "TURN: burns ALL current chips → +1 mult per 10 burned.",
       sweep: (s) => { const bonus = Math.floor(s.chips / 10); s.chips = 0; add(s, "mult", bonus); } },
  I: { name: "Interceptor",    short: "ON crit: +8 chips AND consumes the crit — later reactors miss it.",
       on: { crit: (s) => { add(s, "chips", 8); return true; } } },
  T: { name: "Tyrant",         short: "TURN: +30 chips, but caps mult at 3 for the rest of the run (retroactively).",
       sweep: (s) => { s.multCap = Math.min(s.multCap ?? Infinity, 3); if (s.mult > s.multCap) s.mult = s.multCap; add(s, "chips", 30); } },
  V: { name: "Vanguard",       short: "TURN: only if in slot 1 — then shouts CRIT twice (no chips). Dead card anywhere else.",
       sweep: (s, t) => { if (t.idx === 0) { emit(s, "crit", t); emit(s, "crit", t); } } },
};
export const ALPHABET = Object.keys(LIB);

// Known imbalance (not fixed — this is a disposable probe, not a shipped
// balance target): Alchemist and Tyrant rarely appear in top-decile builds
// under `explore` — a one-shot chip→mult conversion structurally can't keep
// up with the repeating crit/kill/mult loop. Fine for the current pass/fail
// bar; would need real tuning if this probe outlives its purpose.

// ── engine ───────────────────────────────────────────────────────────────────
export function add(s, key, n) {
  if (!n) return;
  if (key === "mult" && s.multCap != null) {
    s.mult = Math.min(s.mult + n, s.multCap);
  } else {
    s[key] += n;
  }
  if (s.trace) s.log.push(`      ${key} += ${n}  → chips=${s.chips} mult=${s.mult}`);
}
export function emit(s, type, source) {
  s.queue.push({ type, source });
}
export function pump(s, row) {
  while (s.queue.length && s.events < BUDGET) {
    const ev = s.queue.shift();
    s.events++;
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
export function resolve(ids, { trace = false } = {}) {
  const row = ids.map((id, i) => ({ id, def: LIB[id], idx: i, count: 0, leftFired: 0, charges: 2 }));
  const s = { chips: 0, mult: 1, events: 0, queue: [], log: [], trace, multCap: null };
  let firedSoFar = 0;
  for (const t of row) {
    t.leftFired = firedSoFar; // Quartermaster reads this at sweep time
    if (t.def.sweep) {
      if (s.trace) s.log.push(`SWEEP ${t.id} (${t.def.name})`);
      t.def.sweep(s, t);
    }
    firedSoFar++;
    pump(s, row);
  }
  pump(s, row); // final drain
  const ignited = s.events >= BUDGET;
  return { score: s.chips * s.mult, chips: s.chips, mult: s.mult, ignited, events: s.events, log: s.log };
}
