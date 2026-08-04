import type { RunConfig } from "../sim/config.js";
import type { SideState } from "../sim/types.js";
import { sideHp, sideMaxHp } from "../sim/types.js";
import { makeEnemySide } from "../sim/run.js";

/**
 * The pre-fight read: your squad against this fight's enemy composition,
 * full information, before a single tick has run. This is what manufactures
 * the expectation the cascade is meant to exceed — without it there's
 * nothing on screen to be surprised relative to (see the 2026-08-04
 * legibility plan). Reuses fightView's body/role/hero-slot styling so the
 * enemy bruiser reads as visually dominant here too, before the fight even
 * starts.
 */
export function renderPreFightScreen(
  container: HTMLElement,
  cfg: RunConfig,
  fightIndex: number,
  player: SideState,
  onPlay: () => void,
): void {
  container.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen pre-fight";

  const h1 = document.createElement("h1");
  h1.textContent = `Fight ${fightIndex + 1} of ${cfg.fightsPerRun}`;
  screen.appendChild(h1);

  const enemy = makeEnemySide(cfg, fightIndex);

  const compare = document.createElement("div");
  compare.className = "pre-fight-compare";
  compare.appendChild(makeSidePreview("Your squad", player, "player"));
  compare.appendChild(makeSidePreview("Enemy", enemy, "enemy"));
  screen.appendChild(compare);

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.textContent = "Play";
  playBtn.addEventListener("click", onPlay);
  screen.appendChild(playBtn);

  container.appendChild(screen);
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
