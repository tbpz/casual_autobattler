import type { SimResult } from "../sim/events";
import type { Role, Team, UnitDef } from "../sim/types";

/**
 * OQ-7 first pass: turns a completed fight's event log into a recap the player can credit
 * their own decision against — "your archer died first, and enemy archers caused most of
 * your losses" rather than a bare win/loss. Reused by the result-screen UI (main.ts) and
 * by the encounter #1 authoring test (checks/encounter1.ts), which needs the same
 * "one dominant cause of death" signal to verify point 4 of the 4-point test.
 *
 * Takes the unit list alongside the SimResult (same pattern as checks/continuity.ts)
 * rather than reading role/team off snapshots, since a unit stops appearing in snapshots
 * the tick it dies.
 */

export interface DeathRecord {
  readonly unitId: string;
  readonly team: Team;
  readonly role: Role;
  readonly tick: number;
  readonly killedById: string;
  readonly killedByRole: Role;
  readonly killedByTeam: Team;
}

export interface KillerShare {
  readonly role: Role;
  readonly count: number;
  /** Fraction (0..1) of that side's deaths this role is responsible for. */
  readonly share: number;
}

export interface AttributionSummary {
  readonly winner: Team | "draw";
  readonly playerDeaths: readonly DeathRecord[];
  readonly enemyDeaths: readonly DeathRecord[];
  readonly firstPlayerDeath: DeathRecord | null;
  readonly firstEnemyDeath: DeathRecord | null;
  /** What killed the player's units, most-responsible role first. Empty if nobody died. */
  readonly playerDeathsByKillerRole: readonly KillerShare[];
  readonly enemyDeathsByKillerRole: readonly KillerShare[];
  readonly headline: string;
}

function roleLabel(role: Role): string {
  return role === "melee_tank" ? "tank" : "archer";
}

function roleLabelPlural(role: Role): string {
  return role === "melee_tank" ? "tanks" : "archers";
}

function shareByKillerRole(deaths: readonly DeathRecord[]): KillerShare[] {
  if (deaths.length === 0) return [];
  const counts = new Map<Role, number>();
  for (const d of deaths) counts.set(d.killedByRole, (counts.get(d.killedByRole) ?? 0) + 1);
  return [...counts.entries()]
    .map(([role, count]) => ({ role, count, share: count / deaths.length }))
    .sort((a, b) => b.count - a.count);
}

function buildHeadline(
  winner: Team | "draw",
  playerDeaths: readonly DeathRecord[],
  enemyDeaths: readonly DeathRecord[],
  playerDeathsByKillerRole: readonly KillerShare[],
  enemyDeathsByKillerRole: readonly KillerShare[],
): string {
  if (winner === "draw") return "Stalemate — neither side broke through before time ran out.";

  if (winner === "enemy") {
    const dominant = playerDeathsByKillerRole[0];
    const first = playerDeaths[0];
    if (dominant === undefined || first === undefined) return "Defeat — your squad was wiped.";
    const pct = Math.round(dominant.share * 100);
    return `Defeat — your ${roleLabel(first.role)} went down first; enemy ${roleLabelPlural(dominant.role)} caused ${pct}% of your losses (${dominant.count}/${playerDeaths.length}).`;
  }

  if (playerDeaths.length === 0) {
    const dominant = enemyDeathsByKillerRole[0];
    if (dominant === undefined) return "Victory — flawless, no losses.";
    return `Victory, no losses — your ${roleLabelPlural(dominant.role)} did the work (${dominant.count}/${enemyDeaths.length} kills).`;
  }

  const dominant = enemyDeathsByKillerRole[0];
  const creditNote = dominant !== undefined ? ` — your ${roleLabelPlural(dominant.role)} did most of the work` : "";
  return `Victory — lost ${playerDeaths.length} of your own to do it${creditNote}.`;
}

export function summarizeAttribution(result: SimResult, unitDefs: readonly UnitDef[]): AttributionSummary {
  const byId = new Map(unitDefs.map((u) => [u.id, u] as const));

  const deaths: DeathRecord[] = [];
  for (const event of result.events) {
    if (event.type !== "death") continue;
    const dead = byId.get(event.unitId);
    const killer = byId.get(event.killedBy);
    if (dead === undefined || killer === undefined) continue;
    deaths.push({
      unitId: dead.id,
      team: dead.team,
      role: dead.role,
      tick: event.tick,
      killedById: killer.id,
      killedByRole: killer.role,
      killedByTeam: killer.team,
    });
  }

  const playerDeaths = deaths.filter((d) => d.team === "player");
  const enemyDeaths = deaths.filter((d) => d.team === "enemy");
  const playerDeathsByKillerRole = shareByKillerRole(playerDeaths);
  const enemyDeathsByKillerRole = shareByKillerRole(enemyDeaths);

  return {
    winner: result.winner,
    playerDeaths,
    enemyDeaths,
    firstPlayerDeath: playerDeaths[0] ?? null,
    firstEnemyDeath: enemyDeaths[0] ?? null,
    playerDeathsByKillerRole,
    enemyDeathsByKillerRole,
    headline: buildHeadline(result.winner, playerDeaths, enemyDeaths, playerDeathsByKillerRole, enemyDeathsByKillerRole),
  };
}
