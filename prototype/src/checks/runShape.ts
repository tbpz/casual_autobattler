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
// Chain frequency (DECISIONS.md 2026-09-30 "Chains fire every fight"): one
// sample per fielded hero per fight, and one first-chain fraction per fight
// with a chainless fight counted as 1 — same definitions as batch/report.ts.
let heroFights = 0;
let heroFightsWithChain = 0;
const firstChainFractions: number[] = [];

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
    const chained = new Set<string>();
    let firstChainT: number | null = null;
    for (const e of fr.events) {
      if (e.type !== "chainStart") continue;
      totalChainsFired++;
      if (e.backfire) totalChainsBackfired++;
      chained.add(e.heroId);
      if (firstChainT === null) firstChainT = e.t;
    }
    heroFights += fr.finalPlayerHeroes.length;
    heroFightsWithChain += chained.size;
    firstChainFractions.push(firstChainT === null || fr.durationSec <= 0 ? 1 : Math.min(firstChainT / fr.durationSec, 1));
  }
}

firstChainFractions.sort((a, b) => a - b);
const medianFirstChain = firstChainFractions[Math.floor((firstChainFractions.length - 1) / 2)] ?? 1;
const heroChainShare = heroFights > 0 ? heroFightsWithChain / heroFights : 0;

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
console.log(`  heroes who chained:  ${(heroChainShare * 100).toFixed(1)}% of fielded hero-fights`);
console.log(`  first chain at:      median ${(medianFirstChain * 100).toFixed(0)}% of fight length`);

// Not a balance target — a sanity range. A 20-round run with mini-bosses and
// a boss should neither be a free win nor an impossible wall on a first
// pass; either extreme means the round-by-round scale (sim/rounds.ts's
// ROUND_PLAN) is structurally broken, not just unbalanced.
check("run completion rate is neither 0% nor 100%", completionRate > 0 && completionRate < 1, `got ${(completionRate * 100).toFixed(1)}%`);
check("some chains fire across the population", totalChainsFired > 0, `got ${totalChainsFired}`);
check("some chains backfire across the population", totalChainsBackfired > 0, `got ${totalChainsBackfired}`);
// The chain-frequency gates. The heroes-who-chained floor is 0.85 rather than
// 1: the queue lets one chain run at a time, so a squad of four or five in a
// short fight cannot all get a turn (measured ~88% at three units, ~59% at
// five before enemies were made tougher). The tuning is what keeps this above
// the floor — see config.ts's chargeThreshold comment.
check("most fielded heroes chain at least once per fight", heroChainShare >= 0.85, `got ${(heroChainShare * 100).toFixed(1)}%`);
check("the first chain lands while the fight is still undecided (median <= 40% of its length)", medianFirstChain <= 0.4, `got ${(medianFirstChain * 100).toFixed(0)}%`);
check("some run reaches a wind-up-driven wipe (a real loss occurs)", sawLoss);
check("some run outgrows its starting roster faster than it can replace it (rosterExhausted occurs)", sawRosterExhausted);
check("some run grows its squad past its starting size (a slot offer got taken)", maxSlotsSeenAtEnd > cfg.startingSlots, `got ${maxSlotsSeenAtEnd}`);

if (failed) {
  console.error("\nrun-shape check FAILED");
  process.exit(1);
} else {
  console.log("\nrun-shape check passed");
}
