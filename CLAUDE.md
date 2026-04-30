# CF TanStack Starter — AI Coding Conventions

## Server Functions

- Use `createServerFn` from `@tanstack/react-start` directly (wrapper functions break TanStack Start's build-time import protection)
- Admin server functions **MUST** include `adminMiddleware` from `~/lib/admin-middleware` in their `.middleware([...])` array
- All server functions should include `tracingMiddleware` from `@repo/observability/middleware`
- A test in `tests/server-fn-lint.test.ts` enforces adminMiddleware usage in admin routes at CI time
- Admin handlers can access `context.session` (provided by `adminMiddleware`)
- Server-only imports (`cloudflare:workers`, `@repo/db`, etc.) must use dynamic `await import()` inside handlers

```ts
// Admin endpoint (auth required):
const myFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware, rateLimitMiddleware({ key: "my-fn", limit: 10, windowSecs: 60 }), tracingMiddleware])
  .inputValidator(MySchema)
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
  });

// Public endpoint (no auth):
const myFn = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async () => { ... });
```

## API Routes (server.handlers)

- `server.handlers` routes bypass `createServerFn` middleware — they're raw HTTP handlers
- Every file with `server.handlers` **MUST** either:
  - Call `requireAuth()` or `requireAdmin()` from `~/lib/auth-guard`, OR
  - Have a `// @public` comment at the top to explicitly mark it as unauthenticated
- A test in `tests/server-fn-lint.test.ts` enforces this at CI time
- Page routes under `/admin/` are protected by `beforeLoad` in `admin/route.tsx` (inherited by all children)

```ts
// Protected API route:
import { requireAdmin } from "~/lib/auth-guard";

GET: async ({ request, params }) => {
  const session = await requireAdmin(request);
  if (session instanceof Response) return session;
  // session.user is available
}

// Intentionally public API route — add annotation at top of file:
// @public — reason why this is public
export const Route = createFileRoute("/api/example")({ ... });
```

## Navigation

- Use `<Link to="...">` from `@tanstack/react-router` for internal navigation (client-side routing)
- Only use `<a href="...">` for external links or file downloads (`target="_blank"`)

## Validation

- Valibot (not Zod) for all schemas
- Schemas live in `packages/db/src/validation.ts`

## D1 Migrations

- One unified runner: `pnpm db:migrate:local` and `pnpm db:migrate:remote` both invoke `packages/db/scripts/migrate.ts`
- Tracking lives **inside D1** in the standard `__drizzle_migrations` table (`id, hash, created_at, name, applied_at`) — schema and sha256 hashing match drizzle-orm's d1 migrator exactly, so the table is interchangeable with `drizzle-kit migrate`
- Because tracking is in-database, `wrangler d1 export DB --remote` carries migration history with the snapshot — `pnpm db:snapshot` restores prod locally and `pnpm db:migrate:local` correctly applies only undeployed migrations on top
- **Do NOT** use `wrangler d1 migrations apply` — it expects flat `.sql` files but drizzle generates subdirs (`<timestamp>_<name>/migration.sql`)
- New migrations: `pnpm db:generate` (drizzle-kit), then `pnpm db:migrate:local` to apply

## Feature Flags

- Server-side utils in `~/lib/feature-flags`: `getFlag`, `setFlag`, `deleteFlag`, `listFlags`, `getEnabledFlags`
- Flags are stored in the `FLAGS` KV namespace under the `flag:<name>` key
- Bulk-loaded once per request in `__root.tsx` `beforeLoad` via `getFlags()` from `~/lib/get-flags` and exposed via router context
- Components consume flags with the `useFlag(name)` hook from `~/lib/use-flag` — no extra network calls
- Flag names are visible to all clients (loaded into the SSR payload). Gate sensitive logic by checking inside server-only code instead

```tsx
// Component:
import { useFlag } from "~/lib/use-flag";
function MyComponent() {
  const enabled = useFlag("new-dashboard");
  return enabled ? <NewDashboard /> : <OldDashboard />;
}

// Server (admin-only check):
const myFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware, tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { getFlag } = await import("~/lib/feature-flags");
    if (await getFlag(env.FLAGS, "expensive-feature")) { ... }
  });
```

## Testing

- `pnpm test` runs all tests via turborepo
- `pnpm typecheck` for type checking
- `pnpm exec biome check .` for linting/formatting
