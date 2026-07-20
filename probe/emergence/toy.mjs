// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCE PROBE — disposable, ugly on purpose. Do not build on this.
//
// Question it exists to answer (from STATE.md "Next up", arm 1 of 3):
//   Can a DETERMINISTIC token-chain engine produce a payoff that "runs away past
//   what I planned" — a total its own author can't easily predict? (Balatro-depth.)
//   If no, the emergence arm is dead and RNG won't save it. Learn it in an afternoon.
//
// This is the EMERGENCE-ONLY arm: zero randomness. Every run of the same setup
// gives the same number. Surprise, if any, comes purely from tokens interacting.
//
// Run it:
//   node probe/emergence/toy.mjs                 # demo setups + cascade logs
//   node probe/emergence/toy.mjs play F B Q U W X Z S   # watch one cascade
//   node probe/emergence/toy.mjs explore 6 200000       # does anything run away?
//
// The "moment" test (do this by hand): pick a setup, PREDICT the score out loud,
// then run `play` and see how wrong you were. If you're always right, it's flat.
// ─────────────────────────────────────────────────────────────────────────────

const BUDGET = 2000; // event cap; hitting it = an ignited, self-sustaining cascade

// Each token: sweep(s,t) runs once when reached left-to-right; on[event](s,t) reacts.
// Effects mutate shared state (chips, mult) and/or emit events that other tokens
// react to → cascades. Score = chips * mult (order & composition matter a lot).
const LIB = {
  F: { name: "Footman",       sweep: (s) => add(s, "chips", 5) },
  B: { name: "Berserker",     sweep: (s, t) => emit(s, "hit", t),
                               on: { hit: (s) => add(s, "chips", 3) } },
  D: { name: "Drummer",       on: { hit: (s, t) => { if (t.count < 3) { t.count++; emit(s, "hit", t); } } } },
  M: { name: "Marksman",      on: { hit: (s, t) => { t.count++; if (t.count >= 2) { t.count = 0; emit(s, "crit", t); } } } }, // 2nd path to crit, no Duelist needed
  U: { name: "Duelist",       sweep: (s, t) => emit(s, "crit", t),
                               on: { crit: (s) => add(s, "chips", 12) } },
  W: { name: "Warlord",       on: { crit: (s) => add(s, "mult", 1) } },
  S: { name: "StandardBearer",on: { kill: (s) => add(s, "mult", 2) } },
  // Threshold starts LOW (reachable) but ESCALATES every kill it causes, so the
  // crit->kill->crit loop always converges to a finite, build-dependent number
  // instead of running to the event BUDGET. This is what gives "better combos"
  // room to exist above "any combo that ignites."
  X: { name: "Executioner",   on: { crit: (s, t) => { if (s.chips >= t.threshold) { t.threshold += 20; emit(s, "kill", t); } } } },
  Z: { name: "Zealot",        on: { kill: (s, t) => emit(s, "crit", t) } },
  Q: { name: "Quartermaster", sweep: (s, t) => add(s, "chips", 2 * t.leftFired) }, // positional
  O: { name: "Oracle",        on: { hit: (s, t) => { t.count++; } },
                               sweep: (s, t) => add(s, "mult", Math.floor(t.count / 3)) }, // rewards late placement
};
const ALPHABET = Object.keys(LIB);

// ── engine ───────────────────────────────────────────────────────────────────
function add(s, key, n) {
  if (n === 0) return;
  s[key] += n;
  if (s.trace) s.log.push(`      ${key} += ${n}  → chips=${s.chips} mult=${s.mult}`);
}
function emit(s, type, source) {
  s.queue.push({ type, source });
}
function pump(s, row) {
  while (s.queue.length && s.events < BUDGET) {
    const ev = s.queue.shift();
    s.events++;
    if (s.trace) s.log.push(`  • event '${ev.type}' (from ${ev.source.def.name})`);
    for (const t of row) {
      const h = t.def.on && t.def.on[ev.type];
      if (h) h(s, t, ev);
    }
  }
}
function resolve(ids, { trace = false } = {}) {
  const row = ids.map((id) => ({ id, def: LIB[id], count: 0, leftFired: 0, threshold: 30 }));
  const s = { chips: 0, mult: 1, events: 0, queue: [], log: [], trace };
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
  return { score: s.chips * s.mult, chips: s.chips, mult: s.mult, ignited, log: s.log };
}

