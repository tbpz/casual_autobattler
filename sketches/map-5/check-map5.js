// Checks sketches/map-5 before Tu plays. Usage: node check-map5.js <path to index.html>
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const grab = (re) => { const m = src.match(re); if (!m) throw new Error("not found: " + re); return m[1]; };
const MAP = eval(grab(/const MAP = (\[[\s\S]*?\]);/));
const CREATURES = eval("(" + grab(/const CREATURES = (\{[\s\S]*?\n\});/) + ")");
const TRAILS = eval("(" + grab(/const TRAILS = (\{[\s\S]*?\n\});/) + ")");
const BLOCKED_HINT = eval("(" + grab(/const BLOCKED_HINT = (\{[\s\S]*?\n\});/) + ")");
const BOULDERS = eval(grab(/const BOULDERS = (\[[\s\S]*?\n\]);/));
const RIVERS = eval(grab(/const RIVERS = (\[[\s\S]*?\n\]);/));
const VINES = eval(grab(/const VINES = (\[[\s\S]*?\n\]);/));
const num = (name) => +grab(new RegExp(name + " = (\\d+)"));
const SEE = num("SEE"), SEE_LIT = num("SEE_LIT"), SEE_HIGH = num("SEE_HIGH"), GLIDE = num("GLIDE"), MEET = num("MEET");
const MIN_GAP = 20; // steps between first seeing a wall and reaching its helper, when both happen holding the same helpers

const W = MAP[0].length, H = MAP.length;
let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };
MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const GIVER = { push: "U", swim: "P", glide: "L", sniff: "N", vine: "S", light: "G", ride: "W", burrow: "K" };
const WALL = { P: "~", G: "#", U: "v", S: "^", W: "=" };   // helpers whose wall you can bump into
const NEW_MOVES = ["U", "L", "S", "W", "K"];                // each must open a place seen before you hold it
const helpers = Object.keys(CREATURES).filter((k) => CREATURES[k].kind === "helper");
const isRare = (k) => CREATURES[k].kind === "rare" || CREATURES[k].kind === "rarest";
const idx = (x, y) => y * W + x;
const ground = (x, y) => { const ch = MAP[y][x]; if (CREATURES[ch]) return CREATURES[ch].on || "."; return ch === "@" ? "." : ch; };
let start; const where = {}; const holes = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ch = MAP[y][x];
  if (ch === "@") start = { x, y };
  if (CREATURES[ch]) where[ch] = { x, y };
  if (ch === "O") holes.push(idx(x, y));
}
for (const k of Object.keys(CREATURES)) if (!where[k]) fail(`${k} is not on the map`);
const vineSq = new Set(VINES.flatMap((v) => v.up.map(([x, y]) => idx(x, y))));
const atSq = new Map(BOULDERS.map((b, n) => [idx(...b.at), n])), toSq = new Map(BOULDERS.map((b, n) => [idx(...b.to), n]));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// what you can see from a set of squares you can stand on (high ground sees further)
function sight(r, held) {
  const out = new Map();  // square -> fewest steps at which it is in sight
  const lit = held.has("G");
  for (const [i, d] of r) {
    const x = i % W, y = Math.floor(i / W), see = Math.max(lit ? SEE_LIT : SEE, ground(x, y) === "h" ? SEE_HIGH : 0);
    const R = Math.ceil(Math.sqrt(see));
    for (let ty = Math.max(0, y - R); ty <= Math.min(H - 1, y + R); ty++) for (let tx = Math.max(0, x - R); tx <= Math.min(W - 1, x + R); tx++)
      if ((tx - x) ** 2 + (ty - y) ** 2 <= see) { const j = idx(tx, ty); if (!out.has(j) || out.get(j) > d) out.set(j, d); }
  }
  return out;
}

