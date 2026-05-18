import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient, isApiError } from "@/lib/api-client";
import { getCurrentUser, login, registerAccount } from "@/features/auth/api";
import {
  GENERIC_AUTH_FAILURE_MESSAGE,
  mapAuthApiError,
} from "@/features/auth/validation";
import { server } from "@/test/server";

const apiUrl = (path: string) => `http://localhost:5173/api${path}`;

describe("auth API consumption", () => {
  it("registers a normal account without sending staff or permission controls", async () => {
    server.use(
      http.post(apiUrl("/auth/register/"), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;

        expect(body).toEqual({
          email: "casey@example.com",
          username: "casey",
          password: "StrongPassword123!",
        });
        expect(body).not.toHaveProperty("is_staff");
        expect(body).not.toHaveProperty("is_superuser");
        expect(body).not.toHaveProperty("permissions");

        return HttpResponse.json(
          {
            id: "user-1",
            email: "casey@example.com",
            username: "casey",
            is_staff: false,
            created_at: "2026-05-18T10:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const account = await registerAccount(createApiClient({ apiBaseUrl: "/api" }), {
      email: "casey@example.com",
      username: "casey",
      password: "StrongPassword123!",
    });

    expect(account).toMatchObject({
      id: "user-1",
      email: "casey@example.com",
      username: "casey",
      isStaff: false,
      createdAt: "2026-05-18T10:00:00Z",
    });
  });

  it("logs in by consuming the access token and safe current-user summary only", async () => {
    server.use(
      http.post(apiUrl("/auth/login/"), () =>
        HttpResponse.json({
          access: "access-token",
          refresh: "refresh-token",
          user: {
            id: "user-1",
            email: "riley@example.com",
            username: "riley",
            is_staff: false,
          },
        }),
      ),
    );

    const result = await login(createApiClient({ apiBaseUrl: "/api" }), {
      email: "riley@example.com",
      password: "StrongPassword123!",
    });

    expect(result).toEqual({
      accessToken: "access-token",
      user: {
        id: "user-1",
        email: "riley@example.com",
        username: "riley",
        isStaff: false,
      },
    });
    expect(JSON.stringify(result.user)).not.toContain("access-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
  });

  it("consumes the current-user response without exposing backend-only auth fields", async () => {
    server.use(
      http.get(apiUrl("/auth/me/"), () =>
        HttpResponse.json({
          id: "user-1",
          email: "morgan@example.com",
          username: "morgan",
          is_staff: true,
          date_joined: "2026-05-18T10:00:00Z",
          permissions: ["internal.view_secret"],
        }),
      ),
    );

    const user = await getCurrentUser(createApiClient({ apiBaseUrl: "/api" }));

    expect(user).toEqual({
      id: "user-1",
      email: "morgan@example.com",
      username: "morgan",
      isStaff: true,
    });
    expect(JSON.stringify(user)).not.toContain("permissions");
  });

  it("maps login failures to generic authentication feedback", async () => {
    server.use(
      http.post(apiUrl("/auth/login/"), () =>
        HttpResponse.json(
          {
            email: ["No account exists for casey@example.com"],
            detail: "Wrong password for casey@example.com",
          },
          { status: 400 },
        ),
      ),
    );

    try {
      await login(createApiClient({ apiBaseUrl: "/api" }), {
        email: "casey@example.com",
        password: "wrong-password",
      });
      throw new Error("Expected login to fail.");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      const mapped = mapAuthApiError(error, "login");

      expect(mapped.form).toBe(GENERIC_AUTH_FAILURE_MESSAGE);
      expect(JSON.stringify(mapped)).not.toContain("casey@example.com");
    }
  });
});
