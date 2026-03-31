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
    tanstackStart({ srcDirectory: "app" }),
    viteReact(),
  ],
});
