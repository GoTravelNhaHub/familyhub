# Family Adventure World (Phase 1)

A playable village at `/play` (nav: **Adventure**) layered on the existing app. Tasks, stars, rewards, redemptions, and the dashboard are unchanged; the dashboard stays the parent view.

## Feature mapping

| Existing feature | In the game |
| --- | --- |
| Tasks due today (per assignee, family timezone) | Narrative quests on the Quest Board, themed by icon/title (reading → "Ancient Book of Knowledge") |
| Task completion (`POST /task-completions`) | The only way a task quest completes; "I did it!" calls that same endpoint, so stars are still awarded as before |
| Members (name, color, role) | Avatars, houses in the village, "Who is playing?" picker |
| Star balance / rewards / redemptions | Untouched; game resources are separate and never convert to stars |

## Architecture

- **API** `apps/api/src/game/` (Nest module, `JwtAuthGuard` + `resolveFamilyScope`).
  - `progression.ts` level curve, zone unlocks. `quests.ts` data-driven quest definitions. `memory.ts` deal/replay/score. `avatar.ts` versioned avatar schema (Zod).
  - Player resolution: a signed-in user plays as themselves. A parent may play as any member of their family, since kids are usually login-less profiles. A child may only play as themselves.
- **DB** (migration `20261123083323_adventure_game`, additive only): `game_profiles` (avatar JSON), `game_quest_progress`, `game_ledger`, `minigame_sessions`.
  - Resources (XP, coins, crystals, materials) are **summed from `game_ledger`**, never stored as a balance. `UNIQUE(member_id, source_key)` makes every grant idempotent: `quest:<key>:<period>`, `daily:<date>`, `minigame:memory:<date>:L<n>`.
  - Quest lifecycle: available → active (row) → completed (computed from the objective) → rewarded (claim flips the row and writes the ledger in one transaction). Daily quests are keyed by the family-local date, so old rows expire.
  - Memory game: the server deals the deck, then replays the client's flip sequence. It rejects forged or too-fast runs, and rewards once per level per day (later wins count as practice).
- **Web** `apps/web/src/game/`
  - `pages/Play.tsx` is lazy-loaded, so Phaser (~360 KB gzip) loads only on `/play`.
  - `GameCanvas.tsx` creates one `Phaser.Game` per mount and destroys it on unmount. It renders at device pixel ratio (capped at 2).
  - `scenes/VillageScene.ts`: arcade physics collisions, y-depth sorting, camera follow, keyboard (WASD/arrows, E) and tap-to-move with A* (`pathfinding.ts`), NPCs, quest markers, day/night tint, ambient particles. `scenes/MemoryScene.ts`: the mini-game.
  - `bridge.ts`: a typed event channel. Phaser renders; React owns data, dialogue, and API calls.
  - `ui/Hud.tsx`: viewport-anchored HUD (player card, animated XP, objective tracker, menu, SVG minimap, first-run coach). `pickObjective` chooses the tracked quest; the scene draws its beacon and off-screen arrow (`track` event). The tracker's Go button and minimap taps use `walkTo`.
  - `world.ts`: the data-driven layout. `art.ts`/`avatar.ts`: all art is original and drawn on canvas at runtime (no external assets).
  - `prefers-reduced-motion` disables tweens, particles, and fades.
- Copy: `game.*` keys in `packages/core/src/i18n/{en,zh,vi}.json`.

## Learning Academy

`/academy` (`apps/web/src/academy`) is the second world. It shares the player, resources, memory rules, and sessions with the village (a win in either place counts for the "Scattered Crystals" quest). Badges are defined in `apps/api/src/game/achievements.ts` (authoritative) and mirrored in `packages/core/src/achievements.ts` for guests.

## Guest mode

Signed-out visitors can open `/play` (or click "Play as guest" on the landing page). The same `GameSession` UI runs on a local engine (`apps/web/src/game/guest.ts`) instead of the API:

- Progress is kept in `localStorage` (`fh.guest.v1`) on that device only. The guest flow makes no API calls and creates no database rows, so it adds no anonymous write surface to the API.
- Guests get the village, NPCs, story and daily quests, the daily chest, avatars, and the memory game. Real-task quests need a family account; the board explains this and links to sign-up.
- The level curve, quests, and memory rules are copied from `apps/api/src/game`; keep both in step. Guest progress is not carried over on sign-up.

## Local setup

```
pnpm install
pnpm prisma:generate && pnpm prisma:migrate   # applies the adventure_game migration
pnpm dev:api && pnpm dev:web                  # open http://localhost:5173/play
pnpm --filter @family-hub/api test            # game logic unit tests
```

## Deployment

- Render: the existing build command already runs `prisma:deploy`, which applies the new migration. The migration only creates tables.
- Vercel: no config change. `phaser` is a new web dependency, and the lockfile is updated.

## Known limitations

- There is no task-approval workflow in the app today. Any family member can mark a task done (same as the Tasks page), and the game does not add a bypass on top of that.
- The memory deck is sent to the client. Server replay and the daily per-level cap bound what a determined cheater can gain.
- The Adventure Forest gate unlocks at level 3, but the forest has no content yet. The Family Home zone is not built.

## Roadmap

- **Phase 2:** inventory and spending coins/materials (shop, decorations), collectibles and hidden objects in the forest, Master Builder NPC, home decoration, family level unlocks, parent controls for game settings.
- **Phase 3:** more mini-games (math, word, logic), story chapters, crafting, cooperative family quests, more avatar slots and emotes, optional AI dialogue (server-side, moderated, rate-limited).
- **Phase 4:** evaluate 3D (home or avatar preview) only once the 2D loop is stable.
