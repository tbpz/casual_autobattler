// ─────────────────────────────────────────────────────────────────────────────
// WIRED PROBE — disposable, ugly on purpose. Do not build on this.
//
// Question it exists to answer (from STATE.md "Next up", arm 3 of 3 — the
// actual bet, not another isolated arm):
//   RNG decides WHEN/WHETHER a cascade fires; emergent combination decides
//   WHAT it becomes. Does wiring the two arms into one engine fix what each
//   arm alone couldn't: arm 1's solved-forever (dice re-roll every play) and
//   arm 2's ceiling-less (a built chain multiplies the trigger into a
//   runaway)? Or is this just the two arms bolted side by side, not a real
//   marriage?
//
// Run it:
//   node probe/wired/toy.mjs                    # demo: re-rolls + wired-vs-flat
//   node probe/wired/toy.mjs play F B D O W [seed]   # watch one seeded cascade
//   node probe/wired/toy.mjs explore 5 20000    # the three bridge diagnostics
//
// The "moment" test (do this by hand): build a chain, press play a few times.
// Does a cold roll streak (nothing catches) followed by one that goes nuclear
// feel like "I built that" or "the dice did that"? Both need to be true.
// ─────────────────────────────────────────────────────────────────────────────

import { LIB, ALPHABET, SLOTS, resolve } from "./rules.mjs";

