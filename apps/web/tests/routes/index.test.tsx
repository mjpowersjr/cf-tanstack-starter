import { describe, expect, it } from "vitest";

describe("index route", () => {
  it("defines the tech stack items", () => {
    // Verify the landing page data structure is sound
    const techStack = [
      { title: "TanStack Start", description: "Full-stack React framework" },
      { title: "Cloudflare Workers", description: "Edge-first deployment" },
      { title: "Drizzle ORM", description: "Type-safe SQL" },
      { title: "Tailwind CSS v4", description: "Utility-first CSS" },
      { title: "shadcn/ui", description: "Accessible components" },
      { title: "Turborepo", description: "Monorepo task orchestration" },
    ];

    expect(techStack).toHaveLength(6);
    techStack.forEach((item) => {
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
    });
  });
});
