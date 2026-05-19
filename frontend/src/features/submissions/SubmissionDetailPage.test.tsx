import { render, screen, waitFor } from "@testing-library/react";
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

const user: AuthenticatedUser = {
  id: "user-1",
  email: "user@example.com",
  username: "user1",
  isStaff: false,
};

const pendingSubmission = {
  id: "submission-1",
  name: "Profile",
  age: 32,
  place_of_living: "Berlin",
  gender: "User-submitted",
  country_of_origin: "Germany",
  description: "Optional context",
  photo: {
    object_key: "uploads/submissions/private/profile.jpg",
    original_filename: "Alex_Morgan_token_profile.jpg",
    content_type: "image/jpeg",
    size_bytes: 1024,
  },
  status: "pending_classification",
  classification: null,
  created_at: "2026-05-18T10:00:00Z",
  updated_at: "2026-05-18T10:00:00Z",
};

function renderSubmissionDetail() {
  saveAuthSession("access-token", user);

  return render(
    <AppProviders>
      <MemoryRouter initialEntries={["/app/submissions/submission-1"]}>
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

describe("SubmissionDetailPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockCurrentUser();
  });

  it("shows status, last checked time, return navigation, and refreshed results", async () => {
    const actor = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () => {
        requestCount += 1;

        if (requestCount > 1) {
          return HttpResponse.json({
            ...pendingSubmission,
            status: "classified",
            classification: {
              category: "valid_profile_candidate",
              review_decision: "passes_automated_checks",
              reasons: ["Required review checks passed."],
              classified_at: "2026-05-18T12:00:00Z",
            },
            updated_at: "2026-05-18T12:00:00Z",
          });
        }

        return HttpResponse.json(pendingSubmission);
      }),
    );

    renderSubmissionDetail();

    expect(
      await screen.findByRole("heading", { name: "Submission detail" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Pending classification")).toBeInTheDocument();
    expect(screen.getAllByText(/Last checked:/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Return to submissions" })).toHaveAttribute(
      "href",
      "/app/submissions",
    );
    expect(screen.queryByText("Alex_Morgan_token_profile.jpg")).not.toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Refresh status" }));

    expect(await screen.findByText("Automated checks completed")).toBeInTheDocument();
    expect(screen.getByText("Passes automated checks")).toBeInTheDocument();
    expect(screen.getByText("Required review checks passed.")).toBeInTheDocument();
  });

  it("shows a generic unavailable classification fallback", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({
          ...pendingSubmission,
          status: "classified",
          classification: {
            category: "unexpected_internal_category",
            review_decision: "secret_model_decision",
            reasons: ["signed_url=https://storage.example/private"],
            classified_at: "2026-05-18T12:00:00Z",
          },
        }),
      ),
    );

    renderSubmissionDetail();

    expect(await screen.findByText("Automated checks completed")).toBeInTheDocument();
    expect(screen.getAllByText("Review unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("Review details are unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("unexpected_internal_category")).not.toBeInTheDocument();
    expect(screen.queryByText("secret_model_decision")).not.toBeInTheDocument();
    expect(screen.queryByText(/storage\.example/)).not.toBeInTheDocument();
  });

  it("uses neutral copy for denied or missing submissions", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );

    renderSubmissionDetail();

    expect(await screen.findByText("Submission unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The requested submission could not be found or cannot be accessed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to submissions" })).toHaveAttribute(
      "href",
      "/app/submissions",
    );

    await waitFor(() => {
      expect(screen.queryByText("Forbidden")).not.toBeInTheDocument();
    });
  });

  it("does not render unsupported submission actions", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({
          ...pendingSubmission,
          status: "classified",
          classification: {
            category: "valid_profile_candidate",
            review_decision: "passes_automated_checks",
            reasons: ["Required review checks passed."],
            classified_at: "2026-05-18T12:00:00Z",
          },
        }),
      ),
    );

    renderSubmissionDetail();

    expect(
      await screen.findByRole("heading", { name: "Submission detail" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /delete/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry classification/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reclassify/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /manual approve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /show uploaded photo/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /download photo/i }),
    ).not.toBeInTheDocument();
  });
});
