// Checks sketches/map-6 before Tu plays. Usage: node check-map6.js <path to index.html>
// It runs the page's own rules (the block between CORE START and CORE END), so the check and the game can't disagree.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("// ==== CORE START"), b = src.indexOf("// ==== CORE END");
if (a < 0 || b < 0) throw new Error("CORE START / CORE END markers not found");
const C = new Function(src.slice(a, b) + `
return { MAP, RIVERS, VINES, CREATURES, ORDER, GIVER, TRAILS, BLOCKED_HINT, SIGNS, W, H, idx, xy, inside, DIRS,
  start, BOULDER_HOME, HOLES, RIVER_SQ, mapGround, ground, high, moves, rollPlan, applyRoll, fresh,
  SEE, SEE_HIGH, setS: (s) => { S = s; } };`)();
const { W, H, idx, xy, DIRS, CREATURES, ORDER } = C;

let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };

// ---- 0. the map is drawn right ----
C.MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const where = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (CREATURES[C.MAP[y][x]]) where[C.MAP[y][x]] = idx(x, y);
for (const k of Object.keys(CREATURES)) { if (where[k] === undefined) fail(`${k} is not on the map`); if (!ORDER.includes(k)) fail(`${k} is not in the book`); }
C.RIVERS.forEach((r, n) => r.path.forEach(([x, y]) => { if (C.mapGround(x, y) !== "=") fail(`river ${n} runs over '${C.mapGround(x, y)}' at ${x},${y}`); }));
C.VINES.forEach((v, n) => {
  if (C.mapGround(...v.soil) !== "s") fail(`vine ${n} has no soft soil at ${v.soil}`);
  v.up.forEach(([x, y]) => { if (C.mapGround(x, y) !== "^") fail(`vine ${n} grows over '${C.mapGround(x, y)}' at ${x},${y}`); });
});
const START = idx(C.start.x, C.start.y);
const helpers = ORDER.filter((k) => CREATURES[k].kind === "helper");
const name = (k) => CREATURES[k].name;

// ---- a world state: which helpers you hold, and what you've done to the world ----
// A boulder is either at its starting spot or used up (in a crack, a river or a pond). One left lying anywhere
// else can always be shoved back home, so where it lies doesn't make a different state.
const clone = (st) => ({ held: st.held.slice(), boulders: st.boulders.slice(), bridges: st.bridges.slice(),
  stones: st.stones.slice(), dams: st.dams.map((d) => ({ ...d })), vines: st.vines.slice() });
const key = (st) => [st.held.join(""), st.boulders.map((x) => (x === -1 ? "x" : "h")).join(""),
  st.bridges.slice().sort().join(","), st.stones.slice().sort().join(","),
  st.dams.map((d) => d.r + ":" + d.j).sort().join(","), st.vines.slice().sort().join(",")].join("|");
