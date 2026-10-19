// Generates canvas sections 8 and 9: the ten merge heroes (2026-10-19, proposal, not built).
//   8.1-8.10  HeroPopup<Name>.dc.html  the hero's fighter popup: recipe, gift tile, skill tile
//   9.1-9.10  HeroSkill<Name>.dc.html  the explain card behind "See <skill> in action": a looping scene, gift first, then skill
// Run:  node design/tools/gen-heroes.js            (writes the 20 files and patches canvas.json)
// The popup shell and backdrop are cut from FighterPopupIvy.dc.html; the card backdrop and base CSS from TermExpose.dc.html.
// Hero numbers (HP, damage) are made up for the picture; the rules are the ones logged in DECISIONS.md once Tu confirms them.
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
const GOLD = "#ffd76a", GOLD_RGB = "255,215,106";
const RED = "#ff5d5d", TEAL = "#5ee0d0", YEL = "#ffcf4d", PINK = "#ff7ab6", BONE = "#eae6d8";

// ---------- unique svg ids (faces.js ids would collide with the copied backdrop) ----------
let uidN = 0;
const uniq = (svg) => { const p = "h" + (uidN++) + "_"; return svg.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`); };
const face = (hex, size, tier = "fresh") => uniq(faces.squadFace(hex, tier, size));
const villain = (size, scowl = 1) => uniq(faces.villainFace(size, scowl));

// ---------- icons (24 viewBox, inner markup) ----------
const sw = (c, w = 1.8) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const I = {
  crown: (c = GOLD) => `<path d="M3 17 L2 6.5 L8 11.5 L12 4 L16 11.5 L22 6.5 L21 17 Z" fill="${c}" stroke="#7a5c10" stroke-width="1.2" stroke-linejoin="round"/><rect x="3" y="18" width="18" height="2.6" rx="1" fill="${c}" stroke="#7a5c10" stroke-width="0.8"/>`,
  shield: (c) => `<path d="M12 2.8 L19.5 5.8 V11.6 C19.5 16.4 16.3 19.8 12 21.4 C7.7 19.8 4.5 16.4 4.5 11.6 V5.8 Z" fill="${c}33" ${sw(c)}/>`,
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
  target: (c) => `<circle cx="8" cy="8" r="6" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="8" cy="8" r="2" fill="${c}"/>`,
  repeat: (c) => `<path d="M5 9 A7 7 0 0 1 17.5 6.5 M19 15 A7 7 0 0 1 6.5 17.5" ${sw(c, 2)}/><path d="M17.5 2.5 V7 H13 M6.5 21.5 V17 H11" ${sw(c, 2)}/>`,
  bullet: (c) => `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
};
const svg = (inner, size, vb = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" style="flex:none;overflow:visible;">${inner}</svg>`;
const crownEl = (px) => `<svg width="${px}" height="${(px * 0.9).toFixed(1)}" viewBox="0 0 24 22" style="position:absolute;left:30%;top:${(-px * 0.6).toFixed(1)}px;transform:translateX(-50%) rotate(-18deg);overflow:visible;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.55));">${I.crown()}</svg>`;

// ---------- the ten heroes ----------
// recipe: three role pieces; row: FRONT when two or more Tank pieces; hp, dmg: made-up numbers.
const HEROES = [
  {
    key: "Golem", n: 1, recipe: ["tank", "tank", "tank"], row: "FRONT", hp: 480, hpNow: 480, stat: ["Damage", 9],
    job: "Three Tanks in one wall. Every enemy hit lands on it.",
    gift: { name: "Taunt", icon: "taunt", head: "Every enemy hit lands on the Golem.", line: "{slam}s too, and the enemies that normally reach your back row.", card: "Every enemy hit lands on the Golem: {slam}s too, and the enemies that normally reach your back row." },
    skill: { name: "Fortify", icon: "shieldPlus", head: "Wraps itself in a big {shield}.", chips: ["Itself", "sh:Shield"], lines: ["{shield} worth 40% of its max HP.", "Each time it goes again, the {shield} grows."], card: "Puts a big {shield} on the Golem itself, worth 40% of its max HP. Each time it goes again, the {shield} grows." },
    others: [["Ivy", "damage"], ["Sol", "healer"]], note: "Three Tank pieces make the one hero that cannot be bypassed. Numbers are made up.",
  },
  {
    key: "Berserker", n: 2, recipe: ["tank", "tank", "damage"], row: "FRONT", hp: 330, hpNow: 150, stat: ["Damage", 22],
    job: "Two Tanks and a Damage unit. Stands in front and hits harder the more it is hurt.",
    gift: { name: "Rage", icon: "flame", head: "The more hurt it is, the harder it hits.", line: "+1% damage for every 1% of HP missing. At 20% HP it hits 80% harder.", card: "The more hurt it is, the harder it hits: +1% damage for every 1% of HP missing." },
    skill: { name: "Cleave", icon: "cleave", head: "A big swing at the front enemy.", chips: ["Front enemy"], lines: ["Hits for 2.5 times its damage.", "Each time it goes again, the swing is bigger."], card: "A big swing at the front enemy, worth 2.5 times the Berserker's damage. Each time it goes again, the swing is bigger." },
    others: [["Ivy", "damage"], ["Sol", "healer"]], note: "Shown mid-fight, hurt (150/330): Rage has lifted its damage from 14 to 22. It takes the front spot, so there is no Guard. Numbers are made up.",
  },
  {
    key: "Paladin", n: 3, recipe: ["tank", "tank", "healer"], row: "FRONT", hp: 350, hpNow: 350, stat: ["Damage", 8],
    job: "Two Tanks and a Healer. Every hit it takes heals the rest of the squad.",
    gift: { name: "Martyr", icon: "heart", head: "Every hit it takes heals your other units a little.", line: "3 HP to each other unit, for every hit it takes.", card: "Every hit the Paladin takes heals your other units a little: 3 HP each." },
    skill: { name: "Bless", icon: "shieldPlus", head: "Gives every unit a {shield}.", chips: ["Whole squad", "sh:Shield"], lines: ["{shield} worth 8% of each unit's max HP.", "Each time it goes again, every unit gets another."], card: "Gives every unit a {shield} worth 8% of its max HP. Each time it goes again, every unit gets another." },
    others: [["Ivy", "damage"], ["Sol", "healer"]], note: "Numbers are made up.",
  },
  {
    key: "Assassin", n: 4, recipe: ["damage", "damage", "damage"], row: "BACK", hp: 170, hpNow: 170, stat: ["Damage", 20],
    job: "Three Damage units in one blade. Every kill charges its skill at once.",
    gift: { name: "Bloodlust", icon: "bolt", head: "Every kill fills its skill bar at once.", line: "An enemy dying means it strikes again right away.", card: "Every kill fills the Assassin's skill bar at once. Kill, strike, kill, strike." },
    skill: { name: "Execute", icon: "dagger", head: "A heavy strike on the weakest enemy.", chips: ["Weakest enemy"], lines: ["Hits for 3 times its damage.", "A kill from it fills the bar again."], card: "A heavy strike on the weakest enemy, worth 3 times the Assassin's damage. If it kills, the bar is full again." },
    others: [["Bram", "tank"], ["Sol", "healer"]], note: "Pulls toward swarms of weak enemies. Numbers are made up.",
  },
  {
    key: "Dragon", n: 5, recipe: ["damage", "damage", "tank"], row: "BACK", hp: 120, hpNow: 120, stat: ["Damage", 10],
    job: "Two Damage units and a Tank. Starts as a baby and grows.",
    gift: { name: "Growth", icon: "grow", head: "Grows a stage every 4 fights it wins.", line: "Baby, Young, Adult, Elder: bigger, tougher, harder hitting. Resting it stops its growth.", card: "Grows a stage every 4 fights it wins: Baby, Young, Adult, Elder. Each stage is bigger, tougher and hits harder." },
    skill: { name: "Breath", icon: "breath", head: "Breathes on the enemy.", chips: ["Front enemy, then all"], lines: ["A Baby hits one enemy. From Adult, it hits every enemy.", "If the Dragon falls, all its growth is lost."], card: "A Baby hits one enemy. From Adult on, the breath hits every enemy. If the Dragon falls, all its growth is lost." },
    others: [["Bram", "tank"], ["Sol", "healer"]], note: "Shown as a Baby (stage 1 of 4), the stage it starts every run at. Numbers are made up.",
  },
  {
    key: "Necromancer", n: 6, recipe: ["damage", "damage", "healer"], row: "BACK", hp: 150, hpNow: 150, stat: ["Damage", 6],
    job: "Two Damage units and a Healer. Everyone who dies fights for it.",
    gift: { name: "Raise", icon: "skull", head: "Anyone who dies, yours or theirs, rises as a skeleton.", line: "It fights on your side until the fight ends. At most 4 at once.", card: "Anyone who dies, yours or theirs, rises as a skeleton on your side until the fight ends. At most 4 at once." },
    skill: { name: "Horde", icon: "horde", head: "Every skeleton strikes at once.", chips: ["Every skeleton"], lines: ["Each skeleton hits the front enemy for 8.", "Each time it goes again, the whole army swings again."], card: "Every skeleton strikes the front enemy for 8 at once. Each time it goes again, the whole army swings again." },
    others: [["Bram", "tank"], ["Sol", "healer"]], note: "Pulls toward early kills and many small hits. Numbers are made up.",
  },
  {
    key: "Priest", n: 7, recipe: ["healer", "healer", "healer"], row: "BACK", hp: 230, hpNow: 230, stat: ["Heal", 14],
    job: "Three Healers in one. Every heal also hurts the front enemy.",
    gift: { name: "Radiance", icon: "sun", head: "Each heal also hits the front enemy for the same amount.", line: "Heals 14, and the front enemy takes 14.", card: "Each heal also hits the front enemy for the same amount: heal 14, and it takes 14." },
    skill: { name: "Prayer", icon: "plus", head: "Heals every unit.", chips: ["Whole squad"], lines: ["Heals 14 each.", "The front enemy is hit once for every unit healed."], card: "Heals every unit for 14. The front enemy is hit once for every unit healed." },
    others: [["Bram", "tank"], ["Ivy", "damage"]], note: "Open: Prayer heals three units, so Radiance hits three times. That may be too strong. Numbers are made up.",
  },
  {
    key: "Treant", n: 8, recipe: ["healer", "healer", "tank"], row: "BACK", hp: 300, hpNow: 300, stat: ["Heal", 10],
    job: "Two Healers and a Tank. Its healing grows as the fight goes on.",
    gift: { name: "Rooted", icon: "sprout", head: "Its healing grows every second of the fight.", line: "Heals 3 at the start of a fight, 10 after 25 seconds.", card: "Its healing grows every second of the fight: 3 at the start, 10 after 25 seconds." },
    skill: { name: "Bloom", icon: "bloom", head: "Heals every unit.", chips: ["Whole squad"], lines: ["Heals what Rooted has grown to.", "A long fight makes it a big heal."], card: "Heals every unit for whatever Rooted has grown to. A long fight makes it a big heal." },
    others: [["Bram", "tank"], ["Ivy", "damage"]], note: "Open: Bloom and Prayer are the same skill under different gifts. Numbers are made up.",
  },
  {
    key: "Vampire", n: 9, recipe: ["healer", "healer", "damage"], row: "BACK", hp: 180, hpNow: 180, stat: ["Damage", 12],
    job: "Two Healers and a Damage unit. Every hit your squad lands heals the one who landed it.",
    gift: { name: "Leech", icon: "drop", head: "Every hit your squad lands heals the unit that landed it.", line: "A little each time: 1 HP per hit.", card: "Every hit your squad lands heals the unit that landed it: 1 HP per hit." },
    skill: { name: "Bite", icon: "bite", head: "Bites the strongest enemy and heals the squad.", chips: ["Strongest enemy", "Heals the squad"], lines: ["Hits for 2 times its damage.", "The squad is healed for what it dealt, shared out."], card: "Bites the strongest enemy for 2 times its damage, then heals the squad for what it dealt, shared out between your units." },
    others: [["Bram", "tank"], ["Ivy", "damage"]], note: "Pulls toward many small hits. Numbers are made up.",
  },
  {
    key: "Twin", n: 10, recipe: ["tank", "damage", "healer"], row: "BACK", hp: 190, hpNow: 190, stat: ["Damage", 8],
    job: "One Tank, one Damage unit and one Healer. Copies the skill of the unit next to it.",
    gift: { name: "Mirror", icon: "mirror", head: "Copies the skill of the unit next to it in the back row.", line: "It also counts as that unit's role for runes. Alone, it copies the Tank.", card: "Copies the skill of the unit next to it in the back row, and counts as that unit's role for runes. Alone, it copies the Tank." },
    skill: { name: "Echo", icon: "echo", head: "Uses whatever skill it copied.", chips: ["The copied skill"], lines: ["Next to Ivy it uses Expose. Next to a Healer, Mend.", "It charges on its own, so both of them fire."], card: "Uses whatever skill it copied. Next to Ivy that is Expose; next to a Healer, Mend. It charges on its own, so both of them fire." },
    others: [["Ivy", "damage"], ["Bram", "tank"]], note: "Shown copying Ivy's Expose. The skill name on the tile changes with what it copies. Numbers are made up.",
  },
];

// derived look
for (const h of HEROES) {
  const cs = h.recipe.map((r) => ROLE[r].hex);
  const counts = {};
  for (const c of cs) counts[c] = (counts[c] || 0) + 1;
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  h.mainHex = keys[0];
  h.mainRole = h.recipe.find((r) => ROLE[r].hex === keys[0]);
  h.tileRgb = keys.length === 3 ? GOLD_RGB : ROLE[h.mainRole].rgb;
  h.tileHex = keys.length === 3 ? GOLD : h.mainHex;
  if (keys.length === 1) h.bg = keys[0];
  else if (keys.length === 2) h.bg = `linear-gradient(135deg, ${keys[0]} 0 62%, ${keys[1]} 62% 100%)`;
  else h.bg = `conic-gradient(from 30deg, ${cs[0]} 0 33.3%, ${cs[1]} 33.3% 66.6%, ${cs[2]} 66.6% 100%)`;
}
const fangs = (h) => (h.key === "Vampire" ? `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;"><polygon points="38,70 46,70 42,83" fill="#fff" stroke="#14161c" stroke-width="2"/><polygon points="54,70 62,70 58,83" fill="#fff" stroke="#14161c" stroke-width="2"/></svg>` : "");
const heroFace = (h, size) => face(h.mainHex, size) + fangs(h);
const heroBody = (h, size, extra = "") => `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${h.bg};${extra}">${heroFace(h, size)}${crownEl(Math.round(size * 0.5))}</div>`;

// text with game terms: popups keep the dotted underline (tap), cards do not
const terms = (s, tap) => s
  .replace(/\{shield\}/g, `<span class="term shield${tap ? " tap" : ""}">shield</span>`)
  .replace(/\{slam\}/g, `<span class="term${tap ? " tap" : ""}">slam</span>`);

// ---------- popup (8.x) ----------
function chipEl(bg, faceSvg, name, ring, crown) {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:44px;"><div style="position:relative;width:28px;height:28px;border-radius:50%;background:${bg};${ring ? "box-shadow:0 0 0 2px #14161c,0 0 0 4px #e8e8ee;" : "opacity:0.55;"}">${faceSvg}${crown ? crownEl(14) : ""}</div><div style="font-size:9px;font-weight:${ring ? 800 : 600};color:${ring ? "#e8e8ee" : "#8a8fa3"};">${name}</div></div>`;
}
function ingredient(role) {
  const r = ROLE[role];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="position:relative;width:28px;height:28px;border-radius:50%;background:${r.hex};">${face(r.hex, 28)}</div><div style="font-size:9px;font-weight:700;color:${r.hex};">${r.word}</div></div>`;
}
const op = (t) => `<div style="font-size:15px;font-weight:800;color:#8a8fa3;margin-top:-12px;">${t}</div>`;
function popupHtml(h) {
  const rgb = h.tileRgb, hex = h.tileHex;
  const switcher = chipEl(h.bg, heroFace(h, 28), h.key, true, true)
    + h.others.map(([nm, role]) => chipEl(ROLE[role].hex, face(ROLE[role].hex, 28), nm, false)).join("")
    + `<div style="width:1px;height:30px;background:#3a3f4e;margin:0 4px;"></div>`
    + chipEl(RED, villain(28), "Warden", false);
  const chips = (h.skill.chips || []).map((c) => c.startsWith("sh:")
    ? `<span class="sk-chip sh"><svg width="11" height="11" viewBox="0 0 24 24">${I.shield(TEAL)}</svg>${c.slice(3)}</span>`
    : `<span class="sk-chip"><svg class="sk-tg" width="11" height="11" viewBox="0 0 16 16">${I.target("currentColor")}</svg>${c}</span>`).join("");
  const tile = (rgbv, hexv, ico, name, tag, head, chipsHtml, lines, footer) => `
    <div class="sec skill" style="--r: ${rgbv};">
      <div class="sk-top">
        <div class="sk-em">${svg(I[ico](hexv), 26)}</div>
        <div class="sk-main">
          <div class="sk-row"><span class="sk-name">${name}</span><span class="sk-tag">${tag}</span></div>
          <div class="sk-head">${head}</div>
        </div>
      </div>
      ${chipsHtml ? `<div class="sk-chips">${chipsHtml}</div>` : ""}
      <div class="sk-div"></div>
      ${lines.map((l, i) => `<div class="sk-line"><span class="sk-li">${svg(I[i === 0 ? "bullet" : "repeat"](hexv), 14)}</span><span>${l}</span></div>`).join("")}
      ${footer || ""}
    </div>`;
  const giftTile = tile(GOLD_RGB, GOLD, h.gift.icon, h.gift.name, "GIFT", terms(h.gift.head, true), "", [terms(h.gift.line, true)], "");
  const skillTile = tile(rgb, hex, h.skill.icon, h.skill.name, "SKILL", terms(h.skill.head, true), chips, h.skill.lines.map((l) => terms(l, true)),
    `<div class="sk-more"><svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.6 5.3 L11 8 L6.6 10.7 Z" fill="currentColor"/></svg><span>See ${h.skill.name} in action</span><span class="chev">›</span></div>`);
  const hpPct = Math.round((h.hpNow / h.hp) * 100);
  return `<div style="position: absolute; top: 40px; left: 20px; width: 350px; background: #1d2029; border: 1px solid #3a3f4e; border-radius: 14px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.55);">
    <div style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: #2a2e3a; color: #c7cad6; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700;">✕</div>
    <div style="display: flex; align-items: flex-start; gap: 2px; margin-right: 30px;">${switcher}</div>
    <div style="display: flex; align-items: center; gap: 6px; margin-top: 14px;">
      <div class="arrow">‹</div>
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div style="position: relative; width: 44px; height: 44px; margin-top: 10px;">
          <div style="position: absolute; top: 38px; left: 50%; width: 36px; height: 6px; transform: translateX(-50%); border-radius: 50%; background: rgba(0,0,0,0.4); filter: blur(2px);"></div>
          ${heroBody(h, 44)}
        </div>
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
          <span style="font-size: 16px; font-weight: 800; color: #e8e8ee;">${h.key}</span>
          <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.12em; color: #14161c; background: ${GOLD}; border-radius: 4px; padding: 1px 5px;">HERO</span>
          <span style="font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: #8a8fa3; border: 1px solid #3a3f4e; border-radius: 4px; padding: 1px 5px;">${h.row}</span>
        </div>
        <div style="font-size: 12px; line-height: 1.4; color: #c7cad6; text-align: center; max-width: 210px;">${h.job}</div>
      </div>
      <div class="arrow">›</div>
    </div>
    <div style="display: flex; gap: 6px; justify-content: center; margin-top: 10px;"><span class="chip">HP ${h.hpNow}/${h.hp}</span><span class="chip">${h.stat[0]} ${h.stat[1]}</span></div>
    <div style="width: 150px; height: 6px; border-radius: 3px; background: #2a2e3a; overflow: hidden; margin: 6px auto 0;"><div style="width: ${hpPct}%; height: 100%; background: #4da6ff;"></div></div>
    <div class="sec" style="padding: 8px 11px 9px;">
      <div class="lab">MADE FROM THREE UNITS (they leave the squad)</div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 9px;">${ingredient(h.recipe[0])}${op("+")}${ingredient(h.recipe[1])}${op("+")}${ingredient(h.recipe[2])}${op("=")}<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="position:relative;width:34px;height:34px;margin-top:6px;">${heroBody(h, 34)}</div><div style="font-size:9px;font-weight:800;color:${GOLD};margin-top:-1px;">${h.key}</div></div></div>
    </div>${giftTile}${skillTile}
  </div>`;
}
function popupFile(h) {
  const ivy = read("FighterPopupIvy.dc.html");
  const css = ivy.slice(ivy.indexOf("<style>") + 7, ivy.indexOf("</style>"));
  const start = ivy.indexOf('<div style="position: relative; background: #14161c; width: 390px');
  const end = ivy.indexOf('<div style="position: absolute; top: 40px; left: 20px; width: 350px');
  const note = `Hero popup, ${h.key} (proposal, design only, not built). Over a dimmed copy of 1.1 as a stand-in. Same popup as 2.1 to 2.3, with the recipe and a GIFT tile (gold) above the SKILL tile; no Fatigue card here. ${h.note} The skill tile opens card 9.${h.n}.`;
  return `<!doctype html>
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

${ivy.slice(start, end)}${popupHtml(h)}

  <!-- design note, not part of the screen -->
  <div style="position: absolute; left: 20px; right: 20px; bottom: 14px; font-size: 10.5px; line-height: 1.45; color: #8a8fa3; text-align: center;">${note}</div>
</div>
</x-dc>
</body>
</html>
`;
}

// ---------- scene toolkit (9.x) ----------
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
  const { cx, top, size, bg, faceSvg, bodyAnim = "", bodyStyle = "", wrapStyle = "", wrapAnim = "", alpha = 0.24, crown = false, overlay = "" } = o;
  return abs(`left:${cx - size / 2}px;top:${top}px;width:${size}px;height:${size}px;`,
    shadow(size, alpha) + `<div style="position:absolute;inset:0;transform-origin:50% 100%;${wrapStyle}${wrapAnim}"><div style="position:absolute;inset:0;border-radius:50%;background:${bg};${bodyStyle}${bodyAnim}">${faceSvg}</div>${crown ? crownEl(Math.round(size * 0.5)) : ""}${overlay}</div>`);
}
const nameLabel = (cx, y, html, extra = "") => abs(`left:${cx - 55}px;top:${y}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${extra}`, html);
function hpBar(C, { cx, y, pct = 100, stops = null, shield = null, w = 36 }) {
  const fill = `<div style="flex:none;width:${pct}%;height:100%;background:#4da6ff;${stops ? C.kf(W(stops)) : ""}"></div>`;
  const sh = shield ? `<div style="flex:none;width:${shield.pct}%;height:100%;background:${TEAL};${shield.stops ? C.kf(W(shield.stops)) : ""}"></div>` : "";
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:4px;border-radius:2px;background:#2a2e3a;overflow:hidden;display:flex;`, fill + sh);
}
// charge bar: cycles [{s, jump, hold}] fill white, turn yellow at s, drain by s+7
function barStops(cycles) {
  const w = [[0, "width:8%;background:#e8e8ee"]], g = [[0, "box-shadow:none"]];
  let prev = 8;
  for (const c of cycles) {
    if (c.jump) { w.push([c.s - 0.05, `width:${prev}%;background:#e8e8ee`]); }
    else { w.push([c.s - 0.1, "width:100%;background:#e8e8ee"]); }
    w.push([c.s, "width:100%;background:#ffcf4d"]);
    g.push([c.s - 0.05, "box-shadow:none"], [c.s, `box-shadow:0 0 6px 1px ${YEL}`]);
    if (c.hold) { w.push([96, "width:100%;background:#ffcf4d"], [100, "width:8%;background:#e8e8ee"]); g.push([96, `box-shadow:0 0 6px 1px ${YEL}`], [100, "box-shadow:none"]); prev = 8; }
    else { w.push([c.s + 1, "width:100%;background:#ffcf4d"], [c.s + 7, "width:0;background:#ffcf4d"], [c.s + 7.1, "width:0;background:#e8e8ee"]); g.push([c.s + 7, `box-shadow:0 0 6px 1px ${YEL}`], [c.s + 7.1, "box-shadow:none"]); prev = 0; }
  }
  if (!cycles.length || !cycles[cycles.length - 1].hold) { w.push([100, "width:8%;background:#e8e8ee"]); g.push([100, "box-shadow:none"]); }
  return { w, g };
}
function chargeBar(C, { cx, y, pct = 45, cycles = null, w = 36 }) {
  if (!cycles) return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;`, `<div style="width:${pct}%;height:100%;background:#e8e8ee;"></div>`);
  const b = barStops(cycles);
  return abs(`left:${cx - w / 2}px;top:${y}px;width:${w}px;height:3px;border-radius:2px;background:#2a2e3a;overflow:hidden;${C.kf(b.g)}`, `<div style="width:100%;height:100%;background:${YEL};${C.kf(b.w)}"></div>`);
}
// the skill bubble over a unit, with the streak from its bar and the border that runs round (as on 3.2 to 3.4)
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
const xEyes = (size) => `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"><path d="M20 38 L42 58 M42 38 L20 58 M58 38 L80 58 M80 38 L58 58" stroke="#14161c" stroke-width="8" stroke-linecap="round" fill="none"/></svg>`;
function captions(C, { gift, skill, skillColor, g = [4, 40], s = [50, 88] }) {
  const mk = (side, text, color, [a, b]) => abs(`${side}:12px;top:91px;font-size:8px;font-weight:800;letter-spacing:0.12em;color:${color};white-space:nowrap;z-index:2;opacity:0.9;${C.kf(OP([[0, 0.35], [a, 0.35], [a + 2, 1], [b, 1], [b + 2, 0.35], [100, 0.35]]))}`, text);
  return mk("left", `GIFT · ${gift.toUpperCase()}`, GOLD, g) + mk("right", `SKILL · ${skill.toUpperCase()}`, skillColor, s);
}

