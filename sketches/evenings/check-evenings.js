// Checks sketches/evenings before Tu plays. Usage: node check-evenings.js <path to index.html>
// It runs the page's own rules (the block between CORE START and CORE END), so the check and the game can't disagree.
// SPOILERS: this file names every trick on the map. Tu should not read it before playing.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("// ==== CORE START"), b = src.indexOf("// ==== CORE END");
if (a < 0 || b < 0) throw new Error("CORE START / CORE END markers not found");
const C = new Function(src.slice(a, b) + `
return { MAP, RULES, CREATURES, ORDER, FOLLOW, GIVER, TRAILS, BLOCKED_HINT, SIGNS, W, H, idx, xy, inside, DIRS, start, ZS,
  mapGround, ground, level, levelAt, passable, stepFrom, moves, fireFrom, burnt, lightable, rainOn, cloudSpot, fall,
  chewTarget, creatureAt, DRIFT, fresh, setS: (s) => { S = s; } };`)();
const { W, H, idx, xy, DIRS, CREATURES, ORDER } = C;

let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };
const name = (k) => CREATURES[k].name;

// ---- 0. the map is drawn right ----
if (C.MAP.length !== H) fail("map height is off");
C.MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const where = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (CREATURES[C.MAP[y][x]]) where[C.MAP[y][x]] = idx(x, y);
for (const k of Object.keys(CREATURES)) { if (where[k] === undefined) fail(`${k} is not on the map`); if (!ORDER.includes(k)) fail(`${k} is not in the book`); }
for (const k of Object.keys(CREATURES)) if (!src.includes(`<symbol id="sp-${k}"`)) fail(`${name(k)} (${k}) has no drawing`);
const KNOWN = ".,txh/~%TvVsSYZj@";
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ch = C.MAP[y][x]; if (!CREATURES[ch] && !KNOWN.includes(ch)) fail(`unknown square '${ch}' at ${x},${y}`); }
// the map's edge is all trees
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (C.MAP[y][x] !== "t") fail(`edge not closed at ${x},${y}`);
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (C.MAP[y][x] !== "t") fail(`edge not closed at ${x},${y}`);
if (!ok) { console.log("\nSOME CHECKS FAILED"); process.exit(1); }
const START = idx(C.start.x, C.start.y);
const F = C.GIVER.fire, G = C.GIVER.chew, D = C.GIVER.rain;

