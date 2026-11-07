// Checks sketches/map-8 before Tu plays. Usage: node check-map8.js <path to index.html>
// It runs the page's own rules (the block between CORE START and CORE END), so the check and the game can't disagree.
// SPOILERS: this file names every trick on map 8. Tu should not read it before playing.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("// ==== CORE START"), b = src.indexOf("// ==== CORE END");
if (a < 0 || b < 0) throw new Error("CORE START / CORE END markers not found");
const C = new Function(src.slice(a, b) + `
return { MAP, RULES, CREATURES, ORDER, GIVER, TRAILS, BLOCKED_HINT, SIGNS, W, H, idx, xy, inside, DIRS, start,
  PLANK_HOME, RAM_HOME, HIGH, WASH, mapGround, baseGround, ground, passable, levelAt, stepFrom, moves, ramSees, ramRun,
  fresh, setS: (s) => { S = s; } };`)();
const { W, H, idx, xy, DIRS, CREATURES, ORDER } = C;

let ok = true;
const fail = (m) => { ok = false; console.log("FAIL  " + m); };

// ---- 0. the map is drawn right ----
if (C.MAP.length !== H) fail("map height is off");
C.MAP.forEach((r, y) => { if (r.length !== W) fail(`row ${y} is ${r.length} wide, not ${W}`); });
const where = {};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (CREATURES[C.MAP[y][x]]) where[C.MAP[y][x]] = idx(x, y);
for (const k of Object.keys(CREATURES)) { if (where[k] === undefined) fail(`${k} is not on the map`); if (!ORDER.includes(k)) fail(`${k} is not in the book`); }
// every creature needs a drawing named sp-<its map letter>, because the page looks the picture up by that letter
for (const k of Object.keys(CREATURES)) {
  if (!src.includes(`<symbol id="sp-${k}"`)) fail(`${name0(k)} (${k}) has no drawing: no <symbol id="sp-${k}">`);
}
function name0(k) { return CREATURES[k].name; }
if (C.RAM_HOME < 0) fail("the ram has no home");
if (C.PLANK_HOME.length < 2) fail("fewer than two planks");
const START = idx(C.start.x, C.start.y);
const helpers = ORDER.filter((k) => CREATURES[k].kind === "helper");
const name = (k) => CREATURES[k].name;
const H_ = C.GIVER.carry;

// ---- a world: helpers held, wood broken, planks laid over deep water, the sea, and a plank you rode up on ----
// Planks are never lost (the ram can always open the pen, a glide or a wave always gets you out), so holding the
// carry helper means a plank is to hand. Planks lying on dry ground are just ground, so they aren't tracked.
const wkey = (st) => [st.held.join(""), st.broken.slice().sort((p, q) => p - q).join(","),
  st.bridges.slice().sort((p, q) => p - q).join(","), st.level, st.raft].join("|");
