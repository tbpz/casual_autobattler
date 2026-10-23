// Generates canvas section 12: the fight screen under four ways an army could play (2026-10-21; Tu picked B, C and D, all built since; D reworked 2026-10-23; A is today).
//   12.0A  FightArmyPlain    today: a line from one unit to one enemy
//   12.0B  FightArmyUndead   every skill hit raises a skeleton (5 at most, then it upgrades them); enemy hits go shields, warriors, Bram; slams hit anyone
//   12.0C  FightArmyBeasts   one shared pack bar; when it fills, the whole pack jumps on one enemy
//   12.0D  FightArmyMages    every mage has a core orb that never leaves and no plain attack; every skill hit adds a loose orb (3 at most); every orb works on a shared beat (1 s in, then every 2 s); a 4th hit merges the loose orbs into one orb that fires one big shot and is gone, the next hit starts again from none, orbs left when the skill ends stay; Life orbs drain the front enemy and heal the most hurt unit (reworked 2026-10-23)
// Run:  node design/tools/gen-army-fights.js     (writes the four frames and patches canvas.json)
// Toolkit (scene helpers, bubble, beam, floater) is cut from gen-armies.js; unit looks from there too. Every number (HP, damage) is made up
// for the picture; the play style is what is being judged. Every animated part keeps its key moment as its plain (animation off) style,
// so a frame reads as a still: the editor freezes animation (see MISTAKES.md 2026-10-14 #1).

const fs = require("fs");
const path = require("path");
const faces = require("./faces.js");

const CANVAS = path.join(__dirname, "..", "canvas");

// ---------- palette ----------
const ROLE = {
  tank: { hex: "#ffb454" },
  damage: { hex: "#b98cff" },
  healer: { hex: "#6ee7a0" },
};
const RED = "#ff5d5d", YEL = "#ffcf4d", BONE = "#eae6d8", GLOW = "#9ff0e0";
const UNDEAD = "#a9b7c9", BEASTS = "#d9a066", MAGE = "#8fd3ff";
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// ---------- unique svg ids ----------
let uidN = 0;
const uniq = (svg) => { const p = "f" + (uidN++) + "_"; return svg.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`); };
const face = (hex, size, tier = "fresh") => uniq(faces.squadFace(hex, tier, size));
const villain = (size, scowl = 1) => uniq(faces.villainFace(size, scowl));

// ---------- the unit looks (from gen-armies.js) ----------
const VB = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">`;
const hollowEyes = `<ellipse cx="33" cy="45" rx="13" ry="15" fill="#14161c"/><ellipse cx="67" cy="45" rx="13" ry="15" fill="#14161c"/><circle cx="33" cy="47" r="8.5" fill="${GLOW}" opacity="0.28"/><circle cx="67" cy="47" r="8.5" fill="${GLOW}" opacity="0.28"/><circle cx="33" cy="47" r="4.6" fill="${GLOW}"/><circle cx="67" cy="47" r="4.6" fill="${GLOW}"/>`;
const crack = `stroke="#14161c" stroke-opacity="0.55" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
const UNIT_HEX = { knight: "#c9b98a", wraith: "#8a86b8", priest: "#7fae9a", bear: "#d08a3c", wolf: "#b08cf5", stag: "#6bd69a", frost: "#7fc8ff", storm: "#c28cff", life: "#8be9a8" };
function look(key, size) {
  const hex = UNIT_HEX[key], dk = shade(hex, -0.3), lt = shade(hex, 0.55);
  switch (key) {
    case "knight":
      return { under: "", bodyStyle: "", inner: `${VB}<path d="M64 4 L57 22 L67 31 L58 45" ${crack}/><path d="M22 70 L32 78 L28 90" ${crack}/>${hollowEyes}</svg>` };
    case "wraith":
      return {
        under: `${VB}<path d="M26 80 Q17 98 25 116" stroke="${hex}" stroke-opacity="0.5" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M50 86 Q46 106 53 122" stroke="${hex}" stroke-opacity="0.5" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M74 80 Q83 98 75 114" stroke="${hex}" stroke-opacity="0.5" stroke-width="8" fill="none" stroke-linecap="round"/></svg>`,
        bodyStyle: "-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%);",
        inner: `${VB}${hollowEyes}</svg>`,
      };
    case "priest":
      return { under: "", bodyStyle: "", inner: `${VB}<path d="M3 52 A47 47 0 0 1 97 52 Q50 26 3 52 Z" fill="#14161c" fill-opacity="0.45"/>${hollowEyes}<path d="M50 70 c-6 0-9 4-9 8 0 3 2 5 4 6 v4 h10 v-4 c2-1 4-3 4-6 0-4-3-8-9-8z" fill="${BONE}"/><circle cx="46.5" cy="77.5" r="2" fill="#14161c"/><circle cx="53.5" cy="77.5" r="2" fill="#14161c"/></svg>` };
    case "bear":
      return {
        under: `${VB}<circle cx="19" cy="13" r="15" fill="${dk}"/><circle cx="19" cy="13" r="7.5" fill="${lt}"/><circle cx="81" cy="13" r="15" fill="${dk}"/><circle cx="81" cy="13" r="7.5" fill="${lt}"/></svg>`,
        bodyStyle: "",
        inner: face(hex, size) + `${VB}<ellipse cx="50" cy="73" rx="21" ry="13" fill="#f0d2a8"/><ellipse cx="50" cy="66" rx="7" ry="5" fill="#2a1a10"/></svg>`,
      };
    case "wolf":
      return {
        under: `${VB}<polygon points="12,32 15,-16 44,9" fill="${dk}"/><polygon points="19,26 20,-4 36,10" fill="${lt}"/><polygon points="88,32 85,-16 56,9" fill="${dk}"/><polygon points="81,26 80,-4 64,10" fill="${lt}"/></svg>`,
        bodyStyle: "",
        inner: face(hex, size) + `${VB}<polygon points="43,62 57,62 50,71" fill="#14161c"/><polygon points="40,73 48,73 44,86" fill="#fff" stroke="#14161c" stroke-width="2"/><polygon points="52,73 60,73 56,86" fill="#fff" stroke="#14161c" stroke-width="2"/></svg>`,
      };
    case "stag": {
      const antler = `<path d="M36 10 C32 -4 28 -10 22 -22 M31 -4 L17 -7 M27 -13 L35 -23" stroke="#e6d3a0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      return {
        under: `${VB}${antler}<g transform="translate(100 0) scale(-1 1)">${antler}</g><ellipse cx="5" cy="34" rx="11" ry="6" fill="${dk}" transform="rotate(-30 5 34)"/><ellipse cx="95" cy="34" rx="11" ry="6" fill="${dk}" transform="rotate(30 95 34)"/></svg>`,
        bodyStyle: "",
        inner: face(hex, size) + `${VB}<ellipse cx="50" cy="72" rx="6" ry="4.5" fill="#2a1a10"/></svg>`,
      };
    }
    case "frost": case "storm": case "life": {
      // a pointed hat behind the head, a star on it, a face on the disc
      const star = { frost: "#d8f1ff", storm: "#ffe36a", life: "#c9ffd9" }[key];
      return {
        under: `${VB}<polygon points="22,30 50,-46 78,30" fill="${dk}"/><ellipse cx="50" cy="26" rx="40" ry="9" fill="${dk}"/><path d="M50 -8 l3.4 8 8.6 .8 -6.6 5.8 2 8.4 -7.4 -4.6 -7.4 4.6 2 -8.4 -6.6 -5.8 8.6 -.8z" fill="${star}"/></svg>`,
        bodyStyle: "",
        inner: face(hex, size),
      };
    }
  }
}
const ROLE_PLAIN = { bram: ROLE.tank.hex, ivy: ROLE.damage.hex, sol: ROLE.healer.hex };