// ---- a world: who you've caught, and every square that changed ----
// Fire and rain on sprouts only ever open ground (brambles and logs to ash, sprouts to vines), so the check lets them
// do everything they can as soon as you could make them (wind any way). Chewing a tree, and growing a seed or a stump
// into a tree, are real choices (a tree blocks the way), so they are steps of their own. Logs on land are tracked,
// because they burn.
const modKey = (m) => Object.keys(m).map(Number).sort((p, q) => p - q).map((i) => i + m[i]).join(",");
const wkey = (st) => st.held.join("") + "|" + modKey(st.mod);
function load(st, at) {
  const s = C.fresh();
  s.seen.fill(1);
  s.found = st.held.slice();
  s.mod = { ...st.mod };
  s.x = at % W; s.y = Math.floor(at / W);
  s.prev = at;
  C.setS(s);
  return s;
}
// The walkable areas of one world, worked out once: every square gets the number of the area it belongs to.
// It reads the map into two plain tables first (can you stand here, and how high is it), which is far faster than
// asking the page's step rules square by square. Steps work both ways in the check (nothing is on fire, everything is
// seen), so an area is simply every square you can walk to from any other square in it.
const compMemo = new Map();
const NB = [1, -1, W, -W];
function comps(st) {
  const wk = wkey(st);
  if (compMemo.has(wk)) return compMemo.get(wk);
  load(st, START);
  const N = W * H, pass = new Uint8Array(N), lev = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const [x, y] = xy(i), l = C.level(C.ground(x, y));
    pass[i] = C.passable(x, y) ? 1 : 0;
    lev[i] = l === null ? 2 : l;
  }
  const ok = (a, b) => lev[a] === 2 || lev[b] === 2 || lev[a] === lev[b];
  const comp = new Int16Array(N).fill(-1), members = new Map();
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || !pass[i]) continue;
    comp[i] = i;
    const q = [i], list = [i];
    while (q.length) {
      const p = q.pop(), px = p % W;
      for (const d of NB) {
        const n = p + d;
        if (n < 0 || n >= N || (d === 1 && px === W - 1) || (d === -1 && px === 0)) continue;
        if (comp[n] >= 0 || !pass[n] || !ok(p, n)) continue;
        comp[n] = i; q.push(n); list.push(n);
      }
    }
    members.set(i, list);
  }
  const out = { comp, members };
  compMemo.set(wk, out);
  return out;
}
const key = (st) => wkey(st) + "|" + comps(st).comp[st.at];
const reachMemo = new Map();
function reach(st) {
  const k = key(st);
  if (reachMemo.has(k)) return reachMemo.get(k);
  const { comp, members } = comps(st);
  let seen;
  if (comp[st.at] >= 0) seen = new Set(members.get(comp[st.at]));
  else {   // standing somewhere you couldn't walk onto: walk out from there the slow way
    load(st, st.at);
    seen = new Set([st.at]); const q = [st.at];
    while (q.length) { const i = q.shift(); for (const [n] of C.moves(...xy(i))) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  }
  reachMemo.set(k, seen);
  return seen;
}
const clone = (st) => ({ held: st.held.slice(), mod: { ...st.mod }, at: st.at });
// squares the cloud can be over: any square you can step off (calm), or DRIFT squares east or west of you (wind)
function rainable(R) {
  const out = new Set(R);
  if (C.RULES.drift) for (const r of R) { const [x, y] = xy(r); for (const w of [1, -1]) out.add(idx(Math.max(0, Math.min(W - 1, x + C.DRIFT * w)), y)); }
  return out;
}
const log = { height: [], sparks: false };
// let fire and rain do everything they can
function settle(st) {
  let rounds = 0;
  for (let changed = true; changed;) {
    changed = false;
    if (++rounds > 50) { console.log("settle never stops:", st.held.join(""), JSON.stringify(st.mod)); process.exit(2); }
    const R = reach(st);
    if (st.held.includes(F)) {
      load(st, st.at);
      const burn = {};
      for (const r of R) for (const n of C.lightable(r)) for (const w of [0, 1, -1]) for (const i of C.fireFrom(n, w)) Object.assign(burn, C.burnt(i));
      for (const i in burn) if (st.mod[i] !== burn[i]) { st.mod[i] = burn[i]; changed = true; }
    }
    if (st.held.includes(D)) {
      load(st, st.at);
      for (const c of rainable(R)) {
        const g = C.ground(...xy(c));
        if ("vV".includes(g)) { st.mod[c] = C.rainOn(c); changed = true; }
      }
    }
  }
  // A log on grass only matters while it could still burn. Once burnt it is ash, and ash on grass is just grass.
  // Before you have Emberfox, a log on grass is treated as grass too, so the fuse must be laid once you have the fox
  // (stricter than real play, never looser). Without this the count of worlds explodes.
  for (const i in st.mod) {
    if (!".,".includes(C.mapGround(...xy(+i)))) continue;
    if (st.mod[i] === "-" || (st.mod[i] === "l" && !st.held.includes(F))) delete st.mod[i];
  }
  // With Drizzle, a stump whose tree fell uselessly (no log left beside it) counts as the tree still standing: you can
  // always grow it back, and on this map a stump and a tree only differ on that one square, which blocks no path.
  if (st.held.includes(D)) {
    load(st, st.at);
    for (const i in st.mod) if (st.mod[i] === "S" && +i !== st.at && wasted(+i)) {
      if (C.mapGround(...xy(+i)) === "T") delete st.mod[i]; else st.mod[i] = "T";
    }
  }
  return st;
}
// a stump with no log lying next to it: its tree's fall was wasted
const wasted = (i) => { const [x, y] = xy(i); return !DIRS.some(([dx, dy]) => C.inside(x + dx, y + dy) && "lL".includes(C.ground(x + dx, y + dy))); };
// The seed in the open field is only there so you see what rain does to a seed. A tree there blocks no path and its
// logs reach nowhere new, so the check never grows it (growing it would only multiply the worlds).
const IGNORE_SEEDS = new Set([idx(13, 11)]);
let without = null;   // a follower the run never picks up, to prove a find needs it
function next(st, R) {
  const res = [];
  // a follower
  for (const h of C.FOLLOW) if (h !== without && !st.held.includes(h) && R.has(where[h])) { const ns = clone(st); ns.held = [...st.held, h].sort(); res.push(ns); }
  // chewing a tree down, from any side you can stand on
  // (looking for a tree and working out how it falls never changes the map, so one load is enough)
  if (st.held.includes(G)) load(st, st.at);
  if (st.held.includes(G)) for (const r of R) for (const [dx, dy] of DIRS) {
    const [x, y] = xy(r), t = C.chewTarget(x, y, dx, dy);
    if (!t) continue;
    if (C.levelAt(x, y) === 1) log.height.push(`chewed a tree from up high at ${x},${y}`);
    const f = C.fall(t[0], t[1], dx, dy);
    const ns = clone(st);
    for (const i in f.ch) ns.mod[i] = f.ch[i];
    for (const i of f.logs) if (C.level(C.ground(...xy(i))) !== 0) log.height.push(`a log landed off the ground level at ${xy(i)}`);
    ns.at = r;
    res.push(ns);
  }
  // rain growing a seed or a stump into a tree
  if (st.held.includes(D)) {
    const can = rainable(R);
    load(st, st.at);
    // A stump is only grown back when its tree's fall was wasted (no log left next to it); settle() already does that.
    // Growing back a tree whose logs still lie there would only pile up more logs, and trying that too makes the count
    // of worlds explode. So a find that could ONLY be reached by using one tree twice would be missed here.
    const grow = [...can].filter((i) => C.ground(...xy(i)) === "s" && C.RULES.seed && !IGNORE_SEEDS.has(i));
    for (const i of grow) {
      const ns = clone(st);
      if (C.mapGround(...xy(+i)) === "T") delete ns.mod[i]; else ns.mod[i] = "T";
      // you can't be standing on it: move to any other square you could reach
      if (ns.at === +i) { const o = [...R].find((q) => q !== +i); if (o === undefined) continue; ns.at = o; }
      res.push(ns);
    }
  }
  return res.map(settle);
}

// ---- every state you can be in, found by trying everything in every order ----
function explore(rules = {}, skip = null) {
  const saved = { ...C.RULES };
  Object.assign(C.RULES, rules);
  without = skip;
  compMemo.clear(); reachMemo.clear();
  const init = settle({ held: [], mod: {}, at: START });
  const states = new Map(), todo = [init];
  const tag = JSON.stringify(rules) + (skip ? " without " + skip : "");
  while (todo.length) {
    const st = todo.pop(), k = key(st);
    if (states.has(k)) continue;
    if (process.env.STOP_AT && states.size >= +process.env.STOP_AT) process.exit(3);
    if (states.size && states.size % 5000 === 0) console.log(`  ...${tag}: ${states.size} worlds so far, ${Math.round((Date.now() - t0) / 1000)} s`);
    const R = reach(st);
    const nx = next(st, R);
    const nk = [...new Set(nx.map(key))];
    states.set(k, { st, R, next: nk });
    for (const s2 of nx) if (!states.has(key(s2))) todo.push(s2);
  }
  const got = (c, v) => v.R.has(where[c]) || v.st.held.includes(c);
  const finds = (c) => [...states.values()].filter((v) => got(c, v));
  const out = { states, finds, reaches: (c) => finds(c).length > 0, got };
  Object.assign(C.RULES, saved);
  without = null;
  compMemo.clear(); reachMemo.clear();
  return out;
}
const t0 = Date.now();
const base = explore();
const all = [...base.states.values()];
console.log(`States you can be in: ${base.states.size}`);

// ---- 1. every creature can be found, and you can never lock yourself out of one ----
const back = new Map([...base.states.keys()].map((k) => [k, []]));
for (const [k, v] of base.states) for (const n of v.next) back.get(n).push(k);
const canReach = (hit) => {
  const can = new Set(hit), q = hit.slice();
  while (q.length) for (const p of back.get(q.pop())) if (!can.has(p)) { can.add(p); q.push(p); }
  return can;
};
console.log("\nNo way to lock yourself out:");
const okBefore = ok;
for (const c of ORDER) {
  const hit = [...base.states].filter(([, v]) => base.got(c, v)).map(([k]) => k);
  if (!hit.length) { fail(`${name(c)} can never be found`); continue; }
  const stuck = base.states.size - canReach(hit).size;
  if (stuck) fail(`${name(c)}: ${stuck} states can never get it any more`);
}
if (ok === okBefore) console.log("  every creature stays reachable from every state");

// ---- 2. you can always get back to the start ----
const home = [...base.states].filter(([, v]) => v.R.has(START)).map(([k]) => k);
const homeSet = canReach(home);
if (homeSet.size < all.length) {
  fail(`${all.length - homeSet.size} states can never get back to the start`);
  const one = [...base.states].find(([k]) => !homeSet.has(k));
  if (one) console.log("      e.g. at " + xy(one[1].st.at) + " holding " + one[1].st.held.join(""));
} else console.log("\nEvery state can get back to the start");

// ---- 3. each rare one needs two things used together: take either away and it can't be reached ----
console.log("\nWhat each rare one needs (each one taken away on its own):");
const WHAT = { F: "Emberfox", G: "Gnawly", D: "Drizzle", lean: "a tree leaning on a cliff", seed: "a seed grown into a tree",
  fuse: "a fallen tree catching fire", fireWind: "the wind carrying fire", drift: "the wind blowing the cloud" };
const NEEDS = {
  A: ["D", "G", "seed", "lean"],
  B: ["F", "G", "lean"],
  C: ["G", "D", "seed"],
  E: ["G", "F", "fuse", "fireWind"],
  Q: ["F", "G", "D", "seed", "fuse", "fireWind"],
};
const runs = {};
const runWithout = (t) => runs[t] || (runs[t] = C.FOLLOW.includes(t) ? explore({}, t) : explore({ [t]: false }));
for (const c of Object.keys(NEEDS)) {
  const missing = NEEDS[c].filter((t) => runWithout(t).reaches(c));
  if (missing.length) fail(`${name(c)} can be reached without ${missing.map((t) => WHAT[t]).join(", ")}`);
  else console.log(`  ${name(c).padEnd(10)} needs ${NEEDS[c].map((t) => WHAT[t]).join(" + ")}`);
}
const plain = explore({ lean: false, drift: false, fireWind: false, seed: false, fuse: false });
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k === "rare" || k === "rarest") { if (plain.reaches(c)) fail(`${name(c)} can be reached with no idea at all`); }
  else if (!plain.reaches(c)) fail(`${name(c)} (${k}) needs an idea to reach`);
}
console.log("\nHeights:");
if (log.height.length) for (const m of [...new Set(log.height)].slice(0, 6)) fail(m);
else console.log("  nobody chews, burns or lays a log across a height change");

