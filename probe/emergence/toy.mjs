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
// v2 (2026-07-21): v1 had 8 slots and 11 free/additive tokens — "add every
// token that fits" was always correct, so informed play converged to ~flat
// scores (runaway factor ~2.3x among full builds). Rules now live in
// rules.mjs: 5 slots out of a 15-token pool (real scarcity), plus tokens with
// cost/anti-synergy (Alchemist, Interceptor, Tyrant, Vanguard) so dumping the
// whole "obvious" engine is no longer the dominant strategy. See rules.mjs
// header for the full changelog.
//
// Run it:
//   node probe/emergence/toy.mjs                 # demo setups + cascade logs
//   node probe/emergence/toy.mjs play F B U W X   # watch one cascade
//   node probe/emergence/toy.mjs explore 5 200000 # does the obvious build win?
//
// The "moment" test (do this by hand): pick a setup, PREDICT the score out loud,
// then run `play` and see how wrong you were. If you're always right, it's flat.
// ─────────────────────────────────────────────────────────────────────────────

import { LIB, ALPHABET, SLOTS, resolve } from "./rules.mjs";

// ── commands ─────────────────────────────────────────────────────────────────
function play(ids) {
  const bad = ids.filter((id) => !LIB[id]);
  if (!ids.length || bad.length) {
    console.log(`unknown/empty tokens: ${bad.join(",") || "(none given)"}`);
    console.log(`tokens: ${ALPHABET.map((k) => `${k}=${LIB[k].name}`).join("  ")}`);
    return;
  }
  if (ids.length > SLOTS) {
    console.log(`too many tokens: row is capped at ${SLOTS} slots (you gave ${ids.length})`);
    return;
  }
  console.log(`\nSETUP: ${ids.map((id) => `${id}(${LIB[id].name})`).join("  ")}\n`);
  const r = resolve(ids, { trace: true });
  console.log(r.log.join("\n"));
  console.log(`\n  chips=${r.chips}  mult=${r.mult}  events=${r.events}`);
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

// Canonical "everyone knows this is the engine" pick — the crit/kill loop
// without any of the cost/anti-synergy tokens. If this is still near the top
// of the distribution, the redesign failed: the obvious build is still best.
const OBVIOUS = ["B", "U", "W", "X", "Z"];

function explore(rowLen, samples) {
  const solo = {};
  for (const id of ALPHABET) solo[id] = resolve([id]).score;

  const results = [];
  for (let i = 0; i < samples; i++) {
    const ids = samplePermutation(ALPHABET, rowLen);
    const r = resolve(ids);
    results.push({ ids, score: r.score, ignited: r.ignited });
  }
  const scores = results.map((r) => r.score).sort((a, b) => a - b);
  results.sort((a, b) => b.score - a.score); // best first

  const pct = (p) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
  const median = pct(0.5);
  const p90 = pct(0.9);

  // top-decile stats — the regime a player who already knows the tokens
  // actually operates in. This is the number that matters, not the random one.
  const topDecile = results.filter((r) => r.score >= p90).map((r) => r.score).sort((a, b) => a - b);
  const tdMin = topDecile[0];
  const tdMed = topDecile[Math.floor(topDecile.length / 2)];
  const tdMax = topDecile[topDecile.length - 1];
  const topDecileRunaway = tdMed ? tdMax / tdMed : Infinity;

  // where does the "obvious" build rank — not against random noise (almost
  // anything half-sane beats most random picks), but against OTHER GOOD
  // builds (top-decile). If obvious is near the top of that population, an
  // informed player has no reason to look further: bad. If most top-decile
  // builds beat it, real discovery room exists above the obvious answer.
  const obviousIds = OBVIOUS.slice(0, rowLen);
  const obvious = resolve(obviousIds);
  const beatenByTopDecile = topDecile.filter((v) => v > obvious.score).length;
  const obviousVsGoodPercentile = 100 * (1 - beatenByTopDecile / topDecile.length);
  const obviousVsMax = tdMax ? (100 * obvious.score) / tdMax : 0;

  // build-family count among the top 50 — cluster by shared-token-set overlap.
  // >=1 family means one dominant attractor; we want several.
  const top50 = results.slice(0, 50);
  const families = [];
  for (const r of top50) {
    const set = new Set(r.ids);
    const fam = families.find((f) => [...f.rep].filter((id) => set.has(id)).length >= rowLen - 1);
    if (fam) fam.members.push(r);
    else families.push({ rep: set, members: [r] });
  }

  console.log(`\nEXPLORE  rowLen=${rowLen}  samples=${samples}  pool=${ALPHABET.length}`);
  console.log(`  solo scores (naive per-token): ${ALPHABET.map((k) => `${k}=${solo[k]}`).join(" ")}`);
  console.log(`  distribution:  min=${scores[0]}  median=${median}  p90=${p90}  p99=${pct(0.99)}  max=${scores[scores.length - 1]}`);
  console.log(`  runaway factor, all builds (max/median): ${median ? (scores[scores.length - 1] / median).toFixed(1) : "∞"}x`);
  console.log(`  runaway factor, TOP-DECILE (max/median of the best 10%): ${topDecileRunaway === Infinity ? "∞" : topDecileRunaway.toFixed(1)}x  ← the number that matters for informed play`);
  console.log(`\n  "obvious" build [${obviousIds.join(" ")}]: score=${obvious.score}`);
  console.log(`  vs. the top-decile (good-build) population: beats only ${obviousVsGoodPercentile.toFixed(1)}% of them, and is ${obviousVsMax.toFixed(0)}% of the best score found`);
  console.log(`  → near 100%/100% = obvious build IS the best build (bad, no discovery left). Lower is better.`);
  console.log(`\n  best found: [${top50[0].ids.join(" ")}]  score=${top50[0].score}`);
  console.log(`  distinct build families in top 50 (grouped by ${rowLen - 1}+ shared tokens): ${families.length}`);
  families.slice(0, 6).forEach((fam, i) =>
    console.log(`    family ${i + 1}: best=[${fam.members[0].ids.join(" ")}] score=${fam.members[0].score}  (${fam.members.length}/50)`)
  );
  console.log(
    `\n  PASS/FAIL: top-decile runaway ${topDecileRunaway > 5 ? "> 5x ✓" : "≤ 5x ✗"}, ` +
    `obvious build ${obviousVsMax < 60 ? "< 60% of best ✓" : "≥ 60% of best ✗"}, ` +
    `${families.length} build families (want ≥2) ${families.length >= 2 ? "✓" : "✗"}\n`
  );
}

// ── cli ──────────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "play") {
  play(rest.map((x) => x.toUpperCase()));
} else if (cmd === "explore") {
  explore(Number(rest[0]) || SLOTS, Number(rest[1]) || 200000);
} else {
  console.log("EMERGENCE PROBE v2 (deterministic, emergence-only arm)\n");
  console.log(`tokens (${ALPHABET.length}, pick ${SLOTS}): ${ALPHABET.map((k) => `${k}=${LIB[k].name}`).join("  ")}`);
  console.log("\nSAME TOKENS, DIFFERENT ORDER — does order actually matter?");
  play(["A", "B", "U", "W", "X"]);
  play(["B", "U", "W", "X", "A"]);
  console.log("Interceptor position flips who benefits from the crit loop:");
  play(["B", "I", "U", "W", "X"]);
  play(["B", "U", "W", "X", "I"]);
  console.log("Now try: node probe/emergence/toy.mjs explore 5 200000");
}
