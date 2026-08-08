import type { RunConfig } from "../sim/config.js";
import { DEFAULT_PLAYER_ROSTER_IDS, MAX_CHAIN_AFFINITY, PLAYER_HERO_POOL, makePlayerSide } from "../sim/heroes.js";
import { makeEnemySide } from "../sim/run.js";
import { project } from "../sim/projection.js";

/** Renders a hero's chainAffinity as filled/empty pips, normalized against
 * the pool's own highest value (2026-08-08 — the player's complaint was that
 * squad choice had no visible connection to the cascade; this is that
 * connection, made literal at pick time, the way a Dota player reads an
 * item's stats before deciding to build it). */
function chainAffinityPips(affinity: number): string {
  const filled = Math.max(1, Math.round((affinity / MAX_CHAIN_AFFINITY) * 5));
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

/**
 * Run-start squad pick: 3 of 6, pre-checked with the default roster and a
 * prominent Play button — the accept-default path is a single tap, per the
 * "optional layer must stay optional" rule (DECISIONS.md 2026-07-26, 0/4 in
 * probing when forced). Picking a 4th swaps out the earliest pick so the
 * roster always holds exactly 3.
 *
 * As of 2026-08-06 (see DECISIONS.md's "squad pick is the risk dial" entry)
 * the pick also renders a live projection verdict against fight 1's enemy
 * composition, computed by sim/projection.ts — the same module the
 * pre-fight screen and the post-fight recap use, so the three can never
 * disagree about what a comp was expected to do.
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
  h1.textContent = "Assemble your squad";
  screen.appendChild(h1);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Pick 3 — or just hit Play.";
  screen.appendChild(hint);

  const selected = new Set<string>(DEFAULT_PLAYER_ROSTER_IDS);

  const list = document.createElement("div");
  list.className = "hero-pick-list";
  const rows = new Map<string, HTMLElement>();

  const projectionLine = document.createElement("p");
  projectionLine.className = "projection-line";

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";

  const enemyPreview = makeEnemySide(cfg, 0);

  function refreshPlayState(): void {
    const ready = selected.size === 3;
    playBtn.disabled = !ready;
    playBtn.textContent = ready ? "Play" : `Pick ${3 - selected.size} more`;
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
    if (selected.size !== 3) {
      projectionLine.textContent = "";
      projectionLine.className = "projection-line";
      return;
    }
    const proj = project(makePlayerSide([...selected]), enemyPreview, cfg.fight);
    projectionLine.textContent = proj.verdict;
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
        <span class="hero-pick-chain" title="Chain affinity — how often and how big this hero's cascade lands">CHAIN ${chainAffinityPips(def.chainAffinity)}</span>
      </span>
    `;
    row.addEventListener("click", () => {
      if (selected.has(def.id)) {
        selected.delete(def.id);
      } else {
        if (selected.size >= 3) {
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
