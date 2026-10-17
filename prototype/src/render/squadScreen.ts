import { fatigueTier, type RunConfig } from "../sim/config.js";
import { ROLE_LABEL } from "../sim/roles.js";
import type { HeroState } from "../sim/types.js";
import type { RosterState } from "../sim/roster.js";
import { DEAD_BODY, deadFace, squadFace } from "./faces.js";
import { ROLE_HEX, TIER_HEX, esc, squadRole } from "./roundParts.js";

/**
 * The squad screen (canvas 4.1 and the right phone of 1.5): the bench on its own screen, reached from the round screen's bench
 * shelf, `Change squad ›` or an empty slot. FIGHTING rows on top, BENCH rows below, each row a face (its eyes show fatigue), the
 * name, the role word with the tier word, and HP. A swap is two taps (a bench unit, then who it replaces) or one drag (canvas 4.2D):
 * every living row has a grip, and a row dragged onto another swaps with it, onto an empty slot fills it, and a fighter dropped on
 * the bench area leaves an empty slot. A drag starts after a few pixels of movement, so a tap stays a tap; on touch it starts from
 * the grip only, so the rest of the row still scrolls the page. With an empty slot a single tap on a bench unit fills it. Fallen
 * units are dimmed and cannot be tapped or dragged. `Done` is greyed while a swap is half made or a slot is empty, and returns to
 * the round screen with the new squad.
 */
