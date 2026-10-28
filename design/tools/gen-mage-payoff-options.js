// Generates canvas set 12.1 to 12.4: how the Mage payoff runes look (2026-10-28; options, awaiting Tu's pick).
//   12.1A-C  the Overload cascade: three mages' orbs merge on the same beat
//   12.2A-C  Kernel's charge: how the core orb shows it is storing up, and how it dumps into the shot
//   12.3A-B  Static's spread: the merged Storm shot strikes every other enemy
//   12.4A-B  the setup runes (Echo, Leech, Tempo): how each shows which rune did it
// Run:  node design/tools/gen-mage-payoff-options.js     (writes ten frames and patches canvas.json)
// The toolkit comes from gen-army-fights.js (it exports it when required). Every number is made up for the picture; the way it looks is
// what is being judged. Every animated part keeps its key moment as its plain (animation off) style, so a frame reads as a still
// (MISTAKES.md 2026-10-14 #1). The scene is 12.0D's fight (the Vanguard, three Outriders, Bram / Ivy / Sol) a moment before the merge.

const fs = require("fs");
const path = require("path");
const G = require("./gen-army-fights.js");
const { makeCtx, abs, win, frontLine, outriders, vanguard, ally, beam, floater, ring, chip, coreOrb, orbRing, orbAt, mergedOrb, bolt, steppedCharge, rowLabels, UNIT_HEX, YEL, RED } = G;

const CANVAS = path.join(__dirname, "..", "canvas");
const GOLD = "#ffe36a", FROST = "#8fd3ff", LIFE = "#6ee7a0", WHITE = "#e8e8ee";
// the cast: a core orb at each mage's left, the loose orbs round the body, the merged orb where it forms
const FR = { cx: 163, cy: 193, r: 30, name: "Bram", color: FROST }, ST = { cx: 100, cy: 316, r: 29, name: "Ivy", color: GOLD }, LI = { cx: 226, cy: 316, r: 29, name: "Sol", color: LIFE };
const MERGED = { [FR.name]: [200, 196], [ST.name]: [100, 272], [LI.name]: [226, 272] };
const VANc = [194, 76], O1c = [60, 84], O2c = [122, 84], O3c = [266, 81];
const M = 40; // the % of the loop at which the first merge begins (a 12 s loop)

// the whole fight, a moment before the merge: loose orbs out on every mage, the Vanguard at full, the squad quiet.
// `merge` = which mages' orbs merge, as { name: at% } (the orbs fly to the merged place and become the merged orb);
// the others keep their loose orbs. `loose` = how many loose orbs a mage holds (Fuse: 2).
function scene(C, { merge = {}, loose = 2, vanStops = null, vanPct = 100, vanHp = "699/699", cores = null, extra = "" }) {
  let h = frontLine() + outriders(C);
  h += vanguard(C, vanStops, vanPct, vanHp);
  const bar = (cx, y, v) => steppedCharge(C, { cx, y, start: v, list: [], still: v });
  h += ally(C, "frost", { cx: 163, top: 174, size: 38, name: "Bram", hpW: 40, chargeEl: bar(163, 233, 40) });
  h += ally(C, "storm", { cx: 100, top: 298, size: 36, name: "Ivy", hpW: 40, chargeEl: bar(100, 355, 34) });
  h += ally(C, "life", { cx: 226, top: 298, size: 36, name: "Sol", hpW: 40, chargeEl: bar(226, 355, 48) });
  h += cores ? cores : [FR, ST, LI].map((m) => coreOrb(C, { cx: m.cx, cy: m.cy, r: m.r, color: m.color, ang: 180 })).join("");
  const angles = [-150, -30, 0, -90].slice(0, loose);
  [FR, ST, LI].forEach((m) => {
    const at = merge[m.name];
    const items = angles.map((a, i) => [a, 2 + i * 1.5]);
    h += orbRing(C, { cx: m.cx, cy: m.cy, r: m.r, color: m.color, items, mergeAt: at ?? null, mergeTo: at === undefined ? null : MERGED[m.name], shownInStill: at === undefined });
    if (at !== undefined) h += mergedOrb(C, { cx: MERGED[m.name][0], cy: MERGED[m.name][1], at: at + 0.8, flare: at + 2.6, end: at + 6, color: m.color, edge: m.name === "Ivy" ? "#ff9f1c" : m.name === "Bram" ? "#2f7fbf" : "#1b8a55" });
  });
  return h + extra + rowLabels();
}
// what a merged shot does, per mage, at `at` % (the key moment is the still: show true)
const stormShot = (C, at, mult = 1, show = true) =>
  bolt(C, { x1: MERGED.Ivy[0], y1: MERGED.Ivy[1] - 6, x2: VANc[0], y2: 94, color: GOLD, at: at + 2.6, w: 3 + (mult > 1 ? 1.5 : 0), show }) +
  floater(C, { x: 240, y: 30, text: `−${80 * mult}`, color: "#fff4b0", at: at + 3.4, size: mult > 1 ? 26 : 20, glow: GOLD, show }) + ring(C, { cx: VANc[0], cy: 68, r: 40, color: GOLD, at: at + 3, dur: 8 });
