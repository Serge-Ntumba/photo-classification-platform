import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "@/lib/api-client";
import { getSubmission } from "@/features/submissions/api";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const rawSubmission = {
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

describe("submission detail API consumption", () => {
  it("maps 403 and 404 to the same neutral not-found/access error", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );

    await expect(
      getSubmission(createApiClient({ apiBaseUrl: "/api" }), "submission-1"),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      scope: "not_found",
      recoverability: "navigate_elsewhere",
    });

    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({ detail: "Not found" }, { status: 404 }),
      ),
    );

    await expect(
      getSubmission(createApiClient({ apiBaseUrl: "/api" }), "submission-1"),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      scope: "not_found",
      recoverability: "navigate_elsewhere",
    });
  });

  it("returns pending detail data with a deterministic last-checked timestamp", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json(rawSubmission),
      ),
    );

    const detail = await getSubmission(
      createApiClient({ apiBaseUrl: "/api" }),
      "submission-1",
      "2026-05-18T12:00:00Z",
    );

    expect(detail).toMatchObject({
      id: "submission-1",
      status: "pending_classification",
      lastCheckedAt: "2026-05-18T12:00:00Z",
      metadata: {
        name: "Profile",
        placeOfLiving: "Berlin",
        countryOfOrigin: "Germany",
      },
    });
  });

  it("does not stamp detail responses unless a checked timestamp is supplied", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json(rawSubmission),
      ),
    );

    const detail = await getSubmission(
      createApiClient({ apiBaseUrl: "/api" }),
      "submission-1",
    );

    expect(detail.lastCheckedAt).toBeNull();
  });

  it("transforms a completed response into the safe display model", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({
          ...rawSubmission,
          status: "classified",
          classification: {
            category: "valid_profile_candidate",
            review_decision: "passes_automated_checks",
            reasons: ["Required review checks passed."],
            provider: "internal-provider",
            classifier_version: "secret-version",
            score: 0.98,
            raw_response: { token: "secret" },
            provider_metadata: { signed_url: "https://storage.example/private" },
            classified_at: "2026-05-18T12:30:00Z",
          },
        }),
      ),
    );

    const detail = await getSubmission(
      createApiClient({ apiBaseUrl: "/api" }),
      "submission-1",
      "2026-05-18T12:31:00Z",
    );
    const serialized = JSON.stringify(detail);

    expect(detail.classification).toEqual({
      category: "valid_profile_candidate",
      reviewDecision: "passes_automated_checks",
      reasons: ["Required review checks passed."],
      classifiedAt: "2026-05-18T12:30:00Z",
    });
    expect(serialized).not.toContain("internal-provider");
    expect(serialized).not.toContain("secret-version");
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("raw_response");
    expect(serialized).not.toContain("provider_metadata");
    expect(serialized).not.toContain("Alex_Morgan");
  });

  it("falls back for unexpected enum values without exposing raw values", async () => {
    server.use(
      http.get(apiUrl("/submissions/submission-1/"), () =>
        HttpResponse.json({
          ...rawSubmission,
          status: "secret_internal_status",
          classification: {
            category: "provider_specific_category",
            review_decision: "model_says_person_attractive",
            reasons: ["bearer secret-token"],
            classified_at: "not-a-secret",
          },
        }),
      ),
    );

    const detail = await getSubmission(
      createApiClient({ apiBaseUrl: "/api" }),
      "submission-1",
      "2026-05-18T12:31:00Z",
    );
    const serialized = JSON.stringify(detail);

    expect(detail.status).toBeNull();
    expect(detail.classification).toMatchObject({
      category: null,
      reviewDecision: null,
      reasons: ["Review details are unavailable."],
    });
    expect(serialized).not.toContain("secret_internal_status");
    expect(serialized).not.toContain("provider_specific_category");
    expect(serialized).not.toContain("model_says_person_attractive");
    expect(serialized).not.toContain("secret-token");
  });
});
