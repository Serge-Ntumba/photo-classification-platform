import type {
  ClassificationSummary,
  FileFacts,
  PaginatedSubmissionList,
  RawClassification,
  RawSubmission,
  SubmissionDetail,
  SubmissionStatus,
  SubmissionSummary,
  UserSubmittedMetadata,
} from "@/lib/models";
import {
  isClassificationCategory,
  isReviewDecision,
  isSubmissionStatus,
} from "@/lib/models";
import {
  containsUnsafePrivateValue,
  safeClassificationReasons,
  safeUserSubmittedText,
} from "@/lib/safe-display";

const SAFE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() && !containsUnsafePrivateValue(value)
    ? value.trim()
    : null;
}

function stringOrEmpty(value: unknown) {
  return safeUserSubmittedText(value, "");
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function nonNegativeNumberOrNull(value: unknown) {
  const parsed = numberOrNull(value);

  return parsed === null || parsed < 0 ? null : parsed;
}

function safeIdentifier(value: unknown) {
  const candidate =
    typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

  if (!candidate || containsUnsafePrivateValue(candidate)) {
    return "";
  }

  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : "";
}

function safeContentType(value: unknown) {
  if (typeof value !== "string" || containsUnsafePrivateValue(value)) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return SAFE_CONTENT_TYPES.has(normalized) ? normalized : null;
}

function finiteNonNegativeNumber(value: unknown) {
  const parsed = numberOrNull(value);

  return parsed === null || parsed < 0 ? 0 : parsed;
}

function pageFromPaginationUrl(value: unknown, fallback: number | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value, "http://frontend.local");
    const page = Number(url.searchParams.get("page") ?? "1");

    return Number.isInteger(page) && page > 0 ? page : fallback;
  } catch {
    return fallback;
  }
}

export function toClassificationSummary(
  raw: RawClassification | null | undefined,
): ClassificationSummary | null {
  if (!raw) {
    return null;
  }

  return {
    category: isClassificationCategory(raw.category) ? raw.category : null,
    reviewDecision: isReviewDecision(raw.review_decision) ? raw.review_decision : null,
    reasons: safeClassificationReasons(raw.reasons),
    classifiedAt: stringOrNull(raw.classified_at),
  };
}

export function toFileFacts(raw: RawSubmission): FileFacts | null {
  if (!raw.photo) {
    return null;
  }

  const contentType = safeContentType(raw.photo.content_type);
  const sizeBytes = nonNegativeNumberOrNull(raw.photo.size_bytes);

  if (!contentType && sizeBytes === null) {
    return null;
  }

  return {
    contentType,
    sizeBytes,
  };
}

export function toUserSubmittedMetadata(raw: RawSubmission): UserSubmittedMetadata {
  return {
    name: stringOrEmpty(raw.name),
    age: numberOrNull(raw.age),
    placeOfLiving: stringOrEmpty(raw.place_of_living),
    gender: stringOrEmpty(raw.gender),
    countryOfOrigin: stringOrEmpty(raw.country_of_origin),
    description: stringOrEmpty(raw.description),
  };
}

export function toSubmissionSummary(raw: RawSubmission): SubmissionSummary {
  return {
    id: safeIdentifier(raw.id),
    name: stringOrNull(raw.name),
    status: isSubmissionStatus(raw.status) ? raw.status : null,
    classification: toClassificationSummary(raw.classification),
    createdAt: stringOrNull(raw.created_at),
    updatedAt: stringOrNull(raw.updated_at),
  };
}

export function toSubmissionDetail(
  raw: RawSubmission,
  lastCheckedAt: string | null = null,
): SubmissionDetail {
  return {
    ...toSubmissionSummary(raw),
    metadata: toUserSubmittedMetadata(raw),
    fileFacts: toFileFacts(raw),
    lastCheckedAt,
  };
}

export function toPaginatedSubmissionList(
  raw: unknown,
  page: number,
  statusFilter: SubmissionStatus | null,
): PaginatedSubmissionList {
  const payload =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const nextPage = pageFromPaginationUrl(payload.next, page + 1);
  const previousPage = pageFromPaginationUrl(payload.previous, Math.max(1, page - 1));

  return {
    count: finiteNonNegativeNumber(payload.count),
    results: rawResults.map((item) => toSubmissionSummary(item as RawSubmission)),
    page,
    statusFilter,
    hasNextPage: typeof payload.next === "string" && payload.next.trim().length > 0,
    hasPreviousPage:
      typeof payload.previous === "string" && payload.previous.trim().length > 0,
    nextPage,
    previousPage,
  };
}
