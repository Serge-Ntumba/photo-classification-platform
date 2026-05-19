import { expect, type Locator, type Page, type Route } from "@playwright/test";
import { Buffer } from "node:buffer";

const AUTH_SESSION_STORAGE_KEY = "photo-classification.auth-session";
const ACCESS_TOKEN = "e2e-access-token";
const PAGE_SIZE = 2;

type RawUser = {
  id: string;
  email: string;
  username: string;
  is_staff: boolean;
};

type RawSubmission = {
  id: string;
  name: string;
  age: number;
  place_of_living: string;
  gender: string;
  country_of_origin: string;
  description: string;
  photo: {
    content_type: string;
    size_bytes: number;
    object_key?: string;
    original_filename?: string;
  };
  status: string;
  classification: {
    category: string;
    review_decision: string;
    reasons: string[];
    classified_at: string;
    score?: number;
    provider?: string;
  } | null;
  created_at: string;
  updated_at: string;
};

type PlatformApiOptions = {
  createDelayMs?: number;
  user?: Partial<RawUser>;
  submissions?: RawSubmission[];
};

const defaultUser: RawUser = {
  id: "user-e2e",
  email: "e2e@example.com",
  username: "e2e-user",
  is_staff: false,
};

export const testImageFile = {
  name: "safe-photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax6e5sAAAAASUVORK5CYII=",
    "base64",
  ),
};

