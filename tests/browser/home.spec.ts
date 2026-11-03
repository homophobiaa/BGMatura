import { expect, test } from "@playwright/test";

test("public introduction is readable without registration", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await expect(page).toHaveTitle("BG Matura — подготовка за ДЗИ по БЕЛ");
  await expect(page.getByRole("heading", { name: /Учи с разбиране/ })).toBeVisible();
  await expect(page.getByText(/Платформата е в разработка/)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width);
});

const learningPaths = ["Литература", "Български език", "Тестове", "Пробна матура"];

/** Opacity of the element times that of every ancestor: what the reader actually sees. */
function seenOpacity(selector: string) {
  const element = document.querySelector(selector);
  let opacity = 1;
  for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
  return opacity;
}

test.describe("homepage without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // React streams a Suspense boundary out of line, to be revealed by a script, once the page grows
  // past its chunk size. The homepage sits inside the root loading boundary, so this catches it.
  test("shows every scene and the call to action, not the loading message", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Зареждане на съдържанието…")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: /Учи с разбиране/ })).toBeVisible();
    for (const title of learningPaths) await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Започни безплатно, без регистрация." })).toBeVisible();
  });
});

test.describe("homepage with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("is an ordinary stack of sections with nothing pinned or animated", async ({ page }) => {
    await page.goto("/");
    const stages = await page.locator("main section[aria-labelledby] > div").evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).position));
    expect(stages).toHaveLength(5);
    expect(new Set(stages)).toEqual(new Set(["static"]));
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    for (const id of ["literatura", "balgarski-ezik", "testove", "probna-matura"]) {
      expect(await page.evaluate(seenOpacity, `#${id}`)).toBe(1);
    }
  });
});

test("every scene link lands on a readable learning path", async ({ page }) => {
  await page.goto("/");
  for (const [index, title] of learningPaths.entries()) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole("navigation", { name: "Твоята подготовка, стъпка по стъпка" }).getByRole("link", { name: title }).click();
    const id = ["literatura", "balgarski-ezik", "testove", "probna-matura"][index] ?? "";
    await expect(page.locator(`#${id}`)).toBeInViewport();
    await expect.poll(() => page.evaluate(seenOpacity, `#${id}`)).toBeGreaterThan(0.95);
  }
});

test("missing public content returns HTTP 404", async ({ page }) => {
  const response = await page.goto("/content-that-does-not-exist");
  expect(response?.status()).toBe(404);
});
