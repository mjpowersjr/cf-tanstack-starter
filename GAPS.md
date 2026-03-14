# Starter Template Gaps

Track remaining gaps to address one at a time. Check off items as they're completed.

## High Priority

- [x] **Rate limiting** — Protect auth endpoints (login, signup) and API routes from brute-force/abuse. Use Cloudflare's `rate_limit` binding or in-memory sliding window.

- [x] **CSRF protection** — Verified: better-auth enables origin checking and fetch-metadata CSRF protection by default. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production. No code changes needed.

- [x] **`.dev.vars.example` + environment config docs** — No example env file exists. New contributors have to reverse-engineer required secrets from wrangler.jsonc and code. Create `.dev.vars.example` with placeholder values and comments.

- [x] **Database seeding script** — No way to populate local D1 with sample data for development. Add `pnpm db:seed` script that inserts test users, sample records, etc.

- [x] **Error/loading states per-route** — Routes lack `errorComponent` and `pendingComponent`. Unhandled errors show a blank page or generic error. Add error boundaries and loading skeletons to key routes.

## Medium Priority

- [x] **Email/password reset flow** — Added forgot-password and reset-password pages, pluggable email abstraction (Resend when API key set, console.log fallback for dev), wired into better-auth's sendResetPassword callback.

- [x] **Tests for jobs system and admin routes** — The new background jobs system has zero test coverage. Add unit tests for the runner, registry, and job definitions. Add integration tests for admin route server functions.

- [x] **R2 file upload download/deletion** — R2 bucket is bound but only used in health checks. Add a basic file management pattern: upload API route, download route with signed URLs, deletion, and a simple admin UI.

- [x] **Pagination** — Job runs table and any future list views have no pagination. The jobs page hard-codes `LIMIT 50`. Add cursor-based or offset pagination with UI controls.

- [x] **Session management UI** — Users can't view or revoke their active sessions. Add a settings/security page showing active sessions with "revoke" buttons.

## Low Priority

- [x] **Dark mode** — Tailwind and shadcn/ui support dark mode but no toggle exists. Add a theme provider and toggle component in the header.

- [x] **Toast/notification system** — No user feedback for async actions (job triggered, file uploaded, errors). Add a toast provider (sonner or react-hot-toast) and wire it into key actions.

- [x] **OpenGraph/SEO meta tags** — No `<meta>` tags for social sharing or SEO. Add `Meta` component usage in route heads for title, description, og:image.

- [x] **Drizzle migration format mismatch** — Resolved: wrangler now natively supports Drizzle's subdirectory migration format (`migrations_dir` in wrangler.jsonc points to `packages/db/drizzle`). No conversion script needed.

- [x] **KV/Durable Objects patterns** — Added KV-backed feature flags pattern with admin UI for managing flags. KV also used for rate limiting. DO deferred (adds significant complexity for a starter template).
