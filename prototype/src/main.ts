import { mountApp } from "./render/app.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app root element missing from index.html");
}
mountApp(root);
