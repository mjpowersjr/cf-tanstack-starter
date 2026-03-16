import { createFileRoute } from "@tanstack/react-router";
import { createPublicServerFn } from "~/lib/server-fn";

const checkHealth = createPublicServerFn().handler(async () => {
  const { env } = await import("cloudflare:workers");

  let dbStatus: "ok" | "error" = "error";
  try {
    await env.DB.prepare("SELECT 1").run();
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    services: {
      d1: dbStatus,
    },
  };
});

export const Route = createFileRoute("/api/health")({
  loader: () => checkHealth(),
  component: HealthPage,
});

function HealthPage() {
  const data = Route.useLoaderData();
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
