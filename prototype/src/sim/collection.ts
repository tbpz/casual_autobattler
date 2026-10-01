import { CARD_IDS } from "./cards/index.js";
import type { CardId } from "./cards/index.js";

/**
 * 2026-10-01 (the build-depth plan, "E. duo cards ... with a collection screen"):
 * what the player has met across runs. Hades' pull is remembering a boon and
 * wanting to find it again, so the collection records every card ever offered
 * (seen), every card ever taken, and every relic ever picked — and a duo not yet
 * found is shown as a silhouette with the two parts it needs, which turns "I
 * remember that card" into a goal for the next run.
 *
 * This file is the pure half: the data, the updates and the (de)serialising, with
 * the storage handed in so a check can pass a fake. The screen that shows it is
 * render/collectionScreen.ts; the only place it touches the browser is
 * render/app.ts, which hands in window.localStorage.
 */
export interface Collection {
  v: 1;
  /** Every card ever shown on an offer. */
  seen: CardId[];
  /** Every card ever taken (a duo in here is a found duo). */
  taken: CardId[];
  /** Every relic ever picked. */
  relics: CardId[];
  /** How many runs have ended (lost or completed). The Collection button on the
   * relic screen appears once this is above zero (2026-10-01). */
  runsEnded: number;
}

export const COLLECTION_KEY = "autobattler.collection.v1";

/** The slice of the Web Storage API this file uses — so tests can fake it. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyCollection(): Collection {
  return { v: 1, seen: [], taken: [], relics: [], runsEnded: 0 };
}

function addAll(list: readonly CardId[], ids: readonly CardId[]): CardId[] {
  const fresh = ids.filter((id, i) => !list.includes(id) && ids.indexOf(id) === i);
  return fresh.length === 0 ? [...list] : [...list, ...fresh];
}

export function recordSeen(c: Collection, ids: readonly CardId[]): Collection {
  return { ...c, seen: addAll(c.seen, ids) };
}

export function recordTaken(c: Collection, id: CardId): Collection {
  return { ...c, seen: addAll(c.seen, [id]), taken: addAll(c.taken, [id]) };
}

export function recordRelic(c: Collection, id: CardId): Collection {
  return { ...c, relics: addAll(c.relics, [id]) };
}

export function recordRunEnded(c: Collection): Collection {
  return { ...c, runsEnded: c.runsEnded + 1 };
}

/** Parses what storage returned. Anything unreadable, or from a different
 * version, is an empty collection; ids no longer in the registry are dropped so
 * an old save can't poison the screen after a card is removed. */
export function parseCollection(raw: string | null): Collection {
  if (!raw) return emptyCollection();
  try {
    const data = JSON.parse(raw) as Partial<Collection>;
    if (data.v !== 1) return emptyCollection();
    const known = (list: unknown): CardId[] =>
      Array.isArray(list) ? (list.filter((id): id is CardId => typeof id === "string" && (CARD_IDS as string[]).includes(id))) : [];
    // A save from before runsEnded existed reads as 0 (the version stays 1).
    const ended = typeof data.runsEnded === "number" && Number.isFinite(data.runsEnded) && data.runsEnded > 0 ? Math.floor(data.runsEnded) : 0;
    return { v: 1, seen: known(data.seen), taken: known(data.taken), relics: known(data.relics), runsEnded: ended };
  } catch {
    return emptyCollection();
  }
}

/** Reads the collection; never throws (private windows, blocked storage and
 * corrupt saves all read as empty). */
export function loadCollection(storage: StorageLike | undefined): Collection {
  try {
    return parseCollection(storage ? storage.getItem(COLLECTION_KEY) : null);
  } catch {
    return emptyCollection();
  }
}

/** Writes the collection; silently does nothing if storage refuses. */
export function saveCollection(c: Collection, storage: StorageLike | undefined): void {
  try {
    storage?.setItem(COLLECTION_KEY, JSON.stringify(c));
  } catch {
    // Storage is a convenience: a run plays the same without it.
  }
}
