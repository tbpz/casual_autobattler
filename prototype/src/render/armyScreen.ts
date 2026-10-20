import type { ArmyKind, UnitKind } from "../sim/types.js";
import { ARMY_ORDER, ARMY_TEXT, UNIT_TEXT } from "../sim/armies.js";
import { ROLE_HEX, esc } from "./roundParts.js";
import { ARMY_ACCENT, armyBodyHtml } from "./armyLook.js";

/** The units drawn on each army's card: the three roles, and for Beasts the pack of five they field (a Bear, three Wolves and a Stag). */
const CARD_UNITS: Record<ArmyKind, UnitKind[]> = {
  undead: ["boneKnight", "wraith", "bonePriest"],
  beasts: ["bear", "wolf", "wolf", "wolf", "stag"],
};

const ROLE_OF: Record<UnitKind, "tank" | "damage" | "support"> = {
  boneKnight: "tank",
  wraith: "damage",
  bonePriest: "support",
  bear: "tank",
  wolf: "damage",
  stag: "support",
};

/**
 * The army pick (2026-10-20; canvas 10.0A, DECISIONS.md once Tu confirms): the first screen of a run. Two cards, each showing the army's
 * bodies, its rule in a line and its three skills; one tap picks it. Nothing is pre-selected. An army changes every unit in the squad:
 * how it looks, what its skill does, and one rule for every fight (sim/armies.ts).
 */
export function renderArmyScreen(container: HTMLElement, onChoose: (army: ArmyKind) => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen";
  container.appendChild(screen);

  const h1 = document.createElement("h1");
  h1.textContent = "Choose your army";
  screen.appendChild(h1);

  const intro = document.createElement("p");
  intro.className = "merge-intro";
  intro.textContent = "Your whole squad changes: how it looks, what its skills do, and one rule in every fight. Round 1 comes next.";
  screen.appendChild(intro);

  const cards = document.createElement("div");
  cards.className = "army-cards";
  for (const army of ARMY_ORDER) {
    const text = ARMY_TEXT[army];
    const accent = ARMY_ACCENT[army];
    const units = CARD_UNITS[army];
    const size = army === "undead" ? 40 : 32;
    const bodies = units
      .map((kind) => {
        const unit = UNIT_TEXT[kind];
        return `<span class="army-unit" style="width:${army === "undead" ? 78 : 56}px">${armyBodyHtml(kind, size)}<span class="army-unit-title" style="color:${ROLE_HEX[ROLE_OF[kind]]}">${esc(unit.title)}</span></span>`;
      })
      .join("");
    const skills = [...new Set(units)].map((k) => UNIT_TEXT[k].skillName).join(" · ");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "army-card";
    btn.dataset.army = army;
    btn.style.setProperty("--army", accent.hex);
    btn.style.setProperty("--army-rgb", accent.rgb);
    btn.innerHTML =
      `<span class="army-head"><span class="army-name">${esc(text.name)}</span><span class="army-pitch">${esc(text.pitch)}</span></span>` +
      `<span class="army-bodies">${bodies}</span>` +
      `<span class="army-rule"><b class="army-label">RULE · ${esc(text.ruleName.toUpperCase())}</b> ${esc(text.ruleHead)} ${esc(text.ruleLines[0])}</span>` +
      `<span class="army-skills"><b class="army-label army-label-plain">SKILLS</b> ${esc(skills)}</span>` +
      `<span class="army-pick">Pick ${esc(text.name)}</span>`;
    btn.addEventListener("click", () => onChoose(army));
    cards.appendChild(btn);
  }
  screen.appendChild(cards);
}
