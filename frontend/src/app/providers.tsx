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
  getStoredAccessToken,
  readAuthSession,
  subscribeToSessionMessages,
} from "@/lib/auth-session";
import type { AuthSession } from "@/lib/models";

type ApiClient = ReturnType<typeof createApiClient>;

type SessionContextValue = {
  session: AuthSession;
  apiClient: ApiClient;
  protectedDataVersion: number;
  expireSession: () => void;
  signOut: () => void;
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

  useEffect(() => {
    return subscribeToSessionMessages((message) => {
      if (message.type === "session_updated") {
        setSession(readAuthSession());
      } else if (message.type === "session_expired") {
        setSession(expiredSession());
        clearProtectedData();
      } else if (message.type === "signed_out") {
        setSession(readAuthSession());
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
    }),
    [apiClient, expireSession, protectedDataVersion, session, signOut],
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