// ---- 4. each follower has a plain use first ----
console.log("\nPlain uses:");
const TEACH = { F: "a", G: "c", D: "k" };
for (const h of C.FOLLOW) {
  const t = TEACH[h];
  const needs = plain.finds(t).every((v) => v.st.held.includes(h)) && base.finds(t).every((v) => v.st.held.includes(h));
  if (plain.reaches(t) && needs) console.log(`  ${name(h).padEnd(9)} opens the way to ${name(t)}`);
  else fail(`${name(h)}: ${name(t)} is ${plain.reaches(t) ? "reachable without it" : "not reachable with it and no idea"}`);
}

// ---- 5. trails: on ground you stand on, ending near the den ----
console.log("\nTrails:");
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k !== "rare" && k !== "rarest") continue;
  const t = C.TRAILS[c];
  if (!t) { fail(`${name(c)} has no trail`); continue; }
  for (const [x, y] of t) if (!".,".includes(C.mapGround(x, y)) || C.creatureAt(x, y)) fail(`${name(c)}'s trail sits on '${C.mapGround(x, y)}' at ${x},${y}`);
  const [lx, ly] = t[t.length - 1], [dx, dy] = xy(where[c]);
  if ((lx - dx) ** 2 + (ly - dy) ** 2 > 64) fail(`${name(c)}'s trail ends far from its den`);
  else if (!base.finds(c).length || !all.some((v) => t.some(([x, y]) => v.R.has(idx(x, y))))) fail(`${name(c)}'s trail can't be walked to`);
  else console.log(`  ${name(c).padEnd(10)} trail ends near its den`);
}

