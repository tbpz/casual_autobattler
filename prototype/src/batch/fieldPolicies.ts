/**
 * Fielding policies for the affinity-measurement harness (2026-08-19 — see
 * DECISIONS.md/STATE.md's attribution investigation and batch/affinity.ts).
 * These exist ONLY to be handed to runRun's opts.fieldPick — none of them are
 * wired into the shipped game or the played default path. roster.ts's
 * defaultFieldPick (role priority, ties by HP fraction) remains untouched and
 * is what every existing checks/chaindist.ts band is measured under.
 */
import type { FieldPick, FieldPickContext, RosterState } from "../sim/roster.js";
import { livingRosterHeroes } from "../sim/roster.js";
import type { HeroState, Role } from "../sim/types.js";

export type HeroScore = (h: HeroState) => number;

export const scoreHpFraction: HeroScore = (h) => (h.maxHp > 0 ? h.hp / h.maxHp : 0);
export const scoreAffinity: HeroScore = (h) => h.chainAffinity;
export const scoreCharge: HeroScore = (h) => h.charge;
/** The TRUE chain-output ranking — damage*affinity for an attacker,
 * heal*affinity for a healer (see fight.ts's chainAttackMagnitude/
 * resolveChainHit). Deliberately NOT unit-comparable across the
 * attacker/healer split (a healer's chain is HP restored, not damage) — used
 * here only to rank heroes against others of the same kind within a role
 * tier, never to compare a healer's number against an attacker's directly. */
export const scoreChainCoefficient: HeroScore = (h) => (h.healPerBeat ?? h.damage) * h.chainAffinity;

const FIELD_ROLE_ORDER: Role[] = ["tank", "damage", "support"];

/** Deterministic three-key comparator: score desc, then hpFraction desc, then
 * roster-array index asc. The third key is NOT optional — scoreCharge is 0
 * for every hero at fight 1 (charge only accrues by fighting), so a two-key
 * comparator would leave the very first fielding decision of every run to
 * Array.prototype.sort's stability guarantee, silently making that arm
 * unreproducible across a JS engine change. */
function rankHeroes(heroes: HeroState[], score: HeroScore, indexOf: Map<string, number>): HeroState[] {
  return [...heroes].sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    const hp = scoreHpFraction(b) - scoreHpFraction(a);
    if (hp !== 0) return hp;
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  });
}

/** Generalizes defaultFieldPick's own skeleton: with `roleFloor: true`, fills
 * one living hero per FIELD_ROLE_ORDER role (ranked by `score` within that
 * role, ties broken as above) before filling any remaining slots from the
 * rest of the living roster by `score`. With `roleFloor: false`, ranks the
 * ENTIRE living roster by `score` with no role guarantee at all — this is
 * the "naive" variant that can produce a degenerate comp (see
 * batch/affinity.ts's docstring on scoreChainCoefficient fielding zero
 * healers) and exists specifically so that degeneration is a labelled,
 * measured arm rather than an accident. */
export function rankedFieldPick(score: HeroScore, opts?: { roleFloor?: boolean }): FieldPick {
  const roleFloor = opts?.roleFloor ?? true;
  return (roster: RosterState, fieldSize: number, _ctx: FieldPickContext): string[] => {
    const living = livingRosterHeroes(roster);
    const indexOf = new Map(roster.heroes.map((h, i) => [h.id, i]));
    const pickedIds = new Set<string>();
    const picked: string[] = [];

    if (roleFloor) {
      for (const role of FIELD_ROLE_ORDER) {
        if (picked.length >= fieldSize) break;
        const candidates = living.filter((h) => h.role === role && !pickedIds.has(h.id));
        const best = rankHeroes(candidates, score, indexOf)[0];
        if (best) {
          picked.push(best.id);
          pickedIds.add(best.id);
        }
      }
    }

    if (picked.length < fieldSize) {
      const rest = living.filter((h) => !pickedIds.has(h.id));
      for (const h of rankHeroes(rest, score, indexOf)) {
        if (picked.length >= fieldSize) break;
        picked.push(h.id);
        pickedIds.add(h.id);
      }
    }
    return picked;
  };
}

export const FIELD_POLICIES: Record<string, FieldPick> = {
  affinityFloor: rankedFieldPick(scoreAffinity, { roleFloor: true }),
  affinityNaive: rankedFieldPick(scoreAffinity, { roleFloor: false }),
  chargeFloor: rankedFieldPick(scoreCharge, { roleFloor: true }),
  chainCoefficientFloor: rankedFieldPick(scoreChainCoefficient, { roleFloor: true }),
};
