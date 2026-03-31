import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = `${import.meta.dirname}/..`;

function readFile(file: string): string {
  return readFileSync(`${ROOT}/${file}`, "utf-8");
}

/**
 * Enforces that admin server functions include adminMiddleware.
 * Any file under routes/admin/ that uses createServerFn must also reference adminMiddleware.
 */
describe("admin server function auth", () => {
  function getAdminRouteFiles(): string[] {
    return globSync("app/routes/admin/**/*.{ts,tsx}", { cwd: ROOT });
  }

  it("all admin route server functions use adminMiddleware", () => {
    const violations: string[] = [];

    for (const file of getAdminRouteFiles()) {
      const content = readFile(file);
      const hasServerFn = /createServerFn\s*\(/.test(content);
      const hasAdminMiddleware = /adminMiddleware/.test(content);

      if (hasServerFn && !hasAdminMiddleware) {
        violations.push(file);
      }
    }

    expect(
      violations,
      `These admin route files use createServerFn without adminMiddleware:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * Enforces that every file defining server.handlers either:
 * 1. Calls requireAuth/requireAdmin from ~/lib/auth-guard, OR
 * 2. Has a `// @public` annotation to explicitly mark it as intentionally unauthenticated
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
