// The face style (design/tools/faces.js, canvas "Face style"): the single source for how an eye is drawn.
//  - Squad: a white eye with a round pupil. Fatigue shows in the lids: Fresh open and alert; Worn, Frayed and Breaking drop the
//    lids (30%, 55%, 75%), and the whites warm up and go red-rimmed (Frayed orange, Breaking red). No word or number on the body.
//  - Under about 34px the size-tuned eye is used (bigger eyes, a solid lid band, a tinted rim with a stroke never thinner than 1px).
//  - Enemy: a villain eye, a different KIND of eye so it is never read as a fatigue stage: a slanted almond with no white and a
//    fixed scowl, it never changes. Variant 1 glowing slits is used; 2 cat eye and 3 hollow are kept as candidates.
// Every face is an <svg> positioned inset 0, so the circle it goes in must be position:relative (or absolute) and be the body.
// DOM-free on purpose, so a check can import it.

export type FaceTier = "fresh" | "worn" | "frayed" | "breaking";

export const TUNED_UNDER = 34;

interface EyeLook {
  f: number;
  slant: number;
  white: string;
  rim: string | null;
  rimW: number;
  bags: number;
  pupil: number;
  glint: boolean;
}

const PLAIN: Record<FaceTier, EyeLook> = {
  fresh: { f: 0, slant: 0, white: "#ffffff", rim: null, rimW: 0, bags: 0, pupil: 5.2, glint: false },
  worn: { f: 0.3, slant: 0, white: "#fff4e4", rim: null, rimW: 0, bags: 0.25, pupil: 5.2, glint: false },
  frayed: { f: 0.55, slant: 1.5, white: "#ffe9d2", rim: "#e8913c", rimW: 1.3, bags: 0.4, pupil: 4.6, glint: false },
  breaking: { f: 0.75, slant: 3, white: "#ffd9d4", rim: "#ff4d4d", rimW: 1.6, bags: 0.55, pupil: 3.6, glint: true },
};

const TUNED: Record<FaceTier, EyeLook> = {
  fresh: { f: 0, slant: 0, white: "#ffffff", rim: null, rimW: 0, bags: 0, pupil: 6.6, glint: false },
  worn: { f: 0.3, slant: 0, white: "#fff1de", rim: null, rimW: 0, bags: 0, pupil: 6.2, glint: false },
  frayed: { f: 0.55, slant: 2, white: "#ffd7ae", rim: "#e8913c", rimW: 0, bags: 0, pupil: 5.4, glint: false },
  breaking: { f: 0.75, slant: 3.5, white: "#ffb9ad", rim: "#ff4d4d", rimW: 0, bags: 0, pupil: 4.8, glint: true },
};

/** Clip-path ids must be unique on a page, so every face takes the next number. */
let uid = 0;
const nextId = (prefix: string): string => prefix + uid++;

function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - f)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const SVG_OPEN =
  '<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">';

/** The glow of an Undead unit's hollow eye (render/armyLook.ts). */
export const GHOST_GLOW = "#9ff0e0";

/** The squad's eye. `style` is "plain" or "tuned"; `realSize` is the body's size in px (keeps tuned strokes a true pixel wide).
 * `hollow` (Undead, 2026-10-20) swaps the white and the dark pupil: a dark socket with a glowing pupil, lids and rims unchanged,
 * so a tired Undead unit still shows it. */
export function eyeSvg(role: string, tier: FaceTier, realSize: number, style: "plain" | "tuned", hollow = false): string {
  const p = (style === "tuned" ? TUNED : PLAIN)[tier];
  if (!p) throw new Error("unknown fatigue tier: " + tier);
  const id = nextId("e");
  const tuned = style === "tuned";
  const px1 = 100 / realSize;
  const lid = darken(role, tuned ? 0.55 : 0.4);
  const rx = tuned ? 16.5 : 13;
  const ry = tuned ? 18 : 15;
  const cy = tuned ? 47 : 45;
  const xs = tuned ? [30, 70] : [33, 67];
  const eye = (cx: number, side: number): string => {
    const top = cy - ry;
    const h = ry * 2;
    const yb = top + p.f * h;
    const yInner = yb + p.slant;
    const yOuter = yb - p.slant;
    const yL = side < 0 ? yOuter : yInner;
    const yR = side < 0 ? yInner : yOuter;
    const clip = `<clipPath id="${id}${side}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
    const bags =
      !tuned && p.bags
        ? `<ellipse cx="${cx}" cy="${cy + ry + 3.5}" rx="11" ry="3.2" fill="#14161c" opacity="${p.bags}"/>`
        : "";
    const lineW = tuned ? Math.max(1.2 * px1, 1.8) : 1.8;
    const lidShape =
      p.f > 0
        ? `<g clip-path="url(#${id}${side})"><polygon points="${cx - rx - 2},${top - 2} ${cx + rx + 2},${top - 2} ${cx + rx + 2},${yR.toFixed(2)} ${cx - rx - 2},${yL.toFixed(2)}" fill="${lid}"/><line x1="${cx - rx - 2}" y1="${yL.toFixed(2)}" x2="${cx + rx + 2}" y2="${yR.toFixed(2)}" stroke="#14161c" stroke-width="${lineW.toFixed(2)}"/></g>`
        : "";
    const rimW = tuned ? Math.max(1.1 * px1, 1.6) : p.rimW;
    const stroke = p.rim
      ? `stroke="${p.rim}" stroke-width="${rimW.toFixed(2)}"`
      : `stroke="#14161c" stroke-width="${(tuned ? Math.max(0.8 * px1, 0.8) : 0.8).toFixed(2)}" stroke-opacity="0.5"`;
    const socket = hollow ? "#14161c" : p.white;
    const pupil = hollow
      ? `<circle cx="${cx}" cy="${cy + 2}" r="${p.pupil + 3.6}" fill="${GHOST_GLOW}" opacity="0.28"/><circle cx="${cx}" cy="${cy + 2}" r="${p.pupil - 0.6}" fill="${GHOST_GLOW}"/>`
      : `<circle cx="${cx}" cy="${cy + 2}" r="${p.pupil}" fill="#14161c"/>${p.glint ? `<circle cx="${cx + 1.8}" cy="${cy + 0.8}" r="1.3" fill="#fff"/>` : ""}`;
    return (
      `${clip}${bags}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${socket}" ${stroke}/>` +
      `<g clip-path="url(#${id}${side})">${pupil}</g>${lidShape}`
    );
  };
  return `${SVG_OPEN}${eye(xs[0]!, -1)}${eye(xs[1]!, 1)}</svg>`;
}

