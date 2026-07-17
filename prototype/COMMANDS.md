# Commands

## Run the prototype locally

```
cd prototype
npm run dev
```

Starts the local dev server. Open the printed URL (e.g. `http://localhost:5173`) in a browser. Ctrl+C to stop.

Note: on Windows PowerShell (5.1), `&&` is not a valid statement separator — run the two lines separately (or use `;`), not `cd prototype && npm run dev`.

Note: if PowerShell blocks `npm run dev` with `UnauthorizedAccess ... running scripts is disabled on this system`, that's the execution policy blocking `npm.ps1`. Either run `npm.cmd run dev` instead, or fix it permanently with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