const frostShot = (C, at, show = true) =>
  [[FR.cx, 170], [ST.cx, 296], [LI.cx, 296]].map(([x, y]) => floater(C, { x: x + 30, y: y - 6, text: "⛊+45", color: FROST, at: at + 3, size: 11, glow: "#4da6ff", show })).join("") +
  [O1c, O2c, O3c, VANc].map((p) => ring(C, { cx: p[0], cy: p[1] - 8, r: 22, color: FROST, at: at + 3, dur: 8 })).join("") +
  chip(C, { x: 4, y: 118, text: "❄ ALL FROZEN 1.5 S", color: FROST, stops: win(at + 3, at + 14, 1.3), base: show ? 1 : 0 });
const lifeShot = (C, at, show = true) =>
  beam(C, { x1: MERGED.Sol[0], y1: MERGED.Sol[1] - 6, x2: VANc[0], y2: 94, color: LIFE, at: at + 2.6, w: 4, dur: 6, show }) +
  floater(C, { x: 236, y: 52, text: "−45", color: "#d6ffe6", at: at + 3.4, size: 15, glow: LIFE, show }) +
  [[FR.cx + 28, 200], [88, 296], [248, 322]].map(([x, y]) => floater(C, { x, y, text: "+15", color: LIFE, at: at + 4, size: 11, glow: "#1b8a55", show })).join("");
const word = (C, text, color, stops, y = 252, show = false) => chip(C, { x: 4, y, text, color, stops, base: show ? 1 : 0 });
const rules = (lines) => lines.map(([color, y, text]) => chip(G.makeCtx("r"), { x: 4, y, text, color, stops: [[0, "opacity:1"], [100, "opacity:1"]], base: 1 })).join("");

