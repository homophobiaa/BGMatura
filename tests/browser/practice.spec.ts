import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
const prefix = `browser-practice-${randomUUID()}`;
const topicTitle = `Тестова тема ${prefix}`;
let topicId: string;
const questionIds: string[] = [];

test.beforeAll(async () => {
  const topic = await database.topic.create({ data: { title: topicTitle, slug: prefix, subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED" } });
  topicId = topic.id;
  await database.lesson.create({ data: { title: `Тестов урок ${prefix}`, slug: `${prefix}-lesson`, topicId, status: "PUBLISHED",
    content: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Само тестови данни." }] }, { type: "example", title: "Пример", content: [{ type: "text", text: "Тест." }] }] } } });

  const choice = await database.question.create({ data: {
    subject: "BULGARIAN_LANGUAGE", type: "MULTIPLE_CHOICE", assessmentMode: "OBJECTIVE", prompt: "Коя дума е съществително?",
    maximumPoints: 1, explanation: "Тестово обяснение за избора.", createdAt: new Date(1),
    options: { create: [{ text: "бягам", position: 0 }, { text: "маса", position: 1 }] },
  }, include: { options: true } });
  const correct = choice.options.find((option) => option.text === "маса");
  if (!correct) throw new Error("Fixture option is missing");
  await database.question.update({ where: { id: choice.id }, data: { correctOptionId: correct.id, status: "PUBLISHED" } });
  const short = await database.question.create({ data: {
    subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED", type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE", prompt: "Напиши думата „тест“.",
    maximumPoints: 2, explanation: "Тестово обяснение за краткия отговор.", acceptedAnswers: ["тест"], createdAt: new Date(2),
  } });
  const written = await database.question.create({ data: {
    subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED", type: "EXTENDED_RESPONSE", assessmentMode: "SELF_REVIEW", prompt: "Опиши тестовата тема.",
    referenceGuidance: "Тестови насоки за самооценка.", createdAt: new Date(3),
  } });
  questionIds.push(choice.id, short.id, written.id);
  await database.questionTopic.createMany({ data: questionIds.map((questionId) => ({ questionId, topicId, subject: "BULGARIAN_LANGUAGE" })) });
});

test.afterAll(async () => {
  await database.attempt.deleteMany({ where: { topicId } });
  await database.questionSnapshot.deleteMany({ where: { questionId: { in: questionIds } } });
  await database.question.updateMany({ where: { id: { in: questionIds } }, data: { status: "DRAFT", correctOptionId: null } });
  await database.question.deleteMany({ where: { id: { in: questionIds } } });
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.topic.delete({ where: { id: topicId } });
  await database.$disconnect();
});

async function waitForPage(page: Page) {
  await page.waitForLoadState("networkidle");
}

test("a visitor practices a topic, gets feedback, resumes after refresh, and sees an honest summary", async ({ page }) => {
  await page.goto(`/balgarski-ezik/${prefix}-lesson`);
  await expect(page.getByRole("heading", { name: "Упражни темата" })).toBeVisible();

  await page.goto("/testove");
  await waitForPage(page);
  const card = page.locator(`#tema-${topicId}`);
  await expect(card.getByRole("heading", { name: topicTitle })).toBeVisible();
  await expect(card.getByText("3 въпроса в упражнението")).toBeVisible();
  await card.getByRole("button", { name: "Започни упражнение" }).click();
  await expect(page).toHaveURL(new RegExp(`/testove/${topicId}/[0-9a-f-]{36}$`));
  const sessionUrl = page.url();
  await expect(page.getByText("Въпрос 1 от 3")).toBeVisible();

  // A wrong choice is marked only after the server accepts it.
  await expect(page.getByRole("button", { name: "Провери отговора" })).toBeDisabled();
  await page.getByLabel("бягам").check();
  await page.getByRole("button", { name: "Провери отговора" }).click();
  await expect(page.getByText("Грешен отговор")).toBeVisible();
  await expect(page.getByText("Тестово обяснение за избора.")).toBeVisible();

  // Typed text survives moving away and back.
  await page.getByRole("button", { name: "Напред" }).click();
  await page.getByLabel("Напиши думата „тест“.").fill("тест");
  await page.getByRole("button", { name: "Назад" }).click();
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByLabel("Напиши думата „тест“.")).toHaveValue("тест");
  await page.getByRole("button", { name: "Провери отговора" }).click();
  await expect(page.getByText("Верен отговор · 2 от 2 т.")).toBeVisible();

  // A refresh restores the server-saved answers and position.
  await page.reload();
  await expect(page.getByText("Въпрос 2 от 3")).toBeVisible();
  await expect(page.getByText("Верен отговор · 2 от 2 т.")).toBeVisible();
  await expect(page.getByText("Отговорени: 2 от 3")).toBeVisible();

  // Finishing with an unanswered question asks first.
  await page.getByRole("button", { name: "Приключи упражнението" }).click();
  await expect(page.getByText("Един въпрос е без отговор.")).toBeVisible();
  await page.getByRole("button", { name: "Продължи упражнението" }).click();
  await page.getByRole("button", { name: "Напред" }).click();
  await page.getByLabel("Опиши тестовата тема.").fill("Моят тестов отговор.");
  await page.getByRole("button", { name: "Изпрати отговора" }).click();
  await expect(page.getByText("Тестови насоки за самооценка.")).toBeVisible();
  await page.getByRole("button", { name: "Приключи упражнението" }).click();

  // Written answers are counted apart and never scored.
  await expect(page.getByText("Упражнението е завършено")).toBeVisible();
  await expect(page.getByText("Точки от автоматично оценените въпроси: 2 от 3")).toBeVisible();
  await expect(page.getByText("Писмените отговори не получават точки от системата.")).toBeVisible();
  await expect(page.getByRole("link", { name: `Тестов урок ${prefix}` })).toBeVisible();

  // A retry is a new attempt; the earlier summary stays readable.
  await waitForPage(page);
  await page.getByRole("button", { name: "Ново упражнение по темата" }).click();
  await expect(page).not.toHaveURL(sessionUrl);
  await expect(page.getByText("Въпрос 1 от 3")).toBeVisible();
  await page.goto(sessionUrl);
  await expect(page.getByText("Упражнението е завършено")).toBeVisible();
});

test("a session link does not work in another browser", async ({ browser, page }) => {
  await page.goto("/testove");
  await waitForPage(page);
  await page.locator(`#tema-${topicId}`).getByRole("button", { name: "Започни упражнение" }).click();
  await expect(page).toHaveURL(new RegExp(`/testove/${topicId}/[0-9a-f-]{36}$`), { timeout: 15000 });
  await expect(page.getByText("Въпрос 1 от 3")).toBeVisible();
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await stranger.goto(page.url());
  await expect(stranger.getByRole("heading", { name: "Упражнението не е достъпно" })).toBeVisible();
  await other.close();
});
