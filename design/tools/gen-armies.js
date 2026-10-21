// Generates canvas sections 10 and 11: the armies Undead and Beasts (2026-10-20; the Undead are built since 2026-10-21 and the text below is
// theirs now: Horde, Raise, Bone Wall, Command. The Beasts are still a proposal).
//   10.0A, 10.0B  ArmyPickA / ArmyPickB      where the army pick sits: before round 1, or after the round 1 win
//   10.1, 10.5    ArmySquadUndead / Beasts   the round screen with an army's squad
//   10.2-10.4     ArmyPopup<Unit>            Undead popups (Bone Knight, Wraith, Bone Priest)
//   10.6-10.8     ArmyPopup<Unit>            Beasts popups (Bear, Wolf, Stag)
//   11.1-11.8     ArmyCard<Name>             the looping explain cards: six skills, then the two army rules
// Run:  node design/tools/gen-armies.js     (writes the frames and patches canvas.json)
// Toolkit (scene helpers, popup shell, card shell) is cut from gen-heroes.js; the popup shell and backdrop from
// FighterPopupIvy.dc.html, the round screen from RoundFaceOff.dc.html, the card backdrop from TermExpose.dc.html.
// Every number (HP, damage, 17, 9 and so on) is made up for the picture; the rules are what is being judged.
// Every animated part keeps its key moment as its plain (animation off) style, so a frame reads as a still.

const fs = require("fs");
const path = require("path");
const faces = require("./faces.js");

const CANVAS = path.join(__dirname, "..", "canvas");
const read = (f) => fs.readFileSync(path.join(CANVAS, f), "utf8");

// ---------- palette ----------
const ROLE = {
  tank: { hex: "#ffb454", rgb: "255,180,84", word: "Tank" },
  damage: { hex: "#b98cff", rgb: "185,140,255", word: "Damage" },
  healer: { hex: "#6ee7a0", rgb: "110,231,160", word: "Healer" },
};
const RED = "#ff5d5d", YEL = "#ffcf4d", BONE = "#eae6d8", GLOW = "#9ff0e0";

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// ---------- armies and units ----------
const ARMIES = {
  undead: {
    key: "undead", name: "Undead", hex: "#a9b7c9", rgb: "169,183,201", icon: "horde",
    pitch: "Every skill raises an army.",
    play: "You want long fights and a wall of skeletons.",
    rule: {
      name: "Horde", head: "Every skill hit raises a skeleton.",
      lines: ["Up to 5 stand. Enemy hits go to the shield skeletons first, then the warriors.", "With 5 standing, a skill hit makes that kind stronger instead."],
      card: "Every skill hit raises a skeleton that stays for the whole fight. Up to 5 stand. Enemy hits go to the shield skeletons first, then the warriors, then the Bone Knight. With 5 standing, a skill hit makes that kind stronger instead. A slam can still land on anyone.",
    },
  },
  beasts: {
    key: "beasts", name: "Beasts", hex: "#d9a066", rgb: "217,160,102", icon: "pack",
    pitch: "Five small units. Skills all the time.",
    play: "More bodies, and which beasts you field matters.",
    rule: {
      name: "Pack", head: "You field 5 beasts instead of 3.",
      lines: ["Each beast is smaller and weaker.", "Every hit one lands fills every other beast's skill bar a little."],
      card: "You field 5 beasts instead of 3. Each beast is smaller and weaker, but every hit one lands fills every other beast's skill bar a little, so skills go off all the time.",
    },
  },
};

// hp, stat: made-up numbers. skill: key of SKILLS.
const UNITS = {
  knight: { army: "undead", role: "tank", title: "Bone Knight", name: "Bram", hex: "#c9b98a", row: "FRONT", hp: 145, stat: ["Damage", 7], skill: "boneWall",
    job: "The Undead Tank. Raises a wall of shield skeletons in front of it." },
  wraith: { army: "undead", role: "damage", title: "Wraith", name: "Ivy", hex: "#8a86b8", row: "BACK", hp: 60, stat: ["Damage", 8], skill: "command",
    job: "The Undead Damage unit. Sends the whole horde in at once." },
  priest: { army: "undead", role: "healer", title: "Bone Priest", name: "Sol", hex: "#7fae9a", row: "BACK", hp: 76, stat: ["Heal", 4], skill: "raise",
    job: "The Undead Healer. Heals a little, and raises warrior skeletons." },
  bear: { army: "beasts", role: "tank", title: "Bear", name: "Bruno", hex: "#d08a3c", row: "FRONT", hp: 140, stat: ["Damage", 5], skill: "roar",
    job: "The Beast Tank. Stands in front and rallies the pack." },
  wolf: { army: "beasts", role: "damage", title: "Wolf", name: "Fang", hex: "#b08cf5", row: "BACK", hp: 60, stat: ["Damage", 6], skill: "packBite",
    job: "The Beast Damage unit. Bites more with other Wolves beside it." },
  stag: { army: "beasts", role: "healer", title: "Stag", name: "Moss", hex: "#6bd69a", row: "BACK", hp: 72, stat: ["Heal", 3], skill: "herd",
    job: "The Beast Healer. Heals more the bigger the pack is." },
};

// skill words: head, chips, two lines (the second is what "goes again" does), card = the one-sentence version
const SKILLS = {
  boneWall: { name: "Bone Wall", icon: "wall", head: "Raises a shield skeleton in front.", chips: ["Shield skeleton"],
    lines: ["Raises 1 shield skeleton for each time it goes again.", "Enemy hits go to shield skeletons first. With 5 standing, a hit makes shields tougher."],
    card: "Raises a shield skeleton that stands in front and takes the enemy's hits. With 5 standing, a hit makes every shield skeleton tougher instead." },
  command: { name: "Command", icon: "command", head: "Every skeleton strikes the front enemy.", chips: ["Front enemy", "Whole horde"],
    lines: ["Each standing skeleton hits with its own damage.", "Each time it goes again, the strike is bigger."],
    card: "Every standing skeleton strikes the front enemy at once, with its own damage. Each time it goes again, the strike is bigger." },
  raise: { name: "Raise", icon: "skull", head: "Raises a warrior skeleton.", chips: ["Warrior skeleton"],
    lines: ["Raises 1 warrior skeleton for each time it goes again.", "With 5 standing, a hit makes warriors hit harder instead."],
    card: "Raises a warrior skeleton that fights for the rest of the fight. With 5 standing, a hit makes every warrior skeleton hit harder instead." },
  roar: { name: "Roar", icon: "roar", head: "Takes the next {slam} and rallies the pack.", chips: ["Next slam", "Whole pack"],
    lines: ["The first time it goes, every other beast's skill bar fills 25%.", "Each time it goes again, it takes one more slam."],
    card: "Takes the next {slam} for the pack, and every other beast's skill bar fills 25%." },
  packBite: { name: "Pack Bite", icon: "bite", head: "Bites the front enemy, with the pack.", chips: ["Front enemy"],
    lines: ["Bites for 6, once more for each other Wolf in the squad: 3 Wolves, 18.", "Each time it goes again, every bite is bigger."],
    card: "Bites the front enemy for 6, once more for each other Wolf in the squad. Three Wolves bite for 18." },
  herd: { name: "Herd", icon: "herd", head: "Heals every unit, more for a bigger pack.", chips: ["Whole squad"],
    lines: ["Heals each unit 1 for every beast in the squad: 5 beasts, 5 HP each.", "Each time it goes again, it heals again."],
    card: "Heals every unit 1 for every beast in the squad. With 5 beasts, each unit gets 5 HP." },
};

