import type { createApiClient } from "@/lib/api-client";
import { isApiError } from "@/lib/api-client";
import type {
  PaginatedSubmissionList,
  RawSubmission,
  SubmissionDetail,
  SubmissionStatus,
} from "@/lib/models";
import { isSubmissionStatus } from "@/lib/models";
import type { ValidSubmissionDraft } from "@/features/submissions/validation";
import {
  toPaginatedSubmissionList,
  toSubmissionDetail,
} from "@/features/submissions/transformers";

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

export type ListSubmissionsOptions = {
  page?: number;
  status?: SubmissionStatus | null;
};

function normalizePage(page: unknown) {
  return typeof page === "number" && Number.isInteger(page) && page > 0 ? page : 1;
}

function buildSubmissionListPath(page: number, status: SubmissionStatus | null) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (status) {
    params.set("status", status);
  }

  return `/submissions/?${params.toString()}`;
}

export async function listSubmissions(
  apiClient: ApiClient,
  options: ListSubmissionsOptions = {},
): Promise<PaginatedSubmissionList> {
  const page = normalizePage(options.page);
  const status = isSubmissionStatus(options.status) ? options.status : null;
  const response = await apiClient.get<unknown>(buildSubmissionListPath(page, status));

  return toPaginatedSubmissionList(response, page, status);
}

export async function getSubmission(
  apiClient: ApiClient,
  id: string,
  lastCheckedAt: string | null = null,
): Promise<SubmissionDetail> {
  const response = await apiClient.get<RawSubmission>(
    `/submissions/${encodeURIComponent(id)}/`,
  );

  return toSubmissionDetail(response, lastCheckedAt);
}

export function isUncertainSubmissionOutcome(error: unknown) {
  return (
    isApiError(error) &&
    error.scope === "network" &&
    error.recoverability === "check_submissions"
  );
}
