import type { TileType } from "../sim/types";

/**
 * Single source of truth for tile colors so the arena canvas and the on-screen legend
 * can never drift apart. Colors are chosen for contrast against each other and against
 * the unit/team colors, not just against the black background.
 */
export interface TilePaletteEntry {
  readonly color: number;
  readonly label: string;
}

export const TILE_PALETTE: Record<TileType, TilePaletteEntry> = {
  open: { color: 0x24243a, label: "Open" },
  wall: { color: 0x121219, label: "Wall (impassable)" },
  highground: { color: 0x8a9a52, label: "High ground" },
  cover: { color: 0x7a5aa8, label: "Cover" },
};

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
