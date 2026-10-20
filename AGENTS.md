# Repository Guidelines

## Project Structure & Module Organization

Vert is a Next.js 15 App Router streaming app. Page/render code lives in `app/`; API handlers follow `app/api/<feature>/route.ts`. Reusable UI is in `components/`, with player components under `components/player/`. Put shared media types and helpers in `lib/`, global state in `context/appcontext.tsx`, and static assets in `public/`. Desktop/Rust packaging lives in `src-tauri/`. Place Playwright/Node E2E tests in `tests/e2e/`.

## Build, Test, and Development Commands

- `npm install` — install dependencies.
- `npm run dev` — start the local Next.js server.
- `npm run build` — produce a production Next.js build; this is the required local gate.
- `npm run lint` — run ESLint through Next.js.
- `npm start` — serve an existing production build.
- `npx tauri build` — package the desktop app.
- `npx cap sync android` — sync web assets into the Android Capacitor workload.

## Coding Style & Naming Conventions

Use TypeScript strict mode, 2-space indentation, single quotes, semicolons, and the `@/*` path alias for imports. Prefer lowercase concatenated identifiers such as `currentpage` or `playersource`, and short readable function/variable names. Do not add comments. Name React components descriptively, such as `mediacard.tsx`.

## Testing Guidelines

There is currently no unit-test suite. Run `npm run lint` and `npm run build` before submitting changes. When adding automated tests, follow the opaque-box E2E structure documented in `TEST_INFRA.md` and put scripts under `tests/e2e/`. Cover API contracts, navigation, search, detail modals, and player behavior.

## Commit & Pull Request Guidelines

Use short imperative subjects, commonly prefixed with `fix:`, `feat:`, or similar. Keep commits focused; PRs should include a behavioral description, linked issues, verification results, and screenshots for visible UI changes.

## Security & Configuration Tips

Never commit API keys, generated environment files, or local build artifacts. Add third-party secrets through deployment environment configuration rather than source.
