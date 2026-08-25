import type { FightEvent, FightResult, TickSnapshot } from "../sim/events.js";

export type PlaybackListener = (snapshot: TickSnapshot, eventsThisTick: FightEvent[]) => void;

/** Wall-clock ease time for a dilation-rate change — keeps the transition
 * into/out of a chain's slow-motion window a glide, not a jump cut. */
const RATE_EASE_SEC = 0.15;

/** Sim-time-advancement rate applied to the gap between chain beats — this
 * is the "is it still going?" suspense window a player reported as having no
 * visible state at all. Deepens past the escalation knee (sim/config.ts's
 * chainEscalationKneeHit) so the mechanical and pacing escalation land on the
 * same hit, same self-consistency rule the 2026-08-15 spectacle pass used. */
const GAP_RATE_PRE_KNEE = 0.4;
const GAP_RATE_POST_KNEE = 0.22;

/** Sim-time duration of the "resolution tail" appended after a chain's own
 * ending (2026-08-19, chain-ending pass) — extra breathing room so the
 * fight's next beats (the hot hero's OWN next normal attack fires on the
 * SAME tick a chain breaks — see fight.ts's per-hero action ordering; an
 * enemy's next hit could follow soon after) don't crowd in on top of the
 * miss/cap/end beat fightView.ts is holding on its own wall-clock timers.
 * At TAIL_RATE, this adds a fixed ~1.2s of wall-clock time (see
 * extraAddedTime's formula), independent of MAX_ADDED_WALL_SEC's own budget
 * for the inter-hit gaps — a long chain's tail shouldn't be squeezed out by
 * that cap. Skipped entirely when the chain force-closed because the FIGHT
 * itself ended (events.ts's chainEnd.reason "fightEnd"): there's no more
 * sim time left to dilate there, and the resolve overlay (app.ts's own
 * 900ms hold) is the bigger moment right behind it. */
const TAIL_SIM_SEC = 0.4;
const TAIL_RATE = 0.25;

/** Hard cap on total wall-clock seconds a single chain's dilation is allowed
 * to ADD over its natural (undilated) duration. Without this, a long chain
 * (up to sim/config.ts's chainMaxHits) would stall the watch-native pace —
 * solved analytically per window at construction by blending every gap's
 * rate toward 1.0 until the total fits, rather than picking a fixed rate per
 * chain length by hand. */
const MAX_ADDED_WALL_SEC = 4.0;

interface Segment {
  from: number;
  to: number;
  rate: number;
}

interface ChainWindow {
  startT: number;
  endT: number;
  chainLength: number;
  backfire: boolean;
  segments: Segment[];
}

function blend(rate: number, k: number): number {
  return rate + (1 - rate) * k;
}

/** Wall-clock seconds this window's segments would ADD over their natural
 * duration if every gap were blended toward 1.0 by `k` (0 = full dilation,
 * 1 = no dilation). Monotonically decreasing in k — what capTotalAddedTime
 * bisects against. */
function extraAddedTime(segments: Segment[], k: number): number {
  let sum = 0;
  for (const seg of segments) {
    const rate = blend(seg.rate, k);
    sum += (seg.to - seg.from) * (1 / rate - 1);
  }
  return sum;
}

function capTotalAddedTime(segments: Segment[]): Segment[] {
  if (extraAddedTime(segments, 0) <= MAX_ADDED_WALL_SEC) return segments;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (extraAddedTime(segments, mid) > MAX_ADDED_WALL_SEC) lo = mid;
    else hi = mid;
  }
  return segments.map((seg) => ({ ...seg, rate: blend(seg.rate, hi) }));
}

/** Points = [ignition, ...each chainHit, chainEnd] — the gap BETWEEN
 * consecutive points is exactly the beat a player can't currently read:
 * "did it just land, or is it still rolling?" `upcomingHitIndex` (1-based)
 * is which hit (or the final continuation roll before chainEnd) that gap is
 * leading to. */
function buildSegments(points: number[], kneeHit: number): Segment[] {
  const raw: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const upcomingHitIndex = i + 1;
    const rate = upcomingHitIndex > kneeHit ? GAP_RATE_POST_KNEE : GAP_RATE_PRE_KNEE;
    raw.push({ from: points[i] as number, to: points[i + 1] as number, rate });
  }
  return capTotalAddedTime(raw);
}

