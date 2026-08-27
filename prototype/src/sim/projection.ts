import type { FightConfig } from "./config.js";
import { baselineChainProfile } from "./config.js";
import type { HeroState, SideState } from "./types.js";
import { sideHp } from "./types.js";

/**
 * Pure, mean-value projection of how a fight should go — no RNG, never runs
 * a fight. This is what the squad-pick screen, the pre-fight read, and the
 * post-fight recap all consume, so the three can never disagree about what
 * was promised (see DECISIONS.md's 2026-08-06 "squad pick is the risk dial"
 * entry). It reads the same physics runFight implements; it never drives
 * runFight, and runFight never reads it back — the sim's actual outcome is
 * always the ground truth, this is only the player-facing expectation to be
 * surprised relative to.
 */
export type MarginBand = "comfortable" | "tight" | "losing";

export interface Projection {
  playerDps: number;
  enemyDps: number;
  healPerSec: number;
  /** Seconds to kill the enemy side at mean player DPS. */
  killSec: number;
  /** Seconds the player side survives, healing credited. NOT
   * `sideHp(player) / (enemyDps - healPerSec)` — that form is undefined once
   * healing meets or exceeds incoming damage, and the divide-by-zero guard it
   * needs gets read back as a real survival time (the 2026-08-22 over-heal
   * defect — see DECISIONS.md). This solves survivalSecUnder's closed form
   * instead, clamped at cfg.maxFightSec — see that function's docstring. */
  surviveSec: number;
  /** surviveSec - killSec. Positive = expected to win with seconds to spare. */
  spareSec: number;
  /** surviveSec / killSec. The single number the margin band is cut from. */
  margin: number;
  band: MarginBand;
  /** Name of the squad's tank, if it has one living. */
  tankName: string | null;
  /** Seconds until that tank is projected to break (tankBreakFraction of its
   * own max), crediting the squad's healing to it — null if there's no tank. */
  tankHoldsSec: number | null;
  /** Three player-facing lines, one per squad job, for the pre-fight screen. */
  lines: string[];
  /** One-sentence statement of the band, for the squad-pick screen. */
  verdict: string;
  /** Mean-value estimate of how many chains fire over this fight — carried
   * charge plus projected accrual (see chainProjectionFor) divided by
   * chargeThreshold. Not a count of DISTINCT heroes chaining, just total
   * ignitions: two different heroes each firing once and one hero firing
   * twice both read as 2.0 here. */
  chainsExpected: number;
  /** One-sentence chain expectation — "chain: expect ~N this fight" plus
   * the shape of whoever's closest to firing, so the squad/field pick reads
   * the same chain-likelihood signal the pre-fight screen already gave a
   * hand-rolled version of (closestChargeLine in preFightScreen.ts, now
   * folded into this shared, checkable mechanism). */
  chainLine: string;
}

/** Below this pool margin, the projection calls the fight an expected loss
 * outright, regardless of how the tank line looks. */
const MARGIN_LOSING = 1.0;
/** A tank comp bands comfortable when it's projected to hold this many times
 * longer than the fight is expected to take — i.e. with real margin to
 * spare, not just barely surviving to the final bell. This uses
 * tankBreakFraction (the tank's own visible break point), not a separate
 * aggregate-HP heuristic: aggregate pool math alone rewards raw kill speed
 * over survivability (a fast-killing glass-cannon comp can out-DPS-race a
 * slow tank on paper while still being the comp that gets someone killed)
 * and undersells the tank's actual job, which is concentrating damage
 * rather than shrinking the total. (Note: as of the 2026-08-07/08 heat
 * rebuild, tank-line health is no longer what gates the cascade — heat is —
 * so this band is read-only for "how safe is this fight," not for "how
 * likely is a chain." See DECISIONS.md's "squad pick is the risk dial" and
 * "fight causality rebuild" entries for that split.) */
// 2026-08-09: retuned 1.25 -> 1.15 as a direct consequence of this file's own
// windup-avg and config.ts's heal-cap fixes (both were, independently,
// silently inflating a tank comp's projected safety margin — see this file's
// bruiserDpsAvg comment and config.ts's healMaxFractionOfTargetMaxHp
// comment). With both fixed, the projection is more honest and margins are
// tighter across the board; 1.15 is where the pool's best defensive pick
// (bracer+hollow+cairn, ratio ~1.21 at fight 0) still clears it, so
// "comfortable" stays a reachable band rather than dead code.
const TANK_HOLDS_COMFORTABLE_RATIO = 1.15;
/** A tankless comp has no line to break, so it's living dangerously by
 * construction — it only bands comfortable if it's overwhelming the fight
 * on pure pool margin. */