function load(st, at) {
  const s = C.fresh();
  s.seen.fill(1);
  s.found = st.held.slice();
  s.broken = st.broken.slice();
  s.planks = st.bridges.concat(st.raft >= 0 ? [st.raft] : []);
  s.level = st.level;
  s.x = at % W; s.y = Math.floor(at / W);
  C.setS(s);
  return s;
}
// squares you can walk between both ways count as one place
const compMemo = new Map();
function comps(st) {
  const wk = wkey(st);
  if (compMemo.has(wk)) return compMemo.get(wk);
  load(st, START);
  const comp = new Int32Array(W * H).fill(-1);
  const walkTo = (i, dx, dy) => { const [x, y] = xy(i), r = C.stepFrom(x, y, dx, dy); return r.kind === "walk" ? r.to : -1; };
  for (let i = 0; i < W * H; i++) {
    if (comp[i] >= 0 || !C.passable(...xy(i))) continue;
    comp[i] = i;
    const q = [i];
    while (q.length) {
      const p = q.pop();
      for (const [dx, dy] of DIRS) {
        const n = walkTo(p, dx, dy);
        if (n < 0 || comp[n] >= 0 || walkTo(n, -dx, -dy) !== p) continue;
        comp[n] = i; q.push(n);
      }
    }
  }
  compMemo.set(wk, comp);
  return comp;
}
const key = (st) => wkey(st) + "|" + comps(st)[st.at];
// everything you can get to from where you are, by walking and gliding
const reachMemo = new Map();
function reach(st) {
  const k = key(st);
  if (reachMemo.has(k)) return reachMemo.get(k);
  load(st, st.at);
  const seen = new Set([st.at]), q = [st.at], glides = [];
  while (q.length) {
    const i = q.shift();
    for (const [n, kind] of C.moves(...xy(i))) {
      if (kind === "glide") glides.push([i, n]);
      if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  const out = { R: seen, glides };
  reachMemo.set(k, out);
  return out;
}
const clone = (st) => ({ held: st.held.slice(), broken: st.broken.slice(), bridges: st.bridges.slice(), level: st.level, raft: st.raft, at: st.at });
// can you find creature k in this state?
function got(k, st, R) {
  if (!R.has(where[k])) return false;
  if (CREATURES[k].on === ":") { load(st, st.at); if (C.baseGround(...xy(where[k])) !== ":") return false; }
  return true;
}
// deep squares a plank can lie across: ground on both sides
const ACROSS = [];
for (let i = 0; i < W * H; i++) {
  const [x, y] = xy(i);
  if (C.mapGround(x, y) !== "~") continue;
  for (const [dx, dy] of DIRS) if (C.inside(x - dx, y - dy) && C.inside(x + dx, y + dy) && !"~tx".includes(C.mapGround(x - dx, y - dy)) && !"~tx".includes(C.mapGround(x + dx, y + dy))) { ACROSS.push(i); break; }
}
const log = { ramBreaks: [], ramHeight: [] };
// two squares at different heights with no ramp between them can't be crossed by anyone, the ram included
const sameHeight = (a, b) => a === null || b === null || a === b;
function next(st, R) {
  const res = [];
  // a helper
  for (const h of helpers) if (!st.held.includes(h) && got(h, st, R)) { const ns = clone(st); ns.held = [...st.held, h].sort(); res.push(ns); }
  // the sea turns. Standing on bare sand flats as it comes in: ride up on a plank, or a wave drops you on the beach.
  // The plank you last left on the flats stays there, and rides up again at every high sea.
  const nl = st.level ? 0 : C.HIGH;
  for (const p of R) {
    load(st, p);
    if (nl === 0) { const ns = clone(st); ns.level = 0; ns.at = p; res.push(ns); continue; }
    if (C.baseGround(...xy(p)) === ":") {
      if (C.RULES.float && (p === st.raft || st.held.includes(H_))) { const ns = clone(st); ns.level = nl; ns.raft = p; ns.at = p; res.push(ns); }
      if (p !== st.raft || !C.RULES.float) { const ns = clone(st); ns.level = nl; ns.at = C.WASH.get(p); res.push(ns); }
    } else { const ns = clone(st); ns.level = nl; ns.at = p; res.push(ns); }
  }
  // the ram runs at you from wherever it can see you
  for (const p of R) {
    load(st, p);
    const dir = C.ramSees(...xy(p));
    if (!dir) continue;
    const run = C.ramRun(dir);
    // where the ram stands when it hits something, and what it hits: the height must match (same rule as yours)
    const lastAt = run.path.length ? run.path[run.path.length - 1] : C.RAM_HOME;
    const hitAt = run.broke !== undefined ? run.broke : run.hit ? p : -1;
    if (hitAt >= 0 && !sameHeight(C.levelAt(...xy(lastAt)), C.levelAt(...xy(hitAt)))) {
      log.ramHeight.push({ from: lastAt, to: hitAt, what: run.hit ? "hit you" : "broke wood", level: st.level });
    }
    const full = [C.RAM_HOME, ...run.path];
    for (let k = 1; k < full.length; k++) {
      if (!sameHeight(C.levelAt(...xy(full[k - 1])), C.levelAt(...xy(full[k])))) log.ramHeight.push({ from: full[k - 1], to: full[k], what: "ran across an edge", level: st.level });
    }
    if (run.broke !== undefined) {
      const ns = clone(st); ns.broken = [...st.broken, run.broke]; ns.at = p; res.push(ns);
      log.ramBreaks.push({ at: run.broke, level: st.level });
    } else if (run.hit) { const ns = clone(st); ns.at = run.knock; res.push(ns); }
  }
  // a plank laid over deep water
  if (st.held.includes(H_)) for (const D of ACROSS) {
    if (st.bridges.includes(D)) continue;
    const [x, y] = xy(D);
    load(st, st.at);
    for (const [dx, dy] of DIRS) {
      const bank = idx(x - dx, y - dy), far = [x + dx, y + dy];
      if (!R.has(bank) || C.levelAt(...xy(bank)) !== 0 || !C.inside(...far)) continue;
      if (!C.passable(...far) || C.levelAt(...far) !== 0 || "~W".includes(C.baseGround(...far))) continue;
      const ns = clone(st); ns.bridges = [...st.bridges, D]; res.push(ns); break;
    }
  }
  return res;
}

// ---- every state you can be in, found by trying everything in every order ----
function explore(rules = {}) {
  const saved = { ...C.RULES };
  Object.assign(C.RULES, rules);
  compMemo.clear(); reachMemo.clear();
  const init = { held: [], broken: [], bridges: [], level: 0, raft: -1, at: START };
  const states = new Map(), todo = [init];
  while (todo.length) {
    const st = todo.pop(), k = key(st);
    if (states.has(k)) continue;
    const { R, glides } = reach(st);
    const nx = next(st, R);
    const nk = [...new Set(nx.map(key))];
    states.set(k, { st, R, glides, next: nk });
    for (const s2 of nx) if (!states.has(key(s2))) todo.push(s2);
  }
  const finds = (c) => [...states.values()].filter((v) => got(c, v.st, v.R) || v.st.held.includes(c));
  const out = { states, finds, reaches: (c) => finds(c).length > 0 };
  Object.assign(C.RULES, saved);
  return out;
}
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
  const hit = [...base.states].filter(([, v]) => got(c, v.st, v.R) || v.st.held.includes(c)).map(([k]) => k);
  if (!hit.length) { fail(`${name(c)} can never be found`); continue; }
  const stuck = base.states.size - canReach(hit).size;
  if (stuck) fail(`${name(c)}: ${stuck} states can never get it any more`);
}
if (ok === okBefore) console.log("  every creature stays reachable from every state");

// ---- 2. you can always get back to the start (after a glide, a wave, or a bump from the ram) ----
const home = [...base.states].filter(([, v]) => v.R.has(START)).map(([k]) => k);
const lost = all.length - canReach(home).size;
if (lost) {
  fail(`${lost} states can never get back to the start`);
  const one = [...base.states].find(([k]) => !canReach(home).has(k));
  if (one) console.log("      e.g. " + one[0] + " at " + xy(one[1].st.at));
} else console.log("\nEvery state can get back to the start");

// ---- 3. each rare one needs its idea, and has its ways ----
console.log("\nEach rare one's ways:");
const noRam = explore({ ram: false });
const noFloat = explore({ float: false });
const raftGlideOnly = explore({ ram: false, raftStep: false });
const noRaftGlide = explore({ raftGlide: false, ram: false });
const plain = explore({ ram: false, float: false });
// Burrlamb: in the pen. (a) ride a plank up on the sea beside the ridge; (b) the ram splinters the crates on the stairs.
if (noRam.reaches("A")) console.log(`  ${name("A").padEnd(11)} way a: with no ram, by riding a plank up on the sea`); else fail(`${name("A")} can't be reached without the ram`);
if (noFloat.reaches("A")) console.log(`  ${"".padEnd(11)} way b: with nothing riding up, by the ram opening the stairs`); else fail(`${name("A")} can't be reached without a plank riding up`);
if (plain.reaches("A")) fail(`${name("A")} can be reached with no idea at all`);
// Isleowl: on the island. (a) glide off a plank that rode up; (b) glide off the ridge.
if (raftGlideOnly.reaches("B")) console.log(`  ${name("B").padEnd(11)} way a: gliding off a plank that rode up, never stepping up off it`); else fail(`${name("B")} can't be reached by gliding off a plank alone`);
if (noFloat.reaches("B")) console.log(`  ${"".padEnd(11)} way b: with nothing riding up, gliding off the ridge`); else fail(`${name("B")} can't be reached from the ridge`);
if (plain.reaches("B")) fail(`${name("B")} can be reached with no idea at all`);
// Lanternray: in the wreck. Only the ram, and only while the sea is out. A plank riding up beside the wreck is a dead end.
if (noRam.reaches("C")) fail(`${name("C")} can be reached without the ram`);
else console.log(`  ${name("C").padEnd(11)} only with the ram; a plank riding up beside the wreck never gets in`);
const hullBreaks = log.ramBreaks.filter((r) => C.mapGround(...xy(r.at)) === "w");
if (!hullBreaks.length) fail("the ram never splinters the wreck");
else if (hullBreaks.some((r) => r.level !== 0)) fail("the ram splinters the wreck while the sea is in");
else console.log(`  ${"".padEnd(11)} the ram only gets to the wreck while the sea is out`);
if (noRaftGlide.reaches("B") && !noRam.reaches("C")) { /* fine */ }
// the ram follows your height rule: it never runs, hits you or breaks wood across a height change
console.log("\nThe ram and heights:");
if (log.ramHeight.length) {
  const seenWhat = new Set();
  for (const r of log.ramHeight) {
    const m = `${r.what}: ${xy(r.from)} -> ${xy(r.to)}`;
    if (seenWhat.has(m)) continue;
    seenWhat.add(m);
    if (seenWhat.size <= 6) fail(`the ram ${m}`);
  }
  if (seenWhat.size > 6) fail(`... and ${seenWhat.size - 6} more height breaks by the ram`);
} else console.log("  the ram never crosses, hits or breaks anything across a height change");
// plain ones and helpers need no idea
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k !== "rare" && k !== "rarest" && !plain.reaches(c)) fail(`${name(c)} (${k}) needs an idea to reach`);
}

