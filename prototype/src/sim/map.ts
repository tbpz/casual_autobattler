import { hex, hexKey, hexLine, type Hex } from "./hex";
import { isBlocking, isVisionBlocking, type MapDef, type Tile, type TileType } from "./types";

interface RawTileOverride {
  readonly col: number;
  readonly row: number;
  readonly type: string;
}

/** On-disk authoring format: a rectangle of default-open tiles plus sparse overrides. */
export interface RawMapDef {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly overrides: readonly RawTileOverride[];
}

const VALID_TILE_TYPES: readonly TileType[] = ["open", "wall", "highground", "cover"];

function toTileType(value: string, col: number, row: number): TileType {
  if ((VALID_TILE_TYPES as readonly string[]).includes(value)) return value as TileType;
  throw new Error(`Invalid tile type "${value}" at (${col}, ${row})`);
}

/** Converts "odd-r" offset coordinates (col, row) to axial (q, r). Exported so unit start positions can be authored in the same coordinate space as the map. */
export function offsetToAxial(col: number, row: number): Hex {
  const q = col - (row - (row & 1)) / 2;
  return hex(q, row);
}

export function parseMapDef(raw: RawMapDef): MapDef {
  const overrideByPos = new Map<string, TileType>();
  for (const o of raw.overrides) {
    overrideByPos.set(`${o.col},${o.row}`, toTileType(o.type, o.col, o.row));
  }

  const tiles: Tile[] = [];
  for (let row = 0; row < raw.height; row++) {
    for (let col = 0; col < raw.width; col++) {
      const h = offsetToAxial(col, row);
      const type = overrideByPos.get(`${col},${row}`) ?? "open";
      tiles.push({ hex: h, type });
    }
  }

  return { id: raw.id, name: raw.name, tiles };
}

/** Queryable view over a MapDef: bounds, passability, and line-of-sight checks. */
export class GameMap {
  readonly id: string;
  readonly name: string;
  private readonly tileByKey: Map<string, Tile>;

  constructor(def: MapDef) {
    this.id = def.id;
    this.name = def.name;
    this.tileByKey = new Map(def.tiles.map((t) => [hexKey(t.hex), t]));
  }

  tileAt(h: Hex): Tile | undefined {
    return this.tileByKey.get(hexKey(h));
  }

  isInBounds(h: Hex): boolean {
    return this.tileByKey.has(hexKey(h));
  }

  isPassable(h: Hex): boolean {
    const tile = this.tileAt(h);
    return tile !== undefined && !isBlocking(tile.type);
  }

  /** True if nothing blocks vision between a and b (endpoints themselves never block). */
  hasLineOfSight(a: Hex, b: Hex): boolean {
    const line = hexLine(a, b);
    for (let i = 1; i < line.length - 1; i++) {
      const tile = this.tileAt(line[i]);
      if (tile === undefined || isVisionBlocking(tile.type)) return false;
    }
    return true;
  }

  allTiles(): Tile[] {
    return [...this.tileByKey.values()];
  }
}

export function loadMap(raw: RawMapDef): GameMap {
  return new GameMap(parseMapDef(raw));
}