// ---------- the scene toolkit (from gen-armies.js) ----------
function makeCtx(prefix) {
  const rules = []; let n = 0;
  const kf = (stops) => {
    const name = `${prefix}${n++}`;
    const s = stops.map(([p, v]) => [Math.max(0, Math.min(100, p)), v]).sort((a, b) => a[0] - b[0]);
    rules.push(`@keyframes ${name} { ${s.map(([p, v]) => `${p.toFixed(2)}% { ${v} }`).join(" ")} }`);
    return `animation: ${name} var(--T) linear infinite;`;
  };
  return { rules, kf };
}
const abs = (style, inner = "") => `<div style="position:absolute;${style}">${inner}</div>`;
const W = (arr) => arr.map(([p, v]) => [p, `width:${v}%`]);
const win = (a, b, f = 1) => [[0, "opacity:0"], [a, "opacity:0"], [a + f, "opacity:1"], [b, "opacity:1"], [b + f, "opacity:0"], [100, "opacity:0"]];
const from = (a, f = 1) => [[0, "opacity:0"], [a, "opacity:0"], [a + f, "opacity:1"], [96, "opacity:1"], [100, "opacity:0"]];
const FLOAT_HID = "opacity:0;transform:translate(-50%,0) scale(0.8)";
const floatStops = (a) => [[0, FLOAT_HID], [a, FLOAT_HID], [a + 1, "opacity:1;transform:translate(-50%,-4px) scale(1.25)"], [a + 7, "opacity:1;transform:translate(-50%,-14px) scale(1)"], [a + 14, "opacity:0;transform:translate(-50%,-18px) scale(1)"], [100, FLOAT_HID]];

function shadow(size, a = 0.4) { return `<div style="position:absolute;border-radius:50%;top:${(size * 0.85).toFixed(1)}px;left:${(size * 0.125).toFixed(1)}px;width:${(size * 0.75).toFixed(1)}px;height:${(size * 0.15).toFixed(1)}px;background:rgba(0,0,0,${a});filter:blur(2px);"></div>`; }
function body(C, o) {
  const { cx, top, size, bg, faceSvg, bodyStyle = "", wrapStyle = "", wrapAnim = "", alpha = 0.24, overlay = "", under = "" } = o;
  return abs(`left:${cx - size / 2}px;top:${top}px;width:${size}px;height:${size}px;`,
    shadow(size, alpha) + `<div style="position:absolute;inset:0;transform-origin:50% 100%;${wrapStyle}${wrapAnim}">${under}<div style="position:absolute;inset:0;border-radius:50%;background:${bg};${bodyStyle}">${faceSvg}</div>${overlay}</div>`);
}
const nameLabel = (cx, y, html, extra = "") => abs(`left:${cx - 55}px;top:${y}px;width:110px;text-align:center;font-size:9.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${extra}`, html);
function hpBar(C, { cx, y, pct = 100, stops = null, w = 36 }) {
  const fill = `<div style="flex:none;width:${pct}%;height:100%;background:#4da6ff;${stops ? C.kf(W(stops)) : ""}"></div>`;
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:5px;border-radius:3px;background:#2a2e3a;overflow:hidden;display:flex;`, fill);
}
function barStops(cycles) {
  const w = [[0, "width:8%;background:#e8e8ee"]], g = [[0, "box-shadow:none"]];
  let prev = 8;
  for (const c of cycles) {
    if (c.jump) { w.push([c.s - 0.05, `width:${prev}%;background:#e8e8ee`]); }
    else { w.push([c.s - 0.1, "width:100%;background:#e8e8ee"]); }
    w.push([c.s, "width:100%;background:#ffcf4d"]);
    g.push([c.s - 0.05, "box-shadow:none"], [c.s, `box-shadow:0 0 6px 1px ${YEL}`]);
    w.push([c.s + 1, "width:100%;background:#ffcf4d"], [c.s + 7, "width:0;background:#ffcf4d"], [c.s + 7.1, "width:0;background:#e8e8ee"]); g.push([c.s + 7, `box-shadow:0 0 6px 1px ${YEL}`], [c.s + 7.1, "box-shadow:none"]); prev = 0;
  }
  w.push([100, "width:8%;background:#e8e8ee"]); g.push([100, "box-shadow:none"]);
  return { w, g };
}
function chargeBar(C, { cx, y, pct = 45, cycles = null, w = 36 }) {
  if (!cycles) return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;`, `<div style="width:${pct}%;height:100%;background:#e8e8ee;"></div>`);
  const b = barStops(cycles);
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;${C.kf(b.g)}`, `<div style="width:100%;height:100%;background:${YEL};${C.kf(b.w)}"></div>`);
}
function bubble(C, { cx, top, size, text, color, s, w = 66, barW = 36, flow = true, show = true }) {
  const h = 18, bl = cx - w / 2, bt = top - 26, tipX = cx, tipY = bt + 22, barY = top + size + 19.5, barL = cx - barW / 2;
  const pop = C.kf([[0, "opacity:0;transform:scale(0.7)"], [s + 1, "opacity:0;transform:scale(0.7)"], [s + 2.8, "opacity:1;transform:scale(1)"], [s + 22.95, "opacity:1;transform:scale(1)"], [s + 23, "opacity:0;transform:scale(1)"], [100, "opacity:0;transform:scale(1)"]]);
  const border = C.kf([[0, "stroke-dashoffset:100"], [s + 5.8, "stroke-dashoffset:100"], [s + 13, "stroke-dashoffset:0"], [s + 22.95, "stroke-dashoffset:0"], [s + 23, "stroke-dashoffset:100"], [100, "stroke-dashoffset:100"]]);
  const hid = "stroke-dasharray:22 178;stroke-dashoffset:22;opacity:0", mid = "stroke-dasharray:22 178;stroke-dashoffset:22;opacity:1", end = "stroke-dasharray:22 178;stroke-dashoffset:-100;opacity:1", gone = "stroke-dasharray:22 178;stroke-dashoffset:-100;opacity:0";
  const flowAnim = C.kf([[0, hid], [s + 0.95, hid], [s + 1.2, mid], [s + 7, end], [s + 7.1, gone], [100, gone]]);
  const outline = `M${w / 2},22 L${w / 2 - 4},18 H8 A8 8 0 0 1 0,10 V8 A8 8 0 0 1 8,0 H${w - 8} A8 8 0 0 1 ${w},8 V10 A8 8 0 0 1 ${w - 8},18 H${w / 2 + 4} Z`;
  const flowSvg = flow ? `<svg width="326" height="392" viewBox="0 0 326 392" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:3;"><path d="M${barL},${barY} L${barL - 12},${barY} L${barL - 12},${tipY} L${tipX},${tipY}" fill="none" stroke="${YEL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="22 178" stroke-dashoffset="-100" opacity="0.85" style="filter:drop-shadow(0 0 3px ${YEL});${flowAnim}"/></svg>` : "";
  return flowSvg
    + `<div style="position:absolute;left:${bl}px;top:${bt}px;width:${w}px;height:${h}px;z-index:4;white-space:nowrap;transform-origin:50% ${((22 / 18) * 100).toFixed(1)}%;${show ? "" : "opacity:0;"}${pop}"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;"><path d="${outline}" fill="#14161c" stroke="#3a3f4e" stroke-width="1.4" stroke-linejoin="round"/><path d="${outline}" fill="none" stroke="${YEL}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" style="filter:drop-shadow(0 0 2.5px ${YEL});${border}"/></svg><span style="position:absolute;left:0;right:0;top:0;height:${h}px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;letter-spacing:0.05em;color:${color};">${text}</span></div>`;
}
// `show: false` hides a line or number in the still (animation off); it still plays in the loop. The still keeps only the key moment.
function beam(C, { x1, y1, x2, y2, color, at, w = 2, dur = 10, show = true }) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
  const t = (sx) => `transform:rotate(${ang}deg) scaleX(${sx})`;
  const anim = C.kf([[0, `opacity:0;${t(0)}`], [at - 0.05, `opacity:0;${t(0)}`], [at, `opacity:0.9;${t(0.1)}`], [at + dur * 0.6, `opacity:0.9;${t(1)}`], [at + dur, `opacity:0;${t(1)}`], [100, `opacity:0;${t(1)}`]]);
  return `<div style="position:absolute;left:${x1}px;top:${y1 - w / 2}px;width:${len.toFixed(1)}px;height:${w}px;background:${color};box-shadow:0 0 4px 1px ${color};transform-origin:0 50%;${t(1)};opacity:${show ? 0.55 : 0};z-index:3;${anim}"></div>`;
}
function floater(C, { x, y, text, color, at, size = 14, glow = "#ff5252", show = true }) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;font-size:${size}px;font-weight:800;color:${color};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.6),0 0 8px ${glow};z-index:5;transform:translate(-50%,-10px);${show ? "" : "opacity:0;"}${C.kf(floatStops(at))}">${text}</div>`;
}
function ring(C, { cx, cy, r, color, at, dur = 8 }) {
  const a = C.kf([[0, "opacity:0;transform:scale(0.4)"], [at, "opacity:0;transform:scale(0.4)"], [at + 0.1, "opacity:0.9;transform:scale(0.5)"], [at + dur, "opacity:0;transform:scale(1.5)"], [100, "opacity:0;transform:scale(1.5)"]]);
  return abs(`left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:2px solid ${color};box-shadow:0 0 8px ${color};opacity:0;z-index:3;${a}`);
}
const chip = (C, { x, y, text, color, stops, base = 1 }) => abs(`left:${x}px;top:${y}px;font-size:8px;font-weight:800;color:${color};background:#2a2e3a;border:1px solid ${color};border-radius:8px;padding:1px 6px;white-space:nowrap;z-index:5;opacity:${base};${C.kf(stops)}`, text);
const xEyes = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"><path d="M20 38 L42 58 M42 38 L20 58 M58 38 L80 58 M80 38 L58 58" stroke="#14161c" stroke-width="8" stroke-linecap="round" fill="none"/></svg>`;

