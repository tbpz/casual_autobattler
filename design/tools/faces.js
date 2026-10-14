// The face style for canvas frames (2026-10-14/15): the single source for how an eye is drawn.
// Rules (DECISIONS.md 2026-10-14, "Fatigue is shown as eyes", "Enemies get villain eyes"):
//  - Squad: a white eye with a round pupil. Fatigue shows in the lids: Fresh open and alert; Worn, Frayed, Breaking drop the lids
//    (30%, 55%, 75%), the whites warm up and go red-rimmed (Frayed orange, Breaking red). No word or number on the body.
//  - Under about 34px use the size-tuned eye (bigger eyes, a solid lid band, a tinted rim with a stroke never thinner than 1px, no bags).
//  - Enemy: a villain eye, a different KIND of eye so it is never read as a fatigue stage: a slanted almond with no white and a fixed scowl,
//    it never changes. V1 glowing slits (used), V2 cat eye, V3 hollow. Executioner and bosses use a stronger scowl (1.35).
// Usage from a node script:  const faces = require("./faces.js");  faces.squadFace("#b98cff", "worn", 33)  ->  an <svg> to put INSIDE a position:relative circle.
// CLI:  node faces.js squad <role hex> <fresh|worn|frayed|breaking> <size px>   |   node faces.js villain <size px> [scowl] [variant 1-3]
// The svg is absolutely positioned (inset 0), so the circle it goes in must be position:relative (or absolute) and be the body itself.

const TUNED_UNDER = 34;
const PLAIN = {
  fresh:    { f: 0,    slant: 0,   white: "#ffffff", rim: null,      rimW: 0,   bags: 0,    pupil: 5.2, glint: false },
  worn:     { f: 0.30, slant: 0,   white: "#fff4e4", rim: null,      rimW: 0,   bags: 0.25, pupil: 5.2, glint: false },
  frayed:   { f: 0.55, slant: 1.5, white: "#ffe9d2", rim: "#e8913c", rimW: 1.3, bags: 0.4,  pupil: 4.6, glint: false },
  breaking: { f: 0.75, slant: 3,   white: "#ffd9d4", rim: "#ff4d4d", rimW: 1.6, bags: 0.55, pupil: 3.6, glint: true },
};
const TUNED = {
  fresh:    { f: 0,    slant: 0,   white: "#ffffff", rim: null,      pupil: 6.6, glint: false },
  worn:     { f: 0.30, slant: 0,   white: "#fff1de", rim: null,      pupil: 6.2, glint: false },
  frayed:   { f: 0.55, slant: 2,   white: "#ffd7ae", rim: "#e8913c", pupil: 5.4, glint: false },
  breaking: { f: 0.75, slant: 3.5, white: "#ffb9ad", rim: "#ff4d4d", pupil: 4.8, glint: true },
};
let uid = 0;
const nextId = (p) => p + (uid++);
const darken = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - f))); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); };

// The squad's eye. style "plain" or "tuned"; realSize is the body's real size in px (keeps tuned strokes at a true pixel width).
function eyeSvg(role, tierId, realSize, style) {
  const id = nextId("e");
  const tuned = style === "tuned";
  const p = tuned ? TUNED[tierId] : PLAIN[tierId];
  if (!p) throw new Error("unknown fatigue tier: " + tierId);
  const px1 = 100 / realSize;
  const lid = darken(role, tuned ? 0.55 : 0.4);
  const rx = tuned ? 16.5 : 13, ry = tuned ? 18 : 15, cy = tuned ? 47 : 45, xs = tuned ? [30, 70] : [33, 67];
  const eye = (cx, side) => {
    const top = cy - ry, h = ry * 2, yb = top + p.f * h;
    const yInner = yb + p.slant, yOuter = yb - p.slant;
    const yL = side < 0 ? yOuter : yInner, yR = side < 0 ? yInner : yOuter;
    const clip = `<clipPath id="${id}${side}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
    const bags = !tuned && p.bags ? `<ellipse cx="${cx}" cy="${cy + ry + 3.5}" rx="11" ry="3.2" fill="#14161c" opacity="${p.bags}"/>` : "";
    const lineW = tuned ? Math.max(1.2 * px1, 1.8) : 1.8;
    const lidShape = p.f > 0 ? `<g clip-path="url(#${id}${side})"><polygon points="${cx - rx - 2},${top - 2} ${cx + rx + 2},${top - 2} ${cx + rx + 2},${yR.toFixed(2)} ${cx - rx - 2},${yL.toFixed(2)}" fill="${lid}"/><line x1="${cx - rx - 2}" y1="${yL.toFixed(2)}" x2="${cx + rx + 2}" y2="${yR.toFixed(2)}" stroke="#14161c" stroke-width="${lineW.toFixed(2)}"/></g>` : "";
    const rimW = tuned ? Math.max(1.1 * px1, 1.6) : p.rimW;
    const stroke = p.rim ? `stroke="${p.rim}" stroke-width="${rimW.toFixed(2)}"` : `stroke="#14161c" stroke-width="${(tuned ? Math.max(0.8 * px1, 0.8) : 0.8).toFixed(2)}" stroke-opacity="0.5"`;
    return `${clip}${bags}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${p.white}" ${stroke}/>` +
      `<g clip-path="url(#${id}${side})"><circle cx="${cx}" cy="${cy + 2}" r="${p.pupil}" fill="#14161c"/>${p.glint ? `<circle cx="${cx + 1.8}" cy="${cy + 0.8}" r="1.3" fill="#fff"/>` : ""}</g>${lidShape}`;
  };
  return `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">${eye(xs[0], -1)}${eye(xs[1], 1)}</svg>`;
}

