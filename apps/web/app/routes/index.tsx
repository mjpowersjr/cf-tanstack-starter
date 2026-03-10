import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const techStack = [
  {
    title: "TanStack Start",
    description: "Full-stack React framework with SSR, streaming, and server functions.",
  },
  {
    title: "Cloudflare Workers",
    description: "Edge-first deployment with D1 (SQLite) and R2 (object storage).",
  },
  {
    title: "Drizzle ORM",
    description: "Type-safe SQL with zero overhead, built for D1.",
  },
  {
    title: "Tailwind CSS v4",
    description: "Utility-first CSS with the new Vite plugin and @theme config.",
  },
  {
    title: "shadcn/ui",
    description: "Beautiful, accessible components you own and customize.",
  },
  {
    title: "Turborepo",
    description: "Monorepo task orchestration with smart caching.",
  },
];

function HomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          CF TanStack Starter
        </h1>
        <p className="text-lg text-muted-foreground">
          A full-stack monorepo template for building on Cloudflare with
          TanStack Start, Drizzle ORM, and shadcn/ui.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {techStack.map((item) => (
          <div
            key={item.title}
            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
          >
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <a
          href="/demo"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Try the Demo
        </a>
      </div>
    </div>
  );
}
