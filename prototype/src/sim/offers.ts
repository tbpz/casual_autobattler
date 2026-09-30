import type { Rng } from "./rng.js";
import type { ChainEffect, RunConfig } from "./config.js";
import { chainEffectVerb } from "./config.js";
import type { PayoffId } from "./payoffs.js";
import { PAYOFF_DEFS, PAYOFF_IDS, payoffConnects, pickPayoffToDrop } from "./payoffs.js";
import type { SideState } from "./types.js";
import type { PlayerRole } from "./roles.js";
import { PLAYER_ROLES, ROLE_CHAIN_UPGRADE, ROLE_LABEL, makeUnitState } from "./roles.js";
import type { RunProgress } from "./progress.js";

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md).
 * Replaces the old coin spend (heal / bank upgrade / skip, the same three
 * options every single win) — Tu's ask: "each win in the run can provide
 * other upgrade option like more number in the role... or some other
 * things. Should be just 3 upgraded choice per round," drawn from a pool
 * wide enough that "two runs look different, and there is always something
 * you have not seen yet" (STATE.md's framing for why this exists at all).
 *
 * Every offer is pure data plus two pure functions (drawOffers/applyOffer)
 * so the headless run driver (sim/run.ts) and the interactive UI
 * (render/offerScreen.ts) read the exact same rules.
 */
export type OfferKind = "chainLevel" | "chainGain" | "payoff" | "recruit" | "statHp" | "statDamage" | "heal" | "revive" | "slot";

export interface Offer {
  kind: OfferKind;
  role?: PlayerRole;
  /** "chainGain" only — the ability this role's chain gains, added to
   * whatever it already does (2026-09-29, add-don't-swap — see
   * DECISIONS.md). */
  effect?: ChainEffect;
  /** "payoff" only — the squad-wide card this offer adds (2026-09-30;
   * sim/payoffs.ts). At the payoff cap, taking it means dropping a held one:
   * applyOffer's `dropPayoffId`. */
  payoff?: PayoffId;
  /** "payoff" only — true when the card reads a mark the squad can already
   * make, so the offer screen can highlight the connection. */
  connects?: boolean;
  /** "revive" only — which fallen unit this offer brings back, chosen at
   * draw time so applyOffer doesn't have to guess. */
  unitId?: string;
  title: string;
  detail: string;
}

interface OfferTemplate {
  /** Dedup key — two templates that could ever both be eligible at once must
   * have distinct keys, or drawOffers could show the same offer twice. */
  key: string;
  /** "small" offers are common early, rare late; "big" offers are the
   * reverse — see weightFor below. */
  size: "small" | "big" | "payoff";
  /** "payoff" templates only — which card, so drawOffers can tilt the weight
   * toward cards that connect to what the squad can make. */
  payoff?: PayoffId;
  /** "chainGain" templates only — the ability it would add, so drawOffers can
   * tilt toward a gain that unlocks a payoff card the run already holds. */
  gainEffect?: ChainEffect;
  eligible(progress: RunProgress, roster: SideState, cfg: RunConfig): boolean;
  build(progress: RunProgress, roster: SideState, cfg: RunConfig): Offer;
}

