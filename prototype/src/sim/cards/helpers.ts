import type { HeroState } from "../types.js";
import type { CardApi } from "./types.js";

/** Small lookups the card definitions share. Cards belong to the player, so
 * "ally" is the player's side and "enemy" the other. */

const living = (h: HeroState): boolean => h.alive && h.hp > 0;

export function livingEnemies(api: CardApi): HeroState[] {
  return api.enemy.heroes.filter(living);
}

export function livingAllies(api: CardApi): HeroState[] {
  return api.player.heroes.filter(living);
}

/** The front-most living enemy — the same body a normal player attack targets. */
export function frontEnemy(api: CardApi): HeroState | undefined {
  return api.enemy.heroes.find(living);
}

/** The living ally with the lowest HP fraction. */
export function weakestAlly(api: CardApi): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of api.player.heroes) {
    if (!living(h)) continue;
    if (!best || h.hp / h.maxHp < best.hp / best.maxHp) best = h;
  }
  return best;
}

/** The living ally carrying the most fatigue. */
export function mostWornAlly(api: CardApi): HeroState | undefined {
  let best: HeroState | undefined;
  for (const h of api.player.heroes) {
    if (!living(h)) continue;
    if (!best || h.fatigue > best.fatigue) best = h;
  }
  return best;
}

/** The living enemy after `after` in list order — where a spreading mark goes. */
export function nextEnemy(api: CardApi, after: HeroState): HeroState | undefined {
  return api.enemy.heroes.find((h) => h !== after && living(h));
}
