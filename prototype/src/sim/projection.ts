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
   * `sideHp(player) / (enemyDps - healPerSec)` — `enemyDps` is a single
   * flat rate meaned over the [0, killSec] window (see meanEnrageMultiplier),
   * which has no defined meaning once you ask "how long could this run
   * past killSec." This instead solves survivalSecUnder's closed form
   * against the real, uncapped enrage ramp directly, clamped at
   * cfg.maxFightSec — see that function's docstring. */
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
  /** Number of enrage CLOCK tiers expected to land before the fight's
   * projected kill time (2026-08-26 visibility pass — see
   * enrageForecastFor). */
  enrageTiersExpected: number;
  /** One-sentence pre-fight tempo forecast — "kills in ~Ns — M CLOCK tiers,
   * WOUNDED near Ks" — so a chain shape's tempo tradeoff (a grinder spends
   * more seconds realizing the same value than a burster) is knowable
   * BEFORE the pick, not just legible once the fight is already running
   * (see fightView.ts's enrageHud). This is the piece meant to move L4 from
   * "connect it" to "change it" in the attribution test. */
  enrageLine: string;
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
 * (2026-08-07 rebuild, restated for the step CLOCK/WOUNDED split 2026-08-26 —
 * see config.ts's FightConfig docstring). CLOCK is now piecewise CONSTANT
 * per tier rather than a linear ramp, so its mean is just each tier
 * segment's multiplier weighted by how much of `durationSec` falls inside
 * it — no midpoint blend needed anymore. An estimate, not an exact replay of
 * fight.ts's per-tick enrageMultiplierAt — this is a pre-fight expectation,
 * not a guarantee (see this file's top docstring).
 *
 * WOUNDED's mean term keeps the 2026-08-08 root-cause pass's convention:
 * enemy HP lost runs ~linearly 0->1 over the course of a fight regardless of
 * its length, so WOUNDED (firing once HP lost crosses woundedHpFraction)
 * is active for the back `1 - woundedHpFraction` share of the fight — added
 * on top of the CLOCK weighting rather than folded into it, since the two
 * terms are independent (one keyed to seconds, one to damage dealt). */
function meanEnrageMultiplier(durationSec: number, cfg: FightConfig): number {
  const woundedMeanTerm = cfg.woundedMultiplier * Math.max(0, 1 - cfg.woundedHpFraction);
  if (durationSec <= 0) return 1 + woundedMeanTerm;
  const secs = cfg.enrageTierSecs;
  const mults = cfg.enrageTierMultipliers;
  let weighted = 0;
  for (let i = 0; i < secs.length; i++) {
    const segStart = Math.min(secs[i] as number, durationSec);
    const segEnd = i + 1 < secs.length ? Math.min(secs[i + 1] as number, durationSec) : durationSec;
    if (segEnd > segStart) weighted += (segEnd - segStart) * (mults[i] as number);
  }
  return 1 + weighted / durationSec + woundedMeanTerm;
}

/** Number of CLOCK tiers expected to land before a fight of ~killSec length
 * ends, plus a one-line pre-fight forecast (2026-08-26 visibility pass) —
 * the pick-time half of making shape a real lever: the field-pick screen can
 * now state which threat a squad is walking into BEFORE the pick is
 * committed, not just render it once the fight starts (see fightView.ts's
 * enrageHud). WOUNDED is treated as near-certain in any won fight (every WIN
 * ends at 100% enemy HP lost by definition — same fact config.ts's
 * woundedHpFraction docstring notes), so this states WHEN it lands, not IF. */
function enrageForecastFor(killSec: number, cfg: FightConfig): { tiersExpected: number; line: string } {
  const tiersExpected = cfg.enrageTierSecs.filter((s) => s < killSec).length;
  const woundedAtSec = killSec * cfg.woundedHpFraction;
  const tierPart = tiersExpected === 0 ? "no CLOCK tiers" : `${tiersExpected} CLOCK tier${tiersExpected === 1 ? "" : "s"}`;
  return { tiersExpected, line: `Kills in ~${Math.round(killSec)}s — ${tierPart}, WOUNDED near ${Math.round(woundedAtSec)}s.` };
}

/**
 * Time for `hpPool` to deplete under a net incoming rate that steps at each
 * CLOCK tier (2026-08-22 fix restated for the step split, 2026-08-26 — see
 * DECISIONS.md for both entries).
 *
 * `meanEnrageMultiplier` above answers "what's the mean incoming rate over a
 * fight of THIS length" — a single flat number, fine for comparing against a
 * fixed `killSec`. It has no meaning for "how long could survival run past
 * killSec," which is exactly the question a squad that out-heals mean
 * incoming damage asks: `Math.max(enemyDps - healPerSec, 0.01)` used to
 * answer that by dividing by the divide-by-zero GUARD itself, manufacturing
 * a fake number in the tens of thousands of seconds (confirmed live: a
 * healer draft against the "Anvil" encounter reads exactly 189.15/0.01 =
 * 18915). This solves the real question instead, and — since CLOCK is now
 * piecewise CONSTANT per tier rather than a linear ramp — solves it as a
 * plain walk over rate segments instead of the old ramp's quadratic:
 *
 * WOUNDED's contribution is held at its existing frozen mean approximation
 * (`woundedMultiplier * (1 - woundedHpFraction)`, same convention
 * meanEnrageMultiplier uses) rather than timed exactly against this
 * survival curve — deliberately not re-derived past killSec, same judgment
 * call the 2026-08-22 pass made for the old HP-lost term (a slightly
 * optimistic tail, not worth a kink in the curve for zero band impact).
 *
 * For each tier segment [boundaries[i], boundaries[i+1]) — segment 0 is
 * [0, enrageTierSecs[0]) at no CLOCK bonus, the last segment runs to
 * Infinity at the final tier's bonus — the segment's net rate is
 * `basePreEnrageDps * (1 + woundedMeanTerm + tierBonus) - healPerSec`. A
 * non-positive rate means the pool doesn't deplete anywhere in that segment
 * (net healing, or holding steady) — including forever, if that's the last
 * (infinite) segment, which is this function's only "never depletes"
 * outcome now (no separate bk<=0 branch needed: an empty enrageTierSecs
 * array degenerates to exactly one infinite segment at no CLOCK bonus,
 * which is the old flat-rate case). A positive rate either finishes the
 * pool inside the segment or leaves a remainder carried into the next
 * segment — no "bank negative damage during net healing" bug (the pre-2026-
 * 08-22 divide-by-zero bug's own root cause) is possible, since a
 * non-depleting segment carries `remaining` forward unchanged rather than
 * letting it go negative. Clamped to `cfg.maxFightSec` — the sim's own hard
 * tick cutoff (fight.ts's `maxTicks`), so a real ceiling rather than
 * `Infinity`, which would otherwise reach `Math.round`/`projectionSummary`
 * downstream and print literally.
 */
function survivalSecUnder(hpPool: number, basePreEnrageDps: number, healPerSec: number, cfg: FightConfig): number {
  if (hpPool <= 0) return 0;
  const woundedMeanTerm = cfg.woundedMultiplier * Math.max(0, 1 - cfg.woundedHpFraction);
  const boundaries = [0, ...cfg.enrageTierSecs, Infinity];
  const tierBonuses = [0, ...cfg.enrageTierMultipliers];
  let remaining = hpPool;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = boundaries[i] as number;
    const segEnd = boundaries[i + 1] as number;
    const rate = basePreEnrageDps * (1 + woundedMeanTerm + (tierBonuses[i] as number)) - healPerSec;
    if (rate <= 0) continue; // no depletion this segment; remaining carries forward unchanged
    const segDur = segEnd - segStart;
    const timeNeeded = remaining / rate;
    if (isFinite(segDur) && timeNeeded > segDur) {
      remaining -= rate * segDur;
      continue;
    }
    return Math.min(segStart + timeNeeded, cfg.maxFightSec);
  }
  return cfg.maxFightSec; // never depletes — the final (infinite) segment's rate was <= 0
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

  // 2026-08-22: surviveSec/tankHoldsSec solve the real enrage ramp via
  // survivalSecUnder (see that function's docstring) instead of dividing by
  // enemyDps — enemyDps is a flat mean over [0, killSec] and dividing HP by
  // a divide-by-zero GUARD once healing caught up to it was the bug (see
  // DECISIONS.md's 2026-08-22 entry). Both calls pass enemyDpsPreEnrage
  // (the un-meaned rate), letting survivalSecUnder apply the real ramp
  // itself rather than the killSec-anchored mean.
  const surviveSec = survivalSecUnder(sideHp(player), enemyDpsPreEnrage, healPerSec, cfg);
  const spareSec = surviveSec - killSec;
  const margin = surviveSec / Math.max(killSec, 0.01);

  const tank = playerAlive.find((h) => h.role === "tank") ?? null;
  let tankHoldsSec: number | null = null;
  if (tank) {
    const livingCount = playerAlive.length;
    const tankShare = cfg.tankTargetWeight / (cfg.tankTargetWeight + Math.max(livingCount - 1, 0));
    const bufferHp = tank.hp - cfg.tankBreakFraction * tank.maxHp;
    tankHoldsSec = survivalSecUnder(Math.max(bufferHp, 0), enemyDpsPreEnrage * tankShare, healPerSec, cfg);
  }

  const band = bandFor(margin, tankHoldsSec, killSec);
  const { chainsExpected, chainLine } = chainProjectionFor(playerAlive, cfg, killSec, playerDps, enemyDps, healPerSec);
  const { tiersExpected: enrageTiersExpected, line: enrageLine } = enrageForecastFor(killSec, cfg);

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
    enrageTiersExpected,
    enrageLine,
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
