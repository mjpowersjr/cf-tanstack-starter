import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { DefaultErrorComponent, NotFoundComponent } from "~/components/error-boundary";
import { LoadingSkeleton } from "~/components/loading";
import { ThemeToggle } from "~/components/theme-toggle";
import { authClient } from "~/lib/auth";
import { getSession } from "~/lib/get-session";
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
  beforeLoad: async () => {
    const session = await getSession();
    return { session };
  },
  component: RootComponent,
  pendingComponent: LoadingSkeleton,
  errorComponent: DefaultErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { session } = Route.useRouteContext();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <html lang="en">
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
            <a href="/" className="text-lg font-semibold">
              CF TanStack Starter
            </a>
            <div className="flex items-center gap-4">
              <a href="/" className="hover:underline">
                Home
              </a>
              <a href="/demo" className="hover:underline">
                Demo
              </a>
              <ThemeToggle />
              {session ? (
                <>
                  {(session.user as Record<string, unknown>).role === "admin" && (
                    <>
                      <a href="/admin" className="hover:underline">
                        Admin
                      </a>
                      <a href="/admin/jobs" className="hover:underline">
                        Jobs
                      </a>
                    </>
                  )}
                  <a href="/settings" className="hover:underline">
                    Settings
                  </a>
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
                  <a href="/login" className="hover:underline">
                    Login
                  </a>
                  <a href="/register" className="hover:underline">
                    Register
                  </a>
                </>
              )}
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
