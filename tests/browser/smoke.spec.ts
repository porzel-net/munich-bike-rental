import { expect, test } from "@playwright/test";

test("renders the German and English landing pages without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("section#contact")).toBeVisible();
  await page.goto("/?lang=en");
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps main interactions available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /menü|menu/i }).click();
  await expect(page.getByLabel("Mobile primary")).toBeVisible();
  await page.locator(".portfolio-card").first().click();
  await expect(page.locator(".bike-modal")).toBeVisible();
  await page.locator("#location").scrollIntoViewIfNeeded();
  await page.locator("select[name=location]").selectOption("regensburg");
  await expect(page.locator("select[name=bikeSize] option")).toHaveCount(8);
});

test("validates both forms without submitting", async ({ page }) => {
  await page.goto("/");
  await page.locator("section#contact button[type=submit]").click();
  await expect(page.locator("#name-error")).toBeVisible();
  await page.goto("/wartung");
  await page.locator(".maintenance-form button[type=submit]").click();
  await expect(page.locator("#maintenance-name-error")).toBeVisible();
});

test("preserves the reference layout", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot(`${testInfo.project.name}-home.png`, {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
  await page.goto("/wartung");
  await expect(page).toHaveScreenshot(`${testInfo.project.name}-maintenance.png`, {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});