// The villain eye. variant 1 glowing slits, 2 cat eye, 3 hollow. scowl 1 for a Guard, about 1.35 for the Executioner and bosses.
function villainSvg(variant, realSize, scowl = 1) {
  const id = nextId("v");
  const px1 = 100 / realSize;
  const sc = realSize < TUNED_UNDER ? 1.14 : 1.0;
  const O = [-17 * sc, -5 * sc], I = [17 * sc, (6 + (scowl - 1) * 5) * sc], T = [-2 * sc, -17 * sc], B = [2 * sc, 12 * sc];
  const cy = 47;
  const eye = (cx, sgn) => {
    const X = (x) => (cx + sgn * x).toFixed(2), Y = (y) => (cy + y).toFixed(2);
    const almond = `M${X(O[0])},${Y(O[1])} Q${X(T[0])},${Y(T[1])} ${X(I[0])},${Y(I[1])} Q${X(B[0])},${Y(B[1])} ${X(O[0])},${Y(O[1])}Z`;
    const clip = `<clipPath id="${id}${sgn}"><path d="${almond}"/></clipPath>`;
    const outline = Math.max(1 * px1, 1.1).toFixed(2);
    if (variant === 2) {
      const lidIn = -1 + (scowl - 1) * 4, lidOut = -10;
      const lid = `<polygon points="${X(-30)},${Y(-26)} ${X(30)},${Y(-26)} ${X(30)},${Y(lidIn)} ${X(-30)},${Y(lidOut)}" fill="#14161c"/>`;
      return `${clip}<path d="${almond}" fill="#ffd84d"/><g clip-path="url(#${id}${sgn})"><ellipse cx="${X(2)}" cy="${Y(1)}" rx="${(2.6 * sc).toFixed(2)}" ry="${(12 * sc).toFixed(2)}" fill="#14161c"/>${lid}</g><path d="${almond}" fill="none" stroke="#14161c" stroke-width="${outline}"/>`;
    }
    if (variant === 3) return `${clip}<path d="${almond}" fill="#14161c"/><circle cx="${X(3)}" cy="${Y(2)}" r="${(3.8 * sc).toFixed(2)}" fill="#ffffff"/>`;
    const slit = realSize >= TUNED_UNDER ? `<ellipse cx="${X(3)}" cy="${Y(1.5)}" rx="1.5" ry="${(7 * sc).toFixed(2)}" fill="#14161c"/>` : "";
    return `${clip}<path d="${almond}" fill="#14161c"/><g clip-path="url(#${id}${sgn})"><ellipse cx="${X(3)}" cy="${Y(1.5)}" rx="${(8.6 * sc).toFixed(2)}" ry="${(11.5 * sc).toFixed(2)}" fill="#ffe36a"/><ellipse cx="${X(3)}" cy="${Y(0)}" rx="${(4.6 * sc).toFixed(2)}" ry="${(6.5 * sc).toFixed(2)}" fill="#fff6c8"/>${slit}</g>`;
  };
  return `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">${eye(30, 1)}${eye(70, -1)}</svg>`;
}

// Convenience: pick plain or tuned by the body's size.
const squadFace = (role, tier, size) => eyeSvg(role, tier, size, size < TUNED_UNDER ? "tuned" : "plain");
const villainFace = (size, scowl = 1, variant = 1) => villainSvg(variant, size, scowl);

module.exports = { eyeSvg, villainSvg, squadFace, villainFace, TUNED_UNDER };

if (require.main === module) {
  const [kind, a, b, c] = process.argv.slice(2);
  if (kind === "squad") console.log(squadFace(a, b, Number(c)));
  else if (kind === "villain") console.log(villainFace(Number(a), Number(b || 1), Number(c || 1)));
  else console.log("usage: node faces.js squad <role hex> <tier> <size> | villain <size> [scowl] [variant]");
}
