import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  environments: {
    client: {
      build: {
        rollupOptions: {
          // cloudflare:* and node:* modules are only available server-side.
          // TanStack Start includes server function files in the client bundle
          // to generate RPC stubs — externalize so Rollup doesn't fail.
          external: [/^cloudflare:/, /^node:/],
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      srcDirectory: "app",
      // Build-time guarantee that server-only code can't leak into client
      // bundles. Framework defaults (dev: mock, build: error) are listed
      // explicitly so it's obvious where to tune them. Server-only app
      // modules additionally carry `import "@tanstack/react-start/server-only"`
      // markers (see lib/auth-server.ts etc.).
      importProtection: {
        behavior: { dev: "mock", build: "error" },
        client: {
          files: [
            "**/*.server.*", // framework default
            // D1-bound db factory and drizzle schema — server-side only.
            // (Validation schemas via the @repo/db barrel stay client-safe.)
            "**/packages/db/src/client.ts",
            "**/packages/db/src/schema.ts",
          ],
          specifiers: [/^cloudflare:/],
        },
      },
    }),
    viteReact(),
  ],
});
