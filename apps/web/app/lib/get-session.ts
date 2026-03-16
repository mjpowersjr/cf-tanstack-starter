import { getRequestHeaders } from "@tanstack/react-start/server";
import { createPublicServerFn } from "~/lib/server-fn";

export const getSession = createPublicServerFn().handler(async () => {
  const { env } = await import("cloudflare:workers");
  const { createAuth } = await import("~/lib/auth.server");
  const auth = createAuth(env);
  const headers = getRequestHeaders();
  return await auth.api.getSession({ headers });
});
