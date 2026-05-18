import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-10">
        <p className="text-sm font-medium text-muted-foreground">
          Photo Classification Platform
        </p>
        {children}
        <nav className="mt-8 flex flex-wrap gap-3" aria-label="Public navigation">
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            to="/login"
          >
            Log in
          </Link>
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            to="/register"
          >
            Register
          </Link>
        </nav>
      </section>
    </main>
  );
}