export function renderSquadScreen(
  container: HTMLElement,
  cfg: RunConfig,
  roundNumber: number,
  roster: RosterState,
  slots: number,
  startPick: string[],
  onDone: (pick: string[]) => void,
): void {
  // A wrapper of its own, so the click handler dies with the screen instead of lingering on the shared root.
  const host = document.createElement("div");
  container.replaceChildren(host);
  const byId = new Map(roster.heroes.map((h) => [h.id, h]));
  let fielded = startPick.filter((id) => byId.get(id)?.alive).slice(0, slots);
  let chosen: string | null = null;

  const rowHtml = (h: HeroState, attrs: string, cls: string): string => {
    const role = squadRole(h);
    const hex = ROLE_HEX[role];
    const tier = fatigueTier(cfg.fight, h.fatigue);
    if (!h.alive) {
      return `<div class="sq-row fallen ${cls}"><div class="sq-av" style="background:${DEAD_BODY}">${deadFace()}</div><div class="sq-who"><div class="sq-name">${esc(h.name)}</div><div class="sq-role" style="color:${hex}">${ROLE_LABEL[role]}</div></div></div>`;
    }
    const hp = h.hp >= h.maxHp ? `HP ${Math.round(h.hp)}` : `HP ${Math.round(h.hp)}/${Math.round(h.maxHp)}`;
    const frac = h.maxHp > 0 ? Math.max(0, Math.min(1, h.hp / h.maxHp)) : 0;
    const hurt = frac < 0.75 ? "#e8913c" : "#4da6ff";
    return `<div class="sq-row ${cls}" ${attrs}><span class="sq-grip" aria-hidden="true">⋮⋮</span><div class="sq-av" style="background:${hex}">${squadFace(hex, tier, 34)}</div><div class="sq-who"><div class="sq-name">${esc(h.name)}</div><div class="sq-role" style="color:${hex}">${ROLE_LABEL[role]} <span class="sq-tier" style="color:${TIER_HEX[tier]}">· ${tier}</span></div></div><div class="sq-hp"><div class="sq-hpbar"><div style="width:${(frac * 100).toFixed(0)}%;background:${hurt}"></div></div><div class="sq-hptext">${hp}</div></div></div>`;
  };

  function draw(): void {
    const gaps = Math.max(0, slots - fielded.length);
    const fighting = fielded.map((id) => byId.get(id)!).filter(Boolean);
    const bench = roster.heroes.filter((h) => !fielded.includes(h.id));
    const midSwap = chosen !== null;
    const chosenUnit = chosen ? byId.get(chosen) : undefined;

    const fightingRows =
      fighting.map((h) => rowHtml(h, `data-fielded="${esc(h.id)}"`, midSwap ? "target" : "")).join("") +
      Array.from({ length: gaps })
        .map(
          () =>
            `<div class="sq-row empty"><div class="fo-slot-ring sq-ring">+</div><div class="sq-who"><div class="sq-name" style="color:#c7cad6">Empty slot</div><div class="sq-fillhint">Tap a bench unit to put it here</div></div></div>`,
        )
        .join("");
    const benchRows = bench
      .map((h) => rowHtml(h, h.alive ? `data-bench="${esc(h.id)}"` : "", h.id === chosen ? "chosen" : midSwap ? "dim" : h.alive ? "tap" : ""))
      .join("");

    const banner = midSwap
      ? `<div class="sq-banner"><span>Tap who <b>${esc(chosenUnit?.name ?? "")}</b> replaces</span><span class="sq-cancel" data-cancel>Cancel</span></div>`
      : `<div class="sq-hint">Hold and drag any unit. Drop it on another unit to swap, or on an empty slot to fill it.</div>`;
    const blocked = gaps > 0 || midSwap;
    host.innerHTML = `
      <div class="fo-card sq-card">
        <div class="sq-top"><span class="sq-back" data-back>‹ Round ${roundNumber}</span><span class="sq-title">YOUR SQUAD</span><span class="sq-units">${roster.heroes.length} units</span></div>
        ${banner}
        <div class="sq-sec"><span class="fo-pill squad">FIGHTING</span><span class="sq-count">${fielded.length} of ${slots}</span></div>
        <div class="sq-rows">${fightingRows}</div>
        <div class="sq-benchzone" data-benchzone>
          <div class="sq-sec bench"><span class="fo-pill bench">BENCH</span><span class="sq-count">${bench.length} unit${bench.length === 1 ? "" : "s"}</span></div>
          <div class="sq-rule">Each round, a unit on the bench heals ${Math.round(cfg.benchedRecoverFraction * 100)}% of its HP and loses ${cfg.fatigueBenchRest} fatigue. A fighting unit heals ${Math.round(cfg.autoRecoverFraction * 100)}%.</div>
          <div class="sq-rows">${benchRows || `<div class="sq-rule">Nobody on the bench.</div>`}</div>
        </div>
        <button type="button" class="sq-done${blocked ? " off" : ""}" data-done>${gaps > 0 ? `Fill ${gaps} empty slot${gaps > 1 ? "s" : ""}` : "Done"}</button>
      </div>`;
  }

  // The three moves a tap or a drag can make. Tap and drag share them, so the rules stay in one place.
  const fillSlot = (benchId: string): void => {
    fielded = [...fielded, benchId];
    chosen = null;
  };
  const swapIn = (benchId: string, fieldedId: string): void => {
    fielded = fielded.map((id) => (id === fieldedId ? benchId : id));
    chosen = null;
  };
  const benchUnit = (fieldedId: string): void => {
    fielded = fielded.filter((id) => id !== fieldedId);
    chosen = null;
  };

  // --- Drag (canvas 4.2D) ---
  const DRAG_START_PX = 8;
  let suppressClick = false; // the click a finished drag would otherwise fire

  type Drop = { kind: "swapIn"; benchId: string; fieldedId: string } | { kind: "fill"; benchId: string } | { kind: "bench"; fieldedId: string };

  /** What dropping `from` on whatever is under the pointer would do, and the element to light up; null when nothing. */
  function dropAt(from: { bench: boolean; id: string }, x: number, y: number): { drop: Drop; el: HTMLElement } | null {
    const under = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!under || !host.contains(under)) return null;
    const fRow = under.closest("[data-fielded]") as HTMLElement | null;
    const bRow = under.closest("[data-bench]") as HTMLElement | null;
    const empty = under.closest(".sq-row.empty") as HTMLElement | null;
    const zone = under.closest("[data-benchzone]") as HTMLElement | null;
    if (from.bench) {
      if (fRow) return { drop: { kind: "swapIn", benchId: from.id, fieldedId: fRow.dataset.fielded! }, el: fRow };
      if (empty) return { drop: { kind: "fill", benchId: from.id }, el: empty };
      return null;
    }
    if (bRow) return { drop: { kind: "swapIn", benchId: bRow.dataset.bench!, fieldedId: from.id }, el: bRow };
    if (zone) return { drop: { kind: "bench", fieldedId: from.id }, el: zone };
    return null;
  }

  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const found = (e.target as HTMLElement).closest("[data-bench], [data-fielded]") as HTMLElement | null;
    if (!found) return;
    const row: HTMLElement = found;
    // On touch the grip starts a drag, so a swipe on the rest of the row still scrolls the page.
    if (e.pointerType === "touch" && !(e.target as HTMLElement).closest(".sq-grip")) return;
    const from = row.dataset.bench ? { bench: true, id: row.dataset.bench } : { bench: false, id: row.dataset.fielded! };
    const rect = row.getBoundingClientRect();
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost: HTMLElement | null = null;
    let lit: HTMLElement | null = null;

    const setLit = (el: HTMLElement | null): void => {
      if (lit === el) return;
      lit?.classList.remove("drop");
      el?.classList.add("drop");
      lit = el;
    };
    const finish = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setLit(null);
      ghost?.remove();
      row.classList.remove("dragging");
    };
    function onMove(ev: PointerEvent): void {
      if (!ghost) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_START_PX) return;
        ghost = row.cloneNode(true) as HTMLElement;
        ghost.classList.add("sq-ghost");
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        row.classList.add("dragging");
      }
      ghost.style.left = `${ev.clientX - grabX}px`;
      ghost.style.top = `${ev.clientY - grabY}px`;
      setLit(dropAt(from, ev.clientX, ev.clientY)?.el ?? null);
    }
    function onUp(ev: PointerEvent): void {
      const dragged = ghost !== null;
      const hit = dragged ? dropAt(from, ev.clientX, ev.clientY) : null;
      finish();
      if (!dragged) return; // a plain tap: the click handler takes it from here
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (!hit) return;
      if (hit.drop.kind === "swapIn") swapIn(hit.drop.benchId, hit.drop.fieldedId);
      else if (hit.drop.kind === "fill") fillSlot(hit.drop.benchId);
      else benchUnit(hit.drop.fieldedId);
      draw();
    }
    function onCancel(): void {
      finish();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  });

  host.addEventListener("click", (e) => {
    if (suppressClick) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-back]")) {
      onDone(fielded);
      return;
    }
    if (t.closest("[data-done]")) {
      if (slots - fielded.length > 0 || chosen !== null) return;
      onDone(fielded);
      return;
    }
    if (t.closest("[data-cancel]")) {
      chosen = null;
      draw();
      return;
    }
    const bench = t.closest("[data-bench]") as HTMLElement | null;
    if (bench) {
      const id = bench.dataset.bench!;
      if (slots - fielded.length > 0) {
        fillSlot(id); // an empty slot fills in one tap
      } else {
        chosen = chosen === id ? null : id;
      }
      draw();
      return;
    }
    const target = t.closest("[data-fielded]") as HTMLElement | null;
    if (target && chosen) {
      swapIn(chosen, target.dataset.fielded!);
      draw();
    }
  });

  draw();
}