const NO_TANK_COMFORTABLE_MARGIN = 2.5;

function bandFor(margin: number, tankHoldsSec: number | null, killSec: number): MarginBand {
  if (margin < MARGIN_LOSING) return "losing";
  if (tankHoldsSec !== null) {
    return tankHoldsSec >= killSec * TANK_HOLDS_COMFORTABLE_RATIO ? "comfortable" : "tight";
  }
  return margin >= NO_TANK_COMFORTABLE_MARGIN ? "comfortable" : "tight";
}

/**
 * Softened 2026-08-07 (see DECISIONS.md's "fight causality rebuild" entry):
 * the pre-2026-08-07 verdict stated the outcome as a near-certainty
 * ("you should win this clean") and the sim then delivered exactly that,
 * batch-verified within 20% of the projection — the pre-fight screen was
 * announcing the result instead of setting an expectation to be surprised
 * relative to. This now states a FLOOR (what you should survive), not an
 * outcome, and leaves room for the wind-up risk (folded into
 * enemyDps below) to beat it.
 */
function verdictFor(band: MarginBand, tankName: string | null): string {
  switch (band) {
    case "comfortable":
      return "Comfortable floor. Should hold up — the bruiser's wind-up is the wildcard.";
    case "tight":
      return tankName
        ? `Tight. ${tankName} may not hold the whole fight, and a bad wind-up could decide it.`
        : "Tight. No one's holding the line — a wind-up could end this early.";
    case "losing":
      return "Rough floor. You'll need a break — or a fast chain — to pull this out.";
  }
}

/** Mean per-second output of a living side, split into damage dealers and
 * healers — a hero with healPerBeat is a healer for this purpose even though
 * it also carries a (small) damage stat, matching fight.ts's
 * performHeroAction. Ward's attacksWhileHealing (2026-08-08, see heroes.ts)
 * is the one exception: it contributes to BOTH dps and healPerSec, since it
 * genuinely does both on the same beat rather than one replacing the other.
 *
 * 2026-08-08 (root-cause pass): each healer's per-beat amount is capped
 * against cfg.healMaxFractionOfTargetMaxHp, same as fight.ts's
 * performHeroAction — otherwise this projection understates incoming
 * pressure on a squishy ally exactly the way the pre-fix sim did. A heal
 * always lands on the lowest-HP living ally (fight.ts's lowestHpAliveHero),
 * which trends toward the squishiest body in the side, so this approximates
 * the cap against the SMALLEST living ally's maxHp rather than the healer's
 * own — a mean-value estimate, not a per-tick replay (see this file's top
 * docstring). */
function sideRates(heroes: HeroState[], cfg: FightConfig): { dps: number; healPerSec: number } {
  let dps = 0;
  let healPerSec = 0;
  const minAllyMaxHp = Math.min(...heroes.filter((h) => h.alive).map((h) => h.maxHp));
  for (const h of heroes) {
    if (!h.alive) continue;
    if (h.healPerBeat) {
      const cap = minAllyMaxHp * cfg.healMaxFractionOfTargetMaxHp;
      healPerSec += Math.min(h.healPerBeat, cap) / h.attackIntervalSec;
      if (h.attacksWhileHealing) dps += h.damage / h.attackIntervalSec;
    } else {
      dps += h.damage / h.attackIntervalSec;
    }
  }
  return { dps, healPerSec };
}

/**
 * Time for `hpPool` to deplete under a flat net incoming rate, clamped at
 * `cfg.maxFightSec` (2026-08-22 over-heal fix — see DECISIONS.md; the tier
 * walk it used to do is gone with CLOCK, 2026-08-27, but the guarantee it
 * exists for is not).
 *
 * The guarantee: this must never divide by a divide-by-zero guard and hand
 * the result back as a survival time. `Math.max(enemyDps - healPerSec, 0.01)`
 * used to do exactly that, manufacturing numbers in the tens of thousands of
 * seconds (confirmed live: a healer draft against the "Anvil" encounter read
 * 189.15/0.01 = 18915 for a ~36s fight). A squad that out-heals incoming
 * damage does not survive 18915 seconds — it survives until the sim's own
 * hard tick cutoff, which is what `maxFightSec` is. So the non-depleting
 * case returns that ceiling explicitly rather than falling through a
 * division, and every depleting case is clamped to it too: a number above
 * the cutoff is exactly as dishonest as the old fabricated one, just smaller.
 */
