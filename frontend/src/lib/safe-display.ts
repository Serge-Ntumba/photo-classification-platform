import type {
  ClassificationCategory,
  NormalizedErrorScope,
  ReviewDecision,
  SubmissionStatus,
} from "@/lib/models";
import {
  isClassificationCategory,
  isReviewDecision,
  isSubmissionStatus,
} from "@/lib/models";

type StatusDisplay = {
  label: string;
  guidance: string;
  isFinal: boolean | null;
};

const STATUS_DISPLAY: Record<SubmissionStatus, StatusDisplay> = {
  pending_classification: {
    label: "Pending classification",
    guidance: "The submission was received and is waiting for automated review.",
    isFinal: false,
  },
  classifying: {
    label: "Classification in progress",
    guidance: "Automated review is currently running.",
    isFinal: false,
  },
  classified: {
    label: "Automated checks completed",
    guidance: "Review completed.",
    isFinal: true,
  },
  rejected: {
    label: "Automated checks did not pass",
    guidance: "The submission did not pass automated checks.",
    isFinal: true,
  },
  needs_manual_review: {
    label: "Needs manual review",
    guidance: "The submission needs staff review.",
    isFinal: true,
  },
  classification_failed: {
    label: "Classification could not be completed",
    guidance: "Review is temporarily unavailable.",
    isFinal: true,
  },
};

const UNKNOWN_STATUS: StatusDisplay = {
  label: "Review unavailable",
  guidance: "Review details are unavailable.",
  isFinal: null,
};

const CATEGORY_LABELS: Record<ClassificationCategory, string> = {
  valid_profile_candidate: "Profile candidate checks passed",
  invalid_file: "Invalid file",
  unsupported_image_type: "Unsupported image type",
  suspicious_file: "Suspicious file",
  low_quality_image: "Low quality image",
  incomplete_metadata: "Incomplete metadata",
  non_profile_image: "Non-profile image",
  unsafe_content: "Unsafe content",
};

const DECISION_LABELS: Record<ReviewDecision, string> = {
  passes_automated_checks: "Passes automated checks",
  fails_automated_checks: "Does not pass automated checks",
  needs_manual_review: "Needs manual review",
};

const APP_NAME = "Photo Classification Platform";
const FALLBACK_REASON = "Review details are unavailable.";

const PRIVATE_OR_INTERNAL_VALUE_PATTERNS = [
  /\bapi[_\s-]?key\b/i,
  /\bapikey\b/i,
  /\bsecret\b/i,
  /\bcredential/i,
  /\bpassword\b/i,
  /\btoken\b/i,
  /\baccess[_\s-]?token\b/i,
  /\brefresh[_\s-]?token\b/i,
  /\bauthorization\b/i,
  /\bbearer\s+[a-z0-9._~+/=-]+/i,
  /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/i,
  /\bsigned[_\s-]?url\b/i,
  /\bsignedurl\b/i,
  /\bx-amz-signature\b/i,
  /[?&](token|signature|x-amz-signature)=/i,
  /\braw[_\s-]?prompt\b/i,
  /\brawprompt\b/i,
  /\braw[_\s-]?response\b/i,
  /\bprovider[_\s-]?metadata\b/i,
  /\bprovider payload\b/i,
  /\braw[_\s-]?image\b/i,
  /\bimage[_\s-]?bytes\b/i,
  /\bimagebytes\b/i,
  /\bdata:image\//i,
  /\bobject[_\s-]?key\b/i,
  /\buploads\/submissions\//i,
  /\b(?:private|uploads|submissions|objects|media)\/[^\s]+/i,
  /\bphoto-submissions\b/i,
  /\bs3:\/\//i,
  /\bhttps?:\/\//i,
  /\btraceback\b/i,
  /\b(?:127\.0\.0\.1|0\.0\.0\.0|localhost)(?::\d+)?\b/i,
  /\b[a-z0-9.-]+\.internal\b/i,
  /\blocalhost:\d+\b/i,
  /\b(rabbitmq|minio|postgres|celery|classifier)([-.:/]\w+|\b)/i,
];

