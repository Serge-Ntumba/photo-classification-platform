import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient, isApiError } from "@/lib/api-client";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

describe("API client", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends bearer auth for authenticated requests", async () => {
    server.use(
      http.get(apiUrl("/protected/"), ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer access-token");
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient({
      apiBaseUrl: "/api",
      getAccessToken: () => "access-token",
    });

    await expect(client.get<{ ok: boolean }>("/protected/")).resolves.toEqual({
      ok: true,
    });
  });

  it("supports multipart requests without forcing a JSON content type", async () => {
    server.use(
      http.post(apiUrl("/uploads/"), async ({ request }) => {
        expect(request.headers.get("content-type")).toContain("multipart/form-data");
        expect(request.headers.get("content-type")).not.toContain("application/json");
        const data = await request.formData();

        return HttpResponse.json({
          name: data.get("name"),
          photo: data.get("photo") !== null,
        });
      }),
    );

    const body = new FormData();
    body.set("name", "Profile");
    body.set("photo", new File(["image"], "photo.jpg", { type: "image/jpeg" }));

    const client = createApiClient({ apiBaseUrl: "/api" });

    await expect(client.post("/uploads/", body)).resolves.toEqual({
      name: "Profile",
      photo: true,
    });
  });

  it("normalizes timeout and abort failures as network errors", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const client = createApiClient({
      apiBaseUrl: "/api",
      fetchImpl,
      timeoutMs: 5,
    });
    const request = client.get("/slow/").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(6);

    await expect(request).resolves.toMatchObject({
      scope: "network",
      recoverability: "check_submissions",
    });
  });

  it("signals 401 responses and clears protected state at the caller boundary", async () => {
    const onUnauthorized = vi.fn();
    server.use(
      http.get(apiUrl("/auth/me/"), () => {
        return HttpResponse.json(
          { error: { code: "not_authenticated", detail: "Authentication failed" } },
          { status: 401 },
        );
      }),
    );

    const client = createApiClient({
      apiBaseUrl: "/api",
      getAccessToken: () => "expired-token",
      onUnauthorized,
    });

    await expect(client.get("/auth/me/")).rejects.toMatchObject({
      scope: "session",
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("normalizes unsafe backend details into safe user-facing errors", async () => {
    server.use(
      http.get(apiUrl("/unsafe-error/"), () => {
        return HttpResponse.json(
          {
            error: {
              code: "api_error",
              detail: "Traceback leaked token=abc and uploads/submissions/private.jpg",
            },
          },
          { status: 400 },
        );
      }),
    );

    const client = createApiClient({ apiBaseUrl: "/api" });

    try {
      await client.get("/unsafe-error/");
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect(error).toMatchObject({
        scope: "form",
        message: "Something went wrong. Try again later.",
      });
    }
  });
});
