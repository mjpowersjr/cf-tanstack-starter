import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "~/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CF TanStack Starter" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen antialiased">
        <header className="border-b">
          <nav className="container mx-auto flex items-center justify-between px-4 py-3">
            <a href="/" className="text-lg font-semibold">
              CF TanStack Starter
            </a>
            <div className="flex gap-4">
              <a href="/" className="hover:underline">
                Home
              </a>
              <a href="/demo" className="hover:underline">
                Demo
              </a>
            </div>
          </nav>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Outlet />
        </main>
        <Scripts />
      </body>
    </html>
  );
}
