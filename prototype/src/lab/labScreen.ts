/**
 * The lab's screen — pick any 3 heroes, any encounter, a starting charge % per
 * hero, then watch. Single mode runs one fight; Compare mode runs two, on one
 * shared LabClock, side by side. Reached via ?lab=1 (see main.ts) — a second
 * door into the same sim the real game plays through (sim/fight.ts's
 * runFight, unmodified), not a replacement for it. render/app.ts,
 * render/playback.ts and render/fightView.ts are none of them edited for
 * this — the lab only calls FightView the same way app.ts does, and drives
 * it with its own clock (labClock.ts) instead of Playback, since Playback's
 * chain-window time dilation would make two panels drift apart (see
 * labClock.ts's own docstring).
 */
import { DEFAULT_RUN_CONFIG, type RunConfig } from "../sim/config.js";
import { PLAYER_HERO_POOL, DEFAULT_PLAYER_ROSTER_IDS } from "../sim/heroes.js";
import { ENCOUNTERS, makeEncounterEnemySide } from "../sim/encounters.js";
import { sideMaxHp } from "../sim/types.js";
import { FightView } from "../render/fightView.js";
import { LabClock, LAB_SPEEDS, type LabSpeed } from "./labClock.js";
import { LabStats } from "./labStats.js";
import { runLabFight, type LabSetup } from "./labFight.js";

interface LabHeroSlotState {
  heroId: string;
  chargePercent: number;
}

interface LabColumnState {
  heroSlots: LabHeroSlotState[];
  encounterIndex: number;
  rampIndex: number;
  seed: number;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

function defaultColumnState(seed: number): LabColumnState {
  return {
    heroSlots: DEFAULT_PLAYER_ROSTER_IDS.map((id) => ({ heroId: id, chargePercent: 0 })),
    encounterIndex: 0,
    rampIndex: 0,
    seed,
  };
}

function cloneColumnState(state: LabColumnState): LabColumnState {
  return {
    heroSlots: state.heroSlots.map((s) => ({ ...s })),
    encounterIndex: state.encounterIndex,
    rampIndex: state.rampIndex,
    seed: state.seed,
  };
}

function toLabSetup(state: LabColumnState): LabSetup {
  return {
    heroIds: state.heroSlots.map((s) => s.heroId),
    chargePercents: state.heroSlots.map((s) => s.chargePercent),
    encounterIndex: state.encounterIndex,
    rampIndex: state.rampIndex,
    seed: state.seed,
  };
}

interface ColumnHandle {
  element: HTMLElement;
  seedInput: HTMLInputElement;
  /** Clears and rebuilds the column's DOM from its current state — used
   * after "copy A -> B" mutates a column's state out from under its own
   * live inputs. */
  rerender: () => void;
}

/** Builds one setup column (3 hero slots + charge sliders, the encounter
 * list, a ramp control, a seed field) into `container`, reading/writing
 * `state` directly. */
function buildColumn(container: HTMLElement, label: string, state: LabColumnState, cfg: RunConfig): ColumnHandle {
  let seedInputRef: HTMLInputElement;

  function render(): void {
    container.innerHTML = "";
    container.className = "lab-setup-column";

    const h2 = document.createElement("h2");
    h2.textContent = label;
    container.appendChild(h2);

    const heroList = document.createElement("div");
    heroList.className = "lab-hero-slots";
    state.heroSlots.forEach((slot) => {
      const row = document.createElement("div");
      row.className = "lab-hero-slot";

      const select = document.createElement("select");
      for (const def of PLAYER_HERO_POOL) {
        const opt = document.createElement("option");
        opt.value = def.id;
        opt.textContent = def.name;
        if (def.id === slot.heroId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        slot.heroId = select.value;
      });

      const chargeLabel = document.createElement("span");
      chargeLabel.className = "lab-charge-label";
      chargeLabel.textContent = `CHARGE ${slot.chargePercent}%`;

      const chargeRange = document.createElement("input");
      chargeRange.type = "range";
      chargeRange.min = "0";
      chargeRange.max = "100";
      chargeRange.value = String(slot.chargePercent);
      chargeRange.addEventListener("input", () => {
        slot.chargePercent = Number(chargeRange.value);
        chargeLabel.textContent = `CHARGE ${slot.chargePercent}%`;
      });

      row.appendChild(select);
      row.appendChild(chargeRange);
      row.appendChild(chargeLabel);
      heroList.appendChild(row);
    });
    container.appendChild(heroList);

    const encounterList = document.createElement("div");
    encounterList.className = "lab-encounter-list";
    ENCOUNTERS.forEach((enc, i) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lab-encounter-row" + (i === state.encounterIndex ? " selected" : "");
      row.innerHTML = `<span class="lab-encounter-name">${enc.name}</span><span class="lab-encounter-blurb">${enc.blurb}</span>`;
      row.addEventListener("click", () => {
        state.encounterIndex = i;
        Array.from(encounterList.children).forEach((child, j) => child.classList.toggle("selected", j === i));
        refreshRampInfo();
      });
      encounterList.appendChild(row);
    });
    container.appendChild(encounterList);

    const rampRow = document.createElement("div");
    rampRow.className = "lab-ramp";
    const rampLabel = document.createElement("label");
    rampLabel.textContent = "ramp (fight #)";
    const rampInput = document.createElement("input");
    rampInput.type = "number";
    rampInput.min = "0";
    rampInput.max = "8";
    rampInput.value = String(state.rampIndex);
    const rampInfo = document.createElement("span");
    rampInfo.className = "lab-ramp-info";
    rampInput.addEventListener("input", () => {
      state.rampIndex = Number(rampInput.value) || 0;
      refreshRampInfo();
    });
    rampRow.appendChild(rampLabel);
    rampRow.appendChild(rampInput);
    rampRow.appendChild(rampInfo);
    container.appendChild(rampRow);

    function refreshRampInfo(): void {
      const enemy = makeEncounterEnemySide(cfg, state.rampIndex, state.encounterIndex);
      rampInfo.textContent = `${enemy.heroes.length} bod${enemy.heroes.length === 1 ? "y" : "ies"} / ${Math.round(sideMaxHp(enemy))} hp`;
    }
    refreshRampInfo();

    const seedRow = document.createElement("div");
    seedRow.className = "lab-seed";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = "seed";
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = String(state.seed);
    seedInput.addEventListener("input", () => {
      state.seed = Number(seedInput.value) || 0;
    });
    seedRow.appendChild(seedLabel);
    seedRow.appendChild(seedInput);
    container.appendChild(seedRow);
    seedInputRef = seedInput;
  }

