import { CARD_DEFS } from "./index.js";
import type { CardApi, CardDef, CardId, HookName, HookPayloads } from "./types.js";

interface Listener<K extends HookName> {
  when?: (e: HookPayloads[K], api: CardApi) => boolean;
  do: (e: HookPayloads[K], api: CardApi) => void;
}

/**
 * Runs the held cards' listeners for one fight (2026-10-01; see
 * cards/types.ts). One engine per fight, built by runFight from the run's held
 * card ids.
 *
 * Dispatch is immediate and in held-card order, so two cards on the same hook
 * resolve the same way every time. Immediate (not queued) is deliberate: a
 * Bulwark shield must land BEFORE the slam it blocks is applied, and a modify
 * hook must have changed its number before the caller reads it back.
 *
 * Cascades: while a card's `do` runs, the engine counts as one level deeper and
 * remembers which card is running. Anything that card causes — a mark, a heal,
 * a freeze — raises hooks that run further cards, one level deeper still. At
 * `maxDepth` a hook raises nothing, so a loop of cards feeding each other
 * ends instead of running forever.
 */
export class CardEngine {
  private readonly defs: CardDef[];
  /** The cards whose `do` is currently running, outermost first. */
  private readonly running: CardId[] = [];
  private readonly maxDepth: number;

  constructor(defs: readonly CardDef[], maxDepth: number) {
    this.defs = [...defs];
    this.maxDepth = maxDepth;
  }

  /** The engine for a run's held card ids, in held order. */
  static forHeld(held: readonly CardId[], maxDepth: number): CardEngine {
    return new CardEngine(
      held.map((id) => CARD_DEFS[id]),
      maxDepth,
    );
  }

  has(id: CardId): boolean {
    return this.defs.some((d) => d.id === id);
  }

  /** Per-fight counters for cards that build up (Momentum, Inferno) and for
   * "once per fight" guards. One engine per fight, so they start at zero. */
  private readonly counters = new Map<string, number>();

  counter(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  bump(key: string, by = 1): number {
    const next = this.counter(key) + by;
    this.counters.set(key, next);
    return next;
  }

  once(key: string): boolean {
    if (this.counters.has(key)) return false;
    this.counters.set(key, 1);
    return true;
  }

  /** For a card calling api.fire from inside its own `do`: the card that set
   * THIS one off (undefined at the top level) and how deep it sits (1 = fired
   * straight from the fight's own rules). */
  firing(): { causeCard: CardId | undefined; depth: number } {
    const depth = this.running.length;
    return { causeCard: depth >= 2 ? this.running[depth - 2] : undefined, depth: Math.max(1, depth) };
  }

  run<K extends HookName>(hook: K, payload: HookPayloads[K], api: CardApi): void {
    if (this.running.length >= this.maxDepth) return;
    for (const def of this.defs) {
      for (const h of def.hooks) {
        if (h.on !== hook) continue;
        // `h.on === hook` pins the payload to this hook's shape, which the
        // compiler can't follow through the union — hence the one cast.
        const listener = h as unknown as Listener<K>;
        if (listener.when && !listener.when(payload, api)) continue;
        this.running.push(def.id);
        try {
          listener.do(payload, api);
        } finally {
          this.running.pop();
        }
      }
    }
  }
}
