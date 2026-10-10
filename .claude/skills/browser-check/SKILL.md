---
name: browser-check
description: How to take a screenshot, check layout at phone size, or click through a page like a player, without launching Chrome. Use for design canvas frames, the prototype in a browser, or any UI check. The ban on launching Chrome itself lives in CLAUDE.md and still applies.
---

# Checking UI in a browser

Launching the installed Google Chrome, or agent-browser's "Chrome for Testing", is banned — see CLAUDE.md for why. Use one of the two routes below.

## Screenshots and layout checks

Use Playwright's headless shell. No company policy targets it, and it cannot load extensions:

`%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-<number>\chrome-headless-shell-win64\chrome-headless-shell.exe --user-data-dir=<scratchpad>\prof --window-size=390,1000 --screenshot=<scratchpad>\out.png <file:/// or http://localhost URL>`

- The folder number differs per laptop and changes when Playwright updates (1248 on the company laptop, 1243 on the ASUS one). Look under `%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-*`.
- If there is none, ask before installing with `npx playwright install chromium-headless-shell`.

## Pages that need a login, or a click-through like a real player

Use the Claude in Chrome tools if the session has them. They drive Tu's real, signed-in Chrome. If the session doesn't have them, say so and ask — never fall back to launching Chrome yourself.

## Which laptop am I on

You are on the company laptop only if the user folder is `C:\Users\tu.vu`. Check `$env:USERNAME` or the home folder if unsure. On any other device, use Claude in Chrome.
