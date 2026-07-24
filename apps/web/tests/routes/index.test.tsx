import { describe, expect, it } from "vitest";
// Import the REAL route module — this test fails if the route is deleted,
// its head() breaks, or its component export disappears.
import { Route } from "../../app/routes/index";

describe("index route", () => {
  it("declares a component", () => {
    expect(Route.options.component).toBeTypeOf("function");
  });

  it("provides title and description meta", () => {
    const head = Route.options.head?.({} as never);
    const meta = head?.meta ?? [];

    const title = meta.find((m) => m && "title" in m);
    expect(title?.title).toContain("CF TanStack Starter");

    const description = meta.find((m) => (m as { name?: string }).name === "description");
    expect((description as { content?: string })?.content).toBeTruthy();

    const ogTitle = meta.find((m) => (m as { property?: string }).property === "og:title");
    expect(ogTitle).toBeDefined();
  });
});
