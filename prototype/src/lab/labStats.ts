/**
 * The lab's live per-body damage table — dealt/taken/healed/hits/charge for
 * every hero on both sides, redrawn from each tick's TickSnapshot. Nothing
 * here counts anything new: HeroSnapshot (sim/events.ts) already carries
 * dealt/soaked/restored/hitsTaken/charge every tick for both sides (see the
 * feature plan's "what already exists" section) — this module only lays that
 * out as a table and keeps two honesty notes visible in the headers, since
 * reading dealt/restored naively is easy to misread:
 *   - a healer's chain adds to RESTORED, not DEALT — Cairn's dealt staying
 *     near zero all fight is correct, not a bug (heroes.ts's healPerBeat).
 *   - a BACKFIRED chain heal credits nothing to the firing hero's restored
 *     count at all (fight.ts's resolveChainHit only credits hero.restored on
 *     a real heal) — the damage it did to the caster's own side still shows
 *     up as TAKEN on whoever ate it, not folded into any chain-specific column.
 */
import type { HeroSnapshot, TickSnapshot } from "../sim/events.js";
import type { FightConfig } from "../sim/config.js";

export class LabStats {
  private table: HTMLTableElement;
  private tbody: HTMLTableSectionElement;
  private rows: Map<string, HTMLTableRowElement> = new Map();
  private cfg: FightConfig;

  constructor(container: HTMLElement, cfg: FightConfig) {
    this.cfg = cfg;
    container.innerHTML = "";
    container.classList.add("lab-stats");

    const note = document.createElement("p");
    note.className = "lab-stats-note";
    note.textContent = "healed = chain/beat healing landed; a backfired chain heal credits nothing here.";
    container.appendChild(note);

    this.table = document.createElement("table");
    this.table.className = "lab-stats-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>hero</th><th>hp</th><th>dealt</th><th>taken</th><th>healed</th><th>hits</th><th>charge</th>
      </tr>
    `;
    this.table.appendChild(thead);
    this.tbody = document.createElement("tbody");
    this.table.appendChild(this.tbody);
    container.appendChild(this.table);
  }

  update(snapshot: TickSnapshot): void {
    this.updateSide(snapshot.playerHeroes, "player");
    this.updateSide(snapshot.enemyHeroes, "enemy");
  }

  private updateSide(heroes: HeroSnapshot[], side: "player" | "enemy"): void {
    for (const h of heroes) {
      let row = this.rows.get(h.id);
      if (!row) {
        row = document.createElement("tr");
        row.className = `lab-stats-row lab-stats-${side}`;
        this.tbody.appendChild(row);
        this.rows.set(h.id, row);
      }
      row.classList.toggle("down", !h.alive);
      const chargePct = this.cfg.chargeThreshold > 0 ? Math.round((h.charge / this.cfg.chargeThreshold) * 100) : 0;
      row.innerHTML = `
        <td class="lab-stats-name">${h.name}</td>
        <td>${Math.round(h.hp)}/${Math.round(h.maxHp)}</td>
        <td>${Math.round(h.dealt)}</td>
        <td>${Math.round(h.soaked)}</td>
        <td>${Math.round(h.restored)}</td>
        <td>${h.hitsTaken}</td>
        <td>${chargePct}%</td>
      `;
    }
  }
}
