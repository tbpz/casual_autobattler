/**
 * Where the HP fill and the Shield segment sit on a fight-screen HP bar
 * (DECISIONS.md 2026-10-01, "Shield shows as a segment on the HP bar").
 *
 * The bar means max HP until HP + Shield no longer fits under it; past that the
 * whole bar rescales so both fit, which is why the blue HP fill can get shorter
 * when a Shield lands. Both fractions are of the bar's width. The Shield runs
 * from the bar's left edge to `edgeFrac` and the HP fill paints over its left
 * part, so the visible Shield segment is the stretch from `hpFrac` to `edgeFrac`.
 */
export interface HpBarLayout {
  hpFrac: number;
  edgeFrac: number;
}

export function hpBarLayout(hp: number, maxHp: number, shield: number): HpBarLayout {
  if (maxHp <= 0) return { hpFrac: 0, edgeFrac: 0 };
  const h = Math.max(hp, 0);
  const s = Math.max(shield, 0);
  const total = Math.max(maxHp, h + s);
  return { hpFrac: h / total, edgeFrac: (h + s) / total };
}
