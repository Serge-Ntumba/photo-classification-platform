import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";
import {
  AUTH_SESSION_STORAGE_KEY,
  readAuthSession,
  saveAuthSession,
} from "@/lib/auth-session";
import type { AuthenticatedUser } from "@/lib/models";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const user: AuthenticatedUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  isStaff: false,
};

function renderApp(initialEntry: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function mockLoginSuccess() {
  server.use(
    http.post(apiUrl("/auth/login/"), () =>
      HttpResponse.json({
        access: "access-token",
        refresh: "refresh-token",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          is_staff: user.isStaff,
        },
      }),
    ),
    http.get(apiUrl("/auth/me/"), () =>
      HttpResponse.json({
        id: user.id,
        email: user.email,
        username: user.username,
        is_staff: user.isStaff,
      }),
    ),
  );
}

describe("auth route flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockLoginSuccess();
  });

  it("returns a visitor to an allowed protected deep link after login", async () => {
    const actor = userEvent.setup();
    renderApp("/app/submissions?status=classified");

    expect(
      screen.getByRole("heading", { name: "Sign in to continue" }),
    ).toBeInTheDocument();

    await actor.type(screen.getByLabelText("Email"), user.email);
    await actor.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await actor.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", { name: "Submissions" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("access-token")).not.toBeInTheDocument();
    expect(screen.queryByText("refresh-token")).not.toBeInTheDocument();
  });

  it("uses a neutral workspace fallback for unsafe return targets", async () => {
    const actor = userEvent.setup();
    renderApp("/login?returnTo=https%3A%2F%2Fevil.example%2Fapp");

    await actor.type(screen.getByLabelText("Email"), user.email);
    await actor.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await actor.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", { name: "Workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We could not return to the requested page."),
    ).toBeInTheDocument();
  });

  it("clears protected data and prompts login again when the session expires", async () => {
    saveAuthSession("expired-token", user);
    server.use(
      http.get(apiUrl("/auth/me/"), () =>
        HttpResponse.json(
          { error: { code: "not_authenticated", detail: "Authentication failed." } },
          { status: 401 },
        ),
      ),
    );

    renderApp("/app");

    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your session expired. Log in again.")).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
    expect(readAuthSession().status).toBe("anonymous");
  });

  it("signs out, clears session storage, and returns to public auth flow", async () => {
    saveAuthSession("access-token", user);
    const actor = userEvent.setup();
    renderApp("/app");

    expect(await screen.findByText(`Signed in as ${user.email}`)).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    });
    expect(readAuthSession().status).toBe("anonymous");
  });
});
