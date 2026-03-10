import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = await import("cloudflare:workers");
        const { createAuth } = await import("~/lib/auth.server");
        return createAuth(env).handler(request);
      },
      POST: async ({ request }) => {
        const { env } = await import("cloudflare:workers");
        const { createAuth } = await import("~/lib/auth.server");
        return createAuth(env).handler(request);
      },
    },
  },
});
