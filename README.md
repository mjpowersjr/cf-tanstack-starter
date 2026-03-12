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
| **Logging** | Pino-compatible structured logger (Workers-native) |
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
│       │   │   ├── auth.server.ts    # better-auth config
│       │   │   ├── auth.client.ts    # Auth client hooks
│       │   │   ├── get-session.ts    # Session server function
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
- [pnpm](https://pnpm.io/) 10.6.3+

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.dev.vars.example apps/web/.dev.vars
# Edit .dev.vars — set BETTER_AUTH_SECRET to a random value:
#   openssl rand -hex 32

# Generate Drizzle migration SQL
pnpm --filter @repo/db db:generate

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

Otherwise, the first user to register automatically becomes admin.

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

The `@repo/logger` package provides a pino-compatible API that works in Cloudflare Workers:

```typescript
import { createLogger } from "@repo/logger";

const log = createLogger({ level: "info", bindings: { service: "api" } });
log.info("request handled", { path: "/demo", status: 200 });
// Output: {"level":30,"time":1710000000000,"msg":"request handled","service":"api","path":"/demo","status":200}

const child = log.child({ requestId: "abc-123" });
child.info("processing");  // Inherits parent bindings
```

Full pino cannot run in Workers (requires Node.js streams/worker_threads). This logger provides the same API (levels, child loggers, structured JSON) using `console.*` methods, which Cloudflare Workers Logs automatically ingests with field extraction.

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
| **CI** (`ci.yml`) | Push to `main`, PRs | Typecheck + Test + Build |
| **Deploy** (`deploy.yml`) | Push to `main` | Deploy to **production** |
| **Deploy** (`deploy.yml`) | Push to `staging` | Deploy to **staging** |
| **Preview** (`deploy.yml`) | Pull requests | Upload preview version |

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

Before deploying, update `wrangler.jsonc` with real resource IDs:

```jsonc
{
  "d1_databases": [{
    "database_id": "YOUR_REAL_D1_DATABASE_ID"  // Replace LOCAL_D1_ID
  }],
  "env": {
    "staging": {
      "d1_databases": [{
        "database_id": "YOUR_STAGING_D1_DATABASE_ID"  // Replace STAGING_D1_ID
      }]
    }
  }
}
```

Create the resources:

```bash
# Production
wrangler d1 create cf-tanstack-starter-db
wrangler r2 bucket create cf-tanstack-starter-bucket
wrangler kv namespace create RATE_LIMIT

# Staging
wrangler d1 create cf-tanstack-starter-db-staging
wrangler r2 bucket create cf-tanstack-starter-bucket-staging
wrangler kv namespace create RATE_LIMIT --env staging
```

Update `wrangler.jsonc` with the KV namespace IDs returned by the create commands.

### Environment Variables

For local development, copy the example file:

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Random secret for signing auth tokens (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | Yes | App base URL (`http://localhost:5173` for dev) |
| `SIGNUP_ENABLED` | No | Set to `"false"` to disable public registration (default: `"true"`) |

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
| `@repo/db` | Schema structure, valibot validation |
| `@repo/logger` | Structured output, levels, child loggers |
| `@repo/observability` | Span lifecycle, auto-end, error handling |
| `@repo/web` | Route tests |

## License

MIT