function survivalSecUnder(hpPool: number, enemyDps: number, healPerSec: number, cfg: FightConfig): number {
  if (hpPool <= 0) return 0;
  const rate = enemyDps - healPerSec;
  if (rate <= 0) return cfg.maxFightSec; // net healing or holding steady — never depletes
  return Math.min(hpPool / rate, cfg.maxFightSec);
}

/**
 * Mean-value chain expectation (2026-08-20, per-hero-profile pass — Part 1
 * §6 of the "chain choice: make the pick a shape, not a size" plan). Charge
 * is per-hero and only the highest-charge hero fires on threshold-cross
 * (fight.ts), but for a POOL-level "how many chains should I expect" this
 * treats the side's charge as one shared pool: total charge already carried
 * in, plus total charge generated over the projected fight length, divided
 * by chargeThreshold. That over-counts slightly whenever two heroes would
 * both be mid-charge at the same time (their charge isn't actually
 * fungible — a hero can't borrow another's progress), but undercounting is
 * the opposite failure mode (implying the fight is chain-free when several
 * heroes are each a little charged), and this projection's whole convention
 * (see this file's top docstring) is a mean-value estimate to be surprised
 * relative to, not a per-tick replay.
 *
 * chargeRate mirrors fight.ts's three accrual paths directly: dealt scales
 * with the side's own DPS, soaked with incoming DPS (pre-heal — soaking
 * happens at the moment damage lands, before any heal reverses it), restored
 * with healing throughput.
 */
function chainProjectionFor(
  playerAlive: HeroState[],
  cfg: FightConfig,
  killSec: number,
  playerDps: number,
  enemyDps: number,
  healPerSec: number,
): { chainsExpected: number; chainLine: string } {
  if (playerAlive.length === 0 || cfg.chargeThreshold <= 0) {
    return { chainsExpected: 0, chainLine: "No one's fielded to chain." };
  }

  const carriedCharge = playerAlive.reduce((sum, h) => sum + h.charge, 0);
  const chargeRate =
    cfg.chargeWeightDealt * playerDps + cfg.chargeWeightSoaked * enemyDps + cfg.chargeWeightRestored * healPerSec;
  const chainsExpected = (carriedCharge + chargeRate * killSec) / cfg.chargeThreshold;

  let closest = playerAlive[0]!;
  for (const h of playerAlive) if (h.charge > closest.charge) closest = h;
  const closestProfile = closest.chainProfile ?? baselineChainProfile(cfg);

  let chainLine: string;
  if (chainsExpected < 0.5) {
    chainLine = "Chain: unlikely this fight — charge is far off.";
  } else {
    const count = Math.max(1, Math.round(chainsExpected));
    chainLine = `Chain: expect ~${count} this fight. ${closest.name}'s are ${closestProfile.label}.`;
  }
  return { chainsExpected, chainLine };
}

