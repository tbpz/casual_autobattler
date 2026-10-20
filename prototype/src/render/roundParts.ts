// Pieces shared by the face-off round screen (canvas 1.1–1.5), the squad screen (4.1) and the run-over screen (7.1):
// role colours, the round strip with its skull markers, enemy and squad bodies, bench-shelf dots.
// Every value is copied from the canvas frames (design/canvas/RoundFaceOff*.dc.html). All exports are strings or data.

import type { RunConfig } from "../sim/config.js";
import { fatigueTier, type FatigueTier } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { ROLE_LABEL, type PlayerRole } from "../sim/roles.js";
import { ROUND_PLAN } from "../sim/rounds.js";
import type { EncounterKind } from "../sim/encounters.js";
import { DEAD_BODY, villainFace } from "./faces.js";
import { ICON_SKULL_BOSS, ICON_SKULL_DONE, ICON_SKULL_MINI, statLineHtml } from "./icons.js";
import { GOLD, crownOnBody, fangsHtml, unitBodyBg, unitBodyStyle, unitFaceHtml, unitUnderHtml } from "./heroLook.js";
import { armyBodyPx } from "./armyLook.js";
import { unitTitle } from "../sim/armies.js";

export const ROLE_HEX: Record<PlayerRole, string> = { tank: "#ffb454", damage: "#b98cff", support: "#6ee7a0" };

/** The role a unit has, narrowed: squad units are never "bruiser" or "grunt". */
export function squadRole(h: HeroState): PlayerRole {
  return h.role === "tank" || h.role === "damage" || h.role === "support" ? h.role : "damage";
}

/** The colour of a fatigue tier's word (fresh grey, worn yellow, frayed orange, breaking red). */
export const TIER_HEX: Record<FatigueTier, string> = { fresh: "#8a8fa3", worn: "#ffcf4d", frayed: "#e8913c", breaking: "#ff4d4d" };

/** The enemy's own colours: a grunt is the plain enemy red, a bruiser a darker red with a glow. */
const ENEMY_GRUNT = "#ff5d5d";
const ENEMY_BRUISER = "#b23b3b";

export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Splits "Outrider 2" into "Outrider<br>2" so a narrow column keeps the number under the name. */
function nameWithBreak(name: string): string {
  const m = /^(.*\S) (\d+)$/.exec(name);
  return m ? `${esc(m[1]!)}<br>${m[2]}` : esc(name);
}

// ---------- round strip ----------

/** `ROUND n/20`, a progress track, and a skull at each mini-boss (rounds 7, 14) and the boss (round 20).
 * `roundNumber` is the round on screen (1-based); a mini-boss before it is beaten, the one on it is bright, one after it is ahead.
 * `ended` (run-over) keeps the bar where the run ended, with the boss still ahead. */
export function roundStripHtml(cfg: RunConfig, roundNumber: number): string {
  const total = cfg.roundsPerRun;
  const plan = ROUND_PLAN.slice(0, total);
  let markers = "";
  plan.forEach((r, i) => {
    const n = i + 1;
    if (r.kind === "miniboss") {
      const state = roundNumber > n ? "done" : roundNumber === n ? "now" : "";
      const skull = state === "done" ? ICON_SKULL_DONE : ICON_SKULL_MINI;
      markers += `<div class="bm mini ${state}" style="left:${(n / total) * 100}%">${skull}</div>`;
    } else if (r.kind === "boss") {
      markers += `<div class="bm boss" style="left:calc(100% - 7px)">${ICON_SKULL_BOSS}</div>`;
    }
  });
  return `<div class="fo-strip"><div class="fo-strip-label">ROUND ${roundNumber}/${total}</div><div class="fo-strip-track"><div class="fo-strip-fill" style="width:${(roundNumber / total) * 100}%"></div>${markers}</div></div>`;
}

// ---------- enemy ----------

export interface EnemyBodyOpts {
  /** A body drawn alone is larger (Anvil, 64px). */
  alone: boolean;
  /** A stronger scowl for a mini-boss, a boss and the Executioner. */
  fierce: boolean;
}

