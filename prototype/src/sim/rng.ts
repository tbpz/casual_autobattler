/**
 * Deterministic seeded PRNG (mulberry32). Same seed -> same sequence, always.
 * This is the sim's only source of randomness; nothing in sim/ may call Math.random().
 *
 * Carried over verbatim from the pre-2026-07-31 prototype (prototype/src/sim/rng.ts) —
 * self-contained and correct, unlike everything else in that build.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max) (exclusive of max). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** Returns true with probability `p` (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
