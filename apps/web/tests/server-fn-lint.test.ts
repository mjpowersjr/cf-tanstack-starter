import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = `${import.meta.dirname}/..`;

function readFile(file: string): string {
  return readFileSync(`${ROOT}/${file}`, "utf-8");
}

/**
 * Enforces that route files and lib files use createAdminServerFn / createPublicServerFn
 * from ~/lib/server-fn instead of importing createServerFn directly from @tanstack/react-start.
 *
 * The only file allowed to import createServerFn directly is lib/server-fn.ts (the factory).
 */
describe("server function imports", () => {
  const ALLOWED_FILES = ["app/lib/server-fn.ts"];

  function getSourceFiles(): string[] {
    const routes = globSync("app/routes/**/*.{ts,tsx}", { cwd: ROOT });
    const lib = globSync("app/lib/**/*.{ts,tsx}", { cwd: ROOT });
    return [...routes, ...lib].filter((f) => !ALLOWED_FILES.includes(f));
  }

  it("no files import createServerFn directly from @tanstack/react-start", () => {
    const violations: string[] = [];

    for (const file of getSourceFiles()) {
      const content = readFile(file);
      if (
        /import\s+\{[^}]*createServerFn[^}]*\}\s+from\s+["']@tanstack\/react-start["']/.test(
          content,
        )
      ) {
        violations.push(file);
      }
    }

    expect(
      violations,
      `These files import createServerFn directly. Use createAdminServerFn or createPublicServerFn from "~/lib/server-fn" instead:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * Enforces that every file defining server.handlers either:
 * 1. Calls requireAuth/requireAdmin from ~/lib/auth-guard, OR
 * 2. Has a `// @public` annotation to explicitly mark it as intentionally unauthenticated
 *
 * This prevents accidentally exposing unprotected API endpoints.
 */
describe("server.handlers auth", () => {
  function getHandlerFiles(): string[] {
    const files = globSync("app/routes/**/*.{ts,tsx}", { cwd: ROOT });
    return files.filter((f) => {
      const content = readFile(f);
      return /server\s*:\s*\{/.test(content) && /handlers\s*:\s*\{/.test(content);
    });
  }

  it("all server.handlers files use an auth guard or are annotated @public", () => {
    const violations: string[] = [];

    for (const file of getHandlerFiles()) {
      const content = readFile(file);
      const hasAuthGuard = /require(?:Auth|Admin)\s*\(/.test(content);
      const hasPublicAnnotation = /\/\/\s*@public/.test(content);

      if (!hasAuthGuard && !hasPublicAnnotation) {
        violations.push(file);
      }
    }

    expect(
      violations,
      `These server.handlers files have no auth guard and no // @public annotation. Either call requireAuth/requireAdmin from "~/lib/auth-guard" or add a "// @public" comment:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
