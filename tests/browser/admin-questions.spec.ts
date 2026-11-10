import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createTestAdmin } from "../fixtures/admin-session";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
const prefix = `browser-questions-${randomUUID()}`;
const topicTitle = `Тестова тема ${prefix}`;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
let topicId: string;

// One allowlisted editor per project, so this file's tests share a worker.
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, info) => {
  admin = await createTestAdmin(database, `questions-${info.project.name}@example.test`);
  topicId = (await database.topic.create({ data: { title: topicTitle, slug: prefix, subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED" } })).id;
});

test.afterAll(async () => {
  const questions = await database.question.findMany({ where: { prompt: { startsWith: prefix } }, select: { id: true } });
  const ids = questions.map(({ id }) => id);
  await database.question.updateMany({ where: { id: { in: ids } }, data: { status: "DRAFT", correctOptionId: null } });
  await database.question.deleteMany({ where: { id: { in: ids } } });
  await database.topic.delete({ where: { id: topicId } });
  await admin.cleanup();
  await database.$disconnect();
});

async function openForm(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function fillReview(page: Page) {
  await page.getByLabel("Редактор", { exact: true }).fill("Тестов редактор");
  await page.getByLabel("Прегледах въпроса и потвърждавам, че е верен").check();
}

test("an editor builds a multiple-choice question, fixes publication problems, and previews the key", async ({ page, context }) => {
  await context.addCookies(admin.cookies);
  await openForm(page, "/admin/questions/new");
  await page.getByLabel("Условие").fill(`${prefix} Коя дума е съществително?`);
  for (let index = 0; index < 3; index++) await page.getByRole("button", { name: "+ Добави отговор" }).click();
  await page.getByPlaceholder("Отговор 1").fill("бягам");
  await page.getByPlaceholder("Отговор 2").fill("маса");
  await page.getByPlaceholder("Отговор 3").fill("бързо");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();

  // Publication explains each missing part next to its field.
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Отбележи верния отговор.")).toBeVisible();
  await expect(page.getByText("Свържи въпроса с поне една тема.")).toBeVisible();
  await expect(page.getByText("Добави обяснението, което ученикът вижда след отговора.")).toBeVisible();

  // The key follows its option when options are reordered.
  await page.getByRole("radio", { name: "Верен отговор" }).nth(1).check();
  await page.getByRole("button", { name: "Премести отговор 2 нагоре" }).click();
  await page.getByLabel("Обяснение").fill("Тестово обяснение.");
  await page.getByLabel(topicTitle).check();
  await fillReview(page);
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText("Промените са запазени.")).toBeVisible();
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Материалът е публикуван")).toBeVisible();

  const saved = await database.question.findFirstOrThrow({ where: { prompt: `${prefix} Коя дума е съществително?` }, include: { options: { orderBy: { position: "asc" } } } });
  expect(saved.options.map(({ text }) => text)).toEqual(["маса", "бягам", "бързо"]);
  expect(saved.correctOptionId).toBe(saved.options[0]?.id);

  await openForm(page, `/admin/preview/question/${saved.id}`);
  await expect(page.getByText("Верен отговор: маса")).toBeVisible();
  await page.getByLabel("бягам").check();
  await page.getByRole("button", { name: "Покажи обратната връзка" }).click();
  await expect(page.getByText("Грешно")).toBeVisible();
  await expect(page.getByText("Тестово обяснение.")).toBeVisible();

  await openForm(page, `/admin/questions?type=MULTIPLE_CHOICE&topic=${topicId}&status=PUBLISHED`);
  await expect(page.getByText(`${prefix} Коя дума е съществително?`)).toBeVisible();
  await expect(page.getByLabel("Вид")).toHaveValue("MULTIPLE_CHOICE");
});

test("an editor creates short-answer and self-review questions with the right controls", async ({ page, context }) => {
  await context.addCookies(admin.cookies);
  await openForm(page, "/admin/questions/new");
  await page.getByLabel("Вид въпрос").selectOption("SHORT_RESPONSE");
  await page.getByLabel("Условие").fill(`${prefix} Напиши „тест“.`);
  await page.getByLabel("Приемливи отговори").fill("тест\nТест");
  await page.getByLabel("Точки").fill("1,5");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  const short = await database.question.findFirstOrThrow({ where: { prompt: `${prefix} Напиши „тест“.` } });
  expect(short.acceptedAnswers).toEqual(["тест", "Тест"]);
  expect(short.maximumPoints?.toNumber()).toBe(1.5);

  await openForm(page, "/admin/questions/new");
  await page.getByLabel("Вид въпрос").selectOption("ARGUMENTATIVE_WRITING");
  await expect(page.getByLabel("Оценяване")).toHaveValue("SELF_REVIEW");
  await expect(page.getByLabel("Точки")).toHaveCount(0);
  await page.getByLabel("Условие").fill(`${prefix} Напиши есе.`);
  await page.getByLabel("Насоки за самооценка").fill("Тестови насоки.");
  await page.getByRole("button", { name: "+ Добави критерий" }).click();
  await page.getByLabel("Критерий 1", { exact: true }).fill("Ясна теза");
  await page.getByLabel("Точки (ориентир)").fill("4");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await expect(page.getByText("Черновата е създадена.")).toBeVisible();
  const essay = await database.question.findFirstOrThrow({ where: { prompt: `${prefix} Напиши есе.` } });
  expect(essay).toMatchObject({ assessmentMode: "SELF_REVIEW", maximumPoints: null, referenceGuidance: "Тестови насоки." });
  expect(essay.rubric).toEqual([expect.objectContaining({ description: "Ясна теза", indicativePoints: 4 })]);
});
