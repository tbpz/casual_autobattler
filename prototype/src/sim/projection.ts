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
 * spare, not just barely surviving to the final bell. This is deliberately
 * the same real mechanism fight.ts gates the cascade on (tankBreakFraction /
 * the gate condition), not a separate aggregate-HP heuristic: aggregate pool
 * math alone rewards raw kill speed over survivability (a fast-killing
 * glass-cannon comp can out-DPS-race a slow tank on paper while still being
 * the comp that gets someone killed) and undersells the tank's actual job,
 * which is concentrating damage rather than shrinking the total. */
const TANK_HOLDS_COMFORTABLE_RATIO = 1.25;
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

function verdictFor(band: MarginBand, tankName: string | null): string {
  switch (band) {
    case "comfortable":
      return "Comfortable. You should win this clean.";
    case "tight":
      return tankName
        ? `Tight. ${tankName} won't hold the whole fight.`
        : "Tight. No one's holding the line — it'll be close.";
    case "losing":
      return "You probably lose this. Unless something goes right.";
  }
}

/** Mean per-second output of a living side, split into damage dealers and
 * healers — a hero with healPerBeat is a healer for this purpose even though
 * it also carries a (small) damage stat, matching fight.ts's performHeroAction. */
function sideRates(heroes: HeroState[]): { dps: number; healPerSec: number } {
  let dps = 0;
  let healPerSec = 0;
  for (const h of heroes) {
    if (!h.alive) continue;
    if (h.healPerBeat) {
      healPerSec += h.healPerBeat / h.attackIntervalSec;
    } else {
      dps += h.damage / h.attackIntervalSec;
    }
  }
  return { dps, healPerSec };
}

export function project(player: SideState, enemy: SideState, cfg: FightConfig): Projection {
  const playerAlive = player.heroes.filter((h) => h.alive);
  const enemyAlive = enemy.heroes.filter((h) => h.alive);

  const playerRates = sideRates(playerAlive);
  const enemyRates = sideRates(enemyAlive);
  const playerDps = playerRates.dps + player.dpsBonus * playerAlive.filter((h) => !h.healPerBeat).length;
  const enemyDps = enemyRates.dps;
  const healPerSec = playerRates.healPerSec;

  const killSec = sideHp(enemy) / Math.max(playerDps, 0.01);
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
    .filter((h) => !h.healPerBeat)
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

export function projectionSummary(spareSec: number): string {
  const sign = spareSec >= 0 ? "clean win" : "expected loss";
  return `Projection: ${sign}, about ${Math.abs(Math.round(spareSec))}s ${spareSec >= 0 ? "to spare" : "short"}.`;
}
