// The icons on an army's popup tiles and cards (2026-10-20; ported from design/tools/gen-armies.js's `I`). Each is the inner markup of a 24-unit
// viewBox, drawn in one colour. DOM-free: every export is data or a string.

export type ArmyGlyph = "grave" | "soul" | "drop" | "undying" | "roar" | "bite" | "herd" | "pack" | "bullet" | "repeat";

const sw = (c: string, w = 1.8): string => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const GLYPHS: Record<ArmyGlyph, (c: string) => string> = {
  grave: (c) => `<path d="M6 21 V10 A6 6 0 0 1 18 10 V21 Z" fill="${c}33" ${sw(c)}/><path d="M12 9 V15 M9.5 11.5 H14.5" ${sw(c, 1.6)}/>`,
  soul: (c) => `<path d="M12 3 C7 9 7 14 9 17 C10 19 11 20.5 12 21.5 C13 20.5 14 19 15 17 C17 14 17 9 12 3 Z" fill="${c}33" ${sw(c)}/><circle cx="10.3" cy="12.5" r="1.2" fill="${c}"/><circle cx="13.7" cy="12.5" r="1.2" fill="${c}"/>`,
  drop: (c) => `<path d="M12 3 C16.5 9 19 12 19 15.5 C19 19 15.9 21.5 12 21.5 C8.1 21.5 5 19 5 15.5 C5 12 7.5 9 12 3 Z" fill="${c}33" ${sw(c)}/>`,
  undying: (c) => `<path d="M12 21 V8 M6.5 13 L12 7.5 L17.5 13" ${sw(c, 2)}/><path d="M6 21 H18" ${sw(c, 1.8)}/>`,
  roar: (c) => `<path d="M5 8 Q9 12 5 16 M10 5.5 Q16 12 10 18.5 M15 3 Q23 12 15 21" ${sw(c, 1.8)}/>`,
  bite: (c) => `<path d="M4.5 6 H19.5 C19.5 11 17.5 13 15.8 13 L14.2 19.5 L12.8 13.5 H11.2 L9.8 19.5 L8.2 13 C6.5 13 4.5 11 4.5 6 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  herd: (c) => `<path d="M8 21 V13 M16 21 V13 M8 13 C7 9 5 7 4 4 M8 13 C9 10 10 8 10 5 M16 13 C17 9 19 7 20 4 M16 13 C15 10 14 8 14 5" ${sw(c, 1.7)}/>`,
  pack: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M7 16 C7 13 17 13 17 16 C17 19 14 19.5 12 19.5 C10 19.5 7 19 7 16 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
};

/** An icon as an inline svg, `size` px square, drawn in `hex`. */
export function armyIconSvg(glyph: ArmyGlyph, hex: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;overflow:visible">${GLYPHS[glyph](hex)}</svg>`;
}

/** The glyph each army skill wears, by its chain effect id (sim/config.ts). */
export const SKILL_ICON: Record<string, ArmyGlyph> = {
  graveGuard: "grave",
  soulBolt: "soul",
  bloodRite: "drop",
  roar: "roar",
  packBite: "bite",
  herd: "herd",
};

/** The glyph each army's rule wears. */
export const RULE_ICON = { undead: "undying", beasts: "pack" } as const;