// ── commands ─────────────────────────────────────────────────────────────────
function play(ids) {
  const bad = ids.filter((id) => !LIB[id]);
  if (!ids.length || bad.length) {
    console.log(`unknown/empty tokens: ${bad.join(",") || "(none given)"}`);
    console.log(`tokens: ${ALPHABET.map((k) => `${k}=${LIB[k].name}`).join("  ")}`);
    return;
  }
  console.log(`\nSETUP: ${ids.map((id) => `${id}(${LIB[id].name})`).join("  ")}\n`);
  const r = resolve(ids, { trace: true });
  console.log(r.log.join("\n"));
  console.log(`\n  chips=${r.chips}  mult=${r.mult}  events=${r.events ?? ""}`);
  console.log(`  SCORE = ${r.score}${r.ignited ? "   *** IGNITED (event budget capped) ***" : ""}\n`);
}

function samplePermutation(arr, n) {
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = (Math.random() * pool.length) | 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function explore(rowLen, samples) {
  // Random setups, NO DUPLICATE tokens (each of the 5-11 individuals used at most
  // once) — matches how the row will actually be played and avoids the
  // stack-the-same-card degenerate strategy. Baseline = sum of solo scores.
  const solo = {};
  for (const id of ALPHABET) solo[id] = resolve([id]).score;
  const scores = [];
  let best = null;
  for (let i = 0; i < samples; i++) {
    const ids = samplePermutation(ALPHABET, rowLen);
    const r = resolve(ids);
    const naive = ids.reduce((a, id) => a + solo[id], 0);
    scores.push(r.score);
    if (!best || r.score > best.score) best = { ids, score: r.score, naive, ignited: r.ignited };
  }
  scores.sort((a, b) => a - b);
  const pct = (p) => scores[Math.min(scores.length - 1, (p * scores.length) | 0)];
  const median = pct(0.5);
  console.log(`\nEXPLORE  rowLen=${rowLen}  samples=${samples}`);
  console.log(`  solo scores (naive per-token): ${ALPHABET.map((k) => `${k}=${solo[k]}`).join(" ")}`);
  console.log(`  distribution:  min=${scores[0]}  median=${median}  p90=${pct(0.9)}  p99=${pct(0.99)}  max=${scores[scores.length - 1]}`);
  console.log(`  RUNAWAY FACTOR (max / median): ${median ? (scores[scores.length - 1] / median).toFixed(1) : "∞"}x`);
  console.log(`\n  best found: ${best.ids.join(" ")}`);
  console.log(`    score=${best.score}   naive-sum-of-parts=${best.naive}   emergence multiple=${best.naive ? (best.score / best.naive).toFixed(1) : "∞"}x${best.ignited ? "  (ignited)" : ""}`);
  console.log(`  → if 'emergence multiple' >> 1 and 'runaway factor' is large, the engine surprises its author.\n`);
}

// ── cli ──────────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "play") {
  play(rest.map((x) => x.toUpperCase()));
} else if (cmd === "explore") {
  explore(Number(rest[0]) || 6, Number(rest[1]) || 200000);
} else {
  console.log("EMERGENCE PROBE (deterministic, emergence-only arm)\n");
  console.log(`tokens: ${ALPHABET.map((k) => `${k}=${LIB[k].name}`).join("  ")}`);
  // A tame build and an explosive one, to eyeball the gap:
  play(["F", "F", "B", "Q", "O"]);            // no crit engine → predictable
  play(["F", "F", "B", "Q", "U", "W", "X", "Z", "S"]); // crit engine present → can ignite
  console.log("Now try: node probe/emergence/toy.mjs explore 6 200000");
}
