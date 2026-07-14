import { offsetToAxial } from "../sim/map";
import type { UnitDef } from "../sim/types";

/**
 * A small 3v3 roster for test-map-1: one tank + two archers per side, starting on
 * opposite ends of the chokepoint (walls at col 4, open lane at row 2).
 */
export const TEST_ROSTER_1: readonly UnitDef[] = [
  {
    id: "p1_tank",
    team: "player",
    role: "melee_tank",
    startHex: offsetToAxial(1, 2),
    maxHp: 120,
    damage: 12,
    range: 1,
    moveSpeed: 2,
    attackSpeed: 1,
  },
  {
    id: "p2_archer",
    team: "player",
    role: "ranged_archer",
    startHex: offsetToAxial(0, 1),
    maxHp: 60,
    damage: 8,
    range: 3,
    moveSpeed: 2,
    attackSpeed: 1.2,
  },
  {
    id: "p3_archer",
    team: "player",
    role: "ranged_archer",
    startHex: offsetToAxial(0, 3),
    maxHp: 60,
    damage: 8,
    range: 3,
    moveSpeed: 2,
    attackSpeed: 1.2,
  },
  {
    id: "e1_tank",
    team: "enemy",
    role: "melee_tank",
    startHex: offsetToAxial(7, 2),
    maxHp: 120,
    damage: 12,
    range: 1,
    moveSpeed: 2,
    attackSpeed: 1,
  },
  {
    id: "e2_archer",
    team: "enemy",
    role: "ranged_archer",
    startHex: offsetToAxial(8, 1),
    maxHp: 60,
    damage: 8,
    range: 3,
    moveSpeed: 2,
    attackSpeed: 1.2,
  },
  {
    id: "e3_archer",
    team: "enemy",
    role: "ranged_archer",
    startHex: offsetToAxial(8, 3),
    maxHp: 60,
    damage: 8,
    range: 3,
    moveSpeed: 2,
    attackSpeed: 1.2,
  },
];
