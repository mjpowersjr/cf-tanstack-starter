/**
 * Generate the TanStack Router route tree (`app/routeTree.gen.ts`) without
 * running a full vite build.
 *
 * The route tree is normally produced by `@tanstack/router-plugin` as a side
 * effect of vite dev/build. CI's `tsc --noEmit` step needs the file to exist
 * before it runs, but doesn't need a full build — so we invoke the underlying
 * `Generator` directly.
 *
 * Usage: tsx scripts/generate-routes.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Mirror what tanstackStart({ srcDirectory: "app" }) tells the underlying
// router-plugin: routes live under app/routes and the tree is written to
// app/routeTree.gen.ts.
const config = getConfig(
  {
    routesDirectory: "./app/routes",
    generatedRouteTree: "./app/routeTree.gen.ts",
  },
  root,
);
const generator = new Generator({ config, root });
await generator.run();

console.log("Route tree generated at app/routeTree.gen.ts");