/** Pairs each chainStart with its chainEnd — safe by construction, since
 * sim/fight.ts only ever has one hero hot at a time and always force-closes
 * a still-open chain with a trailing chainEnd if the fight ends mid-chain
 * (see events.ts's chainEnd docstring).
 *
 * 2026-08-19 (chain-ending pass): appends the resolution-tail segment (see
 * TAIL_SIM_SEC above) onto every window except a fightEnd close, then a
 * second pass clips each window's tail against the NEXT window's own
 * startT — fight.ts only guarantees one hero hot at a time, not any minimum
 * gap between chains, so a back-to-back re-fire could otherwise start
 * inside the previous chain's tail. rateAt below returns the FIRST window
 * containing a given simT; an unclipped tail bleeding past the next chain's
 * start would shadow that chain's own (real) gap rates with the stale
 * tail's rate instead.
 *
 * 2026-08-20 (per-hero-profile pass): each window's knee now comes from ITS
 * OWN chainStart event (e.shape.escalationKneeHit) — a firing hero's own
 * fuse shape, once profiles are authored — rather than one global knee for
 * every window. `fallbackKneeHit` (the constructor's own default-fallback
 * param, ultimately app.ts's cfg.fight.chainEscalationKneeHit) is used only
 * defensively, since chainStart.shape is a required field and every window
 * is built from one. */
function buildChainWindows(events: FightEvent[], fallbackKneeHit: number): ChainWindow[] {
  const windows: ChainWindow[] = [];
  let openStartT: number | null = null;
  let openBackfire = false;
  let openKneeHit = fallbackKneeHit;
  let hitTs: number[] = [];
  for (const e of events) {
    if (e.type === "chainStart") {
      openStartT = e.t;
      openBackfire = e.backfire;
      openKneeHit = e.shape.escalationKneeHit;
      hitTs = [];
    } else if (e.type === "chainHit" && openStartT !== null) {
      hitTs.push(e.t);
    } else if (e.type === "chainEnd" && openStartT !== null) {
      const points = [openStartT, ...hitTs, e.t];
      const segments = buildSegments(points, openKneeHit);
      let endT = e.t;
      if (e.reason !== "fightEnd") {
        segments.push({ from: e.t, to: e.t + TAIL_SIM_SEC, rate: TAIL_RATE });
        endT = e.t + TAIL_SIM_SEC;
      }
      windows.push({
        startT: openStartT,
        endT,
        chainLength: e.chainLength,
        backfire: openBackfire,
        segments,
      });
      openStartT = null;
    }
  }
  for (let i = 0; i < windows.length - 1; i++) {
    const w = windows[i] as ChainWindow;
    const nextStart = (windows[i + 1] as ChainWindow).startT;
    if (w.endT > nextStart) {
      w.endT = nextStart;
      const last = w.segments[w.segments.length - 1];
      if (last && last.to > nextStart) last.to = nextStart;
    }
  }
  return windows;
}

/** Small, separate dilation windows for the enrage CLOCK/WOUNDED beats
 * (2026-08-26 visibility pass) — same rate-blending idea as a chain window,
 * deliberately NOT sharing chainWindows/MAX_ADDED_WALL_SEC's own budget:
 * these are small beats (a tier landing, a one-off spike), not the fight's
 * main spectacle, and must never compete with it — see rateAt below, which
 * checks a chain window first and only falls back to these when none is
 * active. */
interface EnrageWindow {
  startT: number;
  endT: number;
  rate: number;
}

/** Rate applied to the CLOCK telegraph-to-land gap, and the hard cap on how
 * much wall-clock time that can add — small on purpose, this is a lead-in
 * beat, not a suspense window on the scale of a chain's own gaps. */
const TIER_TELEGRAPH_RATE = 0.45;
const TIER_MAX_ADDED_WALL_SEC = 1.0;
/** WOUNDED has no lead-in (it's a spike, not a telegraphed step) — this is
 * its own resolution tail instead, mirroring TAIL_SIM_SEC/TAIL_RATE above so
 * the flare has a beat to land in before the next action barrels through it. */
const WOUNDED_TAIL_SIM_SEC = 0.35;
const WOUNDED_TAIL_RATE = 0.3;

function buildEnrageWindows(events: FightEvent[]): EnrageWindow[] {
  const windows: EnrageWindow[] = [];
  const telegraphedAt = new Map<number, number>();
  for (const e of events) {
    if (e.type === "enrageTierTelegraph") {
      telegraphedAt.set(e.tier, e.t);
    } else if (e.type === "enrageTier") {
      const startT = telegraphedAt.get(e.tier);
      if (startT !== undefined && e.t > startT) {
        const rawGap = e.t - startT;
        const addedAtFullRate = rawGap * (1 / TIER_TELEGRAPH_RATE - 1);
        const rate = addedAtFullRate > TIER_MAX_ADDED_WALL_SEC ? rawGap / (rawGap + TIER_MAX_ADDED_WALL_SEC) : TIER_TELEGRAPH_RATE;
        windows.push({ startT, endT: e.t, rate });
      }
    } else if (e.type === "wounded") {
      windows.push({ startT: e.t, endT: e.t + WOUNDED_TAIL_SIM_SEC, rate: WOUNDED_TAIL_RATE });
    }
  }
  return windows;
}

