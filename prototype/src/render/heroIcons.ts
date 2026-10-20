// The gift and skill icons of the ten merge heroes (2026-10-20), ported from design/tools/gen-heroes.js's `I` table (24-unit viewBox,
// stroked in one colour). DOM-free: every export is a string.

import type { HeroKind } from "../sim/types.js";

const sw = (c: string, w = 1.8): string => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const ICON: Record<string, (c: string) => string> = {
  shieldPlus: (c) => `<path d="M12 2.8 L19.5 5.8 V11.6 C19.5 16.4 16.3 19.8 12 21.4 C7.7 19.8 4.5 16.4 4.5 11.6 V5.8 Z" fill="${c}33" ${sw(c)}/><path d="M12 8 V15 M8.5 11.5 H15.5" ${sw(c, 1.8)}/>`,
  taunt: (c) => `<circle cx="12" cy="13" r="6.2" ${sw(c)}/><circle cx="12" cy="13" r="2.2" fill="${c}"/><path d="M3 3.5 L8 8.5 M21 3.5 L16 8.5 M12 23 V19.5" ${sw(c)}/>`,
  flame: (c) => `<path d="M12 2.5 C13 6 17 8 17 13 C17 17 14.5 20 12 20 C9.5 20 7 17 7 13 C7 10.5 8.5 9.5 9.5 7.5 C10.5 9 11 9.5 12 10 C11.5 7 11.5 4.5 12 2.5 Z" fill="${c}33" ${sw(c)}/>`,
  cleave: (c) => `<path d="M5 3 L12 21 M10 3 L17 21 M15 3 L22 21" ${sw(c, 2.2)}/>`,
  heart: (c) => `<path d="M12 20.5 C5 15.5 3 11.5 3 8.5 C3 5.8 5 4 7.3 4 C9.2 4 11 5.2 12 7 C13 5.2 14.8 4 16.7 4 C19 4 21 5.8 21 8.5 C21 11.5 19 15.5 12 20.5 Z" fill="${c}33" ${sw(c)}/>`,
  bolt: (c) => `<path d="M13 2 L5 13.5 H11 L10 22 L19 10 H13 Z" fill="${c}33" ${sw(c)}/>`,
  dagger: (c) => `<path d="M19 4 L9 14" ${sw(c, 2.4)}/><path d="M6.5 11.5 L12.5 17.5 M5 19 L8.5 15.5" ${sw(c, 2)}/>`,
  grow: (c) => `<path d="M5 19 L12 12 L19 19 M5 12 L12 5 L19 12" ${sw(c, 2)}/>`,
  breath: (c) => `<path d="M3 12 L20 4.5 V19.5 Z" fill="${c}33" ${sw(c)}/><path d="M9 12 H15" ${sw(c)}/>`,
  skull: (c) => `<path d="M12 3.5 C7.6 3.5 4.8 6.4 4.8 10.2 C4.8 12.5 5.8 14 7.2 14.8 V19.5 H16.8 V14.8 C18.2 14 19.2 12.5 19.2 10.2 C19.2 6.4 16.4 3.5 12 3.5 Z" fill="${c}33" ${sw(c, 1.6)}/><circle cx="9" cy="10.6" r="1.7" fill="${c}"/><circle cx="15" cy="10.6" r="1.7" fill="${c}"/><path d="M10 19.5 V17 M12 19.5 V17 M14 19.5 V17" ${sw(c, 1.2)}/>`,
  horde: (c) => `<circle cx="8" cy="15" r="3.2" fill="${c}33" ${sw(c, 1.6)}/><circle cx="16" cy="15" r="3.2" fill="${c}33" ${sw(c, 1.6)}/><circle cx="12" cy="8" r="3.2" fill="${c}33" ${sw(c, 1.6)}/><path d="M4 21 H20" ${sw(c, 1.6)}/>`,
  sun: (c) => `<circle cx="12" cy="12" r="4.2" fill="${c}33" ${sw(c)}/><path d="M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5 M5.3 5.3 L7.4 7.4 M16.6 16.6 L18.7 18.7 M18.7 5.3 L16.6 7.4 M7.4 16.6 L5.3 18.7" ${sw(c, 1.6)}/>`,
  plus: (c) => `<path d="M12 4 V20 M4 12 H20" ${sw(c, 3)}/>`,
  sprout: (c) => `<path d="M12 21 V11" ${sw(c, 2)}/><path d="M12 12 C12 7 8 5 4 5 C4 9 7 12 12 12 Z" fill="${c}33" ${sw(c, 1.6)}/><path d="M12 14.5 C12 9.5 16 7.5 20 7.5 C20 11.5 17 14.5 12 14.5 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  bloom: (c) => `<circle cx="12" cy="6" r="3" fill="${c}33" ${sw(c, 1.5)}/><circle cx="18" cy="11" r="3" fill="${c}33" ${sw(c, 1.5)}/><circle cx="16" cy="18" r="3" fill="${c}33" ${sw(c, 1.5)}/><circle cx="8" cy="18" r="3" fill="${c}33" ${sw(c, 1.5)}/><circle cx="6" cy="11" r="3" fill="${c}33" ${sw(c, 1.5)}/><circle cx="12" cy="12" r="2" fill="${c}"/>`,
  drop: (c) => `<path d="M12 3 C16.5 9 19 12 19 15.5 C19 19 15.9 21.5 12 21.5 C8.1 21.5 5 19 5 15.5 C5 12 7.5 9 12 3 Z" fill="${c}33" ${sw(c)}/>`,
  bite: (c) => `<path d="M4.5 6 H19.5 C19.5 11 17.5 13 15.8 13 L14.2 19.5 L12.8 13.5 H11.2 L9.8 19.5 L8.2 13 C6.5 13 4.5 11 4.5 6 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  mirror: (c) => `<circle cx="9" cy="12" r="6" ${sw(c)}/><circle cx="15" cy="12" r="6" ${sw(c)}/>`,
  echo: (c) => `<circle cx="12" cy="12" r="2.6" fill="${c}"/><path d="M7.2 7.2 A6.8 6.8 0 0 0 7.2 16.8 M16.8 7.2 A6.8 6.8 0 0 1 16.8 16.8 M4 4.5 A11 11 0 0 0 4 19.5 M20 4.5 A11 11 0 0 1 20 19.5" ${sw(c, 1.6)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
};

/** Which icon a hero's gift and skill wear. */
export const HERO_ICONS: Record<HeroKind, { gift: string; skill: string }> = {
  golem: { gift: "taunt", skill: "shieldPlus" },
  berserker: { gift: "flame", skill: "cleave" },
  paladin: { gift: "heart", skill: "shieldPlus" },
  assassin: { gift: "bolt", skill: "dagger" },
  dragon: { gift: "grow", skill: "breath" },
  necromancer: { gift: "skull", skill: "horde" },
  priest: { gift: "sun", skill: "plus" },
  treant: { gift: "sprout", skill: "bloom" },
  vampire: { gift: "drop", skill: "bite" },
  twin: { gift: "mirror", skill: "echo" },
};

/** One icon as an inline svg, `px` square, drawn in `colour`. */
export function heroIconSvg(name: string, colour: string, px: number): string {
  const inner = (ICON[name] ?? ICON.bullet!)(colour);
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="flex:none;overflow:visible">${inner}</svg>`;
}
