import type { FightEvent, FightResult, TickSnapshot } from "../sim/events.js";

export type PlaybackListener = (snapshot: TickSnapshot, eventsThisTick: FightEvent[]) => void;

/**
 * Walks a finished FightResult on wall-clock time. Never re-simulates —
 * the fight already ran to completion in sim/fight.ts; this only replays
 * the recorded snapshots/events, which is what makes pause/step trivial and
 * keeps the renderer decoupled from the sim entirely.
 */
export class Playback {
  private result: FightResult;
  private onTick: PlaybackListener;
  private onEnd: (() => void) | null;

  private paused = true;
  private elapsedSec = 0;
  private startWallClockMs = 0;
  private rafId: number | null = null;
  private lastEmittedIndex = -1;

  constructor(result: FightResult, onTick: PlaybackListener, onEnd?: () => void) {
    this.result = result;
    this.onTick = onTick;
    this.onEnd = onEnd ?? null;
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
    this.startWallClockMs = performance.now() - this.elapsedSec * 1000;
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
  }

  private loop = (): void => {
    if (this.paused) return;
    this.elapsedSec = (performance.now() - this.startWallClockMs) / 1000;
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
