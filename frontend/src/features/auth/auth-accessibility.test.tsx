import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

function renderApp(initialEntry: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("auth form accessibility", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("exposes labels and no staff/admin controls on the registration form", () => {
    renderApp("/register");

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText(/staff/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/admin/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });

  it("moves focus to the first invalid registration field", async () => {
    const actor = userEvent.setup();
    renderApp("/register");

    await actor.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");
  });

  it("submits the login form from the keyboard", async () => {
    server.use(
      http.post(apiUrl("/auth/login/"), () =>
        HttpResponse.json({
          access: "access-token",
          refresh: "refresh-token",
          user: {
            id: "user-1",
            email: "user@example.com",
            username: "user1",
            is_staff: false,
          },
        }),
      ),
      http.get(apiUrl("/auth/me/"), () =>
        HttpResponse.json({
          id: "user-1",
          email: "user@example.com",
          username: "user1",
          is_staff: false,
        }),
      ),
    );
    const actor = userEvent.setup();
    renderApp("/login");

    await actor.type(screen.getByLabelText("Email"), "user@example.com");
    await actor.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await actor.keyboard("{Enter}");

    expect(
      await screen.findByRole("heading", { name: "Workspace" }),
    ).toBeInTheDocument();
  });

  it("announces generic login errors", async () => {
    server.use(
      http.post(apiUrl("/auth/login/"), () =>
        HttpResponse.json(
          { detail: "Wrong password for user@example.com" },
          { status: 400 },
        ),
      ),
    );
    const actor = userEvent.setup();
    renderApp("/login");

    await actor.type(screen.getByLabelText("Email"), "user@example.com");
    await actor.type(screen.getByLabelText("Password"), "wrong");
    await actor.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to log in with the provided credentials.",
    );
    expect(screen.queryByText(/Wrong password/)).not.toBeInTheDocument();
  });
});
