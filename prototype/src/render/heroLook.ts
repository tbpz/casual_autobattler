// How a merge hero looks, shared by every screen that draws a unit body (2026-10-20; canvas 8.1–8.10, ported from
// design/tools/gen-heroes.js). A hero's body wears its recipe: solid for three of a kind, a diagonal split for two and one, three
// wedges for one of each, with a gold crown tilted on its head. DOM-free: every export is data or a string.

import type { HeroKind, Role, UnitKind } from "../sim/types.js";
import { ARMY_UNIT_HEX, armyLook } from "./armyLook.js";
import { squadFace, type FaceTier } from "./faces.js";

/** Role colours, copied from roundParts.ts's ROLE_HEX (this file cannot import it: roundParts draws bodies with this file). */
const PIECE_HEX = { tank: "#ffb454", damage: "#b98cff", support: "#6ee7a0" } as const;
type Piece = keyof typeof PIECE_HEX;

export const GOLD = "#ffd76a";
export const GOLD_RGB = "255,215,106";

/** The shape every body-drawing site hands in: a snapshot, a roster unit or a popup fighter all fit. */
export interface LookSource {
  role: Role | string;
  hero?: HeroKind | string;
  madeFrom?: Piece[];
  /** Set on an army unit (2026-10-20; render/armyLook.ts): its body colour, face and art come from the army, not the role. */
  kind?: UnitKind | string;
}

function isArmyKind(k: string | undefined): k is UnitKind {
  return !!k && k in ARMY_UNIT_HEX;
}

function isPiece(r: string): r is Piece {
  return r === "tank" || r === "damage" || r === "support";
}

/** Whether this unit is a merge hero with a known recipe. */
export function isHeroLook(u: LookSource): u is LookSource & { madeFrom: Piece[] } {
  return !!u.hero && !!u.madeFrom && u.madeFrom.length === 3;
}

/** The colour that most of a hero's pieces had (the Twin: the first piece); a basic unit's role colour. This is the face's lid colour. */
export function unitMainHex(u: LookSource): string {
  if (isArmyKind(u.kind)) return ARMY_UNIT_HEX[u.kind];
  if (isHeroLook(u)) {
    const counts = new Map<Piece, number>();
    for (const p of u.madeFrom) counts.set(p, (counts.get(p) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    return PIECE_HEX[top];
  }
  return isPiece(u.role) ? PIECE_HEX[u.role] : PIECE_HEX.damage;
}

/** The colour a hero's skill wears (bubble, tile): its main colour, and gold for a Twin that is made of one of each. */
export function unitAccentHex(u: LookSource): string {
  if (isHeroLook(u) && new Set(u.madeFrom).size === 3) return GOLD;
  return unitMainHex(u);
}

/** The CSS background of a unit's body: its role colour, or for a hero the recipe (solid, split or three wedges). */
export function unitBodyBg(u: LookSource): string {
  if (!isHeroLook(u)) return unitMainHex(u);
  const counts = new Map<Piece, number>();
  for (const p of u.madeFrom) counts.set(p, (counts.get(p) ?? 0) + 1);
  const keys = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => PIECE_HEX[p]);
  if (keys.length === 1) return keys[0]!;
  if (keys.length === 2) return `linear-gradient(135deg, ${keys[0]} 0 62%, ${keys[1]} 62% 100%)`;
  const cs = u.madeFrom.map((p) => PIECE_HEX[p]);
  return `conic-gradient(from 30deg, ${cs[0]} 0 33.3%, ${cs[1]} 33.3% 66.6%, ${cs[2]} 66.6% 100%)`;
}

/** The crown's path, a port of gen-heroes.js's I.crown. */
function crownPaths(fill: string): string {
  return (
    `<path d="M3 17 L2 6.5 L8 11.5 L12 4 L16 11.5 L22 6.5 L21 17 Z" fill="${fill}" stroke="#7a5c10" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<rect x="3" y="18" width="18" height="2.6" rx="1" fill="${fill}" stroke="#7a5c10" stroke-width="0.8"/>`
  );
}

/** The crown on its own, in flow (a label, a header), `px` wide. */
export function crownInline(px: number): string {
  return `<svg class="hero-crown-inline" width="${px}" height="${(px * 0.9).toFixed(1)}" viewBox="0 0 24 22" style="overflow:visible;vertical-align:-1px">${crownPaths(GOLD)}</svg>`;
}

/** The crown tilted on a body's head: absolutely placed, so its parent must be `position: relative` and the body `px` wide
 * (the crown is half that). The body must not clip it. */
export function crownOnBody(bodyPx: number): string {
  const px = Math.round(bodyPx * 0.5);
  return `<svg class="hero-crown" width="${px}" height="${(px * 0.9).toFixed(1)}" viewBox="0 0 24 22" style="position:absolute;left:30%;top:${(-px * 0.6).toFixed(1)}px;transform:translateX(-50%) rotate(-18deg);overflow:visible;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.55));z-index:2">${crownPaths(GOLD)}</svg>`;
}

/** Vampire fangs: two small white teeth under the eyes, drawn over the face (gen-heroes.js's fangs). Empty for everyone else. */
export function fangsHtml(u: LookSource): string {
  if (u.hero !== "vampire") return "";
  return `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"><polygon points="38,70 46,70 42,83" fill="#fff" stroke="#14161c" stroke-width="2"/><polygon points="54,70 62,70 58,83" fill="#fff" stroke="#14161c" stroke-width="2"/></svg>`;
}

/** A Dragon's body size, as a multiple of a squad body, by growth stage (0 Baby … 3 Elder). */
export const DRAGON_SCALE = [1, 1.12, 1.26, 1.4] as const;

/** The skill name a hero goes by, by hero id, for bubbles and popups: filled in by sim/heroes.ts's HERO_TEXT at the call sites. */
export const HERO_TERM_PREFIX = "hero-";

/** The face on a unit's body, `size` px, with the eyes of fatigue `tier`: an army unit's own face (one element), else the plain squad face. */
export function unitFaceHtml(u: LookSource, tier: FaceTier, size: number): string {
  return isArmyKind(u.kind) ? armyLook(u.kind, tier, size).face : squadFace(unitMainHex(u), tier, size);
}

/** Art drawn behind a unit's disc (an army unit's ears, antlers or wisps); empty for everyone else. */
export function unitUnderHtml(u: LookSource, size: number): string {
  return isArmyKind(u.kind) ? armyLook(u.kind, "fresh", size).under : "";
}

/** Extra CSS for a unit's disc (the Wraith's fade); empty for everyone else. */
export function unitBodyStyle(u: LookSource): string {
  return isArmyKind(u.kind) ? armyLook(u.kind, "fresh", 36).bodyStyle : "";
}
