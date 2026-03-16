# CF TanStack Starter — AI Coding Conventions

## Server Functions

- **NEVER** import `createServerFn` from `@tanstack/react-start` directly in route or lib files
- Use `createAdminServerFn` or `createPublicServerFn` from `~/lib/server-fn`
- `createAdminServerFn` pre-applies `adminMiddleware` (session + admin role check) + `tracingMiddleware`
- `createPublicServerFn` pre-applies `tracingMiddleware` only
- Chain `.middleware([rateLimitMiddleware(...)])` for rate limiting — middleware accumulates across calls
- The only file allowed to import raw `createServerFn` is `apps/web/app/lib/server-fn.ts`
- A test in `tests/server-fn-lint.test.ts` enforces this at CI time
- Admin handlers can access `context.session` (provided by `adminMiddleware`)

```ts
// Admin endpoint (auth required):
const myFn = createAdminServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "my-fn", limit: 10, windowSecs: 60 })])
  .inputValidator(MySchema)
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
  });

// Public endpoint (no auth):
const myFn = createPublicServerFn()
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
