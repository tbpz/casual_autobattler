import type { RunConfig } from "../sim/config.js";
import type { SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makeEnemySide } from "../sim/run.js";
import { project, projectionSummary, type Projection } from "../sim/projection.js";

/**
 * The pre-fight read: your squad against this fight's enemy composition,
 * full information, before a single tick has run. This is what manufactures
 * the expectation the cascade is meant to exceed — without it there's
 * nothing on screen to be surprised relative to (see the 2026-08-04
 * legibility plan). Reuses fightView's body/role/hero-slot styling so the
 * enemy bruiser reads as visually dominant here too, before the fight even
 * starts.
 *
 * As of 2026-08-06 this also shows sim/projection.ts's three job lines and
 * verdict — "Bracer holds ~24s," "Rook + Vex drop the Bruiser around 13s,"
 * etc. — in the same units render/runScreens.ts's post-fight recap uses, so
 * "bigger than I expected" has a concrete baseline to be bigger than.
 *
 * 2026-08-14 chain rebuild: also names whichever fielded hero's charge bar
 * is furthest along, since charge now carries in from prior fights (see
 * sim/types.ts's HeroState.charge) — this is the one screen before the
 * fight even starts, so it's the only place a near-full bar can be read as
 * a concrete expectation ("Rook might chain early") rather than only
 * discovered mid-fight.
 */
export function renderPreFightScreen(
  container: HTMLElement,
  cfg: RunConfig,
  fightIndex: number,
  encounterIndex: number,
  player: SideState,
  onPlay: () => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen pre-fight";

  const h1 = document.createElement("h1");
  h1.textContent = `Fight ${fightIndex + 1} of ${cfg.fightsPerRun}`;
  screen.appendChild(h1);

  const enemy = makeEnemySide(cfg, fightIndex, encounterIndex);

  const compare = document.createElement("div");
  compare.className = "pre-fight-compare";
  compare.appendChild(makeSidePreview("Your squad", player, "player"));
  compare.appendChild(makeSidePreview("Enemy", enemy, "enemy"));
  screen.appendChild(compare);

  const proj = project(player, enemy, cfg.fight);
  screen.appendChild(makeProjectionBlock(proj));

  const chargeLine = closestChargeLine(player, cfg.fight.chargeThreshold);
  if (chargeLine) {
    const p = document.createElement("p");
    p.className = "projection-detail";
    p.textContent = chargeLine;
    screen.appendChild(p);
  }

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.textContent = "Play";
  playBtn.addEventListener("click", onPlay);
  screen.appendChild(playBtn);

  container.appendChild(screen);
}

/** Names whichever fielded hero's charge bar is furthest along, going into
 * this fight (2026-08-14 chain rebuild) — the pre-fight read's one chain-
 * specific line, since charge carries in from prior fights rather than
 * starting fresh. Silent at 0% (a fresh draft, or everyone just fired) so
 * this doesn't clutter fight 1's screen with a line that says nothing. */
function closestChargeLine(player: SideState, chargeThreshold: number): string | null {
  let closest: SideState["heroes"][number] | undefined;
  for (const h of player.heroes) {
    if (!h.alive) continue;
    if (!closest || h.charge > closest.charge) closest = h;
  }
  if (!closest || closest.charge <= 0) return null;
  const pct = chargeThreshold > 0 ? Math.round((closest.charge / chargeThreshold) * 100) : 0;
  return `${closest.name} carries in ${pct}% charged — closest to a chain.`;
}

function makeProjectionBlock(proj: Projection): HTMLElement {
  const block = document.createElement("div");
  block.className = "pre-fight-projection";

  for (const line of proj.lines) {
    const p = document.createElement("p");
    p.className = "projection-detail";
    p.textContent = line;
    block.appendChild(p);
  }

  const verdict = document.createElement("p");
  verdict.className = `projection-line band-${proj.band}`;
  verdict.textContent = projectionSummary(proj.spareSec);
  block.appendChild(verdict);

  return block;
}

function makeSidePreview(label: string, side: SideState, kind: "player" | "enemy"): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `pre-fight-side ${kind}`;

  const title = document.createElement("div");
  title.className = "pre-fight-side-title";
  title.textContent = `${label} — ${Math.round(sideHp(side))} / ${Math.round(sideMaxHp(side))} HP`;
  wrap.appendChild(title);

  const row = document.createElement("div");
  row.className = "pre-fight-bodies";
  for (const hero of side.heroes) {
    const slot = document.createElement("div");
    slot.className = "hero-slot";
    const body = document.createElement("div");
    body.className = `body ${kind}-body role-${hero.role}`;
    const fraction = hero.maxHp > 0 ? hero.hp / hero.maxHp : 0;
    body.style.opacity = hero.alive ? String(0.4 + 0.6 * fraction) : "0.35";
    const name = document.createElement("div");
    name.className = "body-name";
    name.textContent = hero.name;
    slot.appendChild(body);
    slot.appendChild(name);
    row.appendChild(slot);
  }
  wrap.appendChild(row);
  return wrap;
}
