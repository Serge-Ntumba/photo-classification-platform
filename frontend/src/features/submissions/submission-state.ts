import type {
  SubmissionStatus,
  SubmissionSummary,
  PaginatedSubmissionList,
} from "@/lib/models";
import { SUBMISSION_STATUSES, isSubmissionStatus } from "@/lib/models";
import {
  formatDisplayDateTime,
  getCategoryLabel,
  getDecisionLabel,
  getStatusDisplay,
} from "@/lib/safe-display";

export const ALL_STATUS_FILTER_VALUE = "all";

const STATUS_FILTER_LABELS: Record<SubmissionStatus, string> = {
  pending_classification: "Pending classification",
  classifying: "Classifying",
  classified: "Classified",
  rejected: "Rejected",
  needs_manual_review: "Needs manual review",
  classification_failed: "Classification failed",
};

export type StatusTone = "info" | "success" | "warning" | "error" | "neutral";

export function parsePageParam(value: string | null) {
  const parsed = Number(value ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseStatusFilter(value: string | null): SubmissionStatus | null {
  return isSubmissionStatus(value) ? value : null;
}

export function getStatusFilterLabel(status: SubmissionStatus) {
  return STATUS_FILTER_LABELS[status];
}

export function statusFilterOptions() {
  return SUBMISSION_STATUSES.map((status) => ({
    value: status,
    label: getStatusFilterLabel(status),
  }));
}

export function emptyListTitle(status: SubmissionStatus | null) {
  if (!status) {
    return "No submissions yet";
  }

  return `No ${getStatusFilterLabel(status).toLowerCase()} submissions`;
}

export function emptyListDescription(status: SubmissionStatus | null) {
  if (!status) {
    return "Create a submission to start asynchronous review.";
  }

  return "No submissions match the selected status filter.";
}

export function statusTone(status: SubmissionStatus | null): StatusTone {
  if (status === "classified") {
    return "success";
  }
  if (status === "rejected" || status === "classification_failed") {
    return "error";
  }
  if (status === "needs_manual_review") {
    return "warning";
  }
  if (status === "pending_classification" || status === "classifying") {
    return "info";
  }

  return "neutral";
}

export function isNonFinalStatus(status: SubmissionStatus | null) {
  const display = getStatusDisplay(status);

  return display.isFinal === false;
}

export function formatLastChecked(lastCheckedAt: string | null) {
  return `Last checked: ${formatDisplayDateTime(lastCheckedAt)}`;
}

export function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes === null) {
    return "Unavailable";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildSubmissionsPath({
  page,
  status,
}: {
  page?: number | null;
  status?: SubmissionStatus | null;
}) {
  const params = new URLSearchParams();
  if (page && page > 1) {
    params.set("page", String(page));
  }
  if (status) {
    params.set("status", status);
  }

  const query = params.toString();

  return query ? `/app/submissions?${query}` : "/app/submissions";
}

export function pageRangeLabel(page: PaginatedSubmissionList) {
  if (page.count === 0 || page.results.length === 0) {
    return `Page ${page.page}`;
  }

  return `Page ${page.page} of submissions`;
}

export function latestSummaryLabel(submission: SubmissionSummary) {
  if (!submission.classification) {
    return isNonFinalStatus(submission.status)
      ? "Classification summary is not available yet."
      : "Review details are unavailable.";
  }

  const decision = submission.classification.reviewDecision;
  const category = submission.classification.category;
  const decisionLabel = decision ? getDecisionLabel(decision) : null;
  const categoryLabel = category ? getCategoryLabel(category) : null;

  if (decisionLabel && categoryLabel) {
    return `${decisionLabel}; ${categoryLabel}.`;
  }

  return "Review details are unavailable.";
}
