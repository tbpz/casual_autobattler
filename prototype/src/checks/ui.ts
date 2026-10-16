/**
 * The logic behind the new screens that needs no DOM (DECISIONS.md 2026-10-16). Run with `npm run check:ui`.
 *
 *  - PauseClock: a pause holds every timer and freezes now(); a resume gives each its remaining time back.
 *  - termifyText: the term words of a plain sentence become tappable, nothing else does.
 *  - bestMoment: the longest skill run of a fight, and none for a fight with no repeat.
 *  - the skill bubble: its closed outline from the arrow tip, and the text of each state (first use, count, bright glow, MAX, backfire, stopped, no repeat).
 */
import { DEFAULT_RUN_CONFIG } from "../sim/config.js";
import { runFight } from "../sim/fight.js";
import { Rng } from "../sim/rng.js";
import { makeEnemySide } from "../sim/run.js";
import { makeSquadFromRoles } from "../sim/roles.js";
import { PauseClock } from "../render/pauseClock.js";
import { termifyText } from "../render/terms.js";
import { bestMoment } from "../render/fightSummary.js";
import { BUBBLE_H, BUBBLE_TAIL, BUBBLE_TAIL_MAX_DX, BUBBLE_W, bubblePath, bubbleText, clampTailDx } from "../render/bubble.js";

let failed = false;
function check(name: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failed = true;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- the pause clock
{
  const clock = new PauseClock();
  let fired = 0;
  clock.setTimeout(() => fired++, 120);
  await sleep(40);
  clock.pause();
  const frozen = clock.now();
  await sleep(250);
  check("pause: the timer does not fire while paused", fired === 0);
  check("pause: now() stands still while paused", clock.now() === frozen);
  clock.resume();
  check("resume: now() carries on from where it stopped", Math.abs(clock.now() - frozen) < 30, `${Math.round(clock.now() - frozen)}ms apart`);
  await sleep(60);
  check("resume: the timer has not fired early (about 80ms were left)", fired === 0);
  await sleep(120);
  check("resume: the timer fires once its remaining time has passed", fired === 1);

  let cleared = 0;
  const id = clock.setTimeout(() => cleared++, 30);
  clock.pause();
  clock.clearTimeout(id);
  clock.resume();
  await sleep(80);
  check("clearTimeout: a cleared timer never fires, even across a pause", cleared === 0);

  let made = 0;
  clock.pause();
  clock.setTimeout(() => made++, 20);
  await sleep(60);
  check("a timer made while paused waits for the resume", made === 0);
  clock.resume();
  await sleep(60);
  check("...and then fires", made === 1);
}

// --- tappable terms in a plain sentence
{
  const out = termifyText("Its slam goes for your weakest unit, and small hits expose it.");
  check("terms: slam becomes a tappable term", /<span class="term tap" data-term="slam">slam<\/span>/.test(out));
  check("terms: an ordinary word is left alone", out.includes("weakest unit") && !out.includes('data-term="weakest"'));
  check("terms: the same text with taps off carries no data-term", !termifyText("A slam.", false).includes("data-term"));
}

// --- the best moment of a fight
{
  const cfg = DEFAULT_RUN_CONFIG;
  let withMoment = 0;
  let sane = true;
  for (let seed = 1; seed <= 12; seed++) {
    const result = runFight({ player: makeSquadFromRoles(["tank", "damage", "support"]), enemy: makeEnemySide(cfg, 3, 0) }, cfg.fight, new Rng(seed), seed);
    const m = bestMoment(result);
    if (!m) continue;
    withMoment++;
    const longest = Math.max(...result.events.flatMap((e) => (e.type === "chainEnd" ? [e.chainLength] : [])));
    if (m.hits !== longest || m.hits < 2 || !m.skill || m.name.length === 0) sane = false;
  }
  check("best moment: most fights have one", withMoment >= 6, `${withMoment} of 12`);
  check("best moment: it is the longest run, at least two hits, with a skill and a name", sane);
}

// --- the skill bubble: its outline and what it says
{
  const d = bubblePath();
  check("bubble: the outline starts at the arrow tip, below the box", d.startsWith(`M${BUBBLE_W / 2},${BUBBLE_H + BUBBLE_TAIL} `), d.slice(0, 24));
  check("bubble: the outline is closed", d.endsWith("Z") && (d.match(/Z/g) ?? []).length === 1);
  check("bubble: the arrow slides along the bottom edge", bubblePath(10).startsWith(`M${BUBBLE_W / 2 + 10},`));
  check("bubble: the arrow stays clear of the corners", clampTailDx(500) === BUBBLE_TAIL_MAX_DX && clampTailDx(-500) === -BUBBLE_TAIL_MAX_DX && bubblePath(500).startsWith(`M${BUBBLE_W / 2 + BUBBLE_TAIL_MAX_DX},`));

  const first = bubbleText("live", 0, "EXPOSE", 5, 7);
  check("bubble text: the first use is the skill alone", first.name === "EXPOSE" && first.count === "" && !first.big && !first.max);
  check("bubble text: the count appears from the second hit", bubbleText("live", 1, "EXPOSE", 5, 7).count === "" && bubbleText("live", 2, "EXPOSE", 5, 7).count === "×2");
  check("bubble text: the glow brightens from the full-tell hit", !bubbleText("live", 4, "EXPOSE", 5, 7).big && bubbleText("live", 5, "EXPOSE", 5, 7).big);
  const max = bubbleText("live", 7, "EXPOSE", 5, 7);
  check("bubble text: the cap reads MAX with its count", max.name === "MAX" && max.count === "×7" && max.max);
  const back = bubbleText("backfire", 3, "EXPOSE", 5, 7);
  check("bubble text: a backfire says BACKFIRE in red", back.name === "BACKFIRE" && back.count === "×3" && back.backfire && !back.muted);
  const stopped = bubbleText("stopped", 3, "EXPOSE", 5, 7);
  check("bubble text: a skill that stopped says STOPPED with its count, in grey", stopped.name === "STOPPED" && stopped.count === "×3" && stopped.muted);
  const none = bubbleText("noRepeat", 1, "EXPOSE", 5, 7);
  check("bubble text: a skill that never repeated says NO REPEAT, in grey", none.name === "NO REPEAT" && none.count === "" && none.muted);
}

if (failed) {
  console.log("ui check FAILED");
  process.exit(1);
}
console.log("ui check passed");