// ---------- the cast, the same in all four frames ----------
// Enemies: the Vanguard and three Outriders (frame 5.2's lineup). Arena is 326 x 392; the front line sits near y 152.
const VAN = { cx: 194, top: 40, size: 56 }, O1 = { cx: 60, top: 66, size: 30 }, O2 = { cx: 122, top: 66, size: 30 }, O3 = { cx: 266, top: 66, size: 30 };
function enemy(C, o) {
  const { cx, top, size, name, hp, hpStops = null, hpPct = 100 } = o;
  return body(C, { cx, top, size, bg: size > 40 ? "#b23b3b" : RED, faceSvg: villain(size, size > 40 ? 1.2 : 1), alpha: 0.4 })
    + abs(`left:${cx - 40}px;top:${top + size + 3}px;width:80px;text-align:center;font-size:${size > 40 ? 11 : 9.5}px;font-weight:700;color:#e8e8ee;white-space:nowrap;`, name)
    + hpBar(C, { cx, y: top + size + 15, pct: hpPct, stops: hpStops, w: size > 40 ? 56 : 34 })
    + abs(`left:${cx - 44}px;top:${top + size + 23}px;width:88px;text-align:center;font-size:${size > 40 ? 10 : 9}px;color:#8a8fa3;white-space:nowrap;`, hp);
}
const outriders = (C) => enemy(C, { ...O1, name: "Outrider 1", hp: "146/146" }) + enemy(C, { ...O2, name: "Outrider 2", hp: "146/146" }) + enemy(C, { ...O3, name: "Outrider 3", hp: "146/146" });
const vanguard = (C, hpStops, hpPct, hp) => enemy(C, { ...VAN, name: "Vanguard", hp, hpStops, hpPct })
  + abs(`left:${VAN.cx - 30}px;top:${VAN.top + VAN.size + 35}px;display:flex;align-items:center;gap:3px;`, `<span style="font-size:7px;font-weight:800;letter-spacing:.05em;color:#ff5252;">SLAM</span><div style="position:relative;width:42px;height:5px;border-radius:3px;background:#2a2e3a;overflow:hidden;"><div style="height:100%;width:35%;background:#7a2b2b;border-radius:3px;"></div></div>`);
const rowLabels = () => abs("left:0;top:189px;font-size:8px;font-weight:800;letter-spacing:0.08em;color:#6c7186;", "FRONT") + abs("left:0;top:311px;font-size:8px;font-weight:800;letter-spacing:0.08em;color:#6c7186;", "BACK");
const frontLine = () => abs("left:0;top:152px;width:326px;height:1px;background:linear-gradient(90deg,transparent,#8a8fa3 15%,#8a8fa3 85%,transparent);opacity:.3;");

// one of our units: disc, name, HP bar, charge bar
function ally(C, key, o) {
  const { cx, top, size, name, hpPct = 100, hpStops = null, cycles = null, chargePct = 45, hpW = 40, noCharge = false, plain = null, wrapAnim = "", wrapStyle = "", overlay = "", labelColor = "", chargeEl = null } = o;
  let b;
  if (plain) b = body(C, { cx, top, size, bg: plain, faceSvg: face(plain, size), alpha: 0.4, wrapAnim, wrapStyle, overlay });
  else { const L = look(key, size); b = body(C, { cx, top, size, bg: UNIT_HEX[key], faceSvg: L.inner, under: L.under, bodyStyle: L.bodyStyle, alpha: size >= 36 ? 0.4 : 0.24, wrapAnim, wrapStyle, overlay }); }
  return b + nameLabel(cx, top + size + 2, name, labelColor ? `color:${labelColor};` : "")
    + hpBar(C, { cx, y: top + size + 14, pct: hpPct, stops: hpStops, w: hpW })
    + (noCharge ? "" : chargeEl || chargeBar(C, { cx, y: top + size + 21, pct: chargePct, cycles, w: hpW }));
}

// something that pops in at `at`% and stays: plain style = shown
const popIn = (C, at, dy = 12) => C.kf([[0, `opacity:0;transform:translateY(${dy}px) scale(0.5)`], [at - 0.1, `opacity:0;transform:translateY(${dy}px) scale(0.5)`], [at + 3, "opacity:1;transform:translateY(0) scale(1)"], [95, "opacity:1;transform:translateY(0) scale(1)"], [99, "opacity:0;transform:translateY(0) scale(1)"], [100, `opacity:0;transform:translateY(${dy}px) scale(0.5)`]]);
// (ox, oy) is the point the pop-in grows from, in arena pixels: the wrapper has no size, so without it everything grows from the arena's corner
const pin = (C, at, inner, ox = 0, oy = 0) => abs(`left:0;top:0;width:0;height:0;transform-origin:${ox}px ${oy}px;${popIn(C, at)}`, inner);

// =====================================================================================================
// A — today: a line between two units
// =====================================================================================================
function sceneA(C) {
  let h = frontLine() + outriders(C);
  h += vanguard(C, [[0, 100], [14, 100], [18, 95], [24, 95], [28, 88], [34, 88], [38, 79], [100, 79]], 79, "553/699");
  h += ally(C, "bram", { plain: ROLE_PLAIN.bram, cx: 163, top: 174, size: 38, name: "Bram", hpW: 40, hpPct: 92, hpStops: [[0, 100], [66, 100], [68, 92], [100, 92]], chargePct: 55 });
  h += ally(C, "ivy", { plain: ROLE_PLAIN.ivy, cx: 100, top: 298, size: 36, name: "Ivy", cycles: [{ s: 4 }] });
  h += ally(C, "sol", { plain: ROLE_PLAIN.sol, cx: 226, top: 298, size: 36, name: "Sol", chargePct: 100 });
  const hits = [[14, 18, "−18", 180, 44], [24, 23, "−23", 200, 44], [34, 29, "−29", 220, 44]];
  // the still keeps the third hit; the first two only play in the loop
  hits.forEach(([t, , txt, fx, fy], i) => { h += beam(C, { x1: 100, y1: 312, x2: 188 + i * 6, y2: 98, color: "#b98cff", at: t, w: 2, show: i === 2 }) + floater(C, { x: fx + 60, y: fy - i * 4, text: txt, color: i === 2 ? "#ff8a3d" : "#e8e8ee", at: t + 1, size: 12 + i * 2, glow: "#b98cff", show: i === 2 }); });
  h += chip(C, { x: 150, y: 8, text: "✦ EXPOSED +3", color: "#ff7ab6", stops: from(14), base: 1 });
  h += bubble(C, { cx: 100, top: 298, size: 36, text: "EXPOSE ×3", color: ROLE.damage.hex, s: 4, w: 72 });
  h += beam(C, { x1: 194, y1: 98, x2: 163, y2: 176, color: RED, at: 66, w: 4, show: false }) + floater(C, { x: 163, y: 166, text: "−15", color: "#fff", at: 67, size: 15, show: false });
  h += rowLabels();
  return h;
}

