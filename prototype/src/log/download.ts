/**
 * The one browser-touching piece of the export-log feature — everything
 * else (log/decided.ts, log/runLog.ts) is pure and shared with the offline
 * reader (tools/readLog.ts). Blob + a throwaway anchor click is the standard
 * no-dependency way to hand the browser a file to save; nothing else in this
 * project has ever written a file before this.
 */
import type { RunConfig } from "../sim/config.js";
import type { RunSession } from "../render/runSession.js";
import { buildRunLog } from "./runLog.js";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** run-<seed>-r<roundsPlayed>-<HHMM>.json — each click writes EVERY round
 * played so far, not just the latest one (log/runLog.ts's rounds array), so
 * a later file from the same run is a superset of an earlier one and
 * nothing is lost by only keeping the last download. */
function fileNameFor(session: RunSession): string {
  const now = new Date();
  const hhmm = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return `run-${session.seed}-r${session.roundLogs.length}-${hhmm}.json`;
}

export function downloadRunLog(session: RunSession, cfg: RunConfig): void {
  const log = buildRunLog(session, cfg);
  const json = JSON.stringify(log, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFor(session);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
