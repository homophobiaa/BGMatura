import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";

import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
const suffix = randomUUID();
const authorSlug = `fixture-author-${suffix}`;
const workSlug = `fixture-work-${suffix}`;
const draftWorkSlug = `fixture-draft-${suffix}`;
const topicSlug = `fixture-topic-${suffix}`;
const childSlug = `fixture-child-${suffix}`;
const lessonSlug = `fixture-lesson-${suffix}`;
const draftLessonSlug = `fixture-draft-lesson-${suffix}`;
const hiddenAuthorSlug = `fixture-hidden-author-${suffix}`;
const title = `Тестово произведение ${suffix}`;
const lessonTitle = `Тестов урок ${suffix}`;
const fixtureNotice = "Само тестови данни, не е учебен материал.";
const attack = '<img src=x onerror="window.__unsafe = true">';

test.beforeAll(async () => {
  await database.$transaction(async (transaction) => {
    const author = await transaction.author.create({ data: { name: `Тестов автор ${suffix}`, slug: authorSlug, context: fixtureNotice, status: "PUBLISHED" } });
    await transaction.author.create({ data: { name: "Скрит автор", slug: hiddenAuthorSlug } });
    await transaction.work.create({ data: { title, slug: workSlug, authorId: author.id, genre: `Тестов жанр ${suffix}`, summary: `${fixtureNotice} ${attack} ${"Дълъг български текст. ".repeat(100)}`, themes: ["Тестова тема"], importantIdeas: ["Тестова идея"], interpretation: fixtureNotice, status: "PUBLISHED" } });
    await transaction.work.create({ data: { title: "Скрито произведение", slug: draftWorkSlug, authorId: author.id } });
    const topic = await transaction.topic.create({ data: { title: `Тестова тема ${suffix}`, slug: topicSlug, subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED" } });
    const child = await transaction.topic.create({ data: { title: `Подтема ${suffix}`, slug: childSlug, subject: "BULGARIAN_LANGUAGE", parentId: topic.id, status: "PUBLISHED" } });
    await transaction.lesson.create({ data: { title: lessonTitle, slug: lessonSlug, topicId: child.id, status: "PUBLISHED", content: {
      version: 1, blocks: [
        { type: "heading", level: 2, text: "Правило" },
        { type: "paragraph", content: [{ type: "text", text: `${fixtureNotice} ${attack}` }] },
        { type: "example", title: "Пример", content: [{ type: "text", text: "ѝ, й, щ, ъ — „Български текст“." }] },
        { type: "list", ordered: true, items: [[{ type: "text", text: "Първо" }], [{ type: "text", text: "Второ" }]] },
        { type: "quotation", content: [{ type: "text", text: "Цитат за тест" }], attribution: "Тестов източник" },
        { type: "paragraph", content: [{ type: "link", href: "/literatura", text: "Към литературата" }] },
        { type: "paragraph", content: [{ type: "text", text: "д".repeat(500) }] },
      ],
    } } });
    await transaction.lesson.create({ data: { title: "Скрит урок", slug: draftLessonSlug, topicId: child.id, content: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: fixtureNotice }] }] } } });
  });
});

test.afterAll(async () => {
  // Delete only this worker's UUID-scoped fixtures, respecting required links.
  await database.$transaction(async (transaction) => {
    await transaction.lesson.deleteMany({ where: { slug: { in: [lessonSlug, draftLessonSlug] } } });
    await transaction.topic.deleteMany({ where: { slug: childSlug, subject: "BULGARIAN_LANGUAGE" } });
    await transaction.topic.deleteMany({ where: { slug: topicSlug, subject: "BULGARIAN_LANGUAGE" } });
    await transaction.work.deleteMany({ where: { slug: { in: [workSlug, draftWorkSlug] } } });
    await transaction.author.deleteMany({ where: { slug: { in: [authorSlug, hiddenAuthorSlug] } } });
  });
  await database.$disconnect();
});