// =====================================================================================================
// B — Undead: every skill hit raises a skeleton (5 at most, then a hit upgrades them); redrawn 2026-10-21 to Tu's rules
// =====================================================================================================
// a skeleton: a bone disc with glowing eyes. kind "warrior" has a blade, "shield" has a shield on its front.
function skelBody(C, o) {
  const { cx, top, size, kind, wrapAnim = "" } = o;
  const blade = kind === "warrior" ? `${VB}<path d="M84 74 L100 14" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M76 80 L94 74" stroke="${BONE}" stroke-width="7" stroke-linecap="round"/></svg>` : "";
  const shield = kind === "shield" ? `${VB}<path d="M24 58 H76 V78 Q76 98 50 108 Q24 98 24 78 Z" fill="${ROLE.tank.hex}" stroke="#14161c" stroke-width="5" stroke-linejoin="round"/><path d="M50 66 V98 M36 80 H64" stroke="#14161c" stroke-width="5" stroke-linecap="round" opacity="0.55"/></svg>` : "";
  const bg = kind === "shield" ? "#bdb59a" : "#dcd6c2";
  return body(C, { cx, top, size, bg, faceSvg: `${VB}<path d="M64 4 L58 20 L66 30" ${crack}/>${hollowEyes}</svg>`, alpha: 0.3, wrapAnim, overlay: blade + shield });
}
// the lunge of a skeleton at the Vanguard: `at`% out, back by `at + 7`%. Plain style = home.
const lungeAnim = (C, at, dx, dy) => C.kf([[0, "transform:translate(0,0)"], [at - 0.1, "transform:translate(0,0)"], [at + 1.5, `transform:translate(${dx}px,${dy}px) scale(1.2)`], [at + 3.5, `transform:translate(${dx}px,${dy}px) scale(1)`], [at + 6.5, "transform:translate(0,0) scale(1)"], [100, "transform:translate(0,0)"]]);
function sceneB(C) {
  let h = frontLine() + outriders(C);
  // the Vanguard's HP: a few normal hits early, then the horde's five hits at 70-74 (the warriors hit for 9, upgraded from 6)
  h += vanguard(C, [[0, 100], [5, 99], [9, 98], [17, 97], [24, 96], [70, 96], [71, 94.5], [72, 93], [73, 91.5], [74, 90], [100, 90]], 90, "632/699");
  h += ally(C, "knight", { cx: 163, top: 172, size: 40, name: "Bram", hpW: 40, chargePct: 30, cycles: [{ s: 20 }] });
  h += ally(C, "wraith", { cx: 100, top: 298, size: 36, name: "Ivy", cycles: [{ s: 66 }] });
  h += ally(C, "priest", { cx: 226, top: 298, size: 36, name: "Sol", hpPct: 88, hpStops: [[0, 100], [85, 100], [86, 88], [100, 88]], cycles: [{ s: 3 }, { s: 52 }] });
  // a small number under each body: the order the enemy's normal hits go in (1 shields, 2 warriors, 3 Bram)
  const num = (x, y, n, color) => abs(`left:${x}px;top:${y}px;width:12px;height:12px;border-radius:50%;background:#2a2e3a;border:1px solid ${color};color:${color};font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:5;`, n);
  h += num(188, 190, 3, ROLE.tank.hex);
  // shield skeletons stand in front of Bram, warriors beside him; [centre x, % at which it rises]
  const WAR = [[238, 8], [268, 11], [298, 14]], SHL = [[128, 27], [96, 31]];
  const home = { top: 190, size: 22 };
  const targets = { w0: [186, 120], w1: [208, 124], w2: [230, 120], s0: [160, 122], s1: [140, 126] };
  WAR.forEach(([cx, at], i) => {
    const t = targets["w" + i], la = lungeAnim(C, 70 + i * 0.6, t[0] - cx, t[1] - (home.top + 11)), up = 54 + i * 0.8;
    h += pin(C, at, skelBody(C, { cx, top: home.top, size: home.size, kind: "warrior", wrapAnim: la }), cx, home.top + 22);
    h += pin(C, at, num(cx - 6, 215, 2, "#dcd6c2"), cx, 221);
    h += ring(C, { cx, cy: home.top + 22, r: 14, color: UNDEAD, at });
    // the upgrade: a gold ring and a gold "+3" badge that stays
    h += ring(C, { cx, cy: home.top + 11, r: 16, color: YEL, at: up, dur: 6 });
    h += pin(C, up, abs(`left:${cx + 3}px;top:${home.top - 10}px;font-size:8px;font-weight:800;color:#14161c;background:${YEL};border-radius:7px;padding:0 4px;line-height:12px;z-index:5;`, "+3"), cx + 8, home.top - 4);
  });
  SHL.forEach(([cx, at], i) => {
    const t = targets["s" + i], la = lungeAnim(C, 72 + i * 0.6, t[0] - cx, t[1] - 202);
    h += pin(C, at, skelBody(C, { cx, top: 186, size: 24, kind: "shield", wrapAnim: la }), cx, 210);
    h += pin(C, at, num(cx - 6, 216, 1, ROLE.tank.hex), cx, 222);
    h += ring(C, { cx, cy: 210, r: 15, color: ROLE.tank.hex, at });
  });
  // normal hits between skills: Bram and Ivy hit the Vanguard, and one warrior hits on its own timer
  [[5, 170, 176, 190, 100, BONE, 214, 112], [17, 170, 176, 190, 100, BONE, 214, 112], [9, 100, 300, 186, 98, "#b98cff", 170, 112], [24, 100, 300, 186, 98, "#b98cff", 170, 112], [45, 238, 190, 202, 98, "#dcd6c2", 222, 112]].forEach(([t, x1, y1, x2, y2, col, fx, fy]) => {
    h += beam(C, { x1, y1, x2, y2, color: col, at: t, w: 1.5, dur: 5, show: false }) + floater(C, { x: fx, y: fy, text: t === 45 ? "−6" : "−7", color: "#e8e8ee", at: t + 1, size: 9, show: false });
  });
  // enemy normal hits: all three go to the front shield skeleton, not Bram
  [[38, 60, 96, 122, 188, "−4"], [41, 122, 96, 127, 186, "−4"], [44, 194, 98, 134, 190, "−5"]].forEach(([t, x1, y1, x2, y2, txt], i) => {
    h += beam(C, { x1, y1, x2, y2, color: RED, at: t, w: 2, dur: 5, show: i === 2 }) + floater(C, { x: 112 + i * 14, y: 172, text: txt, color: "#fff", at: t + 1, size: 10, show: i === 2 });
  });
  // the horde strikes together at 70: warriors for 9 (upgraded), shields for 6
  [[186, 56, "−9"], [208, 46, "−9"], [230, 40, "−9"], [160, 108, "−6"], [140, 116, "−6"]].forEach(([x, y, t], i) => { h += floater(C, { x, y, text: t, color: "#e8e8ee", at: 70 + i * 0.7, size: 10, show: false }); });
  // the slam picks anyone: here Sol, in the back row
  h += beam(C, { x1: 194, y1: 98, x2: 226, y2: 300, color: RED, at: 84, w: 4, show: false }) + floater(C, { x: 226, y: 286, text: "−15", color: "#fff", at: 85, size: 14, show: false });
  h += ring(C, { cx: 226, cy: 316, r: 22, color: RED, at: 85 });
  // how many skeletons stand: 0 to 5 (the limit); the still shows 5
  const count = (n, a, b, base) => abs(`left:0;top:205px;font-size:9px;font-weight:800;letter-spacing:0.06em;color:${BONE};white-space:nowrap;opacity:${base};${C.kf(win(a, b, 0.5))}`, n === 5 ? "☠ FULL 5/5" : `☠ HORDE ${n}/5`);
  h += count(0, 0, 7.5, 0) + count(1, 8, 10.5, 0) + count(2, 11, 13.5, 0) + count(3, 14, 26.5, 0) + count(4, 27, 30.5, 0) + count(5, 31, 99, 1);
  // what is happening now (plays in the loop only)
  h += chip(C, { x: 4, y: 232, text: "NO SKILL? NORMAL HITS", color: BONE, stops: win(4, 20, 1.5), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "THE SHIELD TAKES THE HITS", color: ROLE.tank.hex, stops: win(37, 50, 1.5), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "FULL: WARRIORS UPGRADE", color: YEL, stops: win(53, 68, 1.5), base: 0 });
  h += chip(C, { x: 4, y: 250, text: "ALL 5 STRIKE AT ONCE", color: "#b98cff", stops: win(69, 82, 1.5), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "A SLAM PICKS ANYONE", color: RED, stops: win(84, 98, 1.5), base: 0 });
  // the three rules, always shown at the foot of the arena
  const always = [[ROLE.tank.hex, 362, "ENEMY HITS GO: 1 SHIELDS › 2 WARRIORS › 3 BRAM"], [YEL, 377, "SLAMS HIT ANYONE · AT 5 STANDING, A SKILL UPGRADES"]];
  always.forEach(([color, y, text]) => { h += chip(C, { x: 4, y, text, color, stops: [[0, "opacity:1"], [100, "opacity:1"]], base: 1 }); });
  // bubbles: Sol raises, Bram walls, Sol upgrades (full), Ivy commands; the still shows the last two
  h += bubble(C, { cx: 226, top: 298, size: 36, text: "RAISE ×3", color: ROLE.healer.hex, s: 3, w: 64, show: false });
  h += bubble(C, { cx: 163, top: 172, size: 40, text: "BONE WALL ×2", color: ROLE.tank.hex, s: 20, w: 84, barW: 40, show: false });
  h += bubble(C, { cx: 226, top: 298, size: 36, text: "RAISE ×3: UPGRADE", color: ROLE.healer.hex, s: 52, w: 108 });
  h += bubble(C, { cx: 100, top: 298, size: 36, text: "COMMAND", color: ROLE.damage.hex, s: 66, w: 64 });
  h += rowLabels();
  return h;
}

