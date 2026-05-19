import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useApiClient, useSession } from "@/app/providers";
import { LoadingState, SafeErrorState } from "@/components/layout/feedback";
import { getCurrentUser } from "@/features/auth/api";
import { isApiError } from "@/lib/api-client";
import { defaultErrorMessage } from "@/lib/safe-display";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const apiClient = useApiClient();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const { expireSession, session, updateAuthenticatedUser } = useSession();
  const [checkResult, setCheckResult] = useState<{
    accessToken: string | null;
    errorMessage: string | null;
    isReady: boolean;
    routeKey: string | null;
  }>({
    accessToken: null,
    errorMessage: null,
    isReady: false,
    routeKey: null,
  });

  useEffect(() => {
    if (session.status !== "authenticated") {
      return undefined;
    }

    let cancelled = false;

    getCurrentUser(apiClient)
      .then((user) => {
        if (cancelled) {
          return;
        }
        updateAuthenticatedUser(user);
        setCheckResult({
          accessToken: session.accessToken,
          errorMessage: null,
          isReady: true,
          routeKey,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isApiError(error) && error.scope === "session") {
          expireSession();
          return;
        }
        setCheckResult({
          accessToken: session.accessToken,
          errorMessage: isApiError(error)
            ? error.message
            : defaultErrorMessage("unknown"),
          isReady: true,
          routeKey,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    expireSession,
    routeKey,
    session.accessToken,
    session.status,
    updateAuthenticatedUser,
  ]);

  if (session.status !== "authenticated") {
    return null;
  }

  if (
    !checkResult.isReady ||
    checkResult.accessToken !== session.accessToken ||
    checkResult.routeKey !== routeKey
  ) {
    return <LoadingState label="Checking session" />;
  }

  if (checkResult.errorMessage) {
    return (
      <SafeErrorState
        title="Workspace unavailable"
        message={checkResult.errorMessage}
      />
    );
  }

  return <>{children}</>;
}
