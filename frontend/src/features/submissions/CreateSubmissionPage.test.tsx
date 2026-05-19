import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function photoFile() {
  return new File(["photo"], "local-secret-name.jpg", { type: "image/jpeg" });
}

function renderCreateSubmissionPage() {
  saveAuthSession("access-token", user);

  return render(
    <AppProviders>
      <MemoryRouter initialEntries={["/app/submissions/new"]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

async function fillValidSubmission(actor: ReturnType<typeof userEvent.setup>) {
  await actor.upload(screen.getByLabelText("Photo"), photoFile());
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Alex Profile" },
  });
  fireEvent.change(screen.getByLabelText("Age"), { target: { value: "32" } });
  fireEvent.change(screen.getByLabelText("Place of living"), {
    target: { value: "Berlin" },
  });
  fireEvent.change(screen.getByLabelText("Gender"), {
    target: { value: "User-submitted" },
  });
  fireEvent.change(screen.getByLabelText("Country of origin"), {
    target: { value: "Germany" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Optional context" },
  });
}

function mockPreviewSupport() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 320;
    naturalHeight = 320;
    width = 320;
    height = 320;

    set src(_value: string) {
      window.setTimeout(() => this.onload?.(), 0);
    }
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: TestImage,
  });
}

describe("CreateSubmissionPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockPreviewSupport();
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
  });

  it("preserves field values and maps backend validation to field and file errors", async () => {
    server.use(
      http.post(apiUrl("/submissions/"), () =>
        HttpResponse.json(
          {
            age: ["Age must be between 0 and 120."],
            photo: ["Uploaded image exceeds the maximum size."],
          },
          { status: 400 },
        ),
      ),
    );
    const actor = userEvent.setup();
    renderCreateSubmissionPage();

    expect(
      await screen.findByRole("heading", { name: "Create submission" }),
    ).toBeInTheDocument();
    await fillValidSubmission(actor);
    await actor.click(screen.getByRole("button", { name: "Create submission" }));

    expect(await screen.findAllByText("Age must be between 0 and 120.")).toHaveLength(
      2,
    );
    expect(
      screen.getByText("Uploaded image exceeds the maximum size."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Alex Profile");
    expect(screen.getByLabelText("Place of living")).toHaveValue("Berlin");
    expect(screen.getByText("Photo selected")).toBeInTheDocument();
  });

  it("prevents duplicate create requests while submission is in flight", async () => {
    let requestCount = 0;
    let resolveRequest: (() => void) | undefined;
    server.use(
      http.post(apiUrl("/submissions/"), async () => {
        requestCount += 1;
        await new Promise<void>((resolve) => {
          resolveRequest = resolve;
        });

        return HttpResponse.json(
          {
            id: "submission-created",
            name: "Alex Profile",
            age: 32,
            place_of_living: "Berlin",
            gender: "User-submitted",
            country_of_origin: "Germany",
            description: "Optional context",
            photo: { content_type: "image/jpeg", size_bytes: 1024 },
            status: "pending_classification",
            classification: null,
            created_at: "2026-05-18T10:00:00Z",
            updated_at: "2026-05-18T10:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    const actor = userEvent.setup();
    renderCreateSubmissionPage();

    await screen.findByRole("heading", { name: "Create submission" });
    await fillValidSubmission(actor);
    const submit = screen.getByRole("button", { name: "Create submission" });
    await actor.click(submit);
    await actor.click(screen.getByRole("button", { name: "Submitting" }));

    expect(requestCount).toBe(1);
    resolveRequest?.();
    expect(await screen.findByText("Submission created")).toBeInTheDocument();
  });

  it("shows the created pending state and clears the selected photo after success", async () => {
    server.use(
      http.post(apiUrl("/submissions/"), () =>
        HttpResponse.json(
          {
            id: "submission-created",
            name: "Alex Profile",
            age: 32,
            place_of_living: "Berlin",
            gender: "User-submitted",
            country_of_origin: "Germany",
            description: "Optional context",
            photo: {
              object_key: "uploads/submissions/private/profile.jpg",
              original_filename: "local-secret-name.jpg",
              content_type: "image/jpeg",
              size_bytes: 1024,
            },
            status: "pending_classification",
            classification: null,
            created_at: "2026-05-18T10:00:00Z",
            updated_at: "2026-05-18T10:00:00Z",
          },
          { status: 201 },
        ),
      ),
    );
    const actor = userEvent.setup();
    renderCreateSubmissionPage();

    await screen.findByRole("heading", { name: "Create submission" });
    await fillValidSubmission(actor);
    await actor.click(screen.getByRole("button", { name: "Create submission" }));

    expect(await screen.findByText("Submission created")).toBeInTheDocument();
    expect(screen.getByText("Pending classification")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open created submission" }),
    ).toHaveAttribute("href", "/app/submissions/submission-created");
    expect(screen.getByText("No photo selected")).toBeInTheDocument();
    expect(screen.queryByText("local-secret-name.jpg")).not.toBeInTheDocument();
  });

  it("guides users to check submissions when creation outcome is uncertain", async () => {
    server.use(http.post(apiUrl("/submissions/"), () => HttpResponse.error()));
    const actor = userEvent.setup();
    renderCreateSubmissionPage();

    await screen.findByRole("heading", { name: "Create submission" });
    await fillValidSubmission(actor);
    await actor.click(screen.getByRole("button", { name: "Create submission" }));

    expect(
      await screen.findByText(
        "The request could not be confirmed. Check submissions before retrying.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check submissions" })).toHaveAttribute(
      "href",
      "/app/submissions",
    );
  });
});
