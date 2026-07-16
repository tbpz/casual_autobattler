import { hexEquals } from "../sim/hex";
import { loadMap } from "../sim/map";
import encounter1MapRaw from "../maps/encounter-1-overlook.json";
import legacyMapRaw from "../maps/test-map-1.json";
import type { RawMapDef } from "../sim/map";
import { axialToPixel, pixelToAxial } from "../render/hexLayout";

/**
 * Guards the setup-screen drag/drop math: `axialToPixel` -> `pixelToAxial` must return the
 * original hex for every tile on the maps we actually ship, since a broken round-trip would
 * silently snap drags onto the wrong hex.
 */

const failures: string[] = [];

for (const raw of [encounter1MapRaw, legacyMapRaw] as RawMapDef[]) {
  const map = loadMap(raw);
  for (const tile of map.allTiles()) {
    const pixel = axialToPixel(tile.hex);
    const roundTripped = pixelToAxial(pixel);
    if (!hexEquals(tile.hex, roundTripped)) {
      failures.push(
        `${raw.id}: hex (${tile.hex.q},${tile.hex.r}) -> pixel (${pixel.x.toFixed(1)},${pixel.y.toFixed(1)}) -> (${roundTripped.q},${roundTripped.r})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`PIXEL ROUND-TRIP CHECK FAILED (${failures.length}):`);
  for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
  process.exitCode = 1;
} else {
  console.log("pixel round-trip check: PASS — axialToPixel -> pixelToAxial recovers every tile exactly.");
}