function enrageRateAt(simT: number, windows: EnrageWindow[]): number {
  for (const w of windows) {
    if (simT >= w.startT && simT < w.endT) return w.rate;
  }
  return 1;
}

function rateAt(simT: number, chainWindows: ChainWindow[], enrageWindows: EnrageWindow[]): number {
  for (const w of chainWindows) {
    if (simT < w.startT || simT > w.endT) continue;
    for (const seg of w.segments) {
      if (simT >= seg.from && simT < seg.to) return seg.rate;
    }
    return w.segments.length > 0 ? (w.segments[w.segments.length - 1] as Segment).rate : 1;
  }
  return enrageRateAt(simT, enrageWindows);
}

/**
 * Walks a finished FightResult on wall-clock time. Never re-simulates —
 * the fight already ran to completion in sim/fight.ts; this only replays
 * the recorded snapshots/events, which is what makes pause/step trivial and
 * keeps the renderer decoupled from the sim entirely.
 *
 * 2026-08-17 (chain legibility pass): sim-time no longer advances 1:1 with
 * wall-clock. Inside a chain's window, elapsedSec is dilated — the gap
 * between beats (where a player can't currently tell "is it still going?")
 * gets more wall-clock time, deepening past the escalation knee so the
 * pacing and the mechanical payoff jump land on the same hit. Everything a
 * fixed-duration CSS/setTimeout animation does (a tracer's flight, a
 * flinch) is unaffected — those are wall-clock effects layered on top of an
 * instantaneous event dispatch, so an impact stays exactly as snappy as it
 * always was; only how long the player waits BETWEEN dispatches changes.
 * Outside any chain window the rate is 1 and playback is unchanged.
 */
export class Playback {
  private result: FightResult;
  private onTick: PlaybackListener;
  private onEnd: (() => void) | null;
  private chainWindows: ChainWindow[];
  private enrageWindows: EnrageWindow[];

  private paused = true;
  private elapsedSec = 0;
  private lastFrameMs = 0;
  private currentRate = 1;
  private rafId: number | null = null;
  private lastEmittedIndex = -1;

  constructor(result: FightResult, onTick: PlaybackListener, onEnd?: () => void, chainEscalationKneeHit = 4) {
    this.result = result;
    this.onTick = onTick;
    this.onEnd = onEnd ?? null;
    this.chainWindows = buildChainWindows(result.events, chainEscalationKneeHit);
    this.enrageWindows = buildEnrageWindows(result.events);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get durationSec(): number {
    return this.result.durationSec;
  }

  play(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Advance exactly one recorded snapshot — for diagnosing "what just happened." */
  step(): void {
    this.pause();
    if (this.lastEmittedIndex + 1 >= this.result.snapshots.length) return;
    const snap = this.result.snapshots[this.lastEmittedIndex + 1];
    if (!snap) return;
    this.elapsedSec = snap.t;
    this.emitUpTo(snap.t);
  }

  restart(): void {
    this.pause();
    this.elapsedSec = 0;
    this.lastEmittedIndex = -1;
    this.currentRate = 1;
  }

  private loop = (): void => {
    if (this.paused) return;
    const now = performance.now();
    const wallDeltaSec = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    const targetRate = rateAt(this.elapsedSec, this.chainWindows, this.enrageWindows);
    const ease = wallDeltaSec > 0 ? Math.min(1, wallDeltaSec / RATE_EASE_SEC) : 1;
    this.currentRate += (targetRate - this.currentRate) * ease;
    this.elapsedSec += wallDeltaSec * this.currentRate;
    this.emitUpTo(this.elapsedSec);
    if (this.elapsedSec >= this.result.durationSec) {
      this.pause();
      this.onEnd?.();
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private emitUpTo(t: number): void {
    let next = this.result.snapshots[this.lastEmittedIndex + 1];
    while (next && next.t <= t) {
      this.lastEmittedIndex++;
      const snap = next;
      const eventsThisTick = this.result.events.filter((e) => Math.abs(e.t - snap.t) < 1e-9);
      this.onTick(snap, eventsThisTick);
      next = this.result.snapshots[this.lastEmittedIndex + 1];
    }
  }
}
