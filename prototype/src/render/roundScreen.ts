import type { RunConfig } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { MIN_CHAIN_AFFINITY, MAX_CHAIN_AFFINITY, PLAYER_ROLES, ROLE_LABEL } from "../sim/roles.js";
import type { RunProgress } from "../sim/progress.js";
import { defaultFieldPick, fieldSquad, livingRosterHeroes, type RosterState } from "../sim/roster.js";
import { roundEnemySide, roundKindLabel } from "../sim/rounds.js";
import type { EncounterKind } from "../sim/encounters.js";
import { project } from "../sim/projection.js";
import { chainEffectLines, chainVsEncounterLine, backfireRiskPips, chargeBarHtml } from "./heroPickShared.js";

/** HP fractions where a round-screen row changes how loudly it reads —
 * carried over unchanged from the old fieldPickScreen.ts. */
const HP_HURT_FRACTION = 0.75;
const HP_CRITICAL_FRACTION = 0.4;

function hpSeverity(h: HeroState): "ok" | "hurt" | "critical" {
  const frac = h.maxHp > 0 ? h.hp / h.maxHp : 0;
  if (frac < HP_CRITICAL_FRACTION) return "critical";
  if (frac < HP_HURT_FRACTION) return "hurt";
  return "ok";
}

/**
 * 2026-09-23 (roles/rounds rebuild — see DECISIONS.md and STATE.md). Merges
 * the old field-pick screen and pre-fight screen into one: which units fill
 * this round's squad, full information about the enemy, and a projection —
 * all in one screen, one tap (Play) to accept the default. Fewer screens,
 * less to read, per round, the same problem the run-start draft was in
 * miniature.
 *
 * Chain identity is shown ONCE PER ROLE, not once per unit — every tank
 * shares the same chain effect/level (sim/roster.ts's
 * stampProgressOntoSquad), so repeating it per row would just be noise.
 */
export function renderRoundScreen(
  container: HTMLElement,
  cfg: RunConfig,
  roundIndex: number,
  encounterIndex: number,
  roster: RosterState,
  progress: RunProgress,
  encounterName: string,
  encounterBlurb: string,
  roundKind: EncounterKind,
  onPlay: (fieldedIds: string[]) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen squad-pick field-pick";

  const h1 = document.createElement("h1");
  h1.textContent = `${roundKindLabel(roundKind)} ${roundIndex + 1} of ${cfg.roundsPerRun} — ${encounterName}`;
  screen.appendChild(h1);

  const blurb = document.createElement("p");
  blurb.className = "hint encounter-blurb";
  blurb.textContent = encounterBlurb;
  screen.appendChild(blurb);

  const fieldSize = progress.slots;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = `Pick ${fieldSize} to fight — or just hit Play. A unit left on the bench heals faster.`;
  screen.appendChild(hint);

  const living = livingRosterHeroes(roster);
  const dead = roster.heroes.filter((h) => !h.alive);
  const selected = new Set<string>(defaultFieldPick(roster, fieldSize));

  const list = document.createElement("div");
  list.className = "hero-pick-list";
  const rows = new Map<string, HTMLElement>();

  const chainBlock = document.createElement("div");
  chainBlock.className = "recap";

  const projectionLine = document.createElement("p");
  projectionLine.className = "projection-line";
  const chainLine = document.createElement("p");
  chainLine.className = "projection-detail";

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";

  const enemyPreview = roundEnemySide(cfg, roundIndex, encounterIndex);

  function refreshPlayState(): void {
    const ready = selected.size === fieldSize;
    playBtn.disabled = !ready;
    playBtn.textContent = ready ? "Play" : `Pick ${fieldSize - selected.size} more`;
  }

  function refreshChecks(): void {
    for (const [id, row] of rows) {
      const isSelected = selected.has(id);
      row.classList.toggle("selected", isSelected);
      const check = row.querySelector(".hero-pick-check");
      if (check) check.textContent = isSelected ? "✓" : "";
    }
  }

  function refreshProjection(): void {
    if (selected.size !== fieldSize) {
      projectionLine.textContent = "";
      projectionLine.className = "projection-line";
      chainLine.textContent = "";
      return;
    }
    const proj = project(fieldSquad(roster, [...selected], progress), enemyPreview, cfg.fight);
    projectionLine.textContent = proj.verdict;
    projectionLine.className = `projection-line band-${proj.band}`;
    chainLine.textContent = proj.chainLine;
  }

  function heroRowHtml(h: HeroState): string {
    return `
      <span class="hero-pick-check"></span>
      <span class="hero-pick-info">
        <span class="hero-pick-name">${h.name}</span>
        <span class="hero-pick-hp hp-${hpSeverity(h)}">${Math.round(h.hp)}<span class="hero-pick-hp-max">/${Math.round(h.maxHp)}</span></span>
        <span class="hero-pick-role">${h.role}</span>
      </span>
      <span class="hero-pick-stats">
        <span class="hero-pick-numbers">${h.damage}dmg / ${h.attackIntervalSec}s${h.healPerBeat ? ` +${h.healPerBeat}heal` : ""}</span>
        <span class="hero-pick-backfire">BACKFIRE ${backfireRiskPips(cfg.fight, h.chainAffinity, MIN_CHAIN_AFFINITY, MAX_CHAIN_AFFINITY)}</span>
        ${chargeBarHtml(h.charge, cfg.fight.chargeThreshold)}
      </span>
    `;
  }

  for (const h of living) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `hero-pick-row hp-row-${hpSeverity(h)}`;
    row.innerHTML = heroRowHtml(h);
    row.addEventListener("click", () => {
      if (selected.has(h.id)) {
        selected.delete(h.id);
      } else {
        if (selected.size >= fieldSize) {
          const oldest = selected.values().next().value;
          if (oldest) selected.delete(oldest);
        }
        selected.add(h.id);
      }
      refreshChecks();
      refreshPlayState();
      refreshProjection();
    });
    rows.set(h.id, row);
    list.appendChild(row);
  }

  refreshChecks();
  refreshPlayState();
  refreshProjection();
  playBtn.addEventListener("click", () => onPlay([...selected]));

  screen.appendChild(list);

  // One chain line per ROLE actually present in the roster — not per unit
  // (see this file's top docstring).
  for (const role of PLAYER_ROLES) {
    if (!roster.heroes.some((h) => h.role === role)) continue;
    const roleProgress = progress.chain[role];
    const lines = chainEffectLines(roleProgress.effect);
    const p = document.createElement("p");
    p.className = "hero-pick-chain-summary";
    p.innerHTML = `<strong>${ROLE_LABEL[role]} chain</strong> (level ${roleProgress.level}): ${lines.does} — ${chainVsEncounterLine(roleProgress.effect, enemyPreview)}`;
    chainBlock.appendChild(p);
  }
  screen.appendChild(chainBlock);

  screen.appendChild(projectionLine);
  screen.appendChild(chainLine);

  if (dead.length > 0) {
    const fallen = document.createElement("p");
    fallen.className = "hint fallen-note";
    fallen.textContent = `Fallen: ${dead.map((h) => h.name).join(", ")}.`;
    screen.appendChild(fallen);
  }

  const enemyStat = document.createElement("p");
  enemyStat.className = "hint";
  enemyStat.textContent = `Enemy: ${Math.round(sideHp(enemyPreview))} / ${Math.round(sideMaxHp(enemyPreview))} HP.`;
  screen.appendChild(enemyStat);

  screen.appendChild(playBtn);
  container.appendChild(screen);
}