// ---------- unique svg ids ----------
let uidN = 0;
const uniq = (svg) => { const p = "a" + (uidN++) + "_"; return svg.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`); };
const face = (hex, size, tier = "fresh") => uniq(faces.squadFace(hex, tier, size));
const villain = (size, scowl = 1) => uniq(faces.villainFace(size, scowl));

// ---------- icons ----------
const sw = (c, w = 1.8) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const I = {
  wall: (c) => `<path d="M5 4 H19 V12 Q19 18.5 12 21 Q5 18.5 5 12 Z" fill="${c}33" ${sw(c)}/><path d="M12 7 V17 M8 11.5 H16" ${sw(c, 1.6)}/>`,
  command: (c) => `<path d="M14.5 3.5 L20.5 3.5 L20.5 9.5 L10 20 L4 20 L4 14 Z" fill="${c}33" ${sw(c)}/><path d="M7 17 L17 7" ${sw(c, 1.6)}/>`,
  skull: (c) => `<path d="M12 3.5 C7.5 3.5 5 6.5 5 10.5 C5 13 6 14.5 7.5 15.5 V19 H16.5 V15.5 C18 14.5 19 13 19 10.5 C19 6.5 16.5 3.5 12 3.5 Z" fill="${c}33" ${sw(c)}/><circle cx="9.5" cy="10.5" r="1.7" fill="${c}"/><circle cx="14.5" cy="10.5" r="1.7" fill="${c}"/>`,
  horde: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M5 20 V16.5 C5 14.5 19 14.5 19 16.5 V20 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  roar: (c) => `<path d="M5 8 Q9 12 5 16 M10 5.5 Q16 12 10 18.5 M15 3 Q23 12 15 21" ${sw(c, 1.8)}/>`,
  bite: (c) => `<path d="M4.5 6 H19.5 C19.5 11 17.5 13 15.8 13 L14.2 19.5 L12.8 13.5 H11.2 L9.8 19.5 L8.2 13 C6.5 13 4.5 11 4.5 6 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  herd: (c) => `<path d="M8 21 V13 M16 21 V13 M8 13 C7 9 5 7 4 4 M8 13 C9 10 10 8 10 5 M16 13 C17 9 19 7 20 4 M16 13 C15 10 14 8 14 5" ${sw(c, 1.7)}/>`,
  pack: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M7 16 C7 13 17 13 17 16 C17 19 14 19.5 12 19.5 C10 19.5 7 19 7 16 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  target: (c) => `<circle cx="8" cy="8" r="6" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="8" cy="8" r="2" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
};
const svg = (inner, size, vb = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" style="flex:none;overflow:visible;">${inner}</svg>`;

const terms = (s, tap) => s.replace(/\{slam\}/g, `<span class="term${tap ? " tap" : ""}">slam</span>`);

// ---------- the unit looks ----------
// look(key, size) -> { under: art behind the disc (ears, antlers, wisps), inner: art on the disc (face, marks), bodyStyle }
const VB = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;">`;
const hollowEyes = `<ellipse cx="33" cy="45" rx="13" ry="15" fill="#14161c"/><ellipse cx="67" cy="45" rx="13" ry="15" fill="#14161c"/><circle cx="33" cy="47" r="8.5" fill="${GLOW}" opacity="0.28"/><circle cx="67" cy="47" r="8.5" fill="${GLOW}" opacity="0.28"/><circle cx="33" cy="47" r="4.6" fill="${GLOW}"/><circle cx="67" cy="47" r="4.6" fill="${GLOW}"/>`;
function look(key, size) {
  const u = UNITS[key], hex = u.hex, dk = shade(hex, -0.3), lt = shade(hex, 0.55);
  const crack = `stroke="#14161c" stroke-opacity="0.55" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
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
  }
}
// a body for the HTML frames (squad, popup, pick): shadow, art behind, disc with its face
function unitBody(key, size, extra = "") {
  const L = look(key, size), u = UNITS[key];
  return `<div style="position:relative;width:${size}px;height:${size}px;${extra}"><div style="position:absolute;top:${(size * 0.86).toFixed(1)}px;left:50%;width:${(size * 0.83).toFixed(1)}px;height:${Math.max(4, size * 0.14).toFixed(1)}px;transform:translateX(-50%);border-radius:50%;background:rgba(0,0,0,0.4);filter:blur(2px);"></div>${L.under}<div style="position:absolute;inset:0;border-radius:50%;background:${u.hex};${L.bodyStyle}">${L.inner}</div></div>`;
}
// the plain, army-less squad (what round 1 looks like today)
const plainBody = (role, size) => `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${ROLE[role].hex};">${face(ROLE[role].hex, size)}</div>`;

// stat icons, as on the round screen
const HP_ICO = `<svg viewBox="0 0 12 12" aria-label="HP"><path d="M6 10.6C6 10.6 1.2 7.6 1.2 4.3 1.2 2.7 2.4 1.6 3.8 1.6c.9 0 1.7.5 2.2 1.3.5-.8 1.3-1.3 2.2-1.3 1.4 0 2.6 1.1 2.6 2.7 0 3.3-4.8 6.3-4.8 6.3z" fill="currentColor"/></svg>`;
const DMG_ICO = `<svg viewBox="0 0 12 12" aria-label="Damage"><path d="M4.4 7.6 10.6 1.4M2.8 6.2l3 3M3.6 8.4 1.6 10.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
const HEAL_ICO = `<svg viewBox="0 0 12 12" aria-label="Heal"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`;
const statLine = (u) => `<div class="stat"><span class="st">${HP_ICO}${u.hp}</span>${u.stat[0] === "Heal" ? `<span class="st heal">${HEAL_ICO}${u.stat[1]}</span>` : `<span class="st dmg">${DMG_ICO}${u.stat[1]}</span>`}</div>`;

// =====================================================================================================
// 10.0A / 10.0B — where the army pick sits
// =====================================================================================================
function armyCard(a, withChange) {
  const keys = a.key === "undead" ? ["knight", "wraith", "priest"] : ["bear", "wolf", "wolf", "wolf", "stag"];
  const px = a.key === "undead" ? 40 : 32;
  const plain = ["tank", "damage", "healer"];
  const bodies = keys.map((k, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:${a.key === "undead" ? 78 : 56}px;">${unitBody(k, px, "margin-top:12px;")}<div style="font-size:9px;font-weight:700;color:${ROLE[UNITS[k].role].hex};margin-top:2px;">${UNITS[k].title}</div></div>`).join("");
  const change = withChange
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;font-size:9.5px;color:#8a8fa3;"><span style="display:flex;gap:4px;">${plain.map((r) => plainBody(r, 18)).join("")}</span><span style="font-weight:800;">→</span><span>your three units change into this</span></div>`
    : "";
  const skills = keys.filter((k, i) => keys.indexOf(k) === i).map((k) => SKILLS[UNITS[k].skill].name).join(" · ");
  return `<div style="border:1px solid rgba(${a.rgb},0.5);background:rgba(${a.rgb},0.08);border-radius:12px;padding:12px 12px 12px;">
      <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:20px;font-weight:800;color:#e8e8ee;">${a.name}</span><span style="font-size:11px;font-weight:700;color:${a.hex};">${a.pitch}</span></div>
      <div style="display:flex;justify-content:center;gap:2px;margin-top:2px;">${bodies}</div>${change}
      <div style="margin-top:10px;font-size:12px;line-height:1.4;color:#c7cad6;"><b style="font-size:9.5px;letter-spacing:.06em;color:${a.hex};">RULE · ${a.rule.name.toUpperCase()}</b> ${a.rule.head} ${a.rule.lines[0]}</div>
      <div style="margin-top:4px;font-size:11px;color:#8a8fa3;"><b style="font-size:9.5px;letter-spacing:.06em;color:#e8e8ee;">SKILLS</b> ${skills}</div>
      <div style="margin-top:10px;text-align:center;font-size:14px;font-weight:700;background:${a.hex};color:#14161c;border-radius:8px;padding:10px;">Pick ${a.name}</div>
    </div>`;
}
const shellOpen = (css, h) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>${css}</style>
</helmet>
`;
const shellClose = `</x-dc>
</body>
</html>
`;
const BASE_CSS = `  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .term { font-weight: 800; white-space: nowrap; color: #c5e86c; }
  .term.tap { text-decoration: underline dotted; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
`;
const rf = read("RoundFaceOff.dc.html");
const RF_CSS = rf.slice(rf.indexOf("<style>") + 7, rf.indexOf("</style>"));
const STRIP = rf.slice(rf.indexOf("<!-- progress strip (unchanged) -->"), rf.indexOf("<!-- goal line")).replace("ROUND 1/20", "ROUND 1/20");

function pickFile(opt) {
  const A = opt === "A";
  const strip = A ? "" : STRIP.replace("width: 5%", "width: 8%");
  const title = A ? "Choose your army" : "Round 1 won — choose your army";
  const sub = A
    ? "Your whole squad changes: how it looks, what its skills do, and one rule in every fight. Round 1 comes next."
    : "Your three units change into it for round 2.";
  const note = A
    ? "Option A: a pick screen before round 1. The run opens on the choice, so the first fight is already played as an army. The cost: a screen before the first fight (the opening today is round 1, then the rune pick)."
    : "Option B: the pick comes after the round 1 win, in the place of the round 1 rune pick. Round 1 is played with today's plain units and every screen but this one stays accept-default; the units change into the army for round 2.";
  return shellOpen(RF_CSS) + `
<!-- Frame 10.0${opt} (proposal, awaiting Tu's pick): ${note} -->
<div style="width:390px;min-height:880px;background:#14161c;padding:16px;">
  <div style="background:#1d2029;border-radius:12px;padding:16px 14px 16px;color:#e8e8ee;">
    ${strip}
    <div style="text-align:center;font-size:24px;font-weight:800;line-height:1.2;margin-top:${A ? 8 : 4}px;">${title}</div>
    <div style="text-align:center;font-size:12px;color:#8a8fa3;margin-top:6px;">${sub}</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
      ${armyCard(ARMIES.undead, !A)}
      ${armyCard(ARMIES.beasts, !A)}
    </div>
  </div>
  <div style="margin-top:10px;font-size:10.5px;line-height:1.45;color:#8a8fa3;text-align:center;">${note} More armies, and how they are earned, are not decided.</div>
</div>
` + shellClose;
}

// =====================================================================================================
// 10.1 / 10.5 — the round screen with an army's squad
// =====================================================================================================
function squadCol(key, name, w, px, barW) {
  const u = UNITS[key];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:${w}px;">${unitBody(key, px, "margin-top:" + (key === "stag" || key === "wolf" ? 12 : 8) + "px;")}<div style="font-size:12px;font-weight:700;color:#e8e8ee;margin-top:2px;">${name}</div><div style="font-size:9px;font-weight:700;color:${ROLE[u.role].hex};">${u.title}</div><div style="width:${barW}px;height:6px;border-radius:3px;background:#2a2e3a;overflow:hidden;"><div style="width:100%;height:100%;background:#4da6ff;"></div></div>${statLine(u)}</div>`;
}
const rowLabel = (t) => `<span style="position:absolute;left:0;top:22px;font-size:9px;font-weight:800;letter-spacing:0.08em;color:#8a8fa3;pointer-events:none;">${t}</span>`;
function benchShelf(keys) {
  const items = keys.map(([k, n]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;"><div style="opacity:.6;">${unitBody(k, 22)}</div><div style="font-size:9.5px;font-weight:600;color:#8a8fa3;line-height:1.2;">${n}</div><div style="width:22px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;"><div style="width:100%;height:100%;background:#4da6ff;opacity:.6;"></div></div></div>`).join("");
  return `<div style="margin-top:12px;padding-top:8px;border-top:1px dashed #3a3f4e;"><div style="display:flex;align-items:center;margin-bottom:6px;"><span style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#8a8fa3;">BENCH</span><span style="margin-left:auto;font-size:11px;font-weight:700;color:#4da6ff;">Change squad ›</span></div><div style="display:flex;gap:14px;padding-left:2px;">${items}</div></div>`;
}
function squadFile(armyKey) {
  const a = ARMIES[armyKey], U = armyKey === "undead";
  const enemy = rf.slice(rf.indexOf("<!-- ENEMY zone -->"), rf.indexOf("<!-- YOUR SQUAD zone -->"));
  const strip = STRIP.replace("ROUND 1/20", "ROUND 2/20").replace("width: 5%", "width: 10%");
  const front = `<div style="position:relative;display:flex;justify-content:center;align-items:flex-start;gap:12px;">${rowLabel("FRONT")}${U ? squadCol("knight", "Bram", 82, 36, 54) : squadCol("bear", "Bruno", 82, 36, 54)}</div>`;
  const back = U
    ? `<div style="position:relative;display:flex;justify-content:center;align-items:flex-start;gap:12px;">${rowLabel("BACK")}${squadCol("wraith", "Ivy", 82, 36, 54)}${squadCol("priest", "Sol", 82, 36, 54)}</div>`
    : `<div style="position:relative;display:flex;justify-content:flex-start;align-items:flex-start;gap:4px;padding-left:40px;">${rowLabel("BACK")}${squadCol("wolf", "Fang", 62, 30, 44)}${squadCol("wolf", "Ash", 62, 30, 44)}${squadCol("wolf", "Dusk", 62, 30, 44)}${squadCol("stag", "Moss", 62, 30, 44)}</div>`;
  const armyChip = `<span style="font-size:10px;font-weight:800;letter-spacing:0.06em;background:${a.hex};color:#14161c;border-radius:6px;padding:2px 7px;">${a.name.toUpperCase()}</span><span style="font-size:11.5px;color:#c7cad6;"><b style="color:${a.hex};text-decoration:underline dotted;text-underline-offset:3px;">${a.rule.name}</b>${U ? ": rise once" : ": five fielded"}</span>`;
  const zone = `<!-- YOUR SQUAD zone -->
      <div style="background: rgba(77,166,255,0.07); border: 1px solid rgba(77,166,255,0.28); border-radius: 12px; padding: 10px 12px 12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:10px;font-weight:800;letter-spacing:0.06em;background:#4da6ff;color:#0c1420;border-radius:6px;padding:2px 7px;white-space:nowrap;">YOUR SQUAD</span>${armyChip}</div>
        ${front}<div style="height: 12px; border-bottom: 1px dashed #3a3f4e; margin-bottom: 12px;"></div>${back}
        ${benchShelf(U ? [["knight", "Kit"], ["wraith", "Wren"], ["priest", "Olo"]] : [["bear", "Kit"], ["wolf", "Rue"]])}
      </div>`;
  const note = U
    ? `Round screen, round 2, Undead squad (proposal, design only, not built): the same screen as 1.1 with the army's bodies. Bram, Ivy and Sol are the same three units, now a Bone Knight, a Wraith and a Bone Priest. The army chip names the rule and opens its card (11.7).`
    : `Round screen, round 2, Beasts squad (proposal, design only, not built): five fielded, one Bear in front and four behind (three Wolves and a Stag), each one smaller. The bench holds two. The army chip names the rule and opens its card (11.8). Open: how many units a Beasts run starts with.`;
  return shellOpen(RF_CSS) + `
<!-- Frame ${U ? "10.1" : "10.5"} (proposal): ${note} -->
<div style="background: #14161c; width: 390px; min-height: 780px; display: flex; justify-content: center; padding-top: 24px;">
  <div style="width: 100%; max-width: 640px; padding: 0 16px 24px; box-sizing: border-box;">
    <div style="position: relative; background: #1d2029; border-radius: 12px; padding: 16px; box-sizing: border-box;">
      ${strip}
      <div style="font-size: 11px; color: #8a8fa3; text-align: center; margin-bottom: 12px;">Tap any fighter to see what it does</div>
      ${enemy}${zone}
      <button style="margin-top: 14px; width: 100%; font: inherit; font-weight: 700; background: #4da6ff; color: #0c1420; border: none; border-radius: 8px; padding: 13px; font-size: 15px;">Fight!</button>
    </div>
    <div style="margin-top:10px;font-size:10.5px;line-height:1.45;color:#8a8fa3;text-align:center;">${note}</div>
  </div>
</div>
` + shellClose;
}

// =====================================================================================================
// 10.2-10.4, 10.6-10.8 — the popups
// =====================================================================================================
const ivy = read("FighterPopupIvy.dc.html");
const POPUP_CSS = ivy.slice(ivy.indexOf("<style>") + 7, ivy.indexOf("</style>"));
const POPUP_BACKDROP = ivy.slice(
  ivy.indexOf('<div style="position: relative; background: #14161c; width: 390px'),
  ivy.indexOf('<div style="position: absolute; top: 40px; left: 20px; width: 350px'),
);
function chipEl(key, name, ring) {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:44px;"><div style="position:relative;width:28px;height:28px;margin-top:6px;${ring ? "" : "opacity:0.55;"}"><div style="position:absolute;inset:-2px;border-radius:50%;${ring ? "box-shadow:0 0 0 2px #14161c,0 0 0 4px #e8e8ee;" : ""}"></div>${unitBody(key, 28)}</div><div style="font-size:9px;font-weight:${ring ? 800 : 600};color:${ring ? "#e8e8ee" : "#8a8fa3"};">${name}</div></div>`;
}
function tile(rgb, hex, ico, name, tag, head, chipsHtml, lines, icons, footer) {
  return `
    <div class="sec skill" style="--r: ${rgb};">
      <div class="sk-top">
        <div class="sk-em">${svg(I[ico](hex), 26)}</div>
        <div class="sk-main">
          <div class="sk-row"><span class="sk-name">${name}</span><span class="sk-tag">${tag}</span></div>
          <div class="sk-head">${head}</div>
        </div>
      </div>
      ${chipsHtml ? `<div class="sk-chips">${chipsHtml}</div>` : ""}
      <div class="sk-div"></div>
      ${lines.map((l, i) => `<div class="sk-line"><span class="sk-li">${svg(I[icons[i]](hex), 14)}</span><span>${l}</span></div>`).join("")}
      ${footer || ""}
    </div>`;
}
const seeMore = (name) => `<div class="sk-more"><svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.6 5.3 L11 8 L6.6 10.7 Z" fill="currentColor"/></svg><span>See ${name} in action</span><span class="chev">›</span></div>`;
const POPUP_NUM = { knight: "10.2", wraith: "10.3", priest: "10.4", bear: "10.6", wolf: "10.7", stag: "10.8" };
const CARD_NUM = { boneWall: "11.1", command: "11.2", raise: "11.3", roar: "11.4", packBite: "11.5", herd: "11.6", undead: "11.7", beasts: "11.8" };
function popupFile(key) {
  const u = UNITS[key], a = ARMIES[u.army], S = SKILLS[u.skill], role = ROLE[u.role];
  const set = u.army === "undead" ? ["knight", "wraith", "priest"] : ["bear", "wolf", "wolf", "wolf", "stag"];
  const names = { knight: "Bram", wraith: "Ivy", priest: "Sol", bear: "Bruno", stag: "Moss" };
  let wolfN = 0;
  const wolves = ["Fang", "Ash", "Dusk"];
  const switcher = set.map((k) => {
    const nm = k === "wolf" ? wolves[wolfN++] : names[k];
    return chipEl(k, nm, k === key && (k !== "wolf" || nm === u.name));
  }).join("")
    + `<div style="width:1px;height:30px;background:#3a3f4e;margin:6px 4px 0;"></div>`
    + `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:44px;opacity:0.55;"><div style="position:relative;width:28px;height:28px;margin-top:6px;border-radius:50%;background:${RED};">${villain(28)}</div><div style="font-size:9px;font-weight:600;color:#8a8fa3;">Warden</div></div>`;
  const chips = S.chips.map((c) => `<span class="sk-chip"><svg class="sk-tg" width="11" height="11" viewBox="0 0 16 16">${I.target("currentColor")}</svg>${c}</span>`).join("");
  const armyTile = tile(a.rgb, a.hex, a.icon, a.rule.name, "ARMY", terms(a.rule.head, true), "", a.rule.lines.map((l) => terms(l, true)), ["bullet", "bullet"], seeMore(a.rule.name));
  const skillTile = tile(role.rgb, role.hex, S.icon, S.name, "SKILL", terms(S.head, true), chips, S.lines.map((l) => terms(l, true)), ["bullet", "repeat"], seeMore(S.name));
  const hpPct = 100;
  const note = `Popup, ${u.title} (proposal, design only, not built). Over a dimmed copy of 1.1 as a stand-in. The 2.3 popup with the army's body, an ARMY tile above the SKILL tile (both open a card: ${CARD_NUM[u.army]} and ${CARD_NUM[u.skill]}). Numbers are made up.`;
  return shellOpen(POPUP_CSS) + `
${POPUP_BACKDROP}<div style="position: absolute; top: 40px; left: 20px; width: 350px; background: #1d2029; border: 1px solid #3a3f4e; border-radius: 14px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.55);">
    <div style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: #2a2e3a; color: #c7cad6; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700;">✕</div>
    <div style="display: flex; align-items: flex-start; gap: 2px; margin-right: 30px;">${switcher}</div>
    <div style="display: flex; align-items: center; gap: 6px; margin-top: 14px;">
      <div class="arrow">‹</div>
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div style="position: relative; width: 44px; height: 44px; margin-top: 14px;">${unitBody(key, 44)}</div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <span style="font-size: 16px; font-weight: 800; color: #e8e8ee;">${u.name}</span>
          <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.12em; color: #14161c; background: ${a.hex}; border-radius: 4px; padding: 1px 5px;">${a.name.toUpperCase()}</span>
          <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: #8a8fa3; border: 1px solid #3a3f4e; border-radius: 4px; padding: 1px 5px;">${u.row}</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: ${role.hex};">${u.title} · ${role.word}</div>
        <div style="font-size: 12px; line-height: 1.4; color: #c7cad6; text-align: center; max-width: 210px;">${u.job}</div>
      </div>
      <div class="arrow">›</div>
    </div>
    <div style="display: flex; gap: 6px; justify-content: center; margin-top: 10px;"><span class="chip">HP ${u.hp}/${u.hp}</span><span class="chip">${u.stat[0]} ${u.stat[1]}</span></div>
    <div style="width: 150px; height: 6px; border-radius: 3px; background: #2a2e3a; overflow: hidden; margin: 6px auto 0;"><div style="width: ${hpPct}%; height: 100%; background: #4da6ff;"></div></div>${armyTile}${skillTile}
  </div>

  <!-- design note, not part of the screen -->
  <div style="position: absolute; left: 20px; right: 20px; bottom: 14px; font-size: 10.5px; line-height: 1.45; color: #8a8fa3; text-align: center;">${note}</div>
</div>
` + shellClose;
}

// =====================================================================================================
// 11.x — the scene toolkit (copied from gen-heroes.js, with art behind the disc)
// =====================================================================================================
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
const OP = (arr) => arr.map(([p, v]) => [p, `opacity:${v}`]);
const win = (a, b, f = 1) => [[0, "opacity:0"], [a, "opacity:0"], [a + f, "opacity:1"], [b, "opacity:1"], [b + f, "opacity:0"], [100, "opacity:0"]];
const from = (a, f = 1) => [[0, "opacity:0"], [a, "opacity:0"], [a + f, "opacity:1"], [96, "opacity:1"], [100, "opacity:0"]];
const FLOAT_HID = "opacity:0;transform:translate(-50%,0) scale(0.8)";
const floatStops = (a) => [[0, FLOAT_HID], [a, FLOAT_HID], [a + 1, "opacity:1;transform:translate(-50%,-4px) scale(1.25)"], [a + 7, "opacity:1;transform:translate(-50%,-14px) scale(1)"], [a + 14, "opacity:0;transform:translate(-50%,-18px) scale(1)"], [100, FLOAT_HID]];

function shadow(size, a = 0.4) { return `<div style="position:absolute;border-radius:50%;top:${(size * 0.85).toFixed(1)}px;left:${(size * 0.125).toFixed(1)}px;width:${(size * 0.75).toFixed(1)}px;height:${(size * 0.15).toFixed(1)}px;background:rgba(0,0,0,${a});filter:blur(2px);"></div>`; }
function body(C, o) {
  const { cx, top, size, bg, faceSvg, bodyAnim = "", bodyStyle = "", wrapStyle = "", wrapAnim = "", alpha = 0.24, overlay = "", under = "" } = o;
  return abs(`left:${cx - size / 2}px;top:${top}px;width:${size}px;height:${size}px;`,
    shadow(size, alpha) + `<div style="position:absolute;inset:0;transform-origin:50% 100%;${wrapStyle}${wrapAnim}">${under}<div style="position:absolute;inset:0;border-radius:50%;background:${bg};${bodyStyle}${bodyAnim}">${faceSvg}</div>${overlay}</div>`);
}
const nameLabel = (cx, y, html, extra = "") => abs(`left:${cx - 55}px;top:${y}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${extra}`, html);
function hpBar(C, { cx, y, pct = 100, stops = null, w = 36 }) {
  const fill = `<div style="flex:none;width:${pct}%;height:100%;background:#4da6ff;${stops ? C.kf(W(stops)) : ""}"></div>`;
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:4px;border-radius:2px;background:#2a2e3a;overflow:hidden;display:flex;`, fill);
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
// charge bar: a still (pct), a firing cycle (cycles), or a bar that steps up (stops, in %)
function chargeBar(C, { cx, y, pct = 45, cycles = null, stops = null, w = 36 }) {
  if (stops) return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;`, `<div style="width:${stops[stops.length - 1][1]}%;height:100%;background:#e8e8ee;${C.kf(W(stops))}"></div>`);
  if (!cycles) return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;`, `<div style="width:${pct}%;height:100%;background:#e8e8ee;"></div>`);
  const b = barStops(cycles);
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;${C.kf(b.g)}`, `<div style="width:100%;height:100%;background:${YEL};${C.kf(b.w)}"></div>`);
}
function bubble(C, { cx, top, size, text, color, s, w = 66, barW = 36 }) {
  const h = 18, bl = cx - w / 2, bt = top - 26, tipX = cx, tipY = bt + 22, barY = top + size + 19.5, barL = cx - barW / 2;
  const pop = C.kf([[0, "opacity:0;transform:scale(0.7)"], [s + 1, "opacity:0;transform:scale(0.7)"], [s + 2.8, "opacity:1;transform:scale(1)"], [s + 22.95, "opacity:1;transform:scale(1)"], [s + 23, "opacity:0;transform:scale(1)"], [100, "opacity:0;transform:scale(1)"]]);
  const border = C.kf([[0, "stroke-dashoffset:100"], [s + 5.8, "stroke-dashoffset:100"], [s + 13, "stroke-dashoffset:0"], [s + 22.95, "stroke-dashoffset:0"], [s + 23, "stroke-dashoffset:100"], [100, "stroke-dashoffset:100"]]);
  const hid = "stroke-dasharray:22 178;stroke-dashoffset:22;opacity:0", mid = "stroke-dasharray:22 178;stroke-dashoffset:22;opacity:1", end = "stroke-dasharray:22 178;stroke-dashoffset:-100;opacity:1", gone = "stroke-dasharray:22 178;stroke-dashoffset:-100;opacity:0";
  const flow = C.kf([[0, hid], [s + 0.95, hid], [s + 1.2, mid], [s + 7, end], [s + 7.1, gone], [100, gone]]);
  const outline = `M${w / 2},22 L${w / 2 - 4},18 H8 A8 8 0 0 1 0,10 V8 A8 8 0 0 1 8,0 H${w - 8} A8 8 0 0 1 ${w},8 V10 A8 8 0 0 1 ${w - 8},18 H${w / 2 + 4} Z`;
  return `<svg width="322" height="210" viewBox="0 0 322 210" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:3;"><path d="M${barL},${barY} L${barL - 12},${barY} L${barL - 12},${tipY} L${tipX},${tipY}" fill="none" stroke="${YEL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="22 178" stroke-dashoffset="-100" opacity="0.85" style="filter:drop-shadow(0 0 3px ${YEL});${flow}"/></svg>`
    + `<div style="position:absolute;left:${bl}px;top:${bt}px;width:${w}px;height:${h}px;z-index:4;white-space:nowrap;transform-origin:50% ${((22 / 18) * 100).toFixed(1)}%;${pop}"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;"><path d="${outline}" fill="#14161c" stroke="#3a3f4e" stroke-width="1.4" stroke-linejoin="round"/><path d="${outline}" fill="none" stroke="${YEL}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" style="filter:drop-shadow(0 0 2.5px ${YEL});${border}"/></svg><span style="position:absolute;left:0;right:0;top:0;height:${h}px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;letter-spacing:0.05em;color:${color};">${text}</span></div>`;
}
function beam(C, { x1, y1, x2, y2, color, at, w = 2, dur = 10 }) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
  const t = (sx) => `transform:rotate(${ang}deg) scaleX(${sx})`;
  const anim = C.kf([[0, `opacity:0;${t(0)}`], [at - 0.05, `opacity:0;${t(0)}`], [at, `opacity:0.9;${t(0.1)}`], [at + dur * 0.6, `opacity:0.9;${t(1)}`], [at + dur, `opacity:0;${t(1)}`], [100, `opacity:0;${t(1)}`]]);
  return `<div style="position:absolute;left:${x1}px;top:${y1 - w / 2}px;width:${len.toFixed(1)}px;height:${w}px;background:${color};box-shadow:0 0 4px 1px ${color};transform-origin:0 50%;${t(1)};opacity:0.55;z-index:3;${anim}"></div>`;
}
function floater(C, { x, y, text, color, at, size = 14, glow = "#ff5252" }) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;font-size:${size}px;font-weight:800;color:${color};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.6),0 0 8px ${glow};z-index:5;transform:translate(-50%,-10px);${C.kf(floatStops(at))}">${text}</div>`;
}
function ring(C, { cx, cy, r, color, at, dur = 8 }) {
  const a = C.kf([[0, "opacity:0;transform:scale(0.4)"], [at, "opacity:0;transform:scale(0.4)"], [at + 0.1, "opacity:0.9;transform:scale(0.5)"], [at + dur, "opacity:0;transform:scale(1.5)"], [100, "opacity:0;transform:scale(1.5)"]]);
  return abs(`left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:2px solid ${color};box-shadow:0 0 8px ${color};opacity:0;z-index:3;${a}`);
}
const xEyes = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"><path d="M20 38 L42 58 M42 38 L20 58 M58 38 L80 58 M80 38 L58 58" stroke="#14161c" stroke-width="8" stroke-linecap="round" fill="none"/></svg>`;
// a small tag on the scene, base style = visible; stops decide when it shows
const chip = (C, { x, y, text, color, stops, base = 1 }) => abs(`left:${x}px;top:${y}px;font-size:7.5px;font-weight:800;color:${color};background:#2a2e3a;border:1px solid ${color};border-radius:8px;padding:0 5px;white-space:nowrap;z-index:5;opacity:${base};${C.kf(stops)}`, text);
const caps = (C, list) => list.map(({ side, text, color, at: [a, b] }) => abs(`${side}:12px;top:91px;font-size:8px;font-weight:800;letter-spacing:0.12em;color:${color};white-space:nowrap;z-index:2;opacity:0.9;${C.kf(OP([[0, 0.35], [a, 0.35], [a + 2, 1], [b, 1], [b + 2, 0.35], [100, 0.35]]))}`, text)).join("");

// ---------- the cast ----------
const WARDEN = { cx: 161, top: 10, size: 48 }, ACO_L = { cx: 81, top: 28, size: 30 }, ACO_R = { cx: 241, top: 28, size: 30 };
function enemy(C, o) {
  const { cx, top, size, name, hp, hpStops = null, hpPct = 100 } = o;
  return body(C, { cx, top, size, bg: RED, faceSvg: villain(size, size > 40 ? 1.2 : 1), alpha: 0.4 })
    + abs(`left:${cx - 50}px;top:${top + size + 3}px;width:100px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;`, name)
    + hpBar(C, { cx, y: top + size + 14, pct: hpPct, stops: hpStops, w: size })
    + abs(`left:${cx - 50}px;top:${top + size + 20}px;width:100px;text-align:center;font-size:7.5px;font-weight:700;color:#8a8fa3;`, hp);
}
const wardenE = (C, extra = {}) => enemy(C, { ...WARDEN, name: "Warden", hp: "HP 210", ...extra });
const acoL = (C) => enemy(C, { ...ACO_L, name: "Acolyte", hp: "HP 55" });
const acoR = (C) => enemy(C, { ...ACO_R, name: "Acolyte", hp: "HP 55" });
// one of our units; `name` is what sits under it, a label like "Bram · Guard" unless labelHtml says otherwise
function ally(C, key, o) {
  const u = UNITS[key], L = look(key, o.size);
  const { cx, top, size, name = u.name, hpPct = 100, hpStops = null, cycles = null, chargePct = 45, chargeStops = null, labelHtml = null, hpW = 36, short = false, overlay = "", wrapStyle = "", wrapAnim = "" } = o;
  const label = labelHtml || (short ? name : `${name} · <span style="color:${u.hex}">${SKILLS[u.skill].name}</span>`);
  return body(C, { cx, top, size, bg: u.hex, faceSvg: L.inner, under: L.under, bodyStyle: L.bodyStyle, alpha: size >= 36 ? 0.4 : 0.24, overlay, wrapStyle, wrapAnim })
    + nameLabel(cx, top + size + 2, label)
    + hpBar(C, { cx, y: top + size + 13, pct: hpPct, stops: hpStops, w: hpW })
    + chargeBar(C, { cx, y: top + size + 18, pct: chargePct, cycles, stops: chargeStops, w: hpW });
}
// the Undead layout and the Beasts layout
const UK = { cx: 161, top: 114, size: 40 }, UW = { cx: 92, top: 151, size: 30 }, UP = { cx: 230, top: 151, size: 30 };
const BEAR = { cx: 161, top: 114, size: 38 };
const BK = [{ cx: 62, top: 151, size: 26 }, { cx: 120, top: 151, size: 26 }, { cx: 202, top: 151, size: 26 }, { cx: 260, top: 151, size: 26 }];
const slamBeam = (C, at, x2, y2) => beam(C, { x1: 161, y1: 60, x2, y2, color: RED, at, w: 4 });
// a unit that falls and gets back up: dim + ✕ eyes between down and up
const fallStops = (down, up) => ({
  wrapAnim: (C) => C.kf([[0, "opacity:1"], [down - 1, "opacity:1"], [down, "opacity:0.35"], [up, "opacity:0.35"], [up + 2, "opacity:1"], [100, "opacity:1"]]),
  x: (C) => `<div style="position:absolute;inset:0;opacity:0;${C.kf(win(down, up, 0.5))}">${xEyes}</div>`,
});

// =====================================================================================================
// the eight scenes
// =====================================================================================================
// an Undead skeleton in a card scene (same look as the built game's render/armyLook.ts skeletonLook): a bone disc with hollow glowing eyes, a
// blade on a warrior, an amber shield on a shield skeleton. Plain style = standing; `pop` rises it at that % and it stays.
const SKEL_BLADE = `${VB}<path d="M84 74 L100 14" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M76 80 L94 74" stroke="${BONE}" stroke-width="7" stroke-linecap="round"/></svg>`;
const SKEL_SHIELD = `${VB}<path d="M24 58 H76 V78 Q76 98 50 108 Q24 98 24 78 Z" fill="${ROLE.tank.hex}" stroke="#14161c" stroke-width="5" stroke-linejoin="round"/><path d="M50 66 V98 M36 80 H64" stroke="#14161c" stroke-width="5" stroke-linecap="round" opacity="0.55"/></svg>`;
const skelFace = `${VB}<path d="M64 4 L58 20 L66 30" stroke="#14161c" stroke-opacity="0.55" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>${hollowEyes}</svg>`;
function skel(C, { cx, top, size = 22, kind, pop = null, wrapAnim = "", badgeAt = null }) {
  const b = body(C, { cx, top, size, bg: kind === "shield" ? "#bdb59a" : "#dcd6c2", faceSvg: skelFace, alpha: 0.3, wrapAnim, overlay: kind === "shield" ? SKEL_SHIELD : SKEL_BLADE });
  const popStops = pop === null ? "" : C.kf([[0, "opacity:0;transform:translateY(8px) scale(0.5)"], [pop - 0.1, "opacity:0;transform:translateY(8px) scale(0.5)"], [pop + 3, "opacity:1;transform:translateY(0) scale(1)"], [95, "opacity:1;transform:translateY(0) scale(1)"], [99, "opacity:0;transform:translateY(0) scale(1)"], [100, "opacity:0;transform:translateY(8px) scale(0.5)"]]);
  let h = abs(`left:0;top:0;width:0;height:0;transform-origin:${cx}px ${top + size}px;${popStops}`, b);
  if (pop !== null) h += ring(C, { cx, cy: top + size, r: 14, color: kind === "shield" ? ROLE.tank.hex : ARMIES.undead.hex, at: pop });
  if (badgeAt !== null) {
    h += ring(C, { cx, cy: top + size / 2, r: 15, color: YEL, at: badgeAt, dur: 6 });
    h += abs(`left:${cx + 3}px;top:${top - 10}px;font-size:7.5px;font-weight:800;color:#14161c;background:${YEL};border-radius:7px;padding:0 4px;line-height:12px;z-index:5;opacity:1;${C.kf(from(badgeAt, 1.5))}`, "+1");
  }
  return h;
}
// the lunge of a skeleton at the enemy: out at `at`%, back by `at + 7`%
const lunge = (C, at, dx, dy) => C.kf([[0, "transform:translate(0,0)"], [at - 0.1, "transform:translate(0,0)"], [at + 1.5, `transform:translate(${dx}px,${dy}px) scale(1.2)`], [at + 3.5, `transform:translate(${dx}px,${dy}px) scale(1)`], [at + 6.5, "transform:translate(0,0) scale(1)"], [100, "transform:translate(0,0)"]]);
// the HORDE count at the left of the scene: [[n, from %, to %]], the last one stays
const hordeCount = (C, list, full = 5) => list.map(([n, a, b], i) => abs(`left:12px;top:106px;font-size:8px;font-weight:800;letter-spacing:0.06em;color:${n >= full ? YEL : BONE};white-space:nowrap;opacity:${i === list.length - 1 ? 1 : 0};${C.kf(win(a, b, 0.5))}`, n >= full ? `☠ FULL ${n}/5` : `☠ HORDE ${n}/5`)).join("");

const SCENES = {
  boneWall(C) {
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, "wraith", { ...UW, chargePct: 30 }) + ally(C, "priest", { ...UP });
    h += ally(C, "knight", { ...UK, hpW: 40, cycles: [{ s: 6 }] });
    // two shield skeletons rise in front of Bram, then the enemy's normal hits land on the front one
    h += skel(C, { cx: 98, top: 116, size: 24, kind: "shield", pop: 14 }) + skel(C, { cx: 122, top: 116, size: 24, kind: "shield", pop: 22 });
    h += beam(C, { x1: 81, y1: 60, x2: 118, y2: 120, color: RED, at: 46, w: 2 }) + beam(C, { x1: 161, y1: 60, x2: 126, y2: 120, color: RED, at: 54, w: 2 });
    h += floater(C, { x: 114, y: 100, text: "−6", color: "#fff", at: 47, size: 11 }) + floater(C, { x: 122, y: 100, text: "−6", color: "#fff", at: 55, size: 11 });
    h += hordeCount(C, [[0, 0, 13.5], [1, 14, 21.5], [2, 22, 99]]);
    h += chip(C, { x: 150, y: 96, text: "THE SHIELD TAKES THE HITS", color: ROLE.tank.hex, stops: from(46), base: 0 });
    h += bubble(C, { cx: 161, top: 114, size: 40, text: "BONE WALL ×2", color: ROLE.tank.hex, s: 6, w: 84, barW: 40 });
    h += caps(C, [{ side: "left", text: "SKILL · BONE WALL", color: ROLE.tank.hex, at: [4, 40] }, { side: "right", text: "ENEMY HITS GO HERE FIRST", color: ARMIES.undead.hex, at: [44, 94] }]);
    return h;
  },
  command(C) {
    const WAR = [[198, 3], [226, 3], [254, 3]], SHL = [[98, 0], [122, 0]];
    let h = acoL(C) + acoR(C) + wardenE(C, { hpPct: 70, hpStops: [[0, 100], [62, 100], [63, 94], [64, 88], [65, 82], [66, 76], [67, 70], [100, 70]] });
    h += ally(C, "knight", { ...UK, hpW: 40, chargePct: 30 }) + ally(C, "priest", { ...UP });
    h += ally(C, "wraith", { ...UW, cycles: [{ s: 40 }] });
    const target = [[161, 64], [175, 64], [147, 64], [168, 60], [154, 60]];
    [...SHL.map(([cx]) => ({ cx, size: 24, top: 116, kind: "shield" })), ...WAR.map(([cx]) => ({ cx, size: 22, top: 120, kind: "warrior" }))].forEach((p, i) => {
      const t = target[i], la = lunge(C, 62 + i * 0.6, t[0] - p.cx, t[1] - (p.top + p.size / 2));
      h += skel(C, { ...p, wrapAnim: la });
      h += floater(C, { x: t[0] + (i - 2) * 6, y: 50 + (i % 2) * 8, text: "−9", color: "#e8e8ee", at: 63 + i * 0.6, size: 9 });
    });
    h += hordeCount(C, [[5, 0, 99]]);
    h += chip(C, { x: 12, y: 96, text: "ALL 5 STRIKE AT ONCE", color: ROLE.damage.hex, stops: win(60, 80, 1.5), base: 0 });
    h += bubble(C, { cx: 92, top: 151, size: 30, text: "COMMAND", color: ROLE.damage.hex, s: 40, w: 64 });
    h += caps(C, [{ side: "left", text: "SKILL · COMMAND", color: ROLE.damage.hex, at: [40, 94] }, { side: "right", text: "EACH ONE HITS FOR ITS OWN DAMAGE", color: ARMIES.undead.hex, at: [58, 94] }]);
    return h;
  },
  raise(C) {
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, "wraith", { ...UW, chargePct: 30 }) + ally(C, "knight", { ...UK, hpW: 40, chargePct: 30 });
    h += ally(C, "priest", { ...UP, cycles: [{ s: 4 }] });
    // two shield skeletons already stand; three hits raise three warriors (5 of 5), the fourth upgrades them
    h += skel(C, { cx: 98, top: 116, size: 24, kind: "shield" }) + skel(C, { cx: 122, top: 116, size: 24, kind: "shield" });
    h += skel(C, { cx: 198, top: 120, kind: "warrior", pop: 14, badgeAt: 62 }) + skel(C, { cx: 226, top: 120, kind: "warrior", pop: 24, badgeAt: 62.8 }) + skel(C, { cx: 254, top: 120, kind: "warrior", pop: 34, badgeAt: 63.6 });
    h += hordeCount(C, [[2, 0, 13.5], [3, 14, 23.5], [4, 24, 33.5], [5, 34, 99]]);
    h += chip(C, { x: 150, y: 96, text: "FULL: THE NEXT HIT UPGRADES", color: YEL, stops: from(58), base: 0 });
    h += bubble(C, { cx: 230, top: 151, size: 30, text: "RAISE ×4", color: ROLE.healer.hex, s: 4, w: 64 });
    h += caps(C, [{ side: "left", text: "SKILL · RAISE", color: ROLE.healer.hex, at: [4, 56] }, { side: "right", text: "ONE WARRIOR PER HIT", color: ARMIES.undead.hex, at: [12, 56] }]);
    return h;
  },
  roar(C) {
    let h = acoL(C) + wardenE(C) + acoR(C);
    const bars = [[0, 40], [14, 40], [17, 65], [100, 65]];
    h += ally(C, "bear", { ...BEAR, hpW: 38, hpPct: 62, hpStops: [[0, 100], [28, 100], [30, 62], [100, 62]], cycles: [{ s: 10 }] });
    const kinds = ["wolf", "wolf", "wolf", "stag"];
    BK.forEach((p, i) => { h += ally(C, kinds[i], { ...p, name: ["Fang", "Ash", "Dusk", "Moss"][i], short: true, hpW: 32, chargeStops: bars }); });
    BK.forEach((p) => { h += beam(C, { x1: 161, y1: 134, x2: p.cx, y2: 156, color: YEL, at: 14, w: 1.5, dur: 8 }) + floater(C, { x: p.cx, y: 143, text: "+25%", color: YEL, at: 16, size: 8, glow: "#a07a00" }); });
    h += ring(C, { cx: 161, cy: 133, r: 26, color: ARMIES.beasts.hex, at: 14 });
    h += slamBeam(C, 28, 161, 112) + floater(C, { x: 161, y: 112, text: "−48", color: "#fff", at: 29, size: 15 });
    h += bubble(C, { cx: 161, top: 114, size: 38, text: "ROAR", color: ROLE.tank.hex, s: 10, w: 60, barW: 38 });
    h += caps(C, [{ side: "left", text: "SKILL · ROAR", color: ROLE.tank.hex, at: [8, 40] }, { side: "right", text: "THE PACK FILLS UP", color: ARMIES.beasts.hex, at: [14, 40] }]);
    return h;
  },
  packBite(C) {
    let h = acoL(C) + acoR(C) + wardenE(C, { hpPct: 91, hpStops: [[0, 100], [47, 100], [49, 97], [52, 94], [55, 91], [100, 91]] });
    h += ally(C, "bear", { ...BEAR, hpW: 38, chargePct: 40 });
    h += ally(C, "wolf", { ...BK[0], name: "Fang", short: true, hpW: 32, chargePct: 35 }) + ally(C, "wolf", { ...BK[1], name: "Ash", short: true, hpW: 32, cycles: [{ s: 38 }] }) + ally(C, "wolf", { ...BK[2], name: "Dusk", short: true, hpW: 32, chargePct: 35 });
    h += ally(C, "stag", { ...BK[3], name: "Moss", short: true, hpW: 32, chargePct: 40 });
    h += beam(C, { x1: 120, y1: 160, x2: 156, y2: 58, color: ROLE.damage.hex, at: 52, w: 3.5 });
    h += ring(C, { cx: 62, cy: 164, r: 18, color: ARMIES.beasts.hex, at: 48 }) + ring(C, { cx: 202, cy: 164, r: 18, color: ARMIES.beasts.hex, at: 51 });
    h += chip(C, { x: 36, y: 134, text: "+1 bite", color: ARMIES.beasts.hex, stops: from(48) }) + chip(C, { x: 178, y: 134, text: "+1 bite", color: ARMIES.beasts.hex, stops: from(51) });
    h += floater(C, { x: 218, y: 20, text: "−18", color: "#ffe6ff", at: 57, size: 17, glow: ROLE.damage.hex });
    h += bubble(C, { cx: 120, top: 151, size: 26, text: "PACK BITE", color: ROLE.damage.hex, s: 38, w: 64, barW: 32 });
    h += caps(C, [{ side: "left", text: "SKILL · PACK BITE", color: ROLE.damage.hex, at: [40, 90] }, { side: "right", text: "3 WOLVES · ONE BITE OF 18", color: ARMIES.beasts.hex, at: [47, 90] }]);
    return h;
  },
  herd(C) {
    let h = acoL(C) + wardenE(C) + acoR(C);
    const hp = [[68, 78], [62, 70], [74, 82], [66, 74], [70, 80]];
    const st = (a, b) => [[0, a], [47, a], [51, b], [100, b]];
    h += ally(C, "bear", { ...BEAR, hpW: 38, hpPct: hp[0][1], hpStops: st(...hp[0]), chargePct: 40 });
    ["wolf", "wolf", "wolf"].forEach((k, i) => { h += ally(C, k, { ...BK[i], name: ["Fang", "Ash", "Dusk"][i], short: true, hpW: 32, hpPct: hp[i + 1][1], hpStops: st(...hp[i + 1]), chargePct: 35 }); });
    h += ally(C, "stag", { ...BK[3], name: "Moss", short: true, hpW: 32, hpPct: hp[4][1], hpStops: st(...hp[4]), cycles: [{ s: 38 }] });
    [[161, 134], [62, 164], [120, 164], [202, 164]].forEach(([x, y]) => { h += beam(C, { x1: 260, y1: 164, x2: x, y2: y, color: ROLE.healer.hex, at: 46, w: 1.5 }) + floater(C, { x, y: y - 22, text: "+5", color: ROLE.healer.hex, at: 48, size: 10, glow: "#1b8a55" }); });
    h += floater(C, { x: 260, y: 143, text: "+5", color: ROLE.healer.hex, at: 48, size: 10, glow: "#1b8a55" });
    h += bubble(C, { cx: 260, top: 151, size: 26, text: "HERD", color: ROLE.healer.hex, s: 38, w: 54, barW: 32 });
    h += caps(C, [{ side: "left", text: "SKILL · HERD", color: ROLE.healer.hex, at: [40, 90] }, { side: "right", text: "5 BEASTS · +5 EACH", color: ARMIES.beasts.hex, at: [46, 90] }]);
    return h;
  },
  // the Undead rule: skeletons fill the field one by one (five at most), the enemy's hits go to the shield first, then the warriors
  undead(C) {
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, "knight", { ...UK, hpW: 40, short: true, name: "Bram", chargePct: 30 }) + ally(C, "priest", { ...UP, short: true, name: "Sol" }) + ally(C, "wraith", { ...UW, short: true, name: "Ivy" });
    h += skel(C, { cx: 98, top: 116, size: 24, kind: "shield", pop: 8 }) + skel(C, { cx: 122, top: 116, size: 24, kind: "shield", pop: 16 });
    h += skel(C, { cx: 198, top: 120, kind: "warrior", pop: 24 }) + skel(C, { cx: 226, top: 120, kind: "warrior", pop: 32 }) + skel(C, { cx: 254, top: 120, kind: "warrior", pop: 40 });
    h += hordeCount(C, [[0, 0, 7.5], [1, 8, 15.5], [2, 16, 23.5], [3, 24, 31.5], [4, 32, 39.5], [5, 40, 99]]);
    h += beam(C, { x1: 161, y1: 60, x2: 122, y2: 120, color: RED, at: 56, w: 2 }) + floater(C, { x: 120, y: 100, text: "−6", color: "#fff", at: 57, size: 11 });
    h += beam(C, { x1: 161, y1: 60, x2: 198, y2: 124, color: RED, at: 76, w: 2 }) + floater(C, { x: 200, y: 100, text: "−6", color: "#fff", at: 77, size: 11 });
    h += chip(C, { x: 150, y: 96, text: "HITS GO TO THE SHIELD FIRST", color: ROLE.tank.hex, stops: win(54, 70, 1.5), base: 0 });
    h += chip(C, { x: 150, y: 96, text: "THEN THE WARRIORS, THEN BRAM", color: ARMIES.undead.hex, stops: win(74, 94, 1.5), base: 0 });
    h += caps(C, [{ side: "left", text: "EVERY SKILL HIT RAISES ONE", color: ARMIES.undead.hex, at: [6, 46] }, { side: "right", text: "FIVE AT MOST", color: YEL, at: [40, 94] }]);
    return h;
  },
  // the Beasts rule: every hit one beast lands fills every other beast's skill bar a little
  beasts(C) {
    let h = acoL(C) + wardenE(C, { hpPct: 88, hpStops: [[0, 100], [15, 100], [17, 96], [35, 96], [37, 92], [55, 92], [57, 88], [100, 88]] }) + acoR(C);
    const hit = { 0: 14, 1: 34, 2: 54 }; // which wolf hits when
    const stops = (i) => { // a beast's bar steps up 20% after each hit by someone else
      const s = [[0, 40]]; let v = 40;
      Object.entries(hit).forEach(([w, t]) => { if (Number(w) !== i) { s.push([t + 1.5, v]); v += 20; s.push([t + 4, v]); } });
      s.push([100, v]); return s;
    };
    h += ally(C, "bear", { ...BEAR, hpW: 38, chargeStops: [[0, 40], [15.5, 40], [18, 60], [35.5, 60], [38, 80], [55.5, 80], [58, 100], [100, 100]] });
    ["Fang", "Ash", "Dusk"].forEach((nm, i) => { h += ally(C, "wolf", { ...BK[i], name: nm, short: true, hpW: 32, chargeStops: stops(i) }); });
    h += ally(C, "stag", { ...BK[3], name: "Moss", short: true, hpW: 32, chargeStops: [[0, 40], [15.5, 40], [18, 60], [35.5, 60], [38, 80], [55.5, 80], [58, 100], [100, 100]] });
    [[0, 14, 62], [1, 34, 120], [2, 54, 202]].forEach(([i, t, x]) => { h += beam(C, { x1: x, y1: 160, x2: 156 + i * 6, y2: 58, color: ROLE.damage.hex, at: t, w: 1.8 }) + floater(C, { x: 140 + i * 22, y: 36, text: "−6", color: "#e8e8ee", at: t + 1, size: 10 }); });
    [14, 34, 54].forEach((t, i) => { h += floater(C, { x: 298, y: 150 + i * 12, text: "+20%", color: YEL, at: t + 2, size: 8, glow: "#a07a00" }); });
    h += bubble(C, { cx: 260, top: 151, size: 26, text: "HERD", color: ROLE.healer.hex, s: 56, w: 54, barW: 32 });
    h += caps(C, [{ side: "left", text: "EVERY HIT FEEDS THE PACK", color: ARMIES.beasts.hex, at: [12, 60] }, { side: "right", text: "SKILLS GO OFF", color: ROLE.healer.hex, at: [58, 94] }]);
    return h;
  },
};

