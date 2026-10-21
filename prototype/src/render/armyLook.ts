// How an army unit looks, shared by every screen that draws a unit body (2026-10-20; canvas 10.x, ported from design/tools/gen-armies.js).
// A body is a coloured disc with a face. An army unit adds art BEHIND the disc (ears, antlers, wisps), art ON the disc (cracks, a
// hood, a snout) and sometimes a mask on the disc itself (the Wraith fades out at the bottom). DOM-free: every export is data or a string.
//
// The face of an army unit is always ONE element (a wrapper span), because the fight screen swaps a fallen unit's face for the ✕ face
// by replacing that single element (render/fightView.ts setFallenFace).

import type { ArmyKind, SkeletonKind, UnitKind } from "../sim/types.js";
import { hollowFace, squadFace, type FaceTier } from "./faces.js";

/** The body colour of each army unit; also its eyes' lid colour. */
export const ARMY_UNIT_HEX: Record<UnitKind, string> = {
  boneKnight: "#c9b98a",
  wraith: "#8a86b8",
  bonePriest: "#7fae9a",
  bear: "#d08a3c",
  wolf: "#b08cf5",
  stag: "#6bd69a",
};

/** An army's own colour: its chip, rule tile and card headers. */
export const ARMY_ACCENT: Record<ArmyKind, { hex: string; rgb: string }> = {
  undead: { hex: "#a9b7c9", rgb: "169,183,201" },
  beasts: { hex: "#d9a066", rgb: "217,160,102" },
};

/** Which army a unit kind belongs to. */
export function armyOfKind(kind: UnitKind): ArmyKind {
  return kind === "bear" || kind === "wolf" || kind === "stag" ? "beasts" : "undead";
}

/** A unit's body size in a Beasts squad (px): the Bear 36, everyone else 30. An Undead unit keeps the squad size. */
export function armyBodyPx(kind: UnitKind | undefined, squadPx: number): number {
  if (!kind) return squadPx;
  return armyOfKind(kind) === "beasts" ? (kind === "bear" ? squadPx : Math.round(squadPx * 0.83)) : squadPx;
}

const VB = '<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">';
const BONE = "#eae6d8";

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export interface ArmyLook {
  /** The disc's colour. */
  bg: string;
  /** Art drawn before the disc, so the disc covers its lower half (ears, antlers, wisps). Empty when there is none. */
  under: string;
  /** The face and marks on the disc: one element. */
  face: string;
  /** Extra style for the disc itself (the Wraith's fade). Empty when there is none. */
  bodyStyle: string;
}

