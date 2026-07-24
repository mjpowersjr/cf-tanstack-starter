# CF TanStack Starter — AI Coding Conventions

This is the canonical guide for AI coding agents working in this repo
(AGENTS.md links here). It records the conventions that are NOT obvious from
the code alone, plus the CI gates that enforce them.

## Architecture Map

- `apps/web/` — TanStack Start app deployed to Cloudflare Workers
  - `app/routes/` — file-based routes; `app/routes/admin/*` is the admin panel
  - `app/lib/` — auth, rate limiting, feature flags, formatting helpers
  - `app/jobs/` — cron/manual background jobs (see Jobs below)
  - `app/server-entry.ts` — custom worker entry: fetch (security headers) + scheduled (cron)
  - `wrangler.jsonc` — bindings (DB=D1, BUCKET=R2, RATE_LIMIT/FLAGS=KV), cron triggers, staging env
- `packages/db/` — Drizzle schema + `createDb(d1)` factory + valibot validation + migration/seed/snapshot scripts
- `packages/logger/` — pino (browser build) configured for Workers
- `packages/observability/` — tracing middleware for server functions

## Server Functions

- Use `createServerFn` from `@tanstack/react-start` directly (wrapper functions break TanStack Start's compile-time transforms)
- Admin server functions **MUST** include `adminMiddleware` from `~/lib/admin-middleware` in their `.middleware([...])` array
- Non-admin authenticated functions use `authMiddleware` from `~/lib/auth-middleware` (any valid session; provides `context.session`)
- Every `POST` server function outside `routes/admin/` must have `authMiddleware`/`adminMiddleware` **or** a `// @public-fn <reason>` comment directly above it
- All server functions should include `tracingMiddleware` from `@repo/observability/middleware`
- `tests/server-fn-lint.test.ts` enforces all of the above at CI time, **per function** (not per file)
- Server-only imports (`cloudflare:workers`, `@repo/db`, etc.) must use dynamic `await import()` inside handlers

```ts
// Admin endpoint (auth required):
const myFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware, rateLimitMiddleware({ key: "my-fn", limit: 10, windowSecs: 60 }), tracingMiddleware])
  .validator(MySchema)
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
  });

// Authenticated (non-admin) endpoint:
const myFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware, tracingMiddleware])
  .handler(async ({ context }) => { ... });

// Intentionally public mutation — annotate directly above:
// @public-fn — anonymous guestbook signing is the point; rate-limited per IP
const addEntry = createServerFn({ method: "POST" })...
```

## Import Protection (build-time server/client boundary)

- Configured in `apps/web/vite.config.ts` (`importProtection` on the tanstackStart plugin): dev = mock + warning, build = hard error with an import trace
- Server-only lib modules carry a marker: `import "@tanstack/react-start/server-only";` (see `lib/auth-server.ts`, `lib/auth-guard.ts`, `lib/email.ts`, `lib/feature-flags.ts`) — add the marker to any new server-only module
- `packages/db/src/client.ts` and `schema.ts` are denied in client bundles by file pattern; validation schemas via the `@repo/db` barrel are client-safe

## API Routes (server.handlers)

- `server.handlers` routes bypass `createServerFn` middleware — they're raw HTTP handlers
- Every file with `server.handlers` **MUST** either:
  - Call `requireAuth()` or `requireAdmin()` from `~/lib/auth-guard` AND check every result with `instanceof Response`, OR
  - Have a `// @public — <reason>` comment within the first 5 lines of the file
- `tests/server-fn-lint.test.ts` enforces both at CI time
- Page routes under `/admin/` are protected by `beforeLoad` in `admin/route.tsx` (inherited by all children); non-admin users are redirected to `/access-denied`

```ts
// Protected API route:
import { requireAdmin } from "~/lib/auth-guard";

GET: async ({ request, params }) => {
  const session = await requireAdmin(request);
  if (session instanceof Response) return session;
  // session.user is available
}
```

## Auth & Admin Bootstrap

- better-auth (username/password) configured in `~/lib/auth-server.ts`; `createAuth` throws if `BETTER_AUTH_SECRET` is unset
- **Admin bootstrap:** accounts whose email is listed in the `ADMIN_EMAILS` var (comma-separated, `wrangler.jsonc` / `.dev.vars`) are auto-promoted to admin at creation. There is no "first user becomes admin" behavior — set `ADMIN_EMAILS` before first deploy
- `SIGNUP_ENABLED="false"` blocks self-service signup only; admin-created users and `ADMIN_EMAILS` accounts are exempt
- Locally, `pnpm db:seed` creates `admin/password` and `user/password` accounts

## Rate Limiting

- KV-backed fixed-window limiter (`~/lib/rate-limit`); fails **closed**
- Server functions: `rateLimitMiddleware({ key, limit, windowSecs })` — throws a real 429 `Response` with `Retry-After`
- Raw auth routes: per-action limits in `app/routes/api/auth/$.ts` (sign-in, sign-up, password reset each tuned; every other POST action gets a default limit)
- Only `cf-connecting-ip` is trusted for client identity — never `x-forwarded-for`
- Known limitation: KV is eventually consistent, so limits are approximate per-colo. For hard brute-force guarantees add a WAF rate rule or Durable Object counter

## Logging (pino)

- `@repo/logger` wraps pino's **browser build** (the Node build needs streams the Workers runtime lacks); same code path in vitest and production
- Call convention is pino's: **object first, message second** — `log.info({ userId }, "signed in")`
- Errors go under the `err` key for message/stack serialization: `log.error({ err }, "failed")`
- `createLogger({ level, bindings, onEntry })` — `onEntry` observes each structured entry (the job runner uses it to buffer a run's logs into its `job_runs` row)

## Validation

- Valibot (not Zod) for all schemas; Standard Schema means no adapter for `.validator()`
- Shared schemas live in `packages/db/src/validation.ts` (exports `ALLOWED_CONTENT_TYPES`, `MAX_FILE_SIZE` for client-side pre-checks)

## D1 Migrations

- One unified runner: `pnpm db:migrate:local` / `pnpm db:migrate:remote` invoke `packages/db/scripts/migrate.ts`; add `--env staging` to target the staging database (deploy.yml does this)
- Each migration is applied **atomically with its tracking INSERT** in a single `wrangler d1 execute --file` call
- Tracking lives **inside D1** in the standard `__drizzle_migrations` table — schema and sha256 hashing match drizzle-orm's d1 migrator exactly, so it's interchangeable with `drizzle-kit migrate`
- Because tracking is in-database, `wrangler d1 export DB --remote` carries migration history with the snapshot — `pnpm db:snapshot` restores prod locally and `pnpm db:migrate:local` applies only undeployed migrations on top
- **Do NOT** use `wrangler d1 migrations apply` — it expects flat `.sql` files but drizzle generates subdirs
- The runner refuses migrations containing internal semicolons (e.g. trigger bodies) because wrangler's splitter would corrupt them
- New migrations: `pnpm db:generate`, then `pnpm db:migrate:local`. CI has a drift gate — commit the generated SQL with the schema change
- Timestamps: ALL tables use `integer({ mode: "timestamp" })` (epoch seconds, surfaces as `Date`). Render with `formatDate()` from `~/lib/format` — never render a raw `Date`

## Feature Flags

- Server-side utils in `~/lib/feature-flags`: `getFlag`, `setFlag`, `deleteFlag`, `listFlags`, `getEnabledFlags`
- Stored in the `FLAGS` KV namespace under `flag:<name>` with the enabled state duplicated into **key metadata** so `listFlags()` is a single `kv.list()` — this runs on every request via root `beforeLoad`, so never add per-key reads to that path
- Flag names are kebab-case (enforced by the admin UI schema)
- Components consume flags with `useFlag(name)` from `~/lib/use-flag` (reads router context, zero extra fetches)
- Flag names are visible to all clients. Gate sensitive logic in server-only code instead
- Reserved flag: `maintenance-mode` — renders the maintenance page for non-admin visitors (see `__root.tsx`)

## Background Jobs

- Definitions in `app/jobs/definitions/`, registered in `app/jobs/registry.ts`; cron strings must exactly match `wrangler.jsonc` `triggers.crons` — a test in `registry.test.ts` fails CI on drift (including staging env parity)
- `executeJob` enforces `timeoutMs` (default 5 min) and never lets bookkeeping failures escape into `waitUntil`
- Stuck "running" rows are swept to "error" on each cron tick (`sweepStaleRuns`); `db-cleanup` prunes run history older than 30 days
- Jobs are not mutually exclusive — a manual trigger can overlap a cron run. Keep handlers idempotent

## Dependencies (supply-chain policy)

- 7-day cooldown on new package versions: pnpm `minimumReleaseAge` (pnpm-workspace.yaml), Renovate `minimumReleaseAge`, and a CI job (`scripts/check-dep-age.mjs`, fails closed) all enforce it
- Pin exact versions for pre-1.0/beta packages (drizzle is pinned to an exact beta — its floating `@beta` tag could silently change the migrator contract)
- GitHub Actions are pinned to commit SHAs

## Canned Pages & Well-Known Files

- 404 → `NotFoundComponent`, errors → `DefaultErrorComponent` (both in `~/components/error-boundary`, wired on the root route)
- `/access-denied` — logged-in-but-unauthorized landing
- Maintenance mode — `maintenance-mode` feature flag (admins + /login bypass)
- `apps/web/public/`: `robots.txt`, `humans.txt`, `llms.txt`, `.well-known/security.txt` — placeholder contact values, update before production

## Navigation

- Use `<Link to="...">` from `@tanstack/react-router` for internal navigation (client-side routing)
- Only use `<a href="...">` for external links or file downloads (`target="_blank"`)

## Testing & CI

- `pnpm test` — all tests via turborepo; `pnpm typecheck`; `pnpm lint` (biome); `pnpm e2e` (Playwright)
- CI gates: lint+typecheck, tests, migration drift, wrangler dry-run (prod + staging), Playwright e2e, dependency age (PRs)
- Deploy (`deploy.yml`) re-runs lint/typecheck/test/build, applies migrations (`--env staging` for staging), deploys, then health-checks `/api/health`
- Convention enforcement lives in `apps/web/tests/server-fn-lint.test.ts` — if you add a convention, extend that test
