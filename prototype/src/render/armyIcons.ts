// The icons on an army's popup tiles and cards (2026-10-20; ported from design/tools/gen-armies.js's `I`). Each is the inner markup of a 24-unit
// viewBox, drawn in one colour. DOM-free: every export is data or a string.

export type ArmyGlyph = "wall" | "command" | "skull" | "horde" | "roar" | "bite" | "herd" | "pack" | "bullet" | "repeat" | "orbs" | "bolt" | "frostorb" | "lifeorb";

const sw = (c: string, w = 1.8): string => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const GLYPHS: Record<ArmyGlyph, (c: string) => string> = {
  wall: (c) => `<path d="M5 4 H19 V12 Q19 18.5 12 21 Q5 18.5 5 12 Z" fill="${c}33" ${sw(c)}/><path d="M12 7 V17 M8 11.5 H16" ${sw(c, 1.6)}/>`,
  command: (c) => `<path d="M14.5 3.5 L20.5 3.5 L20.5 9.5 L10 20 L4 20 L4 14 Z" fill="${c}33" ${sw(c)}/><path d="M7 17 L17 7" ${sw(c, 1.6)}/>`,
  skull: (c) => `<path d="M12 3.5 C7.5 3.5 5 6.5 5 10.5 C5 13 6 14.5 7.5 15.5 V19 H16.5 V15.5 C18 14.5 19 13 19 10.5 C19 6.5 16.5 3.5 12 3.5 Z" fill="${c}33" ${sw(c)}/><circle cx="9.5" cy="10.5" r="1.7" fill="${c}"/><circle cx="14.5" cy="10.5" r="1.7" fill="${c}"/>`,
  horde: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M5 20 V16.5 C5 14.5 19 14.5 19 16.5 V20 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  roar: (c) => `<path d="M5 8 Q9 12 5 16 M10 5.5 Q16 12 10 18.5 M15 3 Q23 12 15 21" ${sw(c, 1.8)}/>`,
  bite: (c) => `<path d="M4.5 6 H19.5 C19.5 11 17.5 13 15.8 13 L14.2 19.5 L12.8 13.5 H11.2 L9.8 19.5 L8.2 13 C6.5 13 4.5 11 4.5 6 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  herd: (c) => `<path d="M8 21 V13 M16 21 V13 M8 13 C7 9 5 7 4 4 M8 13 C9 10 10 8 10 5 M16 13 C17 9 19 7 20 4 M16 13 C15 10 14 8 14 5" ${sw(c, 1.7)}/>`,
  pack: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M7 16 C7 13 17 13 17 16 C17 19 14 19.5 12 19.5 C10 19.5 7 19 7 16 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
  orbs: (c) => `<circle cx="12" cy="5.5" r="3" fill="${c}"/><circle cx="5.5" cy="16.5" r="3" fill="${c}"/><circle cx="18.5" cy="16.5" r="3" fill="${c}"/><path d="M12 9 L7.5 14 M12 9 L16.5 14 M8.5 16.5 H15.5" ${sw(c, 1.2)} opacity="0.55"/>`,
  bolt: (c) => `<path d="M13.5 2.5 L6 13 H11.5 L9.5 21.5 L18 10.5 H12.5 Z" fill="${c}33" ${sw(c, 1.7)}/>`,
  frostorb: (c) => `<circle cx="12" cy="12" r="5.5" fill="${c}33" ${sw(c, 1.7)}/><path d="M12 3 V21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5" ${sw(c, 1.3)}/>`,
  lifeorb: (c) => `<circle cx="12" cy="12" r="8" fill="${c}33" ${sw(c, 1.7)}/><path d="M12 7.5 V16.5 M7.5 12 H16.5" ${sw(c, 2)}/>`,
};

/** An icon as an inline svg, `size` px square, drawn in `hex`. */
export function armyIconSvg(glyph: ArmyGlyph, hex: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;overflow:visible">${GLYPHS[glyph](hex)}</svg>`;
}

/** The glyph each army skill wears, by its chain effect id (sim/config.ts). */
export const SKILL_ICON: Record<string, ArmyGlyph> = {
  boneWall: "wall",
  command: "command",
  raise: "skull",
  roar: "roar",
  packBite: "bite",
  herd: "herd",
  stormOrb: "bolt",
  frostOrb: "frostorb",
  lifeOrb: "lifeorb",
};

/** The glyph each army's rule wears. */
export const RULE_ICON = { undead: "horde", beasts: "pack", mages: "orbs" } as const;
