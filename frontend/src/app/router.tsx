import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { useSession } from "@/app/providers";
import { SessionBoundary } from "@/features/auth/components/SessionBoundary";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { WorkspacePage } from "@/features/auth/pages/WorkspacePage";
import { CreateSubmissionPage } from "@/features/submissions/pages/CreateSubmissionPage";
import { SubmissionDetailPage } from "@/features/submissions/pages/SubmissionDetailPage";
import { SubmissionsListPage } from "@/features/submissions/pages/SubmissionsListPage";
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();

  if (session.status !== "authenticated") {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    const sessionQuery = session.status === "expired" ? "&session=expired" : "";

    return <Navigate to={`/login?returnTo=${returnTo}${sessionQuery}`} replace />;
  }

  return <SessionBoundary>{children}</SessionBoundary>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions/new"
        element={
          <ProtectedRoute>
            <CreateSubmissionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions"
        element={
          <ProtectedRoute>
            <SubmissionsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/submissions/:id"
        element={
          <ProtectedRoute>
            <SubmissionDetailPage />
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
