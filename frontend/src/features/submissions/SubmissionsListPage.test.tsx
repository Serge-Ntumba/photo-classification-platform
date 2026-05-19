import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";
import { readAuthSession, saveAuthSession } from "@/lib/auth-session";
import type { AuthenticatedUser } from "@/lib/models";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const user: AuthenticatedUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  isStaff: false,
};

const submission = {
  id: "submission-1",
  name: "Profile",
  age: 32,
  place_of_living: "Berlin",
  gender: "User-submitted",
  country_of_origin: "Germany",
  description: "",
  photo: { content_type: "image/jpeg", size_bytes: 1024 },
  status: "pending_classification",
  classification: null,
  created_at: "2026-05-18T10:00:00Z",
  updated_at: "2026-05-18T10:00:00Z",
};

function renderSubmissionsList(initialEntry = "/app/submissions") {
  saveAuthSession("access-token", user);

  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function mockCurrentUser() {
  server.use(
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

describe("SubmissionsListPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockCurrentUser();
  });

  it("renders an empty state with a path to create a submission", async () => {
    server.use(
      http.get(apiUrl("/submissions/"), () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    );

    renderSubmissionsList();

    expect(
      await screen.findByRole("heading", { name: "Submissions" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No submissions yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a submission" })).toHaveAttribute(
      "href",
      "/app/submissions/new",
    );
  });

  it("renders a filtered empty state and sends backend-supported status filters", async () => {
    let lastStatus: string | null = null;
    server.use(
      http.get(apiUrl("/submissions/"), ({ request }) => {
        lastStatus = new URL(request.url).searchParams.get("status");

        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    renderSubmissionsList("/app/submissions?status=classified");

    expect(await screen.findByText("No classified submissions")).toBeInTheDocument();
    expect(lastStatus).toBe("classified");
  });

  it("supports pagination and manual refresh without showing raw page URLs", async () => {
    const actor = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get(apiUrl("/submissions/"), ({ request }) => {
        requestCount += 1;
        const page = new URL(request.url).searchParams.get("page") ?? "1";

        if (page === "2") {
          return HttpResponse.json({
            count: 21,
            next: null,
            previous: "https://private.internal.example/api/submissions/?page=1",
            results: [{ ...submission, id: "submission-older", name: "Older profile" }],
          });
        }

        return HttpResponse.json({
          count: 21,
          next: "https://private.internal.example/api/submissions/?page=2",
          previous: null,
          results: [submission],
        });
      }),
    );

    renderSubmissionsList();

    expect(await screen.findByText("Profile")).toBeInTheDocument();
    expect(screen.queryByText(/private\.internal/)).not.toBeInTheDocument();

    await actor.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(await screen.findByText("Older profile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute(
      "href",
      "/app/submissions",
    );

    await actor.click(screen.getByRole("button", { name: "Refresh submissions" }));

    await waitFor(() => expect(requestCount).toBeGreaterThanOrEqual(3));
    expect(screen.getAllByText(/Last checked:/).length).toBeGreaterThan(0);
  });

  it("shows out-of-range, service unavailable, and session-expired states", async () => {
    server.use(
      http.get(apiUrl("/submissions/"), () =>
        HttpResponse.json({ detail: "Invalid page." }, { status: 404 }),
      ),
    );

    const firstRender = renderSubmissionsList("/app/submissions?page=99");

    expect(await screen.findByText("Page unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to first page" })).toHaveAttribute(
      "href",
      "/app/submissions",
    );
    firstRender.unmount();

    server.use(
      http.get(apiUrl("/submissions/"), () =>
        HttpResponse.json({ detail: "Service unavailable." }, { status: 503 }),
      ),
    );
    const secondRender = renderSubmissionsList();

    expect(
      await screen.findByText("The service is unavailable. Try again later."),
    ).toBeInTheDocument();
    secondRender.unmount();

    server.use(
      http.get(apiUrl("/submissions/"), () =>
        HttpResponse.json({ detail: "Authentication failed." }, { status: 401 }),
      ),
    );
    renderSubmissionsList();

    expect(
      await screen.findByRole("heading", { name: "Sign in to continue" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your session expired. Log in again.")).toBeInTheDocument();
    expect(readAuthSession().status).toBe("anonymous");
  });
});