// what you can get to holding a set of helpers; pushed boulders, grown vines, seen holes and rides all count
function reach(held) {
  const has = (a) => held.has(GIVER[a]);
  let pushed = new Set(), seenHoles = new Set(), dist;
  for (let round = 0; round < 20; round++) {
    const g = (x, y) => { const i = idx(x, y);
      if (atSq.has(i)) return pushed.has(atSq.get(i)) ? "." : "o";
      if (toSq.has(i)) return pushed.has(toSq.get(i)) ? "b" : "v";
      return ground(x, y); };
    const level = (c) => (c === "h" ? 1 : (c === "/" || c === "^") ? null : 0);
    const pass = (x, y) => { const c = g(x, y);
      return ".sOh/b".includes(c) || (c === "~" && has("swim")) || ((c === "#" || c === "%") && has("light")) ||
        (c === "^" && vineSq.has(idx(x, y)) && has("vine")); };
    dist = new Map([[idx(start.x, start.y), 0]]);
    const q = [[start.x, start.y]];
    const add = (i, d) => { if (!dist.has(i)) { dist.set(i, d); q.push([i % W, Math.floor(i / W)]); } };
    while (q.length) {
      const [x, y] = q.shift(), d = dist.get(idx(x, y)), here = g(x, y);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const a = level(here), b = level(g(nx, ny));
        if (pass(nx, ny) && (a === null || b === null || a === b)) add(idx(nx, ny), d + 1);
      }
      if (has("glide") && here === "h")
        for (let ty = Math.max(0, y - 6); ty <= Math.min(H - 1, y + 6); ty++) for (let tx = Math.max(0, x - 6); tx <= Math.min(W - 1, x + 6); tx++)
          if ((tx - x) ** 2 + (ty - y) ** 2 <= GLIDE && pass(tx, ty) && level(g(tx, ty)) === 0) add(idx(tx, ty), d + 1);
      if (has("ride")) for (const r of RIVERS) { const [ex, ey] = r.path[0]; if (Math.abs(ex - x) + Math.abs(ey - y) === 1) add(idx(...r.exit), d + r.path.length); }
      if (has("burrow") && here === "O") for (const h of seenHoles) add(h, d + 1);
    }
    // anything this reach makes possible next round
    let more = false;
    if (has("push")) BOULDERS.forEach((b, n) => { if (!pushed.has(n) && dist.has(idx(...b.from))) { pushed.add(n); more = true; } });
    if (has("burrow")) { const s = sight(dist, held); for (const h of holes) if (s.has(h) && !seenHoles.has(h)) { seenHoles.add(h); more = true; } }
    if (!more) break;
  }
  return dist;
}
const key = (held) => [...held].sort().join("") || "-";
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
console.log(`States you can be in: ${states.size}`);
const fewest = (pred) => { let best = null; for (const s of states.values()) if (pred(s) && (!best || s.held.size < best.held.size)) best = s; return best; };
const helperState = (h) => fewest(({ held, r }) => !held.has(h) && r.has(idx(where[h].x, where[h].y)));

// 1. wall long before helper: you bump into the wall holding fewer helpers, or many steps before the helper
console.log(`\nWall long before its helper (need: wall met holding fewer helpers, or ${MIN_GAP}+ steps earlier):`);
for (const h of helpers) {
  if (!WALL[h]) continue;
  const touches = (r) => { let best = Infinity;
    for (const [i, d] of r) { const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && ground(nx, ny) === WALL[h] && !r.has(idx(nx, ny))) best = Math.min(best, d); } }
    return best; };
  const wallS = fewest(({ held, r }) => !held.has(h) && touches(r) < Infinity);
  const helpS = helperState(h);
  if (!wallS || !helpS) { fail(`${CREATURES[h].name}: wall or helper never reached`); continue; }
  const wallStep = touches(helpS.r), helpStep = helpS.r.get(idx(where[h].x, where[h].y));
  const line = `  ${CREATURES[h].name.padEnd(10)} wall met holding ${wallS.held.size}, helper reached holding ${helpS.held.size}; same state: wall at step ${wallStep}, helper at step ${helpStep}`;
  if (wallS.held.size < helpS.held.size || helpStep - wallStep >= MIN_GAP) console.log(line); else fail(line + "  <- too close");
}

