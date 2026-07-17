import { effectiveDamage, effectiveMaxHp, type HeroInstance } from "../game/hero";
import { roleBlurb, roleLabel } from "../game/roleInfo";
import type { UnitDef } from "../sim/types";
import { cssColor, TEAM_COLORS } from "./palette";
import { shortLabel } from "./unitShapes";

/**
 * The always-on hero-info panel shown alongside the setup canvas (DECISIONS: setup is
 * intuitive to *operate* but a new player can't tell what a hero *is* from a shape + a
 * 3-letter code). This is the DOM/game-layer home for hero identity — name, role, a plain-
 * language role description, and stats — deliberately kept out of unitShapes.ts, which
 * stays ignorant of hero identity by design.
 *
 * Shows only what the sim actually does: no fabricated abilities. Same-role heroes are
 * stat-identical today, so the honest description is the role's, not the individual's.
 *
 * Each card carries data-hero-id so setupStage.ts token hover/tap can two-way-link to it.
 */

function statRow(maxHp: number, damage: number, range: number, moveSpeed: number, attackSpeed: number): string {
  return `
    <div class="stat-row">
      <span title="Max HP">❤ ${maxHp}</span>
      <span title="Damage per hit">⚔ ${damage}</span>
      <span title="Attack range, in hexes">➤ ${range}</span>
      <span title="Move speed, hexes/sec">➜ ${moveSpeed}</span>
      <span title="Attacks per second">⏱ ${attackSpeed}</span>
    </div>
  `;
}

function bonusTag(pct: number, label: string): string {
  if (pct <= 0) return "";
  return `<span class="bonus-tag" title="Earned this run">${label} +${Math.round(pct * 100)}%</span>`;
}

function playerCard(hero: HeroInstance): string {
  const hp = effectiveMaxHp(hero);
  const dmg = effectiveDamage(hero);
  return `
    <div class="hero-card" data-hero-id="${hero.id}" style="--card-accent:${cssColor(TEAM_COLORS.player)}">
      <div class="hero-card-head">
        <span class="hero-name">${hero.name}</span>
        <span class="hero-role">${roleLabel(hero.role)}</span>
      </div>
      <p class="hero-blurb">${roleBlurb(hero.role)}</p>
      ${statRow(hp, dmg, hero.range, hero.moveSpeed, hero.attackSpeed)}
      <div class="bonus-tags">${bonusTag(hero.hpBonusPct, "HP")}${bonusTag(hero.dmgBonusPct, "DMG")}</div>
    </div>
  `;
}

function enemyCard(unit: UnitDef): string {
  return `
    <div class="hero-card enemy" data-hero-id="${unit.id}" style="--card-accent:${cssColor(TEAM_COLORS.enemy)}">
      <div class="hero-card-head">
        <span class="hero-name">${shortLabel(unit.id)}</span>
        <span class="hero-role">${roleLabel(unit.role)}</span>
      </div>
      <p class="hero-blurb">${roleBlurb(unit.role)}</p>
      ${statRow(unit.maxHp, unit.damage, unit.range, unit.moveSpeed, unit.attackSpeed)}
    </div>
  `;
}

export function rosterPanelMarkup(bench: readonly HeroInstance[], enemyRoster: readonly UnitDef[]): string {
  return `
    <div id="roster-panel">
      <div class="roster-group">
        <h2>Your squad</h2>
        <div class="hero-cards">${bench.map(playerCard).join("")}</div>
      </div>
      <div class="roster-group">
        <h2>Enemy squad</h2>
        <div class="hero-cards">${enemyRoster.map(enemyCard).join("")}</div>
      </div>
    </div>
  `;
}