// ---- 4. each helper, and the sea, has a plain use first ----
console.log("\nPlain uses:");
const TEACH = { H: "n", G: "q" };
for (const h of helpers) {
  const t = TEACH[h];
  const needs = plain.finds(t).every((v) => v.st.held.includes(h)) && base.finds(t).every((v) => v.st.held.includes(h));
  if (plain.reaches(t) && needs) console.log(`  ${name(h).padEnd(8)} opens the way to ${name(t)}`);
  else fail(`${name(h)}: ${name(t)} is ${plain.reaches(t) ? "reachable without it" : "not reachable with it and no idea"}`);
}
const pool = plain.finds("r");
if (pool.length && pool.every((v) => v.st.level === 0)) console.log(`  the sea    going out opens the way to ${name("r")}`);
else fail(`${name("r")} isn't a plain low-sea find`);

// ---- 5. trails: on ground you stand on, ending near the den ----
console.log("\nTrails:");
for (const c of ORDER) {
  const k = CREATURES[c].kind;
  if (k !== "rare" && k !== "rarest") continue;
  const t = C.TRAILS[c];
  if (!t) { fail(`${name(c)} has no trail`); continue; }
  for (const [x, y] of t) if (!".,;:/hj".includes(C.mapGround(x, y))) fail(`${name(c)}'s trail sits on '${C.mapGround(x, y)}' at ${x},${y}`);
  const [lx, ly] = t[t.length - 1], [dx, dy] = xy(where[c]);
  if ((lx - dx) ** 2 + (ly - dy) ** 2 > 25) fail(`${name(c)}'s trail ends far from its den`);
  else console.log(`  ${name(c).padEnd(11)} trail ends near its den`);
}