function templatesFor(cfg: RunConfig): OfferTemplate[] {
  const templates: OfferTemplate[] = [];

  for (const role of PLAYER_ROLES) {
    const label = ROLE_LABEL[role];

    templates.push({
      key: `chainLevel:${role}`,
      size: "small",
      eligible: (progress) => progress.chain[role].level < cfg.chainLevelCap,
      build: (progress) => {
        // Badge value after taking this offer (progress.ts's
        // chainStrongerCount: level - 1, since level 1 is the no-op default
        // and never shows a badge at all).
        const nextBadge = progress.chain[role].level + cfg.chainLevelStep - 1;
        return {
          kind: "chainLevel",
          role,
          title: `${label} chain — stronger (+${nextBadge})`,
          detail: `Every ${label.toLowerCase()}'s chain leaves one more mark stack per hit.`,
        };
      },
    });

    templates.push({
      key: `chainGain:${role}`,
      size: "big",
      gainEffect: ROLE_CHAIN_UPGRADE[role],
      eligible: (progress) => !progress.chain[role].effects.includes(ROLE_CHAIN_UPGRADE[role]),
      build: () => {
        const upgrade = ROLE_CHAIN_UPGRADE[role];
        // 2026-09-29 (add-don't-swap — see DECISIONS.md): every chain hit now
        // does EVERY ability the chain has, so this reads as "also", never
        // "instead of" — Tu: "the chain is upgraded and accumulate these
        // ability, that's all."
        const line = `Also ${chainEffectVerb(upgrade)}.`;
        return {
          kind: "chainGain",
          role,
          effect: upgrade,
          title: `${label} chain — gains an ability`,
          detail: line,
        };
      },
    });

    templates.push({
      key: `recruit:${role}`,
      size: "small",
      eligible: (_progress, roster) => roster.heroes.length < cfg.maxRosterSize,
      build: () => ({
        kind: "recruit",
        role,
        title: `Recruit a ${label.toLowerCase()}`,
        detail: `Adds a fresh ${label.toLowerCase()} to your roster.`,
      }),
    });

    templates.push({
      key: `statHp:${role}`,
      size: "small",
      eligible: () => true,
      build: () => ({
        kind: "statHp",
        role,
        title: `${label} — tougher`,
        detail: `+${cfg.statHpStep} max HP for every ${label.toLowerCase()}, now and future.`,
      }),
    });

    templates.push({
      key: `statDamage:${role}`,
      size: "small",
      eligible: () => true,
      build: () => ({
        kind: "statDamage",
        role,
        title: `${label} — harder-hitting`,
        detail: `+${cfg.statDamageStep} damage for every ${label.toLowerCase()}, now and future.`,
      }),
    });
  }

  for (const id of PAYOFF_IDS) {
    templates.push({
      key: `payoff:${id}`,
      size: "payoff",
      payoff: id,
      // Not offered until the player has met every mark it reads — seen on an
      // ability offer or made by the squad — so no card asks for a judgment
      // about a mark nothing has introduced yet.
      eligible: (progress) => !progress.payoffs.includes(id) && payoffConnects(id, progress.introduced),
      build: (progress, roster) => ({
        kind: "payoff",
        payoff: id,
        connects: payoffConnects(id, squadChainEffects(progress, roster)),
        title: PAYOFF_DEFS[id].title,
        detail: PAYOFF_DEFS[id].detail,
      }),
    });
  }

  templates.push({
    key: "heal",
    size: "small",
    eligible: (_progress, roster) => roster.heroes.some((h) => h.alive && h.hp < h.maxHp),
    build: () => ({
      kind: "heal",
      title: "Patch up",
      detail: `+${cfg.healFlatAmount} HP to every living unit.`,
    }),
  });

  templates.push({
    key: "revive",
    size: "small",
    eligible: (_progress, roster) => roster.heroes.some((h) => !h.alive),
    build: (_progress, roster) => {
      const fallen = roster.heroes.filter((h) => !h.alive);
      const unit = fallen[fallen.length - 1]!;
      return {
        kind: "revive",
        unitId: unit.id,
        title: `Revive ${unit.name}`,
        detail: `Brings ${unit.name} back at ${Math.round(cfg.reviveHpFraction * 100)}% HP.`,
      };
    },
  });

  templates.push({
    key: "slot",
    size: "big",
    eligible: (progress) => progress.slots < cfg.maxSlots,
    build: (progress) => ({
      kind: "slot",
      title: "Bigger squad",
      detail: `Field ${progress.slots + 1} units each round instead of ${progress.slots}.`,
    }),
  });

  return templates;
}

/** Small early, big late — a linear ramp over how far into the run this win
 * landed (0 at round 1, 1 at the last round), same "weighted by how far
 * into the run you are" rule confirmed before writing this file. */
function weightFor(size: "small" | "big", roundsIntoRun: number): number {
  return size === "small" ? 1 - 0.6 * roundsIntoRun : 0.2 + 0.9 * roundsIntoRun;
}

/** Every chain ability the roster's roles carry right now — what the squad
 * can make marks with, for the payoff connection test. A role with no unit
 * on the roster contributes nothing. */
export function squadChainEffects(progress: RunProgress, roster: SideState): ChainEffect[] {
  const effects: ChainEffect[] = [];
  for (const role of PLAYER_ROLES) {
    if (roster.heroes.some((h) => h.role === role)) effects.push(...progress.chain[role].effects);
  }
  return effects;
}

/** Records every ability a drawn "chainGain" offer puts on screen as
 * introduced, so payoff cards that read its mark may appear from the next draw
 * on. Call right after drawOffers; pure. */
export function noteIntroduced(progress: RunProgress, offers: readonly Offer[]): RunProgress {
  const fresh = offers
    .map((o) => (o.kind === "chainGain" ? o.effect : undefined))
    .filter((e): e is ChainEffect => e !== undefined && !progress.introduced.includes(e));
  return fresh.length === 0 ? progress : { ...progress, introduced: [...progress.introduced, ...fresh] };
}

