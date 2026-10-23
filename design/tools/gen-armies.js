// Generates canvas sections 10 and 11: the armies Undead, Beasts and Mages (2026-10-20; the Undead and the Mages are built since 2026-10-21 and
// the Beasts since 2026-10-22, and their text is the game's: Horde, Raise, Bone Wall, Command; Orbs, Frost Orb, Storm Orb, Life Orb; Pack, Pin,
// Maul, Tend).
//   10.0A, 10.0B  ArmyPickA / ArmyPickB      where the army pick sits: before round 1, or after the round 1 win
//   10.1, 10.5, 10.9  ArmySquad<Army>        the round screen with an army's squad
//   10.2-10.4     ArmyPopup<Unit>            Undead popups (Bone Knight, Wraith, Bone Priest)
//   10.6-10.8     ArmyPopup<Unit>            Beasts popups (Bear, Wolf, Stag)
//   10.10-10.12   ArmyPopup<Unit>            Mages popups (Frost Mage, Storm Mage, Life Mage)
//   11.1-11.12    ArmyCard<Name>             the looping explain cards: six skills, the two army rules, then the Mages' three skills and rule
//                                            (the Beasts' three skill cards, 11.4 to 11.6, are Pin, Maul and Tend: each is one part of the pack's pounce)
// Run:  node design/tools/gen-armies.js     (writes the frames and patches canvas.json)
// Toolkit (scene helpers, popup shell, card shell) is written here; the popup shell and backdrop from
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
    pitch: "Five small units. One pack pounce.",
    play: "More bodies, and which beasts you field matters.",
    rule: {
      name: "Pack", head: "You field 5 beasts instead of 3.",
      lines: ["No beast has a skill bar of its own: one PACK bar fills with everything the pack does.", "When it is full, every beast jumps on one enemy at once."],
      card: "You field 5 beasts instead of 3. Each beast is smaller and weaker, and none has a skill bar of its own: everything the pack does fills one PACK bar. When it is full, every beast jumps on one enemy at once: the Bear lands first and freezes it, the Wolves bite, the Stag heals. If the pounce goes again, they jump again.",
    },
  },
  mages: {
    key: "mages", name: "Mages", hex: "#8fd3ff", rgb: "143,211,255", icon: "orbs",
    pitch: "Orbs do the work, from the first second.",
    play: "You want a machine that builds up, then goes off.",
    rule: {
      name: "Orbs", head: "Every mage fights through orbs.",
      lines: ["Each starts with a core orb that stays. Every 2 seconds each orb works on its own.", "Every skill hit adds an orb, up to 3. A 4th merges them into one big shot."],
      card: "Every mage has a core orb that never leaves, and makes no plain attack: all the work is the orbs'. Every 2 seconds, starting 1 second into the fight, each orb works on its own: Storm orbs zap an enemy, Frost orbs shield the Frost Mage, Life orbs take HP from the front enemy and heal your most hurt unit with it. Every skill hit adds an orb around the mage, up to 3. A 4th orb merges them into one big shot that fires at once, and then they start again from none. The core orb stays, and so do orbs still out when the skill ends.",
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
  bear: { army: "beasts", role: "tank", title: "Bear", name: "Bruno", hex: "#d08a3c", row: "FRONT", hp: 140, stat: ["Damage", 5], skill: "pin",
    job: "The Beast Tank. Lands first in a pounce and holds the enemy." },
  wolf: { army: "beasts", role: "damage", title: "Wolf", name: "Fang", hex: "#b08cf5", row: "BACK", hp: 60, stat: ["Damage", 6], skill: "maul",
    job: "The Beast Damage unit. Every Wolf bites in a pounce." },
  stag: { army: "beasts", role: "healer", title: "Stag", name: "Moss", hex: "#6bd69a", row: "BACK", hp: 72, stat: ["Heal", 3], skill: "tend",
    job: "The Beast Healer. Heals the whole squad in a pounce." },
  frost: { army: "mages", role: "tank", title: "Frost Mage", name: "Bram", hex: "#7fc8ff", row: "FRONT", hp: 135, stat: ["Damage", 8], skill: "frostOrb",
    job: "The Mage Tank. Wraps itself in shield orbs." },
  storm: { army: "mages", role: "damage", title: "Storm Mage", name: "Ivy", hex: "#c28cff", row: "BACK", hp: 58, stat: ["Damage", 8], skill: "stormOrb",
    job: "The Mage Damage unit. Orbs zap on their own." },
  life: { army: "mages", role: "healer", title: "Life Mage", name: "Sol", hex: "#8be9a8", row: "BACK", hp: 74, stat: ["Damage", 5], skill: "lifeOrb",
    job: "The Mage Healer. Its orbs drain the enemy to heal your squad." },
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
  pin: { name: "Pin", icon: "pin", head: "In a pounce, freezes the front enemy.", chips: ["Front enemy", "Freeze"],
    lines: ["No skill bar of its own: it goes when the pack's bar is full.", "Each time the pounce goes again, the freeze is longer."],
    card: "The Bear leads the pack's pounce: it lands first and freezes the front enemy. Each time the pounce goes again, the freeze is longer." },
  maul: { name: "Maul", icon: "bite", head: "In a pounce, bites the front enemy.", chips: ["Front enemy"],
    lines: ["Bites for 7. Every Wolf in the pack bites: 3 Wolves, 21.", "Each time the pounce goes again, every bite is bigger."],
    card: "In a pounce, every Wolf bites the front enemy for 7. Three Wolves bite for 21. Each time the pounce goes again, every bite is bigger." },
  tend: { name: "Tend", icon: "herd", head: "In a pounce, heals every unit.", chips: ["Whole squad"],
    lines: ["Heals each unit 4. Every Stag in the pack tends.", "Each time the pounce goes again, it heals again."],
    card: "In a pounce, every Stag heals every unit 4 HP. Each time the pounce goes again, it heals again." },
  frostOrb: { name: "Frost Orb", icon: "frostorb", head: "Adds an orb that shields the Frost Mage.", chips: ["Shield orb", "Whole squad"],
    lines: ["Each hit adds a shield orb. Every orb, the core one too, gives the Frost Mage 8 shield every 2 seconds.", "A 4th orb merges the loose ones: the whole squad gets a shield, then they start again."],
    card: "Adds an orb around the Frost Mage. Every 2 seconds each orb, the core one included, gives it 8 shield. A 4th loose orb merges them into one big shot that shields the whole squad at once, and then they start again." },
  stormOrb: { name: "Storm Orb", icon: "bolt", head: "Adds an orb that zaps an enemy.", chips: ["One random enemy", "Front enemy"],
    lines: ["Each hit adds a storm orb. Every orb, the core one too, zaps one enemy for 8 every 2 seconds.", "A 4th orb merges the loose ones into a big zap on the front enemy, then they start again."],
    card: "Adds an orb around the Storm Mage. Every 2 seconds each orb, the core one included, zaps one random enemy for 8; two orbs can pick the same one. A 4th loose orb merges them into one big shot that strikes the front enemy at once, and then they start again." },
  lifeOrb: { name: "Life Orb", icon: "lifeorb", head: "Adds an orb that drains the front enemy.", chips: ["Front enemy", "Most hurt unit"],
    lines: ["Each hit adds a life orb. Every orb, the core one too, takes 5 HP from the front enemy every 2 seconds and heals the most hurt unit with it.", "A 4th orb merges the loose ones: one Great Drain, shared over the whole squad, then they start again."],
    card: "Adds an orb around the Life Mage. Every 2 seconds each orb, the core one included, takes 5 HP from the front enemy and heals your most hurt unit with it. A 4th loose orb merges them into one Great Drain that takes 45 from the front enemy and shares it over the whole squad, and then they start again." },
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
  pin: (c) => `<path d="M12 3 V21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5" ${sw(c, 1.6)}/><circle cx="12" cy="12" r="3" fill="${c}33" ${sw(c, 1.5)}/>`,
  bite: (c) => `<path d="M4.5 6 H19.5 C19.5 11 17.5 13 15.8 13 L14.2 19.5 L12.8 13.5 H11.2 L9.8 19.5 L8.2 13 C6.5 13 4.5 11 4.5 6 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  herd: (c) => `<path d="M8 21 V13 M16 21 V13 M8 13 C7 9 5 7 4 4 M8 13 C9 10 10 8 10 5 M16 13 C17 9 19 7 20 4 M16 13 C15 10 14 8 14 5" ${sw(c, 1.7)}/>`,
  pack: (c) => `<circle cx="7" cy="9" r="2.2" fill="${c}"/><circle cx="12" cy="6.5" r="2.2" fill="${c}"/><circle cx="17" cy="9" r="2.2" fill="${c}"/><path d="M7 16 C7 13 17 13 17 16 C17 19 14 19.5 12 19.5 C10 19.5 7 19 7 16 Z" fill="${c}33" ${sw(c, 1.6)}/>`,
  target: (c) => `<circle cx="8" cy="8" r="6" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="8" cy="8" r="2" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
  orbs: (c) => `<circle cx="12" cy="5.5" r="3" fill="${c}"/><circle cx="5.5" cy="16.5" r="3" fill="${c}"/><circle cx="18.5" cy="16.5" r="3" fill="${c}"/><path d="M12 9 L7.5 14 M12 9 L16.5 14 M8.5 16.5 H15.5" ${sw(c, 1.2)} opacity="0.55"/>`,
  bolt: (c) => `<path d="M13.5 2.5 L6 13 H11.5 L9.5 21.5 L18 10.5 H12.5 Z" fill="${c}33" ${sw(c, 1.7)}/>`,
  frostorb: (c) => `<circle cx="12" cy="12" r="5.5" fill="${c}33" ${sw(c, 1.7)}/><path d="M12 3 V21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5" ${sw(c, 1.3)}/>`,
  lifeorb: (c) => `<circle cx="12" cy="12" r="8" fill="${c}33" ${sw(c, 1.7)}/><path d="M12 7.5 V16.5 M7.5 12 H16.5" ${sw(c, 2)}/>`,
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
    case "frost": case "storm": case "life": {
      // a pointed hat behind the head with a star on it, a face on the disc (the same art as render/armyLook.ts)
      const star = { frost: "#d8f1ff", storm: "#ffe36a", life: "#c9ffd9" }[key];
      return {
        under: `${VB}<polygon points="22,30 50,-46 78,30" fill="${dk}"/><ellipse cx="50" cy="26" rx="40" ry="9" fill="${dk}"/><path d="M50 -8 l3.4 8 8.6 .8 -6.6 5.8 2 8.4 -7.4 -4.6 -7.4 4.6 2 -8.4 -6.6 -5.8 8.6 -.8z" fill="${star}"/></svg>`,
        bodyStyle: "",
        inner: face(hex, size),
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

// the units each army shows on its card, in order, and the army's frame numbers on the canvas
const SET = { undead: ["knight", "wraith", "priest"], beasts: ["bear", "wolf", "wolf", "wolf", "stag"], mages: ["frost", "storm", "life"] };
const SQUAD_NUM = { undead: "10.1", beasts: "10.5", mages: "10.9" };
const POPUP_RANGE = { undead: "10.2 to 10.4", beasts: "10.6 to 10.8", mages: "10.10 to 10.12" };
// the words after a frame's number: which armies are built, and when
const BUILT_ON = { mages: "built 2026-10-21, reworked 2026-10-23", beasts: "built 2026-10-22" };
// the line under a card's picture
const cardLead = (c) => (c.kind === "skill" ? (UNITS[c.unit].army === "beasts" ? "When the PACK bar is full, the whole pack pounces." : "When its bar is full, a unit uses its skill.") : "Every unit in the squad follows this rule.");

// =====================================================================================================
// 10.0A / 10.0B — where the army pick sits
// =====================================================================================================
function armyCard(a, withChange) {
  const keys = SET[a.key];
  const three = keys.length <= 3;
  const px = three ? 40 : 32;
  const plain = ["tank", "damage", "healer"];
  const bodies = keys.map((k, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:${three ? 78 : 56}px;">${unitBody(k, px, "margin-top:12px;")}<div style="font-size:9px;font-weight:700;color:${ROLE[UNITS[k].role].hex};margin-top:2px;">${UNITS[k].title}</div></div>`).join("");
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
      ${armyCard(ARMIES.mages, !A)}
    </div>
  </div>
  <div style="margin-top:10px;font-size:10.5px;line-height:1.45;color:#8a8fa3;text-align:center;">${note} Three armies are built (Mages 2026-10-21); more, and how they are earned, are not decided.</div>
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
  const a = ARMIES[armyKey], U = armyKey !== "beasts", M = armyKey === "mages";
  const enemy = rf.slice(rf.indexOf("<!-- ENEMY zone -->"), rf.indexOf("<!-- YOUR SQUAD zone -->"));
  const strip = STRIP.replace("ROUND 1/20", "ROUND 2/20").replace("width: 5%", "width: 10%");
  const front = `<div style="position:relative;display:flex;justify-content:center;align-items:flex-start;gap:12px;">${rowLabel("FRONT")}${M ? squadCol("frost", "Bram", 82, 36, 54) : U ? squadCol("knight", "Bram", 82, 36, 54) : squadCol("bear", "Bruno", 82, 36, 54)}</div>`;
  const back = U
    ? `<div style="position:relative;display:flex;justify-content:center;align-items:flex-start;gap:12px;">${rowLabel("BACK")}${M ? squadCol("storm", "Ivy", 82, 36, 54) + squadCol("life", "Sol", 82, 36, 54) : squadCol("wraith", "Ivy", 82, 36, 54) + squadCol("priest", "Sol", 82, 36, 54)}</div>`
    : `<div style="position:relative;display:flex;justify-content:flex-start;align-items:flex-start;gap:4px;padding-left:40px;">${rowLabel("BACK")}${squadCol("wolf", "Fang", 62, 30, 44)}${squadCol("wolf", "Ash", 62, 30, 44)}${squadCol("wolf", "Dusk", 62, 30, 44)}${squadCol("stag", "Moss", 62, 30, 44)}</div>`;
  const armyChip = `<span style="font-size:10px;font-weight:800;letter-spacing:0.06em;background:${a.hex};color:#14161c;border-radius:6px;padding:2px 7px;">${a.name.toUpperCase()}</span><span style="font-size:11.5px;color:#c7cad6;"><b style="color:${a.hex};text-decoration:underline dotted;text-underline-offset:3px;">${a.rule.name}</b>${M ? ": orbs build up" : U ? ": rise once" : ": five fielded"}</span>`;
  const zone = `<!-- YOUR SQUAD zone -->
      <div style="background: rgba(77,166,255,0.07); border: 1px solid rgba(77,166,255,0.28); border-radius: 12px; padding: 10px 12px 12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:10px;font-weight:800;letter-spacing:0.06em;background:#4da6ff;color:#0c1420;border-radius:6px;padding:2px 7px;white-space:nowrap;">YOUR SQUAD</span>${armyChip}</div>
        ${front}<div style="height: 12px; border-bottom: 1px dashed #3a3f4e; margin-bottom: 12px;"></div>${back}
        ${benchShelf(M ? [["frost", "Kit"], ["storm", "Wren"], ["life", "Olo"]] : U ? [["knight", "Kit"], ["wraith", "Wren"], ["priest", "Olo"]] : [["bear", "Kit"], ["wolf", "Rue"]])}
      </div>`;
  const note = M
    ? `Round screen, round 2, Mages squad (built 2026-10-21, reworked 2026-10-23): the same screen as 1.1 with the army's bodies. Bram, Ivy and Sol are the same three units, now a Frost Mage, a Storm Mage and a Life Mage, each with a pointed hat. The army chip names the rule and opens its card (11.12).`
    : U
    ? `Round screen, round 2, Undead squad (proposal, design only, not built): the same screen as 1.1 with the army's bodies. Bram, Ivy and Sol are the same three units, now a Bone Knight, a Wraith and a Bone Priest. The army chip names the rule and opens its card (11.7).`
    : `Round screen, round 2, Beasts squad (built 2026-10-22): five fielded, one Bear in front and four behind (three Wolves and a Stag), each one smaller. The bench holds two. The army chip names the rule and opens its card (11.8). No beast has a skill bar of its own: the pack's one PACK bar is on the fight screen.`;
  return shellOpen(RF_CSS) + `
<!-- Frame ${SQUAD_NUM[armyKey]} (${M || armyKey === "beasts" ? "built" : "proposal"}): ${note} -->
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
const POPUP_NUM = { knight: "10.2", wraith: "10.3", priest: "10.4", bear: "10.6", wolf: "10.7", stag: "10.8", frost: "10.10", storm: "10.11", life: "10.12" };
const CARD_NUM = { boneWall: "11.1", command: "11.2", raise: "11.3", pin: "11.4", maul: "11.5", tend: "11.6", undead: "11.7", beasts: "11.8", frostOrb: "11.9", stormOrb: "11.10", lifeOrb: "11.11", mages: "11.12" };
function popupFile(key) {
  const u = UNITS[key], a = ARMIES[u.army], S = SKILLS[u.skill], role = ROLE[u.role];
  const set = SET[u.army];
  const names = { knight: "Bram", wraith: "Ivy", priest: "Sol", bear: "Bruno", stag: "Moss", frost: "Bram", storm: "Ivy", life: "Sol" };
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
  const note = `Popup, ${u.title} (${BUILT_ON[u.army] ?? "proposal, design only, not built"}). Over a dimmed copy of 1.1 as a stand-in. The 2.3 popup with the army's body, an ARMY tile above the SKILL tile (both open a card: ${CARD_NUM[u.army]} and ${CARD_NUM[u.skill]}). Numbers are made up.`;
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
// 11.x — the scene toolkit (with art behind the disc)
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
function floater(C, { x, y, text, color, at, size = 14, glow = "#ff5252", show = true }) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;font-size:${size}px;font-weight:800;color:${color};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.6),0 0 8px ${glow};z-index:5;transform:translate(-50%,-10px);${show ? "" : "opacity:0;"}${C.kf(floatStops(at))}">${text}</div>`;
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
  const { cx, top, size, name = u.name, hpPct = 100, hpStops = null, cycles = null, chargePct = 45, chargeStops = null, labelHtml = null, hpW = 36, short = false, overlay = "", wrapStyle = "", wrapAnim = "", noCharge = false } = o;
  const label = labelHtml || (short ? name : `${name} · <span style="color:${u.hex}">${SKILLS[u.skill].name}</span>`);
  return body(C, { cx, top, size, bg: u.hex, faceSvg: L.inner, under: L.under, bodyStyle: L.bodyStyle, alpha: size >= 36 ? 0.4 : 0.24, overlay, wrapStyle, wrapAnim })
    + nameLabel(cx, top + size + 2, label)
    + hpBar(C, { cx, y: top + size + 13, pct: hpPct, stops: hpStops, w: hpW })
    + (noCharge ? "" : chargeBar(C, { cx, y: top + size + 18, pct: chargePct, cycles, stops: chargeStops, w: hpW }));
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

// ---------- the Mages' orbs (the same picture as canvas 12.0D, in a card scene; the game draws them in render/fightView.ts) ----------
const GOLD = "#ffe36a", FROSTC = "#8fd3ff", LIFEC = "#6ee7a0";
const orbAt = (cx, cy, r, ang) => [cx + r * Math.cos(ang * Math.PI / 180), cy + r * Math.sin(ang * Math.PI / 180)];
// a ring of orbs round a unit. items = [[angle, appears at %]]; `pulses` = the % at which each orb swells (its work); `mergeAt` + `mergeTo`: from that %
// every orb flies to that point and is gone. Plain style = all shown, unless `shownInStill` is false.
function orbRing(C, { cx, cy, r, color, items, pulses = [], mergeAt = null, mergeTo = null, shownInStill = true }) {
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
  return abs(`left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;z-index:4;`, orbs);
}
// a real lightning bolt: a jagged line with a white core and a coloured glow, flickering for about 0.4 s. `base` 1 keeps it in the still.
let boltN = 0;
function bolt(C, { x1, y1, x2, y2, color, at, w = 1.6, base = 0 }) {
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
  return `<svg width="322" height="210" viewBox="0 0 322 210" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:4;filter:drop-shadow(0 0 ${2 + w}px ${color});opacity:${base};${anim}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(w * 2).toFixed(1)}" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
// the one big sparkling orb the others merge into: appears at `at` %, flares at `flare` % as its one big shot fires, fades at `end` %. It lives for one
// moment: the next hit starts again from none (reworked 2026-10-22). The still shows it flaring.
function mergedOrb(C, { cx, cy, at, flare, end, color }) {
  const S = (s, a) => `opacity:${a};transform:scale(${s});box-shadow:0 0 ${6 + s * 8}px ${1 + s * 3}px ${color},0 0 ${2 + s * 4}px ${s * 2}px #fff8;`;
  const stops = [[0, S(0.3, 0)], [at - 0.1, S(0.3, 0)], [at + 0.6, S(1.2, 1)], [flare - 0.1, S(1.2, 1)], [flare + 0.6, S(1.9, 1)], [end, S(1.6, 1)], [end + 1.8, S(0.4, 0)], [100, S(0.3, 0)]];
  const sparks = [[-4, -4, 9], [32, -2, 7], [34, 32, 9], [-2, 34, 7]].map(([x, y, fs]) => `<span style="position:absolute;left:${x}px;top:${y}px;font-size:${fs}px;line-height:1;color:#fffbd0;text-shadow:0 0 4px ${color};">✦</span>`).join("");
  const core = `radial-gradient(circle at 40% 38%,#fff 0%,#fff 28%,${color} 70%,${shade(color, -0.45)} 100%)`;
  return abs(`left:${cx - 14}px;top:${cy - 14}px;width:28px;height:28px;border-radius:50%;background:${core};z-index:4;${S(1.6, 1)}${C.kf(stops)}`,
    abs("left:-2px;top:-2px;width:32px;height:32px;animation:orbSpin 2.4s linear infinite;", sparks));
}
// a core orb (2026-10-23, canvas 12.0E): always out, never leaves, a little bigger than a loose orb and ringed; it swells on every beat in `pulses`
function coreOrb(C, { cx, cy, r, color, pulses = [] }) {
  const [px, py] = orbAt(cx, cy, r, 180);
  const S = (s) => `transform:scale(${s})`;
  const stops = [[0, S(1)]];
  pulses.forEach((t) => stops.push([t - 0.3, S(1)], [t + 0.4, S(1.9)], [t + 1.6, S(1)]));
  stops.push([100, S(1)]);
  return abs(`left:${(px - 7).toFixed(1)}px;top:${(py - 7).toFixed(1)}px;width:14px;height:14px;border-radius:50%;background:${color};border:1px solid #fff;box-shadow:0 0 0 2px #14161c,0 0 0 3.5px ${color},0 0 9px 3px ${color};z-index:4;${C.kf(stops)}`);
}
// one card scene for a Mage skill (who = "storm" | "frost" | "life") or for the Orbs rule (rule = true, drawn on the Storm Mage with the other
// two mages' orbs showing too). T = 9 s: every mage has a core orb from the start and works on the shared beat 1 s in (11%) and every 2 s after
// (33%, 55%, 77%); the first skill's three hits build three loose orbs (8-20%), the beat at 33% has four working, a second skill's first hit finds
// three out and merges them (49%), the merged orb fires its one big shot (52%) and is gone, the next two hits start again (58%, 65%) and those
// orbs stay, and the core orb works on through all of it.
function mageScene(C, { who, rule = false }) {
  const FIRST = 11, BEAT = 33, MERGE = 49, SHOT = 51.6, NEW = [58, 65], BEATS = [FIRST, BEAT, 55, 77];
  const G = { storm: { key: "storm", at: UW, color: GOLD, r: 24, mp: [34, 166], bubble: "STORM ORB", bw: 84, bb: 36 },
    frost: { key: "frost", at: UK, color: FROSTC, r: 28, mp: [216, 122], bubble: "FROST ORB", bw: 80, bb: 40 },
    life: { key: "life", at: UP, color: LIFEC, r: 24, mp: [276, 168], bubble: "LIFE ORB", bw: 72, bb: 36 } }[who];
  const o = G.at, cx = o.cx, cy = o.top + o.size / 2, u = UNITS[G.key];
  const SH = [[81, 43], [161, 34], [241, 43]];            // the enemies' centres: Acolyte, Warden, Acolyte
  const allies = { frost: [161, 134], storm: [92, 166], life: [230, 166] };
  // the Warden's HP: a zap from the orbs, then the one big shot (storm only)
  const hpStops = who === "storm" ? [[0, 100], [BEAT + 1, 100], [BEAT + 3, 97.6], [SHOT + 1, 97.6], [SHOT + 2.5, 78.6], [100, 78.6]] : null;
  let h = acoL(C) + wardenE(C, who === "storm" ? { hp: "HP 420", hpPct: 78.6, hpStops } : {}) + acoR(C);
  // the squad; the casting mage runs two skills (its bar fills at 2 and at 46); the others wait
  const cast = { cycles: [{ s: 2 }, { s: 46 }] };
  const bars = { frost: { ...UK, hpW: 40, chargePct: 30 }, storm: { ...UW, chargePct: 30 }, life: { ...UP, chargePct: 35 } };
  const hurt = who === "life"
    ? { frost: { hpPct: 100, hpStops: [[0, 40], [BEAT, 40], [BEAT + 2, 52], [SHOT, 52], [SHOT + 2, 88], [100, 88]] },
        storm: { hpPct: 100, hpStops: [[0, 50], [SHOT, 50], [SHOT + 2, 100], [100, 100]] },
        life: { hpPct: 100, hpStops: [[0, 70], [SHOT, 70], [SHOT + 2, 100], [100, 100]] } }
    : { frost: {}, storm: {}, life: {} };
  for (const k of ["frost", "storm", "life"]) h += ally(C, k, { ...bars[k], ...(k === G.key ? cast : {}), ...hurt[k], ...(k === "frost" ? { hpW: 40 } : {}) });
  // orbs: every mage has a core orb, out from the first frame; three loose ones build up on the casting mage and persist until the merge; after the shot two
  // new ones start again and stay; the rule scene also shows two loose Frost orbs and one loose Life orb
  h += coreOrb(C, { cx: 161, cy: 134, r: 28, color: FROSTC, pulses: BEATS }) + coreOrb(C, { cx: 92, cy: 166, r: 24, color: GOLD, pulses: BEATS }) + coreOrb(C, { cx: 230, cy: 166, r: 24, color: LIFEC, pulses: BEATS });
  h += orbRing(C, { cx, cy, r: G.r, color: G.color, items: [[-150, 8], [-30, 14], [0, 20]], pulses: BEATS, mergeAt: MERGE, mergeTo: G.mp, shownInStill: false });
  h += orbRing(C, { cx, cy, r: G.r, color: G.color, items: [[-150, NEW[0]], [-30, NEW[1]]], pulses: BEATS, shownInStill: false });
  if (rule) {
    h += orbRing(C, { cx: 161, cy: 134, r: 28, color: FROSTC, items: [[-150, 26], [-30, 30]], pulses: BEATS });
    h += orbRing(C, { cx: 230, cy: 166, r: 24, color: LIFEC, items: [[-30, 34]], pulses: BEATS });
    BEATS.forEach((t) => { h += ring(C, { cx: 161, cy: 134, r: 28, color: FROSTC, at: t }) + ring(C, { cx: 230, cy: 166, r: 22, color: LIFEC, at: t + 0.5 }); });
    h += floater(C, { x: 161, y: 104, text: "⛊+8", color: FROSTC, at: BEAT, size: 9, glow: "#4da6ff", show: false });
    h += floater(C, { x: 214, y: 140, text: "+5", color: LIFEC, at: BEAT + 0.5, size: 9, glow: "#1b8a55", show: false });
  }
  // the beat: what each orb does on its own, the core orb included. On the first beat (11%) only the core orb works; on the 33% beat the core and the three loose orbs do.
  const orbPos = [180, -150, -30, 0].map((a) => orbAt(cx, cy, G.r, a));
  if (who === "storm") {
    orbPos.forEach(([x, y], i) => {
      const t = i === 0 ? FIRST : BEAT + (i - 1) * 0.5;
      h += bolt(C, { x1: x, y1: y, x2: SH[i % 3][0], y2: SH[i % 3][1] + 10, color: GOLD, at: t, w: 1.6 });
      h += floater(C, { x: SH[i % 3][0], y: SH[i % 3][1] + 22, text: "−8", color: "#fff4b0", at: t + 1, size: 9, glow: GOLD, show: false });
    });
  } else if (who === "frost") {
    h += ring(C, { cx, cy, r: 30, color: FROSTC, at: FIRST }) + ring(C, { cx, cy, r: 30, color: FROSTC, at: BEAT });
    h += floater(C, { x: 161, y: 104, text: "⛊+8", color: FROSTC, at: FIRST, size: 9, glow: "#4da6ff", show: false });
    [128, 150, 172, 194].forEach((x, i) => { h += floater(C, { x, y: 104, text: "⛊+8", color: FROSTC, at: BEAT + i * 0.6, size: 9, glow: "#4da6ff", show: false }); });
  } else {
    // a Life orb drains: a green line from the front enemy (the Warden) to the orb, then on to the most hurt unit (Bram), `−5` on the enemy and `+5` on Bram
    orbPos.forEach(([x, y], i) => {
      const t = i === 0 ? FIRST : BEAT + (i - 1) * 0.5;
      h += beam(C, { x1: SH[1][0], y1: SH[1][1] + 18, x2: x, y2: y, color: LIFEC, at: t, w: 1.4, dur: 6 });
      h += beam(C, { x1: x, y1: y, x2: 161, y2: 134, color: LIFEC, at: t + 1.5, w: 1.4, dur: 6 });
      h += floater(C, { x: SH[1][0] + 18 + (i % 2) * 14, y: SH[1][1] + 22, text: "−5", color: "#d6ffe6", at: t + 1, size: 9, glow: LIFEC, show: false });
      h += floater(C, { x: 150 + i * 9, y: 110, text: "+5", color: LIFEC, at: t + 2.5, size: 9, glow: "#1b8a55", show: false });
    });
  }
  // the merge: the three orbs fly into one sparkling orb, which flares as it fires one big shot, and is gone
  h += ring(C, { cx: G.mp[0], cy: G.mp[1], r: 26, color: "#fff", at: SHOT - 0.2, dur: 8 });
  h += mergedOrb(C, { cx: G.mp[0], cy: G.mp[1], at: MERGE + 1, flare: SHOT, end: SHOT + 3, color: G.color });
  if (who === "storm") {
    h += bolt(C, { x1: G.mp[0], y1: G.mp[1] - 6, x2: SH[1][0], y2: SH[1][1] + 14, color: GOLD, at: SHOT, w: 4, base: 1 });
    h += floater(C, { x: 214, y: 28, text: "−80", color: "#fff", at: SHOT + 0.8, size: 16, glow: GOLD, show: true });
  } else {
    Object.values(allies).forEach(([ax, ay], j) => { h += ring(C, { cx: ax, cy: ay, r: j === 0 ? 30 : 22, color: G.color, at: SHOT + 0.3, dur: 9 }); });
    // Life's merge is the Great Drain: 45 taken from the front enemy (the Warden), shared as 15 on each of the three units
    const txt = who === "frost" ? [["⛊+45", 161, 104], ["⛊+29", 92, 140], ["⛊+37", 230, 140]] : [["+15", 161, 104], ["+15", 92, 140], ["+15", 230, 140]];
    txt.forEach(([text, x, y]) => { h += floater(C, { x, y, text, color: G.color, at: SHOT + 0.8, size: 11, glow: who === "frost" ? "#4da6ff" : "#1b8a55", show: true }); });
    if (who === "life") {
      h += beam(C, { x1: G.mp[0], y1: G.mp[1] - 6, x2: SH[1][0], y2: SH[1][1] + 18, color: LIFEC, at: SHOT, w: 3, dur: 7 });
      h += floater(C, { x: 214, y: 28, text: "−45", color: "#fff", at: SHOT + 0.8, size: 16, glow: LIFEC, show: true });
    }
  }
  const flavour = who === "storm" ? "EVERY ORB ZAPS ONE ENEMY" : who === "frost" ? "EVERY ORB SHIELDS BRAM" : "EVERY ORB DRAINS, HEALS THE HURT";
  h += chip(C, { x: 150, y: 96, text: "EVERY MAGE HAS A CORE ORB", color: "#e8e8ee", stops: win(3, 10, 1.2), base: 0 });
  h += chip(C, { x: 150, y: 96, text: rule ? "EVERY 2 S EACH ORB WORKS ALONE" : flavour, color: G.color, stops: win(BEAT - 1, 43, 1.5), base: 0 });
  h += chip(C, { x: 150, y: 96, text: "NEXT HIT MERGES THE 3 LOOSE ORBS", color: G.color, stops: win(44, 50, 1.2), base: 0 });
  h += chip(C, { x: 150, y: 96, text: who === "life" ? "ONE GREAT DRAIN, CORE STAYS" : "ONE BIG SHOT, CORE STAYS", color: G.color, stops: win(52, 58, 1.2), base: 0 });
  h += chip(C, { x: 150, y: 96, text: "NEXT HITS START FROM 0", color: G.color, stops: win(60, 72, 1.2), base: 0 });
  h += chip(C, { x: 150, y: 96, text: "SKILL ENDS: ORBS STAY", color: "#e8e8ee", stops: win(73, 96, 1.2), base: 0 });
  h += bubble(C, { cx, top: o.top, size: o.size, text: `${G.bubble} ×3`, color: u.hex, s: 2, w: G.bw, barW: G.bb });
  h += bubble(C, { cx, top: o.top, size: o.size, text: `${G.bubble} ×3`, color: u.hex, s: 46, w: G.bw, barW: G.bb });
  h += caps(C, [{ side: "left", text: rule ? "EVERY MAGE FIGHTS THROUGH ORBS" : `SKILL · ${G.bubble}`, color: rule ? ARMIES.mages.hex : u.hex, at: [4, 94] }]);
  return h;
}

// ---------- the Beasts' pounce (canvas 12.0C, built 2026-10-22; the game draws it in render/fightView.ts) ----------
const BEASTS = "#d9a066", ICEC = "#8fd3ff";
// a beast's jump from `home` to `land` and back, twice (the second is the chain: the pack pounces again): out at t1 and t2 (%), back about 8.5% later
function jumpAnim(C, home, land, t1, t2) {
  const dx = land[0] - home[0], dy = land[1] - home[1], T = (x, y, s = "1") => `transform:translate(${x}px,${y}px) scale(${s})`;
  const leg = (t) => [[t, T(0, 0)], [t + 1.2, T(dx / 2, dy / 2 - 30, "1.08")], [t + 2.4, T(dx, dy, "1.2,0.82")], [t + 3.4, T(dx, dy)], [t + 6, T(dx, dy)], [t + 8.5, T(0, 0)]];
  return C.kf([[0, T(0, 0)], ...leg(t1), ...leg(t2), [100, T(0, 0)]]);
}
// one card scene for a Beast's part of the pounce (who = "pin" | "maul" | "tend") or for the Pack rule (who = "rule", all three parts at once).
// T = 9 s: the PACK bar steps up (5-28%), is full (28%) and the bubble pops, the pack jumps (46%): the Bear first, then the Wolves, then the Stag; the
// Bear's part lands as a freeze, the Wolves' as three bites, the Stag's as a heal on everyone; the bar stays full through the jumps, the pounce
// goes again (66%) with bigger numbers, and the bar empties when it ends (80%). The still shows the first landing.
function pounceScene(C, { who }) {
  const all = who === "rule", pin = all || who === "pin", maul = all || who === "maul", tend = all || who === "tend";
  const T1 = 46, T2 = 66, STAG = 0.8;
  const WARDEN_C = [161, 34];
  let h = acoL(C) + wardenE(C, maul ? { hpPct: 76, hpStops: [[0, 100], [T1 + 3, 100], [T1 + 4, 90], [T2 + 3, 90], [T2 + 4, 76], [100, 76]] } : {}) + acoR(C);
  const pack = [
    { key: "bear", o: BEAR, name: "Bruno", land: [161, 78], hpW: 38, hp: [60, 82, 100] },
    { key: "wolf", o: BK[0], name: "Fang", land: [118, 68], hpW: 32, hp: [70, 88, 100] },
    { key: "wolf", o: BK[1], name: "Ash", land: [204, 68], hpW: 32, hp: [64, 84, 100] },
    { key: "wolf", o: BK[2], name: "Dusk", land: [136, 98], hpW: 32, hp: [72, 90, 100] },
    { key: "stag", o: BK[3], name: "Moss", land: [188, 98], hpW: 32, hp: [68, 86, 100] },
  ];
  pack.forEach((p, i) => {
    const home = [p.o.cx, p.o.top + p.o.size / 2];
    const hp = tend ? { hpPct: p.hp[2], hpStops: [[0, p.hp[0]], [T1 + 4 + i * STAG, p.hp[0]], [T1 + 6 + i * STAG, p.hp[1]], [T2 + 4 + i * STAG, p.hp[1]], [T2 + 6 + i * STAG, p.hp[2]], [100, p.hp[2]]] } : {};
    h += ally(C, p.key, { ...p.o, name: p.name, short: true, hpW: p.hpW, noCharge: true, wrapAnim: jumpAnim(C, home, p.land, T1 + i * STAG, T2 + i * STAG), ...hp });
  });
  // the PACK bar: one bar for all five, steps up, is full through the pounce, and empties when it ends (the still shows it full)
  const steps = [[0, 0], [5, 0], [7, 25], [12, 25], [14, 50], [19, 50], [21, 75], [26, 75], [28, 100], [78, 100], [80, 0], [100, 0]];
  h += abs(`left:12px;top:197px;font-size:8px;font-weight:800;letter-spacing:0.12em;color:${BEASTS};`, "PACK");
  h += abs(`left:46px;top:197px;width:262px;height:8px;border-radius:5px;background:#2a2e3a;overflow:hidden;border:1px solid #3a3f4e;${C.kf([[0, "box-shadow:none"], [27, "box-shadow:none"], [28, `box-shadow:0 0 8px 1px ${YEL}`], [79, `box-shadow:0 0 8px 1px ${YEL}`], [80, "box-shadow:none"], [100, "box-shadow:none"]])}`,
    `<div style="height:100%;width:100%;background:${YEL};${C.kf(W(steps))}"></div>` + [1, 2, 3, 4].map((i) => abs(`left:${i * 20}%;top:0;bottom:0;width:1px;background:#14161c;opacity:.7;`)).join(""));
  // the landing of each part, first and second pounce (the second is bigger)
  const at = (i, t) => t + 2.4 + i * STAG;
  if (pin) {
    h += ring(C, { cx: WARDEN_C[0], cy: WARDEN_C[1], r: 30, color: ICEC, at: at(0, T1) }) + ring(C, { cx: WARDEN_C[0], cy: WARDEN_C[1], r: 30, color: ICEC, at: at(0, T2) });
    h += chip(C, { x: 214, y: 4, text: "FROZEN 0.5 S", color: ICEC, stops: win(at(0, T1), at(0, T1) + 12, 1.2) });
    h += chip(C, { x: 214, y: 4, text: "FROZEN 1.0 S", color: ICEC, stops: win(at(0, T2), at(0, T2) + 12, 1.2), base: 0 });
  }
  if (maul) {
    [[1, 128, 46], [2, 194, 46], [3, 161, 66]].forEach(([i, x, y]) => {
      h += floater(C, { x, y, text: "−7", color: "#fff", at: at(i, T1), size: 11, glow: "#ff5252" });
      h += floater(C, { x, y, text: "−14", color: "#fff", at: at(i, T2), size: 13, glow: "#ff5252", show: false });
    });
  }
  if (tend) {
    pack.forEach((p, i) => {
      const x = p.o.cx, y = p.o.top - 10;
      h += floater(C, { x, y, text: "+4", color: ROLE.healer.hex, at: at(i, T1) + 2, size: 10, glow: "#1b8a55" });
      h += floater(C, { x, y, text: "+8", color: ROLE.healer.hex, at: at(i, T2) + 2, size: 11, glow: "#1b8a55", show: false });
    });
  }
  // the words
  const say = { pin: "THE BEAR LANDS FIRST AND FREEZES IT", maul: "EVERY WOLF BITES: 3 WOLVES, 21", tend: "EVERY STAG HEALS EVERYONE", rule: "FULL: THE WHOLE PACK JUMPS" }[who];
  if (all) h += chip(C, { x: 12, y: 100, text: "ONE BAR FOR THE WHOLE PACK", color: BEASTS, stops: win(6, 34, 1.5), base: 0 });
  h += chip(C, { x: 12, y: 100, text: say, color: BEASTS, stops: win(T1 - 2, T1 + 14, 1.5) });
  h += chip(C, { x: 12, y: 100, text: "A CHAIN: THEY JUMP AGAIN", color: YEL, stops: win(T2 - 4, T2 + 14, 1.5), base: 0 });
  h += bubble(C, { cx: 161, top: 114, size: 38, text: "POUNCE", color: BEASTS, s: 36, w: 60, barW: 38 });
  h += bubble(C, { cx: 161, top: 114, size: 38, text: "POUNCE ×2", color: BEASTS, s: 57, w: 70, barW: 38 });
  const name = { pin: "PIN", maul: "MAUL", tend: "TEND" }[who];
  h += caps(C, [{ side: "left", text: all ? "THE PACK BAR FILLS, THEN THE PACK POUNCES" : `SKILL · ${name}`, color: all ? BEASTS : ROLE[{ pin: "tank", maul: "damage", tend: "healer" }[who]].hex, at: [4, 94] }]);
  return h;
}

const SCENES = {
  stormOrb: (C) => mageScene(C, { who: "storm" }),
  frostOrb: (C) => mageScene(C, { who: "frost" }),
  lifeOrb: (C) => mageScene(C, { who: "life" }),
  mages: (C) => mageScene(C, { who: "storm", rule: true }),
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
  pin: (C) => pounceScene(C, { who: "pin" }),
  maul: (C) => pounceScene(C, { who: "maul" }),
  tend: (C) => pounceScene(C, { who: "tend" }),
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
  // the Beasts rule: one PACK bar for the whole pack; when it is full every beast jumps on one enemy
  beasts: (C) => pounceScene(C, { who: "rule" }),
};

// =====================================================================================================
// the card file (11.x)
// =====================================================================================================
const CARDS = [
  { n: 1, kind: "skill", unit: "knight" }, { n: 2, kind: "skill", unit: "wraith" }, { n: 3, kind: "skill", unit: "priest" },
  { n: 4, kind: "skill", unit: "bear" }, { n: 5, kind: "skill", unit: "wolf" }, { n: 6, kind: "skill", unit: "stag" },
  { n: 7, kind: "rule", army: "undead" }, { n: 8, kind: "rule", army: "beasts" },
  { n: 9, kind: "skill", unit: "frost" }, { n: 10, kind: "skill", unit: "storm" }, { n: 11, kind: "skill", unit: "life" },
  { n: 12, kind: "rule", army: "mages" },
];
const NAMES = { 1: "BoneWall", 2: "Command", 3: "Raise", 4: "Pin", 5: "Maul", 6: "Tend", 7: "Horde", 8: "Pack", 9: "FrostOrb", 10: "StormOrb", 11: "LifeOrb", 12: "Orbs" };
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
    noteText = `Opened from the "See ${a.rule.name} in action" row on the ARMY tile of any ${a.name} popup (${POPUP_RANGE[a.key]}) or from the army chip on ${SQUAD_NUM[a.key]}; the screen behind is a stand-in. Closes on ✕, Got it, or a tap outside the card.`;
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
  @keyframes orbSpin { to { transform: rotate(360deg); } }
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

    <div style="font-size: 10.5px; color: #8a8fa3; text-align: center; margin-top: 8px;">${cardLead(c)}</div>
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
const Y_PICK = 9100, Y_UND = 10500, Y_BEA = 12000, Y_CARD = 13400, Y_MAG = 14800;
w("ArmyPickA.dc.html", pickFile("A"), 0, Y_PICK, 1060, "10.0A Pick before round 1 (option, awaiting Tu's pick)");
w("ArmyPickB.dc.html", pickFile("B"), 550, Y_PICK, 1140, "10.0B Pick after the round 1 win, in place of the rune pick (option)");
w("ArmySquadUndead.dc.html", squadFile("undead"), 0, Y_UND, 880, "10.1 Undead squad — round screen (proposal)");
["knight", "wraith", "priest"].forEach((k, i) => w(`ArmyPopup${UNITS[k].title.replace(/ /g, "")}.dc.html`, popupFile(k), 550 * (i + 1), Y_UND, 900, `${POPUP_NUM[k]} ${UNITS[k].title} — Undead ${ROLE[UNITS[k].role].word} (proposal)`));
w("ArmySquadBeasts.dc.html", squadFile("beasts"), 0, Y_BEA, 880,"10.5 Beasts squad — round screen, five fielded (built 2026-10-22)");
["bear", "wolf", "stag"].forEach((k, i) => w(`ArmyPopup${UNITS[k].title}.dc.html`, popupFile(k), 550 * (i + 1), Y_BEA, 900, `${POPUP_NUM[k]} ${UNITS[k].title} — Beast ${ROLE[UNITS[k].role].word} (built 2026-10-22)`));
w("ArmySquadMages.dc.html", squadFile("mages"), 0, Y_MAG, 880, "10.9 Mages squad — round screen (built 2026-10-21, reworked 2026-10-23)");
["frost", "storm", "life"].forEach((k, i) => w(`ArmyPopup${UNITS[k].title.replace(/ /g, "")}.dc.html`, popupFile(k), 550 * (i + 1), Y_MAG, 900, `${POPUP_NUM[k]} ${UNITS[k].title} — Mage ${ROLE[UNITS[k].role].word} (built 2026-10-21, reworked 2026-10-23)`));
CARDS.forEach((c, i) => {
  const built = BUILT_ON[c.kind === "skill" ? UNITS[c.unit].army : c.army] ?? "proposal";
  const label = c.kind === "skill"
    ? `11.${c.n} ${SKILLS[UNITS[c.unit].skill].name} — ${UNITS[c.unit].title}'s skill (${built})`
    : `11.${c.n} ${ARMIES[c.army].rule.name} — the ${ARMIES[c.army].name} rule (${built})`;
  w(`ArmyCard${NAMES[c.n]}.dc.html`, cardFile(c), 550 * i, Y_CARD, 900, label);
});

const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/"file": "Army|"id": "(label|section)-army/.test(l));
lines = lines.filter((l, i, a) => !(l.trim() === "" && (a[i + 1] === undefined || a[i + 1].trim() === "" || /^\s*\]/.test(a[i + 1]))));
const boards = FRAMES.map((f) => `    { "file": "${f.file}", "x": ${f.x}, "y": ${f.y}, "w": ${f.w}, "h": ${f.h} },`);
const notes = [
  `    { "id": "section-army-pick", "x": 0, "y": ${Y_PICK - 140}, "w": 1000, "text": "10 · ARMIES — pick an army and every unit changes: its look, its skills and one rule (proposal, design only, not built). First, where the pick sits" },`,
  `    { "id": "section-army-undead", "x": 0, "y": ${Y_UND - 140}, "w": 2200, "text": "10 · UNDEAD — fall once, rise stronger: the round screen, then the three popups" },`,
  `    { "id": "section-army-beasts", "x": 0, "y": ${Y_BEA - 140}, "w": 2200, "text": "10 · BEASTS — five small units, one pack pounce (built 2026-10-22): the round screen, then the three popups" },`,
  `    { "id": "section-army-cards", "x": 0, "y": ${Y_CARD - 140}, "w": 6600, "text": "11 · ARMY CARDS — opened from the 'See … in action' rows: six skills, then the two army rules, then the Mages' three skills and their rule" },`,
  `    { "id": "section-army-mages", "x": 0, "y": ${Y_MAG - 140}, "w": 2200, "text": "10 · MAGES — a core orb on every mage, orbs that merge (built 2026-10-21, reworked 2026-10-23): the round screen, then the three popups" },`,
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
// render/termCards.ts), armyCards.css its keyframes and loop length. Generated, so do not
// edit the two output files by hand, change the scene above and run this again.
{
  const GAME = path.join(__dirname, "..", "..", "prototype", "src");
  const data = {};
  const cssLines = ["/* Generated by design/tools/gen-armies.js from the army scenes (canvas 11.1 to 11.12). Do not edit by hand. */", "@keyframes orbSpin { to { transform: rotate(360deg); } }", ""];
  for (const c of CARDS) {
    const key = c.kind === "skill" ? UNITS[c.unit].skill : c.army;
    const id = "army-" + key;
    const C = makeCtx("tc-army-" + c.n + "-");
    const { a, scene, header, rows } = cardPieces(c, C);
    const head = `<div style="position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; color: ${a.hex};">${header}</div>`;
    const sceneHtml = head + `<div class="scene" style="position: relative; width: 322px; height: 210px; margin-top: 26px; background: #14161c; border: 1px solid #2a2e3a; border-radius: 10px; overflow: hidden;"><div style="position: absolute; top: 104px; left: 16px; right: 16px; height: 1px; background: linear-gradient(90deg, transparent, #3a3f4e, transparent);"></div>${scene}</div>`;
    const lead = cardLead(c);
    const text = `<div style="font-size: 10.5px; color: #8a8fa3; text-align: center; margin-top: 8px;">${lead}</div>` + rows;
    data[id] = { scene: sceneHtml, text };
    cssLines.push(`/* ---------- ${key} ---------- */`, `.tc-${id} .scene { --T: 9s; }`, ...C.rules, "");
  }
  const ts =
    "// Generated by design/tools/gen-armies.js from the army scenes (canvas 11.1 to 11.12). Do not edit by hand unless you stop running the script.\n" +
    "// Each card: `scene` is the animated picture (with its army header), `text` is the army and skill rows. The shell (close, Got it) is render/termCards.ts.\n\n" +
    "export const ARMY_CARD_DATA: Record<string, { scene: string; text: string }> = " +
    JSON.stringify(data, null, 2) +
    ";\n";
  fs.writeFileSync(path.join(GAME, "render", "armyCardData.ts"), ts);
  fs.writeFileSync(path.join(GAME, "armyCards.css"), cssLines.join("\n"));
  console.log("wrote the game's army cards:", Object.keys(data).length);
}
