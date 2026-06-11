# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
**Vert** is an open-source movie/TV streaming web app (Vietnamese UI). The core product is a **static web app** at the repo root: `index.html`, `script.js`, `style.css`. It pulls metadata from the TMDB API and embeds third-party video players. `src-tauri/` (Tauri desktop) and `capacitor.config.json` (Capacitor Android) are native wrappers around the same static assets, and `api/` holds Vercel serverless functions used only in production.

### Running the web app (primary dev flow)
There is **no build step** for the web app — serve the repo root with any static HTTP server, e.g.:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

- Non-obvious: `script.js` sets `IS_LOCAL` true for `localhost`/`127.0.0.1`/LAN/Tauri/Capacitor. When local, it calls the **TMDB API directly using a hardcoded API key**, so the homepage, search, and detail views work with **no secrets and no backend**. Verify connectivity with `curl https://api.themoviedb.org/3/trending/all/week?api_key=...`.
- The `/api/tmdb` and `/api/sync` serverless functions (and the secrets `TMDB_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are **only used in the deployed Vercel build**, not for local development.

### Tests / lint / build
- There are **no automated tests and no lint config** in this repo (don't expect `npm test`/`npm run lint`).
- `package.json` scripts only cover the native wrappers: `tauri` and `build:android`.
- Native builds (Tauri desktop, Capacitor Android) require copying the web assets into a `www/` dir first (see `.github/workflows/build-apps.yml`, which is the source of truth for those builds) and need heavy system/SDK dependencies + a display. They are not needed to develop or verify the web app.
