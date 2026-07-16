import legacyMapRaw from "../maps/test-map-1.json";
import encounter1MapRaw from "../maps/encounter-1-overlook.json";
import { deployZoneFromCols, offsetToAxial, type RawMapDef } from "../sim/map";
import type { Hex } from "../sim/hex";
import type { Role, UnitDef } from "../sim/types";

/**
 * Deploy zones are authored per round, not globally — each map's gaps/lanes sit at
 * different coordinates (DECISIONS 2026-07-15: on-map placement into an authored bounded
 * deploy zone, free placement within it, replacing the old coarse row x lane slots).
 * Zone size/shape is the per-encounter balancing knob: it controls elevation access,
 * whether any one setup is a dominant no-brainer, and how much placement can carry versus
 * the draft — a prototype tuning dial, not fixed geometry.
 */

/**
 * Round 1 — "The Overlook" (Phase 3's authored encounter #1). The zone is everything west
 * of the col-4 wall belt (cols 0-3), covering both the flank lane (row 0 — the route that
 * stays out of the highground archers' line of sight until it closes in past the wall) and
 * the center lane (rows 3-4, which feeds straight into the tank-held chokepoint under
 * sustained highground archer fire). Highground is excluded from the start zone by default
 * — it's a tile to contest during the fight (elevation risk/reward), not a free pre-fight
 * pick. See src/checks/encounter1.ts for the 4-point authoring test this encounter must pass.
 */
const ENCOUNTER_1_DEPLOY_ZONE: readonly Hex[] = deployZoneFromCols(encounter1MapRaw as RawMapDef, 0, 3);

/** The legacy Phase-2 loop-wrapper map (test-map-1), kept for round 2. Zone = west of the col-4 wall belt. */
const LEGACY_DEPLOY_ZONE: readonly Hex[] = deployZoneFromCols(legacyMapRaw as RawMapDef, 0, 3);

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
  /** Legal hexes for pre-fight placement (DECISIONS 2026-07-15) — free placement within this authored zone. */
  readonly deployZone: readonly Hex[];
  /** How many heroes the player fields this round. */
  readonly fieldSize: number;
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
    deployZone: ENCOUNTER_1_DEPLOY_ZONE,
    fieldSize: 5,
    briefing:
      "A tank holds the center gap; two archers on the high ground behind it threaten the whole approach. The flank gap up top stays hidden from them until you're close.",
    // Archer damage tuned (not just "one threat" flavor text) so the naive setup actually
    // loses instead of merely taking chip damage — see src/checks/encounter1.ts, which
    // verifies this empirically against the real sim rather than by hand. Archer maxHp
    // bumped 60->70 (DECISIONS 2026-07-15, elevation exposure): standing on highground now
    // makes these archers take +25% incoming damage themselves, so the small HP buff
    // restores the encounter's original threat window instead of them melting prematurely.
    enemyRoster: [
      enemyUnit("e1_tank", offsetToAxial(4, 3), "melee_tank", 120, 12, 1),
      enemyUnit("e2_archer", offsetToAxial(5, 3), "ranged_archer", 70, 13, 3),
      enemyUnit("e3_archer", offsetToAxial(6, 3), "ranged_archer", 70, 13, 3),
    ],
  },
  {
    id: "round-2",
    name: "Round 2 — Final Stand",
    mapRaw: legacyMapRaw as RawMapDef,
    seed: 202,
    isFinal: true,
    deployZone: LEGACY_DEPLOY_ZONE,
    fieldSize: 5,
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