/** One enemy: villain face, name, HP bar, stat line, and the 💥 / ✚ badges on a bruiser. The id lets a tap open its popup. */
export function enemyBodyHtml(h: HeroState, o: EnemyBodyOpts, slamDamage: number): string {
  const bruiser = h.role === "bruiser";
  const size = o.alone ? 64 : bruiser ? 56 : 30;
  const col = bruiser ? 76 : 56;
  const shW = Math.round(size * 0.8);
  const shH = Math.max(4, Math.round(size * 0.11));
  const heals = h.healPerBeat !== undefined && h.healPerBeat > 0;
  const badges =
    bruiser || heals
      ? `<div class="fo-badges" style="left:${Math.round(size * 0.78)}px">${bruiser ? `<div class="fo-badge" title="Slam: ${slamDamage}">💥</div>` : ""}${heals ? `<div class="fo-badge heal" title="Heals">✚</div>` : ""}</div>`
      : "";
  const glow = bruiser ? ";box-shadow:0 0 10px 2px rgba(178,59,59,0.5)" : "";
  const hp = Math.round(h.maxHp);
  const stat = statLineHtml(hp, Math.round(h.damage), heals ? h.healPerBeat : undefined);
  return `<div class="fo-col" data-fighter="${esc(h.id)}" data-side="enemy" style="width:${col}px"><div class="fo-eb" style="width:${size}px;height:${size}px"><div class="fo-sh" style="top:${Math.round(size * 0.86)}px;width:${shW}px;height:${shH}px"></div><div class="fo-body" style="width:${size}px;height:${size}px;background:${bruiser ? ENEMY_BRUISER : ENEMY_GRUNT}${glow}">${villainFace(size, o.fierce ? 1.35 : 1)}</div>${badges}</div>${o.alone ? "" : `<div class="fo-en">${nameWithBreak(h.name)}</div>`}<div class="fo-ehp" style="width:${Math.round(size * 0.93)}px"><div></div></div>${stat}</div>`;
}

/** Whether an encounter's bruisers get the strong scowl: mini-boss, boss, and the Executioner. */
export function fierceScowl(kind: EncounterKind, encounterName: string): boolean {
  return kind === "miniboss" || kind === "boss" || /executioner/i.test(encounterName);
}

// ---------- squad ----------

export interface SquadLayout {
  /** How many slots the squad has (fielded plus empty): sets body sizes and column width. */
  slots: number;
}

/** Every squad body is this size, the Tank included, so size never says "boss" (canvas 1.6B). */
const SQUAD_BODY_PX = 36;

function squadSizes(slots: number): { col: number; showTag: boolean; nameSize: number } {
  if (slots >= 5) return { col: 60, showTag: false, nameSize: 11 };
  if (slots === 4) return { col: 76, showTag: true, nameSize: 12 };
  return { col: 82, showTag: true, nameSize: 12 };
}

/** One squad member: face by fatigue tier, name, role tag, HP bar, stat line. Every body is one size and none is dimmed. */
export function squadBodyHtml(h: HeroState, cfg: RunConfig, layout: SquadLayout): string {
  const role = squadRole(h);
  const z = squadSizes(layout.slots);
  // An army unit (2026-10-20): its own look, title and, in a Beasts squad, a smaller body (the Bear 36, the rest 30).
  const size = armyBodyPx(h.kind, SQUAD_BODY_PX);
  // A merge hero (2026-10-20): its body wears the recipe and a crown, and its tag says HERO in gold.
  const hex = ROLE_HEX[role];
  const tier = fatigueTier(cfg.fight, h.fatigue);
  const frac = h.maxHp > 0 ? Math.max(0, Math.min(1, h.hp / h.maxHp)) : 0;
  const stat = statLineHtml(Math.round(h.hp), Math.round(h.damage), role === "support" ? h.healPerBeat : undefined);
  const crown = h.hero ? crownOnBody(size) : "";
  const tag = h.hero ? `<div class="fo-tag" style="color:${GOLD}">HERO</div>` : `<div class="fo-tag" style="color:${hex}">${h.kind ? unitTitle(h) : ROLE_LABEL[role]}</div>`;
  return `<div class="fo-col" data-fighter="${esc(h.id)}" data-side="squad" style="width:${z.col}px"><div class="fo-eb" style="width:${size}px;height:${size}px"><div class="fo-sh" style="top:${Math.round(size * 0.85)}px;width:${Math.round(size * 0.82)}px;height:${Math.max(5, Math.round(size * 0.13))}px"></div>${unitUnderHtml(h, size)}<div class="fo-body" style="width:${size}px;height:${size}px;background:${unitBodyBg(h)};${unitBodyStyle(h)}">${unitFaceHtml(h, tier, size)}${fangsHtml(h)}${crown}</div></div><div class="fo-nm" style="font-size:${z.nameSize}px">${esc(h.name)}</div>${z.showTag || h.kind ? tag : ""}<div class="fo-hpbar"><div style="width:${(frac * 100).toFixed(0)}%"></div></div>${stat}</div>`;
}

