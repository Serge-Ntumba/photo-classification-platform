import { buildApiUrl, getApiBaseUrl } from "@/lib/config";
import type {
  ErrorRecoverability,
  NormalizedApiError,
  NormalizedErrorScope,
} from "@/lib/models";
import { defaultErrorMessage, safeErrorMessage } from "@/lib/safe-display";

type ApiClientOptions = {
  apiBaseUrl?: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function recoverabilityForScope(scope: NormalizedErrorScope): ErrorRecoverability {
  if (scope === "session" || scope === "auth") {
    return "login_again";
  }
  if (scope === "not_found") {
    return "navigate_elsewhere";
  }
  if (scope === "network") {
    return "check_submissions";
  }
  if (scope === "service_unavailable" || scope === "unknown") {
    return "retry_later";
  }

  return "correct_field";
}

function createApiError(
  scope: NormalizedErrorScope,
  message: string,
  status: number | null,
  fieldErrors: Record<string, string> = {},
): NormalizedApiError {
  const error = new Error(message) as NormalizedApiError;
  error.name = "ApiClientError";
  error.scope = scope;
  error.recoverability = recoverabilityForScope(scope);
  error.status = status;
  error.fieldErrors = fieldErrors;

  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractDetail(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (isRecord(payload.error) && typeof payload.error.detail === "string") {
    return payload.error.detail;
  }

  if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length > 0) {
    return payload.non_field_errors.join(" ");
  }

  return undefined;
}

function extractFieldErrors(payload: unknown) {
  if (!isRecord(payload)) {
    return {};
  }

  const source = isRecord(payload.error) ? payload.error : payload;
  const errors: Record<string, string> = {};

  for (const [field, value] of Object.entries(source)) {
    if (field === "code" || field === "detail") {
      continue;
    }
    if (typeof value === "string") {
      errors[field] = safeErrorMessage(value, "field");
    } else if (Array.isArray(value)) {
      errors[field] = safeErrorMessage(value.join(" "), "field");
    }
  }

  return errors;
}

function scopeForStatus(status: number, fieldErrors: Record<string, string>) {
  if (status === 401) {
    return "session";
  }
  if (status === 403 || status === 404) {
    return "not_found";
  }
  if (status >= 500) {
    return "service_unavailable";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return "field";
  }
  if (status >= 400 && status < 500) {
    return "form";
  }

  return "unknown";
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeRequestBody(body: RequestOptions["body"]) {
  if (body == null) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    typeof body === "string" ||
    body instanceof URLSearchParams
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function isJsonBody(body: RequestOptions["body"]) {
  return (
    body != null &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams) &&
    typeof body !== "string"
  );
}

export function isApiError(error: unknown): error is NormalizedApiError {
  return (
    error instanceof Error &&
    (error as Partial<NormalizedApiError>).name === "ApiClientError"
  );
}

export function createApiClient(options: ApiClientOptions = {}) {
  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(init.headers);
    const token = options.getAccessToken?.();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (isJsonBody(init.body) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    try {
      const response = await fetchImpl(buildApiUrl(path, apiBaseUrl), {
        ...init,
        body: normalizeRequestBody(init.body),
        headers,
        signal: controller.signal,
      });
      const payload = await parseResponseBody(response);

      if (!response.ok) {
        const fieldErrors = extractFieldErrors(payload);
        const scope = scopeForStatus(response.status, fieldErrors);
        if (scope === "session") {
          options.onUnauthorized?.();
        }
        const detail = extractDetail(payload);
        const message =
          detail === undefined
            ? defaultErrorMessage(scope)
            : safeErrorMessage(detail, scope);

        throw createApiError(scope, message, response.status, fieldErrors);
      }

      return payload as T;
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }

      throw createApiError("network", defaultErrorMessage("network"), null);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    request,
    get: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: RequestOptions["body"], init?: RequestOptions) =>
      request<T>(path, { ...init, method: "POST", body }),
    put: <T>(path: string, body?: RequestOptions["body"], init?: RequestOptions) =>
      request<T>(path, { ...init, method: "PUT", body }),
  };
}
