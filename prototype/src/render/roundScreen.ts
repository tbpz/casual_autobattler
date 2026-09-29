import type { RunConfig } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { MIN_CHAIN_AFFINITY, MAX_CHAIN_AFFINITY, PLAYER_ROLES, ROLE_LABEL, ROLE_POOL, type PlayerRole } from "../sim/roles.js";
import type { RunProgress } from "../sim/progress.js";
import { chainStrongerCount } from "../sim/progress.js";
import { defaultFieldPick, type RosterState } from "../sim/roster.js";
import { roundEnemySide, ROUND_PLAN } from "../sim/rounds.js";
import type { EncounterKind } from "../sim/encounters.js";
import {
  backfireRiskPipCount,
  chainAnswersSlam,
  chainEffectChip,
  chainEffectLines,
  chainVsEncounterLine,
  CHARGE_NEAR_THRESHOLD_FRACTION,
} from "./heroPickShared.js";

/** HP fractions where a round token's bar changes how loudly it reads —
 * carried over unchanged from the old fieldPickScreen.ts. */
const HP_HURT_FRACTION = 0.75;
const HP_CRITICAL_FRACTION = 0.4;

function hpSeverity(h: HeroState): "ok" | "hurt" | "critical" {
  const frac = h.maxHp > 0 ? h.hp / h.maxHp : 0;
  if (frac < HP_CRITICAL_FRACTION) return "critical";
  if (frac < HP_HURT_FRACTION) return "hurt";
  return "ok";
}

const ROLE_ICON: Record<PlayerRole, string> = { tank: "🛡", damage: "⚔", support: "✚" };
/** The FIGHTING strip's per-unit code ("T1", "D1", "H1") — first letter of
 * ROLE_LABEL, same convention design/canvas/RoundGrown.dc.html uses. */
const ROLE_CODE: Record<PlayerRole, string> = { tank: "T", damage: "D", support: "H" };
const ROLE_CSS_VAR: Record<PlayerRole, string> = { tank: "--role-tank", damage: "--role-damage", support: "--role-healer" };

/** A unit's own number within its role, read off the end of its display
 * name ("Tank 2" -> 2) — makeUnitState (sim/roles.ts) bakes it in at
 * creation and never recomputes it, so this is a display-only re-read, not
 * a second source of truth. */
function unitOrdinal(name: string): string {
  const m = /(\d+)\s*$/.exec(name);
  return m ? m[1]! : "?";
}

function backfireRiskWord(count: number): string {
  if (count <= 2) return "low";
  if (count === 3) return "medium";
  return "high";
}

function strongerCountWord(n: number): string {
  if (n === 1) return "once";
  if (n === 2) return "twice";
  return `${n} times`;
}

/**
 * 2026-09-29 round-screen rebuild (see design/HANDOFF.md "Round screen" and
 * DECISIONS.md's 2026-09-23 entries — this replaces the old one-text-row-
 * per-unit list wholesale, drawn from design/canvas/RoundStart/RoundGrown/
 * RoundPress.dc.html). One band per ROLE (icon, ability chips, a +N
 * "stronger" badge, a ✓-vs-slam tag, backfire-risk dots) with that role's
 * units drawn underneath as round tokens — a charge ring + an HP bar, a
 * number, nothing else. Holding a band down (pointerdown/up) drops in a card
 * with the full sentences the header only hints at — same words the old row
 * always showed, just one press away instead of always on screen
 * (DECISIONS.md's "opens on press-and-hold" entry).
 *
 * Chain identity is still shown ONCE PER ROLE, not once per unit — every
 * unit of a role shares the same chain ability list/level (roster.ts's
 * stampProgressOntoSquad).
 */
