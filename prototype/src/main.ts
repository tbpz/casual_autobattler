import { mountApp } from "./render/app.js";
import { mountLab } from "./lab/labScreen.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app root element missing from index.html");
}

// ?lab=1 opens the lab (prototype/src/lab/) instead of the real game — a
// second door into the same sim (sim/fight.ts's runFight, unmodified) for
// hand-picking a matchup and watching it, optionally two at once. A no-op
// when absent, same convention as app.ts's own ?test=1/?seed=N.
if (new URLSearchParams(location.search).get("lab") === "1") {
  mountLab(root);
} else {
  mountApp(root);
}
