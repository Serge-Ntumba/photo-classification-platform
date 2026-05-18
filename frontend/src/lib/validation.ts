import type { ValidationIssue } from "@/lib/models";

export const DEFAULT_IMAGE_CONSTRAINTS = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 300,
  minHeight: 300,
  maxWidth: 5000,
  maxHeight: 5000,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export function validateRequiredText(
  value: string,
  field: string,
): ValidationIssue | null {
  if (!value.trim()) {
    return { field, message: `${field} is required.` };
  }

  return null;
}

export function validateTextLength(
  value: string,
  maxLength: number,
  field: string,
): ValidationIssue | null {
  if (value.length > maxLength) {
    return {
      field,
      message: `${field} must be ${maxLength} characters or fewer.`,
    };
  }

  return null;
}

export function validateIntegerRange(
  value: string | number,
  min: number,
  max: number,
  field: string,
): ValidationIssue | null {
  const text = String(value).trim();
  const parsed = Number(text);

  if (!text || !Number.isInteger(parsed)) {
    return { field, message: `${field} must be a whole number.` };
  }

  if (parsed < min || parsed > max) {
    return { field, message: `${field} must be between ${min} and ${max}.` };
  }

  return null;
}

export function validateImageFile(file: File | null): ValidationIssue[] {
  if (!file) {
    return [{ field: "photo", message: "Photo is required." }];
  }

  if (file.size === 0) {
    return [{ field: "photo", message: "Photo must not be empty." }];
  }

  const issues: ValidationIssue[] = [];

  if (!DEFAULT_IMAGE_CONSTRAINTS.allowedTypes.includes(file.type as never)) {
    issues.push({
      field: "photo",
      message: "Photo must be a JPEG, PNG, or WebP image.",
    });
  }

  if (file.size > DEFAULT_IMAGE_CONSTRAINTS.maxBytes) {
    issues.push({ field: "photo", message: "Photo must be 5 MB or smaller." });
  }

  return issues;
}

export function validateImageDimensions(
  width: number,
  height: number,
): ValidationIssue[] {
  if (
    width < DEFAULT_IMAGE_CONSTRAINTS.minWidth ||
    height < DEFAULT_IMAGE_CONSTRAINTS.minHeight
  ) {
    return [
      {
        field: "photo",
        message: "Photo dimensions must be at least 300x300 pixels.",
      },
    ];
  }

  if (
    width > DEFAULT_IMAGE_CONSTRAINTS.maxWidth ||
    height > DEFAULT_IMAGE_CONSTRAINTS.maxHeight
  ) {
    return [
      {
        field: "photo",
        message: "Photo dimensions must be no more than 5000x5000 pixels.",
      },
    ];
  }

  return [];
}
