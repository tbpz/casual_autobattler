// Generates canvas frame 8.0, the merge pick (2026-10-20, built on branch dev/merge-heroes): the reward screen after a mini-boss win.
//   node design/tools/gen-merge-pick.js     (writes HeroMergePick.dc.html and patches canvas.json)
// It draws what prototype/src/render/mergeScreen.ts builds: four of the seven rows the squad of the scene can make (the real screen lists
// every hero the roster can make and scrolls), each a gold rail with the hero's own body, name, FRONT or BACK, the recipe, the gift and
// skill in one line each, and the three units it would use. The wording is sim/heroes.ts's HERO_TEXT (the same lines gen-heroes.js draws).

const fs = require("fs");
const path = require("path");
const faces = require("./faces.js");

const CANVAS = path.join(__dirname, "..", "canvas");
const GOLD = "#ffd76a";
const PIECE = { tank: ["#ffb454", "Tank"], damage: ["#b98cff", "Damage"], healer: ["#6ee7a0", "Healer"] };

let uidN = 0;
const uniq = (svg) => { const p = "m" + (uidN++) + "_"; return svg.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`); };
const face = (hex, size) => uniq(faces.squadFace(hex, "fresh", size));

const crown = (px) => `<svg width="${px}" height="${(px * 0.9).toFixed(1)}" viewBox="0 0 24 22" style="position:absolute;left:30%;top:${(-px * 0.6).toFixed(1)}px;transform:translateX(-50%) rotate(-18deg);overflow:visible;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.55));"><path d="M3 17 L2 6.5 L8 11.5 L12 4 L16 11.5 L22 6.5 L21 17 Z" fill="${GOLD}" stroke="#7a5c10" stroke-width="1.2" stroke-linejoin="round"/><rect x="3" y="18" width="18" height="2.6" rx="1" fill="${GOLD}" stroke="#7a5c10" stroke-width="0.8"/></svg>`;

function bodyBg(recipe) {
  const cs = recipe.map((r) => PIECE[r][0]);
  const counts = {};
  for (const c of cs) counts[c] = (counts[c] || 0) + 1;
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (keys.length === 1) return keys[0];
  if (keys.length === 2) return `linear-gradient(135deg, ${keys[0]} 0 62%, ${keys[1]} 62% 100%)`;
  return `conic-gradient(from 30deg, ${cs[0]} 0 33.3%, ${cs[1]} 33.3% 66.6%, ${cs[2]} 66.6% 100%)`;
}
const mainHex = (recipe) => {
  const counts = {};
  for (const r of recipe) counts[r] = (counts[r] || 0) + 1;
  return PIECE[Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]][0];
};

const term = (cls, text) => `<span style="font-weight:700;color:${cls};">${text}</span>`;
const ROWS = [
  { name: "Berserker", recipe: ["tank", "tank", "damage"], front: true, gift: ["Rage", "The more hurt it is, the harder it hits."], skill: ["Cleave", "A big swing at the front enemy."], uses: "Nell, Kit and Rook" },
  { name: "Paladin", recipe: ["tank", "tank", "healer"], front: true, gift: ["Martyr", "Every hit it takes heals your other units a little."], skill: ["Bless", `Gives every unit a ${term("#5ee0d0", "shield")}.`], uses: "Nell, Kit and Mira" },
  { name: "Dragon", recipe: ["damage", "damage", "tank"], front: false, gift: ["Growth", "Grows a stage every 4 fights it wins."], skill: ["Breath", "Breathes on the enemy."], uses: "Rook, Juno and Nell" },
  { name: "Necromancer", recipe: ["damage", "damage", "healer"], front: false, gift: ["Raise", "Anyone who dies, yours or theirs, rises as a skeleton."], skill: ["Horde", "Every skeleton strikes at once."], uses: "Rook, Juno and Mira" },
];

const row = (r) => {
  const hex = mainHex(r.recipe);
  const recipe = r.recipe.map((p) => `<span style="color:${PIECE[p][0]};font-weight:800;">${PIECE[p][1]}</span>`).join(' <span style="color:#8a8fa3;">+</span> ');
  return `<div style="display:flex;background:#2a2e3a;border:1px solid #3a3f4e;border-radius:10px;overflow:hidden;">
      <div style="width:80px;flex:none;background:rgba(255,215,106,0.16);border-right:2px solid ${GOLD};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:14px 4px 8px;">
        <div style="position:relative;width:40px;height:40px;margin-top:6px;border-radius:50%;background:${bodyBg(r.recipe)};">${face(hex, 40)}${crown(20)}</div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.05em;color:${GOLD};">HERO</div>
      </div>
      <div style="flex:1;padding:10px 12px 12px;text-align:left;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="font-size:19px;font-weight:800;line-height:1.15;">${r.name}</div><span style="flex:none;height:20px;padding:0 8px;border-radius:10px;background:rgba(138,143,163,0.16);border:1px solid #8a8fa3;color:#8a8fa3;font-size:10px;font-weight:800;display:flex;align-items:center;">${r.front ? "FRONT" : "BACK"}</span></div>
        <div style="font-size:12px;font-weight:700;margin-top:6px;">${recipe}</div>
        <div style="font-size:11.5px;color:#8a8fa3;margin-top:2px;"><b style="font-size:9.5px;letter-spacing:.05em;color:${GOLD};">GIFT · ${r.gift[0]}</b> ${r.gift[1]}</div>
        <div style="font-size:11.5px;color:#8a8fa3;margin-top:2px;"><b style="font-size:9.5px;letter-spacing:.05em;color:#e8e8ee;">SKILL · ${r.skill[0]}</b> ${r.skill[1]}</div>
        <div style="font-size:11.5px;color:#e8e8ee;margin-top:7px;">↳ uses ${r.uses}</div>
      </div>
    </div>`;
};

const html = `<!doctype html>
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
</style>
</helmet>

<!-- Frame 8.0: the merge pick (2026-10-20, built on branch dev/merge-heroes, awaiting Tu's approval). The reward for beating a mini-boss (rounds 7 and 14) in place of the usual three offers: one row per hero the roster can make right now, in the offer rows' frame with a gold rail holding the hero's own body (its recipe colours and a crown) over the word HERO. Each row says FRONT or BACK, the recipe, the gift and the skill in one line each, and the three units the game would use (the most tired of each role). One tap commits; "Not now" shows the round's usual three offers instead. The real screen lists every hero the roster can make (up to seven at the start squad) and scrolls; four are drawn. Drawn by design/tools/gen-merge-pick.js from render/mergeScreen.ts. -->
<div style="width:390px;height:860px;background:#14161c;padding:16px;">
  <div style="background:#1d2029;border-radius:12px;padding:20px 14px 16px;color:#e8e8ee;">
    <div style="text-align:center;font-size:24px;font-weight:800;line-height:1.2;">Mini-boss down — make a hero</div>
    <div style="text-align:center;font-size:12px;color:#8a8fa3;margin-top:6px;">Three of your units merge into one hero and leave the squad. The hero takes one slot.</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
    ${ROWS.map(row).join("\n    ")}
    </div>
    <div style="margin:14px auto 0;width:max-content;font-size:14px;font-weight:600;background:#2a2e3a;border:1px solid #3a3f4e;border-radius:8px;padding:9px 16px;">Not now — take the usual offers</div>
  </div>
</div>
</x-dc>
</body>
</html>
`;
fs.writeFileSync(path.join(CANVAS, "HeroMergePick.dc.html"), html);

// patch canvas.json: one board and one label, beside the run-over frame
const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/HeroMergePick|label-hero-merge/.test(l));
const iRun = lines.findIndex((l) => l.includes('"file": "RunOver.dc.html"'));
lines.splice(iRun + 1, 0, `    { "file": "HeroMergePick.dc.html", "x": 550, "y": 7800, "w": 390, "h": 860 },`);
const iLabel = lines.findIndex((l) => l.includes('"id": "label-runover"'));
if (iLabel < 0) throw new Error("label-runover not found");
lines.splice(iLabel + 1, 0, `    { "id": "label-hero-merge", "x": 550, "y": 7740, "w": 390, "text": "8.0 Merge pick — the reward for a mini-boss win (proposal, built on dev/merge-heroes)" },`);
fs.writeFileSync(cj, lines.join("\n"));
JSON.parse(fs.readFileSync(cj, "utf8"));
console.log("wrote HeroMergePick.dc.html and patched canvas.json");
