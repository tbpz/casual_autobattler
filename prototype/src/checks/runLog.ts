/**
 * The export log (2026-10-02 — log/runLog.ts). Plays whole runs through the
 * interactive RunSession (accept-default squad, first relic, first offer — the
 * same choices runRun's "first" policy makes) and pins that the log describes
 * the run that actually happened: the same rounds, outcomes and held cards as
 * the headless driver, with every fight's summary agreeing with its own events
 * and the whole file surviving a JSON round trip.
 */
import { Rng } from "../sim/rng.js";
import { DEFAULT_RUN_CONFIG as cfg } from "../sim/config.js";
import { heldCards } from "../sim/progress.js";
import { defaultCardDrop } from "../sim/offers.js";
import { makeOfferPolicy, runRun } from "../sim/run.js";
import { RunSession } from "../render/runSession.js";
import { buildRunLog, RUN_LOG_SCHEMA_VERSION } from "../log/runLog.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

/** Plays a session to its end with the "first" choices. */
function playSession(seed: number): RunSession {
  const session = new RunSession(cfg, seed);
  while (session.status === "in-progress") {
    session.playNextRound();
    if (session.status !== "in-progress") break; // lost the round
    if (session.awaitingRelic) {
      session.pickRelic(session.relicChoices[0]!);
    } else if (session.pendingOffers.length === 0) {
      session.resolveOffer(null);
    } else {
      const offer = session.pendingOffers[0]!;
      session.resolveOffer(offer, defaultCardDrop(session.progress, session.currentRoster, offer, cfg));
    }
  }
  return session;
}

for (const seed of [1, 2, 3, 7, 11, 42]) {
  const label = `seed ${seed}`;
  const session = playSession(seed);
  const offerRng = new Rng((seed ^ 0x51ed270b) >>> 0);
  const headless = runRun(cfg, new Rng(seed), offerRng, makeOfferPolicy("first", offerRng), seed);
  const log = buildRunLog(session, cfg);

  check(`${label}: the session and the headless driver agree on how the run went`,
    session.status === headless.outcome && log.run.roundsWon === headless.roundsWon,
    `session ${session.status}/${log.run.roundsWon}, headless ${headless.outcome}/${headless.roundsWon}`);
  check(`${label}: one log entry per round fought`, log.rounds.length === headless.heldByRound.length && log.rounds.length === session.rounds.length,
    `${log.rounds.length} entries, ${headless.heldByRound.length} fought`);

  const sameHeld = log.rounds.every((r, i) => {
    const want = headless.heldByRound[i]!;
    const got = [...(r.goingIn.relic ? [r.goingIn.relic] : []), ...r.goingIn.cards];
    return JSON.stringify(want) === JSON.stringify(got);
  });
  check(`${label}: cards and relic held going into each round match the headless run`, sameHeld);

  const sameOutcome = log.rounds.every((r, i) => r.fight.outcome === headless.rounds[i]!.outcome);
  check(`${label}: every round's outcome matches`, sameOutcome);

  check(`${label}: the final relic and hand match`,
    log.run.relic === (headless.finalProgress.relic ?? null) &&
      JSON.stringify(log.run.finalProgress.cards) === JSON.stringify(headless.finalProgress.cards));
  check(`${label}: held cards read the same as the session's own heldCards`,
    JSON.stringify([log.run.relic, ...log.run.finalProgress.cards].filter((x) => x)) === JSON.stringify(heldCards(session.progress)));

  const summariesAgree = log.rounds.every((r) => {
    const events = r.fight.events;
    const chainEnds = events.filter((e) => e.type === "chainEnd").length;
    const triggers = events.filter((e) => e.type === "cardTriggered").length;
    const counted = Object.values(r.fight.cardTriggers).reduce((a, c) => a + c.count, 0);
    const slams = events.filter((e) => e.type === "windupHit").length;
    return r.fight.chains.length === chainEnds && counted === triggers && r.fight.slams.total === slams && r.fight.units.length === r.squad.length;
  });
  check(`${label}: each fight's summary agrees with its own events`, summariesAgree);

  const rewardsRight = log.rounds.every((r, i) => {
    if (r.fight.outcome === "loss") return r.reward.offerTaken === null && r.reward.relicTaken === null;
    if (r.roundIndex === cfg.relicRound) return r.reward.relicTaken === null ? i === log.rounds.length - 1 : r.reward.relicTaken === r.reward.relicChoices![0];
    const taken = r.reward.offerTaken as { kind?: string } | null;
    return r.reward.offersShown.length === 0 ? taken === null : taken === r.reward.offersShown[0] || JSON.stringify(taken) === JSON.stringify(r.reward.offersShown[0]);
  });
  check(`${label}: rewards recorded — relic on the relic round, first offer elsewhere, nothing after a loss`, rewardsRight);

  const roundTrip = JSON.stringify(JSON.parse(JSON.stringify(log)));
  check(`${label}: the log survives a JSON round trip`, roundTrip === JSON.stringify(log), `${(roundTrip.length / 1024).toFixed(0)} KB`);
}

// A log taken mid-run holds the rounds so far — export works on every screen.
{
  const session = new RunSession(cfg, 5);
  check("a fresh session exports an empty round list", buildRunLog(session, cfg).rounds.length === 0);
  session.playNextRound();
  const mid = buildRunLog(session, cfg);
  check("after one round fought the log holds one entry and carries the schema version",
    mid.rounds.length === 1 && mid.about.schemaVersion === RUN_LOG_SCHEMA_VERSION);
}

if (failed) process.exit(1);
