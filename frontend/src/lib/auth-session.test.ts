import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_STORAGE_KEY,
  clearAuthSession,
  readAuthSession,
  saveSessionFromLogin,
  subscribeToSessionMessages,
} from "@/lib/auth-session";
import type { AuthenticatedUser } from "@/lib/models";

const user: AuthenticatedUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  isStaff: false,
};

class FakeBroadcastChannel {
  static channels: FakeBroadcastChannel[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public readonly name: string) {
    FakeBroadcastChannel.channels.push(this);
  }

  postMessage(message: unknown) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel.name === this.name && channel !== this) {
        channel.onmessage?.({ data: message } as MessageEvent);
      }
    }
  }

  close() {
    FakeBroadcastChannel.channels = FakeBroadcastChannel.channels.filter(
      (channel) => channel !== this,
    );
  }
}

describe("auth session storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    FakeBroadcastChannel.channels = [];
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("stores only active browser-session auth state in sessionStorage", () => {
    saveSessionFromLogin({
      access: "access-token",
      refresh: "refresh-token",
      user,
    });

    expect(readAuthSession()).toMatchObject({
      status: "authenticated",
      accessToken: "access-token",
      user,
    });
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toContain("access-token");
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).not.toContain(
      "refresh-token",
    );
  });

  it("clears token and safe account state on sign-out", () => {
    saveSessionFromLogin({ access: "access-token", refresh: "ignored", user });
    clearAuthSession("signed_out");

    expect(readAuthSession()).toMatchObject({
      status: "anonymous",
      accessToken: null,
      user: null,
    });
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("broadcasts sign-out messages across same-browser tabs", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionMessages(listener);

    clearAuthSession("signed_out");

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signed_out" }),
    );

    unsubscribe();
  });
});