const FORBIDDEN_TRAIT_PATTERNS = [
  /\bidentity\b/i,
  /\bdemographic/i,
  /\battractive/i,
  /\btrustworthy\b/i,
  /\btrustworthiness\b/i,
  /\bcompetent\b/i,
  /\bcompetence\b/i,
  /\bdesirable\b/i,
  /\bdesirability\b/i,
  /\bsuitability of a person\b/i,
  /\bhealth\b/i,
  /\breligion\b/i,
  /\bpolitic/i,
  /\bethnicity\b/i,
  /\brace\b/i,
  /\bnationality inference\b/i,
  /\beconomic background\b/i,
  /\bsocial background\b/i,
  /\bthe person is\b/i,
  /\bthis user looks\b/i,
  /\bthe photo proves\b/i,
  /\bmodel inferred\b/i,
];

const ERROR_COPY: Record<NormalizedErrorScope, string> = {
  field: "Correct the highlighted fields.",
  file: "Correct the selected photo.",
  form: "Correct the highlighted fields.",
  auth: "Unable to log in with the provided credentials.",
  session: "Your session expired. Log in again.",
  not_found: "The requested item could not be found.",
  network: "The request could not be confirmed. Check submissions before retrying.",
  service_unavailable: "The service is unavailable. Try again later.",
  unknown: "Something went wrong. Try again later.",
};

export function getStatusDisplay(status: unknown): StatusDisplay {
  if (!isSubmissionStatus(status)) {
    return UNKNOWN_STATUS;
  }

  return STATUS_DISPLAY[status];
}

export function getCategoryLabel(category: unknown) {
  if (!isClassificationCategory(category)) {
    return "Review unavailable";
  }

  return CATEGORY_LABELS[category];
}

export function getDecisionLabel(decision: unknown) {
  if (!isReviewDecision(decision)) {
    return "Review unavailable";
  }

  return DECISION_LABELS[decision];
}

export function formatDisplayDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Time unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return `${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)} local time`;
}

export function isUnsafeDisplayValue(value: unknown) {
  return (
    containsUnsafePrivateValue(value) || containsForbiddenClassificationCopy(value)
  );
}

export function containsUnsafePrivateValue(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  return PRIVATE_OR_INTERNAL_VALUE_PATTERNS.some((pattern) => pattern.test(candidate));
}

export function containsForbiddenClassificationCopy(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  return FORBIDDEN_TRAIT_PATTERNS.some((pattern) => pattern.test(candidate));
}

export function safeUserSubmittedText(value: unknown, fallback = "Unavailable") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const candidate = value.trim();

  return containsUnsafePrivateValue(candidate) ? fallback : candidate;
}

export function safeClassificationReasons(reasons: unknown) {
  if (!Array.isArray(reasons)) {
    return [FALLBACK_REASON];
  }

  const safeReasons = reasons
    .filter((reason): reason is string => typeof reason === "string")
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0)
    .filter((reason) => !isUnsafeDisplayValue(reason));

  return safeReasons.length > 0 ? safeReasons : [FALLBACK_REASON];
}

export function safeErrorMessage(
  message: unknown,
  scope: NormalizedErrorScope = "unknown",
) {
  if (typeof message !== "string" || !message.trim()) {
    return ERROR_COPY[scope];
  }

  if (isUnsafeDisplayValue(message)) {
    return ERROR_COPY[scope];
  }

  return message;
}

export function defaultErrorMessage(scope: NormalizedErrorScope) {
  return ERROR_COPY[scope];
}

export function safeDocumentTitle(title: unknown) {
  if (typeof title !== "string" || !title.trim() || isUnsafeDisplayValue(title)) {
    return APP_NAME;
  }

  return `${title.trim()} | ${APP_NAME}`;
}
