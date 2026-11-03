// Checks sketches/map-4 before Tu plays. Usage: node check-map4.js <path to index.html>
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const grab = (re) => { const m = src.match(re); if (!m) throw new Error("not found: " + re); return m[1]; };
const MAP = eval(grab(/const MAP = (\[[\s\S]*?\]);/));
const CREATURES = eval("(" + grab(/const CREATURES = (\{[\s\S]*?\n\});/) + ")");
const TRAILS = eval("(" + grab(/const TRAILS = (\{[\s\S]*?\n\});/) + ")");
const BLOCKED_HINT = eval("(" + grab(/const BLOCKED_HINT = (\{[\s\S]*?\n\});/) + ")");
const num = (name) => +grab(new RegExp(name + " = (\\d+)"));
const SEE = num("SEE"), MEET = num("MEET");
const MIN_GAP = 20; // steps between first bumping into a wall and reaching its helper, when both happen holding the same helpers

const W = MAP[0].length, H = MAP.length;
let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };
MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const GIVER = { hop: "H", swim: "P", climb: "C", light: "G", sniff: "N" };
const WALL = { P: "~", C: "^", G: "#", H: "v" };
const helpers = Object.keys(CREATURES).filter((k) => CREATURES[k].kind === "helper");
const isRare = (k) => CREATURES[k].kind === "rare" || CREATURES[k].kind === "rarest";
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
// a rare one can be found once you can stand next to it (or on it) holding what it needs
function canGet(k, held, r) {
  const c = CREATURES[k], { x, y } = where[k];
  if (c.hidden && !held.has(GIVER[c.hidden])) return false;
  if (c.needs && !held.has(GIVER[c.needs])) return false;
  return r.has(idx(x, y));
}
// every set of helpers you could be holding, found in some order
const states = new Map(); const todo = [new Set()];
while (todo.length) {
  const held = todo.pop();
  if (states.has(key(held))) continue;
  const r = reach(held); states.set(key(held), { held, r });
  for (const h of helpers) if (!held.has(h) && r.has(idx(where[h].x, where[h].y))) todo.push(new Set([...held, h]));
}
console.log(`States you can be in: ${[...states.keys()].join("  ")}`);
const fewest = (pred) => { let best = null; for (const s of states.values()) if (pred(s) && (!best || s.held.size < best.held.size)) best = s; return best; };

// 1. wall long before helper: you bump into the wall holding fewer helpers, or many steps before the helper
console.log(`\nWall long before its helper (need: wall met holding fewer helpers, or ${MIN_GAP}+ steps earlier):`);
for (const h of helpers) {
  if (!WALL[h]) continue;
  const touches = (r) => { let best = Infinity;
    for (const [i, d] of r) { const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && ground(nx, ny) === WALL[h] && !r.has(idx(nx, ny))) best = Math.min(best, d); } }
    return best; };
  const wallS = fewest(({ held, r }) => !held.has(h) && touches(r) < Infinity);
  const helpS = fewest(({ held, r }) => !held.has(h) && r.has(idx(where[h].x, where[h].y)));
  if (!wallS || !helpS) { fail(`${CREATURES[h].name}: wall or helper never reached`); continue; }
  const wallStep = touches(helpS.r), helpStep = helpS.r.get(idx(where[h].x, where[h].y));
  const line = `  ${CREATURES[h].name.padEnd(9)} wall met holding ${wallS.held.size}, helper reached holding ${helpS.held.size}; same state: wall at step ${wallStep}, helper at step ${helpStep}`;
  if (wallS.held.size < helpS.held.size || helpStep - wallStep >= MIN_GAP) console.log(line); else fail(line + "  <- too close");
}

// 2. two ways through: some state offers two helpers at once
const forks = [...states.values()].filter(({ held, r }) => helpers.filter((h) => !held.has(h) && r.has(idx(where[h].x, where[h].y))).length >= 2);
console.log(`\nPoints with two helpers to pick from: ${forks.map((s) => key(s.held)).join(", ") || "none"}`);
if (!forks.length) fail("only one way through");

// 3. effort: fewest helpers needed for each find
if (!states.get(key(new Set(helpers)))) fail("you can never hold every helper");
console.log("\nEffort per find (fewest helpers needed):");
const effort = {};
for (const k of Object.keys(CREATURES)) {
  const best = fewest(({ held, r }) => !held.has(k) && canGet(k, held, r));
  if (!best) { fail(`${CREATURES[k].name} can never be found`); continue; }
  effort[k] = best.held.size;
  console.log(`  ${CREATURES[k].kind.padEnd(6)} ${CREATURES[k].name.padEnd(10)} ${best.held.size}  (${key(best.held)})`);
}
const by = (kind) => Object.keys(effort).filter((k) => CREATURES[k].kind === kind).map((k) => effort[k]);
const maxPlain = Math.max(...by("plain")), minRare = Math.min(...by("rare")), rarest = Math.min(...by("rarest"));
console.log(`  plain needs at most ${maxPlain}, rare at least ${minRare}, the rarest ${rarest}`);
if (maxPlain >= minRare) fail("a plain find needs as much as a rare one");
if (minRare < 3) fail("a rare find needs fewer than 3 helpers");
if (rarest <= Math.max(...by("rare"))) fail("the rarest is no harder than a rare one");

// 4. tracks: every rare one has a trail, on ground you can see, ending next to its den,
//    and some of it shows holding fewer helpers than the find needs
console.log("\nTrails, first seen vs found:");
for (const k of Object.keys(CREATURES)) {
  if (!isRare(k)) continue;
  const t = TRAILS[k], c = CREATURES[k];
  if (!t) { fail(`${c.name} has no trail`); continue; }
  for (const [x, y] of t) if ("tx~v".includes(ground(x, y)) && MAP[y][x] !== "%") fail(`${c.name}'s trail sits on '${ground(x, y)}' at ${x},${y}`);
  const [lx, ly] = t[t.length - 1], den = where[k];
  if ((lx - den.x) ** 2 + (ly - den.y) ** 2 > 9) fail(`${c.name}'s trail ends far from its den`);
  const seenAt = fewest(({ held, r }) => (!c.needs || held.has(GIVER[c.needs])) && t.some(([x, y]) => {
    if (ground(x, y) === "#" && !held.has("G")) return false;
    for (const i of r.keys()) if ((i % W - x) ** 2 + (Math.floor(i / W) - y) ** 2 <= SEE) return true;
    return false;
  }));
  if (!seenAt) { fail(`${c.name}'s trail is never seen`); continue; }
  const line = `  ${c.name.padEnd(10)} trail seen holding ${seenAt.held.size}, found holding ${effort[k]}`;
  if (seenAt.held.size < effort[k]) console.log(line); else fail(line + "  <- trail not seen early");
}
// rare ones never glint and never show from afar
if (MEET > 2) fail("a rare one shows itself from more than one square away");

// 5. walls never say which helper they need
const words = /swim|climb|jump|hop|light|sniff|someone|need/i;
for (const [g, t] of Object.entries(BLOCKED_HINT)) if (words.test(t)) fail(`the '${g}' wall names its helper: "${t}"`);
for (const k of helpers) if (CREATURES[k].hint) fail(`${CREATURES[k].name} has a book hint that may say where it is`);

const s0 = states.get("-").r;
console.log(`\nAt the start you can walk to ${s0.size} squares.`);
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
