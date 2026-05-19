import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient, isApiError } from "@/lib/api-client";
import {
  createSubmission,
  isUncertainSubmissionOutcome,
} from "@/features/submissions/api";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

const validInput = {
  photo: new File(["photo-bytes"], "Alex_Morgan_token_profile.jpg", {
    type: "image/jpeg",
  }),
  name: "Alex Profile",
  age: 32,
  placeOfLiving: "Berlin",
  gender: "User-submitted",
  countryOfOrigin: "Germany",
  description: "Optional context",
};

type CapturedCreateRequest = {
  authorization?: string | null;
  name?: FormDataEntryValue | null;
  age?: FormDataEntryValue | null;
  placeOfLiving?: FormDataEntryValue | null;
  gender?: FormDataEntryValue | null;
  countryOfOrigin?: FormDataEntryValue | null;
  description?: FormDataEntryValue | null;
  photoName?: string;
};

describe("create submission API consumption", () => {
  it("posts documented multipart fields without forwarding the local filename", async () => {
    const captured: CapturedCreateRequest = {};
    server.use(
      http.post(apiUrl("/submissions/"), async ({ request }) => {
        const formData = await request.formData();
        const photo = formData.get("photo");

        captured.authorization = request.headers.get("authorization");
        captured.name = formData.get("name");
        captured.age = formData.get("age");
        captured.placeOfLiving = formData.get("place_of_living");
        captured.gender = formData.get("gender");
        captured.countryOfOrigin = formData.get("country_of_origin");
        captured.description = formData.get("description");
        captured.photoName =
          photo && typeof photo === "object" && "name" in photo
            ? String(photo.name)
            : undefined;

        return HttpResponse.json(
          {
            id: "submission-1",
            name: "Alex Profile",
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
          },
          { status: 201 },
        );
      }),
    );

    const created = await createSubmission(
      createApiClient({
        apiBaseUrl: "/api",
        getAccessToken: () => "access-token",
      }),
      validInput,
    );

    expect(captured).toEqual({
      authorization: "Bearer access-token",
      name: "Alex Profile",
      age: "32",
      placeOfLiving: "Berlin",
      gender: "User-submitted",
      countryOfOrigin: "Germany",
      description: "Optional context",
      photoName: expect.any(String),
    });
    expect(captured?.photoName).not.toContain("Alex_Morgan");
    expect(created).toMatchObject({
      id: "submission-1",
      status: "pending_classification",
      metadata: {
        name: "Alex Profile",
        placeOfLiving: "Berlin",
        countryOfOrigin: "Germany",
      },
      fileFacts: {
        contentType: "image/jpeg",
        sizeBytes: 1024,
      },
    });
    expect(JSON.stringify(created)).not.toContain("object_key");
    expect(JSON.stringify(created)).not.toContain("original_filename");
    expect(JSON.stringify(created)).not.toContain("Alex_Morgan");
  });

  it("surfaces backend validation errors as safe field and file errors", async () => {
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

    await expect(
      createSubmission(createApiClient({ apiBaseUrl: "/api" }), validInput),
    ).rejects.toMatchObject({
      name: "ApiClientError",
      scope: "field",
      fieldErrors: {
        age: "Age must be between 0 and 120.",
        photo: "Uploaded image exceeds the maximum size.",
      },
    });
  });

  it("marks network failure after send as an uncertain creation outcome", async () => {
    const apiClient = createApiClient({
      apiBaseUrl: "/api",
      fetchImpl: async () => {
        throw new TypeError("network dropped");
      },
    });

    try {
      await createSubmission(apiClient, validInput);
      throw new Error("Expected createSubmission to fail.");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect(isUncertainSubmissionOutcome(error)).toBe(true);
      expect((error as Error).message).toBe(
        "The request could not be confirmed. Check submissions before retrying.",
      );
    }
  });
});
