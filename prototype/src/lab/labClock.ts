/**
 * The lab's own playback driver — deliberately NOT render/playback.ts's
 * Playback. Playback stretches sim-time during a chain (chain windows,
 * GAP_RATE_PRE_KNEE/POST_KNEE) so a cascade is watchable one fight at a time;
 * two of those side by side would drift apart the instant one fight chains
 * and the other doesn't, and a glance across the compare view would stop
 * meaning "the same moment in both fights." LabClock instead advances every
 * track on ONE shared elapsedSec, 1:1 with (rate-scaled) wall-clock time, no
 * dilation at all — a second of fight time is a second of fight time in
 * every panel, always. Playback itself is untouched; this is a second,
 * simpler driver for a different job.
 */
import type { FightEvent, FightResult, TickSnapshot } from "../sim/events.js";

export type LabClockListener = (snapshot: TickSnapshot, eventsThisTick: FightEvent[]) => void;

const SPEEDS = [0.5, 1, 2, 4] as const;
export type LabSpeed = (typeof SPEEDS)[number];

interface Track {
  result: FightResult;
  onTick: LabClockListener;
  lastEmittedIndex: number;
}

/** Drives any number of FightResults on one shared clock. Each track holds
 * its own emit cursor, so a fight that ends early just stops advancing while
 * the clock (and any longer-running sibling track) keeps going — the
 * finished panel sits on its last frame rather than looping or blanking. */
export class LabClock {
  private tracks: Track[] = [];
  private paused = true;
  private elapsedSec = 0;
  private lastFrameMs = 0;
  private speed: LabSpeed = 1;
  private rafId: number | null = null;

  /** Registers a fight to advance on this clock. Returns nothing — tracks
   * are addressed collectively (play/pause/step/restart all apply to every
   * track at once), since the whole point of a shared clock is that there is
   * exactly one set of transport controls for the compare view. */
  addTrack(result: FightResult, onTick: LabClockListener): void {
    this.tracks.push({ result, onTick, lastEmittedIndex: -1 });
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** The longest track's own duration — what a shared elapsed-time readout
   * counts up toward. */
  get durationSec(): number {
    return this.tracks.reduce((max, t) => Math.max(max, t.result.durationSec), 0);
  }

  get elapsed(): number {
    return this.elapsedSec;
  }

  setSpeed(speed: LabSpeed): void {
    this.speed = speed;
  }

  get currentSpeed(): LabSpeed {
    return this.speed;
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

  /** Advances every track by exactly one of ITS OWN recorded ticks — tracks
   * don't share a tick rate assumption, each just moves to its own next
   * snapshot. A track already at its end is a no-op. */
  step(): void {
    this.pause();
    let target = this.elapsedSec;
    for (const t of this.tracks) {
      const next = t.result.snapshots[t.lastEmittedIndex + 1];
      if (next) target = Math.max(target, next.t);
    }
    this.elapsedSec = target;
    this.emitAll();
  }

  restart(): void {
    this.pause();
    this.elapsedSec = 0;
    for (const t of this.tracks) t.lastEmittedIndex = -1;
  }

  private loop = (): void => {
    if (this.paused) return;
    const now = performance.now();
    const wallDeltaSec = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    this.elapsedSec += wallDeltaSec * this.speed;
    this.emitAll();
    if (this.elapsedSec >= this.durationSec) {
      this.pause();
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private emitAll(): void {
    for (const t of this.tracks) {
      let next = t.result.snapshots[t.lastEmittedIndex + 1];
      while (next && next.t <= this.elapsedSec) {
        t.lastEmittedIndex++;
        const snap = next;
        const eventsThisTick = t.result.events.filter((e) => Math.abs(e.t - snap.t) < 1e-9);
        t.onTick(snap, eventsThisTick);
        next = t.result.snapshots[t.lastEmittedIndex + 1];
      }
    }
  }
}

export const LAB_SPEEDS = SPEEDS;
