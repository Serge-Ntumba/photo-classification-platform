import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";
import { saveAuthSession } from "@/lib/auth-session";
import type { AuthenticatedUser } from "@/lib/models";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const regularUser: AuthenticatedUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  isStaff: false,
};

const staffUser: AuthenticatedUser = {
  id: "staff-1",
  email: "staff@example.com",
  username: "staff1",
  isStaff: true,
};

function rawUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    is_staff: user.isStaff,
  };
}

function renderApp(initialEntry: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function mockCurrentUser(user: AuthenticatedUser) {
  server.use(http.get(apiUrl("/auth/me/"), () => HttpResponse.json(rawUser(user))));
}

describe("staff review entry", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows a Django Admin review entry and separate-login copy for staff users", async () => {
    saveAuthSession("staff-access-token", staffUser);
    mockCurrentUser(staffUser);

    renderApp("/app");

    const navigation = await screen.findByRole("navigation", {
      name: "Workspace navigation",
    });
    const staffLink = within(navigation).getByRole("link", {
      name: "Staff review",
    });

    expect(staffLink).toHaveAttribute("href", "/admin/");
    expect(
      screen.getByText("Django Admin may require a separate admin login."),
    ).toBeInTheDocument();
  });

  it("does not show staff review controls for regular authenticated users", async () => {
    saveAuthSession("regular-access-token", regularUser);
    mockCurrentUser(regularUser);

    renderApp("/app");

    expect(
      await screen.findByRole("heading", { name: "Workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Staff review" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Django Admin/i)).not.toBeInTheDocument();
  });

  it("refreshes staff visibility on protected navigation after current-user changes", async () => {
    let currentUser = regularUser;
    saveAuthSession("changing-access-token", regularUser);
    server.use(
      http.get(apiUrl("/auth/me/"), () => HttpResponse.json(rawUser(currentUser))),
    );

    const actor = userEvent.setup();
    renderApp("/app");

    expect(
      await screen.findByRole("heading", { name: "Workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Staff review" }),
    ).not.toBeInTheDocument();

    const navigation = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });

    currentUser = staffUser;
    await actor.click(within(navigation).getByRole("link", { name: "Submissions" }));

    expect(
      await screen.findByRole("heading", { name: "Submissions" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Staff review" })).toHaveAttribute(
      "href",
      "/admin/",
    );
  });

  it("keeps direct /admin frontend attempts as a neutral fallback, not custom admin UI", async () => {
    renderApp("/admin");

    expect(
      screen.getByRole("heading", { name: "Admin area is not hosted here" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This frontend does not build or duplicate the admin panel."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve|reject|reclassify/i }),
    ).not.toBeInTheDocument();
  });
});