// standard cast
const WARDEN = { cx: 161, top: 10, size: 48 }, ACO_L = { cx: 81, top: 28, size: 30 }, ACO_R = { cx: 241, top: 28, size: 30 };
function enemy(C, o) {
  const { cx, top, size, name, hp, hpStops = null, hpPct = 100, dead = null, bodyAnim = "", badge = "" } = o;
  let faceSvg = villain(size, size > 40 ? 1.2 : 1);
  const wrap = dead ? `opacity:${dead.base};` : "";
  const wrapAnim = dead ? C.kf(dead.stops) : "";
  const overlay = dead ? `<div style="position:absolute;inset:0;${C.kf(dead.xStops)}opacity:1;">${xEyes(size)}</div>` : "";
  return body(C, { cx, top, size, bg: RED, faceSvg, alpha: 0.4, bodyAnim, wrapStyle: wrap, wrapAnim, overlay })
    + abs(`left:${cx - 50}px;top:${top + size + 3}px;width:100px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;`, name)
    + hpBar(C, { cx, y: top + size + 14, pct: hpPct, stops: hpStops, w: size })
    + abs(`left:${cx - 50}px;top:${top + size + 20}px;width:100px;text-align:center;font-size:7.5px;font-weight:700;color:#8a8fa3;`, hp)
    + badge;
}
// an ally: body, name and skill word, HP bar, charge bar
function ally(C, o) {
  const { cx, top, size, bg, hex, name, tag, tagColor, hpPct = 100, hpStops = null, shield = null, cycles = null, chargePct = 45, crown = false, faceSvg = null, bodyAnim = "", bodyStyle = "", wrapStyle = "", wrapAnim = "", labelHtml = null, overlay = "", hpW = 36 } = o;
  return body(C, { cx, top, size, bg, faceSvg: faceSvg || face(hex, size), alpha: size >= 40 ? 0.4 : 0.24, bodyAnim, bodyStyle, wrapStyle, wrapAnim, crown, overlay })
    + (labelHtml !== false ? nameLabel(cx, top + size + 2, labelHtml || `${name} · <span style="color:${tagColor}">${tag}</span>`) : "")
    + hpBar(C, { cx, y: top + size + 13, pct: hpPct, stops: hpStops, shield, w: hpW })
    + chargeBar(C, { cx, y: top + size + 18, pct: chargePct, cycles, w: hpW });
}
const heroAlly = (C, h, o) => ally(C, { bg: h.bg, hex: h.mainHex, name: h.key, tag: h.skill.name, tagColor: h.tileHex, crown: true, faceSvg: heroFace(h, o.size), ...o });
const eN = (C, o) => enemy(C, o);
const wardenE = (C, extra = {}) => eN(C, { ...WARDEN, name: "Warden", hp: "HP 210", ...extra });
const acoL = (C, extra = {}) => eN(C, { ...ACO_L, name: "Acolyte", hp: "HP 55", ...extra });
const acoR = (C, extra = {}) => eN(C, { ...ACO_R, name: "Acolyte", hp: "HP 55", ...extra });
const BRAM = { cx: 161, top: 114, size: 40, bg: ROLE.tank.hex, hex: ROLE.tank.hex, name: "Bram", tag: "Guard", tagColor: ROLE.tank.hex };
const IVY = { cx: 92, top: 151, size: 30, bg: ROLE.damage.hex, hex: ROLE.damage.hex, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex };
const SOL = { cx: 230, top: 151, size: 30, bg: ROLE.healer.hex, hex: ROLE.healer.hex, name: "Sol", tag: "Mend", tagColor: ROLE.healer.hex };
const WARDEN_C = [161, 34], ACOL_C = [81, 43], ACOR_C = [241, 43];
const ctr = (u) => [u.cx, u.top + u.size / 2];

