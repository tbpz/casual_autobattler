// Checks sketches/map-3 before Tu plays. Usage: node check-map3.js <path to index.html>
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const grab = (re) => { const m = src.match(re); if (!m) throw new Error("not found: " + re); return m[1]; };
const MAP = eval(grab(/const MAP = (\[[\s\S]*?\]);/));
const CREATURES = eval("(" + grab(/const CREATURES = (\{[\s\S]*?\n\});/) + ")");
const num = (name) => +grab(new RegExp(name + " = (\\d+)"));
const GLINT = num("GLINT"), SEE = num("SEE");

const W = MAP[0].length, H = MAP.length;
let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };
MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const GIVER = { hop: "H", swim: "P", climb: "C", light: "G", sniff: "N" };
const WALL = { P: "~", C: "^", G: "#", H: "v" };
const helpers = Object.keys(CREATURES).filter((k) => CREATURES[k].kind === "helper");
const idx = (x, y) => y * W + x;
const ground = (x, y) => { const ch = MAP[y][x]; if (CREATURES[ch]) return CREATURES[ch].on || "."; return ch === "@" ? "." : ch; };
let start; const where = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = MAP[y][x];
  if (ch === "@") start = { x, y };
  if (CREATURES[ch]) where[ch] = { x, y };
}
for (const k of Object.keys(CREATURES)) if (!where[k]) fail(`${k} is not on the map`);

// what you can walk to holding a set of helpers (everything you walk near is seen, so sight is ignored)
function reach(held) {
  const has = (a) => held.has(GIVER[a]);
  const pass = (x, y) => {
    const g = ground(x, y);
    return g === "." || (g === "~" && has("swim")) || (g === "^" && has("climb")) || ((g === "#" || g === "%") && has("light"));
  };
  const dist = new Map([[idx(start.x, start.y), 0]]), q = [[start.x, start.y]];
  while (q.length) {
    const [x, y] = q.shift(), d = dist.get(idx(x, y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!pass(nx, ny)) {
        if (!(has("hop") && ground(nx, ny) === "v")) continue;
        nx += dx; ny += dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !pass(nx, ny)) continue;
      }
      const i = idx(nx, ny);
      if (!dist.has(i)) { dist.set(i, d + 1); q.push([nx, ny]); }
    }
  }
  return dist;
}
const key = (held) => [...held].sort().join("") || "-";
// every set of helpers you could be holding, found in some order
const states = new Map(); const todo = [new Set()];
while (todo.length) {
  const held = todo.pop();
  if (states.has(key(held))) continue;
  const r = reach(held); states.set(key(held), { held, r });
  for (const h of helpers) if (!held.has(h) && r.has(idx(where[h].x, where[h].y))) todo.push(new Set([...held, h]));
}
console.log(`States you can be in: ${[...states.keys()].join("  ")}`);

// 1. wall first: whenever a helper is reachable, its wall touches ground you could already reach; and how far each is
console.log("\nWall first (steps from start to the first wall square you bump into, vs steps to the helper):");
for (const { held, r } of states.values()) for (const h of helpers) {
  if (held.has(h) || !WALL[h] || !r.has(idx(where[h].x, where[h].y))) continue;
  let wallStep = Infinity;
  for (const [i, d] of r) {
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && ground(nx, ny) === WALL[h] && !r.has(idx(nx, ny))) wallStep = Math.min(wallStep, d);
    }
  }
  const helperStep = r.get(idx(where[h].x, where[h].y));
  const line = `  holding ${key(held).padEnd(5)} ${CREATURES[h].name.padEnd(9)} wall at ${wallStep}, helper at ${helperStep}`;
  if (!(wallStep < helperStep)) fail(line + "  <- helper comes before its wall"); else console.log(line);
}

// 2. two ways through: some state offers two helpers at once
const forks = [...states.values()].filter(({ held, r }) => helpers.filter((h) => !held.has(h) && r.has(idx(where[h].x, where[h].y))).length >= 2);
console.log(`\nPoints with two helpers to pick from: ${forks.map((s) => key(s.held)).join(", ") || "none"}`);
if (!forks.length) fail("only one way through");

// 3. effort: fewest helpers needed for each find (a hidden one also needs the helper that shows it)
const all = states.get(key(new Set(helpers)));
if (!all) fail("you can never hold every helper");
console.log("\nEffort per find (fewest helpers needed):");
const effort = {};
for (const k of Object.keys(CREATURES)) {
  const c = CREATURES[k], i = idx(where[k].x, where[k].y);
  let best = null;
  for (const { held, r } of states.values()) {
    if (held.has(k) || !r.has(i)) continue;
    if (c.hidden && !held.has(GIVER[c.hidden])) continue;
    if (!best || held.size < best.size) best = held;
  }
  if (!best) { fail(`${c.name} can never be reached`); continue; }
  effort[k] = best.size;
  console.log(`  ${c.kind.padEnd(6)} ${c.name.padEnd(10)} ${best.size}  (${key(best)})`);
}
const by = (kind) => Object.keys(effort).filter((k) => CREATURES[k].kind === kind).map((k) => effort[k]);
const maxPlain = Math.max(...by("plain")), minRare = Math.min(...by("rare")), rarest = Math.min(...by("rarest"));
console.log(`  plain needs at most ${maxPlain}, rare at least ${minRare}, the rarest ${rarest}`);
if (maxPlain >= minRare) fail("a plain find needs as much as a rare one");
if (minRare < 2) fail("a rare find needs fewer than 2 helpers");
if (rarest < Math.max(...by("rare"))) fail("the rarest is easier than a rare one");

// 4. seen before reached: the first state where a rare glints (or is in plain sight) vs the first where you reach it
console.log("\nRare and rarest finds, first seen vs first reached:");
for (const k of Object.keys(CREATURES)) {
  const c = CREATURES[k];
  if (c.kind !== "rare" && c.kind !== "rarest") continue;
  const { x, y } = where[k];
  let seenAt = null;
  for (const { held, r } of states.values()) {
    if (c.hidden) break;
    for (const i of r.keys()) {
      const d = (i % W - x) ** 2 + (Math.floor(i / W) - y) ** 2;
      if (d <= GLINT && (seenAt === null || held.size < seenAt)) seenAt = held.size;
    }
  }
  console.log(`  ${c.name.padEnd(10)} glints holding ${c.hidden ? "(hidden, never glints)" : seenAt + " helpers"}, reached holding ${effort[k]}`);
}
const s0 = states.get("-").r;
console.log(`\nAt the start you can walk to ${s0.size} squares. Seen from the start square: ` +
  ["~", "^", "v"].map((g) => { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground(x, y) === g && (x - start.x) ** 2 + (y - start.y) ** 2 <= SEE) n++; return `${g} x${n}`; }).join(", "));
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
