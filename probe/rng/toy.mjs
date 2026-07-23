// ─────────────────────────────────────────────────────────────────────────────
// RNG-ONLY PROBE — disposable, ugly on purpose. Do not build on this.
//
// Question it exists to answer (from STATE.md "Next up", arm 2 of 3):
//   With emergence (cross-token combination) removed entirely, can dice ALONE
//   produce a payoff that "runs away past what I planned"? And critically:
//   does a good build stay distinguishable from a bad one, or does luck wash
//   out the choice (a slot machine — no attribution, no ceiling)?
//
// This is the RNG-ONLY arm: every token rolls its own dice, independently,
// paying out only to itself. Same row, different seed → a different number
// EVERY time (the property arm 1 structurally lacked). Rules live in
// rules.mjs. See its header for the full framing and why cross-token procs
// are deliberately excluded (that's arm 3, not this one).
//
// Run it:
//   node probe/rng/toy.mjs                       # demo: same build, different seeds
//   node probe/rng/toy.mjs play G B U M Z [seed]  # watch one seeded run
//   node probe/rng/toy.mjs explore 5 3000         # characterize the toy
//
// The "moment" test (do this by hand): pick a build, play it 5 times in a
// row. Does chasing the next roll pull you back in? When a big number lands,
// does it feel like YOUR call paid off, or like the dice did it despite you?
// ─────────────────────────────────────────────────────────────────────────────

import { LIB, ALPHABET, SLOTS, resolve } from "./rules.mjs";

