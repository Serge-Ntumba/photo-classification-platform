import type { NormalizedApiError } from "@/lib/models";
import { isApiError } from "@/lib/api-client";
import {
  validateImageDimensions,
  validateImageFile,
  validateIntegerRange,
  validateRequiredText,
  validateTextLength,
} from "@/lib/validation";

export type SubmissionFormValues = {
  name: string;
  age: string;
  placeOfLiving: string;
  gender: string;
  countryOfOrigin: string;
  description: string;
};

export type SubmissionFormField = keyof SubmissionFormValues;

export type SubmissionFormErrors = {
  fields: Partial<Record<SubmissionFormField, string>>;
  photo: string | null;
  form: string | null;
  uncertainOutcome: boolean;
};

export type ValidSubmissionDraft = {
  name: string;
  age: number;
  placeOfLiving: string;
  gender: string;
  countryOfOrigin: string;
  description: string;
};

export type PhotoSelectionValue = {
  file: File;
  width: number | null;
  height: number | null;
};

export type ImageDimensionResult =
  | {
      ok: true;
      width: number;
      height: number;
    }
  | {
      ok: false;
      message: string;
    };

export type ImageDimensionInspector = (file: File) => Promise<ImageDimensionResult>;

export type SubmissionValidationResult =
  | {
      success: true;
      data: ValidSubmissionDraft;
      errors: SubmissionFormErrors;
    }
  | {
      success: false;
      data: null;
      errors: SubmissionFormErrors;
    };

const emptyErrors: SubmissionFormErrors = {
  fields: {},
  photo: null,
  form: null,
  uncertainOutcome: false,
};

const fieldLabels: Record<SubmissionFormField, string> = {
  name: "Name",
  age: "Age",
  placeOfLiving: "Place of living",
  gender: "Gender",
  countryOfOrigin: "Country of origin",
  description: "Description",
};

const fieldLimits: Partial<Record<SubmissionFormField, number>> = {
  name: 255,
  placeOfLiving: 255,
  gender: 100,
  countryOfOrigin: 255,
  description: 1000,
};

const backendFieldMap: Record<string, SubmissionFormField | "photo"> = {
  name: "name",
  age: "age",
  place_of_living: "placeOfLiving",
  gender: "gender",
  country_of_origin: "countryOfOrigin",
  description: "description",
  photo: "photo",
};

function firstIssueMessage(messages: string[]) {
  return messages[0] ?? null;
}

function safeImageReadFailure() {
  return "Photo could not be read. Choose a valid JPEG, PNG, or WebP image.";
}

export async function inspectImageDimensions(
  file: File,
): Promise<ImageDimensionResult> {
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") {
    return { ok: false, message: safeImageReadFailure() };
  }

  let objectUrl: string;
  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    return { ok: false, message: safeImageReadFailure() };
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        ok: true,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ ok: false, message: safeImageReadFailure() });
    };
    image.src = objectUrl;
  });
}

export async function validateSubmissionDraft(
  values: SubmissionFormValues,
  photo: File | null,
  inspectDimensions: ImageDimensionInspector = inspectImageDimensions,
): Promise<SubmissionValidationResult> {
  const fields: SubmissionFormErrors["fields"] = {};

  for (const field of ["name", "placeOfLiving", "gender", "countryOfOrigin"] as const) {
    const requiredIssue = validateRequiredText(values[field], fieldLabels[field]);
    const lengthIssue = validateTextLength(
      values[field],
      fieldLimits[field] ?? 0,
      fieldLabels[field],
    );
    const message = requiredIssue?.message ?? lengthIssue?.message;
    if (message) {
      fields[field] = message;
    }
  }

  const ageIssue = validateIntegerRange(values.age, 0, 120, fieldLabels.age);
  if (ageIssue) {
    fields.age = ageIssue.message;
  }

  const descriptionIssue = validateTextLength(
    values.description,
    fieldLimits.description ?? 1000,
    fieldLabels.description,
  );
  if (descriptionIssue) {
    fields.description = descriptionIssue.message;
  }

  const imageIssues = validateImageFile(photo);
  let photoError = firstIssueMessage(imageIssues.map((issue) => issue.message));

  if (photo && !photoError) {
    const dimensions = await inspectDimensions(photo);
    if (!dimensions.ok) {
      photoError = dimensions.message;
    } else {
      photoError = firstIssueMessage(
        validateImageDimensions(dimensions.width, dimensions.height).map(
          (issue) => issue.message,
        ),
      );
    }
  }

  if (Object.keys(fields).length > 0 || photoError || !photo) {
    return {
      success: false,
      data: null,
      errors: {
        ...emptyErrors,
        fields,
        photo: photoError,
      },
    };
  }

  return {
    success: true,
    data: {
      name: values.name.trim(),
      age: Number(values.age),
      placeOfLiving: values.placeOfLiving.trim(),
      gender: values.gender.trim(),
      countryOfOrigin: values.countryOfOrigin.trim(),
      description: values.description.trim(),
    },
    errors: emptyErrors,
  };
}

export function mapCreateSubmissionApiError(error: unknown): SubmissionFormErrors {
  if (!isApiError(error)) {
    return {
      ...emptyErrors,
      form: "Something went wrong. Try again later.",
    };
  }

  const mapped: SubmissionFormErrors = { ...emptyErrors, fields: {} };
  const apiError = error as NormalizedApiError;

  for (const [backendField, message] of Object.entries(apiError.fieldErrors)) {
    const frontendField = backendFieldMap[backendField];
    if (frontendField === "photo") {
      mapped.photo = message;
    } else if (frontendField) {
      mapped.fields[frontendField] = message;
    }
  }

  if (Object.keys(mapped.fields).length === 0 && !mapped.photo) {
    mapped.form = apiError.message;
  }

  if (apiError.scope === "network" && apiError.recoverability === "check_submissions") {
    mapped.uncertainOutcome = true;
  }

  return mapped;
}

export function getFirstSubmissionErrorField(
  errors: SubmissionFormErrors,
): SubmissionFormField | "photo" | null {
  for (const field of [
    "name",
    "age",
    "placeOfLiving",
    "gender",
    "countryOfOrigin",
    "description",
  ] as const) {
    if (errors.fields[field]) {
      return field;
    }
  }

  return errors.photo ? "photo" : null;
}
