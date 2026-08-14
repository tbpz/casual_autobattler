import type { RunConfig } from "../sim/config.js";
import { DEFAULT_DRAFT_ROSTER_IDS, PLAYER_HERO_POOL, makePlayerSide } from "../sim/heroes.js";
import { defaultFieldPick, fieldSquad } from "../sim/roster.js";
import { makeEnemySide } from "../sim/run.js";
import { project } from "../sim/projection.js";
import { chainAffinityPips } from "./heroPickShared.js";

/**
 * Run-start DRAFT: 5 of 6, pre-checked with the default draft and a
 * prominent Play button — the accept-default path is a single tap, per the
 * "optional layer must stay optional" rule (DECISIONS.md 2026-07-26, 0/4 in
 * probing when forced). Picking a 6th swaps out the earliest pick so the
 * draft always holds exactly cfg.rosterSize.
 *
 * 2026-08-09 (roster/bench pass — see config.ts's DeathPolicy-removal
 * docstring): widened from "pick 3 (the fielded squad)" to "pick 5 (the
 * whole run's roster) — fielding which 3 answer a given fight is now a
 * SEPARATE, per-fight decision (see fieldPickScreen.ts). This screen is the
 * run-level build commitment: which one hero to leave out of the run
 * entirely.
 *
 * As of 2026-08-06 (see DECISIONS.md's "squad pick is the risk dial" entry)
 * the pick also renders a live projection verdict against fight 1's enemy
 * composition, computed by sim/projection.ts — the same module the
 * pre-fight screen and the post-fight recap use, so the three can never
 * disagree about what a comp was expected to do. The projection previews
 * the DEFAULT fielding (roster.ts's defaultFieldPick) of whatever 5 are
 * currently selected, since the draft itself is never fielded directly.
 *
 * 2026-08-08: each row also shows attack interval, a chainAffinity pip
 * meter, and a one-line identity — the player's own diagnosis was "I know
 * the cascade is there, but I don't know how to head into it while playing
 * a normal round." This is the missing lever, stated at the only moment a
 * player can act on it: before the fight, not during the recap.
 */
export function renderSquadPickScreen(container: HTMLElement, cfg: RunConfig, onPlay: (heroIds: string[]) => void): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen squad-pick";

  const h1 = document.createElement("h1");
  h1.textContent = "Draft your roster";
  screen.appendChild(h1);

  const draftSize = cfg.rosterSize;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = `Pick ${draftSize} for the run — or just hit Play. You'll choose 3 to field each fight.`;
  screen.appendChild(hint);

  const selected = new Set<string>(DEFAULT_DRAFT_ROSTER_IDS);

  const list = document.createElement("div");
  list.className = "hero-pick-list";
  const rows = new Map<string, HTMLElement>();

  const projectionLine = document.createElement("p");
  projectionLine.className = "projection-line";

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";

  const enemyPreview = makeEnemySide(cfg, 0);

  function refreshPlayState(): void {
    const ready = selected.size === draftSize;
    playBtn.disabled = !ready;
    playBtn.textContent = ready ? "Play" : `Pick ${draftSize - selected.size} more`;
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
    if (selected.size !== draftSize) {
      projectionLine.textContent = "";
      projectionLine.className = "projection-line";
      return;
    }
    // 2026-08-09 bug fix: defaultFieldPick returns ROSTER instance ids
    // (e.g. "p0_bracer"), not raw pool ids ("bracer") — makePlayerSide
    // expects the latter (it calls findHeroDef, which only knows pool ids).
    // fieldSquad is the correct roster.ts helper for turning a set of
    // instance ids back into a fightable SideState.
    const draft = makePlayerSide([...selected]);
    const fielded = fieldSquad(draft, defaultFieldPick(draft, cfg.playerN));
    const proj = project(fielded, enemyPreview, cfg.fight);
    projectionLine.textContent = `Default fielding: ${proj.verdict}`;
    projectionLine.className = `projection-line band-${proj.band}`;
  }

  for (const def of PLAYER_HERO_POOL) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "hero-pick-row";
    row.innerHTML = `
      <span class="hero-pick-check"></span>
      <span class="hero-pick-info">
        <span class="hero-pick-name">${def.name}</span>
        <span class="hero-pick-role">${def.role}</span>
        <span class="hero-pick-identity">${def.identity}</span>
      </span>
      <span class="hero-pick-stats">
        <span class="hero-pick-numbers">${def.maxHp}hp / ${def.damage}dmg / ${def.attackIntervalSec}s${def.healPerBeat ? ` +${def.healPerBeat}heal` : ""}${def.attacksWhileHealing ? " +atk" : ""}</span>
        <span class="hero-pick-chain" title="Chain affinity — how big this hero's chain lands, good or backfired">CHAIN ${chainAffinityPips(def.chainAffinity)}</span>
      </span>
    `;
    row.addEventListener("click", () => {
      if (selected.has(def.id)) {
        selected.delete(def.id);
      } else {
        if (selected.size >= draftSize) {
          const oldest = selected.values().next().value;
          if (oldest) selected.delete(oldest);
        }
        selected.add(def.id);
      }
      refreshChecks();
      refreshPlayState();
      refreshProjection();
    });
    rows.set(def.id, row);
    list.appendChild(row);
  }

  refreshChecks();
  refreshPlayState();
  refreshProjection();
  playBtn.addEventListener("click", () => onPlay([...selected]));

  screen.appendChild(list);
  screen.appendChild(projectionLine);
  screen.appendChild(playBtn);
  container.appendChild(screen);
}
