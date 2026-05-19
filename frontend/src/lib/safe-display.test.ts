import { describe, expect, it } from "vitest";

import {
  formatDisplayDateTime,
  getCategoryLabel,
  getDecisionLabel,
  getStatusDisplay,
  isUnsafeDisplayValue,
  safeDocumentTitle,
  safeClassificationReasons,
  safeErrorMessage,
} from "@/lib/safe-display";

describe("safe display helpers", () => {
  it("maps known submission statuses to safe labels and guidance", () => {
    expect(getStatusDisplay("pending_classification")).toMatchObject({
      label: "Pending classification",
      isFinal: false,
    });
    expect(getStatusDisplay("classifying")).toMatchObject({
      label: "Classification in progress",
      isFinal: false,
    });
    expect(getStatusDisplay("classified")).toMatchObject({
      label: "Automated checks completed",
      isFinal: true,
    });
    expect(getStatusDisplay("rejected")).toMatchObject({
      label: "Automated checks did not pass",
      isFinal: true,
    });
    expect(getStatusDisplay("needs_manual_review")).toMatchObject({
      label: "Needs manual review",
      isFinal: true,
    });
    expect(getStatusDisplay("classification_failed")).toMatchObject({
      label: "Classification could not be completed",
      isFinal: true,
    });
  });

  it("does not render raw unknown status, category, or decision values", () => {
    expect(getStatusDisplay("provider_secret_status").label).toBe("Review unavailable");
    expect(getCategoryLabel("provider_payload")).toBe("Review unavailable");
    expect(getDecisionLabel("internal_decision")).toBe("Review unavailable");
  });

  it("maps known category and decision values to submission-review copy", () => {
    expect(getCategoryLabel("valid_profile_candidate")).toBe(
      "Profile candidate checks passed",
    );
    expect(getCategoryLabel("unsafe_content")).toBe("Unsafe content");
    expect(getDecisionLabel("passes_automated_checks")).toBe("Passes automated checks");
    expect(getDecisionLabel("needs_manual_review")).toBe("Needs manual review");
  });

  it("formats valid datetimes with local-time context and hides invalid values", () => {
    expect(formatDisplayDateTime("2026-05-18T10:15:00Z")).toContain("local time");
    expect(formatDisplayDateTime("not-a-date")).toBe("Time unavailable");
    expect(formatDisplayDateTime(null)).toBe("Time unavailable");
  });

  it("detects unsafe values before display", () => {
    expect(isUnsafeDisplayValue("Bearer abc.def.ghi")).toBe(true);
    expect(isUnsafeDisplayValue("https://files.example/x?X-Amz-Signature=abc")).toBe(
      true,
    );
    expect(isUnsafeDisplayValue("raw prompt: classify this person")).toBe(true);
    expect(isUnsafeDisplayValue("uploads/submissions/abc/profile.jpg")).toBe(true);
    expect(isUnsafeDisplayValue("The person is trustworthy")).toBe(true);
    expect(isUnsafeDisplayValue("Required metadata was incomplete")).toBe(false);
  });

  it("suppresses unsafe classification reasons and returns fallback copy", () => {
    expect(
      safeClassificationReasons([
        "Image type is unsupported",
        "signed URL https://files.example/x?token=secret",
        "The model inferred religion",
      ]),
    ).toEqual(["Image type is unsupported"]);

    expect(
      safeClassificationReasons([
        "raw_prompt: check identity",
        "Authorization: Bearer secret",
      ]),
    ).toEqual(["Review details are unavailable."]);
  });

  it("rejects forbidden person-trait wording in classification copy", () => {
    expect(
      safeClassificationReasons([
        "This user looks competent",
        "The model inferred religion",
        "The photo proves suitability of a person",
      ]),
    ).toEqual(["Review details are unavailable."]);
  });

  it("suppresses unsafe values embedded inside otherwise allowlisted reasons", () => {
    expect(
      safeClassificationReasons([
        "Required metadata was incomplete",
        "Review passed with apiKey sk-private",
        "See signedURL https://storage.internal/private?X-Amz-Signature=secret",
        "rawPrompt: classify this person",
        "imageBytes: /9j/private",
      ]),
    ).toEqual(["Required metadata was incomplete"]);
  });

  it("normalizes unsafe backend error detail to safe copy", () => {
    expect(
      safeErrorMessage(
        "Traceback leaked token=abc and uploads/submissions/private.jpg",
      ),
    ).toBe("Something went wrong. Try again later.");
  });

  it("keeps unsafe backend details out of scoped error copy and document titles", () => {
    expect(
      safeErrorMessage(
        "Alex_Morgan_profile.jpg is at uploads/submissions/private/profile.jpg",
        "not_found",
      ),
    ).toBe("The requested item could not be found.");

    expect(safeDocumentTitle("Submission detail")).toBe(
      "Submission detail | Photo Classification Platform",
    );
    expect(
      safeDocumentTitle(
        "Alex_Morgan_profile.jpg signedURL https://storage.internal/private",
      ),
    ).toBe("Photo Classification Platform");
  });
});
