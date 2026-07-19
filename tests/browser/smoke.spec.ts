import { expect, test } from "@playwright/test";

const munichPath = "/rennradverleih/münchen/maxvorstadt";
const consentCookieValue = encodeURIComponent(
  JSON.stringify({ analytics: false, updatedAt: "2026-07-19T00:00:00.000Z" }),
);

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "munich_rental_consent",
      value: consentCookieValue,
      url: "http://127.0.0.1:3000",
    },
  ]);
});

test("keeps the consent banner keyboard operable and the page clickable", async ({ context, page }) => {
  await context.clearCookies();
  await page.goto(munichPath);

  const consentDialog = page.getByRole("dialog", { name: "Cookies und externe Inhalte" });
  const necessaryOnlyButton = consentDialog.getByRole("button", { name: "Nur notwendige akzeptieren" });
  const privacyLink = consentDialog.getByRole("link", { name: "Zur Datenschutzerklärung" });

  await expect(consentDialog).toBeVisible();
  await expect(necessaryOnlyButton).toBeFocused();
  await expect(privacyLink).toBeVisible();
  await page.locator(".portfolio-card").first().click();
  await expect(page.locator(".bike-modal")).toBeVisible();
  await page
    .locator(".bike-modal")
    .getByRole("button", { name: /schließen/i })
    .click();
  await necessaryOnlyButton.focus();
  await page.keyboard.press("Escape");
  await expect(consentDialog).not.toBeVisible();

  const settingsButton = page.getByRole("button", { name: "Cookie-Einstellungen" });
  await settingsButton.click();
  await expect(consentDialog).toBeVisible();
  await expect(necessaryOnlyButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settingsButton).toBeFocused();
});

test("renders the German and English landing pages without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page).toHaveURL(
    new RegExp(`${munichPath.replace("münchen", "m%C3%BCnchen")}(?:\\?standortauswahl=1)?$`),
  );
  const locationDialog = page.getByRole("dialog", { name: /wo möchtest du dein bike abholen/i });
  await expect(locationDialog).toBeVisible();
  await locationDialog.getByRole("button", { name: "Schließen" }).click();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("section#contact")).toBeVisible();
  await page.goto(`${munichPath}?lang=en`);
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps main interactions available", async ({ page }, testInfo) => {
  await page.goto(munichPath);
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
  await page.goto(munichPath);
  await page.locator("section#contact button[type=submit]").click();
  await expect(page.locator("#name-error")).toBeVisible();
  await page.goto("/wartung");
  await page.locator(".maintenance-form button[type=submit]").click();
  await expect(page.locator("#maintenance-name-error")).toBeVisible();
});

test("keeps the primary layout responsive", async ({ page }) => {
  await page.goto(munichPath);
  await expect(page.locator("section#home")).toBeVisible();
  await expect(page.locator("section#price")).toBeVisible();
  await expect(page.locator("section#location")).toBeVisible();
  await expect(page.locator("section#contact")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
