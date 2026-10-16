import { chainEffectChip, type ChainEffect } from "../sim/config.js";
import type { FightResult } from "../sim/events.js";
import type { Role } from "../sim/types.js";
import { ROLE_HEX, esc } from "./roundParts.js";

/**
 * The best moment of a fight (canvas 5.6, 5.7 and 7.1): the unit's longest skill run, "IVY · EXPOSE ×4 — 104 damage".
 * Read from the finished fight's chainEnd events: the most hits, ties broken by the bigger total. A run of one is no moment, and
 * a fight with no repeat has none. DOM-free so a check can import it.
 */
export interface BestMoment {
  heroId: string;
  name: string;
  role: Role;
  /** The base skill's word in capitals: "EXPOSE", "GUARD", "MEND". */
  skill: string;
  hits: number;
  /** Total damage (or healing, for a heal skill); 0 for a skill with no honest figure, such as a Guard. */
  amount: number;
  heals: boolean;
  backfire: boolean;
}

export function bestMoment(result: FightResult): BestMoment | null {
  const heroes = new Map(result.finalPlayerHeroes.map((h) => [h.id, h]));
  let best: BestMoment | null = null;
  for (const e of result.events) {
    if (e.type !== "chainEnd" || e.chainLength < 2) continue;
    const hero = heroes.get(e.heroId);
    if (!hero) continue;
    const effects = e.effects as ChainEffect[];
    const first = effects[0];
    const candidate: BestMoment = {
      heroId: e.heroId,
      name: hero.name,
      role: hero.role,
      skill: first ? chainEffectChip(first).word.toUpperCase() : "SKILL",
      hits: e.chainLength,
      // A Guard moves no HP: the damage its exposed marks add is not a figure the player can attribute to it.
      amount: first === "guard" ? 0 : Math.round(e.totalDamage),
      heals: first === "mend" || first === "ward" || first === "cauterize",
      backfire: e.backfire,
    };
    if (!best || candidate.hits > best.hits || (candidate.hits === best.hits && candidate.amount > best.amount)) best = candidate;
  }
  return best;
}

/** "IVY · EXPOSE ×4 — 104 damage" as markup, with the unit's name white, the skill in its role colour and the count yellow. */
export function momentHtml(m: BestMoment, suffix = ""): string {
  const hex = m.role === "tank" || m.role === "damage" || m.role === "support" ? ROLE_HEX[m.role] : "#e8e8ee";
  const amount = m.amount > 0 ? ` — ${m.amount} ${m.heals ? "healed" : "damage"}` : "";
  return `<span class="bm-name">${esc(m.name.toUpperCase())}</span> · <span style="color:${hex}">${m.skill}</span> <span class="bm-x">×${m.hits}</span><span class="bm-amount">${amount}${suffix ? ` · ${esc(suffix)}` : ""}</span>`;
}
