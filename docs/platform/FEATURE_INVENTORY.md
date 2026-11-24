# Feature inventory (2026-11-24)

Legend: **Verified** = exercised end to end in this audit (browser against local API/DB or automated test). **Unverified** = code present, not exercised here. **Partial**, **Missing**, **Risk** as named.

## Family features

| Feature | Status | Evidence |
| --- | --- | --- |
| Register family + parent, login, logout | Verified | Browser: `/register?next=/play`, logout, `/login?next=/family` (local API). `apps/api/src/auth` |
| Password reset by email | Unverified | `auth` `forgot-password` / `reset-password`, `mail` module |
| Members (parent / child, login-less kids) | Unverified | `members` module, `pages/Members.tsx` |
| Tasks with recurrence, time of day | Unverified | `tasks` module, `core/recurrence.ts` (unit tested) |
| Task completion awards stars | Unverified | `task-completions` module; stars computed in `star-balance/compute.ts` |
| Star balance / adjustments | Unverified (logic tested in core) | `star-balance`, `star-adjustments`, `core/stars.ts` tests |
| Rewards + redemption requests, parent decision (terminal) | Unverified | `rewards`, `redemptions` (`max_per_week` in family timezone) |
| Calendar events with attendees | Unverified | `events` module, `pages/Events.tsx` |
| Family dashboard | Verified (renders, empty family) | `/family` in browser |
| Parent approval of task completion | Missing | Any member can mark a task done (documented in `docs/ADVENTURE_GAME.md`) |
| Achievements (family features) | Missing | No model or endpoint |
| Mobile app (Expo) | Unverified | `apps/mobile/src/screens/*`; no game |
| i18n en / zh / vi | Verified (en in browser) | `packages/core/src/i18n` |

## Game features

| Feature | Status | Evidence |
| --- | --- | --- |
| Village world: movement (keys, tap A*), collisions, NPCs | Verified | Browser, guest mode, 2026-11-24 |
| HUD, quest tracker, minimap, coach, chest animation | Verified | Browser, guest mode |
| Quests: accept / claim, idempotent rewards | Verified (guest), Unverified (server) | `game.service.ts`, `game.test.ts` (11 tests pass) |
| Daily chest | Verified (guest) | Browser |
| Memory mini-game (server replay validation) | Partial verification | Started and left a level; win path not played. Server rules in `memory.ts` |
| Avatar customization | Verified (opens via `/play?open=avatar`) | Browser |
| Guest mode (local only, no API calls) | Verified | `guest.ts`; `/play` signed out |
| Signed-in play | Verified (loads, HUD, new parent) | Browser after registration |
| Real tasks as quests | Unverified | `quests.ts` activity quests |
| Inventory / spending coins & materials | Missing | Resources are earned only |
| Adventure Forest content | Missing | Gate unlocks at level 3; no content |
| Guest → account progress migration | Missing | Documented limitation |
| Leaderboards | Missing | — |

## Platform (Release 1)

| Feature | Status | Evidence |
| --- | --- | --- |
| Game-first lobby at `/` (guest + member) | Verified | Browser desktop 1280 / phone 400 widths |
| World registry with validation | Verified | `packages/core/src/worlds.ts`, `worlds.test.ts` |
| Discover catalog (`/discover`), category filter | Verified | Browser |
| Contextual auth `?next=` with open-redirect guard | Verified | Browser + `redirect.test.ts` |
| Feature flags + rollback | Verified | `fh.flags` override restored the old dashboard |
| Old marketing page | Verified | `/welcome` |

## Technical risks

| Risk | Detail |
| --- | --- |
| No rate limiting on the API | No throttler in `apps/api`. Login and game endpoints are unthrottled. |
| No CI | No workflow runs typecheck/tests on push; Vercel and Render only build. |
| Tokens in web storage | Access/refresh JWT in `localStorage`/`sessionStorage` (XSS exposure). |
| Web has no automated UI tests | Only core and API have test suites. |
| Phaser chunk size | ~364 KB gzip, loaded only on `/play`. |
