import type { RunConfig } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { MIN_CHAIN_AFFINITY, MAX_CHAIN_AFFINITY } from "../sim/heroes.js";
import { defaultFieldPick, fieldSquad, livingRosterHeroes, type RosterState } from "../sim/roster.js";
import { makeEnemySide } from "../sim/run.js";
import { project } from "../sim/projection.js";
import { chainEffectLines, chainVsEncounterLine, backfireRiskPips, chargeBarHtml } from "./heroPickShared.js";

/** HP fractions where the field-pick row changes how loudly it reads
 * (2026-09-21 — see hpSeverity below).
 *
 * Checked against every roster in the played run these came from
 * (logs/260921_2127): at 0.75/0.4, fight 2 marks the 30% Bracer critical (he
 * was correctly benched), fight 3 marks the 67% Hollow, and fight 4 marks the
 * 68% Bracer while leaving the 100% Hollow clean — which is exactly the
 * contrast that fight needed and didn't have. Fights 1 and 5 stay entirely
 * unmarked, so the mark still means something.
 *
 * An earlier 0.6/0.33 pair was discarded for failing that test: it read all
 * four of fight 4's heroes as fine, including the Bracer who died. */
const HP_HURT_FRACTION = 0.75;
const HP_CRITICAL_FRACTION = 0.4;

/** Which of the three HP bands a hero is in, as a CSS-class suffix.
 *
 * Exists because of the 2026-09-21 played run (logs/260921_2127, seed
 * 4866404): a full-HP Hollow sat on the bench while a two-thirds Bracer was
 * fielded and died, costing the run — and the row showed current HP as the
 * smallest, greyest text on it while the charge bar carried the color. The
 * chain is still the reason to PICK a hero (that's the game — see STATE.md's
 * bet); current HP is the reason to NOT field one, and it had no way to say
 * so. roster.ts's defaultFieldPick already sorts on exactly this number and
 * ignores charge entirely; this makes the screen show the same reasoning the
 * accept-default is already using. */
function hpSeverity(h: HeroState): "ok" | "hurt" | "critical" {
  const frac = h.maxHp > 0 ? h.hp / h.maxHp : 0;
  if (frac < HP_CRITICAL_FRACTION) return "critical";
  if (frac < HP_HURT_FRACTION) return "hurt";
  return "ok";
}

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

  const chainLine = document.createElement("p");
  chainLine.className = "projection-detail";

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
      chainLine.textContent = "";
      return;
    }
    const proj = project(fieldSquad(roster, [...selected]), enemyPreview, cfg.fight);
    projectionLine.textContent = proj.verdict;
    projectionLine.className = `projection-line band-${proj.band}`;
    chainLine.textContent = proj.chainLine;
  }

  function heroRowHtml(h: HeroState): string {
    const chain = chainEffectLines(h.chainEffect ?? "poundBiggest");
    return `
      <span class="hero-pick-check"></span>
      <span class="hero-pick-info">
        <span class="hero-pick-name">${h.name}</span>
        <span class="hero-pick-hp hp-${hpSeverity(h)}">${Math.round(h.hp)}<span class="hero-pick-hp-max">/${Math.round(h.maxHp)}</span></span>
        <span class="hero-pick-role">${h.role}</span>
      </span>
      <span class="hero-pick-stats">
        <span class="hero-pick-numbers">${h.damage}dmg / ${h.attackIntervalSec}s${h.healPerBeat ? ` +${h.healPerBeat}heal` : ""}${h.attacksWhileHealing ? " +atk" : ""}</span>
        <span class="hero-pick-chain">CHAIN: ${chain.does}</span>
        <span class="hero-pick-chain-against">${chainVsEncounterLine(h.chainEffect ?? "poundBiggest", enemyPreview)}</span>
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
  playBtn.addEventListener("click", () => onField([...selected]));

  screen.appendChild(list);
  screen.appendChild(projectionLine);
  screen.appendChild(chainLine);

  if (dead.length > 0) {
    const fallen = document.createElement("p");
    fallen.className = "hint fallen-note";
    fallen.textContent = `Fallen: ${dead.map((h) => h.name).join(", ")}.`;
    screen.appendChild(fallen);
  }

  screen.appendChild(playBtn);
  container.appendChild(screen);
}
