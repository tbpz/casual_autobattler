/**
 * The HP bar's Shield segment (DECISIONS.md 2026-10-01, "Shield shows as a
 * segment on the HP bar"). Pins the layout math the fight view draws from: the
 * bar keeps its max-HP scale while HP + Shield fits, rescales once it doesn't,
 * and the HP fill never runs past the Shield's edge.
 */
import { hpBarLayout } from "../render/hpBar.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const plain = hpBarLayout(150, 195, 0);
check("no shield: the edge is the HP fill", near(plain.hpFrac, 150 / 195) && near(plain.edgeFrac, plain.hpFrac));

const under = hpBarLayout(120, 195, 40);
check("shield under max: the bar keeps its max-HP scale", near(under.hpFrac, 120 / 195) && near(under.edgeFrac, 160 / 195));

const exact = hpBarLayout(155, 195, 40);
check("HP + shield exactly max: fills the bar without rescaling", near(exact.hpFrac, 155 / 195) && near(exact.edgeFrac, 1));

const over = hpBarLayout(195, 195, 60);
check("over max: the bar rescales so both fit", near(over.hpFrac, 195 / 255) && near(over.edgeFrac, 1));

const drained = hpBarLayout(195, 195, 20);
check("over max, shield draining: the HP fill grows back", drained.hpFrac > over.hpFrac && near(drained.hpFrac, 195 / 215));

const aegis = hpBarLayout(195, 195, 195);
check("Aegis cap (shield = max HP): half and half", near(aegis.hpFrac, 0.5) && near(aegis.edgeFrac, 1));

const sliver = hpBarLayout(150, 195, 4);
check("a 4-point shield is a thin segment", sliver.edgeFrac - sliver.hpFrac > 0 && sliver.edgeFrac - sliver.hpFrac < 0.025);

check("zero max HP gives an empty bar", hpBarLayout(10, 0, 5).hpFrac === 0 && hpBarLayout(10, 0, 5).edgeFrac === 0);

const down = hpBarLayout(-5, 100, 30);
check("negative HP is clamped to zero", down.hpFrac === 0 && near(down.edgeFrac, 0.3));

let ordered = true;
for (const hp of [0, 1, 50, 120, 195]) {
  for (const shield of [0, 4, 40, 60, 195]) {
    const l = hpBarLayout(hp, 195, shield);
    if (!(l.hpFrac >= 0 && l.hpFrac <= l.edgeFrac && l.edgeFrac <= 1 + 1e-9)) ordered = false;
  }
}
check("HP fill never passes the shield's edge, and nothing passes the bar", ordered);

if (failed) {
  console.log("\nSome checks FAILED.");
  process.exit(1);
}
console.log("\nAll hpBar checks passed.");
