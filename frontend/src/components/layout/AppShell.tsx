import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StaffReviewEntry } from "@/features/auth/components/StaffReviewEntry";
import type { AuthenticatedUser } from "@/lib/models";

type NavigationItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  children: ReactNode;
  user?: AuthenticatedUser | null;
  navigation?: NavigationItem[];
  onSignOut?: () => void;
};

const defaultNavigation: NavigationItem[] = [
  { href: "/app/submissions/new", label: "Create submission" },
  { href: "/app/submissions", label: "Submissions" },
];

export function AppShell({
  children,
  user,
  navigation = defaultNavigation,
  onSignOut,
}: AppShellProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        href="#main-content"
      >
        Skip to main content
      </a>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Link className="text-base font-semibold tracking-normal" to="/app">
              Photo Classification Platform
            </Link>
            {user ? (
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Signed in as {user.email || user.username}
              </p>
            ) : null}
          </div>
          <nav
            className="flex min-w-0 flex-wrap items-center gap-2"
            aria-label="Workspace navigation"
          >
            {navigation.map((item) => (
              <Button asChild key={item.href} variant="ghost" size="sm">
                <Link to={item.href}>{item.label}</Link>
              </Button>
            ))}
            {user?.isStaff ? <StaffReviewEntry /> : null}
            {onSignOut ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={onSignOut}
              >
                Sign out
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        aria-label="Main content"
        className="core-content focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {children}
      </main>
      <Separator />
    </div>
  );
}