export function renderRoundScreen(
  container: HTMLElement,
  cfg: RunConfig,
  roundIndex: number,
  encounterIndex: number,
  roster: RosterState,
  progress: RunProgress,
  encounterName: string,
  // No longer shown (2026-09-29 rebuild) — the enemy row + role bands
  // replace the old text blurb. Kept in the signature so app.ts's call site
  // doesn't need to change.
  _encounterBlurb: string,
  // Not read directly (2026-09-29 rebuild) — the mini-boss/boss ticks below
  // are drawn straight from ROUND_PLAN instead, which already carries this
  // round's own kind. Kept in the signature so app.ts's call site doesn't
  // need to change.
  _roundKind: EncounterKind,
  onPlay: (fieldedIds: string[]) => void,
): void {
  container.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "round-panel";

  const enemyPreview = roundEnemySide(cfg, roundIndex, encounterIndex);
  const fieldSize = progress.slots;
  const selected = new Set<string>(defaultFieldPick(roster, fieldSize));

  // ---------- header: round counter + progress bar ----------
  const header = document.createElement("div");
  header.className = "round-header";
  const headerLabel = document.createElement("div");
  headerLabel.className = "round-header-label";
  headerLabel.textContent = `ROUND ${roundIndex + 1}/${cfg.roundsPerRun}`;
  header.appendChild(headerLabel);

  const track = document.createElement("div");
  track.className = "round-progress-track";
  const fill = document.createElement("div");
  fill.className = "round-progress-fill";
  fill.style.width = `${((roundIndex + 1) / cfg.roundsPerRun) * 100}%`;
  track.appendChild(fill);
  const plan = ROUND_PLAN.slice(0, cfg.roundsPerRun);
  plan.forEach((r, i) => {
    if (r.kind !== "miniboss" && r.kind !== "boss") return;
    const roundNumber = i + 1;
    const tick = document.createElement("div");
    tick.className = `round-progress-tick${r.kind === "boss" ? " boss" : ""}${roundIndex + 1 >= roundNumber ? " lit" : ""}`;
    tick.style.left = `${(roundNumber / cfg.roundsPerRun) * 100}%`;
    track.appendChild(tick);
  });
  header.appendChild(track);
  panel.appendChild(header);

  // ---------- enemy row ----------
  const enemyName = document.createElement("div");
  enemyName.className = "round-enemy-name";
  enemyName.textContent = encounterName;
  panel.appendChild(enemyName);

  const enemyRow = document.createElement("div");
  enemyRow.className = "round-enemy-row";
  for (const e of enemyPreview.heroes) {
    const isBruiser = e.role === "bruiser";
    const enemyEl = document.createElement("div");
    enemyEl.className = `round-enemy${isBruiser ? " bruiser" : ""}`;
    const body = document.createElement("div");
    body.className = "round-enemy-body";
    enemyEl.appendChild(body);
    if (isBruiser) {
      const mark = document.createElement("div");
      mark.className = "round-enemy-slam-mark";
      mark.textContent = "💥";
      enemyEl.appendChild(mark);
    }
    const hp = document.createElement("div");
    hp.className = "round-enemy-hp";
    hp.textContent = `${Math.round(e.hp)}/${Math.round(e.maxHp)}`;
    enemyEl.appendChild(hp);
    enemyRow.appendChild(enemyEl);
  }
  panel.appendChild(enemyRow);
  panel.appendChild(divider());

  // ---------- role bands ----------
  const tokenRefs = new Map<string, { wrap: HTMLElement; badge: HTMLElement }>();
  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";

  function refreshPlayState(): void {
    const ready = selected.size === fieldSize;
    playBtn.disabled = !ready;
    playBtn.textContent = ready ? "Play" : `Pick ${fieldSize - selected.size} more`;
  }

  function refreshTokens(): void {
    for (const [id, refs] of tokenRefs) {
      const isSelected = selected.has(id);
      refs.wrap.classList.toggle("not-picked", !isSelected);
      refs.badge.classList.toggle("hollow", !isSelected);
      refs.badge.textContent = isSelected ? "✓" : "";
    }
    refreshFightingStrip();
  }

  function toggle(id: string): void {
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      if (selected.size >= fieldSize) {
        const oldest = selected.values().next().value;
        if (oldest) selected.delete(oldest);
      }
      selected.add(id);
    }
    refreshTokens();
    refreshPlayState();
  }

  for (const role of PLAYER_ROLES) {
    const roleUnits = roster.heroes.filter((h) => h.role === role);
    if (roleUnits.length === 0) continue;
    const roleProgress = progress.chain[role];
    const answersSlam = chainAnswersSlam(roleProgress.effects, enemyPreview);
    const strongerCount = chainStrongerCount(progress, role);
    const pipCount = backfireRiskPipCount(cfg.fight, ROLE_POOL[role].chainAffinity, MIN_CHAIN_AFFINITY, MAX_CHAIN_AFFINITY);

    const band = document.createElement("div");
    band.className = "round-band";

    const bandHeader = document.createElement("div");
    bandHeader.className = "round-band-header";

    const icon = document.createElement("span");
    icon.className = "round-band-icon";
    icon.textContent = ROLE_ICON[role];
    bandHeader.appendChild(icon);

    const label = document.createElement("span");
    label.className = "round-band-label";
    label.textContent = ROLE_LABEL[role].toUpperCase();
    bandHeader.appendChild(label);

    for (const effect of roleProgress.effects) {
      const { icon: chipIcon, word } = chainEffectChip(effect);
      const chip = document.createElement("span");
      chip.className = "round-chip";
      chip.innerHTML = `<span class="round-chip-icon">${chipIcon}</span><span class="round-chip-word">${word}</span>`;
      bandHeader.appendChild(chip);
    }

    if (strongerCount > 0) {
      const badge = document.createElement("span");
      badge.className = "round-stronger-badge";
      badge.textContent = `+${strongerCount}`;
      bandHeader.appendChild(badge);
    }

    if (answersSlam) {
      const tag = document.createElement("span");
      tag.className = "round-answer-tag";
      tag.textContent = "✓ vs 💥";
      bandHeader.appendChild(tag);
    }

    const dots = document.createElement("span");
    dots.className = "round-backfire-dots";
    dots.title = "backfire risk";
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement("span");
      dot.className = `round-backfire-dot${i < pipCount ? " filled" : ""}`;
      dots.appendChild(dot);
    }
    bandHeader.appendChild(dots);
    band.appendChild(bandHeader);

    // The hold card (DECISIONS.md 2026-09-23 "opens on press-and-hold") —
    // built once, shown/hidden by pointerdown/up rather than rebuilt each
    // time, since its content never changes while this screen is open.
    const card = document.createElement("div");
    card.className = "round-band-card";
    card.style.display = "none";
    for (const effect of roleProgress.effects) {
      const { icon: chipIcon, word } = chainEffectChip(effect);
      const name = word.charAt(0).toUpperCase() + word.slice(1);
      const line = document.createElement("div");
      line.className = "round-band-card-line";
      line.innerHTML = `<strong>${chipIcon} ${name}.</strong> ${chainEffectLines(effect).does}`;
      card.appendChild(line);
    }
    const answerLine = document.createElement("div");
    answerLine.className = "round-band-card-answer";
    answerLine.textContent = chainVsEncounterLine(roleProgress.effects, enemyPreview);
    card.appendChild(answerLine);
    if (strongerCount > 0) {
      const strongerLine = document.createElement("div");
      strongerLine.className = "round-band-card-meta";
      strongerLine.textContent = `Made stronger ${strongerCountWord(strongerCount)}.`;
      card.appendChild(strongerLine);
    }
    const backfireLine = document.createElement("div");
    backfireLine.className = "round-band-card-meta";
    backfireLine.textContent = `Backfire risk: ${backfireRiskWord(pipCount)} (${pipCount} of 5).`;
    card.appendChild(backfireLine);
    band.appendChild(card);

    let held = false;
    function setHeld(next: boolean): void {
      if (held === next) return;
      held = next;
      bandHeader.classList.toggle("held", held);
      card.style.display = held ? "block" : "none";
    }
    bandHeader.addEventListener("pointerdown", () => setHeld(true));
    bandHeader.addEventListener("pointerup", () => setHeld(false));
    bandHeader.addEventListener("pointerleave", () => setHeld(false));
    bandHeader.addEventListener("pointercancel", () => setHeld(false));
    bandHeader.addEventListener("contextmenu", (e) => e.preventDefault());

    // ---------- unit tokens ----------
    const tokenRow = document.createElement("div");
    tokenRow.className = "round-token-row";
    for (const h of roleUnits) {
      const ordinal = unitOrdinal(h.name);
      if (!h.alive) {
        const wrap = document.createElement("div");
        wrap.className = "round-token fallen";
        wrap.innerHTML = `
          <div class="round-token-body-wrap">
            <div class="round-token-body">${ordinal}</div>
            <div class="round-token-badge fallen">✕</div>
          </div>
          <div class="round-token-hp"></div>
        `;
        tokenRow.appendChild(wrap);
        continue;
      }

      const isSelected = selected.has(h.id);
      const chargeFrac = cfg.fight.chargeThreshold > 0 ? Math.min(h.charge / cfg.fight.chargeThreshold, 1) : 0;
      const nearThreshold = chargeFrac >= CHARGE_NEAR_THRESHOLD_FRACTION;
      const severity = hpSeverity(h);
      const hpFrac = h.maxHp > 0 ? Math.max(h.hp, 0) / h.maxHp : 0;

      const wrap = document.createElement("button");
      wrap.type = "button";
      wrap.className = `round-token${isSelected ? "" : " not-picked"}`;
      wrap.innerHTML = `
        <div class="round-token-body-wrap">
          <div class="round-token-ring${nearThreshold ? " near-threshold" : ""}" style="--token-charge-frac: ${chargeFrac.toFixed(3)}"></div>
          <div class="round-token-body" style="background: var(${ROLE_CSS_VAR[role]})">${ordinal}</div>
          <div class="round-token-badge${isSelected ? "" : " hollow"}" style="background: ${isSelected ? `var(${ROLE_CSS_VAR[role]})` : ""}">${isSelected ? "✓" : ""}</div>
        </div>
        <div class="round-token-hp"><div class="round-token-hp-fill${severity === "ok" ? "" : ` ${severity}`}" style="width: ${(hpFrac * 100).toFixed(1)}%"></div></div>
      `;
      wrap.addEventListener("click", () => toggle(h.id));
      const badge = wrap.querySelector(".round-token-badge") as HTMLElement;
      tokenRefs.set(h.id, { wrap, badge });
      tokenRow.appendChild(wrap);
    }
    band.appendChild(tokenRow);
    panel.appendChild(band);
  }

  panel.appendChild(divider());

  // ---------- FIGHTING strip ----------
  const strip = document.createElement("div");
  strip.className = "round-fighting-strip";
  const stripLabel = document.createElement("span");
  stripLabel.className = "round-fighting-label";
  stripLabel.textContent = "FIGHTING";
  strip.appendChild(stripLabel);
  const chips = document.createElement("div");
  chips.className = "round-fighting-chips";
  strip.appendChild(chips);
  const count = document.createElement("span");
  count.className = "round-fighting-count";
  strip.appendChild(count);
  panel.appendChild(strip);

  function refreshFightingStrip(): void {
    chips.innerHTML = "";
    for (const id of selected) {
      const h = roster.heroes.find((u) => u.id === id);
      if (!h || h.role === "bruiser" || h.role === "grunt") continue;
      const chip = document.createElement("div");
      chip.className = "round-fighting-chip";
      chip.style.background = `var(${ROLE_CSS_VAR[h.role]})`;
      chip.textContent = `${ROLE_CODE[h.role]}${unitOrdinal(h.name)}`;
      chips.appendChild(chip);
    }
    count.textContent = `${selected.size}/${fieldSize}`;
  }

  panel.appendChild(playBtn);
  playBtn.addEventListener("click", () => onPlay([...selected]));

  refreshTokens();
  refreshPlayState();

  container.appendChild(panel);
}

function divider(): HTMLElement {
  const el = document.createElement("div");
  el.className = "round-divider";
  return el;
}
