import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { defaultCardDrop, type Offer } from "../sim/offers.js";
import type { CardId } from "../sim/cards/index.js";
import { heldCards } from "../sim/progress.js";
import { FightView } from "./fightView.js";
import { bestMoment } from "./fightSummary.js";
import { openFighterPopup, type PopupFighter } from "./fighterPopup.js";
import { openTermCard } from "./termCards.js";
import { fierceScowl } from "./roundParts.js";
import { roundEnemySide } from "../sim/rounds.js";
import { Playback } from "./playback.js";
import { RunSession } from "./runSession.js";
import { renderRunCompleteScreen } from "./runScreens.js";
import { renderRunOverScreen } from "./runOverScreen.js";
import { renderRoundScreen } from "./roundScreen.js";
import { renderSquadScreen } from "./squadScreen.js";
import { renderOfferScreen } from "./offerScreen.js";
import { renderRelicScreen } from "./relicScreen.js";
import { renderMergeScreen } from "./mergeScreen.js";
import type { HeroKind } from "../sim/types.js";
import { downloadRunLog } from "../log/download.js";

const cfg = DEFAULT_RUN_CONFIG;

const ICON_PAUSE = '<svg width="11" height="11" viewBox="0 0 11 11"><rect x="1.5" y="1" width="3" height="9" rx="0.8" fill="#e8e8ee"/><rect x="6.5" y="1" width="3" height="9" rx="0.8" fill="#e8e8ee"/></svg>';
const ICON_PLAY_SMALL = '<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2.5 1 L9.5 5.5 L2.5 10 Z" fill="#e8e8ee"/></svg>';

/**
 * Attribution self-test instrumentation (archive/ATTRIBUTION_TEST.md) —
 * two URL params, both no-ops when absent so ordinary play is unaffected:
 *  - ?seed=N pins the run seed (otherwise random, as before) and displays it
 *    in a corner badge on every screen, so a fight worth arguing about can be
 *    reproduced exactly (checks/determinism.ts already guarantees same
 *    seed -> same event log).
 *  - ?test=1 adds the full chain / death log to the run-over screen.
 */
const urlParams = new URLSearchParams(location.search);
const testMode = urlParams.get("test") === "1";
const pinnedSeed = urlParams.get("seed");
/** Screenshot helpers, no-ops when absent: ?round=N plays the run headless with the default
 * picks until round N's round screen, ?runover=1 plays it until the run ends. */
const jumpToRound = Number(urlParams.get("round")) || 0;
const jumpToRunOver = urlParams.get("runover") === "1";
/** ?fall=N (with ?round=N): marks the last N fielded units dead, to see the empty-slot screen without a lucky seed. */
const fallCount = Number(urlParams.get("fall")) || 0;
/** ?offer=N: plays to round N, wins it if it can, and opens that win's reward pick (the upgrades screen). A no-op when absent. */
const jumpToOffer = Number(urlParams.get("offer")) || 0;

/** The seed corner badge, present on every screen, with an "export" link that
 * downloads the run so far as JSON (log/runLog.ts). Each click writes every
 * round played to that point, so the last file from a run is the full record. */
function appendSeedBadge(root: HTMLElement, session: RunSession): void {
  const badge = document.createElement("div");
  badge.className = "seed-badge";
  badge.textContent = `seed ${session.seed} · `;
  const exportLink = document.createElement("a");
  exportLink.className = "export-log-link";
  exportLink.href = "#";
  exportLink.textContent = "export";
  exportLink.addEventListener("click", (e) => {
    e.preventDefault();
    downloadRunLog(session, cfg);
  });
  badge.appendChild(exportLink);
  root.appendChild(badge);
}

