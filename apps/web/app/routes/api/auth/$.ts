// @public — better-auth handles its own session/auth checks
import { createFileRoute } from "@tanstack/react-router";

// Rate limit config per auth action (path suffix → limit, windowSecs)
const AUTH_RATE_LIMITS: Record<string, { limit: number; windowSecs: number }> = {
  "sign-in": { limit: 5, windowSecs: 60 },
  "sign-up": { limit: 3, windowSecs: 3600 },
  // Sends an email per request — keep tight to prevent email bombing and
  // burning the sending quota/reputation.
  "request-password-reset": { limit: 3, windowSecs: 3600 },
  // Token guessing.
  "reset-password": { limit: 5, windowSecs: 3600 },
};

// Every other POST auth action (change-password, update-user, ...) gets a
// generous default so nothing is unlimited.
const DEFAULT_AUTH_RATE_LIMIT = { limit: 30, windowSecs: 60 };

async function handleAuth(request: Request): Promise<Response> {
  const { env } = await import("cloudflare:workers");

  // Rate limit auth mutations by IP
  if (request.method === "POST") {
    const { checkRateLimit, rateLimitResponse, getClientIp } = await import("~/lib/rate-limit");
    const url = new URL(request.url);
    // Path like /api/auth/sign-in/username → extract "sign-in"
    const segments = url.pathname.replace("/api/auth/", "").split("/");
    const action = segments[0];
    const config = AUTH_RATE_LIMITS[action] ?? DEFAULT_AUTH_RATE_LIMIT;

    const ip = getClientIp(request);
    const result = await checkRateLimit(
      env.RATE_LIMIT,
      `auth:${action}:${ip}`,
      config.limit,
      config.windowSecs,
    );
    if (!result.allowed) {
      return rateLimitResponse(result.resetAt);
    }
  }

  const { createAuth } = await import("~/lib/auth-server");
  return createAuth(env).handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuth(request),
      POST: async ({ request }) => handleAuth(request),
    },
  },
});
