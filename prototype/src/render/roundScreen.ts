import type { RunConfig } from "../sim/config.js";
import { type PlayerRole } from "../sim/roles.js";
import type { RunProgress } from "../sim/progress.js";
import { CARD_DEFS, DUO_IDS, cardConnects, duoUnlocked, type CardId } from "../sim/cards/index.js";
import { squadChainEffects } from "../sim/offers.js";
import { heldCards } from "../sim/progress.js";
import type { RosterState } from "../sim/roster.js";
import { roundEnemySide } from "../sim/rounds.js";
import type { EncounterKind } from "../sim/encounters.js";
import { markWordsHtml } from "./heroPickShared.js";
import { ICON_SKULL_MINI } from "./icons.js";
import {
  benchUnitHtml,
  emptySlotHtml,
  enemyBodyHtml,
  esc,
  fierceScowl,
  rankOrder,
  roundStripHtml,
  squadBodyHtml,
} from "./roundParts.js";
import { openFighterPopup } from "./fighterPopup.js";
import { openTermCard } from "./termCards.js";
import { upgradesSection } from "./upgrades.js";
import { termFromTarget, termifyText } from "./terms.js";

export const ROLE_CSS_VAR: Record<PlayerRole, string> = { tank: "--role-tank", damage: "--role-damage", support: "--role-healer" };

/** The goal line ("your squad fights theirs on its own") is shown only on the first rounds. */
const GOAL_LINE_ROUNDS = 3;

export interface RoundScreenOpts {
  /** A tap on the shelf, `Change squad ›` or an empty slot: opens the squad screen with the pick so far. */
  onChangeSquad?: (pick: string[]) => void;
}