/** Draws cfg.offersPerWin distinct offers, weighted by how far into the run
 * `round` (0-based) is. Never throws on a thin eligible pool — if fewer than
 * offersPerWin templates are eligible, it just returns what it found.
 *
 * Guarantees a way back whenever something has ALREADY gone wrong and the
 * roster has no cushion left to absorb the next one — found by actually
 * playing this: a unit died in round 2, the ordinary weighted draw happened
 * not to offer revive or a recruit, and the run ended right there with no
 * way for the player to have seen it coming or done anything about it.
 * That's a coin flip on the offer draw, not the loss the run is supposed to
 * be about. One of the three offers is now always the fix (revive the
 * fallen unit, or recruit for whichever role is thinnest) whenever the
 * roster has a fallen unit AND no living cushion above what's fielded, or
 * whenever living has fallen strictly BELOW slots (a "slot" offer taken
 * faster than the roster grew into it) — not merely whenever living ==
 * slots, which is the ordinary, healthy starting state every run begins in
 * and would otherwise force a recruit into round 1 every single time. */
export function drawOffers(rng: Rng, progress: RunProgress, roster: SideState, cfg: RunConfig, round: number): Offer[] {
  const roundsIntoRun = cfg.roundsPerRun > 1 ? round / (cfg.roundsPerRun - 1) : 0;
  const eligible = templatesFor(cfg).filter((t) => t.eligible(progress, roster, cfg));

  // Payoff cards (2026-09-30) draw at a flat weight, boosted when the card
  // reads a mark the squad can already make — with ~19 picks in a run, a
  // purely random draw would almost never complete a build.
  const effects = squadChainEffects(progress, roster);
  // The mirror tilt: an ability gain that would unlock a payoff card the run
  // already holds (and that nothing the squad has now unlocks) is boosted the
  // same way, so holding Shatter makes Freeze show up.
  const unlocksHeld = (gain: ChainEffect): boolean =>
    progress.payoffs.some((id) => payoffConnects(id, [gain]) && !payoffConnects(id, effects));
  const pool = eligible.map((t) => ({
    t,
    weight:
      t.size === "payoff"
        ? cfg.payoffWeight * (t.payoff && payoffConnects(t.payoff, effects) ? 1 + cfg.payoffConnectBoost : 1)
        : t.gainEffect
          ? // An ability gain is a build piece like a payoff card, so it draws at
            // the same flat weight instead of the late-run ramp of a "big" offer.
            cfg.payoffWeight * (unlocksHeld(t.gainEffect) ? 1 + cfg.payoffConnectBoost : 1)
          : Math.max(0.01, weightFor(t.size, roundsIntoRun)),
  }));
  const chosen: OfferTemplate[] = [];

  const living = roster.heroes.filter((h) => h.alive).length;
  const hasFallen = roster.heroes.some((h) => !h.alive);
  const needsSafetyNet = living < progress.slots || (hasFallen && living <= progress.slots);
  if (needsSafetyNet) {
    const reviveIdx = pool.findIndex((p) => p.t.key === "revive");
    if (reviveIdx >= 0) {
      chosen.push(pool[reviveIdx]!.t);
      pool.splice(reviveIdx, 1);
    } else {
      const thinnestRole = [...PLAYER_ROLES].sort(
        (a, b) =>
          roster.heroes.filter((h) => h.role === a && h.alive).length - roster.heroes.filter((h) => h.role === b && h.alive).length,
      )[0]!;
      const recruitIdx = pool.findIndex((p) => p.t.key === `recruit:${thinnestRole}`);
      if (recruitIdx >= 0) {
        chosen.push(pool[recruitIdx]!.t);
        pool.splice(recruitIdx, 1);
      }
    }
  }

  // Guaranteed build pieces (2026-09-30): with a dozen-odd number offers in
  // the pool, a purely weighted draw buries the payoff cards and ability gains
  // a build is made of — and a run only has ~5-19 picks. The first
  // cfg.buildOffersGuaranteed non-safety-net slots draw from those only.
  const isBuildPiece = (t: OfferTemplate): boolean => t.size === "payoff" || t.gainEffect !== undefined;
  const draw = (candidates: typeof pool): void => {
    const total = candidates.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng.next() * total;
    let pick = candidates[candidates.length - 1]!;
    for (const cand of candidates) {
      roll -= cand.weight;
      if (roll <= 0) {
        pick = cand;
        break;
      }
    }
    chosen.push(pick.t);
    pool.splice(pool.indexOf(pick), 1);
  };
  for (let g = 0; g < cfg.buildOffersGuaranteed && chosen.length < cfg.offersPerWin; g++) {
    const pieces = pool.filter((p) => isBuildPiece(p.t));
    if (pieces.length === 0) break;
    draw(pieces);
  }

  while (chosen.length < cfg.offersPerWin && pool.length > 0) draw(pool);
  return chosen.map((t) => t.build(progress, roster, cfg));
}

