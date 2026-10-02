/**
 * The one browser-touching piece of the export log — log/runLog.ts is pure.
 * A Blob and a throwaway anchor click is the no-dependency way to hand the
 * browser a file to save.
 */
import type { RunConfig } from "../sim/config.js";
import type { RunSession } from "../render/runSession.js";
import { buildRunLog } from "./runLog.js";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** run-<seed>-r<roundsPlayed>-<HHMM>.json — each click writes EVERY round
 * played so far, so a later file from the same run is a superset of an
 * earlier one and nothing is lost by only keeping the last download. */
function fileNameFor(session: RunSession): string {
  const now = new Date();
  return `run-${session.seed}-r${session.roundLogs.length}-${pad2(now.getHours())}${pad2(now.getMinutes())}.json`;
}

export function downloadRunLog(session: RunSession, cfg: RunConfig): void {
  const json = JSON.stringify(buildRunLog(session, cfg), null, 1);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFor(session);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
