import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "@/lib/api-client";
import { listSubmissions } from "@/features/submissions/api";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const newestSubmission = {
  id: "submission-newest",
  name: "Newest profile",
  age: 31,
  place_of_living: "Berlin",
  gender: "User-submitted",
  country_of_origin: "Germany",
  description: "",
  photo: {
    object_key: "uploads/submissions/private/newest.jpg",
    original_filename: "secret-newest.jpg",
    content_type: "image/jpeg",
    size_bytes: 1024,
  },
  status: "classified",
  classification: {
    category: "valid_profile_candidate",
    review_decision: "passes_automated_checks",
    reasons: ["Required review checks passed."],
    provider: "internal-provider",
    score: 0.99,
    classified_at: "2026-05-18T11:00:00Z",
  },
  created_at: "2026-05-18T11:00:00Z",
  updated_at: "2026-05-18T11:05:00Z",
};

const olderSubmission = {
  ...newestSubmission,
  id: "submission-older",
  name: "Older profile",
  created_at: "2026-05-17T11:00:00Z",
  updated_at: "2026-05-17T11:05:00Z",
};

describe("list submissions API consumption", () => {
  it("requests backend page/status filters and preserves backend newest-first order", async () => {
    let capturedUrl = new URL("http://localhost:5173/api/submissions/");
    server.use(
      http.get(apiUrl("/submissions/"), ({ request }) => {
        capturedUrl = new URL(request.url);

        return HttpResponse.json({
          count: 21,
          next: "https://private.internal.example/api/submissions/?page=3",
          previous: "https://private.internal.example/api/submissions/?page=1",
          results: [newestSubmission, olderSubmission],
        });
      }),
    );

    const page = await listSubmissions(createApiClient({ apiBaseUrl: "/api" }), {
      page: 2,
      status: "classified",
    });

    expect(capturedUrl.searchParams.get("page")).toBe("2");
    expect(capturedUrl.searchParams.get("status")).toBe("classified");
    expect(capturedUrl.searchParams.has("ordering")).toBe(false);
    expect(page).toMatchObject({
      count: 21,
      page: 2,
      statusFilter: "classified",
      hasNextPage: true,
      hasPreviousPage: true,
      nextPage: 3,
      previousPage: 1,
    });
    expect(page.results.map((submission) => submission.id)).toEqual([
      "submission-newest",
      "submission-older",
    ]);
  });

  it("does not expose raw backend pagination URLs or unsafe backend fields", async () => {
    server.use(
      http.get(apiUrl("/submissions/"), () =>
        HttpResponse.json({
          count: 1,
          next: "https://object-storage.internal/private?page=2&token=secret",
          previous: null,
          results: [newestSubmission],
        }),
      ),
    );

    const page = await listSubmissions(createApiClient({ apiBaseUrl: "/api" }), {
      page: 1,
    });
    const serialized = JSON.stringify(page);

    expect(page.hasNextPage).toBe(true);
    expect(page.nextPage).toBe(2);
    expect(serialized).not.toContain("object-storage.internal");
    expect(serialized).not.toContain("token=secret");
    expect(serialized).not.toContain("object_key");
    expect(serialized).not.toContain("original_filename");
    expect(serialized).not.toContain("internal-provider");
    expect(serialized).not.toContain("score");
  });
});
