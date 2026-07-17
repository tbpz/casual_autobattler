import type { Role } from "../sim/types";

/**
 * Shared role → human text, so the display label isn't recomputed ad hoc in every screen
 * (previously duplicated inline in main.ts and draft.ts). Kept in the game layer, not the
 * render layer — unitShapes.ts stays deliberately ignorant of hero identity/labels.
 */
export function roleLabel(role: Role): string {
  return role === "melee_tank" ? "Tank" : "Archer";
}

/**
 * One honest sentence per role — describes what the sim actually does, never a fabricated
 * ability. Heroes have no ability data model yet; same-role heroes are stat-identical. The
 * high-ground clause mirrors combat.ts's real HIGHGROUND_RANGE_BONUS / HIGHGROUND_EXPOSURE
 * rules so the elevation risk/reward (STATE.md) is legible from the setup screen.
 */
export function roleBlurb(role: Role): string {
  return role === "melee_tank"
    ? "Frontline anchor — high HP, melee only. Soaks damage so your archers survive."
    : "Backline damage — long range but fragile. On high ground gains +1 range but takes more incoming damage.";
}
