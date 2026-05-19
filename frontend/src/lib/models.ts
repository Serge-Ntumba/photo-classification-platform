export const SUBMISSION_STATUSES = [
  "pending_classification",
  "classifying",
  "classified",
  "rejected",
  "needs_manual_review",
  "classification_failed",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const CLASSIFICATION_CATEGORIES = [
  "valid_profile_candidate",
  "invalid_file",
  "unsupported_image_type",
  "suspicious_file",
  "low_quality_image",
  "incomplete_metadata",
  "non_profile_image",
  "unsafe_content",
] as const;

export type ClassificationCategory = (typeof CLASSIFICATION_CATEGORIES)[number];

export const REVIEW_DECISIONS = [
  "passes_automated_checks",
  "fails_automated_checks",
  "needs_manual_review",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export type SessionStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "expired";

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  isStaff: boolean;
};

export type RawUserSummary = {
  id?: string | number;
  email?: string;
  username?: string;
  is_staff?: boolean;
  isStaff?: boolean;
  [key: string]: unknown;
};

export type AuthSession = {
  accessToken: string | null;
  user: AuthenticatedUser | null;
  status: SessionStatus;
  lastVerifiedAt: string | null;
};

export type RawLoginResponse = {
  access?: string;
  refresh?: string;
  user?: RawUserSummary;
  [key: string]: unknown;
};

export type RawClassification = {
  category?: unknown;
  review_decision?: unknown;
  reasons?: unknown;
  classified_at?: unknown;
  [key: string]: unknown;
};

export type RawSubmissionPhoto = {
  object_key?: unknown;
  original_filename?: unknown;
  content_type?: unknown;
  size_bytes?: unknown;
  [key: string]: unknown;
};

export type RawSubmission = {
  id?: unknown;
  name?: unknown;
  age?: unknown;
  place_of_living?: unknown;
  gender?: unknown;
  country_of_origin?: unknown;
  description?: unknown;
  photo?: RawSubmissionPhoto | null;
  status?: unknown;
  classification?: RawClassification | null;
  created_at?: unknown;
  updated_at?: unknown;
  [key: string]: unknown;
};

export type ClassificationSummary = {
  category: ClassificationCategory | null;
  reviewDecision: ReviewDecision | null;
  reasons: string[];
  classifiedAt: string | null;
};

export type UserSubmittedMetadata = {
  name: string;
  age: number | null;
  placeOfLiving: string;
  gender: string;
  countryOfOrigin: string;
  description: string;
};

export type FileFacts = {
  contentType: string | null;
  sizeBytes: number | null;
};

export type SubmissionSummary = {
  id: string;
  name: string | null;
  status: SubmissionStatus | null;
  classification: ClassificationSummary | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubmissionDetail = SubmissionSummary & {
  metadata: UserSubmittedMetadata;
  fileFacts: FileFacts | null;
  lastCheckedAt: string | null;
};

export type PaginatedSubmissionList = {
  count: number;
  results: SubmissionSummary[];
  page: number;
  statusFilter: SubmissionStatus | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
};

export type ValidationIssue = {
  field: string;
  message: string;
};

export type NormalizedErrorScope =
  | "field"
  | "file"
  | "form"
  | "auth"
  | "session"
  | "not_found"
  | "network"
  | "service_unavailable"
  | "unknown";

export type ErrorRecoverability =
  | "correct_field"
  | "login_again"
  | "retry_later"
  | "check_submissions"
  | "navigate_elsewhere";

export type NormalizedApiError = Error & {
  name: "ApiClientError";
  scope: NormalizedErrorScope;
  message: string;
  recoverability: ErrorRecoverability;
  status: number | null;
  fieldErrors: Record<string, string>;
};

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return (
    typeof value === "string" && SUBMISSION_STATUSES.includes(value as SubmissionStatus)
  );
}

export function isClassificationCategory(
  value: unknown,
): value is ClassificationCategory {
  return (
    typeof value === "string" &&
    CLASSIFICATION_CATEGORIES.includes(value as ClassificationCategory)
  );
}

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return (
    typeof value === "string" && REVIEW_DECISIONS.includes(value as ReviewDecision)
  );
}

export function toAuthenticatedUser(raw: RawUserSummary): AuthenticatedUser {
  return {
    id: String(raw.id ?? ""),
    email: typeof raw.email === "string" ? raw.email : "",
    username: typeof raw.username === "string" ? raw.username : "",
    isStaff: typeof raw.is_staff === "boolean" ? raw.is_staff : Boolean(raw.isStaff),
  };
}
