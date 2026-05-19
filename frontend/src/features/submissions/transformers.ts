import type {
  ClassificationSummary,
  FileFacts,
  RawClassification,
  RawSubmission,
  SubmissionDetail,
  SubmissionSummary,
  UserSubmittedMetadata,
} from "@/lib/models";
import {
  isClassificationCategory,
  isReviewDecision,
  isSubmissionStatus,
} from "@/lib/models";
import { safeClassificationReasons } from "@/lib/safe-display";

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
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

  const contentType = stringOrNull(raw.photo.content_type);
  const sizeBytes = numberOrNull(raw.photo.size_bytes);

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
    id: String(raw.id ?? ""),
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
