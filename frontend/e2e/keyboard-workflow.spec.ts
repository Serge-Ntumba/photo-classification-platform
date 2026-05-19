import { expect, test } from "@playwright/test";

import {
  installImageDimensionMock,
  mockPlatformApi,
  testImageFile,
} from "./fixtures/platform-api";

test("primary workflows are operable with keyboard navigation", async ({ page }) => {
  await installImageDimensionMock(page);
  await mockPlatformApi(page);

  await page.goto("/register");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type("keyboard@example.com");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Username")).toBeFocused();
  await page.keyboard.type("keyboard-user");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type("StrongPassword123!");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create account" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type("keyboard@example.com");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type("StrongPassword123!");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log in" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Create submission" }).last(),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Create submission" })).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Photo")).toBeFocused();
  await page.getByLabel("Photo").setInputFiles(testImageFile);
  await page.getByLabel("Name").focus();
  await page.keyboard.type("Keyboard-created submission");
  await page.keyboard.press("Tab");
  await page.keyboard.type("34");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Lisbon");
  await page.keyboard.press("Tab");
  await page.keyboard.type("User submitted");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Portugal");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Keyboard-only creation path.");
  await page.getByRole("button", { name: "Create submission" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("alert")).toContainText("Submission created");
  await page.getByRole("link", { name: "Open created submission" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Submission detail" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Last checked/i).first()).toBeVisible();

  await page.getByRole("link", { name: "Return to submissions" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
  await page.getByLabel("Status filter").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=pending_classification/);
  await page.getByRole("button", { name: "Refresh submissions" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Last checked/i).first()).toBeVisible();

  await page.getByRole("link", { name: "Open details" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Submission detail" })).toBeVisible();
});
