import type { createApiClient } from "@/lib/api-client";
import { isApiError } from "@/lib/api-client";
import type { RawSubmission, SubmissionDetail } from "@/lib/models";
import type { ValidSubmissionDraft } from "@/features/submissions/validation";
import { toSubmissionDetail } from "@/features/submissions/transformers";

type ApiClient = ReturnType<typeof createApiClient>;

export type CreateSubmissionInput = ValidSubmissionDraft & {
  photo: File;
};

function safeUploadFilename(contentType: string) {
  if (contentType === "image/png") {
    return "photo.png";
  }
  if (contentType === "image/webp") {
    return "photo.webp";
  }
  if (contentType === "image/jpeg") {
    return "photo.jpg";
  }

  return "photo";
}

export async function createSubmission(
  apiClient: ApiClient,
  input: CreateSubmissionInput,
): Promise<SubmissionDetail> {
  const formData = new FormData();
  const safePhoto = new File([input.photo], safeUploadFilename(input.photo.type), {
    type: input.photo.type,
    lastModified: input.photo.lastModified,
  });
  formData.append("photo", safePhoto);
  formData.append("name", input.name);
  formData.append("age", String(input.age));
  formData.append("place_of_living", input.placeOfLiving);
  formData.append("gender", input.gender);
  formData.append("country_of_origin", input.countryOfOrigin);
  formData.append("description", input.description);

  const response = await apiClient.post<RawSubmission>("/submissions/", formData);

  return toSubmissionDetail(response, new Date().toISOString());
}

export function isUncertainSubmissionOutcome(error: unknown) {
  return (
    isApiError(error) &&
    error.scope === "network" &&
    error.recoverability === "check_submissions"
  );
}
