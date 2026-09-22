/**
 * A small regression check on the RUN as a whole (2026-09-23, roles/rounds
 * rebuild — replaces the old 924-line checks/chaindist.ts, which was keyed
 * to six named-hero drafts and a three-policy coin economy, neither of
 * which exist any more). This is deliberately NOT a balance pass — see this
 * project's STATE.md: the roles/rounds rebuild is a first plain version to
 * play and iterate on, not a tuned game. What this catches: "runs never
 * finish" or "runs always finish" (either means the 20-round curve is
 * structurally broken, not just unbalanced), and that the chain/backfire
 * mechanism is still actually live under the new roles.
 *
 * Every seed uses the "first" offer policy (always take the first of the 3
 * drawn) — a fixed, reproducible population, same convention the old
 * batch/run checks used a fixed policy for.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { makeOfferPolicy, runRun } from "../sim/run.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const cfg = DEFAULT_RUN_CONFIG;
const N = 300;
const baseSeed = 90_000;

let completed = 0;
let totalChainsFired = 0;
let totalChainsBackfired = 0;
const chainLengthHist: Record<number, number> = {};
let totalRoundsWon = 0;
let sawRosterExhausted = false;
let sawLoss = false;
let maxSlotsSeenAtEnd = 0;

for (let i = 0; i < N; i++) {
  const seed = baseSeed + i;
  const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
  const result = runRun(cfg, new Rng(seed), offerRng, makeOfferPolicy("greedy"), seed);
  if (result.outcome === "complete") completed++;
  if (result.overReason === "rosterExhausted") sawRosterExhausted = true;
  if (result.overReason === "loss") sawLoss = true;
  totalRoundsWon += result.roundsWon;
  maxSlotsSeenAtEnd = Math.max(maxSlotsSeenAtEnd, result.finalProgress.slots);

  for (const fr of result.fightResults) {
    chainLengthHist[fr.chainLength] = (chainLengthHist[fr.chainLength] ?? 0) + 1;
    for (const e of fr.events) {
      if (e.type !== "chainStart") continue;
      totalChainsFired++;
      if (e.backfire) totalChainsBackfired++;
    }
  }
}

const completionRate = completed / N;
const meanRoundsWon = totalRoundsWon / N;
const backfireRate = totalChainsFired > 0 ? totalChainsBackfired / totalChainsFired : 0;

console.log(`n=${N} seeds, offer policy "greedy"`);
console.log(`  run completion rate: ${(completionRate * 100).toFixed(1)}%`);
console.log(`  mean rounds won:     ${meanRoundsWon.toFixed(1)} / ${cfg.roundsPerRun}`);
console.log(`  chains fired:        ${totalChainsFired} (backfire rate ${(backfireRate * 100).toFixed(1)}%)`);
console.log(
  `  chain length hist:   ${Object.keys(chainLengthHist).map(Number).sort((a, b) => a - b).map((k) => `${k}:${chainLengthHist[k]}`).join("  ")}`,
);
console.log(`  max slots reached:   ${maxSlotsSeenAtEnd} (cap ${cfg.maxSlots})`);

// Not a balance target — a sanity range. A 20-round run with mini-bosses and
// a boss should neither be a free win nor an impossible wall on a first
// pass; either extreme means the round-by-round scale (sim/rounds.ts's
// ROUND_PLAN) is structurally broken, not just unbalanced.
check("run completion rate is neither 0% nor 100%", completionRate > 0 && completionRate < 1, `got ${(completionRate * 100).toFixed(1)}%`);
check("some chains fire across the population", totalChainsFired > 0, `got ${totalChainsFired}`);
check("some chains backfire across the population", totalChainsBackfired > 0, `got ${totalChainsBackfired}`);
check("some run reaches a wind-up-driven wipe (a real loss occurs)", sawLoss);
check("some run outgrows its starting roster faster than it can replace it (rosterExhausted occurs)", sawRosterExhausted);
check("some run grows its squad past its starting size (a slot offer got taken)", maxSlotsSeenAtEnd > cfg.startingSlots, `got ${maxSlotsSeenAtEnd}`);

if (failed) {
  console.error("\nrun-shape check FAILED");
  process.exit(1);
} else {
  console.log("\nrun-shape check passed");
}
