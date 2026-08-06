# Project: VERT App Next.js App Router Migration

## Architecture
- Framework: Next.js 15+ App Router (`app/` directory) with TypeScript.
- Styling: Global CSS (`app/globals.css`) merging `style.css` and `patch.css`, using CSS custom variables for themes and mobile safe areas.
- Component Architecture: Modular React components (`components/`) with TypeScript interfaces.
- State Management: React Context (`context/`) for global state (active page, current player source, watch list, watch history, modal state, audio settings).
- API Architecture: Next.js App Router Route Handlers (`app/api/.../route.ts`).
- Video Player: Iframe wrappers for VidEasy and VidKing, custom client component with HLS.js for Vyla player.
- User Rules: Write code in normal case (e.g. `hellohi`, `youhi`), no comments, short & readable variable/function names.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Next.js & TS Base Setup | `package.json`, `tsconfig.json`, `next.config.js`, dependencies (next, react, hls.js, howler, lucide-react) | M1 | survey |
| 2 | Theme & Global Layout | `app/globals.css`, font setup, root layout (`app/layout.tsx`), safe area vars, loader screen | M1 | survey |
| 3 | Window Controls & Titlebar | Electron drag region & min/max/close controls | M2 | survey |
| 4 | Navbar & Navigation | Logo, nav links, mobile drawer, mobile bottom nav, account dropdown | M2 | survey |
| 5 | Search & Genre Filter | Live search dropdown, full search grid, category genre dropdown, infinite scroll | M2 | survey |
| 6 | Hero Banner & Category Rows | Hero showcase banner, dynamic content rows, "Tiếp tục xem" continue row, My List view | M2 | survey |
| 7 | Detail Modal Overlay | Detail modal, metadata, cast, season picker, episode cards, similar items, watchlist toggle | M2 | survey |
| 8 | Multi-Source Video Player | VidEasy embed, VidKing embed, Vyla HLS player component, controls, sources/quality, episode switching | M3 | survey |
| 9 | Audio Effects & Spatial Panning | Audio settings panel, web audio synth UI sounds, 3D pointermove stereo panning | M3 | survey |
| 10 | API Route Handlers | Next.js route handlers for `/api/tmdb`, `/api/sync`, `/api/vyla-auth`, `/api/vyla-proxy`, `/api/vyla-sub` | M4 | survey |
| 11 | PIN Cloud Sync System | Export/Import watch state via PIN code with Redis `/api/sync` integration | M4 | survey |
| 12 | Legacy File Cleanup & Build | Remove redundant static files (`index.html`, `vyla-player.html`, `script.js`, `patch.js`, `style.css`, `patch.css`, `test-vyla.js`), verify `npm run build` & `npm run dev` | M5 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Next.js Base Setup & Layout | `package.json`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css` | none | IN_PROGRESS |
| M2 | UI Components & Page Views | `components/` (Navbar, Hero, Rows, Cards, Search, DetailModal, MyList, Titlebar), `app/page.tsx`, state context | M1 | PLANNED |
| M3 | Video Player & Audio Engine | `components/player/` (VylaHlsPlayer, PlayerOverlay, AudioPanel), sound synth, HLS integration | M1, M2 | PLANNED |
| M4 | API Proxy Routes & Sync | `app/api/tmdb/route.ts`, `app/api/sync/route.ts`, `app/api/vyla-auth/route.ts`, `app/api/vyla-proxy/route.ts`, `app/api/vyla-sub/route.ts`, sync modal | M1 | PLANNED |
| M5 | Legacy Cleanup & Build Gate | Delete legacy static files, verify `npm run build` and `npm run dev` pass with 0 errors | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### API Route Handlers
- `GET /api/tmdb?endpoint=<path>&...`: Proxies TMDB requests with server key.
- `POST /api/sync`: Actions `export` (generates PIN) and `import` (fetches payload by PIN).
- `GET /api/vyla-auth`: Returns Vyla authentication token.
- `GET /api/vyla-proxy?url=<m3u8>`: Rewrites M3U8 HLS playlists with session token and proxy URLs.
- `GET /api/vyla-sub?url=<vtt>`: Proxies subtitle VTT files with CORS headers.

### React State Context (`context/appcontext.tsx`)
- `currentpage`: string ('home', 'movies', 'tv', 'mylist', 'filter', 'search')
- `playersource`: 'videasy' | 'vidking' | 'vyla'
- `mylist`: MediaItem[]
- `history`: WatchHistoryItem[]
- `audiosettings`: AudioSettingsObj
- `detailitem`: MediaItem | null
- `activeplayer`: PlayerConfig | null

## Code Layout
```
C:\Users\nguye\Vert\
├── app/
│   ├── api/
│   │   ├── tmdb/route.ts
│   │   ├── sync/route.ts
│   │   ├── vyla-auth/route.ts
│   │   ├── vyla-proxy/route.ts
│   │   └── vyla-sub/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── navbar.tsx
│   ├── titlebar.tsx
│   ├── herobanner.tsx
│   ├── contentrow.tsx
│   ├── mediacard.tsx
│   ├── searchview.tsx
│   ├── detailmodal.tsx
│   ├── syncmodal.tsx
│   └── player/
│       ├── playeroverlay.tsx
│       ├── vylaplayer.tsx
│       └── audiopanel.tsx
├── context/
│   └── appcontext.tsx
├── lib/
│   ├── tmdb.ts
│   ├── audio.ts
│   └── types.ts
├── package.json
├── tsconfig.json
└── next.config.js
```
