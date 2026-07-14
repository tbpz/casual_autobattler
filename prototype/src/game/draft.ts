import { toHeroInstance, type HeroInstance } from "./hero";
import { findHeroDef, recruitablePool } from "./roster";

const UPGRADE_PCT = 0.25;

export type DraftOffer =
  | { readonly kind: "recruit"; readonly heroId: string; readonly label: string }
  | { readonly kind: "upgrade_hp"; readonly heroId: string; readonly label: string }
  | { readonly kind: "upgrade_dmg"; readonly heroId: string; readonly label: string };

function pick<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: readonly T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

/**
 * A 9 Kings-style draft: up to 3 random offers, one recruit (widens the pool) plus
 * per-hero upgrades (deepens the bench). Draft randomness is a meta-game concern, not
 * combat — it intentionally does not go through the sim's seeded RNG.
 */
export function generateDraftOffers(bench: readonly HeroInstance[]): DraftOffer[] {
  const offers: DraftOffer[] = [];

  const recruitCandidate = pick(recruitablePool(bench));
  if (recruitCandidate !== undefined) {
    const roleLabel = recruitCandidate.role === "melee_tank" ? "Tank" : "Archer";
    offers.push({ kind: "recruit", heroId: recruitCandidate.id, label: `Recruit ${recruitCandidate.name} (${roleLabel})` });
  }

  for (const hero of shuffled(bench)) {
    if (offers.length >= 3) break;
    const kind = Math.random() < 0.5 ? "upgrade_hp" : "upgrade_dmg";
    const label = kind === "upgrade_hp" ? `${hero.name}: +25% Max HP` : `${hero.name}: +25% Damage`;
    offers.push({ kind, heroId: hero.id, label });
  }

  return offers.slice(0, 3);
}

export function applyDraftOffer(bench: readonly HeroInstance[], offer: DraftOffer): HeroInstance[] {
  if (offer.kind === "recruit") {
    const def = findHeroDef(offer.heroId);
    return def === undefined ? [...bench] : [...bench, toHeroInstance(def)];
  }

  return bench.map((h) => {
    if (h.id !== offer.heroId) return h;
    if (offer.kind === "upgrade_hp") return { ...h, hpBonusPct: h.hpBonusPct + UPGRADE_PCT };
    return { ...h, dmgBonusPct: h.dmgBonusPct + UPGRADE_PCT };
  });
}