/** An empty slot: a dashed ring with "Empty / Tap to fill" (frame 1.5). It sits in the back row. */
export function emptySlotHtml(layout: SquadLayout): string {
  const z = squadSizes(layout.slots);
  return `<div class="fo-col fo-slot" data-slot="empty" style="width:${z.col}px"><div class="fo-slot-ring">+</div><div class="fo-slot-name">Empty</div><div class="fo-slot-hint">Tap to fill</div></div>`;
}

/** Splits a squad into the two rows the fight screen draws: tanks in front, everyone else (and empty slots) in a row behind. */
export function rankRows<T>(items: T[], isFront: (t: T) => boolean): { front: T[]; back: T[] } {
  return { front: items.filter(isFront), back: items.filter((t) => !isFront(t)) };
}

/** The squad's rows as html: FRONT and BACK words and a dashed line between the rows when there are two rows, one flat row with no words when
 * there is only one kind (no Tank, or only Tanks). `unitHtml` draws one cell. */
export function squadRowsHtml<T>(items: T[], isFront: (t: T) => boolean, unitHtml: (t: T) => string): string {
  const { front, back } = rankRows(items, isFront);
  // A row of four (only a full 5-slot squad has one) would run under the word at its left end, so it moves right to make room for it.
  const rowClass = (n: number): string => (n >= 4 ? "fo-rankrow crowded" : "fo-rankrow");
  if (front.length === 0 || back.length === 0) {
    return `<div class="fo-rankrow">${[...front, ...back].map(unitHtml).join("")}</div>`;
  }
  return (
    `<div class="${rowClass(front.length)}"><span class="fo-ranklabel">FRONT</span>${front.map(unitHtml).join("")}</div>` +
    `<div class="fo-rankgap"></div>` +
    `<div class="${rowClass(back.length)}"><span class="fo-ranklabel">BACK</span>${back.map(unitHtml).join("")}</div>`
  );
}

// ---------- bench shelf ----------

/** A benched unit as a small preview: a 22px dimmed circle in its role colour, its name, a thin HP bar. A fallen unit is grey with a red ✕. */
export function benchUnitHtml(h: HeroState): string {
  if (!h.alive) {
    return `<div class="fo-bu fallen"><div style="position:relative"><div class="fo-bc" style="background:${DEAD_BODY};opacity:1"></div><div class="fo-fx">✕</div></div><div class="fo-bn">${esc(h.name)}</div><div class="fo-bb" style="background:transparent"></div></div>`;
  }
  const frac = h.maxHp > 0 ? Math.max(0, Math.min(1, h.hp / h.maxHp)) : 0;
  // A hero on the bench wears its recipe and a small crown too (22px: the crown is 11px).
  return `<div class="fo-bu"><div style="position:relative"><div class="fo-bc" style="background:${unitBodyBg(h)}"></div>${h.hero ? crownOnBody(22) : ""}</div><div class="fo-bn">${esc(h.name)}</div><div class="fo-bb"><div style="width:${(frac * 100).toFixed(0)}%"></div></div></div>`;
}
