import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGE_CONSTRAINTS,
  validateImageDimensions,
  validateImageFile,
  validateIntegerRange,
  validateRequiredText,
  validateTextLength,
} from "@/lib/validation";

describe("validation helpers", () => {
  it("rejects blank required text and accepts trimmed text", () => {
    expect(validateRequiredText("   ", "Name")).toEqual({
      field: "Name",
      message: "Name is required.",
    });
    expect(validateRequiredText(" Alice ", "Name")).toBeNull();
  });

  it("enforces text length limits", () => {
    expect(validateTextLength("abc", 3, "Description")).toBeNull();
    expect(validateTextLength("abcd", 3, "Description")).toEqual({
      field: "Description",
      message: "Description must be 3 characters or fewer.",
    });
  });

  it("enforces integer ranges", () => {
    expect(validateIntegerRange("42", 0, 120, "Age")).toBeNull();
    expect(validateIntegerRange("42.5", 0, 120, "Age")?.message).toBe(
      "Age must be a whole number.",
    );
    expect(validateIntegerRange("121", 0, 120, "Age")?.message).toBe(
      "Age must be between 0 and 120.",
    );
  });

  it("validates image file type and size constraints", () => {
    expect(validateImageFile(null)).toEqual([
      { field: "photo", message: "Photo is required." },
    ]);
    expect(
      validateImageFile(new File([], "empty.jpg", { type: "image/jpeg" })),
    ).toEqual([{ field: "photo", message: "Photo must not be empty." }]);
    expect(
      validateImageFile(new File(["x"], "notes.txt", { type: "text/plain" })),
    ).toEqual([
      {
        field: "photo",
        message: "Photo must be a JPEG, PNG, or WebP image.",
      },
    ]);
  });

  it("validates maximum image byte size and dimensions", () => {
    const oversized = new File(
      [new Uint8Array(DEFAULT_IMAGE_CONSTRAINTS.maxBytes + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );

    expect(validateImageFile(oversized)).toEqual([
      { field: "photo", message: "Photo must be 5 MB or smaller." },
    ]);
    expect(validateImageDimensions(299, 300)).toEqual([
      {
        field: "photo",
        message: "Photo dimensions must be at least 300x300 pixels.",
      },
    ]);
    expect(validateImageDimensions(5001, 5000)).toEqual([
      {
        field: "photo",
        message: "Photo dimensions must be no more than 5000x5000 pixels.",
      },
    ]);
  });
});
