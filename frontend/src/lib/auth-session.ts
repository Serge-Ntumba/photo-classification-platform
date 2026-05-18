import type { AuthSession, AuthenticatedUser, RawLoginResponse } from "@/lib/models";
import { toAuthenticatedUser } from "@/lib/models";

export const AUTH_SESSION_STORAGE_KEY = "photo-classification.auth-session";
const AUTH_SESSION_CHANNEL_NAME = "photo-classification.auth";

export type SessionMessage =
  | { type: "signed_out"; at: string }
  | { type: "session_expired"; at: string }
  | { type: "session_updated"; at: string };

const ANONYMOUS_SESSION: AuthSession = {
  accessToken: null,
  user: null,
  status: "anonymous",
  lastVerifiedAt: null,
};

const protectedStateCleanups = new Set<() => void>();

function nowIso() {
  return new Date().toISOString();
}

function createAuthChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  return new BroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
}

function broadcastSessionMessage(message: SessionMessage) {
  const channel = createAuthChannel();
  channel?.postMessage(message);
  channel?.close();
}

function writeSession(session: AuthSession) {
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readAuthSession(): AuthSession {
  const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return ANONYMOUS_SESSION;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (parsed.status !== "authenticated" || !parsed.accessToken || !parsed.user) {
      return ANONYMOUS_SESSION;
    }

    return {
      accessToken: parsed.accessToken,
      user: parsed.user,
      status: "authenticated",
      lastVerifiedAt: parsed.lastVerifiedAt ?? null,
    };
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return ANONYMOUS_SESSION;
  }
}

export function saveAuthSession(accessToken: string, user: AuthenticatedUser) {
  writeSession({
    accessToken,
    user,
    status: "authenticated",
    lastVerifiedAt: nowIso(),
  });
  broadcastSessionMessage({ type: "session_updated", at: nowIso() });
}

export function saveSessionFromLogin(response: RawLoginResponse) {
  if (!response.access || !response.user) {
    throw new Error("Login response did not include an access token and user.");
  }

  saveAuthSession(response.access, toAuthenticatedUser(response.user));
}

export function clearAuthSession(
  reason: "signed_out" | "session_expired" = "signed_out",
) {
  sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  clearProtectedBrowserState();
  broadcastSessionMessage({ type: reason, at: nowIso() });
}

export function registerProtectedStateCleanup(cleanup: () => void) {
  protectedStateCleanups.add(cleanup);

  return () => {
    protectedStateCleanups.delete(cleanup);
  };
}

export function clearProtectedBrowserState() {
  for (const cleanup of protectedStateCleanups) {
    cleanup();
  }
}

export function subscribeToSessionMessages(
  listener: (message: SessionMessage) => void,
) {
  const channel = createAuthChannel();
  if (!channel) {
    return () => undefined;
  }

  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    listener(event.data);
  };

  return () => channel.close();
}

export function getStoredAccessToken() {
  return readAuthSession().accessToken;
}
