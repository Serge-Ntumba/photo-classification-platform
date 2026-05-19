import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isAdminAttempt =
    normalizedPath === "/admin" || location.pathname.startsWith("/admin/");
  const heading = isAdminAttempt ? "Admin area is not hosted here" : "Page not found";
  const message = isAdminAttempt
    ? "This frontend does not build or duplicate the admin panel."
    : "Return to the workspace or submissions area to continue.";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-normal">{heading}</h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/app">Return to the workspace</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/submissions">View submissions</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