// ---------- 12.1 The cascade: Overload ----------
// Setup: Bram, Ivy and Sol each hold two loose orbs (Fuse). Ivy's hit finds hers full and merges them; Overload makes the other two merge too.
function cascadeA(C) {
  // all three merge on the same beat; one banner says so
  let h = scene(C, { merge: { Ivy: M, Bram: M, Sol: M } });
  h += stormShot(C, M) + frostShot(C, M) + lifeShot(C, M);
  h += ring(C, { cx: 163, cy: 250, r: 150, color: "#fff", at: M + 2.6, dur: 7 });
  h += chip(C, { x: 4, y: 232, text: "OVERLOAD: ALL THREE MERGE ON ONE BEAT", color: GOLD, stops: win(M + 1, M + 16, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "ONE PLAIN BEAT, THREE GREAT SHOTS AT ONCE"], [GOLD, 377, "NEEDS EVERY OTHER MAGE TO HOLD 2 LOOSE ORBS"]]);
}
function cascadeB(C) {
  // a ripple: Ivy merges first, then a thread jumps to Bram and on to Sol, each merging a beat after the one before
  let h = scene(C, { merge: { Ivy: M, Bram: M + 4, Sol: M + 8 } });
  h += stormShot(C, M) + frostShot(C, M + 4) + lifeShot(C, M + 8);
  h += beam(C, { x1: MERGED.Ivy[0], y1: MERGED.Ivy[1], x2: MERGED.Bram[0], y2: MERGED.Bram[1], color: GOLD, at: M + 2.8, w: 2.5, dur: 5, show: true });
  h += beam(C, { x1: MERGED.Bram[0], y1: MERGED.Bram[1], x2: MERGED.Sol[0], y2: MERGED.Sol[1], color: FROST, at: M + 6.8, w: 2.5, dur: 5, show: true });
  h += ring(C, { cx: MERGED.Ivy[0], cy: MERGED.Ivy[1], r: 30, color: GOLD, at: M + 2.6, dur: 6 }) + ring(C, { cx: MERGED.Bram[0], cy: MERGED.Bram[1], r: 30, color: FROST, at: M + 6.6, dur: 6 });
  h += chip(C, { x: 4, y: 232, text: "OVERLOAD: ONE MERGE SETS OFF THE NEXT", color: GOLD, stops: win(M + 1, M + 18, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "IVY › BRAM › SOL, A SHORT BEAT APART"], [GOLD, 377, "NEEDS EVERY OTHER MAGE TO HOLD 2 LOOSE ORBS"]]);
}
function cascadeC(C) {
  // all three on one beat, the whole arena flashes and a banner names it
  let h = scene(C, { merge: { Ivy: M, Bram: M, Sol: M } });
  h += stormShot(C, M) + frostShot(C, M) + lifeShot(C, M);
  const flash = C.kf([[0, "opacity:0"], [M + 2.4, "opacity:0"], [M + 3, "opacity:0.5"], [M + 6, "opacity:0"], [100, "opacity:0"]]);
  h += abs(`left:-16px;top:-16px;width:358px;height:424px;background:radial-gradient(circle at 50% 55%,#fff,${GOLD} 45%,transparent 75%);z-index:5;pointer-events:none;opacity:0.18;${flash}`);
  const banner = C.kf([[0, "opacity:0;transform:translate(-50%,0) scale(0.6)"], [M + 2.6, "opacity:0;transform:translate(-50%,0) scale(0.6)"], [M + 4, "opacity:1;transform:translate(-50%,0) scale(1.15)"], [M + 14, "opacity:1;transform:translate(-50%,0) scale(1)"], [M + 17, "opacity:0;transform:translate(-50%,0) scale(1)"], [100, "opacity:0"]]);
  h += abs(`left:163px;top:150px;font-size:26px;font-weight:900;letter-spacing:0.08em;color:${GOLD};text-shadow:0 0 12px ${GOLD},0 2px 4px #000;white-space:nowrap;z-index:6;transform:translate(-50%,0);${banner}`, "OVERLOAD ×3");
  return h + rules([[WHITE, 362, "A FLASH, A BANNER, THREE SHOTS AT ONCE"], [GOLD, 377, "NEEDS EVERY OTHER MAGE TO HOLD 2 LOOSE ORBS"]]);
}