/** The villain eye. `variant` 1 glowing slits, 2 cat eye, 3 hollow. `scowl` 1 for a plain enemy, about 1.35 for a Vanguard-class one. */
export function villainSvg(variant: 1 | 2 | 3, realSize: number, scowl = 1): string {
  const id = nextId("v");
  const px1 = 100 / realSize;
  const sc = realSize < TUNED_UNDER ? 1.14 : 1.0;
  const O = [-17 * sc, -5 * sc] as const;
  const I = [17 * sc, (6 + (scowl - 1) * 5) * sc] as const;
  const T = [-2 * sc, -17 * sc] as const;
  const B = [2 * sc, 12 * sc] as const;
  const cy = 47;
  const eye = (cx: number, sgn: number): string => {
    const X = (x: number): string => (cx + sgn * x).toFixed(2);
    const Y = (y: number): string => (cy + y).toFixed(2);
    const almond = `M${X(O[0])},${Y(O[1])} Q${X(T[0])},${Y(T[1])} ${X(I[0])},${Y(I[1])} Q${X(B[0])},${Y(B[1])} ${X(O[0])},${Y(O[1])}Z`;
    const clip = `<clipPath id="${id}${sgn}"><path d="${almond}"/></clipPath>`;
    const outline = Math.max(1 * px1, 1.1).toFixed(2);
    if (variant === 2) {
      const lidIn = -1 + (scowl - 1) * 4;
      const lidOut = -10;
      const lid = `<polygon points="${X(-30)},${Y(-26)} ${X(30)},${Y(-26)} ${X(30)},${Y(lidIn)} ${X(-30)},${Y(lidOut)}" fill="#14161c"/>`;
      return `${clip}<path d="${almond}" fill="#ffd84d"/><g clip-path="url(#${id}${sgn})"><ellipse cx="${X(2)}" cy="${Y(1)}" rx="${(2.6 * sc).toFixed(2)}" ry="${(12 * sc).toFixed(2)}" fill="#14161c"/>${lid}</g><path d="${almond}" fill="none" stroke="#14161c" stroke-width="${outline}"/>`;
    }
    if (variant === 3) {
      return `${clip}<path d="${almond}" fill="#14161c"/><circle cx="${X(3)}" cy="${Y(2)}" r="${(3.8 * sc).toFixed(2)}" fill="#ffffff"/>`;
    }
    const slit =
      realSize >= TUNED_UNDER
        ? `<ellipse cx="${X(3)}" cy="${Y(1.5)}" rx="1.5" ry="${(7 * sc).toFixed(2)}" fill="#14161c"/>`
        : "";
    return `${clip}<path d="${almond}" fill="#14161c"/><g clip-path="url(#${id}${sgn})"><ellipse cx="${X(3)}" cy="${Y(1.5)}" rx="${(8.6 * sc).toFixed(2)}" ry="${(11.5 * sc).toFixed(2)}" fill="#ffe36a"/><ellipse cx="${X(3)}" cy="${Y(0)}" rx="${(4.6 * sc).toFixed(2)}" ry="${(6.5 * sc).toFixed(2)}" fill="#fff6c8"/>${slit}</g>`;
  };
  return `${SVG_OPEN}${eye(30, 1)}${eye(70, -1)}</svg>`;
}

/** A squad face, plain or size-tuned by the body's drawn size. `role` is the role's hex colour. */
export const squadFace = (role: string, tier: FaceTier, size: number): string =>
  eyeSvg(role, tier, size, size < TUNED_UNDER ? "tuned" : "plain");

/** An Undead unit's face: hollow sockets with a glowing pupil (2026-10-20, canvas 10.x). Fatigue still shows in the lids. */
export const hollowFace = (role: string, tier: FaceTier, size: number): string =>
  eyeSvg(role, tier, size, size < TUNED_UNDER ? "tuned" : "plain", true);

export const villainFace = (size: number, scowl = 1, variant: 1 | 2 | 3 = 1): string => villainSvg(variant, size, scowl);

/** The face of a fallen fighter (frame 2.6): two ✕ eyes. The body behind it is the grey DEAD_BODY colour. */
export const DEAD_BODY = "#5c5f6b";
export const deadFace = (): string =>
  `${SVG_OPEN}<path d="M23 37 L39 55 M39 37 L23 55 M61 37 L77 55 M77 37 L61 55" stroke="#14161c" stroke-width="6.5" stroke-linecap="round" fill="none"/></svg>`;
