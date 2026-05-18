type FrontendEnv = Partial<{
  VITE_API_BASE_URL: string;
  VITE_BACKEND_PUBLIC_ORIGIN: string;
}>;

type AdminUrlOptions = {
  apiBaseUrl?: string;
  backendPublicOrigin?: string;
  currentOrigin?: string;
};

const DEFAULT_API_BASE_URL = "/api";

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value?.trim()) {
    return null;
  }
  if (value.startsWith("/")) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    try {
      return new URL(`http://${value}`).origin;
    } catch {
      return null;
    }
  }
}

function getWindowOrigin() {
  if (typeof window === "undefined") {
    return "http://localhost";
  }

  return window.location.origin;
}

export function resolveApiBaseUrl(env: FrontendEnv = {}) {
  const rawValue = env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const normalized = stripTrailingSlashes(rawValue);

  return normalized || DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl(import.meta.env);
}

export function resolveDjangoAdminUrl(options: AdminUrlOptions = {}) {
  const apiBaseUrl = options.apiBaseUrl ?? getApiBaseUrl();
  const currentOrigin = normalizeOrigin(options.currentOrigin ?? getWindowOrigin());
  const backendOrigin = normalizeOrigin(options.backendPublicOrigin ?? null);

  if (backendOrigin && backendOrigin !== currentOrigin) {
    return `${backendOrigin}/admin/`;
  }

  const apiOrigin = normalizeOrigin(apiBaseUrl);
  if (apiOrigin && apiOrigin !== currentOrigin) {
    return `${apiOrigin}/admin/`;
  }

  return "/admin/";
}

export function getDjangoAdminUrl() {
  return resolveDjangoAdminUrl({
    apiBaseUrl: getApiBaseUrl(),
    backendPublicOrigin: import.meta.env.VITE_BACKEND_PUBLIC_ORIGIN,
    currentOrigin: getWindowOrigin(),
  });
}

export function buildApiUrl(path: string, apiBaseUrl = getApiBaseUrl()) {
  const base = stripTrailingSlashes(apiBaseUrl || DEFAULT_API_BASE_URL);
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const joined = `${base}/${normalizedPath}`;

  if (normalizeOrigin(joined)) {
    return joined;
  }

  return new URL(joined, getWindowOrigin()).toString();
}
