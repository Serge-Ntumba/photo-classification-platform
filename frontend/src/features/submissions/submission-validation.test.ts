import { describe, expect, it, vi } from "vitest";

import { DEFAULT_IMAGE_CONSTRAINTS } from "@/lib/validation";
import {
  validateSubmissionDraft,
  type SubmissionFormValues,
} from "@/features/submissions/validation";

const validValues: SubmissionFormValues = {
  name: "Alex Profile",
  age: "32",
  placeOfLiving: "Berlin",
  gender: "User-submitted",
  countryOfOrigin: "Germany",
  description: "Optional context",
};

function photoFile(
  options: {
    type?: string;
    size?: number;
    name?: string;
  } = {},
) {
  const size = options.size ?? 1024;
  const content = size === 0 ? [] : [new Uint8Array(size)];

  return new File(content, options.name ?? "secret-profile-name.jpg", {
    type: options.type ?? "image/jpeg",
  });
}

const validInspector = vi.fn(async () => ({
  ok: true as const,
  width: 320,
  height: 320,
}));

describe("submission validation", () => {
  it("accepts metadata and image values on documented boundaries", async () => {
    await expect(
      validateSubmissionDraft(
        {
          ...validValues,
          age: "0",
          name: "n".repeat(255),
          placeOfLiving: "p".repeat(255),
          gender: "g".repeat(100),
          countryOfOrigin: "c".repeat(255),
          description: "d".repeat(1000),
        },
        photoFile(),
        async () => ({
          ok: true,
          width: DEFAULT_IMAGE_CONSTRAINTS.minWidth,
          height: DEFAULT_IMAGE_CONSTRAINTS.minHeight,
        }),
      ),
    ).resolves.toMatchObject({
      success: true,
      data: {
        age: 0,
        description: "d".repeat(1000),
      },
    });

    await expect(
      validateSubmissionDraft(
        { ...validValues, age: "120" },
        photoFile({ type: "image/webp" }),
        async () => ({
          ok: true,
          width: DEFAULT_IMAGE_CONSTRAINTS.maxWidth,
          height: DEFAULT_IMAGE_CONSTRAINTS.maxHeight,
        }),
      ),
    ).resolves.toMatchObject({ success: true, data: { age: 120 } });
  });

  it("rejects required, whitespace-only, too-long, and out-of-range metadata", async () => {
    const result = await validateSubmissionDraft(
      {
        name: "   ",
        age: "121",
        placeOfLiving: "",
        gender: "g".repeat(101),
        countryOfOrigin: "c".repeat(256),
        description: "d".repeat(1001),
      },
      photoFile(),
      validInspector,
    );

    expect(result.success).toBe(false);
    expect(result.errors.fields).toMatchObject({
      name: "Name is required.",
      age: "Age must be between 0 and 120.",
      placeOfLiving: "Place of living is required.",
      gender: "Gender must be 100 characters or fewer.",
      countryOfOrigin: "Country of origin must be 255 characters or fewer.",
      description: "Description must be 1000 characters or fewer.",
    });
  });

  it("rejects missing, empty, unsupported, and oversized images", async () => {
    await expect(
      validateSubmissionDraft(validValues, null, validInspector),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo is required." },
    });

    await expect(
      validateSubmissionDraft(validValues, photoFile({ size: 0 }), validInspector),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo must not be empty." },
    });

    await expect(
      validateSubmissionDraft(
        validValues,
        photoFile({ type: "text/plain" }),
        validInspector,
      ),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo must be a JPEG, PNG, or WebP image." },
    });

    await expect(
      validateSubmissionDraft(
        validValues,
        photoFile({ size: DEFAULT_IMAGE_CONSTRAINTS.maxBytes + 1 }),
        validInspector,
      ),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo must be 5 MB or smaller." },
    });
  });

  it("rejects images outside documented dimension boundaries", async () => {
    await expect(
      validateSubmissionDraft(validValues, photoFile(), async () => ({
        ok: true,
        width: 299,
        height: 320,
      })),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo dimensions must be at least 300x300 pixels." },
    });

    await expect(
      validateSubmissionDraft(validValues, photoFile(), async () => ({
        ok: true,
        width: 5001,
        height: 5000,
      })),
    ).resolves.toMatchObject({
      success: false,
      errors: { photo: "Photo dimensions must be no more than 5000x5000 pixels." },
    });
  });

  it("rejects unreadable image dimensions with actionable photo feedback", async () => {
    await expect(
      validateSubmissionDraft(validValues, photoFile(), async () => ({
        ok: false,
        message: "Photo could not be read. Choose a valid JPEG, PNG, or WebP image.",
      })),
    ).resolves.toMatchObject({
      success: false,
      errors: {
        photo: "Photo could not be read. Choose a valid JPEG, PNG, or WebP image.",
      },
    });
  });
});
