/**
 * The cross-run collection (2026-10-01 — sim/collection.ts). Pins the rules that
 * keep a convenience from ever breaking a run: it round-trips, a corrupt or
 * foreign save reads as empty, a card removed from the game drops out of an old
 * save, storage that is missing or throws is survived, and the updates never
 * list a card twice.
 */
import {
  COLLECTION_KEY,
  emptyCollection,
  loadCollection,
  parseCollection,
  recordRelic,
  recordRunEnded,
  recordSeen,
  recordTaken,
  saveCollection,
  type StorageLike,
} from "../sim/collection.js";

let failed = false;

function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

{
  let c = emptyCollection();
  c = recordSeen(c, ["execute", "shatter", "execute"]);
  check("seen: a card listed twice is kept once", c.seen.length === 2);
  c = recordTaken(c, "spread");
  check("taken: a card taken counts as seen too", c.taken.includes("spread") && c.seen.includes("spread"));
  c = recordTaken(c, "spread");
  check("taken: taking it again adds nothing", c.taken.filter((id) => id === "spread").length === 1);
  c = recordRelic(c, "bastion");
  check("relic: a picked relic is recorded", c.relics.includes("bastion"));
  check("runs ended: starts at zero", c.runsEnded === 0);
  c = recordRunEnded(recordRunEnded(c));
  check("runs ended: each ended run adds one", c.runsEnded === 2);

  const store = fakeStorage();
  saveCollection(c, store);
  const back = loadCollection(store);
  check("round trip: what is saved is what is loaded", JSON.stringify(back) === JSON.stringify(c));
  check("storage key is the versioned one", COLLECTION_KEY in store.data);
}

{
  check("empty storage reads as an empty collection", JSON.stringify(loadCollection(fakeStorage())) === JSON.stringify(emptyCollection()));
  check("no storage at all reads as empty", JSON.stringify(loadCollection(undefined)) === JSON.stringify(emptyCollection()));
  check("corrupt JSON reads as empty", parseCollection("{not json").seen.length === 0);
  check("a different version reads as empty", parseCollection(JSON.stringify({ v: 2, seen: ["execute"] })).seen.length === 0);
  const old = parseCollection(JSON.stringify({ v: 1, seen: ["execute", "aCardThatWasRemoved"], taken: [], relics: [] }));
  check("a card no longer in the game drops out of an old save", old.seen.length === 1 && old.seen[0] === "execute");
  check("a malformed list reads as empty, not a crash", parseCollection(JSON.stringify({ v: 1, seen: "oops" })).seen.length === 0);
  check("a save from before runs-ended existed reads as zero", old.runsEnded === 0);
  check("a malformed runs-ended reads as zero", parseCollection(JSON.stringify({ v: 1, runsEnded: "many" })).runsEnded === 0 && parseCollection(JSON.stringify({ v: 1, runsEnded: -3 })).runsEnded === 0);
  check("a saved runs-ended survives a reload", parseCollection(JSON.stringify({ v: 1, runsEnded: 4 })).runsEnded === 4);
}

{
  let threw = false;
  try {
    const c = loadCollection(throwing);
    saveCollection(recordSeen(c, ["execute"]), throwing);
  } catch {
    threw = true;
  }
  check("storage that throws is survived on both read and write", !threw);
}

if (failed) process.exit(1);
