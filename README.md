# Vert

Vert is a premium Next.js App Router streaming client with modular React components, API route proxies, HLS playback, watchlist/history persistence, PIN cloud sync, window controls, and mobile navigation.

## Setup

```bash
npm install
npm run dev
```

Set `TMDB_API_KEY` in your runtime environment. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to preserve PIN cloud sync across serverless instances; without those variables the development server uses a temporary in-memory lock.

The client-side API code expects `TMDB_API_KEY` to remain server-side. Do not set a public `NEXT_PUBLIC_*` value for it.

## Checks

```bash
npm run lint
npm run build
npm run test:e2e
npm test
```

`npm test` runs ESLint, a production Next.js build, and opaque-box Chromium tests.

## Native Shells

Desktop development uses Tauri and loads the Next.js dev server. Release shells are thin clients for a deployed Vert server:

```bash
VERT_APP_URL=https://your-vert-domain.example npm run tauri build
VERT_APP_URL=https://your-vert-domain.example npx cap add android
VERT_APP_URL=https://your-vert-domain.example npm run native:android
```

`VERT_APP_URL` is required for functional desktop release and Android packaging. Without it, a shell shows the offline notice. The production server that hosts the Next app must contain the same `TMDB_API_KEY` configuration.