// =====================================================================================================
// C — Beasts: one pack bar; when it fills, every beast jumps on one enemy at once
// =====================================================================================================
const BEAR = { cx: 163, top: 174, size: 38 };
const PACK = [
  { key: "wolf", name: "Fang", cx: 66, land: [150, 68], leave: 36.5, hit: "−14", hit2: "−18", fx: [128, 52] },
  { key: "wolf", name: "Ash", cx: 130, land: [238, 68], leave: 37, hit: "−14", hit2: "−18", fx: [262, 48] },
  { key: "wolf", name: "Dusk", cx: 196, land: [194, 22], leave: 37.5, hit: "−14", hit2: "−18", fx: [226, 18] },
  { key: "stag", name: "Moss", cx: 260, land: [232, 152], leave: 39.5, hit: "+5", hit2: "+5", fx: [262, 138] },
];
// a jump from home to `land` and back, twice (the chain: the pack pounces again). Plain style = landed the first time.
function jumpAnim(C, home, land, t1, t2) {
  const dx = land[0] - home[0], dy = land[1] - home[1], T = (x, y, s = "1") => `transform:translate(${x}px,${y}px) scale(${s})`;
  const leg = (t, back) => [[t, T(0, 0)], [t + 1.2, T(dx / 2, dy / 2 - 38, "1.08")], [t + 2.4, T(dx, dy, "1.2,0.82")], [t + 3.2, T(dx, dy)], [back, T(dx, dy)], [back + 3, T(0, 0)]];
  const [a, b] = [leg(t1, t1 + 33), leg(t2, t2 + 12)];
  return C.kf([[0, T(0, 0)], ...a, ...b, [100, T(0, 0)]]);
}
function sceneC(C) {
  let h = frontLine() + outriders(C);
  h += vanguard(C, [[0, 100], [38, 100], [40, 82], [41, 74], [64, 74], [66, 58], [67, 44], [100, 44]], 74, "517/699");
  // the Bear: first to land, holds the Vanguard
  const bearHome = [BEAR.cx, BEAR.top + 19], bearLand = [194, 134];
  h += ally(C, "bear", { ...BEAR, name: "Bruno", hpW: 40, noCharge: true, wrapStyle: `transform:translate(${bearLand[0] - bearHome[0]}px,${bearLand[1] - bearHome[1]}px);`, wrapAnim: jumpAnim(C, bearHome, bearLand, 33.5, 62) });
  PACK.forEach((p) => {
    const home = [p.cx, 308 + 13], dx = p.land[0] - home[0], dy = p.land[1] - home[1];
    h += ally(C, p.key, { cx: p.cx, top: 308, size: 26, name: p.name, hpW: 32, noCharge: true, wrapStyle: `transform:translate(${dx}px,${dy}px);`, wrapAnim: jumpAnim(C, home, p.land, p.leave, p.leave + 25) });
  });
  // the pack bar: the one bar for all five, steps up with every bite, then spends itself on the pounce(s)
  const steps = [[0, 0], [5, 0], [6.5, 17], [11, 17], [12.5, 34], [17, 34], [18.5, 50], [23, 50], [24.5, 67], [28, 67], [29.5, 84], [31, 84], [32.5, 100], [76, 100], [78, 0], [100, 0]];
  h += abs("left:20px;top:366px;font-size:8px;font-weight:800;letter-spacing:0.12em;color:#d9a066;", "PACK");
  h += abs(`left:56px;top:366px;width:250px;height:9px;border-radius:5px;background:#2a2e3a;overflow:hidden;border:1px solid #3a3f4e;${C.kf([[0, "box-shadow:none"], [32, "box-shadow:none"], [33, `box-shadow:0 0 8px 1px ${YEL}`], [77, `box-shadow:0 0 8px 1px ${YEL}`], [78, "box-shadow:none"], [100, "box-shadow:none"]])}`,
    `<div style="height:100%;width:100%;background:${YEL};${C.kf(W(steps))}"></div>` + [1, 2, 3, 4].map((i) => abs(`left:${i * 20}%;top:0;bottom:0;width:1px;background:#14161c;opacity:.7;`)).join(""));
  // small bites while the bar fills: thin lines, each adds a step
  [[6, 66, 1], [12, 130, 1], [18, 196, 1], [24, 163, 0], [29.5, 66, 1]].forEach(([t, x, back], i) => {
    h += beam(C, { x1: x, y1: back ? 312 : 190, x2: 120 + i * 20, y2: 98, color: BEASTS, at: t, w: 1.5, dur: 6, show: false }) + floater(C, { x: 130 + i * 22, y: 112 + (i % 2) * 10, text: "−3", color: "#e8e8ee", at: t + 1, size: 9, show: false });
  });
  // the pounce lands
  PACK.forEach((p) => { h += floater(C, { x: p.fx[0], y: p.fx[1], text: p.hit, color: p.key === "stag" ? ROLE.healer.hex : "#fff", at: p.leave + 3, size: 13, glow: p.key === "stag" ? "#1b8a55" : "#ff5252" }); });
  h += chip(C, { x: 236, y: 12, text: "PINNED", color: ROLE.tank.hex, stops: win(36, 76, 1.5) });
  h += ring(C, { cx: 194, cy: 134, r: 26, color: BEASTS, at: 36 });
  h += chip(C, { x: 4, y: 232, text: "BEAR LANDS FIRST AND HOLDS IT", color: ROLE.tank.hex, stops: win(34, 48, 1.5) });
  h += chip(C, { x: 4, y: 252, text: "WOLVES BITE · STAG HEALS", color: BEASTS, stops: win(38, 52, 1.5) });
  h += chip(C, { x: 4, y: 272, text: "A CHAIN: THEY JUMP AGAIN", color: "#ffcf4d", stops: win(60, 76, 1.5), base: 0 });
  // one skill bubble for the whole pack, above the back row; the yellow flow runs up from the pack bar
  const flowAnim = C.kf([[0, "stroke-dashoffset:22;opacity:0"], [31.5, "stroke-dashoffset:22;opacity:0"], [32, "stroke-dashoffset:22;opacity:1"], [38, "stroke-dashoffset:-100;opacity:1"], [38.1, "stroke-dashoffset:-100;opacity:0"], [100, "stroke-dashoffset:-100;opacity:0"]]);
  h += `<svg width="326" height="392" viewBox="0 0 326 392" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:3;"><path d="M163,364 L163,290" fill="none" stroke="${YEL}" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="22 178" stroke-dashoffset="-100" opacity="0.85" style="filter:drop-shadow(0 0 3px ${YEL});${flowAnim}"/></svg>`;
  h += bubble(C, { cx: 163, top: 316, size: 0, text: "POUNCE ×2", color: BEASTS, s: 31, w: 74, flow: false });
  h += rowLabels();
  return h;
}