// 2. each new move opens a place you saw before you held it
console.log(`\nEach new move opens a place seen earlier (need: seen holding fewer helpers, or ${MIN_GAP}+ steps earlier):`);
for (const h of NEW_MOVES) {
  const helpS = helperState(h);
  if (!helpS) { fail(`${CREATURES[h].name} is never reached`); continue; }
  const after = reach(new Set([...helpS.held, h]));
  const opened = [...after.keys()].filter((i) => !helpS.r.has(i));
  if (!opened.length) { fail(`${CREATURES[h].name} opens nothing new`); continue; }
  const seenS = fewest(({ held, r }) => !held.has(h) && opened.some((i) => sight(r, held).has(i)));
  const s = sight(helpS.r, helpS.held), seenStep = Math.min(...opened.map((i) => (s.has(i) ? s.get(i) : Infinity)));
  const helpStep = helpS.r.get(idx(where[h].x, where[h].y));
  const line = `  ${CREATURES[h].name.padEnd(10)} opens ${opened.length} squares; seen holding ${seenS ? seenS.held.size : "-"}, helper reached holding ${helpS.held.size}; same state: seen at step ${seenStep}, helper at step ${helpStep}`;
  if (seenS && (seenS.held.size < helpS.held.size || helpStep - seenStep >= MIN_GAP)) console.log(line); else fail(line + "  <- not seen early");
}

// 3. two ways through: some state offers two helpers at once
const forks = [...states.values()].filter(({ held, r }) => helpers.filter((h) => !held.has(h) && r.has(idx(where[h].x, where[h].y))).length >= 2);
console.log(`\nPoints with two helpers to pick from: ${forks.map((s) => key(s.held)).join(", ") || "none"}`);
if (!forks.length) fail("only one way through");

// 4. effort: fewest helpers needed for each find
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

// 5. tracks: every rare one has a trail, on ground you can stand on, ending next to its den,
//    and some of it shows holding fewer helpers than the find needs
console.log("\nTrails, first seen vs found:");
for (const k of Object.keys(CREATURES)) {
  if (!isRare(k)) continue;
  const t = TRAILS[k], c = CREATURES[k];
  if (!t) { fail(`${c.name} has no trail`); continue; }
  for (const [x, y] of t) if ("tx~v=o^".includes(ground(x, y)) && MAP[y][x] !== "%") fail(`${c.name}'s trail sits on '${ground(x, y)}' at ${x},${y}`);
  const [lx, ly] = t[t.length - 1], den = where[k];
  if ((lx - den.x) ** 2 + (ly - den.y) ** 2 > 9) fail(`${c.name}'s trail ends far from its den`);
  const seenAt = fewest(({ held, r }) => (!c.needs || held.has(GIVER[c.needs])) && t.some(([x, y]) =>
    (ground(x, y) !== "#" || held.has("G")) && sight(r, held).has(idx(x, y))));
  if (!seenAt) { fail(`${c.name}'s trail is never seen`); continue; }
  const line = `  ${c.name.padEnd(10)} trail seen holding ${seenAt.held.size}, found holding ${effort[k]}`;
  if (seenAt.held.size < effort[k]) console.log(line); else fail(line + "  <- trail not seen early");
}
if (MEET > 2) fail("a rare one shows itself from more than one square away");

// 6. walls never say which helper they need
const words = /swim|climb|jump|hop|light|sniff|glide|push|shove|vine|grow|plant|burrow|ride|current|someone|need/i;
for (const [g, t] of Object.entries(BLOCKED_HINT)) if (words.test(t)) fail(`the '${g}' wall names its helper: "${t}"`);
for (const k of helpers) if (CREATURES[k].hint) fail(`${CREATURES[k].name} has a book hint that may say where it is`);

// 7. no way to get stuck: from anywhere you can reach, you can get back to the start
for (const { held, r } of states.values()) {
  // a one-way move (glide, ride) must land somewhere that walks back; check the ride exit and glide landings
  const back = reach(held);
  for (const r0 of RIVERS) if (r.has(idx(...r0.exit))) {
    // from the exit, can you reach the start holding the same helpers? (start reach from exit)
    const s0 = start; start = { x: r0.exit[0], y: r0.exit[1] };
    const fromExit = reach(held); start = s0;
    if (!fromExit.has(idx(s0.x, s0.y))) fail(`stuck after riding the river holding ${key(held)}`);
  }
}

const s0 = states.get("-").r;
console.log(`\nAt the start you can walk to ${s0.size} squares.`);
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