// ── commands ─────────────────────────────────────────────────────────────────
function play(ids, seed) {
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
  const usedSeed = seed ?? ((Math.random() * 2 ** 31) | 0);
  console.log(`\nSETUP: ${ids.map((id) => `${id}(${LIB[id].name})`).join("  ")}   seed=${usedSeed}\n`);
  const r = resolve(ids, usedSeed, { trace: true });
  console.log(r.log.join("\n"));
  console.log(`\n  SCORE = ${r.score}${r.jackpots ? `   *** ${r.jackpots} JACKPOT${r.jackpots > 1 ? "S" : ""} ***` : ""}`);
  console.log(`  (same setup, different seed → node probe/rng/toy.mjs play ${ids.join(" ")} ${usedSeed + 1})\n`);
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

function statsOf(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const pct = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return { mean, stdev: Math.sqrt(variance), min: sorted[0], median: pct(0.5), p90: pct(0.9), max: sorted[n - 1] };
}

// A deliberately mixed build (safe + gambly + jackpot-y) — used to show
// within-build variance: same 5 tokens, replayed many times, different score
// every time. This is arm 1's structural blind spot, made visible here.
const CANONICAL = ["G", "B", "U", "M", "Z"];
// The two poles, for a concrete illustration of what "build choice" buys you.
const SAFE = ["F", "F", "C", "C", "F"];
const SPIKY = ["K", "K", "M", "G", "Z"];

function explore(rowLen = SLOTS, samples = 3000) {
  // 1. WITHIN-BUILD VARIANCE — fix one build, roll it `samples` times. This
  //    is the replayability signal arm 1 (deterministic) structurally could
  //    never produce: the same setup gives a different number every time.
  const canonical = CANONICAL.slice(0, rowLen);
  const canonicalScores = [];
  let canonicalJackpotRuns = 0;
  for (let i = 0; i < samples; i++) {
    const seed = (Math.random() * 2 ** 31) | 0;
    const r = resolve(canonical, seed);
    canonicalScores.push(r.score);
    if (r.jackpots > 0) canonicalJackpotRuns++;
  }
  const cStats = statsOf(canonicalScores);

  // 2. BUILD-CHOICE vs. LUCK — the key diagnostic. Sample many distinct
  //    builds; estimate each build's EV (mean score over several seeds).
  //    Compare the SPREAD of build EVs (what build choice buys you) against
  //    the AVERAGE within-build stdev (what pure luck costs you on any one
  //    play). If luck's noise dwarfs the EV spread, build choice barely
  //    matters — a slot machine, no ceiling, no attribution.
  const seedsPerBuild = 250;
  const numBuilds = Math.max(20, Math.floor(samples / seedsPerBuild));
  const buildEVs = [];
  for (let b = 0; b < numBuilds; b++) {
    const ids = samplePermutation(ALPHABET, rowLen);
    const scores = [];
    for (let i = 0; i < seedsPerBuild; i++) {
      const seed = (Math.random() * 2 ** 31) | 0;
      scores.push(resolve(ids, seed).score);
    }
    const st = statsOf(scores);
    buildEVs.push({ ids, ev: st.mean, stdev: st.stdev });
  }
  buildEVs.sort((a, b) => b.ev - a.ev);
  const evStats = statsOf(buildEVs.map((b) => b.ev));
  const avgWithinStdev = buildEVs.reduce((a, b) => a + b.stdev, 0) / buildEVs.length;
  // signal-to-noise: how much of a single play's outcome is "which build did
  // you pick" vs. "how did the dice land". >1 means build choice is the
  // bigger factor; <1 means luck swamps it.
  const snr = avgWithinStdev ? (evStats.max - evStats.min) / avgWithinStdev : Infinity;

  // 3. THE TWO POLES, concretely — safe (all-floor) vs. spiky (all-gamble),
  //    same seed count, so you can see what "build choice" actually buys.
  const safeIds = SAFE.slice(0, rowLen);
  const spikyIds = SPIKY.slice(0, rowLen);
  const safeScores = [], spikyScores = [];
  for (let i = 0; i < seedsPerBuild; i++) {
    safeScores.push(resolve(safeIds, (Math.random() * 2 ** 31) | 0).score);
    spikyScores.push(resolve(spikyIds, (Math.random() * 2 ** 31) | 0).score);
  }
  const safeStats = statsOf(safeScores);
  const spikyStats = statsOf(spikyScores);

  console.log(`\nEXPLORE  rowLen=${rowLen}  samples=${samples}  pool=${ALPHABET.length}`);
  console.log(`\n  1) WITHIN-BUILD VARIANCE — same build [${canonical.join(" ")}], ${samples} independent plays:`);
  console.log(`     min=${cStats.min}  median=${cStats.median}  p90=${cStats.p90}  max=${cStats.max}  (spread of ${(cStats.max - cStats.min)} on ONE build)`);
  console.log(`     jackpot landed on ${(100 * canonicalJackpotRuns / samples).toFixed(1)}% of plays`);
  console.log(`     ← the number arm 1 (deterministic) could never produce: this never goes stale.`);

  console.log(`\n  2) BUILD-CHOICE vs. LUCK — ${numBuilds} distinct builds, ${seedsPerBuild} seeds each:`);
  console.log(`     build EV range: worst=${evStats.min.toFixed(1)}  best=${evStats.max.toFixed(1)}  (spread=${(evStats.max - evStats.min).toFixed(1)})`);
  console.log(`     avg within-build stdev (pure luck noise on any one play): ${avgWithinStdev.toFixed(1)}`);
  console.log(`     signal-to-noise (EV spread / luck noise): ${snr === Infinity ? "∞" : snr.toFixed(2)}`);
  console.log(`     best build found: [${buildEVs[0].ids.join(" ")}]  EV=${buildEVs[0].ev.toFixed(1)}`);
  console.log(`     worst build found: [${buildEVs[buildEVs.length - 1].ids.join(" ")}]  EV=${buildEVs[buildEVs.length - 1].ev.toFixed(1)}`);

  console.log(`\n  3) THE TWO POLES — same seed count, concretely what build choice buys:`);
  console.log(`     SAFE  [${safeIds.join(" ")}]: median=${safeStats.median}  p90=${safeStats.p90}  max=${safeStats.max}  (narrow — reliable, rarely a spike)`);
  console.log(`     SPIKY [${spikyIds.join(" ")}]: median=${spikyStats.median}  p90=${spikyStats.p90}  max=${spikyStats.max}  (wide — usually worse, sometimes a runaway)`);

  console.log(
    `\n  PASS/FAIL: within-build spike present (p90/median ≥ 1.3) ${cStats.median ? (cStats.p90 / cStats.median >= 1.3 ? "✓" : "✗") : "✗"}, ` +
    `build choice separable from noise (SNR ≥ 1.0) ${snr >= 1.0 ? "✓" : "✗"}, ` +
    `poles actually differ (spiky max > safe max) ${spikyStats.max > safeStats.max ? "✓" : "✗"}\n` +
    `  Note: none of this is the real verdict — it only checks the toy's structure so a felt\n` +
    `  "this feels like a slot machine" or "I can't tell if I built well" can be weighed against\n` +
    `  something concrete, same as arm 1's burnout was checked against its diversity stats.\n`
  );
}

// ── cli ──────────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "play") {
  const maybeSeed = rest[rest.length - 1];
  const hasSeed = /^\d+$/.test(maybeSeed ?? "");
  const ids = (hasSeed ? rest.slice(0, -1) : rest).map((x) => x.toUpperCase());
  play(ids, hasSeed ? Number(maybeSeed) : undefined);
} else if (cmd === "explore") {
  explore(Number(rest[0]) || SLOTS, Number(rest[1]) || 3000);
} else {
  console.log("RNG-ONLY PROBE (arm 2 of 3, strict luck-only — no cross-token procs)\n");
  console.log(`tokens (${ALPHABET.length}, pick ${SLOTS}): ${ALPHABET.map((k) => `${k}=${LIB[k].name}`).join("  ")}`);
  console.log("\nSAME BUILD, DIFFERENT SEED — does luck alone make each play different?");
  play(CANONICAL, 1);
  play(CANONICAL, 2);
  play(CANONICAL, 3);
  console.log("Now try: node probe/rng/toy.mjs explore 5 3000");
}
