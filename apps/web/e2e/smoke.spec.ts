import { expect, test } from "@playwright/test";

/**
 * Smoke tests that exercise SSR + hydration + a server-function round-trip
 * via a real Chromium instance. Catches the class of bug that statics
 * (typecheck, vitest, vite build, wrangler dry-run) miss — runtime errors
 * that only surface when the bundled Worker actually serves a request, and
 * client-side errors that only fire after hydration.
 *
 * Each test asserts the page rendered AND that no `pageerror` events fired
 * (uncaught JS exceptions in the browser).
 */

function attachErrorTracker(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`${err.name}: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`HTTP ${res.status()} ${res.url()}`);
  });
  return errors;
}

test.describe("public pages render without runtime errors", () => {
  test("home", async ({ page }) => {
    const errors = attachErrorTracker(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "CF TanStack Starter" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try the Demo" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("demo loads guestbook + file upload sections", async ({ page }) => {
    const errors = attachErrorTracker(page);
    await page.goto("/demo");
    // The CardTitle elements contain "Guestbook" / "File Upload" plus a
    // child Badge ("D1" / "R2") so an exact text match fails; assert via the
    // unique CardDescription text instead.
    await expect(page.getByText(/Sign the guestbook/i)).toBeVisible();
    await expect(page.getByText(/Upload files to Cloudflare R2/i)).toBeVisible();
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("login form renders", async ({ page }) => {
    const errors = attachErrorTracker(page);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("auth guards", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});

test.describe("server function round-trip", () => {
  test("guestbook write+read on /demo", async ({ page }) => {
    const errors = attachErrorTracker(page);
    await page.goto("/demo");
    const name = `e2e-${Date.now()}`;
    const message = `posted from playwright at ${new Date().toISOString()}`;
    await page.getByPlaceholder("Your name").fill(name);
    await page.getByPlaceholder("Your message").fill(message);
    await page.getByRole("button", { name: "Sign Guestbook" }).click();
    // Entry shows up after the server fn completes and the loader refetches.
    // Network-idle wait gives addEntry + the refetch time to settle.
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(message)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