// =====================================================================================================
// the card file (11.x)
// =====================================================================================================
const CARDS = [
  { n: 1, kind: "skill", unit: "knight" }, { n: 2, kind: "skill", unit: "wraith" }, { n: 3, kind: "skill", unit: "priest" },
  { n: 4, kind: "skill", unit: "bear" }, { n: 5, kind: "skill", unit: "wolf" }, { n: 6, kind: "skill", unit: "stag" },
  { n: 7, kind: "rule", army: "undead" }, { n: 8, kind: "rule", army: "beasts" },
];
const NAMES = { 1: "BoneWall", 2: "Command", 3: "Raise", 4: "Roar", 5: "PackBite", 6: "Herd", 7: "Horde", 8: "Pack" };
// the parts of a card shared by the canvas frame and the game copy: its army, the scene, the header line, the ARMY / SKILL rows and the design note
function cardPieces(c, C) {
  const sceneKey = c.kind === "skill" ? UNITS[c.unit].skill : c.army;
  const a = ARMIES[c.kind === "skill" ? UNITS[c.unit].army : c.army];
  const scene = SCENES[sceneKey](C);
  const row = (rgb, hexv, ico, name, tag, text) => `
    <div style="margin-top:8px;border:1px solid rgba(${rgb},0.45);background:rgba(${rgb},0.07);border-radius:10px;padding:8px 10px;">
      <div style="display:flex;align-items:center;gap:7px;">${svg(I[ico](hexv), 18)}<span style="font-size:16px;font-weight:800;color:${hexv};">${name}</span><span style="margin-left:auto;font-size:8.5px;font-weight:800;letter-spacing:0.14em;color:${hexv};border:1px solid rgba(${rgb},0.55);border-radius:4px;padding:1px 5px;">${tag}</span></div>
      <div style="font-size:12.5px;line-height:1.45;color:#e8e8ee;margin-top:4px;">${text}</div>
    </div>`;
  let header, rows, noteText;
  if (c.kind === "skill") {
    const u = UNITS[c.unit], S = SKILLS[u.skill], role = ROLE[u.role];
    header = `${svg(I[a.icon](a.hex), 14)}${u.title.toUpperCase()} · ${a.name.toUpperCase()} ${role.word.toUpperCase()}`;
    rows = row(a.rgb, a.hex, a.icon, a.rule.name, "ARMY", terms(a.rule.card, false)) + row(role.rgb, role.hex, S.icon, S.name, "SKILL", terms(S.card, false));
    noteText = `Opened from the "See ${S.name} in action" row on ${u.title}'s skill tile (${POPUP_NUM[c.unit]}); the screen behind is a stand-in. The loop shows the skill; the still shows its key moment. Closes on ✕, Got it, or a tap outside the card.`;
  } else {
    header = `${svg(I[a.icon](a.hex), 14)}${a.name.toUpperCase()} · ARMY RULE`;
    rows = row(a.rgb, a.hex, a.icon, a.rule.name, "ARMY", terms(a.rule.card, false));
    noteText = `Opened from the "See ${a.rule.name} in action" row on the ARMY tile of any ${a.name} popup (${a.key === "undead" ? "10.2 to 10.4" : "10.6 to 10.8"}) or from the army chip on ${a.key === "undead" ? "10.1" : "10.5"}; the screen behind is a stand-in. Closes on ✕, Got it, or a tap outside the card.`;
  }
  return { a, scene, header, rows, noteText };
}
function cardFile(c) {
  const ex = read("TermExpose.dc.html");
  const css = ex.slice(ex.indexOf("<style>") + 7, ex.indexOf("</style>")).split("\n")
    .filter((l) => !(l.trim().startsWith("@keyframes") && !l.includes("bossPulse")) && !l.includes("Term card: Expose") && !l.includes(".scene { --T"))
    .join("\n");
  const start = ex.indexOf('<div style="position: relative; background: #14161c; width: 390px');
  const end = ex.indexOf("<!-- the term card -->");
  const C = makeCtx(`ar${c.n}k`);
  const { a, scene, header, rows, noteText } = cardPieces(c, C);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>${css}
  .scene { --T: 9s; }
  ${C.rules.join("\n  ")}
</style>
</helmet>

${ex.slice(start, end)}<!-- the army card -->
  <div style="position: absolute; top: 118px; left: 20px; width: 350px; background: #1d2029; border: 1px solid #3a3f4e; border-radius: 14px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.55);">
    <div style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: #2a2e3a; color: #c7cad6; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; z-index: 2;">✕</div>
    <div style="position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; color: ${a.hex};">${header}</div>

    <div class="scene" style="position: relative; width: 322px; height: 210px; margin-top: 26px; background: #14161c; border: 1px solid #2a2e3a; border-radius: 10px; overflow: hidden;">
      <div style="position: absolute; top: 104px; left: 16px; right: 16px; height: 1px; background: linear-gradient(90deg, transparent, #3a3f4e, transparent);"></div>
${scene}
    </div>

    <div style="font-size: 10.5px; color: #8a8fa3; text-align: center; margin-top: 8px;">When its bar is full, a unit uses its skill.</div>
${rows}
    <button style="margin-top: 14px; width: 100%; font: inherit; font-weight: 700; background: #4da6ff; color: #0c1420; border: none; border-radius: 8px; padding: 12px; font-size: 15px;">Got it</button>
  </div>

  <!-- design note, not part of the screen -->
  <div style="position: absolute; left: 20px; right: 20px; bottom: 14px; font-size: 10.5px; line-height: 1.45; color: #8a8fa3; text-align: center;">
    ${noteText}
  </div>
</div>
</x-dc>
</body>
</html>
`;
}

// =====================================================================================================
// write files and patch canvas.json
// =====================================================================================================
const FRAMES = []; // { file, x, y, w, h, label }
const w = (file, html, x, y, h, label, hh = h) => { fs.writeFileSync(path.join(CANVAS, file), html); FRAMES.push({ file, x, y, w: 390, h: hh, label }); };
const Y_PICK = 11800, Y_UND = 13200, Y_BEA = 14700, Y_CARD = 16100;
w("ArmyPickA.dc.html", pickFile("A"), 0, Y_PICK, 760, "10.0A Pick before round 1 (option, awaiting Tu's pick)");
w("ArmyPickB.dc.html", pickFile("B"), 550, Y_PICK, 840, "10.0B Pick after the round 1 win, in place of the rune pick (option)");
w("ArmySquadUndead.dc.html", squadFile("undead"), 0, Y_UND, 880, "10.1 Undead squad — round screen (proposal)");
["knight", "wraith", "priest"].forEach((k, i) => w(`ArmyPopup${UNITS[k].title.replace(/ /g, "")}.dc.html`, popupFile(k), 550 * (i + 1), Y_UND, 900, `${POPUP_NUM[k]} ${UNITS[k].title} — Undead ${ROLE[UNITS[k].role].word} (proposal)`));
w("ArmySquadBeasts.dc.html", squadFile("beasts"), 0, Y_BEA, 880,"10.5 Beasts squad — round screen, five fielded (proposal)");
["bear", "wolf", "stag"].forEach((k, i) => w(`ArmyPopup${UNITS[k].title}.dc.html`, popupFile(k), 550 * (i + 1), Y_BEA, 900, `${POPUP_NUM[k]} ${UNITS[k].title} — Beast ${ROLE[UNITS[k].role].word} (proposal)`));
CARDS.forEach((c, i) => {
  const label = c.kind === "skill"
    ? `11.${c.n} ${SKILLS[UNITS[c.unit].skill].name} — ${UNITS[c.unit].title}'s skill (proposal)`
    : `11.${c.n} ${ARMIES[c.army].rule.name} — the ${ARMIES[c.army].name} rule (proposal)`;
  w(`ArmyCard${NAMES[c.n]}.dc.html`, cardFile(c), 550 * i, Y_CARD, 900, label);
});

