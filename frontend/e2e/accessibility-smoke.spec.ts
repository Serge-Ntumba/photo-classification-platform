import { expect, test } from "@playwright/test";

import {
  expectContrastAtLeast,
  expectNoCoreHorizontalScroll,
  expectVisibleFocus,
  installImageDimensionMock,
  mockPlatformApi,
  seedAuthenticatedSession,
  testImageFile,
} from "./fixtures/platform-api";

test("primary controls have accessible names, visible focus, contrast, and text states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await installImageDimensionMock(page);
  await seedAuthenticatedSession(page);
  await mockPlatformApi(page);

  await page.goto("/app/submissions");
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();

  const refreshButton = page.getByRole("button", { name: "Refresh submissions" });
  await refreshButton.focus();
  await expectVisibleFocus(refreshButton);
  await expectContrastAtLeast(refreshButton);

  await expect(page.getByLabel("Status filter")).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "Pending classification" }).first(),
  ).toBeVisible();
  await expectNoCoreHorizontalScroll(page);
});

test("validation, upload progress, refreshes, and session expiry are announced", async ({
  page,
}) => {
  await installImageDimensionMock(page);
  await seedAuthenticatedSession(page);
  const api = await mockPlatformApi(page, { createDelayMs: 250 });

  await page.goto("/app/submissions/new");
  await expect(page.getByRole("heading", { name: "Create submission" })).toBeVisible();

  await page.getByRole("button", { name: "Create submission" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Name is required." }),
  ).toBeVisible();

  await page.getByLabel("Photo").setInputFiles(testImageFile);
  await page.getByLabel("Name").fill("Accessible workflow");
  await page.getByLabel("Age").fill("36");
  await page.getByLabel("Place of living").fill("Zurich");
  await page.getByLabel("Gender").fill("User submitted");
  await page.getByLabel("Country of origin").fill("Switzerland");
  await page.getByRole("button", { name: "Create submission" }).click();

  await expect(
    page.getByRole("status", { name: "Submission form update" }),
  ).toContainText("Submitting submission");
  await expect(page.getByRole("alert")).toContainText("Submission created");

  await page.goto("/app/submissions");
  await page.getByRole("button", { name: "Refresh submissions" }).click();
  await expect(page.getByText(/Last checked/i).first()).toBeVisible();

  api.expireSession();
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Your session expired. Log in again.",
  );
});
