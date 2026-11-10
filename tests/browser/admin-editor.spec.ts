import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createTestAdmin } from "../fixtures/admin-session";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
const prefix = `browser-editor-${randomUUID()}`;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;

// One allowlisted editor per project, so this file's tests share a worker.
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, info) => { admin = await createTestAdmin(database, `editor-${info.project.name}@example.test`); });
test.afterAll(async () => {
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.topic.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.work.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.author.deleteMany({ where: { slug: { startsWith: prefix } } });
  await admin.cleanup();
  await database.$disconnect();
});

/** Typing before React hydrates a form would be lost, so wait until the page is idle. */
async function openForm(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("editors are sent to sign-in without a session", async ({ page }) => {
  await page.goto("/admin/learning/author");
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test("an editor creates, publishes, unpublishes, and deletes learning content", async ({ page, context }) => {
  await context.addCookies(admin.cookies);
  await page.goto("/admin");
  await expect(page.getByText("Редакторски режим")).toBeVisible();
  await page.getByRole("navigation", { name: "Администрация" }).getByRole("link", { name: "Автори" }).click();
  await expect(page.getByRole("heading", { name: "Автори", level: 1 })).toBeVisible();

  // Create an author and see validation keep the entered values.
  await page.getByRole("link", { name: "Нов автор" }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/author\/new$/);
  await page.waitForLoadState("networkidle");
  const authorName = `Тестов автор ${prefix}`;
  await page.getByLabel("Име").fill(authorName);
  await page.getByLabel("Адрес (slug)").fill("Невалиден адрес!");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Използвай букви, цифри и единични тирета.")).toBeVisible();
  await expect(page.getByLabel("Име")).toHaveValue(authorName);
  await page.getByLabel("Адрес (slug)").fill(`${prefix}-author`);
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/learning\/author\/[0-9a-f-]{36}\?created=1/);

  // Publishing reports missing fields; saving them makes the author publishable.
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Добави контекст за автора.")).toBeVisible();
  await page.getByLabel("Контекст").fill("Само тестови данни.");
  await expect(page.getByRole("button", { name: "Публикувай" })).toBeDisabled();
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText("Промените са запазени.")).toBeVisible();
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Материалът е публикуван")).toBeVisible();
  await expect(page.getByLabel("Име")).toBeDisabled();
  await page.goto(`/avtori/${prefix}-author`);
  await expect(page.getByRole("heading", { name: authorName })).toBeVisible();

  // A linked author cannot be deleted; the list explains why.
  await openForm(page, "/admin/learning/work/new");
  await page.getByLabel("Заглавие").fill("Тестово произведение");
  await page.getByLabel("Адрес (slug)").fill(`${prefix}-work`);
  await page.getByLabel("Автор").selectOption({ label: authorName });
  await page.getByLabel("Теми").fill("Първа тема\nВтора тема");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  const work = await database.work.findUniqueOrThrow({ where: { slug: `${prefix}-work` } });
  expect(work.themes).toEqual(["Първа тема", "Втора тема"]);

  await openForm(page, `/admin/learning/author?q=${prefix}`);
  await page.getByRole("link", { name: `Редактирай „${authorName}“` }).click();
  await expect(page).toHaveURL(/\/admin\/learning\/author\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Свали от публикация" }).click();
  await page.getByRole("button", { name: "Да, свали от публикация" }).click();
  await expect(page.getByText("Материалът е свален от публикация.")).toBeVisible();
  await openForm(page, `/admin/learning/author?q=${prefix}&status=DRAFT`);
  await page.getByRole("button", { name: `Изтрий „${authorName}“` }).click();
  await page.getByLabel(/Въведи адреса/).fill(`${prefix}-author`);
  await page.getByRole("button", { name: "Изтрий окончателно" }).click();
  await expect(page.getByText("Записът е свързан с друго съдържание.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Отвори записа" })).toBeVisible();

  // Deleting the unused work keeps the list filters.
  await openForm(page, `/admin/learning/work?q=${prefix}&status=DRAFT`);
  await page.getByRole("button", { name: "Изтрий „Тестово произведение“" }).click();
  await page.getByLabel(/Въведи адреса/).fill(`${prefix}-work`);
  await page.getByRole("button", { name: "Изтрий окончателно" }).click();
  await expect(page.getByText(`Записът „${prefix}-work“ е изтрит.`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`status=DRAFT`));
  await expect(page.getByLabel("Заглавие, име или адрес")).toHaveValue(prefix);
  expect(await database.work.count({ where: { slug: `${prefix}-work` } })).toBe(0);
});

test("an editor builds and publishes a lesson from blocks", async ({ page, context }) => {
  await context.addCookies(admin.cookies);
  await openForm(page, "/admin/learning/topic/new");
  await page.getByLabel("Заглавие").fill("Тестова тема");
  await page.getByLabel("Адрес (slug)").fill(`${prefix}-topic`);
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Материалът е публикуван")).toBeVisible();

  await openForm(page, "/admin/learning/lesson/new");
  await page.getByLabel("Заглавие", { exact: true }).fill("Тестов урок");
  await page.getByLabel("Адрес (slug)").fill(`${prefix}-lesson`);
  await page.getByLabel("Тема по български език").selectOption({ label: "Тестова тема" });
  await page.getByRole("button", { name: "+ Пример" }).click();
  await page.getByRole("button", { name: "+ Абзац" }).click();
  await page.getByLabel("Заглавие на примера").fill("Тестов пример");
  await page.getByLabel("Текст на примера").fill("Само тестови данни.");
  await page.getByLabel("Текст на абзаца").fill("Тестово обяснение с [връзка](/balgarski-ezik).");
  await page.getByRole("button", { name: "Премести блок 2 нагоре" }).click();
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Материалът е публикуван")).toBeVisible();

  const lesson = await database.lesson.findUniqueOrThrow({ where: { slug: `${prefix}-lesson` } });
  expect(lesson.content).toEqual({ version: 1, blocks: [
    { type: "paragraph", content: [{ type: "text", text: "Тестово обяснение с " }, { type: "link", text: "връзка", href: "/balgarski-ezik" }, { type: "text", text: "." }] },
    { type: "example", title: "Тестов пример", content: [{ type: "text", text: "Само тестови данни." }] },
  ] });
  await page.goto(`/balgarski-ezik/${prefix}-lesson`);
  await expect(page.getByRole("heading", { name: "Тестов урок" })).toBeVisible();
  await expect(page.getByRole("link", { name: "връзка" })).toBeVisible();
});