// ---- 6. words: walls, signs and creature lines never say what to do ----
const trick = /wind|blow|drift|spark|jump|burn|fire|lean|chew|fell|grow|cloud|rain|need|someone|light/i;
// a follower's lines say only how it looks, never what it does
const trickHelper = /wind|blow|drift|spark|jump|lean|grow|cliff|bridge|vine|burn|fire|light|chew|tree|bramble|rain|water|seed|sprout/i;
for (const [g, t] of Object.entries(C.BLOCKED_HINT)) if (trick.test(t)) fail(`the '${g}' wall says what to do: "${t}"`);
for (const s of C.SIGNS) if (trick.test(s.line)) fail(`a sign says what to do: "${s.line}"`);
for (const c of ORDER) {
  const cr = CREATURES[c];
  if (cr.kind === "helper") { if (trickHelper.test(cr.line + " " + cr.after)) fail(`${cr.name}'s lines give away a trick`); }
  else if (trick.test(cr.line)) fail(`${cr.name}'s line gives away a trick: "${cr.line}"`);
}
for (const k in C.TRAILS) if (trick.test(src.match(new RegExp(`${k}: \\["\\w+", "([^"]+)"\\]`))?.[1] || "")) fail(`${name(k)}'s trail line gives away a trick`);

// ---- 7. each stuck sign can actually show ----
for (const s of C.SIGNS) {
  const shows = all.some((v) => { load(v.st, v.st.at); return s.want() && v.R.size; });
  if (!shows) fail(`the sign at ${s.at} never shows`);
}

