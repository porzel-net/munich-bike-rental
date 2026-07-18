import { expect, test, type Page } from "@playwright/test";

async function dismissConsentBanner(page: Page) {
  const locationDialog = page.getByRole("dialog", {
    name: /wo möchtest du dein bike abholen|where would you like to pick up your bike/i,
  });
  if (await locationDialog.isVisible()) {
    await locationDialog.getByRole("button", { name: /schließen|close/i }).click();
  }

  const button = page.getByRole("button", { name: /nur notwendige akzeptieren|necessary only/i });
  if (await button.isVisible()) {
    await button.click();
  }
}

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

test("keeps main interactions available", async ({ page }, testInfo) => {
  await page.goto("/");
  await dismissConsentBanner(page);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: /menü|menu/i }).click();
    await expect(page.getByLabel("Mobile primary")).toBeVisible();
    await page.getByRole("button", { name: /menü|menu/i }).click();
    await expect(page.locator(".mobile-drawer")).not.toHaveClass(/is-open/);
  }
  await page.locator(".portfolio-card").first().click();
  await expect(page.locator(".bike-modal")).toBeVisible();
  await page
    .locator(".bike-modal")
    .getByRole("button", { name: /schließen|close/i })
    .click();
  await expect(page.locator(".bike-modal")).not.toBeVisible();

  await expect(page.locator('input[name="location"]')).toHaveValue("munich");
  const bikeSizeSelect = page.locator("select[name=bikeSize]");
  await bikeSizeSelect.scrollIntoViewIfNeeded();
  await expect(bikeSizeSelect.locator("option")).toHaveCount(12);
  await bikeSizeSelect.selectOption({ index: 1 });
});

test("validates both forms without submitting", async ({ page }) => {
  await page.goto("/");
  await dismissConsentBanner(page);
  await page.locator("section#contact button[type=submit]").click();
  await expect(page.locator("#name-error")).toBeVisible();
  await page.goto("/wartung");
  await page.locator(".maintenance-form button[type=submit]").click();
  await expect(page.locator("#maintenance-name-error")).toBeVisible();
});

test("preserves the reference layout", async ({ page }, testInfo) => {
  await page.goto("/");
  await dismissConsentBanner(page);
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