/**
 * The face-off round screen (canvas 1.1–1.5, DECISIONS.md 2026-10-09 to 2026-10-16): two squads about to fight.
 * A round strip with skull markers, a goal line on the first rounds, a hint line, a tinted ENEMY zone (bodies with villain eyes,
 * HP and damage as icons, a badge for a slam or a heal, the encounter blurb), a VS line, a tinted YOUR SQUAD zone (named fighters
 * in ranks, their eyes showing fatigue), a bench shelf, a compact relic and cards row (not on the canvas: it keeps the cards
 * readable before a fight), and a Fight button.
 *
 * The squad is read-only here. Swapping happens on the squad screen. `pick` is the squad so far: shorter than the slot count
 * when a unit died last round, in which case each empty slot is drawn as a ring and Fight is disabled until it is filled.
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
  pick: string[],
  lastFielded: string[],
  onFight: (fieldedIds: string[]) => void,
  opts: RoundScreenOpts = {},
): void {
  container.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "fo-card";

  const slots = progress.slots;
  const byId = new Map(roster.heroes.map((h) => [h.id, h]));
  const fielded = pick.map((id) => byId.get(id)).filter((h): h is NonNullable<typeof h> => !!h && h.alive);
  const emptyCount = Math.max(0, slots - fielded.length);
  const bench = roster.heroes.filter((h) => !fielded.some((f) => f.id === h.id));
  const enemy = roundEnemySide(cfg, roundIndex, encounterIndex);
  const fierce = fierceScowl(roundKind, encounterName);

  // ---------- enemy zone ----------
  const alone = enemy.heroes.length === 1;
  const tag =
    roundKind === "miniboss" || roundKind === "boss"
      ? `<span class="fo-kind-tag">${ICON_SKULL_MINI}${roundKind === "boss" ? "BOSS" : "MINI-BOSS"}</span>`
      : "";
  const enemyBodies = enemy.heroes
    .map((h) => enemyBodyHtml(h, { alone, fierce: fierce && h.role === "bruiser" }, Math.round(h.damage * cfg.fight.windupDamageMultiplier)))
    .join("");

  // ---------- squad zone ----------
  const layout = { slots };
  type Cell = { kind: "unit"; unit: (typeof fielded)[number] } | { kind: "empty" };
  const cells: Cell[] = [
    ...fielded.map((unit): Cell => ({ kind: "unit", unit })),
    ...Array.from({ length: emptyCount }, (): Cell => ({ kind: "empty" })),
  ];
  const ranked = rankOrder(cells, (c) => c.kind === "unit" && c.unit.role === "tank");
  const squadBodies = ranked
    .map(({ item, back }) => (item.kind === "unit" ? squadBodyHtml(item.unit, cfg, back, layout) : emptySlotHtml(layout)))
    .join("");
  const count = emptyCount > 0 ? `<span class="fo-count">${fielded.length} of ${slots}</span>` : "";

  const shelfHasContent = bench.length > 0;
  const shelf = shelfHasContent
    ? `<div class="fo-shelf tap"><div class="fo-shelfhead"><span class="fo-shelfname">BENCH</span><span class="fo-change">Change squad ›</span></div><div class="fo-shelfrow">${bench.map(benchUnitHtml).join("")}</div></div>`
    : `<div class="fo-shelf"><div class="fo-shelfhead"><span class="fo-shelfname">BENCH</span></div><div class="fo-shelf-empty">Empty. New recruits wait here.</div></div>`;

  // ---------- the fallen line and the button ----------
  const fallen = lastFielded.map((id) => byId.get(id)).filter((h): h is NonNullable<typeof h> => !!h && !h.alive);
  const fallenLine =
    emptyCount > 0
      ? `<div class="fo-fallen-line">${
          fallen.length > 0 ? `${esc(fallen.map((h) => h.name).join(" and "))} fell last round. ` : ""
        }Fill the empty slot${emptyCount > 1 ? "s" : ""} to fight.</div>`
      : "";

  panel.innerHTML = `
    ${roundStripHtml(cfg, roundIndex + 1)}
    ${roundIndex < GOAL_LINE_ROUNDS ? `<div class="fo-goal">Your squad fights theirs on its own. Wipe out the enemy squad to win the round.</div>` : ""}
    <div class="fo-hint">Tap any fighter to see what it does</div>
    <div class="fo-zone enemy">
      <div class="fo-zonehead"><span class="fo-pill enemy">ENEMY</span><span class="fo-zonename">${esc(encounterName)}</span>${tag}</div>
      <div class="fo-enemies">${enemyBodies}</div>
      <div class="fo-blurb">${termifyText(esc(encounterBlurb))}</div>
    </div>
    <div class="fo-vs"><span></span><b>VS</b><span></span></div>
    <div class="fo-zone squad">
      <div class="fo-zonehead"><span class="fo-pill squad">YOUR SQUAD</span>${count}</div>
      <div class="fo-squadrow">${squadBodies}</div>
      ${shelf}
    </div>
    <div class="up-slot"></div>
    ${fallenLine}
    <button class="fo-fight" type="button"></button>
  `;

  const fightBtn = panel.querySelector(".fo-fight") as HTMLButtonElement;
  fightBtn.disabled = emptyCount > 0;
  fightBtn.textContent = emptyCount > 0 ? `Pick ${emptyCount} from the bench` : "Fight!";

  // ---------- relic and held cards (kept from the old screen; not on the canvas) ----------
  const popover = document.createElement("div");
  popover.className = "round-popover";
  popover.style.display = "none";
  let popoverAnchor: HTMLElement | null = null;

  function closePopover(): void {
    popover.style.display = "none";
    popoverAnchor?.classList.remove("open");
    popoverAnchor = null;
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
    const margin = 8;
    const a = anchor.getBoundingClientRect();
    const p = popover.getBoundingClientRect();
    const fitsBelow = a.bottom + 6 + p.height <= window.innerHeight - margin;
    popover.style.top = `${fitsBelow ? a.bottom + 6 : Math.max(margin, a.top - 6 - p.height)}px`;
    popover.style.left = `${Math.min(Math.max(margin, a.left), Math.max(margin, window.innerWidth - p.width - margin))}px`;
  }

  // Document-level listeners outlive this render; each drops itself the first time it fires after the screen was replaced.
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

  // The upgrades section (canvas 6.1, 6.2 and 6.4C): its own box below the squad box, the relic and the run's upgrades as round emblems,
  // folded to "+N All ›" past three. A tap on a cell says what it does, with its duo hints.
  const upSlot = panel.querySelector(".up-slot") as HTMLElement;
  if (progress.cards.length > 0 || progress.relic) {
    const squadEffects = squadChainEffects(progress, roster);
    const held = heldCards(progress);
    const showUpgrade = (id: CardId, anchor: HTMLElement): void => {
      const def = CARD_DEFS[id];
      const isRelic = def.kind === "relic";
      const title = document.createElement("div");
      title.innerHTML = `<strong>${def.title}.</strong> ${markWordsHtml(def.detail)}`;
      const parts: HTMLElement[] = [title];
      if (!isRelic) {
        parts.push(
          cardConnects(id, squadEffects, held)
            ? Object.assign(document.createElement("div"), { className: "round-popover-answer", textContent: "★ Connects to your squad." })
            : popoverMeta("Nothing in your squad makes this yet."),
        );
      }
      // A duo this upgrade is a part of: what it pairs with, or that it is unlocked.
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
      togglePopover(anchor, parts);
    };
    upSlot.replaceWith(upgradesSection({ cards: held, cap: cfg.cardCap, onCell: showUpgrade }));
  } else {
    upSlot.remove();
  }

  // ---------- taps ----------
  panel.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const term = termFromTarget(target);
    if (term) {
      closePopover();
      openTermCard(term);
      return;
    }
    if (target.closest(".fo-fight")) {
      if (emptyCount === 0) {
        closePopover();
        onFight(fielded.map((h) => h.id));
      }
      return;
    }
    if (target.closest("[data-slot=empty]") || target.closest(".fo-shelf.tap")) {
      closePopover();
      opts.onChangeSquad?.(fielded.map((h) => h.id));
      return;
    }
    const fighter = target.closest("[data-fighter]") as HTMLElement | null;
    if (fighter) {
      closePopover();
      openFighterPopup({ cfg, squad: fielded, enemies: enemy.heroes, openId: fighter.dataset.fighter!, progress, fierceEnemies: fierce });
    }
  });

  container.appendChild(panel);
  container.appendChild(popover);
}

function popoverMeta(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "round-popover-meta";
  el.textContent = text;
  return el;
}
