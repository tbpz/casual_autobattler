import type { FightConfig } from "./config.js";
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
  /** Seconds the player side survives the enemy's net DPS (after healing). */
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
 * outcome, and leaves room for the wind-up/enrage risk (folded into
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

/** Mean enrage multiplier over a fight of estimated length `durationSec`
 * (2026-08-07 rebuild) — the wall-clock term ramps linearly from 1x at
 * enrageStartSec, so the enraged portion's mean is its own midpoint; blended
 * against the pre-enrage portion (always 1x) by time share. An estimate, not
 * an exact replay of fight.ts's per-tick enrageMultiplierAt — this is a
 * pre-fight expectation, not a guarantee (see this file's top docstring).
 *
 * 2026-08-08 (root-cause pass): adds the mean contribution of the HP-lost
 * enrage term (see config.ts's enrageFromEnemyHpLostFactor docstring). Enemy
 * HP lost runs ~linearly 0->1 over the course of a fight regardless of its
 * length, so its mean over the whole fight is a flat half of the factor —
 * added on top of the wall-clock blend above rather than folded into it,
 * since the two terms are independent (one keyed to seconds, one to damage
 * dealt). */
function meanEnrageMultiplier(durationSec: number, cfg: FightConfig): number {
  const hpLostMeanTerm = cfg.enrageFromEnemyHpLostFactor * 0.5;
  if (durationSec <= cfg.enrageStartSec) return 1 + hpLostMeanTerm;
  const enragedSec = durationSec - cfg.enrageStartSec;
  const finalMult = 1 + enragedSec * cfg.enrageRampPerSec;
  const meanEnragedMult = (1 + finalMult) / 2;
  return (cfg.enrageStartSec * 1 + enragedSec * meanEnragedMult) / durationSec + hpLostMeanTerm;
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
  // damage — so it's unaffected by wind-up/enrage, same as before.
  const killSec = sideHp(enemy) / Math.max(playerDps, 0.01);

  // enemyDps folds in the wind-up's average contribution and the enrage
  // ramp's expected effect over a fight of ~killSec length (2026-08-07
  // rebuild) — without this the projection would still understate incoming
  // damage the way the old point-estimate did, just via a different gap.
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
  const enemyDpsPreEnrage = enemyRates.dps + bruiserDpsAvg;
  const enemyDps = enemyDpsPreEnrage * meanEnrageMultiplier(killSec, cfg);

  const netIncoming = Math.max(enemyDps - healPerSec, 0.01);
  const surviveSec = sideHp(player) / netIncoming;
  const spareSec = surviveSec - killSec;
  const margin = surviveSec / Math.max(killSec, 0.01);

  const tank = playerAlive.find((h) => h.role === "tank") ?? null;
  let tankHoldsSec: number | null = null;
  if (tank) {
    const livingCount = playerAlive.length;
    const tankShare = cfg.tankTargetWeight / (cfg.tankTargetWeight + Math.max(livingCount - 1, 0));
    const tankNetIncoming = Math.max(enemyDps * tankShare - healPerSec, 0.01);
    const bufferHp = tank.hp - cfg.tankBreakFraction * tank.maxHp;
    tankHoldsSec = Math.max(bufferHp, 0) / tankNetIncoming;
  }

  const band = bandFor(margin, tankHoldsSec, killSec);

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
  };
}

/** Rounds to a 5s bucket rather than an exact second (2026-08-07 rebuild) —
 * a single precise number reads as a promise, and the wind-up/enrage risk
 * folded into the projection above makes a precise number dishonest anyway.
 * See this file's top docstring: this is the expectation to be surprised
 * relative to, not the forecast of what will happen. */
export function projectionSummary(spareSec: number): string {
  const bucket = Math.round(spareSec / 5) * 5;
  const sign = bucket >= 0 ? "should survive" : "expected loss";
  return `Floor: ${sign}, roughly ${Math.abs(bucket)}s ${bucket >= 0 ? "to spare" : "short"}.`;
}