  render();
  return {
    element: container,
    get seedInput() {
      return seedInputRef;
    },
    rerender: render,
  } as ColumnHandle;
}

function renderLabSetupScreen(
  root: HTMLElement,
  cfg: RunConfig,
  mode: "single" | "compare",
  stateA: LabColumnState,
  stateB: LabColumnState,
  linkSeeds: boolean,
  onModeChange: (mode: "single" | "compare") => void,
  onLinkSeedsChange: (linked: boolean) => void,
  onPlay: () => void,
): void {
  root.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen lab-setup";

  const h1 = document.createElement("h1");
  h1.textContent = "The lab";
  screen.appendChild(h1);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Pick 3 heroes, an encounter, and a starting charge % for each hero — then watch. One-off fight, no run, no attrition.";
  screen.appendChild(hint);

  const modeRow = document.createElement("div");
  modeRow.className = "lab-mode-toggle";
  (["single", "compare"] as const).forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = m === "single" ? "Single" : "Compare";
    btn.className = "lab-mode-btn" + (mode === m ? " selected" : "");
    btn.addEventListener("click", () => onModeChange(m));
    modeRow.appendChild(btn);
  });
  screen.appendChild(modeRow);

  const columns = document.createElement("div");
  columns.className = "lab-setup-columns";
  screen.appendChild(columns);

  const colAContainer = document.createElement("div");
  columns.appendChild(colAContainer);
  const colA = buildColumn(colAContainer, mode === "compare" ? "Fight A" : "Fight", stateA, cfg);

  if (mode === "compare") {
    const colBContainer = document.createElement("div");
    columns.appendChild(colBContainer);
    const colB = buildColumn(colBContainer, "Fight B", stateB, cfg);
    colB.seedInput.disabled = linkSeeds;

    const compareControls = document.createElement("div");
    compareControls.className = "lab-compare-controls";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "copy A → B";
    copyBtn.addEventListener("click", () => {
      const copied = cloneColumnState(stateA);
      stateB.heroSlots = copied.heroSlots;
      stateB.encounterIndex = copied.encounterIndex;
      stateB.rampIndex = copied.rampIndex;
      if (!linkSeeds) stateB.seed = copied.seed;
      colB.rerender();
    });
    compareControls.appendChild(copyBtn);

    const linkLabel = document.createElement("label");
    linkLabel.className = "lab-link-seeds";
    const linkCheckbox = document.createElement("input");
    linkCheckbox.type = "checkbox";
    linkCheckbox.checked = linkSeeds;
    linkCheckbox.addEventListener("change", () => {
      onLinkSeedsChange(linkCheckbox.checked);
      if (linkCheckbox.checked) {
        stateB.seed = stateA.seed;
        colB.seedInput.value = String(stateB.seed);
      }
      colB.seedInput.disabled = linkCheckbox.checked;
    });
    linkLabel.appendChild(linkCheckbox);
    linkLabel.appendChild(document.createTextNode(" link seeds"));
    compareControls.appendChild(linkLabel);

    columns.appendChild(compareControls);

    // Keep B's seed mirroring A's live while linked, without waiting for a
    // rerender — matches the "one change moves both, until you untick it"
    // promise this checkbox makes.
    colA.seedInput.addEventListener("input", () => {
      if (linkCheckbox.checked) {
        stateB.seed = stateA.seed;
        colB.seedInput.value = String(stateB.seed);
      }
    });
  }

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.textContent = "Play";
  playBtn.addEventListener("click", onPlay);
  screen.appendChild(playBtn);

  root.appendChild(screen);
}