// ---------- the ten scenes ----------
const SCENES = {
  Golem(C) {
    const g = { cx: 161, top: 114, size: 46 };
    const gc = [161, 114 + 23];
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, { ...BRAM, cx: 92, top: 151, size: 30, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex, bg: ROLE.damage.hex, hex: ROLE.damage.hex, chargePct: 30 });
    h += ally(C, { ...SOL });
    h += heroAlly(C, HEROES[0], { ...g, hpPct: 80, hpStops: [[0, 100], [8, 100], [10, 94], [12, 94], [14, 88], [16, 88], [18, 80], [100, 80]], shield: { pct: 20, stops: [[0, 0], [58, 0], [64, 20], [100, 20]] }, cycles: [{ s: 54 }], hpW: 46, chargePct: 45 });
    h += beam(C, { x1: 81, y1: 52, x2: 148, y2: 124, color: RED, at: 8 });
    h += beam(C, { x1: 161, y1: 60, x2: 161, y2: 112, color: RED, at: 11 });
    h += beam(C, { x1: 241, y1: 52, x2: 174, y2: 124, color: RED, at: 14 });
    h += floater(C, { x: 140, y: 112, text: "−8", color: "#e8e8ee", at: 9 }) + floater(C, { x: 161, y: 112, text: "−8", color: "#e8e8ee", at: 12 }) + floater(C, { x: 182, y: 112, text: "−8", color: "#e8e8ee", at: 15 });
    h += bubble(C, { cx: 161, top: 114, size: 46, text: "FORTIFY", color: ROLE.tank.hex, s: 54, barW: 46 });
    h += captions(C, { gift: "Taunt", skill: "Fortify", skillColor: ROLE.tank.hex, g: [4, 30], s: [50, 88] });
    return h;
  },
  Berserker(C) {
    const hero = HEROES[1], b = { cx: 161, top: 114, size: 42 };
    let h = acoL(C) + wardenE(C, { hpPct: 74, hpStops: [[0, 100], [64, 100], [68, 74], [100, 74]] }) + acoR(C);
    h += ally(C, { ...IVY }) + ally(C, { ...SOL });
    h += heroAlly(C, hero, { ...b, hpPct: 45, hpStops: [[0, 100], [8, 100], [10, 82], [18, 82], [20, 64], [26, 64], [28, 45], [100, 45]], cycles: [{ s: 56 }], bodyAnim: C.kf([[0, "box-shadow:none"], [20, "box-shadow:none"], [30, `box-shadow:0 0 0 3px #ff5252,0 0 14px 4px rgba(255,82,82,0.75)`], [100, `box-shadow:0 0 0 3px #ff5252,0 0 14px 4px rgba(255,82,82,0.75)`]]), bodyStyle: "box-shadow:0 0 0 3px #ff5252,0 0 14px 4px rgba(255,82,82,0.75);" });
    h += abs(`left:190px;top:128px;z-index:2;font-size:8px;font-weight:800;color:#ff8d8d;background:#2a2e3a;border:1px solid #ff5252;border-radius:8px;padding:1px 5px;white-space:nowrap;${C.kf(OP([[0, 0], [28, 0], [30, 1], [100, 1]]))}`, "RAGE +55%");
    h += abs(`left:188px;top:142px;font-size:8px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf(OP([[0, 1], [28, 1], [30, 0], [100, 0]]))}opacity:0;`, "Damage 14")
      + abs(`left:188px;top:142px;font-size:8px;font-weight:800;color:#ff8d8d;white-space:nowrap;${C.kf(OP([[0, 0], [28, 0], [30, 1], [100, 1]]))}`, "Damage 22");
    for (const [at, t, fx] of [[8, "−60", 126], [18, "−60", 161], [26, "−60", 196]]) h += beam(C, { x1: 161, y1: 60, x2: 161, y2: 112, color: RED, at }) + floater(C, { x: fx, y: 114, text: t, color: "#e8e8ee", at: at + 1 });
    h += beam(C, { x1: 161, y1: 135, x2: 161, y2: 58, color: ROLE.tank.hex, at: 61, w: 4 });
    h += floater(C, { x: 214, y: 34, text: "−55", color: "#ffd9b0", at: 62, size: 20, glow: ROLE.tank.hex });
    h += bubble(C, { cx: 161, top: 114, size: 42, text: "CLEAVE", color: ROLE.tank.hex, s: 56 });
    h += captions(C, { gift: "Rage", skill: "Cleave", skillColor: ROLE.tank.hex, g: [4, 40], s: [52, 88] });
    return h;
  },
  Paladin(C) {
    const hero = HEROES[2], p = { cx: 161, top: 114, size: 42 };
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, { ...IVY, hpPct: 80, hpStops: [[0, 70], [10, 70], [13, 74], [22, 74], [25, 78], [100, 78]], shield: { pct: 20, stops: [[0, 0], [60, 0], [66, 20], [100, 20]] } });
    h += ally(C, { ...SOL, hpPct: 86, hpStops: [[0, 80], [10, 80], [13, 84], [22, 84], [25, 88], [100, 88]], shield: { pct: 12, stops: [[0, 0], [60, 0], [66, 12], [100, 12]] } });
    h += heroAlly(C, hero, { ...p, hpPct: 84, hpStops: [[0, 100], [10, 100], [12, 92], [22, 92], [24, 84], [100, 84]], shield: { pct: 16, stops: [[0, 0], [58, 0], [64, 16], [100, 16]] }, cycles: [{ s: 54 }] });
    for (const at of [10, 22]) {
      h += beam(C, { x1: 161, y1: 60, x2: 161, y2: 112, color: RED, at }) + floater(C, { x: 161, y: 112, text: "−24", color: "#e8e8ee", at: at + 1 });
      h += beam(C, { x1: 150, y1: 140, x2: 100, y2: 158, color: ROLE.healer.hex, at: at + 2, w: 1.5 }) + beam(C, { x1: 172, y1: 140, x2: 222, y2: 158, color: ROLE.healer.hex, at: at + 2, w: 1.5 });
      h += floater(C, { x: 92, y: 146, text: "+3", color: ROLE.healer.hex, at: at + 3, size: 12, glow: "#1b8a55" }) + floater(C, { x: 230, y: 146, text: "+3", color: ROLE.healer.hex, at: at + 3, size: 12, glow: "#1b8a55" });
    }
    for (const [cx, cy, r] of [[161, 135, 24], [92, 166, 19], [230, 166, 19]]) h += ring(C, { cx, cy, r, color: TEAL, at: 60 });
    h += bubble(C, { cx: 161, top: 114, size: 42, text: "BLESS", color: ROLE.tank.hex, s: 54 });
    h += captions(C, { gift: "Martyr", skill: "Bless", skillColor: ROLE.tank.hex, g: [4, 34], s: [50, 88] });
    return h;
  },
  Assassin(C) {
    const hero = HEROES[3];
    let h = acoL(C, { hp: "HP 12", hpPct: 22, hpStops: [[0, 22], [100, 22]], dead: { base: 0.3, stops: [[0, "opacity:1"], [23, "opacity:1"], [24, "opacity:0.3"], [100, "opacity:0.3"]], xStops: [[0, "opacity:0"], [23, "opacity:0"], [24, "opacity:1"], [100, "opacity:1"]] } });
    h += wardenE(C);
    h += acoR(C, { dead: { base: 0.3, stops: [[0, "opacity:1"], [33, "opacity:1"], [34, "opacity:0.3"], [100, "opacity:0.3"]], xStops: [[0, "opacity:0"], [33, "opacity:0"], [34, "opacity:1"], [100, "opacity:1"]] }, hpStops: [[0, 100], [30, 100], [33, 0], [100, 0]], hpPct: 0 });
    h += ally(C, { ...BRAM, chargePct: 50 }) + ally(C, { ...SOL });
    h += heroAlly(C, hero, { cx: 92, top: 151, size: 30, cycles: [{ s: 24, jump: true }, { s: 34, jump: true, hold: true }] });
    h += beam(C, { x1: 150, y1: 120, x2: 90, y2: 52, color: ROLE.tank.hex, at: 19 }) + floater(C, { x: 86, y: 40, text: "−12", color: "#e8e8ee", at: 20 });
    h += floater(C, { x: 44, y: 164, text: "KILL → FULL BAR", color: YEL, at: 24, size: 9, glow: "#7a5c10" });
    h += beam(C, { x1: 92, y1: 163, x2: 238, y2: 52, color: ROLE.damage.hex, at: 29, w: 3 }) + floater(C, { x: 232, y: 40, text: "−60", color: "#ffe6ff", at: 30, size: 17, glow: ROLE.damage.hex });
    h += floater(C, { x: 44, y: 164, text: "KILL → FULL BAR", color: YEL, at: 34, size: 9, glow: "#7a5c10" });
    h += bubble(C, { cx: 92, top: 151, size: 30, text: "EXECUTE", color: ROLE.damage.hex, s: 24 });
    h += captions(C, { gift: "Bloodlust", skill: "Execute", skillColor: ROLE.damage.hex, g: [16, 36], s: [24, 60] });
    return h;
  },
  Dragon(C) {
    const hero = HEROES[4];
    const stage = (a, b, text) => abs(`left:${100 - 55}px;top:${151 + 36 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf((win(a, b, 1)))}`, text);
    let h = acoL(C, { hpPct: 55, hpStops: [[0, 100], [68, 100], [72, 55], [100, 55]] }) + wardenE(C, { hpPct: 86, hpStops: [[0, 100], [10, 100], [13, 97], [68, 97], [72, 83], [100, 83]] }) + acoR(C, { hpPct: 55, hpStops: [[0, 100], [68, 100], [72, 55], [100, 55]] });
    h += ally(C, { ...BRAM, chargePct: 50 });
    h += body(C, { cx: 100, top: 147, size: 36, bg: hero.bg, faceSvg: heroFace(hero, 36), alpha: 0.24, crown: true, wrapStyle: "transform:scale(1);", wrapAnim: C.kf([[0, "transform:scale(0.62)"], [28, "transform:scale(0.62)"], [31, "transform:scale(0.82)"], [56, "transform:scale(0.82)"], [59, "transform:scale(1)"], [100, "transform:scale(1)"]]) });
    h += abs(`left:45px;top:${151 + 36 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf((win(0, 29, 1)))}opacity:0;`, "Dragon · <span style=\"color:" + GOLD + "\">Baby</span>");
    h += abs(`left:45px;top:${151 + 36 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf((win(31, 57, 1)))}opacity:0;`, "Dragon · <span style=\"color:" + GOLD + "\">Young</span> · 4 wins");
    h += abs(`left:45px;top:${151 + 36 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf(win(59, 99, 1))}`, "Dragon · <span style=\"color:" + GOLD + "\">Adult</span> · 8 wins");
    h += chargeBar(C, { cx: 100, y: 151 + 36 + 18, cycles: [{ s: 64 }] }) + hpBar(C, { cx: 100, y: 151 + 36 + 13 });
    h += beam(C, { x1: 100, y1: 160, x2: 155, y2: 54, color: ROLE.damage.hex, at: 12, w: 1.5, dur: 8 }) + floater(C, { x: 118, y: 40, text: "−6", color: "#e8e8ee", at: 13, size: 11 });
    h += floater(C, { x: 46, y: 152, text: "STAGE UP", color: GOLD, at: 28, size: 9, glow: "#7a5c10" }) + floater(C, { x: 46, y: 152, text: "STAGE UP", color: GOLD, at: 56, size: 9, glow: "#7a5c10" });
    for (const [t, x, y, fx] of [[69, 83, 56, 74], [69, 161, 60, 150], [69, 237, 56, 232]]) h += beam(C, { x1: 100, y1: 165, x2: x, y2: y - 12, color: ROLE.damage.hex, at: t, w: 3 });
    h += floater(C, { x: 52, y: 36, text: "−30", color: "#ffe6ff", at: 70, size: 13, glow: ROLE.damage.hex }) + floater(C, { x: 208, y: 16, text: "−30", color: "#ffe6ff", at: 70, size: 13, glow: ROLE.damage.hex }) + floater(C, { x: 272, y: 38, text: "−30", color: "#ffe6ff", at: 70, size: 13, glow: ROLE.damage.hex });
    h += bubble(C, { cx: 100, top: 147, size: 36, text: "BREATH", color: ROLE.damage.hex, s: 64 });
    h += captions(C, { gift: "Growth", skill: "Breath", skillColor: ROLE.damage.hex, g: [4, 60], s: [62, 92] });
    return h;
  },
  Necromancer(C) {
    const hero = HEROES[5];
    const skel = (cx, top, size, extraAnim = "", base = "") => abs(`left:${cx - size / 2}px;top:${top}px;width:${size}px;height:${size}px;${base}${extraAnim}`,
      shadow(size, 0.24) + `<div style="position:absolute;inset:0;border-radius:50%;background:${BONE};"><svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"><ellipse cx="32" cy="46" rx="13" ry="15" fill="#14161c"/><ellipse cx="68" cy="46" rx="13" ry="15" fill="#14161c"/><path d="M30 76 H70 M38 70 V82 M50 70 V82 M62 70 V82" stroke="#14161c" stroke-width="5" stroke-linecap="round"/></svg></div>`);
    let h = acoL(C, { dead: { base: 0.3, stops: [[0, "opacity:1"], [14, "opacity:1"], [15, "opacity:0.3"], [100, "opacity:0.3"]], xStops: [[0, "opacity:0"], [14, "opacity:0"], [15, "opacity:1"], [100, "opacity:1"]] }, hpPct: 0, hpStops: [[0, 100], [11, 100], [14, 0], [100, 0]] });
    h += wardenE(C, { hpPct: 92, hpStops: [[0, 100], [58, 100], [62, 92], [100, 92]] }) + acoR(C);
    h += ally(C, { ...BRAM, chargePct: 50 });
    h += heroAlly(C, hero, { cx: 108, top: 151, size: 30, cycles: [{ s: 50 }] });
    h += skel(224, 128, 22, "", "") + abs(`left:194px;top:151px;width:60px;text-align:center;font-size:7px;font-weight:700;color:#c7cad6;`, "Skeleton");
    h += skel(268, 150, 22, C.kf([[0, "opacity:0;transform:scale(0.2)"], [20, "opacity:0;transform:scale(0.2)"], [24, "opacity:1;transform:scale(1.15)"], [27, "opacity:1;transform:scale(1)"], [100, "opacity:1;transform:scale(1)"]]), "") + abs(`left:238px;top:173px;width:60px;text-align:center;font-size:7px;font-weight:700;color:#c7cad6;`, "Skeleton");
    h += beam(C, { x1: 150, y1: 120, x2: 88, y2: 52, color: ROLE.tank.hex, at: 9 }) + floater(C, { x: 86, y: 40, text: "−55", color: "#e8e8ee", at: 10 });
    h += beam(C, { x1: 83, y1: 46, x2: 266, y2: 158, color: "#8fe0b0", at: 16, w: 1.5, dur: 9 });
    h += floater(C, { x: 268, y: 138, text: "RISES", color: BONE, at: 22, size: 9, glow: "#1b8a55" });
    h += beam(C, { x1: 224, y1: 139, x2: 168, y2: 58, color: BONE, at: 57, w: 2 }) + beam(C, { x1: 268, y1: 161, x2: 172, y2: 56, color: BONE, at: 57, w: 2 });
    h += floater(C, { x: 150, y: 28, text: "−8", color: "#e8e8ee", at: 58, size: 12 }) + floater(C, { x: 176, y: 28, text: "−8", color: "#e8e8ee", at: 59, size: 12 });
    h += bubble(C, { cx: 108, top: 151, size: 30, text: "HORDE", color: ROLE.damage.hex, s: 50 });
    h += captions(C, { gift: "Raise", skill: "Horde", skillColor: ROLE.damage.hex, g: [6, 34], s: [48, 88] });
    return h;
  },
  Priest(C) {
    const hero = HEROES[6];
    let h = acoL(C) + wardenE(C, { hpPct: 80, hpStops: [[0, 100], [10, 100], [13, 97], [58, 97], [66, 80], [100, 80]] }) + acoR(C);
    h += ally(C, { ...BRAM, hpPct: 85, hpStops: [[0, 55], [10, 55], [13, 61], [58, 61], [64, 85], [100, 85]], chargePct: 50 });
    h += ally(C, { ...SOL, cx: 230, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex, bg: ROLE.damage.hex, hex: ROLE.damage.hex, hpPct: 90, hpStops: [[0, 70], [58, 70], [64, 90], [100, 90]] });
    h += heroAlly(C, hero, { cx: 92, top: 151, size: 32, hpPct: 100, cycles: [{ s: 50 }] });
    h += beam(C, { x1: 100, y1: 160, x2: 152, y2: 142, color: ROLE.healer.hex, at: 10, w: 1.5 }) + floater(C, { x: 136, y: 112, text: "+6", color: ROLE.healer.hex, at: 12, size: 12, glow: "#1b8a55" });
    h += beam(C, { x1: 100, y1: 160, x2: 158, y2: 56, color: GOLD, at: 10, w: 1.5 }) + floater(C, { x: 118, y: 40, text: "−6", color: GOLD, at: 12, size: 12, glow: "#7a5c10" });
    h += beam(C, { x1: 100, y1: 162, x2: 152, y2: 142, color: ROLE.healer.hex, at: 57, w: 2 }) + beam(C, { x1: 100, y1: 166, x2: 224, y2: 166, color: ROLE.healer.hex, at: 57, w: 2 });
    h += floater(C, { x: 161, y: 108, text: "+14", color: ROLE.healer.hex, at: 58, size: 13, glow: "#1b8a55" }) + floater(C, { x: 230, y: 143, text: "+14", color: ROLE.healer.hex, at: 58, size: 13, glow: "#1b8a55" }) + floater(C, { x: 62, y: 164, text: "+14", color: ROLE.healer.hex, at: 58, size: 13, glow: "#1b8a55" });
    for (const [i, at] of [57, 60, 63].entries()) h += beam(C, { x1: 100, y1: 160, x2: 150 + i * 11, y2: 56, color: GOLD, at, w: 2 }) + floater(C, { x: 204 + (i % 2) * 14, y: 22 + i * 12, text: "−14", color: GOLD, at: at + 1, size: 12, glow: "#7a5c10" });
    h += bubble(C, { cx: 92, top: 151, size: 32, text: "PRAYER", color: ROLE.healer.hex, s: 50 });
    h += captions(C, { gift: "Radiance", skill: "Prayer", skillColor: ROLE.healer.hex, g: [4, 32], s: [48, 88] });
    return h;
  },
  Treant(C) {
    const hero = HEROES[7];
    const heal = (a, b, t, col) => abs(`left:${92 - 55}px;top:${151 + 32 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf((win(a, b, 1)))}${col || ""}`, t);
    const clock = (a, b, t) => abs(`left:143px;top:92px;width:36px;text-align:center;font-size:8px;font-weight:800;color:#c7cad6;background:#2a2e3a;border:1px solid #3a3f4e;border-radius:8px;padding:0 3px;box-sizing:border-box;z-index:2;${C.kf((win(a, b, 1)))}${a === 38 ? "" : "opacity:0;"}`, t);
    let h = acoL(C) + wardenE(C) + acoR(C);
    h += ally(C, { ...BRAM, hpPct: 70, hpStops: [[0, 40], [8, 40], [10, 43], [24, 43], [26, 49], [40, 49], [42, 59], [62, 59], [68, 70], [100, 70]], chargePct: 50 });
    h += ally(C, { ...SOL, cx: 230, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex, bg: ROLE.damage.hex, hex: ROLE.damage.hex, hpPct: 80, hpStops: [[0, 60], [62, 60], [68, 80], [100, 80]] });
    h += heroAlly(C, hero, { cx: 92, top: 151, size: 32, labelHtml: false, cycles: [{ s: 62 }], bodyAnim: C.kf([[0, "box-shadow:0 0 0 0 rgba(110,231,160,0)"], [10, "box-shadow:0 0 0 1px rgba(110,231,160,0.6)"], [26, "box-shadow:0 0 0 3px rgba(110,231,160,0.7)"], [42, "box-shadow:0 0 0 5px rgba(110,231,160,0.8)"], [100, "box-shadow:0 0 0 5px rgba(110,231,160,0.8)"]]), bodyStyle: "box-shadow:0 0 0 5px rgba(110,231,160,0.8);" });
    h += heal(0, 22, "Treant · <span style=\"color:" + GOLD + "\">Heal 3</span>", "opacity:0;") + heal(22, 40, "Treant · <span style=\"color:" + GOLD + "\">Heal 6</span>", "opacity:0;") + heal(40, 99, "Treant · <span style=\"color:" + GOLD + "\">Heal 10</span>");
    h += clock(0, 22, "0:05") + clock(22, 38, "0:15") + clock(38, 99, "0:25");
    for (const [at, t, fx] of [[8, "+3", 120], [24, "+6", 140], [40, "+10", 161]]) h += beam(C, { x1: 100, y1: 162, x2: 152, y2: 142, color: ROLE.healer.hex, at, w: 1.5 }) + floater(C, { x: fx, y: 108, text: t, color: ROLE.healer.hex, at: at + 2, size: 12, glow: "#1b8a55" });
    h += beam(C, { x1: 100, y1: 162, x2: 152, y2: 142, color: ROLE.healer.hex, at: 67, w: 2 }) + beam(C, { x1: 100, y1: 166, x2: 224, y2: 166, color: ROLE.healer.hex, at: 67, w: 2 });
    h += floater(C, { x: 192, y: 112, text: "+10", color: ROLE.healer.hex, at: 68, size: 13, glow: "#1b8a55" }) + floater(C, { x: 230, y: 143, text: "+10", color: ROLE.healer.hex, at: 68, size: 13, glow: "#1b8a55" }) + floater(C, { x: 62, y: 164, text: "+10", color: ROLE.healer.hex, at: 68, size: 13, glow: "#1b8a55" });
    h += bubble(C, { cx: 92, top: 151, size: 32, text: "BLOOM", color: ROLE.healer.hex, s: 62 });
    h += captions(C, { gift: "Rooted", skill: "Bloom", skillColor: ROLE.healer.hex, g: [4, 52], s: [60, 94] });
    return h;
  },
  Vampire(C) {
    const hero = HEROES[8];
    const leech = (cx, y, at) => floater(C, { x: cx, y, text: "+1", color: "#ff8fb0", at, size: 13, glow: "#a3203f" });
    let h = acoL(C) + wardenE(C, { hpPct: 81, hpStops: [[0, 100], [10, 100], [13, 97], [18, 97], [21, 93], [54, 93], [60, 81], [100, 81]] }) + acoR(C);
    h += ally(C, { ...BRAM, hpPct: 85, hpStops: [[0, 65], [10, 65], [12, 67], [62, 67], [68, 85], [100, 85]], chargePct: 50 });
    h += ally(C, { ...SOL, cx: 230, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex, bg: ROLE.damage.hex, hex: ROLE.damage.hex, hpPct: 95, hpStops: [[0, 75], [18, 75], [20, 77], [62, 77], [68, 95], [100, 95]] });
    h += heroAlly(C, hero, { cx: 92, top: 151, size: 30, hpPct: 100, cycles: [{ s: 48 }] });
    h += beam(C, { x1: 161, y1: 135, x2: 161, y2: 58, color: ROLE.tank.hex, at: 8, w: 1.5 }) + floater(C, { x: 206, y: 24, text: "−7", color: "#e8e8ee", at: 9, size: 11 }) + leech(161, 108, 10);
    h += beam(C, { x1: 230, y1: 166, x2: 168, y2: 58, color: ROLE.damage.hex, at: 18, w: 1.5 }) + floater(C, { x: 118, y: 34, text: "−8", color: "#e8e8ee", at: 19, size: 11 }) + leech(230, 143, 20);
    h += beam(C, { x1: 100, y1: 160, x2: 158, y2: 56, color: "#ff5d8f", at: 53, w: 3 }) + floater(C, { x: 208, y: 20, text: "−24", color: "#ffd0dc", at: 54, size: 17, glow: "#ff5d8f" });
    h += beam(C, { x1: 161, y1: 58, x2: 161, y2: 118, color: ROLE.healer.hex, at: 58, w: 1.5 }) + beam(C, { x1: 165, y1: 58, x2: 228, y2: 150, color: ROLE.healer.hex, at: 58, w: 1.5 }) + beam(C, { x1: 157, y1: 58, x2: 96, y2: 150, color: ROLE.healer.hex, at: 58, w: 1.5 });
    h += floater(C, { x: 161, y: 108, text: "+8", color: ROLE.healer.hex, at: 60, size: 12, glow: "#1b8a55" }) + floater(C, { x: 230, y: 143, text: "+8", color: ROLE.healer.hex, at: 60, size: 12, glow: "#1b8a55" }) + floater(C, { x: 62, y: 164, text: "+8", color: ROLE.healer.hex, at: 60, size: 12, glow: "#1b8a55" });
    h += bubble(C, { cx: 92, top: 151, size: 30, text: "BITE", color: ROLE.healer.hex, s: 48 });
    h += captions(C, { gift: "Leech", skill: "Bite", skillColor: ROLE.healer.hex, g: [4, 30], s: [46, 88] });
    return h;
  },
  Twin(C) {
    const hero = HEROES[9];
    const lab = (a, b, t, base) => abs(`left:151px;top:${151 + 30 + 2}px;width:110px;text-align:center;font-size:8.5px;font-weight:700;color:#e8e8ee;white-space:nowrap;${C.kf((win(a, b, 1)))}${base ? "" : "opacity:0;"}`, t);
    let h = acoL(C) + wardenE(C, { hpPct: 83, hpStops: [[0, 100], [52, 100], [55, 91], [58, 91], [61, 83], [100, 83]] }) + acoR(C);
    h += ally(C, { cx: 100, top: 151, size: 30, bg: ROLE.damage.hex, hex: ROLE.damage.hex, name: "Ivy", tag: "Expose", tagColor: ROLE.damage.hex, cycles: [{ s: 46 }] });
    h += heroAlly(C, hero, { cx: 206, top: 151, size: 30, labelHtml: false, cycles: [{ s: 50 }] });
    h += lab(0, 27, "Twin · <span style=\"color:" + GOLD + "\">Mirror</span>", false) + lab(27, 99, "Twin · <span style=\"color:" + ROLE.damage.hex + "\">Expose</span>", true);
    h += `<svg width="322" height="210" viewBox="0 0 322 210" style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:2;"><path d="M118,160 Q153,140 188,160" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-dasharray="3 3" style="${C.kf(OP([[0, 0], [12, 0], [16, 1], [100, 1]]))}"/></svg>`;
    h += abs(`left:123px;top:164px;width:60px;text-align:center;font-size:7.5px;font-weight:800;letter-spacing:0.1em;color:${GOLD};z-index:2;${C.kf(OP([[0, 0], [14, 0], [18, 1], [100, 1]]))}`, "COPIES");
    h += abs(`left:228px;top:160px;font-size:7.5px;font-weight:800;color:${ROLE.damage.hex};background:#2a2e3a;border:1px solid ${ROLE.damage.hex};border-radius:8px;padding:0 5px;white-space:nowrap;z-index:2;${C.kf(OP([[0, 0], [24, 0], [28, 1], [100, 1]]))}`, "counts as Damage");
    h += beam(C, { x1: 100, y1: 163, x2: 156, y2: 56, color: ROLE.damage.hex, at: 51, w: 2 }) + floater(C, { x: 118, y: 40, text: "−18", color: "#ffe6ff", at: 52, size: 12, glow: ROLE.damage.hex });
    h += beam(C, { x1: 206, y1: 163, x2: 168, y2: 56, color: ROLE.damage.hex, at: 55, w: 2 }) + floater(C, { x: 204, y: 40, text: "−18", color: "#ffe6ff", at: 56, size: 12, glow: ROLE.damage.hex });
    h += abs(`left:171px;top:54px;z-index:3;font-size:8px;font-weight:800;padding:0 4px;border-radius:8px;border:1px solid ${PINK};color:${PINK};background:#2a2e3a;white-space:nowrap;${C.kf(OP([[0, 0], [51, 0], [52, 1], [100, 1]]))}`, "✦1");
    h += abs(`left:171px;top:54px;z-index:4;font-size:8px;font-weight:800;padding:0 4px;border-radius:8px;border:1px solid ${PINK};color:${PINK};background:#2a2e3a;white-space:nowrap;${C.kf(OP([[0, 0], [55, 0], [56, 1], [100, 1]]))}`, "✦2");
    h += bubble(C, { cx: 100, top: 151, size: 30, text: "EXPOSE", color: ROLE.damage.hex, s: 46 }) + bubble(C, { cx: 206, top: 151, size: 30, text: "EXPOSE", color: ROLE.damage.hex, s: 50 });
    h += captions(C, { gift: "Mirror", skill: "Echo", skillColor: ROLE.damage.hex, g: [4, 40], s: [44, 90] });
    return h;
  },
};