function load(st, at) {
  const s = C.fresh();
  Object.assign(s, clone(st));
  s.found = st.held.slice();
  s.x = at.x; s.y = at.y;
  C.setS(s);
  return s;
}
function sightFrom(i, s) {
  const [x, y] = xy(i), see = C.high(x, y) ? C.SEE_HIGH : C.SEE, R = Math.ceil(Math.sqrt(see));
  for (let ty = Math.max(0, y - R); ty <= Math.min(H - 1, y + R); ty++) for (let tx = Math.max(0, x - R); tx <= Math.min(W - 1, x + R); tx++)
    if ((tx - x) ** 2 + (ty - y) ** 2 <= see) s.seen[idx(tx, ty)] = 1;
}
function bfs(from) {
  const dist = new Map([[from, 0]]), q = [from], rides = new Set(), landings = new Set();
  while (q.length) {
    const i = q.shift();
    for (const [n, kind, extra] of C.moves(...xy(i))) {
      if (kind === "ride") rides.add(extra.r + ":" + extra.j);
      if (kind === "ride" || kind === "glide" || kind === "burrow") landings.add(n);
      if (!dist.has(n)) { dist.set(n, dist.get(i) + 1); q.push(n); }
    }
  }
  return { dist, rides: [...rides].map((t) => t.split(":").map(Number)), landings };
}
// everything you can get to from one square; what you've seen grows as you go, as in play
function reach(st, from = START, seenBefore = null) {
  const s = load(st, { x: from % W, y: Math.floor(from / W) });
  if (seenBefore) s.seen = seenBefore.slice();
  sightFrom(from, s);
  let last = -1, out;
  for (;;) {
    out = bfs(from);
    for (const i of out.dist.keys()) sightFrom(i, s);
    for (const [r, j] of out.rides) C.RIVERS[r].path.slice(j).forEach(([x, y]) => sightFrom(idx(x, y), s));
    const n = s.seen.reduce((p, q) => p + q, 0);
    if (n === last) break;
    last = n;
  }
  out.s = s;
  return out;
}
function obtainable(k, st, out) {
  if (CREATURES[k].kind === "helper" && st.held.includes(k)) return false;
  if (!out.dist.has(where[k])) return false;
  C.setS(out.s);
  if (CREATURES[k].on === "=" && C.ground(...xy(where[k])) !== "_") return false;
  return true;
}
// every way boulder n can end up used: follow it from its spot through every place a shove can leave it
function boulderUses(st, out, n) {
  const placed = new Set([st.boulders[n]]), q = [st.boulders[n]], uses = new Map();
  while (q.length) {
    const p = q.shift(), [px, py] = xy(p);
    for (const [dx, dy] of DIRS) {
      const sx = px - dx, sy = py - dy;
      if (!C.inside(sx, sy) || !out.dist.has(idx(sx, sy))) continue;
      const t = load(st, { x: sx, y: sy });
      t.boulders[n] = p;
      const plan = C.rollPlan(n, dx, dy);
      if (plan.what === "stop") { if (!placed.has(plan.end)) { placed.add(plan.end); q.push(plan.end); } continue; }
      if (plan.what !== "dam" && plan.what !== "bridge" && plan.what !== "stone") continue;
      C.applyRoll(n, plan);
      const ns = { held: st.held.slice(), boulders: t.boulders.slice(), bridges: t.bridges.slice(), stones: t.stones.slice(),
        dams: t.dams.map((d) => ({ ...d })), vines: t.vines.slice() };
      uses.set(key(ns), ns);
    }
  }
  return [...uses.values()];
}
function next(st, out) {
  const res = [];
  for (const h of helpers) if (obtainable(h, st, out)) { const ns = clone(st); ns.held = [...st.held, h].sort(); res.push(ns); }
  if (st.held.includes("S")) C.VINES.forEach((v, n) => {
    if (!st.vines.includes(n) && out.dist.has(idx(...v.soil))) { const ns = clone(st); ns.vines.push(n); res.push(ns); }
  });
  if (st.held.includes("U")) st.boulders.forEach((p, n) => { if (p !== -1) res.push(...boulderUses(st, out, n)); });
  return res;
}

// ---- every state you can be in, found by trying everything in every order ----
const init = { held: [], boulders: C.BOULDER_HOME.slice(), bridges: [], stones: [], dams: [], vines: [] };
const states = new Map();
const todo = [init];
while (todo.length) {
  const st = todo.pop(), k = key(st);
  if (states.has(k)) continue;
  const out = reach(st);
  const nx = next(st, out);
  states.set(k, { st, out, next: nx.map(key) });
  for (const s2 of nx) if (!states.has(key(s2))) todo.push(s2);
}
console.log(`States you can be in: ${states.size}`);
const all = [...states.values()];
const got = (k, v) => obtainable(k, v.st, v.out);

// ---- 1. every creature can be found, and you can never lock yourself out of one ----
const back = new Map([...states.keys()].map((k) => [k, []]));
for (const [k, v] of states) for (const n of v.next) back.get(n).push(k);
console.log("\nNo way to lock yourself out:");
for (const c of ORDER) {
  const hit = [...states].filter(([, v]) => got(c, v) || (CREATURES[c].kind === "helper" && v.st.held.includes(c))).map(([k]) => k);
  if (!hit.length) { fail(`${name(c)} can never be found`); continue; }
  const can = new Set(hit), q = hit.slice();
  while (q.length) for (const p of back.get(q.pop())) if (!can.has(p)) { can.add(p); q.push(p); }
  const stuck = states.size - can.size;
  if (stuck) fail(`${name(c)}: ${stuck} states can never get it any more`);
}
if (ok) console.log("  every creature stays reachable from every state");

// ---- 2. every one-way trip (a glide, a ride, a burrow) lands somewhere you can get back from ----
let oneWays = 0;
for (const v of all) {
  const walkBack = new Set();
  for (const L of v.out.landings) {
    if (walkBack.has(L)) continue;
    oneWays++;
    const r = reach(v.st, L, v.out.s.seen);
    if (!r.dist.has(START)) { fail(`stuck after landing at ${xy(L)} holding ${v.st.held.join("") || "-"}`); break; }
    for (const i of r.dist.keys()) walkBack.add(i);
  }
}
console.log(`\nOne-way trips checked: ${oneWays}`);

