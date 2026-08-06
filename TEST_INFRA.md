# E2E Test Infra: VERT Next.js Migration

## Test Philosophy
- Opaque-box, requirement-driven end-to-end testing for Next.js App Router migration.
- Verification mechanism: Playwright / Node script testing `npm run build`, `npm run dev`, API endpoints, rendering, and player mechanics.

## Feature Inventory & Test Coverage Goals
| # | Feature | Source (requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross) |
|---|---------|---------------------|:----------------:|:-----------------:|:--------------:|
| 1 | App Setup & Build | R1, R3 | 5 | 5 | ✓ |
| 2 | Navbar & Browsing | R1, R2 | 5 | 5 | ✓ |
| 3 | Search & Filters | R1, R2 | 5 | 5 | ✓ |
| 4 | Detail Modal | R1, R2 | 5 | 5 | ✓ |
| 5 | Video Player | R1, R2 | 5 | 5 | ✓ |
| 6 | API Route Handlers | R1, R2 | 5 | 5 | ✓ |
| 7 | Legacy File Cleanup | R2 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Node / Playwright test harness
- Location: `tests/e2e/`