// ---------- 12.2 Kernel's charge ----------
// Setup: Ivy (Storm Mage) holds Kernel. Her core orb stores one charge per beat, ten at most; a merge before it is full spends nothing; at ten
// the next merged shot is four times bigger. All three show the same fight: charge builds from 8% to 33%, Ivy's hit merges at 40%, the shot is -320.
const BEATS = [8, 14, 20, 26, 32]; // the % at which a core beat stores a charge (the picture shows 5 of the 10, then jumps to full for the story)
const kernelShot = (C, extra = "") => stormShot(C, M, 4) + extra;
function kernelA(C) {
  // ten pips round the core orb fill one by one; full, the ring glows; the merge drains the pips into the shot
  const cores = [FR, LI].map((m) => coreOrb(C, { cx: m.cx, cy: m.cy, r: m.r, color: m.color, ang: 180 })).join("") + coreOrb(C, { cx: ST.cx, cy: ST.cy, r: ST.r, color: GOLD, ang: 180, pulses: BEATS });
  const [cx, cy] = orbAt(ST.cx, ST.cy, ST.r, 180);
  let pips = "";
  for (let i = 0; i < 10; i++) {
    const a = -90 + i * 36, [px, py] = orbAt(cx, cy, 14, a);
    const at = 4 + i * 3.4; // all ten full by 38%
    const stops = [[0, "opacity:0.25;background:#2a2e3a"], [at - 0.1, "opacity:0.25;background:#2a2e3a"], [at + 0.5, `opacity:1;background:${GOLD}`], [M + 2.4, `opacity:1;background:${GOLD}`], [M + 3.4, "opacity:0.25;background:#2a2e3a"], [100, "opacity:0.25;background:#2a2e3a"]];
    pips += abs(`left:${(px - 2.2).toFixed(1)}px;top:${(py - 2.2).toFixed(1)}px;width:4.4px;height:4.4px;border-radius:50%;opacity:1;background:${GOLD};box-shadow:0 0 4px ${GOLD};z-index:5;${C.kf(stops)}`);
  }
  let h = scene(C, { merge: { Ivy: M }, cores });
  h += abs("left:0;top:0;width:0;height:0;", pips);
  const glow = C.kf([[0, "opacity:0"], [37, "opacity:0"], [38.5, "opacity:1"], [M + 2.4, "opacity:1"], [M + 3.4, "opacity:0"], [100, "opacity:0"]]);
  h += abs(`left:${(cx - 19).toFixed(1)}px;top:${(cy - 19).toFixed(1)}px;width:38px;height:38px;border-radius:50%;border:2px solid ${GOLD};box-shadow:0 0 12px 3px ${GOLD};z-index:5;opacity:1;${glow}`);
  h += kernelShot(C, floater(C, { x: 70, y: 292, text: "KERNEL FULL", color: GOLD, at: 38.5, size: 10, glow: GOLD, show: false }));
  h += chip(C, { x: 4, y: 232, text: "CORE ORB: 1 PIP A BEAT, 10 TO FILL", color: GOLD, stops: win(4, 38, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "FULL: THE MERGE SPENDS ALL 10, ×4", color: GOLD, stops: win(38.5, 58, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "PIPS ON THE CORE ORB FILL, THEN EMPTY INTO THE SHOT"], [GOLD, 377, "A MERGE BEFORE FULL KEEPS THE PIPS"]]);
}
function kernelB(C) {
  // a small bar under Ivy's skill bar counts the charge: KERNEL 5/10 … 10/10, gold and flashing at full, empty after the shot
  let h = scene(C, { merge: { Ivy: M } });
  const bx = 4, by = 340; // left of Ivy, clear of her core orb and of the two rule lines at the foot
  const fill = C.kf([[0, "width:0"], [4, "width:0"], [38, "width:100%"], [M + 2.4, "width:100%"], [M + 3.4, "width:0"], [100, "width:0"]]);
  h += abs(`left:${bx}px;top:${by}px;width:48px;height:5px;border-radius:3px;background:#2a2e3a;overflow:hidden;`, `<div style="height:100%;width:100%;background:${GOLD};box-shadow:0 0 5px ${GOLD};${fill}"></div>`);
  h += abs(`left:${bx}px;top:${by - 12}px;font-size:8px;font-weight:800;color:${GOLD};white-space:nowrap;letter-spacing:.04em;`, "KERNEL 10/10");
  h += kernelShot(C);
  h += chip(C, { x: 4, y: 232, text: "KERNEL: ONE CHARGE A CORE BEAT", color: GOLD, stops: win(4, 38, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "FULL: NEXT SHOT ×4, THEN EMPTY", color: GOLD, stops: win(38.5, 58, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "A BAR UNDER THE SKILL BAR COUNTS THE CHARGE"], [GOLD, 377, "A MERGE BEFORE FULL KEEPS THE CHARGE"]]);
}
function kernelC(C) {
  // the core orb itself swells as it stores, turning white-hot at full, and shrinks back when the shot leaves
  const [cx, cy] = orbAt(ST.cx, ST.cy, ST.r, 180);
  const grow = C.kf([[0, "transform:scale(1)"], [4, "transform:scale(1)"], [38, "transform:scale(2.6)"], [M + 2.4, "transform:scale(2.6)"], [M + 3.4, "transform:scale(1)"], [100, "transform:scale(1)"]]);
  const hot = C.kf([[0, `background:${GOLD}`], [4, `background:${GOLD}`], [38, "background:#fff"], [M + 2.4, "background:#fff"], [M + 3.4, `background:${GOLD}`], [100, `background:${GOLD}`]]);
  const cores = [FR, LI].map((m) => coreOrb(C, { cx: m.cx, cy: m.cy, r: m.r, color: m.color, ang: 180 })).join("") +
    abs(`left:${(cx - 7).toFixed(1)}px;top:${(cy - 7).toFixed(1)}px;width:14px;height:14px;border-radius:50%;background:#fff;border:1px solid #fff;box-shadow:0 0 0 2px #14161c,0 0 0 3.5px ${GOLD},0 0 14px 6px ${GOLD};z-index:4;transform:scale(2.6);${grow}${hot}`);
  let h = scene(C, { merge: { Ivy: M }, cores });
  h += kernelShot(C);
  h += chip(C, { x: 4, y: 232, text: "THE CORE ORB SWELLS EVERY BEAT", color: GOLD, stops: win(4, 38, 1.3), base: 0 });
  h += chip(C, { x: 4, y: 232, text: "WHITE-HOT = FULL: NEXT SHOT ×4", color: GOLD, stops: win(38.5, 58, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "THE ORB ITSELF GROWS, NO EXTRA BAR OR PIPS"], [GOLD, 377, "A MERGE BEFORE FULL KEEPS THE SIZE"]]);
}

// ---------- 12.3 Static's spread ----------
// Ivy's merged shot hits the Vanguard for 80 (Burn too). Static: every other enemy takes 30% of the shot per orb that merged (2 orbs: 48 each).
const staticFan = (C, ordered) => {
  const to = [O1c, O2c, O3c];
  let h = "";
  to.forEach((p, i) => {
    const at = M + 3 + (ordered ? i * 2 : 0);
    h += bolt(C, { x1: ordered ? (i === 0 ? VANc[0] : to[i - 1][0]) : MERGED.Ivy[0], y1: ordered ? (i === 0 ? 76 : to[i - 1][1]) : MERGED.Ivy[1] - 6, x2: p[0], y2: p[1], color: GOLD, at, w: ordered ? 2.4 : 2, show: true });
    h += floater(C, { x: p[0] + 6, y: 48, text: "−48", color: "#fff4b0", at: at + 1, size: 14, glow: GOLD, show: true });
    h += ring(C, { cx: p[0], cy: p[1] - 6, r: 20, color: GOLD, at: at + 0.6, dur: 6 });
  });
  return h;
};
function staticA(C) {
  let h = scene(C, { merge: { Ivy: M }, extra: "" });
  h += stormShot(C, M) + staticFan(C, false);
  h += chip(C, { x: 4, y: 232, text: "STATIC: ONE SHOT, EVERY ENEMY AT ONCE", color: GOLD, stops: win(M + 2, M + 16, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "THE BIG SHOT STRIKES THE FRONT: ALL OTHERS GET 30% PER ORB"], [GOLD, 377, "A FAN OF BOLTS, ALL ON THE SAME BEAT"]]);
}
function staticB(C) {
  let h = scene(C, { merge: { Ivy: M }, extra: "" });
  h += stormShot(C, M) + staticFan(C, true);
  h += chip(C, { x: 4, y: 232, text: "STATIC: THE BOLT JUMPS ENEMY TO ENEMY", color: GOLD, stops: win(M + 2, M + 16, 1.3), base: 1 });
  return h + rules([[WHITE, 362, "VANGUARD › OUTRIDER 1 › 2 › 3, A SHORT BEAT APART"], [GOLD, 377, "EVERY OTHER ENEMY TAKES 30% PER ORB"]]);
}

// ---------- 12.4 The setup runes: how each shows which rune did it ----------
// Echo: after a merge, one loose orb stays. Leech: when another mage merges, the Life Mage gains an orb. Tempo: the core orb works twice a beat.
function setupScene(C, tag) {
  const cores = [FR, LI].map((m) => coreOrb(C, { cx: m.cx, cy: m.cy, r: m.r, color: m.color, ang: 180 })).join("") + coreOrb(C, { cx: ST.cx, cy: ST.cy, r: ST.r, color: GOLD, ang: 180, pulses: [M - 12, M - 12 + 0.8, M + 14, M + 14.8] });
  let h = scene(C, { merge: { Ivy: M }, cores });
  // Echo: one orb is back round Ivy after the shot; Leech: Sol has gained one; the key moment is the still
  const echoAt = M + 6, [ex, ey] = orbAt(ST.cx, ST.cy, ST.r, -90), [lx, ly] = orbAt(LI.cx, LI.cy, LI.r, -90);
  const orbHtml = (x, y, color, at) => abs(`left:${(x - 5).toFixed(1)}px;top:${(y - 5).toFixed(1)}px;width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 7px 2px ${color};border:1px solid #fff8;z-index:4;${C.kf([[0, "opacity:0;transform:scale(0.2)"], [at - 0.1, "opacity:0;transform:scale(0.2)"], [at + 0.8, "opacity:1;transform:scale(1.6)"], [at + 2, "opacity:1;transform:scale(1)"], [100, "opacity:1;transform:scale(1)"]])}`);
  h += orbHtml(ex, ey, GOLD, echoAt) + orbHtml(lx, ly, LIFE, echoAt + 1);
  h += stormShot(C, M);
  return h + tag(C, { ex, ey, lx, ly, echoAt });
}
function setupA(C) {
  // a small rune chip floats up from each effect, naming the rune
  return setupScene(C, (C2, p) => {
    let h = floater(C2, { x: p.ex + 46, y: p.ey + 2, text: "❍ ECHO +1", color: GOLD, at: p.echoAt + 1, size: 10, glow: GOLD, show: true });
    h += floater(C2, { x: p.lx + 24, y: p.ly - 6, text: "☍ LEECH +1", color: LIFE, at: p.echoAt + 2, size: 10, glow: "#1b8a55", show: true });
    h += floater(C2, { x: 38, y: 340, text: "◷ TEMPO ×2", color: GOLD, at: M - 11, size: 10, glow: GOLD, show: true });
    return h + rules([[WHITE, 362, "A RUNE WORD POPS UP WHERE ITS EFFECT HAPPENS"], [GOLD, 377, "ECHO ❍ · LEECH ☍ · TEMPO ◷"]]);
  });
}
function setupB(C) {
  // no words: the effect is drawn from its cause. Echo's orb flies back from the merged orb; Leech's is a green thread from Ivy's merge to Sol;
  // Tempo's core orb pulses twice, the second pulse a smaller ghost ring.
  return setupScene(C, (C2, p) => {
    let h = beam(C2, { x1: MERGED.Ivy[0], y1: MERGED.Ivy[1], x2: p.ex, y2: p.ey, color: GOLD, at: p.echoAt - 1.2, w: 2, dur: 5, show: true });
    h += beam(C2, { x1: MERGED.Ivy[0], y1: MERGED.Ivy[1] + 4, x2: p.lx, y2: p.ly, color: LIFE, at: p.echoAt - 0.2, w: 2, dur: 5, show: true });
    h += ring(C2, { cx: p.ex, cy: p.ey, r: 14, color: GOLD, at: p.echoAt, dur: 6 }) + ring(C2, { cx: p.lx, cy: p.ly, r: 14, color: LIFE, at: p.echoAt + 1, dur: 6 });
    const [cx, cy] = orbAt(ST.cx, ST.cy, ST.r, 180);
    h += ring(C2, { cx, cy, r: 14, color: GOLD, at: M - 12, dur: 5 }) + ring(C2, { cx, cy, r: 9, color: "#fff", at: M - 11.2, dur: 5 });
    return h + rules([[WHITE, 362, "THE EFFECT IS DRAWN FROM ITS CAUSE: NO WORDS"], [GOLD, 377, "ECHO RETURNS THE ORB · LEECH SENDS A THREAD · TEMPO DOUBLE-PULSES"]]);
  });
}

// =====================================================================================================
// the ten files
// =====================================================================================================
const PAUSE = `<div style="position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:50%;background:#2a2e3a;border:1px solid #3a3f4e;display:flex;align-items:center;justify-content:center;z-index:6;"><svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1" width="2.6" height="9" rx="0.8" fill="#e8e8ee"/><rect x="6.9" y="1" width="2.6" height="9" rx="0.8" fill="#e8e8ee"/></svg></div>`;
const OPTIONS = [
  { id: "12.1A", file: "FightMageCascadeA.dc.html", scene: cascadeA, title: "A · One beat: three shots at once", text: "Overload. Ivy's two loose orbs merge; Bram's and Sol's merge on the very same beat. Storm, Frost and Life shots land together, and one line says so.", feel: "Feels like: everything goes off at once." },
  { id: "12.1B", file: "FightMageCascadeB.dc.html", scene: cascadeB, title: "B · A ripple: one merge sets off the next", text: "Overload. Ivy merges first, a thread jumps to Bram and he merges, then to Sol. A short beat apart, so the eye can follow who set off whom.", feel: "Feels like: a chain reaction I can read." },
  { id: "12.1C", file: "FightMageCascadeC.dc.html", scene: cascadeC, title: "C · A flash and a banner", text: "Overload. All three merge on one beat, the arena flashes and a big OVERLOAD ×3 banner pops. The loudest of the three.", feel: "Feels like: a boss-fight moment." },
  { id: "12.2A", file: "FightMageKernelA.dc.html", scene: kernelA, title: "A · Pips round the core orb", text: "Kernel. Ten small pips round Ivy's core orb fill one by one, a beat each. Full, the ring glows; the merge empties the pips into a shot four times bigger.", feel: "Feels like: counting up, then spending." },
  { id: "12.2B", file: "FightMageKernelB.dc.html", scene: kernelB, title: "B · A bar under the skill bar", text: "Kernel. A small gold bar under Ivy's skill bar reads KERNEL 10/10 as it fills, flashes at full, and empties with the shot.", feel: "Feels like: another bar to watch." },
  { id: "12.2C", file: "FightMageKernelC.dc.html", scene: kernelC, title: "C · The core orb swells", text: "Kernel. The core orb itself grows a little every beat and turns white-hot at full. No extra bar or pips; the orb is the readout.", feel: "Feels like: the orb is winding up." },
  { id: "12.3A", file: "FightMageStaticA.dc.html", scene: staticA, title: "A · A fan of bolts", text: "Static. The merged Storm shot hits the Vanguard, and a bolt fires from the shot to every other enemy on the same beat, 48 each.", feel: "Feels like: a burst." },
  { id: "12.3B", file: "FightMageStaticB.dc.html", scene: staticB, title: "B · The bolt jumps", text: "Static. The big shot hits the Vanguard, then one bolt jumps Outrider 1, 2, 3 in turn, a short beat apart, 48 each.", feel: "Feels like: chain lightning." },
  { id: "12.4A", file: "FightMageSetupA.dc.html", scene: setupA, title: "A · A rune word where it happens", text: "Echo, Leech, Tempo. After Ivy's merge a new orb is back round Ivy (ECHO +1) and Sol has one more (LEECH +1); Ivy's core orb pulses twice (TEMPO ×2). Each effect pops its rune's name.", feel: "Feels like: the game tells me which rune." },
  { id: "12.4B", file: "FightMageSetupB.dc.html", scene: setupB, title: "B · The effect drawn from its cause", text: "Echo, Leech, Tempo. Echo's orb flies back from the merged orb to Ivy; a green thread runs from Ivy's merge to Sol's new orb (Leech); Ivy's core orb double-pulses (Tempo). No words.", feel: "Feels like: I can see who gave what." },
];
function frame(o, n) {
  const C = makeCtx(`mp${n}k`);
  const scenery = o.scene(C);
  return `<!doctype html>
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
  .arena { --T: 12s; }
  @keyframes orbSpin { to { transform: rotate(360deg); } }
  ${C.rules.join("\n  ")}
</style>
</helmet>
<!-- Frame ${o.id} (options, awaiting Tu's pick, 2026-10-28): a look for a Mage payoff rune, drawn over 12.0D's fight a moment before the merge. Generated by design/tools/gen-mage-payoff-options.js; every number is made up, the look is what is being judged. The loop is 12 seconds; the plain style is the key moment. -->
<div style="background:#14161c;width:390px;padding:12px 0 16px;color:#e8e8ee;">
  <div style="padding:0 20px 10px;">
    <div style="font-size:13px;font-weight:800;color:#e8e8ee;padding-bottom:3px;">${o.title}</div>
    <div style="font-size:10.5px;line-height:1.45;color:#8a8fa3;min-height:74px;">${o.text}</div>
  </div>
  <div style="padding:0 16px;">
    <div style="position:relative;background:#1d2029;border-radius:12px;padding:16px 16px 10px;width:358px;">
      ${PAUSE}
      <div class="arena" style="position:relative;width:326px;height:392px;">
${scenery}
      </div>
      <div style="margin-top:6px;text-align:center;font-size:10.5px;font-weight:800;letter-spacing:0.04em;color:#e8e8ee;">${o.feel}</div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`;
}

// ---------- write the files and patch canvas.json ----------
const Y = 17000, SETS = { "12.1": "THE CASCADE (OVERLOAD)", "12.2": "KERNEL'S CHARGE", "12.3": "STATIC'S SPREAD", "12.4": "THE SETUP RUNES (ECHO, LEECH, TEMPO)" };
const FRAMES = [];
OPTIONS.forEach((o, i) => {
  fs.writeFileSync(path.join(CANVAS, o.file), frame(o, i));
  FRAMES.push({ file: o.file, x: 550 * i, y: Y, w: 390, h: 600, label: `${o.id} ${SETS[o.id.slice(0, 4)]} — ${o.title} (option, awaiting Tu's pick)` });
});
const cj = path.join(CANVAS, "canvas.json");
let lines = fs.readFileSync(cj, "utf8").split("\n").filter((l) => !/"file": "FightMage(Cascade|Kernel|Static|Setup)|"id": "(label|section)-magepay/.test(l));
const boards = FRAMES.map((f) => `    { "file": "${f.file}", "x": ${f.x}, "y": ${f.y}, "w": ${f.w}, "h": ${f.h} },`);
const notes = [`    { "id": "section-magepay", "x": 0, "y": ${Y - 140}, "w": ${550 * (OPTIONS.length - 1) + 390}, "text": "12.1 to 12.4 · HOW THE MAGE PAYOFF RUNES LOOK — options, awaiting Tu's pick: 12.1 the Overload cascade, 12.2 Kernel's charge, 12.3 Static's spread, 12.4 the setup runes. Watch each one loop; pick one per set, or a mix" },`];
FRAMES.forEach((f, i) => notes.push(`    { "id": "label-magepay-${i}", "x": ${f.x}, "y": ${f.y - 60}, "w": 390, "text": ${JSON.stringify(f.label)} },`));
const iArt = lines.findIndex((l) => l.includes('"annotations"'));
// the last artboard line has no trailing comma in the file: give it one, then add ours ending without one
for (let i = iArt - 1; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
lines.splice(iArt - 1, 0, "", ...boards.map((l, i) => (i === boards.length - 1 ? l.replace(/,$/, "") : l)));
const iLaunch = lines.findIndex((l) => l.includes('"launch"'));
for (let i = iLaunch - 1; i >= 0; i--) { if (lines[i].trim().startsWith("{")) { if (!lines[i].trim().endsWith(",")) lines[i] += ","; break; } }
lines.splice(iLaunch - 1, 0, ...notes.map((l, i) => (i === notes.length - 1 ? l.replace(/,$/, "") : l)));
fs.writeFileSync(cj, lines.join("\n"));
JSON.parse(fs.readFileSync(cj, "utf8")); // throws if the patch broke the file
console.log("wrote", FRAMES.length, "frames and patched canvas.json");