export function project(player: SideState, enemy: SideState, cfg: FightConfig): Projection {
  const playerAlive = player.heroes.filter((h) => h.alive);
  const enemyAlive = enemy.heroes.filter((h) => h.alive);

  const playerRates = sideRates(playerAlive, cfg);
  // The bruiser is excluded from the generic side-rates pass below — its
  // real output isn't a continuous h.damage/h.attackIntervalSec stream, it's
  // gated by the wind-up cycle (see the windup-aware term a few lines down).
  const enemyNonBruiser = enemyAlive.filter((h) => h.role !== "bruiser");
  const enemyRates = sideRates(enemyNonBruiser, cfg);
  // The run's dpsBonus upgrade (coin sink B) applies to every hero that
  // actually attacks — everyone without healPerBeat, PLUS Ward-style hybrids
  // (attacksWhileHealing) who attack on top of healing (matches fight.ts's
  // performHeroAction, which adds attackerSide.dpsBonus on any attack beat).
  const attackerCount = playerAlive.filter((h) => !h.healPerBeat || h.attacksWhileHealing).length;
  const playerDps = playerRates.dps + player.dpsBonus * attackerCount;
  const healPerSec = playerRates.healPerSec;

  // killSec is about killing the ENEMY side, which never depends on incoming
  // damage — so it's unaffected by the wind-up, same as before.
  const killSec = sideHp(enemy) / Math.max(playerDps, 0.01);

  // enemyDps folds in the wind-up's average contribution (2026-08-07
  // rebuild) — without this the projection would still understate incoming
  // damage the way the old point-estimate did, just via a different gap.
  // 2026-08-27: it no longer also carries an enrage term, since nothing
  // scales enemy damage over a fight any more (see DECISIONS.md).
  //
  // 2026-08-09 fix: this used to divide the wind-up hit by windupIntervalSec
  // alone (5s), which double-counts — fight.ts's handleBruiserBeat sets
  // nextWindupT from the FIRE time, and the bruiser makes zero normal
  // attacks during the windupTelegraphSec (1.5s) that precedes each fire. So
  // the real cycle is windupIntervalSec + windupTelegraphSec = 6.5s, during
  // which the bruiser lands ~(windupIntervalSec / attackIntervalSec) normal
  // attacks plus exactly one wind-up hit — not a full attackIntervalSec-rate
  // stream on top of a 5s-cycled wind-up. Verified against fight.ts's actual
  // per-tick state machine, not re-derived independently.
  const bruiserAlive = enemyAlive.find((h) => h.role === "bruiser");
  let bruiserDpsAvg = 0;
  if (bruiserAlive) {
    const cycleSec = cfg.windupIntervalSec + cfg.windupTelegraphSec;
    const normalAttacksPerCycle = cfg.windupIntervalSec / bruiserAlive.attackIntervalSec;
    const cycleDamage = normalAttacksPerCycle * bruiserAlive.damage + bruiserAlive.damage * cfg.windupDamageMultiplier;
    bruiserDpsAvg = cycleDamage / cycleSec;
  }
  const enemyDps = enemyRates.dps + bruiserDpsAvg;

  // 2026-08-22: surviveSec/tankHoldsSec go through survivalSecUnder rather
  // than dividing HP by `enemyDps - healPerSec` directly — dividing by that
  // difference's divide-by-zero GUARD, once healing caught up to it, was the
  // over-heal defect (see DECISIONS.md's 2026-08-22 entry and that
  // function's docstring).
  const surviveSec = survivalSecUnder(sideHp(player), enemyDps, healPerSec, cfg);
  const spareSec = surviveSec - killSec;
  const margin = surviveSec / Math.max(killSec, 0.01);

  const tank = playerAlive.find((h) => h.role === "tank") ?? null;
  let tankHoldsSec: number | null = null;
  if (tank) {
    const livingCount = playerAlive.length;
    const tankShare = cfg.tankTargetWeight / (cfg.tankTargetWeight + Math.max(livingCount - 1, 0));
    const bufferHp = tank.hp - cfg.tankBreakFraction * tank.maxHp;
    tankHoldsSec = survivalSecUnder(Math.max(bufferHp, 0), enemyDps * tankShare, healPerSec, cfg);
  }

  const band = bandFor(margin, tankHoldsSec, killSec);
  const { chainsExpected, chainLine } = chainProjectionFor(playerAlive, cfg, killSec, playerDps, enemyDps, healPerSec);

  const dealerNames = playerAlive
    .filter((h) => !h.healPerBeat || h.attacksWhileHealing)
    .map((h) => h.name)
    .join(" + ");
  const bruiser = enemyAlive.find((h) => h.role === "bruiser");
  const bruiserFallsAtSec = bruiser && playerDps > 0 ? bruiser.hp / playerDps : null;

  const lines: string[] = [];
  if (tank && tankHoldsSec !== null) {
    lines.push(`${tank.name} holds the line for about ${Math.round(tankHoldsSec)}s.`);
  }
  if (dealerNames && bruiserFallsAtSec !== null) {
    lines.push(`${dealerNames} drop${dealerNames.includes("+") ? "" : "s"} the ${bruiser?.name ?? "enemy"} around ${Math.round(bruiserFallsAtSec)}s.`);
  } else if (dealerNames) {
    lines.push(`${dealerNames} should win this in about ${Math.round(killSec)}s.`);
  }
  if (healPerSec > 0) {
    lines.push(`${playerAlive.find((h) => h.healPerBeat)?.name ?? "Your healer"} restores ${healPerSec.toFixed(1)}/s.`);
  }

  return {
    playerDps,
    enemyDps,
    healPerSec,
    killSec,
    surviveSec,
    spareSec,
    margin,
    band,
    tankName: tank?.name ?? null,
    tankHoldsSec,
    lines,
    verdict: verdictFor(band, tank?.name ?? null),
    chainsExpected,
    chainLine,
  };
}

/** Rounds to a 5s bucket rather than an exact second (2026-08-07 rebuild) —
 * a single precise number reads as a promise, and the wind-up risk
 * folded into the projection above makes a precise number dishonest anyway.
 * See this file's top docstring: this is the expectation to be surprised
 * relative to, not the forecast of what will happen. */
export function projectionSummary(spareSec: number): string {
  const bucket = Math.round(spareSec / 5) * 5;
  const sign = bucket >= 0 ? "should survive" : "expected loss";
  return `Floor: ${sign}, roughly ${Math.abs(bucket)}s ${bucket >= 0 ? "to spare" : "short"}.`;
}
