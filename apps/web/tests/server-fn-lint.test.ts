import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = `${import.meta.dirname}/..`;

function readFile(file: string): string {
  return readFileSync(`${ROOT}/${file}`, "utf-8");
}

/**
 * Extract each createServerFn builder chain (from `createServerFn(` up to
 * `.handler(`) so middleware requirements can be checked PER FUNCTION — a
 * file-level string match would pass a file where one function has the
 * middleware and a second one doesn't.
 */
function serverFnChunks(raw: string): { chunk: string; before: string }[] {
  // Strip block comments so JSDoc usage examples don't register as real
  // server functions. Line comments survive (the @public-fn annotation).
  const content = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const chunks: { chunk: string; before: string }[] = [];
  const re = /createServerFn\s*\(/g;
  let match = re.exec(content);
  while (match) {
    const start = match.index;
    const handlerIdx = content.indexOf(".handler(", start);
    const nextFnIdx = content.indexOf("createServerFn", start + 1);
    const end =
      handlerIdx !== -1 && (nextFnIdx === -1 || handlerIdx < nextFnIdx)
        ? handlerIdx
        : nextFnIdx !== -1
          ? nextFnIdx
          : content.length;
    chunks.push({
      chunk: content.slice(start, end),
      // Preceding context, for annotations like `// @public-fn <reason>`
      before: content.slice(Math.max(0, start - 300), start),
    });
    match = re.exec(content);
  }
  return chunks;
}

describe("admin server function auth", () => {
  it("every createServerFn in routes/admin/ includes adminMiddleware in its chain", () => {
    const violations: string[] = [];

    for (const file of globSync("app/routes/admin/**/*.{ts,tsx}", { cwd: ROOT })) {
      const content = readFile(file);
      serverFnChunks(content).forEach(({ chunk }, i) => {
        if (!/adminMiddleware/.test(chunk)) {
          violations.push(`${file} (createServerFn #${i + 1})`);
        }
      });
    }

    expect(
      violations,
      `These admin server functions are missing adminMiddleware in their .middleware([...]) chain:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("mutating server functions outside admin routes", () => {
  it('every POST createServerFn has auth middleware or an explicit "// @public-fn" annotation', () => {
    const violations: string[] = [];

    const files = globSync("app/**/*.{ts,tsx}", { cwd: ROOT }).filter(
      (f) => !f.startsWith("app/routes/admin/"),
    );
    for (const file of files) {
      const content = readFile(file);
      serverFnChunks(content).forEach(({ chunk, before }, i) => {
        if (!/method\s*:\s*["']POST["']/.test(chunk)) return;
        const hasAuth = /adminMiddleware|authMiddleware/.test(chunk);
        const isAnnotatedPublic = /\/\/\s*@public-fn/.test(before);
        if (!hasAuth && !isAnnotatedPublic) {
          violations.push(`${file} (createServerFn #${i + 1})`);
        }
      });
    }

    expect(
      violations,
      `These POST server functions have no auth middleware. Add authMiddleware/adminMiddleware, ` +
        `or mark intentionally-public mutations with a "// @public-fn <reason>" comment directly above:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

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
      // The annotation must lead the file — a stray "@public" buried in an
      // unrelated comment shouldn't disable enforcement.
      const firstLines = content.split("\n").slice(0, 5).join("\n");
      const hasPublicAnnotation = /\/\/\s*@public\b/.test(firstLines);

      if (!hasAuthGuard && !hasPublicAnnotation) {
        violations.push(file);
      }
    }

    expect(
      violations,
      `These server.handlers files have no auth guard and no leading "// @public" annotation. ` +
        `Either call requireAuth/requireAdmin from "~/lib/auth-guard" or add "// @public — <reason>" in the first lines of the file:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("every auth guard result is checked with `instanceof Response`", () => {
    const violations: string[] = [];

    for (const file of getHandlerFiles()) {
      const content = readFile(file);
      const guardCalls = content.match(/require(?:Auth|Admin)\s*\(/g)?.length ?? 0;
      const responseChecks = content.match(/instanceof\s+Response/g)?.length ?? 0;
      // A guard whose returned Response is never checked/returned is a full
      // auth bypass that compiles fine.
      if (guardCalls > 0 && responseChecks < guardCalls) {
        violations.push(
          `${file} (${guardCalls} guard call(s), ${responseChecks} instanceof check(s))`,
        );
      }
    }

    expect(
      violations,
      `These files call requireAuth/requireAdmin but don't check every result with \`instanceof Response\` (and return it):\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
