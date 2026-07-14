import { TICK_RATE } from "../sim/engine";
import type { SimEvent, SimResult } from "../sim/events";
import type { Team } from "../sim/types";
import type { ArenaRenderer } from "./arenaRenderer";

const TICK_DURATION = 1 / TICK_RATE;

/**
 * Walks a completed SimResult over (real or scrubbed) time and feeds each tick to the
 * renderer. The sim already ran to completion (Phase 0); this class never re-simulates —
 * it only plays back recorded snapshots/events, which is what keeps scrubbing/step/rewind
 * trivial and keeps the sim reusable headlessly.
 */
export class Playback {
  private readonly renderer: ArenaRenderer;
  private readonly result: SimResult;
  private index = 0;
  private accumulator = 0;
  private playing = false;
  private speed = 1;
  private readonly eventsByTick: Map<number, SimEvent[]>;

  onTickChange?: (index: number, total: number) => void;
  onEnd?: (winner: Team | "draw") => void;

  constructor(renderer: ArenaRenderer, result: SimResult) {
    this.renderer = renderer;
    this.result = result;
    this.eventsByTick = new Map();
    for (const event of result.events) {
      const list = this.eventsByTick.get(event.tick) ?? [];
      list.push(event);
      this.eventsByTick.set(event.tick, list);
    }
    this.renderCurrent();
  }

  get totalTicks(): number {
    return this.result.snapshots.length;
  }

  get currentIndex(): number {
    return this.index;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    if (this.index >= this.totalTicks - 1) this.seek(0);
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  step(delta: number): void {
    this.pause();
    this.seek(this.index + delta);
  }

  seek(index: number): void {
    this.index = Math.max(0, Math.min(index, this.totalTicks - 1));
    this.accumulator = 0;
    this.renderCurrent();
  }

  restart(): void {
    this.seek(0);
  }

  /** Call once per animation frame with elapsed real seconds. */
  update(deltaSeconds: number): void {
    if (!this.playing) return;
    this.accumulator += deltaSeconds * this.speed;

    let advanced = false;
    while (this.accumulator >= TICK_DURATION) {
      this.accumulator -= TICK_DURATION;
      if (this.index >= this.totalTicks - 1) {
        this.playing = false;
        break;
      }
      this.index++;
      advanced = true;
    }
    if (advanced) this.renderCurrent();
  }

  private renderCurrent(): void {
    const snapshot = this.result.snapshots[this.index];
    const events = this.eventsByTick.get(snapshot.tick) ?? [];
    this.renderer.renderTick(snapshot, events);
    this.onTickChange?.(this.index, this.totalTicks);
    if (this.index === this.totalTicks - 1) {
      this.onEnd?.(this.result.winner);
    }
  }
}
