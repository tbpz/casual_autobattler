import legacyMapRaw from "../maps/test-map-1.json";
import encounter1MapRaw from "../maps/encounter-1-overlook.json";
import { offsetToAxial, type RawMapDef } from "../sim/map";
import type { Hex } from "../sim/hex";
import type { Role, UnitDef } from "../sim/types";

export interface DeploymentSlot {
  readonly id: string;
  readonly label: string;
  readonly hex: Hex;
}

/**
 * Deployment slots are authored per round, not globally — each map's gaps/lanes sit at
 * different coordinates, and a slot only means something relative to its own map's
 * geometry (OQ-6 provisional: coarse row x lane, not free hex-drop).
 */

/**
 * Round 1 — "The Overlook" (Phase 3's authored encounter #1). Front is column 2, back is
 * column 1, both west of the col-4 wall belt. "Top" slots (row 0) sit in the flank lane —
 * the only route that stays out of the highground archers' line of sight until it closes
 * in past the wall. "Mid"/"bottom" slots sit in the center lane (row 3/4), which feeds
 * straight into the tank-held chokepoint under sustained highground archer fire. See
 * src/checks/encounter1.ts for the 4-point authoring test this encounter must pass.
 */
const ENCOUNTER_1_SLOTS: readonly DeploymentSlot[] = [
  { id: "front-top", label: "Front · Flank", hex: offsetToAxial(2, 0) },
  { id: "front-mid", label: "Front · Center", hex: offsetToAxial(2, 3) },
  { id: "front-bottom", label: "Front · Center (2nd)", hex: offsetToAxial(2, 4) },
  { id: "back-top", label: "Back · Flank", hex: offsetToAxial(1, 0) },
  { id: "back-bottom", label: "Back · Center", hex: offsetToAxial(1, 4) },
];

/** The legacy Phase-2 loop-wrapper slots (test-map-1), kept for round 2. */
const LEGACY_SLOTS: readonly DeploymentSlot[] = [
  { id: "front-top", label: "Front · Top", hex: offsetToAxial(1, 1) },
  { id: "front-mid", label: "Front · Mid", hex: offsetToAxial(1, 2) },
  { id: "front-bottom", label: "Front · Bottom", hex: offsetToAxial(1, 3) },
  { id: "back-top", label: "Back · Top", hex: offsetToAxial(0, 1) },
  { id: "back-bottom", label: "Back · Bottom", hex: offsetToAxial(0, 3) },
];

const LEGACY_ENEMY_HEX = {
  frontTop: offsetToAxial(7, 1),
  frontMid: offsetToAxial(7, 2),
  frontBottom: offsetToAxial(7, 3),
  backTop: offsetToAxial(8, 1),
  backBottom: offsetToAxial(8, 3),
};

function enemyUnit(id: string, hex: Hex, role: Role, maxHp: number, damage: number, range: number, buff = 1): UnitDef {
  return {
    id,
    team: "enemy",
    role,
    startHex: hex,
    maxHp: Math.round(maxHp * buff),
    damage: Math.round(damage * buff),
    range,
    moveSpeed: 2,
    attackSpeed: role === "melee_tank" ? 1 : 1.2,
  };
}

export interface RoundDef {
  readonly id: string;
  readonly name: string;
  readonly mapRaw: RawMapDef;
  readonly seed: number;
  readonly isFinal: boolean;
  readonly enemyRoster: readonly UnitDef[];
  readonly playerSlots: readonly DeploymentSlot[];
  /** One-sentence design intent, surfaced pre-fight so "diagnose and retry" has something to diagnose against. */
  readonly briefing: string;
}

export const ROUNDS: readonly RoundDef[] = [
  {
    id: "round-1",
    name: "Round 1 — The Overlook",
    mapRaw: encounter1MapRaw as RawMapDef,
    seed: 101,
    isFinal: false,
    playerSlots: ENCOUNTER_1_SLOTS,
    briefing:
      "A tank holds the center gap; two archers on the high ground behind it threaten the whole approach. The flank gap up top stays hidden from them until you're close.",
    // Archer damage tuned (not just "one threat" flavor text) so the naive setup actually
    // loses instead of merely taking chip damage — see src/checks/encounter1.ts, which
    // verifies this empirically against the real sim rather than by hand.
    enemyRoster: [
      enemyUnit("e1_tank", offsetToAxial(4, 3), "melee_tank", 120, 12, 1),
      enemyUnit("e2_archer", offsetToAxial(5, 3), "ranged_archer", 60, 13, 3),
      enemyUnit("e3_archer", offsetToAxial(6, 3), "ranged_archer", 60, 13, 3),
    ],
  },
  {
    id: "round-2",
    name: "Round 2 — Final Stand",
    mapRaw: legacyMapRaw as RawMapDef,
    seed: 202,
    isFinal: true,
    playerSlots: LEGACY_SLOTS,
    briefing: "The full enemy roster, buffed. No new lesson here — just execute everything learned so far.",
    enemyRoster: [
      enemyUnit("e1_tank", LEGACY_ENEMY_HEX.frontMid, "melee_tank", 120, 12, 1, 1.5),
      enemyUnit("e2_tank", LEGACY_ENEMY_HEX.frontTop, "melee_tank", 120, 12, 1, 1.5),
      enemyUnit("e3_archer", LEGACY_ENEMY_HEX.backTop, "ranged_archer", 60, 8, 3, 1.5),
      enemyUnit("e4_archer", LEGACY_ENEMY_HEX.backBottom, "ranged_archer", 60, 8, 3, 1.5),
      enemyUnit("e5_archer", LEGACY_ENEMY_HEX.frontBottom, "ranged_archer", 60, 8, 3, 1.5),
    ],
  },
];
