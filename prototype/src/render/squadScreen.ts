import { fatigueTier, type RunConfig } from "../sim/config.js";
import { ROLE_LABEL } from "../sim/roles.js";
import type { HeroState } from "../sim/types.js";
import type { RosterState } from "../sim/roster.js";
import { DEAD_BODY, deadFace, squadFace } from "./faces.js";
import { ROLE_HEX, TIER_HEX, esc, squadRole } from "./roundParts.js";

/**
 * The squad screen (canvas 4.1 and the right phone of 1.5): the bench on its own screen, reached from the round screen's bench
 * shelf, `Change squad ›` or an empty slot. FIGHTING rows on top, BENCH rows below, each row a face (its eyes show fatigue), the
 * name, the role word with the tier word, and HP. A swap is two taps: a bench unit, then who it replaces. With an empty slot a
 * single tap on a bench unit fills it. Fallen units are dimmed and cannot be tapped. `Done` is greyed while a swap is half made
 * or a slot is empty, and returns to the round screen with the new squad.
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
    return `<div class="sq-row ${cls}" ${attrs}><div class="sq-av" style="background:${hex}">${squadFace(hex, tier, 34)}</div><div class="sq-who"><div class="sq-name">${esc(h.name)}</div><div class="sq-role" style="color:${hex}">${ROLE_LABEL[role]} <span class="sq-tier" style="color:${TIER_HEX[tier]}">· ${tier}</span></div></div><div class="sq-hp"><div class="sq-hpbar"><div style="width:${(frac * 100).toFixed(0)}%;background:${hurt}"></div></div><div class="sq-hptext">${hp}</div></div></div>`;
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
      : "";
    const blocked = gaps > 0 || midSwap;
    host.innerHTML = `
      <div class="fo-card sq-card">
        <div class="sq-top"><span class="sq-back" data-back>‹ Round ${roundNumber}</span><span class="sq-title">YOUR SQUAD</span><span class="sq-units">${roster.heroes.length} units</span></div>
        ${banner}
        <div class="sq-sec"><span class="fo-pill squad">FIGHTING</span><span class="sq-count">${fielded.length} of ${slots}</span></div>
        <div class="sq-rows">${fightingRows}</div>
        <div class="sq-sec bench"><span class="fo-pill bench">BENCH</span><span class="sq-count">${bench.length} unit${bench.length === 1 ? "" : "s"}</span></div>
        <div class="sq-rule">Each round, a unit on the bench heals ${Math.round(cfg.benchedRecoverFraction * 100)}% of its HP and loses ${cfg.fatigueBenchRest} fatigue. A fighting unit heals ${Math.round(cfg.autoRecoverFraction * 100)}%.</div>
        <div class="sq-rows">${benchRows || `<div class="sq-rule">Nobody on the bench.</div>`}</div>
        <button type="button" class="sq-done${blocked ? " off" : ""}" data-done>${gaps > 0 ? `Fill ${gaps} empty slot${gaps > 1 ? "s" : ""}` : "Done"}</button>
      </div>`;
  }

  host.addEventListener("click", (e) => {
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
        fielded = [...fielded, id]; // an empty slot fills in one tap
        chosen = null;
      } else {
        chosen = chosen === id ? null : id;
      }
      draw();
      return;
    }
    const target = t.closest("[data-fielded]") as HTMLElement | null;
    if (target && chosen) {
      const at = fielded.indexOf(target.dataset.fielded!);
      if (at >= 0) fielded = fielded.map((id, i) => (i === at ? chosen! : id));
      chosen = null;
      draw();
    }
  });

  draw();
}