interface LabPanel {
  view: FightView;
  stats: LabStats;
}

function renderLabFightScreen(root: HTMLElement, cfg: RunConfig, setups: LabSetup[], onBack: () => void): void {
  root.innerHTML = "";
  const screen = document.createElement("div");
  screen.className = "screen lab-fight-screen";

  const elapsedLine = document.createElement("p");
  elapsedLine.className = "lab-elapsed";
  screen.appendChild(elapsedLine);

  const panelsRow = document.createElement("div");
  panelsRow.className = "lab-fight-panels";
  screen.appendChild(panelsRow);

  const clock = new LabClock();
  const panels: LabPanel[] = [];

  setups.forEach((setup, i) => {
    const panel = document.createElement("div");
    panel.className = "lab-fight-panel";

    const label = document.createElement("h3");
    label.textContent = setups.length > 1 ? `Fight ${i === 0 ? "A" : "B"} — seed ${setup.seed}` : `seed ${setup.seed}`;
    panel.appendChild(label);

    const fightContainer = document.createElement("div");
    panel.appendChild(fightContainer);
    const statsContainer = document.createElement("div");
    panel.appendChild(statsContainer);

    panelsRow.appendChild(panel);

    const view = new FightView(fightContainer, cfg.fight);
    const stats = new LabStats(statsContainer, cfg.fight);
    panels.push({ view, stats });

    const result = runLabFight(setup, cfg);
    clock.addTrack(result, (snapshot, events) => {
      view.render(snapshot, events);
      stats.update(snapshot);
      elapsedLine.textContent = `t = ${clock.elapsed.toFixed(1)}s`;
    });
  });

  const controls = document.createElement("div");
  controls.className = "lab-controls controls";

  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "Pause";
  pauseBtn.addEventListener("click", () => {
    if (clock.isPaused) {
      clock.play();
      pauseBtn.textContent = "Pause";
    } else {
      clock.pause();
      pauseBtn.textContent = "Resume";
    }
  });
  controls.appendChild(pauseBtn);

  const stepBtn = document.createElement("button");
  stepBtn.textContent = "Step";
  stepBtn.addEventListener("click", () => {
    clock.step();
    pauseBtn.textContent = "Resume";
  });
  controls.appendChild(stepBtn);

  LAB_SPEEDS.forEach((speed: LabSpeed) => {
    const btn = document.createElement("button");
    btn.textContent = `${speed}x`;
    btn.className = "lab-speed-btn" + (speed === clock.currentSpeed ? " selected" : "");
    btn.addEventListener("click", () => {
      clock.setSpeed(speed);
      controls.querySelectorAll(".lab-speed-btn").forEach((b) => b.classList.toggle("selected", b === btn));
    });
    controls.appendChild(btn);
  });

  const replayBtn = document.createElement("button");
  replayBtn.textContent = "Replay";
  replayBtn.addEventListener("click", () => {
    clock.restart();
    for (const p of panels) p.view.reset();
    elapsedLine.textContent = "t = 0.0s";
    clock.play();
    pauseBtn.textContent = "Pause";
  });
  controls.appendChild(replayBtn);

  const backBtn = document.createElement("button");
  backBtn.textContent = "Back to setup";
  backBtn.addEventListener("click", () => {
    clock.pause();
    onBack();
  });
  controls.appendChild(backBtn);

  screen.appendChild(controls);
  root.appendChild(screen);

  clock.play();
}

/** Mounts the lab (?lab=1) into `root` — see this module's own docstring. */
export function mountLab(root: HTMLElement): void {
  const cfg = DEFAULT_RUN_CONFIG;
  root.classList.add("lab-wide");

  let mode: "single" | "compare" = "single";
  let linkSeeds = false;
  const stateA = defaultColumnState(randomSeed());
  const stateB = defaultColumnState(randomSeed());

  showSetup();

  function showSetup(): void {
    renderLabSetupScreen(
      root,
      cfg,
      mode,
      stateA,
      stateB,
      linkSeeds,
      (newMode) => {
        mode = newMode;
        showSetup();
      },
      (linked) => {
        linkSeeds = linked;
      },
      () => {
        if (linkSeeds) stateB.seed = stateA.seed;
        const setups = mode === "single" ? [toLabSetup(stateA)] : [toLabSetup(stateA), toLabSetup(stateB)];
        renderLabFightScreen(root, cfg, setups, showSetup);
      },
    );
  }
}