/** Applies one chosen offer, returning a fresh (progress, roster) pair —
 * pure, so both the headless run driver and the interactive round loop use
 * the identical rule. */
export function applyOffer(
  progress: RunProgress,
  roster: SideState,
  offer: Offer,
  cfg: RunConfig,
  dropPayoffId?: PayoffId,
): { progress: RunProgress; roster: SideState } {
  switch (offer.kind) {
    case "payoff": {
      const id = offer.payoff!;
      if (progress.payoffs.includes(id)) return { progress, roster };
      // At the cap the new card replaces one held (2026-09-30 decision);
      // the caller must say which. Below the cap it is simply added.
      if (progress.payoffs.length >= cfg.payoffCap) {
        if (!dropPayoffId || !progress.payoffs.includes(dropPayoffId)) {
          throw new Error("applyOffer: payoff cap reached — a held card must be named to drop");
        }
        const kept = progress.payoffs.filter((p) => p !== dropPayoffId);
        return { progress: { ...progress, payoffs: [...kept, id] }, roster };
      }
      return { progress: { ...progress, payoffs: [...progress.payoffs, id] }, roster };
    }
    case "chainLevel": {
      const role = offer.role!;
      const next = { ...progress.chain[role], level: progress.chain[role].level + cfg.chainLevelStep };
      return { progress: { ...progress, chain: { ...progress.chain, [role]: next } }, roster };
    }
    case "chainGain": {
      const role = offer.role!;
      // Appends, never replaces (2026-09-29, add-don't-swap — see
      // DECISIONS.md): every chain hit resolves every ability in this list.
      const next = { ...progress.chain[role], effects: [...progress.chain[role].effects, offer.effect!] };
      return { progress: { ...progress, chain: { ...progress.chain, [role]: next } }, roster };
    }
    case "statHp": {
      const role = offer.role!;
      const bonus = { ...progress.bonus[role], maxHp: progress.bonus[role].maxHp + cfg.statHpStep };
      const heroes = roster.heroes.map((h) =>
        h.role === role && h.alive ? { ...h, maxHp: h.maxHp + cfg.statHpStep, hp: h.hp + cfg.statHpStep } : h,
      );
      return { progress: { ...progress, bonus: { ...progress.bonus, [role]: bonus } }, roster: { ...roster, heroes } };
    }
    case "statDamage": {
      const role = offer.role!;
      const bonus = { ...progress.bonus[role], damage: progress.bonus[role].damage + cfg.statDamageStep };
      const heroes = roster.heroes.map((h) => (h.role === role && h.alive ? { ...h, damage: h.damage + cfg.statDamageStep } : h));
      return { progress: { ...progress, bonus: { ...progress.bonus, [role]: bonus } }, roster: { ...roster, heroes } };
    }
    case "recruit": {
      const role = offer.role!;
      const ordinal = roster.heroes.filter((h) => h.role === role).length + 1;
      const unit = makeUnitState(role, ordinal, `u${roster.heroes.length}_${role}`, progress.bonus[role]);
      return { progress, roster: { ...roster, heroes: [...roster.heroes, unit] } };
    }
    case "heal": {
      const heroes = roster.heroes.map((h) => (h.alive ? { ...h, hp: Math.min(h.maxHp, h.hp + cfg.healFlatAmount) } : h));
      return { progress, roster: { ...roster, heroes } };
    }
    case "revive": {
      const heroes = roster.heroes.map((h) =>
        h.id === offer.unitId ? { ...h, alive: true, hp: Math.round(h.maxHp * cfg.reviveHpFraction) } : h,
      );
      return { progress, roster: { ...roster, heroes } };
    }
    case "slot": {
      return { progress: { ...progress, slots: Math.min(cfg.maxSlots, progress.slots + 1) }, roster };
    }
  }
}

/** The headless drop choice when a payoff offer is taken at the cap — the
 * interactive UI asks the player instead. Undefined when there is nothing to
 * drop (below the cap, or not a payoff offer). */
export function defaultPayoffDrop(progress: RunProgress, roster: SideState, offer: Offer, cfg: RunConfig): PayoffId | undefined {
  if (offer.kind !== "payoff" || progress.payoffs.length < cfg.payoffCap) return undefined;
  return pickPayoffToDrop(progress.payoffs, squadChainEffects(progress, roster));
}