// ── commands ─────────────────────────────────────────────────────────────────
function play(ids, seed) {
  const bad = ids.filter((id) => !LIB[id]);
  if (!ids.length || bad.length) {
    console.log(`unknown/empty tokens: ${bad.join(",") || "(none given)"}`);
    console.log(`tokens: ${ALPHABET.map((k) => `${k}=${LIB[k].name}(${LIB[k].role})`).join("  ")}`);
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
  console.log(`\n  chips=${r.chips}  mult=${r.mult}  events=${r.events}  surges=${r.surges}`);
  console.log(`  SCORE = ${r.score}${r.ignited ? "   *** IGNITED (event budget capped) ***" : ""}`);
  console.log(`  (same setup, different seed → node probe/wired/toy.mjs play ${ids.join(" ")} ${usedSeed + 1})\n`);
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

function evOf(ids, seeds) {
  const scores = [];
  for (let i = 0; i < seeds; i++) scores.push(resolve(ids, (Math.random() * 2 ** 31) | 0).score);
  return statsOf(scores);
}

// The canonical "engineered wired build" — one trigger feeding a full
// amplifier chain (spark → echo → surge → mult), plus a guaranteed chip
// floor so the score is never flatly zero. Tuned by hand against `explore`
// (this is a disposable probe, not a shipped balance target).
const CANONICAL = ["F", "B", "D", "O", "W"];
// The mirror: every TRIGGER token, zero AMPLIFIERS — dice fire, nothing
// converts them. This is what arm 3 collapses to if the marriage is fake.
const ALL_TRIGGERS = ALPHABET.filter((id) => LIB[id].role === "trigger");

function explore(rowLen = SLOTS, samples = 20000) {
  // 1. WITHIN-BUILD VARIANCE — same property arm 2 had and arm 1 structurally
  //    couldn't: fix one build, roll many seeds, does the same setup give a
  //    genuinely different number every time (and does a real spike show up)?
  const canonical = CANONICAL.slice(0, rowLen);
  const cScores = [];
  let cSurgeRuns = 0;
  for (let i = 0; i < samples; i++) {
    const r = resolve(canonical, (Math.random() * 2 ** 31) | 0);
    cScores.push(r.score);
    if (r.surges > 0) cSurgeRuns++;
  }
  const cStats = statsOf(cScores);
  const spike = cStats.median ? cStats.p90 / cStats.median : Infinity;

  // 2. BUILD-CHOICE vs. LUCK — same diagnostic as arm 2: sample many distinct
  //    builds, estimate each build's EV, compare the SPREAD of build EVs
  //    (what engineering the chain buys you) against the AVERAGE within-build
  //    stdev (what luck costs you on any one play). This is the property
  //    arm 2 structurally couldn't produce (its builds barely separated from
  //    noise) — arm 3 needs it BOTH ways: re-rolls (1) AND separable choice.
  const seedsPerBuild = 300;
  const numBuilds = Math.max(24, Math.floor(samples / seedsPerBuild));
  const builds = [];
  for (let b = 0; b < numBuilds; b++) {
    const ids = samplePermutation(ALPHABET, rowLen);
    const st = evOf(ids, seedsPerBuild);
    builds.push({ ids, ev: st.mean, stdev: st.stdev });
  }
  builds.sort((a, b) => b.ev - a.ev);
  const evStats = statsOf(builds.map((b) => b.ev));
  const avgWithinStdev = builds.reduce((a, b) => a + b.stdev, 0) / builds.length;
  const snr = avgWithinStdev ? (evStats.max - evStats.min) / avgWithinStdev : Infinity;

  // 3. THE BRIDGE ITSELF — wired vs. flat. If the wired build's EV isn't a
  //    large multiple of the all-trigger, zero-amplifier build's EV, the two
  //    halves aren't actually multiplying each other — they're just coexisting.
  //    This is the number that decides whether arm 3 is a real marriage.
  const wiredStats = evOf(canonical, 4000);
  const flatIds = ALL_TRIGGERS.slice(0, rowLen);
  const flatStats = evOf(flatIds, 4000);
  const bridgeMultiple = flatStats.mean ? wiredStats.mean / flatStats.mean : Infinity;

  console.log(`\nEXPLORE  rowLen=${rowLen}  samples=${samples}  pool=${ALPHABET.length} (${ALL_TRIGGERS.length} triggers, ${ALPHABET.length - ALL_TRIGGERS.length} amplifiers)`);

  console.log(`\n  1) WITHIN-BUILD VARIANCE — same build [${canonical.join(" ")}], ${samples} independent plays:`);
  console.log(`     min=${cStats.min}  median=${cStats.median}  p90=${cStats.p90}  max=${cStats.max}`);
  console.log(`     a surge fired on ${(100 * cSurgeRuns / samples).toFixed(1)}% of plays`);
  console.log(`     spike (p90/median): ${spike === Infinity ? "∞" : spike.toFixed(2)}  ← want ≥ 1.3 (arm 1 could never produce this at all)`);

  console.log(`\n  2) BUILD-CHOICE vs. LUCK — ${numBuilds} distinct builds, ${seedsPerBuild} seeds each:`);
  console.log(`     build EV range: worst=${evStats.min.toFixed(1)}  best=${evStats.max.toFixed(1)}  (spread=${(evStats.max - evStats.min).toFixed(1)})`);
  console.log(`     avg within-build stdev (pure luck noise on any one play): ${avgWithinStdev.toFixed(1)}`);
  console.log(`     signal-to-noise (EV spread / luck noise): ${snr === Infinity ? "∞" : snr.toFixed(2)}  ← want ≥ 1.0 (arm 2's failure mode was < 1)`);
  console.log(`     best build found: [${builds[0].ids.join(" ")}]  EV=${builds[0].ev.toFixed(1)}`);
  console.log(`     worst build found: [${builds[builds.length - 1].ids.join(" ")}]  EV=${builds[builds.length - 1].ev.toFixed(1)}`);

  console.log(`\n  3) THE BRIDGE — wired vs. flat, same 5-slot budget:`);
  console.log(`     WIRED [${canonical.join(" ")}] (trigger + amplifier chain): EV=${wiredStats.mean.toFixed(1)}`);
  console.log(`     FLAT  [${flatIds.join(" ")}] (all 5 triggers, zero amplifiers): EV=${flatStats.mean.toFixed(1)}`);
  console.log(`     wired is ${bridgeMultiple === Infinity ? "∞" : bridgeMultiple.toFixed(2)}x flat  ← want ≥ 3x (proof the chain multiplies the dice, not just coexists with it)`);

  console.log(
    `\n  PASS/FAIL: within-build spike ≥1.3 ${spike >= 1.3 ? "✓" : "✗"}, ` +
    `build choice separable from noise (SNR ≥1.0) ${snr >= 1.0 ? "✓" : "✗"}, ` +
    `bridge multiple ≥3x ${bridgeMultiple >= 3 ? "✓" : "✗"}\n` +
    `  Note: none of this is the real verdict — it only checks the toy's structure so a felt\n` +
    `  "that was luck, not my build" or "it never felt like it could run away" can be weighed\n` +
    `  against something concrete, same discipline as arm 1 and arm 2's own diagnostics.\n`
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
  explore(Number(rest[0]) || SLOTS, Number(rest[1]) || 20000);
} else {
  console.log("WIRED PROBE (arm 3 of 3 — RNG triggers, emergence amplifies)\n");
  console.log(`tokens (${ALPHABET.length}, pick ${SLOTS}): ${ALPHABET.map((k) => `${k}=${LIB[k].name}[${LIB[k].role}]`).join("  ")}`);
  console.log("\nSAME BUILD, DIFFERENT SEED — does the dice-fired chain re-roll?");
  play(CANONICAL, 10); // cold — Berserker misses, nothing to amplify
  play(CANONICAL, 1);  // typical — one swing catches, chain runs once
  play(CANONICAL, 15); // hot — chain runs twice, mult stacks further
  console.log("WIRED vs. FLAT — same 5 slots, does the amplifier chain actually multiply the trigger?");
  play(CANONICAL, 15);
  play(ALL_TRIGGERS, 15);
  console.log("\nNow try: node probe/wired/toy.mjs explore 5 20000");
}