const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/"file": "Army|"id": "(label|section)-army/.test(l));
lines = lines.filter((l, i, a) => !(l.trim() === "" && (a[i + 1] === undefined || a[i + 1].trim() === "" || /^\s*\]/.test(a[i + 1]))));
const boards = FRAMES.map((f) => `    { "file": "${f.file}", "x": ${f.x}, "y": ${f.y}, "w": ${f.w}, "h": ${f.h} },`);
const notes = [
  `    { "id": "section-army-pick", "x": 0, "y": ${Y_PICK - 140}, "w": 1000, "text": "10 · ARMIES — pick an army and every unit changes: its look, its skills and one rule (proposal, design only, not built). First, where the pick sits" },`,
  `    { "id": "section-army-undead", "x": 0, "y": ${Y_UND - 140}, "w": 2200, "text": "10 · UNDEAD — fall once, rise stronger: the round screen, then the three popups" },`,
  `    { "id": "section-army-beasts", "x": 0, "y": ${Y_BEA - 140}, "w": 2200, "text": "10 · BEASTS — five small units, skills all the time: the round screen, then the three popups" },`,
  `    { "id": "section-army-cards", "x": 0, "y": ${Y_CARD - 140}, "w": 4300, "text": "11 · ARMY CARDS — opened from the 'See … in action' rows: six skills, then the two army rules" },`,
];
FRAMES.forEach((f, i) => notes.push(`    { "id": "label-army-${i}", "x": ${f.x}, "y": ${f.y - 60}, "w": 390, "text": ${JSON.stringify(f.label)} },`));
const iArt = lines.findIndex((l) => l.includes('"annotations"'));
lines.splice(iArt - 1, 0, "", ...boards.map((l, i) => (i === boards.length - 1 ? l.replace(/,$/, "") : l)));
for (let i = iArt - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
const iLaunch = lines.findIndex((l) => l.includes('"launch"'));
lines.splice(iLaunch - 1, 0, ...notes.map((l, i) => (i === notes.length - 1 ? l.replace(/,$/, "") : l)));
for (let i = iLaunch - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
fs.writeFileSync(cj, lines.join("\n"));
JSON.parse(fs.readFileSync(cj, "utf8")); // throws if the patch broke the file
console.log("wrote", FRAMES.length, "frames and patched canvas.json");

// ---------- the game's copy of the army cards (2026-10-20) ----------
// The same scenes, written for the prototype: render/armyCardData.ts holds each card's scene and text (the shell, close and Got it, is
// render/termCards.ts), armyCards.css its keyframes and loop length. Generated like the hero cards (design/tools/gen-heroes.js): do not
// edit the two output files by hand, change the scene above and run this again.
{
  const GAME = path.join(__dirname, "..", "..", "prototype", "src");
  const data = {};
  const cssLines = ["/* Generated by design/tools/gen-armies.js from the army scenes (canvas 11.1 to 11.8). Do not edit by hand. */", ""];
  for (const c of CARDS) {
    const key = c.kind === "skill" ? UNITS[c.unit].skill : c.army;
    const id = "army-" + key;
    const C = makeCtx("tc-army-" + c.n + "-");
    const { a, scene, header, rows } = cardPieces(c, C);
    const head = `<div style="position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; color: ${a.hex};">${header}</div>`;
    const sceneHtml = head + `<div class="scene" style="position: relative; width: 322px; height: 210px; margin-top: 26px; background: #14161c; border: 1px solid #2a2e3a; border-radius: 10px; overflow: hidden;"><div style="position: absolute; top: 104px; left: 16px; right: 16px; height: 1px; background: linear-gradient(90deg, transparent, #3a3f4e, transparent);"></div>${scene}</div>`;
    const lead = c.kind === "skill" ? "When its bar is full, a unit uses its skill." : "Every unit in the squad follows this rule.";
    const text = `<div style="font-size: 10.5px; color: #8a8fa3; text-align: center; margin-top: 8px;">${lead}</div>` + rows;
    data[id] = { scene: sceneHtml, text };
    cssLines.push(`/* ---------- ${key} ---------- */`, `.tc-${id} .scene { --T: 9s; }`, ...C.rules, "");
  }
  const ts =
    "// Generated by design/tools/gen-armies.js from the army scenes (canvas 11.1 to 11.8). Do not edit by hand unless you stop running the script.\n" +
    "// Each card: `scene` is the animated picture (with its army header), `text` is the army and skill rows. The shell (close, Got it) is render/termCards.ts.\n\n" +
    "export const ARMY_CARD_DATA: Record<string, { scene: string; text: string }> = " +
    JSON.stringify(data, null, 2) +
    ";\n";
  fs.writeFileSync(path.join(GAME, "render", "armyCardData.ts"), ts);
  fs.writeFileSync(path.join(GAME, "armyCards.css"), cssLines.join("\n"));
  console.log("wrote the game's army cards:", Object.keys(data).length);
}