// ---- 3. every rare one needs its idea; every plain one needs none ----
const damA = (st) => st.dams.some((d) => d.r === 0);
const rock = (st) => st.vines.includes(1);
const IDEAS = {
  D: ["a dam on the river", (st) => damA(st)],
  e: ["a dam on the river, then swimming", (st) => damA(st) && st.held.includes("P")],
  m: ["the vine up the lone rock, then gliding", (st) => rock(st) && st.held.includes("L")],
  R: ["the vine up the lone rock, then burrowing", (st) => rock(st) && st.held.includes("K")],
};
const noIdea = (st) => !damA(st) && !rock(st);
console.log("\nEach rare one needs its idea:");
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k === "rare" || k === "rarest") {
    if (!IDEAS[c]) { fail(`${name(c)} has no idea listed`); continue; }
    const [what, test] = IDEAS[c];
    const cheat = all.find((v) => got(c, v) && !test(v.st));
    if (cheat) fail(`${name(c)} can be found without ${what} (holding ${cheat.st.held.join("") || "-"})`);
    else console.log(`  ${name(c).padEnd(10)} only with ${what}`);
  } else if (!all.some((v) => noIdea(v.st) && got(c, v))) fail(`${name(c)} (${k}) needs an idea to reach`);
}

// ---- 4. each helper has a plain use first: something it alone opens, with no idea needed ----
const TEACH = { U: "S", S: "P", L: "n", P: "c", K: "b" };
console.log("\nEach helper's plain use:");
for (const h of helpers) {
  const t = TEACH[h];
  const shown = all.some((v) => noIdea(v.st) && v.st.held.includes(h) && got(t, v));
  const needs = all.every((v) => !got(t, v) || v.st.held.includes(h));
  if (shown && needs) console.log(`  ${name(h).padEnd(8)} opens the way to ${name(t)}`);
  else fail(`${name(h)}: ${name(t)} is ${shown ? "reachable without it" : "not reachable with it and no idea"}`);
}

// ---- 5. trails: on ground you stand on, ending near the den, seen before the find ----
console.log("\nTrails:");
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k !== "rare" && k !== "rarest") continue;
  const t = C.TRAILS[c];
  if (!t) { fail(`${name(c)} has no trail`); continue; }
  for (const [x, y] of t) if ("tx~v=o^u".includes(C.mapGround(x, y))) fail(`${name(c)}'s trail sits on '${C.mapGround(x, y)}' at ${x},${y}`);
  const [lx, ly] = t[t.length - 1], [dx, dy] = xy(where[c]);
  if ((lx - dx) ** 2 + (ly - dy) ** 2 > 25) fail(`${name(c)}'s trail ends far from its den`);
  const early = all.some((v) => !got(c, v) && t.some(([x, y]) => v.out.s.seen[idx(x, y)]));
  if (early) console.log(`  ${name(c).padEnd(10)} trail is seen before it can be found`); else fail(`${name(c)}'s trail is never seen early`);
}

// ---- 6. words: walls and signs never say which helper ----
const words = /swim|climb|jump|hop|glide|push|shove|vine|grow|plant|burrow|dig|ride|dam\b|current|someone|need/i;
for (const [g, t] of Object.entries(C.BLOCKED_HINT)) if (words.test(t)) fail(`the '${g}' wall names its helper: "${t}"`);
for (const s of C.SIGNS) if (words.test(s.line)) fail(`a sign names its helper: "${s.line}"`);

// ---- 7. each stuck sign can actually show: wanted and in sight in some state ----
for (const s of C.SIGNS) {
  const shows = all.some((v) => { C.setS(v.out.s); return s.want() && v.out.s.seen[idx(...s.at)]; });
  if (!shows) fail(`the ${s.look} sign never shows`);
}

// ---- 8. how much each find takes (for reading, not pass/fail) ----
console.log("\nFewest helpers per find:");
for (const c of ORDER) {
  let best = null;
  for (const v of all) if (got(c, v) && (!best || v.st.held.length < best.length)) best = v.st.held;
  if (best) console.log(`  ${CREATURES[c].kind.padEnd(6)} ${name(c).padEnd(10)} ${best.length}  (${best.join("") || "-"})`);
}
console.log(`\nAt the start you can walk to ${states.get(key(init)).out.dist.size} squares.`);
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
