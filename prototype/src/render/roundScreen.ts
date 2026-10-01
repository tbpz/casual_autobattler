import { backfireChanceFor, fatigueTier, type MarkId, type RunConfig } from "../sim/config.js";
import type { HeroState } from "../sim/types.js";
import { PLAYER_ROLES, ROLE_LABEL, type PlayerRole } from "../sim/roles.js";
import type { RunProgress } from "../sim/progress.js";
import { MARK_CHIP, CARD_DEFS, DUO_IDS, cardConnects, duoUnlocked } from "../sim/cards/index.js";
import { squadChainEffects } from "../sim/offers.js";
import { chainStrongerCount, heldCards } from "../sim/progress.js";
import { defaultFieldPick, type RosterState } from "../sim/roster.js";
import { roundEnemySide, ROUND_PLAN } from "../sim/rounds.js";
import type { EncounterKind } from "../sim/encounters.js";
import {
  chainAnswersSlam,
  chainEffectChip,
  chainEffectLines,
  chainVsEncounterLine,
  fatiguePipsHtml,
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
export const ROLE_CSS_VAR: Record<PlayerRole, string> = { tank: "--role-tank", damage: "--role-damage", support: "--role-healer" };

/** A unit's own number within its role, read off the end of its display
 * name ("Tank 2" -> 2) — makeUnitState (sim/roles.ts) bakes it in at
 * creation and never recomputes it, so this is a display-only re-read, not
 * a second source of truth. */
function unitOrdinal(name: string): string {
  const m = /(\d+)\s*$/.exec(name);
  return m ? m[1]! : "?";
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
 * "stronger" badge, a ✓-vs-slam tag) with that role's units drawn underneath
 * as round tokens — an HP bar, a number, a stack of fatigue-tier pips beside
 * the circle, and the tier word once a unit is no longer Fresh (DECISIONS.md
 * 2026-09-30). Tapping a band header (or a held payoff card) toggles
 * a floating popover with the full sentences the header only hints at — same
 * words the old row always showed, just one tap away instead of always on
 * screen. It floats rather than sitting inline so opening it never moves the
 * layout (supersedes DECISIONS.md's 2026-09-23 "opens on press-and-hold").
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

  // ---------- detail popover (shared by role bands and held cards) ----------
  // One floating box, position: fixed, so opening it never reflows the page
  // (the old inline hold-card shifted the whole centred panel). Appended to
  // `container`, not `panel` — the panel clips its overflow.
  const popover = document.createElement("div");
  popover.className = "round-popover";
  popover.style.display = "none";
  let popoverAnchor: HTMLElement | null = null;

  function closePopover(): void {
    popover.style.display = "none";
    popoverAnchor?.classList.remove("open");
    popoverAnchor = null;
  }

  function placePopover(anchor: HTMLElement): void {
    const margin = 8;
    const a = anchor.getBoundingClientRect();
    const p = popover.getBoundingClientRect();
    const fitsBelow = a.bottom + 6 + p.height <= window.innerHeight - margin;
    const top = fitsBelow ? a.bottom + 6 : Math.max(margin, a.top - 6 - p.height);
    const left = Math.min(Math.max(margin, a.left), Math.max(margin, window.innerWidth - p.width - margin));
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function togglePopover(anchor: HTMLElement, content: HTMLElement[]): void {
    if (popoverAnchor === anchor) {
      closePopover();
      return;
    }
    closePopover();
    popover.replaceChildren(...content);
    popover.style.display = "block";
    popoverAnchor = anchor;
    anchor.classList.add("open");
    placePopover(anchor);
  }

  // Document-level listeners outlive this render; each one drops itself the
  // first time it fires after the screen has been replaced.
  function whileMounted(handler: (e: Event) => void): (e: Event) => void {
    const wrapped = (e: Event): void => {
      if (!popover.isConnected) {
        document.removeEventListener("pointerdown", wrapped, true);
        window.removeEventListener("scroll", wrapped, true);
        window.removeEventListener("resize", wrapped);
        return;
      }
      handler(e);
    };
    return wrapped;
  }
  const onOutside = whileMounted((e) => {
    const t = e.target as Node | null;
    if (t && (popover.contains(t) || popoverAnchor?.contains(t))) return;
    closePopover();
  });
  const onMove = whileMounted(() => closePopover());
  document.addEventListener("pointerdown", onOutside, true);
  window.addEventListener("scroll", onMove, true);
  window.addEventListener("resize", onMove);

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
      refs.badge.classList.toggle("unpicked", !isSelected);
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

    band.appendChild(bandHeader);

    // The detail popover (tap to toggle) — floats over the page, so opening
    // it never moves the layout. Lines are built on open; cheap, and it keeps
    // them out of the DOM until asked for.
    bandHeader.addEventListener("click", () => {
      const lines: HTMLElement[] = [];
      for (const effect of roleProgress.effects) {
        const { icon: chipIcon, word } = chainEffectChip(effect);
        const name = word.charAt(0).toUpperCase() + word.slice(1);
        const line = document.createElement("div");
        line.innerHTML = `<strong>${chipIcon} ${name}.</strong> ${chainEffectLines(effect).does}`;
        lines.push(line);
      }
      const answerLine = document.createElement("div");
      answerLine.className = "round-popover-answer";
      answerLine.textContent = chainVsEncounterLine(roleProgress.effects, enemyPreview);
      lines.push(answerLine);
      if (strongerCount > 0) {
        lines.push(popoverMeta(`Made stronger ${strongerCountWord(strongerCount)}.`));
      }
      // Backfire risk is per unit now (DECISIONS.md 2026-09-30): each living
      // unit's own fatigue tier and the chance its next chain goes wrong.
      for (const u of roleUnits) {
        if (!u.alive) continue;
        const chance = Math.round(backfireChanceFor(cfg.fight, u.fatigue) * 100);
        lines.push(popoverMeta(`${u.name}: ${fatigueTier(cfg.fight, u.fatigue)} — ${chance}% backfire.`));
      }
      togglePopover(bandHeader, lines);
    });
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
      const severity = hpSeverity(h);
      const hpFrac = h.maxHp > 0 ? Math.max(h.hp, 0) / h.maxHp : 0;
      const tier = fatigueTier(cfg.fight, h.fatigue);
      const backfirePct = Math.round(backfireChanceFor(cfg.fight, h.fatigue) * 100);

      const wrap = document.createElement("button");
      wrap.type = "button";
      wrap.className = `round-token${isSelected ? "" : " not-picked"}`;
      wrap.title = `${h.name}: ${tier}, ${backfirePct}% backfire`;
      wrap.innerHTML = `
        <div class="round-token-main">
          <div class="round-token-body-wrap">
            <div class="round-token-body" style="background: var(${ROLE_CSS_VAR[role]})">${ordinal}</div>
            <div class="round-token-badge${isSelected ? "" : " unpicked"}" style="background: var(${ROLE_CSS_VAR[role]})">${isSelected ? "✓" : ""}</div>
          </div>
          ${fatiguePipsHtml(tier)}
        </div>
        <div class="round-token-hp"><div class="round-token-hp-fill${severity === "ok" ? "" : ` ${severity}`}" style="width: ${(hpFrac * 100).toFixed(1)}%"></div></div>
        <div class="round-token-tier tier-${tier}">${tier === "fresh" ? "&nbsp;" : tier}</div>
      `;
      wrap.addEventListener("click", () => toggle(h.id));
      const badge = wrap.querySelector(".round-token-badge") as HTMLElement;
      tokenRefs.set(h.id, { wrap, badge });
      tokenRow.appendChild(wrap);
    }
    band.appendChild(tokenRow);
    panel.appendChild(band);
  }

  // ---------- relic and held cards (2026-09-30, relic 2026-10-01) ----------
  if (progress.cards.length > 0 || progress.relic) {
    const payoffRow = document.createElement("div");
    payoffRow.className = "round-payoff-row";
    const payoffLabel = document.createElement("span");
    payoffLabel.className = "round-payoff-label";
    payoffLabel.textContent = `CARDS ${progress.cards.length}/${cfg.cardCap}`;
    payoffRow.appendChild(payoffLabel);
    const squadEffects = squadChainEffects(progress, roster);
    const held = heldCards(progress);
    const markLine = (label: string, marks: readonly MarkId[]): HTMLElement => {
      const el = document.createElement("div");
      el.className = "round-popover-reads";
      el.innerHTML = `${label} ` + marks.map((m) => `<span class="mark-chip mark-${m}">${MARK_CHIP[m].icon} ${MARK_CHIP[m].word}</span>`).join("");
      return el;
    };
    // The relic first, then the cards in the order they were taken.
    for (const id of progress.relic ? [progress.relic, ...progress.cards] : progress.cards) {
      const def = CARD_DEFS[id];
      const isRelic = def.kind === "relic";
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = isRelic ? "round-payoff-card round-relic-card" : "round-payoff-card";
      chip.textContent = `${def.icon} ${def.title}`;
      chip.addEventListener("click", () => {
        const title = document.createElement("div");
        title.innerHTML = `<strong>${def.title}${isRelic ? " (relic)" : ""}.</strong> ${def.detail}`;
        const parts: HTMLElement[] = [title];
        if (def.reads.length > 0) parts.push(markLine("reads", def.reads));
        if (def.makes.length > 0) parts.push(markLine("makes", def.makes));
        if (!isRelic) {
          parts.push(
            cardConnects(id, squadEffects, held)
              ? Object.assign(document.createElement("div"), { className: "round-popover-answer", textContent: "★ Connects to your squad." })
              : popoverMeta("Nothing in your squad makes this yet."),
          );
        }
        // A duo this card is a part of: what it pairs with, or that it is unlocked.
        for (const duoId of DUO_IDS) {
          const needs = CARD_DEFS[duoId].needs;
          if (!needs?.cards?.includes(id)) continue;
          const others = needs.cards.filter((c) => c !== id);
          const missing = others.filter((c) => !held.includes(c));
          parts.push(
            popoverMeta(
              missing.length === 0 && duoUnlocked(duoId, squadEffects, held)
                ? `✧ Duo ${CARD_DEFS[duoId].title} is ready to be offered.`
                : `Pairs with ${others.map((c) => CARD_DEFS[c].title).join(" + ")} into ${CARD_DEFS[duoId].title}.`,
            ),
          );
        }
        togglePopover(chip, parts);
      });
      payoffRow.appendChild(chip);
    }
    panel.appendChild(payoffRow);
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
  playBtn.addEventListener("click", () => {
    closePopover();
    onPlay([...selected]);
  });

  refreshTokens();
  refreshPlayState();

  container.appendChild(panel);
  container.appendChild(popover);
}

function popoverMeta(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "round-popover-meta";
  el.textContent = text;
  return el;
}

function divider(): HTMLElement {
  const el = document.createElement("div");
  el.className = "round-divider";
  return el;
}
