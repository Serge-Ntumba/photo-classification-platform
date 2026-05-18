import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl, resolveDjangoAdminUrl } from "@/lib/config";

describe("configuration resolvers", () => {
  it("uses same-origin /api when the API base URL is empty", () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "" })).toBe("/api");
    expect(resolveApiBaseUrl({})).toBe("/api");
  });

  it("normalizes relative and absolute API base URLs", () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: "/api/" })).toBe("/api");
    expect(
      resolveApiBaseUrl({ VITE_API_BASE_URL: "https://platform.example/api/" }),
    ).toBe("https://platform.example/api");
  });

  it("resolves Django Admin as same-origin when the API is same-origin", () => {
    expect(
      resolveDjangoAdminUrl({
        apiBaseUrl: "/api",
        backendPublicOrigin: "http://localhost:5173",
        currentOrigin: "http://localhost:5173",
      }),
    ).toBe("/admin/");
  });

  it("resolves Django Admin to the backend public origin for local Vite dev", () => {
    expect(
      resolveDjangoAdminUrl({
        apiBaseUrl: "/api",
        backendPublicOrigin: "http://localhost",
        currentOrigin: "http://localhost:5173",
      }),
    ).toBe("http://localhost/admin/");
  });

  it("can infer the admin origin from an absolute API base URL", () => {
    expect(
      resolveDjangoAdminUrl({
        apiBaseUrl: "https://platform.example/api",
        currentOrigin: "http://localhost:5173",
      }),
    ).toBe("https://platform.example/admin/");
  });
});
