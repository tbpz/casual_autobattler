// How a unit body looks, shared by every screen that draws one: a role's colour, or an army unit's own colour, face and art
// (render/armyLook.ts). DOM-free: every export is data or a string.

import type { Role, UnitKind } from "../sim/types.js";
import { ARMY_UNIT_HEX, armyLook } from "./armyLook.js";
import { squadFace, type FaceTier } from "./faces.js";

/** Role colours, copied from roundParts.ts's ROLE_HEX (this file cannot import it: roundParts draws bodies with this file). */
const PIECE_HEX = { tank: "#ffb454", damage: "#b98cff", support: "#6ee7a0" } as const;
type Piece = keyof typeof PIECE_HEX;

/** The shape every body-drawing site hands in: a snapshot, a roster unit or a popup fighter all fit. */
export interface LookSource {
  role: Role | string;
  /** Set on an army unit (2026-10-20; render/armyLook.ts): its body colour, face and art come from the army, not the role. */
  kind?: UnitKind | string;
}

function isArmyKind(k: string | undefined): k is UnitKind {
  return !!k && k in ARMY_UNIT_HEX;
}

function isPiece(r: string): r is Piece {
  return r === "tank" || r === "damage" || r === "support";
}

/** A unit's colour: its army unit's own, else its role's. This is also the face's lid colour and the colour its skill wears. */
export function unitMainHex(u: LookSource): string {
  if (isArmyKind(u.kind)) return ARMY_UNIT_HEX[u.kind];
  return isPiece(u.role) ? PIECE_HEX[u.role] : PIECE_HEX.damage;
}

/** The CSS background of a unit's body. */
export function unitBodyBg(u: LookSource): string {
  return unitMainHex(u);
}

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
