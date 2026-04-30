import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { DefaultErrorComponent, NotFoundComponent } from "~/components/error-boundary";
import { LoadingSkeleton } from "~/components/loading";
import { ThemeToggle } from "~/components/theme-toggle";
import { authClient } from "~/lib/auth";
import { getFlags } from "~/lib/get-flags";
import { getSession } from "~/lib/get-session";
import appCss from "~/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CF TanStack Starter" },
      {
        name: "description",
        content:
          "A full-stack monorepo template for building on Cloudflare with TanStack Start, Drizzle ORM, and shadcn/ui.",
      },
      { property: "og:title", content: "CF TanStack Starter" },
      {
        property: "og:description",
        content:
          "A full-stack monorepo template for building on Cloudflare with TanStack Start, Drizzle ORM, and shadcn/ui.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  beforeLoad: async () => {
    const [session, flags] = await Promise.all([getSession(), getFlags()]);
    return { session, flags };
  },
  component: RootComponent,
  pendingComponent: LoadingSkeleton,
  errorComponent: DefaultErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { session } = Route.useRouteContext();
  const router = useRouter();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const handleLogout = async () => {
    await authClient.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: prevents theme flash before hydration
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="border-b">
          <nav className="container mx-auto flex items-center justify-between px-4 py-3">
            <Link to="/" className="text-lg font-semibold">
              CF TanStack Starter
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:underline">
                Home
              </Link>
              <Link to="/demo" className="hover:underline">
                Demo
              </Link>
              <ThemeToggle />
              {session ? (
                <>
                  {(session.user as Record<string, unknown>).role === "admin" && (
                    <Link to="/admin" className="hover:underline">
                      Admin
                    </Link>
                  )}
                  <Link to="/settings" className="hover:underline">
                    Settings
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {((session.user as Record<string, unknown>).username as string) ??
                      session.user.name}
                  </span>
                  <button type="button" onClick={handleLogout} className="text-sm hover:underline">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="hover:underline">
                    Login
                  </Link>
                  <Link to="/register" className="hover:underline">
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className={isAdmin ? "" : "container mx-auto px-4 py-8"}>
          <Outlet />
        </main>
        <Toaster richColors position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