/** The look of one army unit at `size` px, with the eyes of fatigue `tier`. */
export function armyLook(kind: UnitKind, tier: FaceTier, size: number): ArmyLook {
  const hex = ARMY_UNIT_HEX[kind];
  const dk = shade(hex, -0.3);
  const lt = shade(hex, 0.55);
  const wrap = (inner: string): string => `<span style="position:absolute;inset:0;display:block;pointer-events:none">${inner}</span>`;
  const crack = 'stroke="#14161c" stroke-opacity="0.55" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"';
  switch (kind) {
    case "boneKnight":
      return {
        bg: hex,
        under: "",
        bodyStyle: "",
        face: wrap(hollowFace(hex, tier, size) + `${VB}<path d="M64 4 L57 22 L67 31 L58 45" ${crack}/><path d="M22 70 L32 78 L28 90" ${crack}/></svg>`),
      };
    case "wraith": {
      const wisp = (d: string): string => `<path d="${d}" stroke="${hex}" stroke-opacity="0.5" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      return {
        bg: hex,
        under: `${VB}${wisp("M26 80 Q17 98 25 116")}${wisp("M50 86 Q46 106 53 122")}${wisp("M74 80 Q83 98 75 114")}</svg>`,
        bodyStyle: "-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%);",
        face: wrap(hollowFace(hex, tier, size)),
      };
    }
    case "bonePriest":
      return {
        bg: hex,
        under: "",
        bodyStyle: "",
        face: wrap(
          `${VB}<path d="M3 52 A47 47 0 0 1 97 52 Q50 26 3 52 Z" fill="#14161c" fill-opacity="0.45"/></svg>` +
            hollowFace(hex, tier, size) +
            `${VB}<path d="M50 70 c-6 0-9 4-9 8 0 3 2 5 4 6 v4 h10 v-4 c2-1 4-3 4-6 0-4-3-8-9-8z" fill="${BONE}"/><circle cx="46.5" cy="77.5" r="2" fill="#14161c"/><circle cx="53.5" cy="77.5" r="2" fill="#14161c"/></svg>`,
        ),
      };
    case "bear":
      return {
        bg: hex,
        under: `${VB}<circle cx="19" cy="13" r="15" fill="${dk}"/><circle cx="19" cy="13" r="7.5" fill="${lt}"/><circle cx="81" cy="13" r="15" fill="${dk}"/><circle cx="81" cy="13" r="7.5" fill="${lt}"/></svg>`,
        bodyStyle: "",
        face: wrap(squadFace(hex, tier, size) + `${VB}<ellipse cx="50" cy="73" rx="21" ry="13" fill="#f0d2a8"/><ellipse cx="50" cy="66" rx="7" ry="5" fill="#2a1a10"/></svg>`),
      };
    case "wolf":
      return {
        bg: hex,
        under: `${VB}<polygon points="12,32 15,-16 44,9" fill="${dk}"/><polygon points="19,26 20,-4 36,10" fill="${lt}"/><polygon points="88,32 85,-16 56,9" fill="${dk}"/><polygon points="81,26 80,-4 64,10" fill="${lt}"/></svg>`,
        bodyStyle: "",
        face: wrap(
          squadFace(hex, tier, size) +
            `${VB}<polygon points="43,62 57,62 50,71" fill="#14161c"/><polygon points="40,73 48,73 44,86" fill="#fff" stroke="#14161c" stroke-width="2"/><polygon points="52,73 60,73 56,86" fill="#fff" stroke="#14161c" stroke-width="2"/></svg>`,
        ),
      };
    case "stag": {
      const antler = '<path d="M36 10 C32 -4 28 -10 22 -22 M31 -4 L17 -7 M27 -13 L35 -23" stroke="#e6d3a0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      return {
        bg: hex,
        under: `${VB}${antler}<g transform="translate(100 0) scale(-1 1)">${antler}</g><ellipse cx="5" cy="34" rx="11" ry="6" fill="${dk}" transform="rotate(-30 5 34)"/><ellipse cx="95" cy="34" rx="11" ry="6" fill="${dk}" transform="rotate(30 95 34)"/></svg>`,
        bodyStyle: "",
        face: wrap(squadFace(hex, tier, size) + `${VB}<ellipse cx="50" cy="72" rx="6" ry="4.5" fill="#2a1a10"/></svg>`),
      };
    }
  }
}

/** The look of an Undead army skeleton (2026-10-21; canvas 12.0B, design/tools/gen-army-fights.js skelBody): a bone disc with hollow glowing
 * eyes and a crack. A warrior carries a blade, a shield skeleton an amber shield on its front. `face` goes in the disc, `overlay` is drawn
 * over it and may reach past its edge. */
export function skeletonLook(kind: SkeletonKind): { bg: string; face: string; overlay: string } {
  const crack = 'stroke="#14161c" stroke-opacity="0.55" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"';
  const eyes = '<ellipse cx="33" cy="45" rx="13" ry="15" fill="#14161c"/><ellipse cx="67" cy="45" rx="13" ry="15" fill="#14161c"/><circle cx="33" cy="47" r="8.5" fill="#9ff0e0" opacity="0.28"/><circle cx="67" cy="47" r="8.5" fill="#9ff0e0" opacity="0.28"/><circle cx="33" cy="47" r="4.6" fill="#9ff0e0"/><circle cx="67" cy="47" r="4.6" fill="#9ff0e0"/>';
  const face = `<span style="position:absolute;inset:0;display:block;pointer-events:none">${VB}<path d="M64 4 L58 20 L66 30" ${crack}/>${eyes}</svg></span>`;
  const blade = `${VB}<path d="M84 74 L100 14" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M76 80 L94 74" stroke="${BONE}" stroke-width="7" stroke-linecap="round"/></svg>`;
  const shield = `${VB}<path d="M24 58 H76 V78 Q76 98 50 108 Q24 98 24 78 Z" fill="#ffb454" stroke="#14161c" stroke-width="5" stroke-linejoin="round"/><path d="M50 66 V98 M36 80 H64" stroke="#14161c" stroke-width="5" stroke-linecap="round" opacity="0.55"/></svg>`;
  return kind === "shield" ? { bg: "#bdb59a", face, overlay: shield } : { bg: "#dcd6c2", face, overlay: blade };
}

/** A whole army body as markup, `size` px: art behind, the disc and its face. For the pick screen and cards, where no fight slot draws it. */
export function armyBodyHtml(kind: UnitKind, size: number, tier: FaceTier = "fresh"): string {
  const look = armyLook(kind, tier, size);
  return `<span class="army-body" style="position:relative;display:block;width:${size}px;height:${size}px">${look.under}<span style="position:absolute;inset:0;border-radius:50%;background:${look.bg};${look.bodyStyle}">${look.face}</span></span>`;
}