test("literature filters survive the URL and link public work and author details", async ({ page }) => {
  await page.goto(`/literatura?q=${suffix}`);
  await expect(page.getByRole("heading", { name: "Литература", exact: true })).toBeVisible();
  await page.getByLabel("Заглавие или автор", { exact: true }).fill(`ТЕСТОВО ПРОИЗВЕДЕНИЕ ${suffix}`);
  await page.getByLabel("Автор", { exact: true }).selectOption(authorSlug);
  await page.getByLabel("Жанр", { exact: true }).selectOption(`Тестов жанр ${suffix}`);
  await page.getByRole("button", { name: "Търси", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`author=${authorSlug}`));
  await expect(page.getByLabel("Автор", { exact: true })).toHaveValue(authorSlug);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  for (const section of ["Накратко", "Теми", "Важни идеи", "Насоки за прочит"]) await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Герои", exact: true })).toHaveCount(0);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.getByText(attack, { exact: false })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Път до страницата" })).toContainText(title);
  await expect(page).toHaveTitle(`${title} — BG Matura`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `http://127.0.0.1:3102/literatura/${workSlug}`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Само тестови данни/);
  await page.locator("main article > header").getByRole("link", { name: `Тестов автор ${suffix}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: `Тестов автор ${suffix}` })).toBeVisible();
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText("Скрито произведение", { exact: true })).toHaveCount(0);
});

test("language hierarchy leads to safe, readable lesson blocks", async ({ page }) => {
  await page.goto("/balgarski-ezik");
  await expect(page.getByText(`Тестова тема ${suffix}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Подтема ${suffix}`, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: lessonTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: lessonTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Правило", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Пример" })).toBeVisible();
  await expect(page.locator("main blockquote")).toHaveText("Цитат за тест");
  await expect(page.locator(".learning-content ol li")).toHaveText(["Първо", "Второ"]);
  await expect(page.locator("main img")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
  await expect(page).toHaveTitle(`${lessonTitle} — BG Matura`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `http://127.0.0.1:3102/balgarski-ezik/${lessonSlug}`);
  await page.getByRole("navigation", { name: "Навигация на урока" }).getByRole("link", { name: `Подтема ${suffix}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#tema-${childSlug}`));
});

test("direct draft and unknown slugs remain unavailable", async ({ page }) => {
  for (const path of [`/literatura/${draftWorkSlug}`, `/avtori/${hiddenAuthorSlug}`, `/balgarski-ezik/${draftLessonSlug}`, `/balgarski-ezik/unknown-${suffix}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Страницата не е намерена" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.getByText("Скрит урок", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Скрито произведение", { exact: true })).toHaveCount(0);
  }
});

test("empty search offers a real reset destination", async ({ page }) => {
  await page.goto(`/literatura?q=no-match-${suffix}&author=missing-${suffix}&genre=missing-${suffix}`);
  await expect(page.getByLabel("Автор", { exact: true })).toHaveValue(`missing-${suffix}`);
  await expect(page.getByLabel("Жанр", { exact: true })).toHaveValue(`missing-${suffix}`);
  await expect(page.getByRole("status")).toContainText("Няма намерени резултати");
  await page.getByRole("link", { name: "Изчисти филтрите" }).click();
  await expect(page).toHaveURL(/\/literatura$/);
  await expect(page.getByLabel("Заглавие или автор", { exact: true })).toHaveValue("");
});

test("anonymous navigation supports keyboard, current location, and mobile menu", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Към съдържанието", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const mobileMenu = page.getByRole("button", { name: "Меню", exact: true });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
    await expect(mobileMenu).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("navigation", { name: "Мобилна навигация" }).getByRole("link", { name: "Учи", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(mobileMenu).toHaveAttribute("aria-expanded", "false");
    await expect(mobileMenu).toBeFocused();
    await mobileMenu.click();
  }
  const navigation = page.getByRole("navigation", { name: await mobileMenu.isVisible() ? "Мобилна навигация" : "Основна навигация" });
  await navigation.getByRole("link", { name: "Тестове", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Тестове", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Основна навигация", includeHidden: true }).getByRole("link", { name: "Тестове", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await expect(navigation.getByRole("link", { name: "Тестове", exact: true })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Пробна матура", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Пробна матура", exact: true })).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "За проекта" }).click();
  await expect(page.getByRole("heading", { name: "За BG Matura" })).toBeVisible();
});
