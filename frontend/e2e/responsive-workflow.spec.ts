import { expect, test } from "@playwright/test";

import {
  expectNoCoreHorizontalScroll,
  installImageDimensionMock,
  mockPlatformApi,
  testImageFile,
} from "./fixtures/platform-api";

const viewports = [
  { name: "mobile 360px", width: 360, height: 800 },
  { name: "desktop 1366px", width: 1366, height: 900 },
];

for (const viewport of viewports) {
  test(`primary workflow is reachable and readable on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installImageDimensionMock(page);
    await mockPlatformApi(page);

    await page.goto("/");
    await expectNoCoreHorizontalScroll(page);

    await page.getByRole("link", { name: "Register" }).click();
    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await page.getByLabel("Email").fill("new-user@example.com");
    await page.getByLabel("Username").fill("new-user");
    await page.getByLabel("Password").fill("StrongPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByRole("status").filter({
        hasText: "Registration complete. Log in to continue.",
      }),
    ).toBeVisible();
    await page.getByLabel("Email").fill("new-user@example.com");
    await page.getByLabel("Password").fill("StrongPassword123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
    await expectNoCoreHorizontalScroll(page);

    await page.getByRole("link", { name: "Create submission" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Create submission" }),
    ).toBeVisible();
    await page.getByLabel("Photo").setInputFiles(testImageFile);
    await expect(page.getByText("Photo selected")).toBeVisible();
    await page.getByLabel("Name").fill("Created from browser");
    await page.getByLabel("Age").fill("34");
    await page.getByLabel("Place of living").fill("Lisbon");
    await page.getByLabel("Gender").fill("User submitted");
    await page.getByLabel("Country of origin").fill("Portugal");
    await page.getByLabel("Description").fill("Created in the browser workflow.");
    await page.getByRole("button", { name: "Create submission" }).click();

    await expect(page.getByRole("alert")).toContainText("Submission created");
    await expectNoCoreHorizontalScroll(page);
    await page.getByRole("link", { name: "Open created submission" }).click();

    await expect(
      page.getByRole("heading", { name: "Submission detail" }),
    ).toBeVisible();
    await expect(page.getByText("Pending classification").first()).toBeVisible();
    await expectNoCoreHorizontalScroll(page);

    await page.getByRole("link", { name: "Return to submissions" }).click();
    await expect(page.getByRole("heading", { name: "Submissions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open details" }).first(),
    ).toBeVisible();
    await expectNoCoreHorizontalScroll(page);
  });
}
