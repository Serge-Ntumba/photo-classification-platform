import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createApiClient } from "@/lib/api-client";
import {
  clearAuthSession,
  clearProtectedBrowserState,
  getStoredAccessToken,
  readAuthSession,
  saveAuthSession,
  subscribeToSessionMessages,
} from "@/lib/auth-session";
import type { AuthSession, AuthenticatedUser } from "@/lib/models";

type ApiClient = ReturnType<typeof createApiClient>;

type SessionContextValue = {
  session: AuthSession;
  apiClient: ApiClient;
  protectedDataVersion: number;
  expireSession: () => void;
  signOut: () => void;
  setAuthenticatedSession: (accessToken: string, user: AuthenticatedUser) => void;
  updateAuthenticatedUser: (user: AuthenticatedUser) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function expiredSession(): AuthSession {
  return {
    accessToken: null,
    user: null,
    status: "expired",
    lastVerifiedAt: null,
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>(() => readAuthSession());
  const [protectedDataVersion, setProtectedDataVersion] = useState(0);

  const clearProtectedData = useCallback(() => {
    setProtectedDataVersion((version) => version + 1);
  }, []);

  const expireSession = useCallback(() => {
    clearAuthSession("session_expired");
    setSession(expiredSession());
    clearProtectedData();
  }, [clearProtectedData]);

  const signOut = useCallback(() => {
    clearAuthSession("signed_out");
    setSession(readAuthSession());
    clearProtectedData();
  }, [clearProtectedData]);

  const setAuthenticatedSession = useCallback(
    (accessToken: string, user: AuthenticatedUser) => {
      saveAuthSession(accessToken, user);
      setSession(readAuthSession());
      clearProtectedData();
    },
    [clearProtectedData],
  );

  const updateAuthenticatedUser = useCallback((user: AuthenticatedUser) => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      return;
    }
    saveAuthSession(accessToken, user);
    setSession(readAuthSession());
  }, []);

  useEffect(() => {
    return subscribeToSessionMessages((message) => {
      if (message.type === "session_updated") {
        setSession(readAuthSession());
      } else if (message.type === "session_expired") {
        setSession(expiredSession());
        clearProtectedBrowserState();
        clearProtectedData();
      } else if (message.type === "signed_out") {
        setSession(readAuthSession());
        clearProtectedBrowserState();
        clearProtectedData();
      }
    });
  }, [clearProtectedData]);

  const apiClient = useMemo(
    () =>
      createApiClient({
        getAccessToken: getStoredAccessToken,
        onUnauthorized: expireSession,
      }),
    [expireSession],
  );

  const value = useMemo(
    () => ({
      session,
      apiClient,
      protectedDataVersion,
      expireSession,
      signOut,
      setAuthenticatedSession,
      updateAuthenticatedUser,
    }),
    [
      apiClient,
      expireSession,
      protectedDataVersion,
      session,
      setAuthenticatedSession,
      signOut,
      updateAuthenticatedUser,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within AppProviders.");
  }

  return context;
}

export function useApiClient() {
  return useSession().apiClient;
}
