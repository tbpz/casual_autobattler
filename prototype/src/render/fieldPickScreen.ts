import type { RunConfig } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { chainCoefficient } from "../sim/heroes.js";
import { defaultFieldPick, fieldSquad, livingRosterHeroes, type RosterState } from "../sim/roster.js";
import { makeEnemySide } from "../sim/run.js";
import { project } from "../sim/projection.js";
import { chainOutputPips, chargeBarHtml } from "./heroPickShared.js";

/**
 * Per-fight FIELD pick (2026-08-09 roster/bench pass — see config.ts's
 * DeathPolicy-removal docstring and squadPickScreen.ts's updated top
 * docstring): which cfg.playerN (3) of the living roster answer THIS fight,
 * pre-checked with roster.ts's defaultFieldPick so the minimum path stays
 * Play -> watch -> Play. Distinct from the run-start draft screen — that one
 * commits the roster for the whole run; this one is a fresh, informed choice
 * every fight, the puzzle Into the Breach-style full info is meant to
 * support (STATE.md's reference-games row): rest a hurt hero on the bench
 * (it recovers faster there — see config.ts's benchedRecoverFraction) and
 * field someone else, or field your strongest three regardless.
 *
 * Also lists any permanently-dead roster members below the pick, greyed —
 * "Cairn has fallen" needs to stay visible at exactly the moment its absence
 * changes what's fieldable, not just flash by in a recap and be forgotten.
 */
export function renderFieldPickScreen(
  container: HTMLElement,
  cfg: RunConfig,
  fightIndex: number,
  encounterIndex: number,
  roster: RosterState,
  encounterName: string | null,
  encounterBlurb: string | null,
  onField: (fieldedIds: string[]) => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen squad-pick field-pick";

  const h1 = document.createElement("h1");
  h1.textContent = `Field for fight ${fightIndex + 1}${encounterName ? ` — ${encounterName}` : ""}`;
  screen.appendChild(h1);

  // 2026-08-15 (encounter-deck pass, Chunk 3.6): the "question it asks" line
  // — written since the original 5-encounter table but never rendered
  // anywhere until now (see sim/encounters.ts's EncounterDef.blurb
  // docstring) — is what makes a DRAWN encounter readable rather than just a
  // name the player hasn't learned yet.
  if (encounterBlurb) {
    const blurb = document.createElement("p");
    blurb.className = "hint encounter-blurb";
    blurb.textContent = encounterBlurb;
    screen.appendChild(blurb);
  }

  const fieldSize = cfg.playerN;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = `Pick ${fieldSize} to fight — or just hit Play. A hero left on the bench heals faster.`;
  screen.appendChild(hint);

  const living = livingRosterHeroes(roster);
  const dead = roster.heroes.filter((h) => !h.alive);

  const selected = new Set<string>(defaultFieldPick(roster, fieldSize));

  const list = document.createElement("div");
  list.className = "hero-pick-list";
  const rows = new Map<string, HTMLElement>();

  const projectionLine = document.createElement("p");
  projectionLine.className = "projection-line";

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";

  const enemyPreview = makeEnemySide(cfg, fightIndex, encounterIndex);

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
      return;
    }
    const proj = project(fieldSquad(roster, [...selected]), enemyPreview, cfg.fight);
    projectionLine.textContent = proj.verdict;
    projectionLine.className = `projection-line band-${proj.band}`;
  }

  function heroRowHtml(h: HeroState): string {
    const hpFrac = h.maxHp > 0 ? Math.round((h.hp / h.maxHp) * 100) : 0;
    return `
      <span class="hero-pick-check"></span>
      <span class="hero-pick-info">
        <span class="hero-pick-name">${h.name}</span>
        <span class="hero-pick-role">${h.role} — ${hpFrac}% hp</span>
        ${chargeBarHtml(h.charge, cfg.fight.chargeThreshold)}
      </span>
      <span class="hero-pick-stats">
        <span class="hero-pick-numbers">${Math.round(h.hp)}/${Math.round(h.maxHp)}hp / ${h.damage}dmg / ${h.attackIntervalSec}s${h.healPerBeat ? ` +${h.healPerBeat}heal` : ""}${h.attacksWhileHealing ? " +atk" : ""}</span>
        <span class="hero-pick-chain" title="Chain — bigger pips land a bigger payoff AND carry a bigger backfire risk">CHAIN ${chainOutputPips(chainCoefficient(h))}</span>
      </span>
    `;
  }

  for (const h of living) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "hero-pick-row";
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
  playBtn.addEventListener("click", () => onField([...selected]));

  screen.appendChild(list);
  screen.appendChild(projectionLine);

  if (dead.length > 0) {
    const fallen = document.createElement("p");
    fallen.className = "hint fallen-note";
    fallen.textContent = `Fallen: ${dead.map((h) => h.name).join(", ")}.`;
    screen.appendChild(fallen);
  }

  screen.appendChild(playBtn);
  container.appendChild(screen);
}