// ---- 6. words: walls, signs and creature lines never say what to do ----
const trick = /tide|float|rise|raft|charge|lure|break|smash|plank|bridge|glide|carry|need|someone/i;
const trickHelper = /tide|float|rise|raft|\bram\b|charge|lure|break|smash|bridge/i;
for (const [g, t] of Object.entries(C.BLOCKED_HINT)) if (trick.test(t)) fail(`the '${g}' wall says what to do: "${t}"`);
for (const s of C.SIGNS) if (trick.test(s.line) || /\bram\b/i.test(s.line)) fail(`a sign says what to do: "${s.line}"`);
for (const c of ORDER) {
  const cr = CREATURES[c];
  if (cr.kind === "helper") { if (trickHelper.test(cr.line + " " + cr.after)) fail(`${cr.name}'s lines give away a trick`); }
  else if (trick.test(cr.line)) fail(`${cr.name}'s line gives away a trick: "${cr.line}"`);
}

// ---- 7. each stuck sign can actually show ----
for (const s of C.SIGNS) {
  const shows = all.some((v) => { load(v.st, v.st.at); return s.want(); });
  if (!shows) fail(`the sign at ${s.at} never shows`);
}

// ---- 8. how much each find takes (for reading, not pass/fail) ----
console.log("\nFewest helpers per find:");
for (const c of ORDER) {
  let best = null;
  for (const v of all) if (got(c, v.st, v.R) && (!best || v.st.held.length < best.length)) best = v.st.held;
  if (best) console.log(`  ${CREATURES[c].kind.padEnd(6)} ${name(c).padEnd(11)} ${best.length}  (${best.join("") || "-"})`);
}
const init = all.find((v) => v.st.held.length === 0 && v.st.level === 0 && !v.st.broken.length && v.R.has(START));
console.log(`\nAt the start you can walk to ${init ? init.R.size : "?"} squares.`);
console.log(ok ? "\nALL CHECKS PASS" : "\nSOME CHECKS FAILED");
process.exitCode = ok ? 0 : 1;
