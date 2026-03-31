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

## Testing

- `pnpm test` runs all tests via turborepo
- `pnpm typecheck` for type checking
- `pnpm exec biome check .` for linting/formatting