// ---------- card (9.x) ----------
function cardFile(h) {
  const ex = read("TermExpose.dc.html");
  const css = ex.slice(ex.indexOf("<style>") + 7, ex.indexOf("</style>")).split("\n")
    .filter((l) => !(l.trim().startsWith("@keyframes") && !l.includes("bossPulse")) && !l.includes("Term card: Expose") && !l.includes(".scene { --T"))
    .join("\n");
  const start = ex.indexOf('<div style="position: relative; background: #14161c; width: 390px');
  const end = ex.indexOf("<!-- the term card -->");
  const C = makeCtx(`h${h.n}k`);
  const scene = SCENES[h.key](C);
  const sk = h.tileHex;
  const row = (rgb, hexv, ico, name, tag, text) => `
    <div style="margin-top:8px;border:1px solid rgba(${rgb},0.45);background:rgba(${rgb},0.07);border-radius:10px;padding:8px 10px;">
      <div style="display:flex;align-items:center;gap:7px;">${svg(I[ico](hexv), 18)}<span style="font-size:16px;font-weight:800;color:${hexv};">${name}</span><span style="margin-left:auto;font-size:8.5px;font-weight:800;letter-spacing:0.14em;color:${hexv};border:1px solid rgba(${rgb},0.55);border-radius:4px;padding:1px 5px;">${tag}</span></div>
      <div style="font-size:12.5px;line-height:1.45;color:#e8e8ee;margin-top:4px;">${text}</div>
    </div>`;
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

${ex.slice(start, end)}<!-- the hero skill card -->
  <div style="position: absolute; top: 118px; left: 20px; width: 350px; background: #1d2029; border: 1px solid #3a3f4e; border-radius: 14px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.55);">
    <div style="position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: #2a2e3a; color: #c7cad6; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; z-index: 2;">✕</div>
    <div style="position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; color: ${GOLD};">${svg(I.crown(), 14)}${h.key.toUpperCase()} · HERO</div>

    <!-- the scene: gift first, then skill; the key moment is the plain style -->
    <div class="scene" style="position: relative; width: 322px; height: 210px; margin-top: 26px; background: #14161c; border: 1px solid #2a2e3a; border-radius: 10px; overflow: hidden;">
      <div style="position: absolute; top: 104px; left: 16px; right: 16px; height: 1px; background: linear-gradient(90deg, transparent, #3a3f4e, transparent);"></div>
${scene}
    </div>

    <div style="font-size: 10.5px; color: #8a8fa3; text-align: center; margin-top: 8px;">When its bar is full, a unit uses its skill.</div>
${row(GOLD_RGB, GOLD, h.gift.icon, h.gift.name, "GIFT", terms(h.gift.card, false))}
${row(h.tileRgb, sk, h.skill.icon, h.skill.name, "SKILL", terms(h.skill.card, false))}
    <button style="margin-top: 14px; width: 100%; font: inherit; font-weight: 700; background: #4da6ff; color: #0c1420; border: none; border-radius: 8px; padding: 12px; font-size: 15px;">Got it</button>
  </div>

  <!-- design note, not part of the screen -->
  <div style="position: absolute; left: 20px; right: 20px; bottom: 14px; font-size: 10.5px; line-height: 1.45; color: #8a8fa3; text-align: center;">
    Opened from the "See ${h.skill.name} in action" row on ${h.key}'s skill tile (8.${h.n}); the screen behind is a stand-in. The loop shows the gift first, then the skill; the still shows the skill's moment. Closes on ✕, Got it, or a tap outside the card.
  </div>
</div>
</x-dc>
</body>
</html>
`;
}

// ---------- write files and patch canvas.json ----------
for (const h of HEROES) {
  fs.writeFileSync(path.join(CANVAS, `HeroPopup${h.key}.dc.html`), popupFile(h));
  fs.writeFileSync(path.join(CANVAS, `HeroSkill${h.key}.dc.html`), cardFile(h));
}
const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/HeroPopup|HeroSkill|"id": "(label-hero|section-hero)/.test(l));
// a rerun leaves the blank line that preceded the old block: drop blanks that lead into another blank or a closing bracket
lines = lines.filter((l, i, a) => !(l.trim() === "" && (a[i + 1] === undefined || a[i + 1].trim() === "" || /^\s*\]/.test(a[i + 1]))));
const Y1 = 9100, Y2 = 10400;
const boards = [];
HEROES.forEach((h, i) => {
  boards.push(`    { "file": "HeroPopup${h.key}.dc.html", "x": ${i * 550}, "y": ${Y1}, "w": 390, "h": 900 },`);
});
HEROES.forEach((h, i) => {
  boards.push(`    { "file": "HeroSkill${h.key}.dc.html", "x": ${i * 550}, "y": ${Y2}, "w": 390, "h": 900 },`);
});
const notes = [];
notes.push(`    { "id": "section-heroes-popup", "x": 0, "y": ${Y1 - 140}, "w": 5890, "text": "8 · HERO POPUPS — three units merge into one hero: its recipe, a gift that is always on, and a skill (proposal, design only, not built)" },`);
HEROES.forEach((h, i) => notes.push(`    { "id": "label-hero-popup-${h.key.toLowerCase()}", "x": ${i * 550}, "y": ${Y1 - 60}, "w": 390, "text": "8.${h.n} ${h.key} — ${h.recipe.map((r) => ROLE[r].word).join(" + ")}, ${h.row.toLowerCase()} row (proposal)" },`));
notes.push(`    { "id": "section-heroes-card", "x": 0, "y": ${Y2 - 140}, "w": 5890, "text": "9 · HERO SKILL CARDS — the 'See … in action' row on a hero's skill tile; each loop shows the gift first, then the skill" },`);
HEROES.forEach((h, i) => notes.push(`    { "id": "label-hero-card-${h.key.toLowerCase()}", "x": ${i * 550}, "y": ${Y2 - 60}, "w": 390, "text": "9.${h.n} ${h.skill.name} — ${h.key}'s gift ${h.gift.name}, then its skill (proposal)" },`));
const iArt = lines.findIndex((l) => l.includes('"annotations"'));
// the line before "annotations" is "  ],": insert boards before it
lines.splice(iArt - 1, 0, "", ...boards.map((l, i) => (i === boards.length - 1 ? l.replace(/,$/, "") : l)));
// fix the previous last artboard line to end with a comma
for (let i = iArt - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
const iLaunch = lines.findIndex((l) => l.includes('"launch"'));
lines.splice(iLaunch - 1, 0, ...notes.map((l, i) => (i === notes.length - 1 ? l.replace(/,$/, "") : l)));
for (let i = iLaunch - 2; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
fs.writeFileSync(cj, lines.join("\n"));
JSON.parse(fs.readFileSync(cj, "utf8")); // throws if the patch broke the file
console.log("wrote", HEROES.length * 2, "frames and patched canvas.json");
