import { expect, test } from "@playwright/test";

test("public introduction is readable without registration", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await expect(page).toHaveTitle("BG Matura — подготовка за ДЗИ по БЕЛ");
  await expect(page.getByRole("heading", { name: "BG Matura", exact: true })).toBeVisible();
  await expect(page.getByText(/Платформата е в разработка/)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width);
});

test("missing public content returns HTTP 404", async ({ page }) => {
  const response = await page.goto("/content-that-does-not-exist");
  expect(response?.status()).toBe(404);
});
