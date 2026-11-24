# Architecture decisions

## ADR-001 Keep Phaser for World 1; no second engine yet
The village already runs well on Phaser 3 (lazy chunk, cleaned up on unmount). New worlds pick their engine per world (`engine` in the registry). React-only worlds (quizzes, puzzles) need no engine; Three.js only if a world needs 3D, and only as its own lazy chunk.

## ADR-002 World registry lives in `@family-hub/core`
`packages/core/src/worlds.ts` is data only, validated with Zod at import time (unique id/slug, internal `entryRoute`, bundled thumbnail key, entry route required when `available`). Copy lives in i18n (`platform.world.<id>.*`). Web, mobile, and API can share it. No remote catalog and no user-supplied code: only bundled routes can launch.

## ADR-003 Platform shell over a separate app
The lobby is a route in the existing SPA (`apps/web/src/platform`), not a new app. Signed-in users keep the existing `Shell` (drawer, bottom tabs); signed-out visitors get a light header plus a phone tab bar. The lobby never imports Phaser: it reads the same `GameState` the game uses (`/game/state` for members, the guest store for guests) and renders SVG thumbnails.

## ADR-004 Feature flags are build-time env with a per-browser override
`apps/web/src/lib/flags.ts`: `VITE_FLAG_GAME_FIRST_HOME`, `VITE_FLAG_PLATFORM_NAVIGATION` (default on). `localStorage["fh.flags"]` overrides for QA. Rollback = set the env var to `0` and redeploy web; no API or DB change is involved.

## ADR-005 Contextual authentication via `?next=`
Login and registration stay where they are; entry points add `?next=<path>`. `safeNextPath` (core, tested) accepts only same-origin app paths, so it cannot be used as an open redirect. No new auth system.

## ADR-006 Game services stay server-authoritative
Game modules talk to a `GameBackend` adapter; they never write balances. Rewards go through `game_ledger` with unique source keys (idempotent). This remains the contract for future worlds (see `MIGRATION_PLAN.md`, Release 3 SDK).

## ADR-007 Guest progress stays local and is not migrated in Release 1
Guest data lives in `localStorage` only and the UI says so. Migration (Release 2) will need a server-side preview + atomic import that reuses ledger source keys to prevent duplicate rewards.
