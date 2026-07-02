# CF TanStack Starter

A production-ready monorepo template for full-stack apps on **Cloudflare Workers** with **TanStack Start**, **Drizzle ORM**, and **shadcn/ui**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [TanStack Start](https://tanstack.com/start) (SSR, streaming, server functions) |
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com/) (edge deployment) |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge) |
| **Object Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) (type-safe SQL, zero overhead) |
| **Validation** | [Valibot](https://valibot.dev/) (lightweight, tree-shakable, Standard Schema) |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Auth** | [better-auth](https://www.better-auth.com/) (username/password, admin roles, CSRF) |
| **Rate Limiting** | KV-backed per-IP rate limiter (auth + API endpoints) |
| **Background Jobs** | Cron-scheduled + on-demand jobs via CF Workers `scheduled` events |
| **Logging** | [pino](https://getpino.io/) (browser build — Workers-native, no stream deps) |
| **Observability** | OpenTelemetry-compatible tracing via CF Workers Logs |
| **Testing** | [Vitest](https://vitest.dev/) |
| **Monorepo** | [pnpm](https://pnpm.io/) workspaces + [Turborepo](https://turbo.build/) |
| **CI/CD** | GitHub Actions (auto-deploy to staging/production) |

## Project Structure

```
cf-tanstack-starter/
├── .github/workflows/
│   ├── ci.yml                # Lint, typecheck, test on PRs
│   └── deploy.yml            # Auto-deploy: main→prod, staging→staging
├── apps/
│   └── web/                  # TanStack Start application
│       ├── app/
│       │   ├── client.tsx        # Client entry (hydration)
│       │   ├── router.tsx        # Router config
│       │   ├── styles/globals.css
│       │   ├── lib/
│       │   │   ├── utils.ts          # cn() helper
│       │   │   ├── auth-server.ts    # better-auth config (server-only)
│       │   │   ├── auth.ts           # Auth client hooks
│       │   │   ├── auth-middleware.ts   # Session-required server fn middleware
│       │   │   ├── admin-middleware.ts  # Admin-required server fn middleware
│       │   │   ├── get-session.ts    # Session server function
│       │   │   ├── feature-flags.ts  # KV-backed feature flags
│       │   │   ├── rate-limit.ts     # KV-backed rate limiter
│       │   │   └── rate-limit-middleware.ts  # Server fn rate limit middleware
│       │   ├── jobs/
│       │   │   ├── types.ts          # Job interfaces
│       │   │   ├── runner.ts         # Job execution engine
│       │   │   ├── registry.ts       # Job registry
│       │   │   └── definitions/      # Individual job definitions
│       │   ├── components/ui/    # shadcn components
│       │   ├── server-entry.ts   # Custom worker entry (fetch + scheduled)
│       │   └── routes/
│       │       ├── __root.tsx    # HTML shell + nav
│       │       ├── index.tsx     # Landing page
│       │       ├── login.tsx     # Login page
│       │       ├── register.tsx  # Registration page
│       │       ├── demo.tsx      # D1 guestbook + R2 file upload
│       │       └── admin/        # Admin panel (jobs, user management)
│       ├── tests/                # Vitest tests
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       └── wrangler.jsonc        # CF Workers config (D1, R2, observability)
├── packages/
│   ├── db/                   # Database schema + validation
│   │   ├── src/
│   │   │   ├── schema.ts        # Drizzle tables
│   │   │   ├── client.ts        # createDb(d1) factory
│   │   │   └── validation.ts    # Valibot schemas
│   │   └── drizzle/              # Generated migration SQL
│   ├── logger/               # Structured logging (pino-compatible)
│   │   └── src/index.ts
│   └── observability/        # OpenTelemetry tracing
│       └── src/
│           ├── tracer.ts         # Span/trace creation
│           └── middleware.ts     # TanStack Start server fn middleware
├── turbo.json
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10.16 (10.33+ recommended — the repo pins `packageManager`, so `corepack enable` is enough)

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.dev.vars.example apps/web/.dev.vars
# Edit .dev.vars — set BETTER_AUTH_SECRET to a random value:
#   openssl rand -hex 32
# and set ADMIN_EMAILS to the email you'll register with.

# Start dev server (local D1 + R2 + KV emulation)
pnpm dev
```

The app will be available at `http://localhost:5173`.

### First Run

On first `pnpm dev`, Cloudflare's Vite plugin creates a local D1 database. You need to apply the schema:

```bash
# From the project root, apply SQL to local D1
pnpm --filter @repo/db db:migrate:local
```

Optionally seed the database with sample data and test users:

```bash
pnpm db:seed    # Creates admin/password and user/password accounts + sample data
```

Otherwise, register with an email listed in `ADMIN_EMAILS` — those accounts
are auto-promoted to admin at creation. (There is deliberately no
"first user becomes admin" behavior: on a public deployment that hands the
site to whoever finds it first.)

## Development

```bash
pnpm dev          # Start dev server with local D1/R2 emulation
pnpm build        # Production build
pnpm test         # Run all tests
pnpm test:watch   # Watch mode
pnpm typecheck    # TypeScript checking
```

### Database

```bash
# After changing packages/db/src/schema.ts:
pnpm --filter @repo/db db:generate    # Generate new migration SQL
pnpm --filter @repo/db db:migrate:local  # Apply to local D1
```

### Adding shadcn Components

```bash
cd apps/web
pnpm dlx shadcn@latest add <component-name>
```

## Architecture

### Server Functions

Server functions use TanStack Start's `createServerFn` with:

- **Valibot schemas** for input validation (via Standard Schema protocol)
- **Tracing middleware** for automatic OpenTelemetry-compatible logging
- **Dynamic imports** for CF-only modules (`cloudflare:workers`, `@repo/db`) inside handlers

```typescript
import { createServerFn } from "@tanstack/react-start";
import { AddEntrySchema } from "@repo/db";
import { tracingMiddleware } from "@repo/observability/middleware";

const addEntry = createServerFn({ method: "POST" })
  .middleware([tracingMiddleware])       // Auto-traces execution
  .inputValidator(AddEntrySchema)        // Valibot schema validation
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const db = createDb(env.DB);
    await db.insert(guestbookEntries).values(data);
    return { success: true };
  });
```

### Logging

The `@repo/logger` package is real [pino](https://getpino.io/), using its browser build (pino's Node build needs streams/worker_threads, which Workers lack — the browser build logs via `console.*`, which Cloudflare Workers Logs ingests with field extraction):

```typescript
import { createLogger } from "@repo/logger";

const log = createLogger({ level: "info", bindings: { service: "api" } });
log.info({ path: "/demo", status: 200 }, "request handled");   // pino convention: object first
// Output: {"level":30,"time":1710000000000,"service":"api","path":"/demo","status":200,"msg":"request handled"}

log.error({ err: new Error("boom") }, "failed");  // Error serialized with message + stack

const child = log.child({ requestId: "abc-123" });
child.info("processing");  // Inherits parent bindings
```

### Observability

Three layers of observability:

1. **Cloudflare Native** (zero-code): Auto-instruments fetch(), D1, R2, KV bindings. Enabled via `observability` in `wrangler.jsonc`.

2. **Tracing Middleware**: Wraps server functions with trace context, timing, and error tracking.

3. **Custom Spans**: Use `@repo/observability` for application-level tracing:

```typescript
import { createTracer } from "@repo/observability";

const tracer = createTracer("my-service");
await tracer.startActiveSpan("process-upload", async (span) => {
  span.setAttribute("file.size", bytes.length);
  // ... do work
}); // Auto-ends span, logs duration + status
```

All trace output is JSON to stdout, compatible with Cloudflare Workers Logs and any OTLP-compatible backend (Honeycomb, Grafana Cloud, Axiom, etc.).

### Validation

[Valibot](https://valibot.dev/) replaces Zod as the validation library:

- **~1KB** vs Zod's ~14KB (minified+gzipped) — tree-shakable by design
- **Standard Schema** (`~standard` protocol) — TanStack Start supports it natively
- **No adapter code** — pass valibot schemas directly to `inputValidator()`

Schemas live in `packages/db/src/validation.ts` alongside the Drizzle schema they validate.

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| **CI** (`ci.yml`) | Push to `main`, PRs | Lint + Typecheck + Test + Migration drift + Build + wrangler dry-run (prod & staging) + Playwright e2e + dependency-age check (PRs) |
| **Deploy** (`deploy.yml`) | Push to `main` | Verify (lint/typecheck/test/build) → migrate → deploy **production** → health check |
| **Deploy** (`deploy.yml`) | Push to `staging` | Same, against **staging** (`--env staging`) |
| **Preview** (`deploy.yml`) | Same-repo PRs | `wrangler versions upload` (fork PRs skipped — no secrets) |
| **Deploy** (`deploy.yml`) | Manual dispatch | Deploys the environment selected in the dispatch input |

### Required Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers + D1 + R2 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

### Required GitHub Environments

Create two environments in your repo settings:

- `production` — optional: add approval requirements
- `staging` — no approval needed

### Deployment Flow

```
feature branch → PR → CI (typecheck + test + build)
                    → Preview deployment

staging branch  → CI → Deploy to staging Workers
main branch     → CI → Deploy to production Workers
```

## Configuration

### Cloudflare Resources

**If you forked this template:** `wrangler.jsonc` contains the template
author's resource IDs and `workers.dev` URLs — create your own resources and
replace every `database_id`, KV `id`, and `BETTER_AUTH_URL` before deploying:

```bash
# Production
wrangler d1 create cf-tanstack-starter-db
wrangler r2 bucket create cf-tanstack-starter-bucket
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create FLAGS

# Staging (the *_STAGING_ID placeholders in wrangler.jsonc must be replaced
# before pushes to the `staging` branch can deploy)
wrangler d1 create cf-tanstack-starter-db-staging
wrangler r2 bucket create cf-tanstack-starter-bucket-staging
wrangler kv namespace create RATE_LIMIT --env staging
wrangler kv namespace create FLAGS --env staging
```

Update `wrangler.jsonc` with the IDs returned by the create commands, and set
`ADMIN_EMAILS` in `vars` to your email before the first deploy — it is the
only admin bootstrap path.

### Environment Variables

For local development, copy the example file:

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Random secret for signing auth tokens (`openssl rand -hex 32`) — the app refuses to start without it |
| `BETTER_AUTH_URL` | Yes | App base URL (`http://localhost:5173` for dev) |
| `ADMIN_EMAILS` | Yes (first deploy) | Comma-separated emails auto-promoted to admin at account creation — the only admin bootstrap path |
| `SIGNUP_ENABLED` | No | Set to `"false"` to disable public registration (admin-created and `ADMIN_EMAILS` accounts are exempt) |

For production/staging, set secrets via Wrangler:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_SECRET --env staging
```

## Testing

Tests run with [Vitest](https://vitest.dev/) across all packages:

```bash
pnpm test              # Run all tests (via Turborepo)
pnpm test:watch        # Watch mode
pnpm --filter @repo/db test   # Run only db package tests
```

Test files are colocated with source code (`*.test.ts`) or in `tests/` directories.

| Package | Tests |
|---------|-------|
| `@repo/db` | Schema structure, valibot validation, seed-column/schema cross-check |
| `@repo/logger` | Structured output, levels, child loggers, error serialization |
| `@repo/observability` | Span lifecycle, auto-end, error handling |
| `@repo/web` | Job runner lifecycle/timeout, cron-drift vs wrangler.jsonc, rate limiting, feature flags, auth-convention lint (per-function), route tests, Playwright e2e |

Two structural gates worth knowing about:

- `apps/web/tests/server-fn-lint.test.ts` — enforces the auth conventions (adminMiddleware per admin server fn, authMiddleware or `@public-fn` on public POSTs, guard usage in raw handlers)
- `apps/web/app/jobs/registry.test.ts` — fails if a job's cron string isn't declared in `wrangler.jsonc` triggers (or vice versa)

### Supply-chain policy

New dependency versions must be **at least 7 days old**: enforced at install
time (pnpm `minimumReleaseAge`), in Renovate, and by a CI job
(`scripts/check-dep-age.mjs`) that fails closed on unverifiable versions.
GitHub Actions are pinned to commit SHAs.

## License

MIT
