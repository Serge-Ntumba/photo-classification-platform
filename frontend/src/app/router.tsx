import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSession } from "@/app/providers";
import { NotFoundPage } from "@/routes/NotFoundPage";

function PublicHome() {
  const { session } = useSession();

  if (session.status === "authenticated") {
    return <Navigate to="/app" replace />;
  }

  return (
    <PublicLayout>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal text-foreground">
        Photo Classification Platform
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Register or log in to create photo submissions and review asynchronous
        classification status.
      </p>
    </PublicLayout>
  );
}

function LoginPlaceholder() {
  return (
    <PublicLayout>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
        Sign in to continue
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Your session is required before this protected workflow can show submission
        data.
      </p>
    </PublicLayout>
  );
}

function RegisterPlaceholder() {
  return (
    <PublicLayout>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
        Create an account
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Registration will be implemented in the first user-story phase.
      </p>
    </PublicLayout>
  );
}

function WorkspacePlaceholder() {
  const { session, signOut } = useSession();

  return (
    <AppShell user={session.user} onSignOut={signOut}>
      <section>
        <h1 className="text-2xl font-semibold tracking-normal">Workspace</h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
          Submission workflows will be connected in the user-story phases.
        </p>
      </section>
    </AppShell>
  );
}

function ProtectedPlaceholder({ title }: { title: string }) {
  const { session, signOut } = useSession();

  return (
    <AppShell user={session.user} onSignOut={signOut}>
      <section>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
          This protected route is reserved for the corresponding workflow phase.
        </p>
      </section>
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();

  if (session.status !== "authenticated") {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route path="/register" element={<RegisterPlaceholder />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WorkspacePlaceholder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions/new"
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder title="Create submission" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions"
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder title="Submissions" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions/:id"
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder title="Submission detail" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
