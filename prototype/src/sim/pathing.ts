import { hexDistance, hexKey, hexNeighbors, type Hex } from "./hex";
import type { GameMap } from "./map";

class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: T): void {
    this.items.push({ priority, value });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop(): T | undefined {
    return this.items.shift()?.value;
  }
}

/**
 * A* shortest path from `start` to `goal` over passable hexes.
 * `occupied` hexes (other units) are treated as temporarily impassable.
 * Returns the path including `start` and `goal`, or null if unreachable.
 */
export function findPath(
  map: GameMap,
  start: Hex,
  goal: Hex,
  occupied: ReadonlySet<string> = new Set(),
): Hex[] | null {
  if (hexKey(start) === hexKey(goal)) return [start];

  const cameFrom = new Map<string, Hex>();
  const costSoFar = new Map<string, number>();
  const startKey = hexKey(start);
  const goalKey = hexKey(goal);

  costSoFar.set(startKey, 0);
  const frontier = new MinHeap<Hex>();
  frontier.push(0, start);

  while (frontier.size > 0) {
    const current = frontier.pop()!;
    const currentKey = hexKey(current);
    if (currentKey === goalKey) break;

    for (const next of hexNeighbors(current)) {
      const nextKey = hexKey(next);
      const isGoal = nextKey === goalKey;
      if (!map.isPassable(next) && !isGoal) continue;
      if (occupied.has(nextKey) && !isGoal) continue;
      if (!map.isInBounds(next)) continue;

      const newCost = costSoFar.get(currentKey)! + 1;
      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newCost);
        const priority = newCost + hexDistance(next, goal);
        frontier.push(priority, next);
        cameFrom.set(nextKey, current);
      }
    }
  }

  if (!costSoFar.has(goalKey)) return null;

  const path: Hex[] = [];
  let currentKey = goalKey;
  let current: Hex | undefined = { ...goal };
  while (current !== undefined) {
    path.push(current);
    if (currentKey === startKey) break;
    current = cameFrom.get(currentKey);
    if (current === undefined) break;
    currentKey = hexKey(current);
  }
  path.reverse();
  return path;
}
