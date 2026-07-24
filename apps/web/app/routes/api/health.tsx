// @public — infrastructure health endpoint; JSON only, rate-limited per IP
import { createFileRoute } from "@tanstack/react-router";

async function health(request: Request): Promise<Response> {
  const { env } = await import("cloudflare:workers");
  const { checkRateLimit, getClientIp, rateLimitResponse } = await import("~/lib/rate-limit");

  const rl = await checkRateLimit(env.RATE_LIMIT, `health:${getClientIp(request)}`, 30, 60);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetAt);
  }

  let dbStatus: "ok" | "error" = "error";
  try {
    await env.DB.prepare("SELECT 1").run();
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  const healthy = dbStatus === "ok";
  return new Response(
    JSON.stringify({
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: { d1: dbStatus },
    }),
    {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => health(request),
    },
  },
});
