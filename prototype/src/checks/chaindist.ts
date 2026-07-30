/**
 * Verifies FIGHT_SCRIPT.md §4's corrected arithmetic in code: composing the
 * ignition PRD (~65% long-run) with the chain PRD should produce a 3+-hit
 * chain in roughly 7% of fights — not the ~25% the doc's own first-draft
 * estimate wrongly implied before its 2026-07-31 correction.
 *
 * Runs the two PRD tables directly (not full fight sims) over 100k simulated
 * "fights," since the claim is about the tables' composition, not combat
 * timing.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG, prdLookup } from "../sim/config.js";

const cfg = DEFAULT_RUN_CONFIG.fight;
const rng = new Rng(12345);
const N = 100_000;

let ignitions = 0;
let chain3Plus = 0;
let fightsSinceIgnition = 0;

for (let i = 0; i < N; i++) {
  const ignitionChance = prdLookup(cfg.ignitionChanceByFightsSince, fightsSinceIgnition);
  const fired = rng.chance(ignitionChance);
  if (!fired) {
    fightsSinceIgnition++;
    continue;
  }
  ignitions++;
  fightsSinceIgnition = 0;

  let chainLength = 0;
  while (chainLength < 50) {
    const chance = prdLookup(cfg.chainChanceByHitsSoFar, chainLength);
    if (!rng.chance(chance)) break;
    chainLength++;
  }
  if (chainLength >= 3) chain3Plus++;
}

const ignitionRate = ignitions / N;
const chain3PlusRate = chain3Plus / N;

let failed = false;

function between(name: string, actual: number, lo: number, hi: number): void {
  const ok = actual >= lo && actual <= hi;
  console.log(`${ok ? "PASS" : "FAIL"}: ${name} — got ${(actual * 100).toFixed(2)}%, expected in [${lo * 100}%, ${hi * 100}%]`);
  if (!ok) failed = true;
}

between("long-run ignition rate", ignitionRate, 0.6, 0.7);
between("fraction of fights with chain >= 3", chain3PlusRate, 0.05, 0.09);

if (failed) {
  console.error("\nchaindist check FAILED");
  process.exit(1);
} else {
  console.log("\nchaindist check passed");
}
