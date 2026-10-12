# Project Engineering Rules

Family Hub is a routine, reward, and calendar tracker for kids. It is a pnpm workspace (Node 20+, pnpm 9, Turborepo).

## Stack

- `apps/api` — NestJS, Prisma, PostgreSQL. Global prefix `/api`. Swagger at `/docs`.
- `apps/web` — Vite, React, TypeScript, React Router, React Query, i18next.
- `apps/mobile` — Expo, React Native.
- `packages/core` (`@family-hub/core`) — shared Zod schemas, date/recurrence/star/reward logic, and translations.
- Database: Postgres. Local via Docker (`pnpm db:up`). Production is Neon.
- Hosting: API on Render, web on Vercel. There is no GCP.

## Layout and conventions

- One Nest module per feature under `apps/api/src` (`auth`, `members`, `tasks`, `rewards`, `redemptions`, `events`, `star-balance`, and so on). Controllers use `JwtAuthGuard`, `resolveFamilyScope`, and `requireParent`.
- Every family-owned row has `family_id`. Non-members get 403. Parent-only writes (members, rewards, redemption decisions, star adjustments) go through `requireParent`.
- Star balance is computed in `apps/api/src/star-balance/compute.ts` (`earned + adjusted - spent`, pending redemptions count as spent). Do not store a balance column.
- Redemption rules live in `RedemptionsService`: reward must be active, balance must cover `star_cost`, and `max_per_week` is counted in the family timezone, Monday-start. A decision is terminal.
- API JSON and Zod schemas in `packages/core/src/schemas.ts` use snake_case. Prisma models use camelCase fields with `@map` to snake_case columns.
- `packages/core/src/index.ts` is a barrel. `Locale` is exported only from `i18n` (`en` | `zh` | `vi`). The weekday helper `isoWeekday` is the function in `dates.ts`; the Zod weekday schema in `schemas.ts` stays private. Do not `export *` a second symbol with either name.
- User-facing copy lives in `packages/core/src/i18n/{en,zh,vi}.json`. Add a key to all three files. Web loads them through `apps/web/src/i18n.ts` (`fh.lang` in localStorage).
- Web talks to the API with `VITE_API_URL` (default `http://localhost:3001/api`). That value is inlined at build time. Mobile reads `extra.apiUrl` in `apps/mobile/app.json`.
- Secrets stay in `apps/api/.env` (see `.env.example`). Do not commit `.env` or paste live keys into docs.

## Development

- Follow the existing module, page, and screen layout. Reuse `@family-hub/core` instead of duplicating schemas or star math.
- Prefer minimal, targeted changes. Do not rewrite unrelated code or add dependencies for something the repo already does.
- Local API: `pnpm dev:api` (port 3001). Web: `pnpm dev:web` (port 5173). Mobile: `pnpm dev:mobile`.
- After a schema change: `pnpm prisma:generate`, then `pnpm prisma:migrate` locally. Production applies migrations with `pnpm --filter @family-hub/api prisma:deploy`.
- Render builds from the repo root, not `apps/api`, because the lockfile is at the root: `pnpm install --frozen-lockfile && pnpm --filter @family-hub/api prisma:generate && pnpm --filter @family-hub/api build && pnpm --filter @family-hub/api prisma:deploy`. Start with `node apps/api/dist/main.js`. Do not use the root `pnpm build` (Turbo builds the web app too and skips Prisma generate).
- Vercel root directory is `apps/web`. Install, build, and output are locked by `apps/web/vercel.json`. Production `VITE_API_URL` must be `https://<render-host>/api`. After the web URL changes, set Render `CORS_ORIGIN` and `WEB_BASE_URL` to that origin with no trailing slash.

## Token efficiency

- Inspect only files relevant to the task.
- Do not scan the entire repository by default.
- Avoid verbose explanations.
- Do not print entire files or long command outputs.
- Report only changed files, test results, and blockers.

## Validation

- Run the narrowest check that covers the change.
- Shared logic: `pnpm --filter @family-hub/core test`.
- Web or API types: `pnpm --filter @family-hub/web exec tsc --noEmit` or `pnpm --filter @family-hub/api typecheck`.
- Fix only errors caused by the change. Do not run the full Turbo suite unless the change crosses packages.
