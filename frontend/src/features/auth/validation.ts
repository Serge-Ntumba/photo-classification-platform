import { z } from "zod";

import { isApiError } from "@/lib/api-client";
import type { NormalizedApiError } from "@/lib/models";
import { defaultErrorMessage, safeErrorMessage } from "@/lib/safe-display";

export const GENERIC_AUTH_FAILURE_MESSAGE =
  "Unable to log in with the provided credentials.";
const GENERIC_REGISTRATION_FAILURE_MESSAGE =
  "Correct the registration details and try again.";
const GENERIC_PASSWORD_FIELD_MESSAGE = "Choose a stronger password.";

export const registrationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  username: z
    .string()
    .trim()
    .min(1, "Username is required.")
    .max(150, "Username must be 150 characters or fewer."),
  password: z.string().min(1, "Password is required."),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type RegistrationFormValues = z.input<typeof registrationSchema>;
export type LoginFormValues = z.input<typeof loginSchema>;
export type AuthField = "email" | "username" | "password";
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export type AuthFormErrors = {
  fields: AuthFieldErrors;
  form: string | null;
};

const KNOWN_AUTH_FIELDS = new Set<AuthField>(["email", "username", "password"]);

function emptyAuthFormErrors(): AuthFormErrors {
  return {
    fields: {},
    form: null,
  };
}

function isAuthField(value: string): value is AuthField {
  return KNOWN_AUTH_FIELDS.has(value as AuthField);
}

export function validateRegistration(values: RegistrationFormValues) {
  return registrationSchema.safeParse(values);
}

export function validateLogin(values: LoginFormValues) {
  return loginSchema.safeParse(values);
}

export function errorsFromZod(error: z.ZodError): AuthFormErrors {
  const result = emptyAuthFormErrors();

  for (const issue of error.issues) {
    const [field] = issue.path;
    if (typeof field === "string" && isAuthField(field) && !result.fields[field]) {
      result.fields[field] = safeErrorMessage(issue.message, "field");
    }
  }

  if (Object.keys(result.fields).length === 0) {
    result.form = defaultErrorMessage("form");
  }

  return result;
}

export function mapAuthApiError(
  error: unknown,
  action: "login" | "register",
): AuthFormErrors {
  const result = emptyAuthFormErrors();

  if (!isApiError(error)) {
    result.form = defaultErrorMessage("unknown");
    return result;
  }

  if (action === "login") {
    result.form = GENERIC_AUTH_FAILURE_MESSAGE;
    return result;
  }

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (isAuthField(field)) {
      result.fields[field] =
        field === "password"
          ? GENERIC_PASSWORD_FIELD_MESSAGE
          : safeErrorMessage(message, "field");
    }
  }

  if (Object.keys(result.fields).length === 0) {
    result.form =
      error.scope === "field" || error.scope === "form"
        ? GENERIC_REGISTRATION_FAILURE_MESSAGE
        : safeErrorMessage(
            (error as NormalizedApiError).message,
            (error as NormalizedApiError).scope,
          );
  }

  return result;
}

export function getFirstAuthErrorField(errors: AuthFieldErrors): AuthField | null {
  for (const field of ["email", "username", "password"] as const) {
    if (errors[field]) {
      return field;
    }
  }

  return null;
}

export function resolveSafeReturnTo(rawReturnTo: string | null) {
  const fallback = { path: "/app", usedFallback: rawReturnTo !== null };
  if (
    !rawReturnTo?.trim() ||
    !rawReturnTo.startsWith("/") ||
    rawReturnTo.startsWith("//")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(rawReturnTo, "http://frontend.local");
    if (
      parsed.origin !== "http://frontend.local" ||
      !parsed.pathname.startsWith("/app")
    ) {
      return fallback;
    }

    return {
      path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      usedFallback: false,
    };
  } catch {
    return fallback;
  }
}