export function representativeSubmissions(): RawSubmission[] {
  return [
    {
      id: "submission-pending",
      name: "Keyboard workflow profile",
      age: 31,
      place_of_living: "Berlin",
      gender: "User submitted",
      country_of_origin: "Germany",
      description: "A submission waiting for automated review.",
      photo: {
        content_type: "image/jpeg",
        size_bytes: 1048576,
        object_key: "private/submissions/hidden.jpg",
        original_filename: "hidden-original-name.jpg",
      },
      status: "pending_classification",
      classification: null,
      created_at: "2026-05-18T11:00:00Z",
      updated_at: "2026-05-18T11:00:00Z",
    },
    {
      id: "submission-classified",
      name: "Completed review",
      age: 28,
      place_of_living: "Paris",
      gender: "User submitted",
      country_of_origin: "France",
      description: "Completed automated checks.",
      photo: {
        content_type: "image/png",
        size_bytes: 2048,
      },
      status: "classified",
      classification: {
        category: "valid_profile_candidate",
        review_decision: "passes_automated_checks",
        reasons: ["Required metadata and image checks completed."],
        classified_at: "2026-05-18T11:05:00Z",
        score: 0.99,
        provider: "internal-provider",
      },
      created_at: "2026-05-18T10:00:00Z",
      updated_at: "2026-05-18T11:05:00Z",
    },
    {
      id: "submission-review",
      name: "Manual review item",
      age: 45,
      place_of_living: "Madrid",
      gender: "User submitted",
      country_of_origin: "Spain",
      description: "Needs staff review.",
      photo: {
        content_type: "image/webp",
        size_bytes: 4096,
      },
      status: "needs_manual_review",
      classification: {
        category: "incomplete_metadata",
        review_decision: "needs_manual_review",
        reasons: ["Required metadata needs staff review."],
        classified_at: "2026-05-18T09:30:00Z",
      },
      created_at: "2026-05-18T09:00:00Z",
      updated_at: "2026-05-18T09:30:00Z",
    },
  ];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthorized(route: Route) {
  return route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`;
}

function nextPageUrl(page: number, status: string | null) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (status) {
    params.set("status", status);
  }

  return `/api/submissions/?${params.toString()}`;
}

export async function installImageDimensionMock(page: Page) {
  await page.addInitScript(() => {
    class MockImage {
      naturalWidth = 640;
      naturalHeight = 640;
      width = 640;
      height = 640;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onload?.(new Event("load")), 0);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
  });
}

export async function seedAuthenticatedSession(
  page: Page,
  user: RawUser = defaultUser,
) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: AUTH_SESSION_STORAGE_KEY,
      session: {
        accessToken: ACCESS_TOKEN,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          isStaff: user.is_staff,
        },
        status: "authenticated",
        lastVerifiedAt: "2026-05-18T11:15:00Z",
      },
    },
  );
}

export async function mockPlatformApi(page: Page, options: PlatformApiOptions = {}) {
  const user = { ...defaultUser, ...options.user };
  const state = {
    sessionExpired: false,
    submissions: [...(options.submissions ?? representativeSubmissions())],
  };

  await page.route("**/api/auth/register/", async (route) => {
    const requestBody = (await route.request().postDataJSON()) as {
      email?: string;
      username?: string;
    };

    return json(
      route,
      {
        id: "registered-user",
        email: requestBody.email ?? "registered@example.com",
        username: requestBody.username ?? "registered-user",
        is_staff: false,
        created_at: "2026-05-18T12:00:00Z",
      },
      201,
    );
  });

  await page.route("**/api/auth/login/", async (route) => {
    const requestBody = (await route.request().postDataJSON()) as {
      password?: string;
    };

    if (requestBody.password === "wrong-password") {
      return json(
        route,
        {
          error: {
            code: "invalid_credentials",
            detail: "Unable to log in with provided credentials.",
          },
        },
        401,
      );
    }

    state.sessionExpired = false;
    return json(route, {
      access: ACCESS_TOKEN,
      refresh: "refresh-token-not-persisted",
      user,
    });
  });

  await page.route("**/api/auth/me/", async (route) => {
    if (state.sessionExpired || !isAuthorized(route)) {
      return json(
        route,
        { error: { detail: "Authentication credentials failed." } },
        401,
      );
    }

    return json(route, user);
  });

  await page.route(/\/api\/submissions\/(?:\?.*)?$/, async (route) => {
    if (!isAuthorized(route)) {
      return json(route, { error: { detail: "Authentication required." } }, 401);
    }

    if (route.request().method() === "POST") {
      if (options.createDelayMs) {
        await delay(options.createDelayMs);
      }

      const created: RawSubmission = {
        id: "submission-created",
        name: "Created from browser",
        age: 34,
        place_of_living: "Lisbon",
        gender: "User submitted",
        country_of_origin: "Portugal",
        description: "Created in the browser workflow.",
        photo: {
          content_type: "image/png",
          size_bytes: testImageFile.buffer.byteLength,
          object_key: "private/submissions/created.png",
          original_filename: "Alex_Morgan_Germany_token_profile.png",
        },
        status: "pending_classification",
        classification: null,
        created_at: "2026-05-18T12:00:00Z",
        updated_at: "2026-05-18T12:00:00Z",
      };

      state.submissions = [
        created,
        ...state.submissions.filter((submission) => submission.id !== created.id),
      ];

      return json(route, created, 201);
    }

    const url = new URL(route.request().url());
    const pageNumber = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const status = url.searchParams.get("status");
    const filtered = status
      ? state.submissions.filter((submission) => submission.status === status)
      : state.submissions;
    const start = (pageNumber - 1) * PAGE_SIZE;
    const results = filtered.slice(start, start + PAGE_SIZE);
    const hasNext = start + PAGE_SIZE < filtered.length;
    const hasPrevious = pageNumber > 1;

    return json(route, {
      count: filtered.length,
      next: hasNext ? nextPageUrl(pageNumber + 1, status) : null,
      previous: hasPrevious ? nextPageUrl(pageNumber - 1, status) : null,
      results,
    });
  });

  await page.route(/\/api\/submissions\/[^/]+\/$/, async (route) => {
    if (!isAuthorized(route)) {
      return json(route, { error: { detail: "Authentication required." } }, 401);
    }

    const url = new URL(route.request().url());
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    const submission = state.submissions.find((item) => item.id === id);

    if (!submission) {
      return json(route, { error: { detail: "Not found." } }, 404);
    }

    return json(route, submission);
  });

  return {
    expireSession() {
      state.sessionExpired = true;
    },
    restoreSession() {
      state.sessionExpired = false;
    },
    state,
    user,
  };
}

export async function expectNoCoreHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const main = document.querySelector("main");
    const documentOverflow = documentElement.scrollWidth - documentElement.clientWidth;
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;

    return Math.max(documentOverflow, mainOverflow);
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();

  const hasVisibleFocus = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);

    return (
      style.outlineStyle !== "none" ||
      style.boxShadow !== "none" ||
      style.textDecorationLine.includes("underline")
    );
  });

  expect(hasVisibleFocus).toBe(true);
}

export async function expectContrastAtLeast(locator: Locator, minimumRatio = 4.5) {
  const ratio = await locator.evaluate((element) => {
    function parseRgb(value: string) {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) {
        return null;
      }

      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function channel(value: number) {
      const normalized = value / 255;

      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    }

    function luminance(rgb: number[]) {
      return (
        0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
      );
    }

    let current: Element | null = element;
    let background: number[] | null = null;
    const foreground = parseRgb(window.getComputedStyle(element).color);

    while (current && !background) {
      const candidate = parseRgb(window.getComputedStyle(current).backgroundColor);
      if (candidate) {
        background = candidate;
      }
      current = current.parentElement;
    }

    if (!foreground || !background) {
      return 0;
    }

    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));

    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(ratio).toBeGreaterThanOrEqual(minimumRatio);
}
