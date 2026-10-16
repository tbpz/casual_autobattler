/**
 * A clock the fight screen can stop (DECISIONS.md 2026-10-16: tapping a fighter, or the ⏸ button, pauses the fight).
 * Playback pauses its own sim clock, but every visual hold in fightView.ts runs on wall-clock timers and
 * requestAnimationFrame loops that would otherwise keep going: a chain-end hold, a tracer's flight, a fading popup.
 * Those go through this clock instead. `pause()` freezes `now()` and takes every pending timer's remaining time;
 * `resume()` re-arms them with what was left. DOM-free, so a check can import it.
 */
export class PauseClock {
  private paused = false;
  private pausedAt = 0;
  /** Total real time spent paused, taken off `now()` so a frozen animation resumes exactly where it stopped. */
  private offset = 0;
  private nextId = 1;
  private timers = new Map<number, { fn: () => void; due: number; handle: ReturnType<typeof globalThis.setTimeout> | null }>();

  get isPaused(): boolean {
    return this.paused;
  }

  /** Milliseconds on this clock: real time, minus every stretch spent paused. Frozen while paused. */
  now(): number {
    return (this.paused ? this.pausedAt : performance.now()) - this.offset;
  }

  /** Like the global setTimeout, but a pause holds it and a resume gives it back its remaining time. */
  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++;
    const timer = { fn, due: this.now() + ms, handle: null as ReturnType<typeof globalThis.setTimeout> | null };
    this.timers.set(id, timer);
    if (!this.paused) this.arm(id, ms);
    return id;
  }

  clearTimeout(id: number): void {
    const t = this.timers.get(id);
    if (t?.handle != null) globalThis.clearTimeout(t.handle);
    this.timers.delete(id);
  }

  pause(): void {
    if (this.paused) return;
    this.pausedAt = performance.now();
    this.paused = true;
    for (const t of this.timers.values()) {
      if (t.handle != null) globalThis.clearTimeout(t.handle);
      t.handle = null;
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.offset += performance.now() - this.pausedAt;
    this.paused = false;
    const now = this.now();
    for (const id of [...this.timers.keys()]) this.arm(id, Math.max(0, this.timers.get(id)!.due - now));
  }

  private arm(id: number, ms: number): void {
    const t = this.timers.get(id);
    if (!t) return;
    t.handle = globalThis.setTimeout(() => {
      this.timers.delete(id);
      t.fn();
    }, ms);
  }
}

/** The one clock every FightView shares. Only the fight screen ever pauses it; the lab never does. */
export const fightClock = new PauseClock();
