import { describe, expect, it } from "vitest";

import {
  toPaginatedSubmissionList,
  toSubmissionDetail,
} from "@/features/submissions/transformers";
import type { RawSubmission } from "@/lib/models";

const hostileSubmission: RawSubmission = {
  id: "submission-1",
  name: "Profile",
  age: 32,
  place_of_living: "Berlin",
  gender: "User-submitted",
  country_of_origin: "Germany",
  description: "Optional context",
  photo: {
    object_key: "uploads/submissions/private/Alex_Morgan_Germany_profile.jpg",
    original_filename: "Alex_Morgan_Germany_profile.jpg",
    content_type: "image/jpeg; signedURL=https://storage.internal/private",
    size_bytes: 1024,
  },
  status: "classified",
  classification: {
    category: "valid_profile_candidate",
    review_decision: "passes_automated_checks",
    reasons: [
      "Required metadata was incomplete.",
      "signedURL https://storage.internal/private?X-Amz-Signature=secret",
      "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
      "private object key uploads/submissions/private/profile.jpg",
      "classifier endpoint http://classifier:8000/classify",
      "The person is trustworthy",
    ],
    provider: "internal-provider",
    classifier_version: "secret-version",
    schema_version: "2026-05",
    score: 0.98,
    confidence_score: 0.97,
    raw_prompt: "Classify the person.",
    raw_response: { apiKey: "secret-api-key" },
    provider_metadata: {
      signedURL: "https://storage.internal/private?token=secret",
    },
    error_code: "PRIVATE_ERROR",
    classification_duration_ms: 42,
    classified_at: "2026-05-18T12:30:00Z",
  },
  created_at: "2026-05-18T10:00:00Z",
  updated_at: "2026-05-18T12:30:00Z",
};

describe("safe submission display contract", () => {
  it("drops private photo fields and raw classifier fields from detail models", () => {
    const detail = toSubmissionDetail(hostileSubmission, "2026-05-18T12:31:00Z");
    const serialized = JSON.stringify(detail);

    expect(detail).toMatchObject({
      id: "submission-1",
      status: "classified",
      classification: {
        category: "valid_profile_candidate",
        reviewDecision: "passes_automated_checks",
        reasons: ["Required metadata was incomplete."],
        classifiedAt: "2026-05-18T12:30:00Z",
      },
    });
    expect(detail.fileFacts).toEqual({ contentType: null, sizeBytes: 1024 });
    expect(serialized).not.toContain("object_key");
    expect(serialized).not.toContain("original_filename");
    expect(serialized).not.toContain("Alex_Morgan_Germany_profile.jpg");
    expect(serialized).not.toContain("internal-provider");
    expect(serialized).not.toContain("secret-version");
    expect(serialized).not.toContain("schema_version");
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("confidence_score");
    expect(serialized).not.toContain("raw_prompt");
    expect(serialized).not.toContain("raw_response");
    expect(serialized).not.toContain("provider_metadata");
    expect(serialized).not.toContain("PRIVATE_ERROR");
    expect(serialized).not.toContain("classification_duration_ms");
    expect(serialized).not.toContain("storage.internal");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("classifier:8000");
    expect(serialized).not.toContain("The person is trustworthy");
  });

  it("does not expose backend pagination URLs or unsafe fields in list models", () => {
    const page = toPaginatedSubmissionList(
      {
        count: 1,
        next: "https://minio.internal/private?page=2&token=secret",
        previous: null,
        results: [hostileSubmission],
      },
      1,
      null,
    );
    const serialized = JSON.stringify(page);

    expect(page.hasNextPage).toBe(true);
    expect(page.nextPage).toBe(2);
    expect(page.results[0]?.classification?.reasons).toEqual([
      "Required metadata was incomplete.",
    ]);
    expect(serialized).not.toContain("minio.internal");
    expect(serialized).not.toContain("token=secret");
    expect(serialized).not.toContain("Alex_Morgan_Germany_profile.jpg");
    expect(serialized).not.toContain("raw_response");
    expect(serialized).not.toContain("internal-provider");
    expect(serialized).not.toContain("classifier:8000");
  });

  it("uses generic review fallback when all allowlisted reasons are unsafe", () => {
    const detail = toSubmissionDetail({
      ...hostileSubmission,
      classification: {
        category: "valid_profile_candidate",
        review_decision: "passes_automated_checks",
        reasons: [
          "rawPrompt: classify this person",
          "imageBytes: /9j/private",
          "apiKey sk-private",
        ],
        classified_at: "2026-05-18T12:30:00Z",
      },
    });

    expect(detail.classification?.reasons).toEqual(["Review details are unavailable."]);
  });
});