// ---- 8. for reading: followers per find, and how long a walk through every find is ----
console.log("\nFewest followers per find:");
for (const c of ORDER) {
  let best = null;
  for (const v of all) if (v.R.has(where[c]) && (!best || v.st.held.length < best.length)) best = v.st.held;
  if (best) console.log(`  ${CREATURES[c].kind.padEnd(6)} ${name(c).padEnd(10)} ${best.length}  (${best.join("") || "-"})`);
}
// the most open world there is, and a nearest-first walk from the start through every find
const open = all.reduce((p, v) => (v.R.size > p.R.size ? v : p));
load(open.st, open.st.at);
function dist(from) {
  const d = new Map([[from, 0]]), q = [from];
  while (q.length) { const i = q.shift(); for (const [n] of C.moves(...xy(i))) if (!d.has(n)) { d.set(n, d.get(i) + 1); q.push(n); } }
  return d;
}
let at = START, steps = 0;
const left = new Set(ORDER.map((c) => where[c]));
while (left.size) {
  const d = dist(at);
  let best = null;
  for (const t of left) if (d.has(t) && (best === null || d.get(t) < d.get(best))) best = t;
  if (best === null) break;
  steps += d.get(best); left.delete(best); at = best;
}
console.log(`\nWalking every find in the nearest-first order: ${steps} steps (about ${Math.round(steps * 0.25 / 60 * 10) / 10} min of walking alone).`);
console.log(`At the start you can walk to ${reach(settle({ held: [], mod: {}, at: START })).size} squares. Check took ${Math.round((Date.now() - t0) / 1000)} s.`);
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
process.exitCode = ok ? 0 : 1;