export function mountApp(root: HTMLElement): void {
  let session: RunSession;
  let playback: Playback | null = null;
  // The player's squad-mix pick for the round about to be played.
  let pendingFieldedIds: string[] = [];
  // The squad on the round screen before Fight (null until the round screen first draws it).
  let roundPick: string[] | null = null;

  // The round 1 reward (2026-10-01): pick a relic. No row is pre-selected.
  function showRelicScreen(): void {
    renderRelicScreen(root, session.relicChoices, (id) => {
      session.pickRelic(id);
      afterRoundResolved();
    });
    appendSeedBadge(root, session);
  }

  function startNewRun(): void {
    const seed = pinnedSeed !== null && pinnedSeed !== "" ? Number(pinnedSeed) : Math.floor(Math.random() * 1_000_000_000);
    session = new RunSession(cfg, seed);
    if (jumpToRound > 1 || jumpToOffer > 1 || jumpToRunOver) fastForward();
    if (fallCount > 0) {
      const byId = new Map(session.currentRoster.heroes.map((h) => [h.id, h]));
      for (const id of session.lastFielded.slice(-fallCount)) {
        const h = byId.get(id);
        if (h) h.alive = false;
      }
    }
    if (session.status === "over") {
      showRunOver();
      return;
    }
    if (jumpToOffer > 1) {
      session.playNextRound();
      if (runIsOver()) {
        showRunOver();
        return;
      }
      showReward();
      return;
    }
    // A run opens straight on its first fight (2026-10-01); the relic pick is that
    // fight's reward.
    showRoundScreen();
  }

  /** Plays rounds with the accept-default pick (the same loop as checks/runLog.ts playSession). */
  function fastForward(): void {
    while (session.status === "in-progress" && (jumpToRunOver || session.currentRoundIndex < Math.max(jumpToRound, jumpToOffer) - 1)) {
      session.playNextRound();
      if (session.status !== "in-progress") break;
      if (session.awaitingRelic) {
        session.pickRelic(session.relicChoices[0]!);
      } else if (session.awaitingMerge) {
        // The accept-default merge: the first hero the roster can make (sim/run.ts's defaultMergePick).
        session.resolveMerge(session.mergeChoices[0]!.kind);
      } else if (session.pendingOffers.length === 0) {
        session.resolveOffer(null);
      } else {
        const offer = session.pendingOffers[0]!;
        session.resolveOffer(offer, defaultCardDrop(session.progress, session.currentRoster, offer, cfg));
      }
    }
  }

  /** Read through a function so the earlier status check does not narrow the type after a round is played. */
  function runIsOver(): boolean {
    return session.status === "over";
  }

  function showRunOver(): void {
    renderRunOverScreen(root, cfg, session, startNewRun, testMode);
    appendSeedBadge(root, session);
  }

  function showRunComplete(): void {
    renderRunCompleteScreen(root, session.rounds.length, startNewRun);
    appendSeedBadge(root, session);
  }

  function showRoundScreen(): void {
    // The squad so far: last round's living squad, with an empty slot where a unit died. It survives a trip
    // to the squad screen and back, and starts over each round.
    roundPick ??= session.defaultPickWithGaps;
    renderRoundScreen(
      root,
      cfg,
      session.currentRoundIndex,
      session.currentEncounterIndex,
      session.currentRoster,
      session.progress,
      session.currentEncounterName,
      session.currentEncounterBlurb,
      session.currentRoundKind,
      roundPick,
      session.lastFielded,
      (fieldedIds) => {
        pendingFieldedIds = fieldedIds;
        roundPick = null;
        playCurrentFight();
      },
      { onChangeSquad: showSquadScreen },
    );
    appendSeedBadge(root, session);
  }

  function showSquadScreen(pick: string[]): void {
    renderSquadScreen(root, cfg, session.currentRoundIndex + 1, session.currentRoster, session.progress.slots, pick, (newPick) => {
      roundPick = newPick;
      showRoundScreen();
    });
    appendSeedBadge(root, session);
  }

  function playCurrentFight(): void {
    root.innerHTML = "";
    const fightContainer = document.createElement("div");
    root.appendChild(fightContainer);

    const view = new FightView(fightContainer, cfg.fight);
    const result = session.playNextRound(pendingFieldedIds);
    view.setBestMoment(bestMoment(result));
    // Continue is the only way off the result overlay: it shows how the fight ended and the best moment, then waits.
    view.onContinue(() => {
      if (session.status === "over") {
        showRunOver();
        return;
      }
      showReward();
    });

    let ended = false;
    // A paused fight stops everything: the playback clock, every fight timer and every CSS animation (FightView.pause).
    let pausedByButton = false;
    let pausedByPopup = false;
    const syncPause = (): void => {
      const stop = pausedByButton || pausedByPopup;
      pauseBtn.classList.toggle("on", pausedByButton);
      pauseBtn.setAttribute("aria-label", pausedByButton ? "Resume" : "Pause");
      pauseBtn.innerHTML = pausedByButton ? ICON_PLAY_SMALL : ICON_PAUSE;
      if (ended) return;
      if (stop) {
        playback?.pause();
        view.pause();
      } else {
        view.resume();
        playback?.play();
      }
    };

    playback = new Playback(
      result,
      (snapshot, events) => view.render(snapshot, events),
      () => {
        ended = true;
        pauseBtn.remove();
      },
      cfg.fight.chainFullTellThreshold,
      (simT) => view.renderFrame(simT),
    );

    // The round ⏸ button in the card's top-right corner replaces the Pause and Step buttons under the arena.
    const pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "ft-pause";
    pauseBtn.innerHTML = ICON_PAUSE;
    pauseBtn.setAttribute("aria-label", "Pause");
    pauseBtn.addEventListener("click", () => {
      pausedByButton = !pausedByButton;
      syncPause();
    });
    fightContainer.appendChild(pauseBtn);

    // A tap on any fighter pauses the fight and opens its popup (frames 2.1 to 2.6); closing it resumes.
    let closePopup: (() => void) | null = null;
    view.setFighterTapHandler((id) => {
      if (closePopup) return;
      const snap = view.currentSnapshot;
      if (!snap) return;
      const squadBase = new Map(session.currentPlayerSide.heroes.map((h) => [h.id, h]));
      const enemyBase = new Map(roundEnemySide(cfg, session.currentRoundIndex, session.currentEncounterIndex).heroes.map((h) => [h.id, h]));
      const toFighter = (h: (typeof snap.playerHeroes)[number], base: Map<string, { damage: number; healPerBeat?: number; reachesBackline?: boolean }>): PopupFighter => ({
        id: h.id,
        name: h.name,
        role: h.role,
        hp: h.hp,
        maxHp: h.maxHp,
        alive: h.alive,
        damage: base.get(h.id)?.damage ?? 0,
        healPerBeat: base.get(h.id)?.healPerBeat,
        reachesBackline: base.get(h.id)?.reachesBackline,
        fatigue: h.fatigue,
        hero: h.hero,
        madeFrom: h.madeFrom,
        stage: h.stage,
        skeleton: h.skeleton,
      });
      pausedByPopup = true;
      syncPause();
      closePopup = openFighterPopup({
        cfg,
        // A Necromancer's empty skeleton places are not fighters yet: they stay out of the switcher until Raise fills them.
        squad: snap.playerHeroes.filter((h) => !(h.skeleton && h.maxHp === 0)).map((h) => toFighter(h, squadBase)),
        enemies: snap.enemyHeroes.map((h) => toFighter(h, enemyBase)),
        openId: id,
        progress: session.progress,
        fierceEnemies: fierceScowl(session.currentRoundKind, session.currentEncounterName),
        onClose: () => {
          closePopup = null;
          pausedByPopup = false;
          syncPause();
        },
      });
    });

    // A tap on a status pill or the skill bubble pauses the fight and opens that word's card; closing it resumes.
    view.setTermTapHandler((term) => {
      if (closePopup) return;
      pausedByPopup = true;
      syncPause();
      let done = false;
      const close = openTermCard(term, () => {
        done = true;
        closePopup = null;
        pausedByPopup = false;
        syncPause();
      });
      // A term with no card closes at once, before this line: do not keep a stale closer.
      if (!done) closePopup = close;
    });

    playback.play();
    appendSeedBadge(root, session);
  }

  // After a win's recap: the relic pick on the relic round, the normal offers on
  // every other. A relic round that left too few units to field has neither: it
  // falls through to the offer path with nothing to show, which ends the run.
  function showReward(): void {
    if (session.awaitingRelic) showRelicScreen();
    else if (session.awaitingMerge) showMergeScreen();
    else showOfferScreen();
  }

  // A mini-boss win's reward (2026-10-20): make a hero, or "not now" for the round's usual offers.
  function showMergeScreen(): void {
    renderMergeScreen(root, session.currentRoster, session.mergeChoices, (kind: HeroKind | null) => {
      session.resolveMerge(kind);
      if (kind) afterRoundResolved();
      else showOfferScreen();
    });
    appendSeedBadge(root, session);
  }

  function showOfferScreen(): void {
    if (session.pendingOffers.length === 0) {
      onOfferChosen(null);
      return;
    }
    renderOfferScreen(root, session.pendingOffers, heldCards(session.progress), cfg.cardCap, onOfferChosen);
    appendSeedBadge(root, session);
  }

  function onOfferChosen(offer: Offer | null, dropCardId?: CardId): void {
    session.resolveOffer(offer, dropCardId);
    afterRoundResolved();
  }

  // The step after a win's reward (an offer or the relic) has been applied.
  function afterRoundResolved(): void {
    if (session.status === "complete") {
      showRunComplete();
      return;
    }
    // A WIN can still end the run here — the roster falling below
    // progress.slots living units means the NEXT round can't even be
    // fielded. Distinct from a round LOSS, which onFightEnd already caught
    // before the offer screen was ever shown.
    if (session.status === "over") {
      showRunOver();
      return;
    }
    showRoundScreen();
  }

  startNewRun();
}
