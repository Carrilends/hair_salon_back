# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the **backend** of the thesis project *Portal web de la Peluquería Marlene*. The monorepo-wide context (architecture overview, thesis rules, frontend/backend contracts, the `tesis-marlene` skill requirement) lives in `../CLAUDE.md` — read it first if you have not.

## Commands

```bash
npm run start:dev        # nest start --watch (default port 3000)
npm run start:prod       # node dist/main (after npm run build)
npm run build            # nest build
npm run lint             # eslint --fix on {src,apps,libs,test}/**/*.ts
npm run format           # prettier write on src + test
npm run test             # jest (rootDir = src, *.spec.ts colocated with code)
npm run test:cov
npm run test:e2e         # jest --config ./test/jest-e2e.json
npx jest path/to/file.spec.ts      # single test file
npx jest -t "name fragment"        # single test by name
```

Docker (full stack with Postgres) — see `DEPLOYMENT.md`:

```bash
docker compose up -d --build
docker compose logs -f api
curl -s http://localhost:${API_PUBLIC_PORT:-3001}/api/health
```

Inside Compose the API is forced onto `DB_HOST=db` / `DB_PORT=5432` and runs with `NODE_ENV=production`. `DB_PUBLIC_PORT` (default `3334`) exposes Postgres to the host. `.env` is required (copy `.env.example`).

## Global runtime contract (`src/main.ts`)

- Global prefix **`/api`** for every controller. `HealthController` → `GET /api/health`.
- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — every DTO field must be decorated or it is stripped, and unknown fields return 400.
- `class-validator` is wired to Nest's DI (`useContainer(...)`), so custom validators may `@Inject` services/repositories.
- Listens on `0.0.0.0:${PORT ?? 3000}`. CORS origin comes from `FRONT_URL` (comma-separated list); falls back to `true` (reflect request origin) only when unset — don't leave `FRONT_URL` empty in production.

## Module wiring (`src/app.module.ts`)

- `TypeOrmModule.forRootAsync` reads env at boot. `autoLoadEntities: true` — register entities in their owning module via `TypeOrmModule.forFeature([...])`, never centrally.
- `synchronize` and `logging` default to `!isProd`; override explicitly with `TYPEORM_SYNCHRONIZE` / `TYPEORM_LOGGING` (parsed by `parseBool`, accepts `1/true/yes/y/on` etc.). `DB_SSL=true` enables `{ rejectUnauthorized: false }`.
- `ScheduleModule.forRoot()` is loaded globally — `@Cron(...)` from `@nestjs/schedule` works in any provider (used by reservations cleanup).
- Feature modules: `service`, `type`, `detail`, `plannes`, `tags`, `images`, `files`, `cloudinary`, `workers`, `reservations`, `reviews`, `faqs`, `shared` (shared-info), `auth`, `common`.

## Cross-cutting conventions

- **Auth**: use `@Auth(...roles)` from `src/auth/decorators/auth.decorator.ts` to protect routes. It composes `RoleProtected` metadata, Passport's JWT `AuthGuard`, and `UserRoleGuard`. Roles come from `src/auth/interfaces/valid-roles`. `@GetUser()` injects the authenticated user. Backend issues JWTs; frontend persists them via `auth-store` + `auth-expiry` boot file.
- **Media uploads** always go through the `cloudinary` module (SDK + buffer streaming via `buffer-to-stream`). `images` and `files` modules handle metadata/association only. The frontend never talks to Cloudinary's upload API directly.
- **Salon hours and timezone** live in `src/reservations/salon-schedule.ts` (open/close minute constants, weekday helpers) and `src/reservations/salon-time.ts` (`getSalonNow`, `getDayBounds`, `getDatePartsInTz`). These must stay aligned with `hari_salon_front/src/helpers/businessHours.ts` — there is a comment in `salon-schedule.ts` flagging this dependency. Timezone is read from `SALON_TZ` (`America/Bogota`).
- **Worker parallelism fallback**: when no non-default workers exist, capacity uses `SALON_PARALLEL_STYLISTS_FALLBACK` (default 3). `workers.service.ts` is the source of truth for worker availability; the frontend `useWorkerAvailability` composable depends on its response shape.
- **Reservation occupancy** is computed in QDate-key format (`YYYY/MM/DD`) on the wire; convert to/from `YYYY-MM-DD` only at boundaries (see helpers in `reservations.service.ts`).
- **Shared DTOs** (pagination, etc.) live in `src/common/dtos/`. Reuse them rather than redefining query DTOs per module.

## Tests

- Jest `rootDir` is `src` and `testRegex` is `.*\.spec\.ts$`, so unit tests must be **colocated** under `src/` next to the code they exercise (see `reservations.service.spec.ts`, `workers.service.spec.ts`, `auth.*.spec.ts`).
- `moduleNameMapper` maps `^src/(.*)$ → <rootDir>/$1`, so imports like `from 'src/workers/workers.service'` work in both source and tests.
- E2E tests use a separate config at `test/jest-e2e.json`.
- When adding new env-driven behavior, wrap reads through `ConfigService` (matches `app.module.ts`) so tests can stub via the Nest testing module.