// =====================================================================================================
// D — Mages: the orb helpers (the scene itself is sceneD, below)
// =====================================================================================================
// where an orb sits on a ring, in arena pixels
const orbAt = (cx, cy, r, ang) => [cx + r * Math.cos(ang * Math.PI / 180), cy + r * Math.sin(ang * Math.PI / 180)];
// a ring of orbs around a unit. `items` = [[angle in degrees, appears at %]]. Plain style = all shown, unless `shownInStill` is false.
// `pulses` = the % at which the orbs do their job (each swells once). `mergeAt` + `mergeTo`: from that % every orb flies to that
// point (arena pixels) and is gone, to become the merged orb. `spin` > 0 turns the ring slowly (seconds per turn); 0 keeps the orbs still.
function orbRing(C, { cx, cy, r, color, items, spin = 0, pulses = [], mergeAt = null, mergeTo = null, shownInStill = true }) {
  const T = (x, y, s) => `transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s})`;
  const orbs = items.map(([ang, at]) => {
    const [px, py] = orbAt(cx, cy, r, ang);
    const x = px - (cx - r) - 5, y = py - (cy - r) - 5;
    const [dx, dy] = mergeTo ? [mergeTo[0] - px, mergeTo[1] - py] : [0, 0];
    const stops = [[0, `opacity:0;${T(0, 0, 0.2)}`], [at - 0.1, `opacity:0;${T(0, 0, 0.2)}`], [at + 0.8, `opacity:1;${T(0, 0, 1.6)}`], [at + 2, `opacity:1;${T(0, 0, 1)}`]];
    pulses.filter((t) => t > at + 3 && (mergeAt === null || t < mergeAt)).forEach((t) => stops.push([t - 0.3, `opacity:1;${T(0, 0, 1)}`], [t + 0.4, `opacity:1;${T(0, 0, 2)}`], [t + 1.6, `opacity:1;${T(0, 0, 1)}`]));
    if (mergeAt !== null) stops.push([mergeAt, `opacity:1;${T(0, 0, 1)}`], [mergeAt + 2.6, `opacity:1;${T(dx, dy, 0.5)}`], [mergeAt + 2.8, `opacity:0;${T(dx, dy, 0.5)}`], [100, `opacity:0;${T(dx, dy, 0.5)}`]);
    else stops.push([97, `opacity:1;${T(0, 0, 1)}`], [100, `opacity:0;${T(0, 0, 0.2)}`]);
    return `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 7px 2px ${color};border:1px solid #fff8;${shownInStill ? "" : "opacity:0;"}${C.kf(stops)}"></div>`;
  }).join("");
  return abs(`left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;z-index:4;${spin ? `animation:orbSpin ${spin}s linear infinite;` : ""}`, orbs);
}
// a real lightning bolt: a jagged line with a white core and a coloured glow, flickering for about 0.4 s. The zig-zag is a fixed
// pseudo-random sequence, so every run of the generator draws the same bolt. A thick bolt also forks once. `show: false` hides it in the still.
let boltN = 0;
function bolt(C, { x1, y1, x2, y2, color, at, w = 1.6, show = false }) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const n = Math.max(4, Math.round(len / 16)), k = boltN++;
  const jig = (i) => { const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
  const pts = [[x1, y1]];
  for (let i = 1; i < n; i++) { const t = i / n, j = jig(i) * (5 + w * 1.6); pts.push([x1 + dx * t + nx * j, y1 + dy * t + ny * j]); }
  pts.push([x2, y2]);
  const path = (p) => p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  let d = path(pts);
  if (w >= 3) { const m = pts[Math.floor(n / 2)], s = jig(n) > 0 ? 1 : -1; d += ` ${path([m, [m[0] + ux * 12 + nx * 14 * s, m[1] + uy * 12 + ny * 14 * s], [m[0] + ux * 24 + nx * 10 * s, m[1] + uy * 24 + ny * 10 * s]])}`; }
  const anim = C.kf([[0, "opacity:0"], [at - 0.05, "opacity:0"], [at, "opacity:1"], [at + 0.7, "opacity:0.15"], [at + 1.3, "opacity:1"], [at + 2, "opacity:0.2"], [at + 2.6, "opacity:0.9"], [at + 3.6, "opacity:0"], [100, "opacity:0"]]);
  return `<svg width="326" height="392" viewBox="0 0 326 392" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:4;filter:drop-shadow(0 0 ${2 + w}px ${color});opacity:${show ? 1 : 0};${anim}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(w * 2).toFixed(1)}" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
// the one big sparkling orb the others merge into. Appears at `at` %, flares at `flare` % as its one big shot fires and is gone at `end` %:
// it lives for one moment, and the next hit starts again from none (reworked 2026-10-22). The still (animation off) shows it flaring.
function mergedOrb(C, { cx, cy, at, flare, end, color, edge = "#ff9f1c" }) {
  const S = (s, a) => `opacity:${a};transform:scale(${s});box-shadow:0 0 ${6 + s * 8}px ${1 + s * 3}px ${color},0 0 ${2 + s * 4}px ${s * 2}px #fff8;`;
  const stops = [[0, S(0.3, 0)], [at - 0.1, S(0.3, 0)], [at + 0.6, S(1.2, 1)], [flare - 0.1, S(1.2, 1)], [flare + 0.6, S(1.9, 1)], [end, S(1.6, 1)], [end + 1.8, S(0.4, 0)], [100, S(0.3, 0)]];
  const sparks = [[-4, -4, 9], [32, -2, 7], [34, 32, 9], [-2, 34, 7]].map(([x, y, fs]) => `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fs}px;line-height:1;color:#fffbd0;text-shadow:0 0 4px ${color};">✦</span>`).join("");
  const core = `radial-gradient(circle at 40% 38%,#fff 0%,#fff6b0 30%,${color} 68%,${edge} 100%)`;
  return abs(`left:${cx - 14}px;top:${cy - 14}px;width:28px;height:28px;border-radius:50%;background:${core};z-index:4;${S(1.6, 1)}${C.kf(stops)}`,
    abs("left:-2px;top:-2px;width:32px;height:32px;animation:orbSpin 2.4s linear infinite;", sparks));
}
// =====================================================================================================
// D — Mages (built 2026-10-21, reworked 2026-10-23, once as option 12.0E): a core orb on every mage, no plain attacks, and the Life Mage drains
// =====================================================================================================
// a core orb: always out, never leaves, a little bigger than a loose orb and ringed. It swells on every beat in `pulses`.
function coreOrb(C, { cx, cy, r, color, ang, pulses = [] }) {
  const [px, py] = orbAt(cx, cy, r, ang);
  const S = (s) => `transform:scale(${s})`;
  const stops = [[0, S(1)]];
  pulses.forEach((t) => stops.push([t - 0.3, S(1)], [t + 0.4, S(1.9)], [t + 1.6, S(1)]));
  stops.push([100, S(1)]);
  return abs(`left:${(px - 7).toFixed(1)}px;top:${(py - 7).toFixed(1)}px;width:14px;height:14px;border-radius:50%;background:${color};border:1px solid #fff;box-shadow:0 0 0 2px #14161c,0 0 0 3.5px ${color},0 0 9px 3px ${color};z-index:4;${C.kf(stops)}`);
}
// a skill bar that steps up on every beat (orb work fills it) and turns yellow at full, as every skill bar does.
// `list` = [[% of the loop, bar %]], each a hard step; `still` = the bar's width in the still (animation off).
function steppedCharge(C, { cx, y, w = 40, start, list, still }) {
  const pts = [[0, start]]; let prev = start;
  list.forEach(([p, v]) => { pts.push([p - 0.05, prev], [p + 0.4, v]); prev = v; });
  pts.push([100, prev]);
  const st = (v) => `width:${v}%;background:${v >= 100 ? YEL : "#e8e8ee"}`;
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;`,
    `<div style="height:100%;${st(still)};${C.kf(pts.map(([p, v]) => [p, st(v)]))}"></div>`);
}
function sceneD(C) {
  let h = frontLine() + outriders(C);
  const GOLD = "#ffe36a", FROST = "#8fd3ff", LIFE = "#6ee7a0";
  // the shared beat: 1 s into the fight, then every 2 s (a 12 s loop)
  const BEATS = [8.3, 25, 41.7, 58.3, 75, 91.7];
  const FC = [163, 193], SC = [100, 316], LC = [226, 316], MP = [292, 316];
  const O1c = [60, 84], O2c = [122, 84], O3c = [266, 81], VANc = [194, 76], BRAMc = [163, 193];
  // the Vanguard loses 6 on beat 1, 24 on beat 2 (four Life orbs), 45 to the Great Drain, then 12 a beat (the core orb and one loose one).
  // The still shows the moment after the Great Drain.
  h += vanguard(C, [[0, 100], [8.3, 100], [9.3, 99.1], [25, 99.1], [26, 95.7], [34.8, 95.7], [35.8, 89.3], [41.7, 89.3], [42.7, 87.6], [58.3, 87.6], [59.3, 85.9], [75, 85.9], [76, 84.2], [91.7, 84.2], [92.7, 82.4], [100, 82.4]], 89, "624/699");
  // Bram (Frost Mage) in front, Ivy (Storm Mage) and Sol (Life Mage) behind. No plain attacks from any of them. Bram starts hurt, the enemy hits him
  // for 12 now and then, and Sol's drain heals him (cap 100).
  h += ally(C, "frost", { cx: 163, top: 174, size: 38, name: "Bram", hpW: 40, hpPct: 99,
    hpStops: [[0, 84], [8.3, 84], [9, 88], [19.5, 88], [20, 79], [25, 79], [26, 97], [28, 97], [28.5, 88], [34.8, 88], [35.8, 99], [41.7, 99], [42.5, 100], [45, 100], [45.5, 91], [58.3, 91], [59, 100], [62, 100], [62.5, 91], [75, 91], [75.8, 100], [80, 100], [80.5, 91], [91.7, 91], [92.4, 100], [100, 100]],
    chargeEl: steppedCharge(C, { cx: 163, y: 174 + 38 + 21, start: 8, list: [[8.3, 24], [25, 40], [41.7, 56], [58.3, 72], [75, 88], [91.7, 100]], still: 40 }) });
  h += ally(C, "storm", { cx: 100, top: 298, size: 36, name: "Ivy",
    chargeEl: steppedCharge(C, { cx: 100, y: 298 + 36 + 21, start: 6, list: [[8.3, 20], [25, 34], [41.7, 48], [58.3, 62], [75, 76], [91.7, 90]], still: 34 }) });
  h += ally(C, "life", { cx: 226, top: 298, size: 36, name: "Sol", hpPct: 100,
    chargeEl: steppedCharge(C, { cx: 226, y: 298 + 36 + 21, start: 6, list: [[7.9, 100], [19, 0], [25, 14], [28.4, 100], [39.5, 0], [41.7, 12], [58.3, 24], [75, 36], [91.7, 48]], still: 100 }) });
  // a core orb on each mage, out from the first frame and never leaving
  h += coreOrb(C, { cx: SC[0], cy: SC[1], r: 29, color: GOLD, ang: 180, pulses: BEATS });
  h += coreOrb(C, { cx: FC[0], cy: FC[1], r: 30, color: FROST, ang: 180, pulses: BEATS });
  h += coreOrb(C, { cx: LC[0], cy: LC[1], r: 29, color: LIFE, ang: 180, pulses: BEATS });
  // Sol's loose Life orbs: three from her first skill (they stay), merged by the first hit of her second skill; its second hit starts again
  h += orbRing(C, { cx: LC[0], cy: LC[1], r: 29, color: LIFE, items: [[-150, 11], [-30, 14.5], [0, 18]], pulses: BEATS, mergeAt: 32, mergeTo: MP, shownInStill: false });
  h += orbRing(C, { cx: LC[0], cy: LC[1], r: 29, color: LIFE, items: [[-150, 38.5]], pulses: BEATS, shownInStill: false });
  // every beat: Ivy's core orb zaps one enemy, Bram's shields him, and the squad pulses together
  const zapAt = [O2c, O1c, O3c, O2c, O1c, O3c], ivyOrb = orbAt(SC[0], SC[1], 29, 180);
  BEATS.forEach((t, k) => {
    h += bolt(C, { x1: ivyOrb[0], y1: ivyOrb[1], x2: zapAt[k][0], y2: zapAt[k][1], color: GOLD, at: t, w: 1.6, show: false });
    h += floater(C, { x: zapAt[k][0] + 6, y: 62, text: "−10", color: "#fff4b0", at: t + 1, size: 9, glow: GOLD, show: false });
    h += floater(C, { x: 140, y: 168, text: "⛊+10", color: FROST, at: t, size: 10, glow: "#4da6ff", show: false });
    h += ring(C, { cx: SC[0], cy: SC[1], r: 28, color: GOLD, at: t, dur: 6 }) + ring(C, { cx: FC[0], cy: FC[1], r: 30, color: FROST, at: t, dur: 6 }) + ring(C, { cx: LC[0], cy: LC[1], r: 28, color: LIFE, at: t, dur: 6 });
  });
  // Sol's drain, every beat: each Life orb sends a green line to the Vanguard, then on to the most hurt ally (Bram). [beat, the angles of the working orbs, HP taken]
  const orbPos = (ang) => orbAt(LC[0], LC[1], 29, ang);
  [[8.3, [180], 6], [25, [180, -150, -30, 0], 24], [41.7, [180, -150], 12], [58.3, [180, -150], 12], [75, [180, -150], 12], [91.7, [180, -150], 12]].forEach(([t, angs, total]) => {
    angs.forEach((ang, i) => {
      const o = orbPos(ang), at = t + 0.3 + i * 0.25;
      h += beam(C, { x1: VANc[0], y1: 90, x2: o[0], y2: o[1], color: LIFE, at, w: 1.5, dur: 3, show: false });
      h += beam(C, { x1: o[0], y1: o[1], x2: BRAMc[0] + 6, y2: BRAMc[1] + 6, color: LIFE, at: at + 1.1, w: 1.5, dur: 3, show: false });
    });
    h += floater(C, { x: 236, y: 40, text: `−${total}`, color: "#d6ffe6", at: t + 0.8, size: 10 + Math.min(4, total / 8), glow: LIFE, show: false });
    h += floater(C, { x: 200, y: 192, text: `+${total}`, color: LIFE, at: t + 2, size: 10 + Math.min(4, total / 8), glow: "#1b8a55", show: false });
  });
  // the enemy still hits Bram now and then; that is what the drain heals
  [20, 28.5, 45, 62, 80].forEach((t) => {
    h += beam(C, { x1: 194, y1: 98, x2: 170, y2: 178, color: RED, at: t, w: 2, dur: 5, show: false });
    h += floater(C, { x: 196, y: 160, text: "−12", color: "#fff", at: t + 1, size: 10, show: false });
  });
  // the Great Drain: Sol's second skill finds three loose orbs out; they merge, fire one big drain on the Vanguard and are gone; the core orb stays
  h += ring(C, { cx: MP[0], cy: MP[1], r: 26, color: "#fff", at: 34.4, dur: 8 });
  h += mergedOrb(C, { cx: MP[0], cy: MP[1], at: 32.8, flare: 34.6, end: 37, color: LIFE, edge: "#1b8a55" });
  h += beam(C, { x1: MP[0], y1: MP[1] - 6, x2: VANc[0], y2: 94, color: LIFE, at: 34.6, w: 4, dur: 6, show: true });
  h += floater(C, { x: 240, y: 30, text: "−45", color: "#fff", at: 35.4, size: 22, glow: LIFE, show: true });
  h += ring(C, { cx: VANc[0], cy: 68, r: 40, color: LIFE, at: 35, dur: 10 });
  // the 45 taken is shared out over the whole squad: 15 each
  [[BRAMc[0], 176, 200, 192], [100, 296, 66, 296], [226, 296, 252, 322]].forEach(([tx, ty, fx, fy]) => {
    h += beam(C, { x1: VANc[0], y1: 96, x2: tx, y2: ty, color: LIFE, at: 35.3, w: 2, dur: 5, show: true });
    h += floater(C, { x: fx, y: fy, text: "+15", color: LIFE, at: 36.1, size: 12, glow: "#1b8a55", show: true });
  });
  // what is happening now (plays in the loop only)
  h += chip(C, { x: 4, y: 232, text: "EACH BEAT: ORBS WORK", color: GOLD, stops: win(8.3, 24.5, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "A CORE ORB ON EVERY MAGE", color: "#e8e8ee", stops: win(0.5, 7.8, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "TAKES HP FROM THE FRONT", color: LIFE, stops: win(9.3, 24.5, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 268, text: "HEALS THE MOST HURT: BRAM", color: LIFE, stops: win(10, 24.5, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "FOUR ORBS, FOUR DRAINS", color: LIFE, stops: win(25, 31.3, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 268, text: "THE HEAL IS WHAT IT TOOK", color: LIFE, stops: win(25.5, 31.3, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "THE HIT FINDS 3 OUT: MERGE", color: LIFE, stops: win(31.5, 34.4, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "GREAT DRAIN: ONE BIG TAKE", color: LIFE, stops: win(34.6, 42, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 268, text: "SHARED OVER THE WHOLE TEAM", color: LIFE, stops: win(35, 42, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "CORE STAYS: DRAIN GOES ON", color: "#e8e8ee", stops: win(42.5, 58, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "NO PLAIN HITS FROM A MAGE", color: GOLD, stops: win(58.5, 74, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 252, text: "THE TEAM PULSES TOGETHER", color: GOLD, stops: win(75, 96, 1.3), base: 0 });
  // the two rules, always shown at the foot of the arena
  [["#e8e8ee", 362, "CORE ORB ON EVERY MAGE · NO PLAIN ATTACKS"], [LIFE, 377, "BEAT EVERY 2 S · LIFE ORBS DRAIN THE FRONT ENEMY"]].forEach(([color, y, text]) => {
    h += chip(C, { x: 4, y, text, color, stops: [[0, "opacity:1"], [100, "opacity:1"]], base: 1 });
  });
  // bubbles: Sol's LIFE ORB ×3, then her LIFE ORB ×2 (the still shows the second, whose first hit merges)
  h += bubble(C, { cx: 226, top: 298, size: 36, text: "LIFE ORB ×3", color: UNIT_HEX.life, s: 8, w: 72, show: false });
  h += bubble(C, { cx: 226, top: 298, size: 36, text: "LIFE ORB ×2", color: UNIT_HEX.life, s: 29, w: 72 });
  h += rowLabels();
  return h;
}

// =====================================================================================================
// the four files
// =====================================================================================================
const PAUSE = `<div style="position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:50%;background:#2a2e3a;border:1px solid #3a3f4e;display:flex;align-items:center;justify-content:center;z-index:6;"><svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1" width="2.6" height="9" rx="0.8" fill="#e8e8ee"/><rect x="6.9" y="1" width="2.6" height="9" rx="0.8" fill="#e8e8ee"/></svg></div>`;
const OPTIONS = [
  { file: "FightArmyPlain.dc.html", id: "12.0A", scene: sceneA, tag: "A", title: "A · Today: a line from one unit to one enemy",
    text: "Ivy's EXPOSE hits three times, then the Vanguard slams Bram. Every skill is a line from one unit to one enemy. The Undead and Beasts you tried play like this too: the unit looks different, the fight does not.",
    feel: "Feels like: an even trade, again and again." },
  { file: "FightArmyUndead.dc.html", id: "12.0B", scene: sceneB, tag: "B", T: 12, title: "B · Undead: a skeleton wall that upgrades",
    text: "Sol's RAISE ×3 raises three warrior skeletons, Bram's BONE WALL ×2 two shield skeletons; five is the limit. Enemy hits go to the shields first, then the warriors, then Bram. With five standing, Sol's next RAISE upgrades the warriors instead (+3, they hit harder from then on). Ivy's COMMAND sends all five in. A slam can still land on anyone.",
    feel: "Feels like: build a wall, then watch it get stronger." },
  { file: "FightArmyBeasts.dc.html", id: "12.0C", scene: sceneC, tag: "C", title: "C · Beasts: one pack bar, one big pounce",
    text: "No beast has a skill of its own. Every bite fills one bar shared by the pack. When it is full, all five jump on one enemy: the Bear lands first and holds it, the Wolves bite, the Stag heals. A chain means they jump again.",
    feel: "Feels like: wait, BOOM, wait, BOOM." },
  { file: "FightArmyMages.dc.html", id: "12.0D", scene: sceneD, tag: "D", T: 12, title: "D · Mages: a core orb on every mage, the Life Mage drains",
    labelNote: "built 2026-10-21, reworked 2026-10-23",
    note: "2026-10-21; reworked 2026-10-23 to the core orb and the Life drain, drawn as option 12.0E first and built the same day",
    text: "Every mage starts with a core orb that never leaves, and no mage makes a plain attack: on the 2 s beat every orb works, Ivy's zaps, Bram's shields. Sol's Life orbs drain: each takes HP from the Vanguard and heals the most hurt ally with it, Bram. Three loose orbs out, the next skill hit merges them into one Great Drain, shared over the squad. The core orb stays.",
    feel: "Feels like: the team pulses from second 1." },
];
function frame(o, n) {
  const C = makeCtx(`fa${n}k`);
  const scene = o.scene(C);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .arena { --T: ${o.T || 8}s; }
  @keyframes orbSpin { to { transform: rotate(360deg); } }
  ${C.rules.join("\n  ")}
</style>
</helmet>
<!-- Frame ${o.id} (${o.note || "2026-10-21; A is today, B to D picked by Tu and not built yet"}): the same fight, Vanguard and three Outriders, played by a squad that fights this way. Generated by design/tools/gen-army-fights.js; every number is made up, the play style is what is being judged. The loop is ${o.T || 8} seconds; the plain style is the key moment. -->
<div style="background:#14161c;width:390px;padding:12px 0 16px;color:#e8e8ee;">
  <div style="padding:0 20px 10px;">
    <div style="font-size:13px;font-weight:800;color:#e8e8ee;padding-bottom:3px;">${o.title}</div>
    <div style="font-size:10.5px;line-height:1.45;color:#8a8fa3;min-height:74px;">${o.text}</div>
  </div>
  <div style="padding:0 16px;">
    <div style="position:relative;background:#1d2029;border-radius:12px;padding:16px 16px 10px;width:358px;">
      ${PAUSE}
      <div class="arena" style="position:relative;width:326px;height:392px;">
${scene}
      </div>
      <div style="margin-top:6px;text-align:center;font-size:10.5px;font-weight:800;letter-spacing:0.04em;color:#e8e8ee;">${o.feel}</div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`;
}

// ---------- write the files and patch canvas.json ----------
const Y = 16300, FRAMES = [];
OPTIONS.forEach((o, i) => {
  fs.writeFileSync(path.join(CANVAS, o.file), frame(o, i));
  FRAMES.push({ file: o.file, x: 550 * i, y: Y, w: 390, h: 600, label: `${o.id} ${o.title.slice(4)} (${o.labelNote || (o.tag === "A" ? "today, kept for comparison" : "picked 2026-10-21, to build")})` });
});
const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/"file": "FightArmy|"id": "(label|section)-fightarmy/.test(l));
lines = lines.filter((l, i, a) => !(l.trim() === "" && (a[i + 1] === undefined || a[i + 1].trim() === "" || /^\s*\]/.test(a[i + 1]))));
const boards = FRAMES.map((f) => `    { "file": "${f.file}", "x": ${f.x}, "y": ${f.y}, "w": ${f.w}, "h": ${f.h} },`);
const notes = [`    { "id": "section-fightarmy", "x": 0, "y": ${Y - 140}, "w": ${550 * (OPTIONS.length - 1) + 390}, "text": "12 · HOW AN ARMY FIGHTS — the same fight under different ways to play: A is today, B to D were picked and are built (D reworked 2026-10-23). Watch each one loop" },`];
FRAMES.forEach((f, i) => notes.push(`    { "id": "label-fightarmy-${i}", "x": ${f.x}, "y": ${f.y - 60}, "w": 390, "text": ${JSON.stringify(f.label)} },`));
const iArt = lines.findIndex((l) => l.includes('"annotations"'));
lines.splice(iArt - 1, 0, "", ...boards.map((l, i) => (i === boards.length - 1 ? l.replace(/,$/, "") : l)));
for (let i = iArt - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
const iLaunch = lines.findIndex((l) => l.includes('"launch"'));
lines.splice(iLaunch - 1, 0, ...notes.map((l, i) => (i === notes.length - 1 ? l.replace(/,$/, "") : l)));
for (let i = iLaunch - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
fs.writeFileSync(cj, lines.join("\n"));
JSON.parse(fs.readFileSync(cj, "utf8")); // throws if the patch broke the file
console.log("wrote", FRAMES.length, "frames and patched canvas.json");
