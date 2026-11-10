import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
test.afterAll(() => database.$disconnect());

test("practice resumes through a browser cookie and a visitor with the link cannot read it", async ({ context, request, baseURL }) => {
  if (!baseURL) throw new Error("Browser test server origin is missing");
  const fixture = await database.$transaction(async (transaction) => {
    const topic = await transaction.topic.create({
      data: { slug: randomUUID(), title: "Тестова тема", subject: "LITERATURE", status: "PUBLISHED" },
    });
    const question = await transaction.question.create({ data: {
      subject: "LITERATURE", status: "PUBLISHED", type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE",
      prompt: "Кой е авторът?", acceptedAnswers: ["Вазов"], explanation: "Тестово обяснение.", maximumPoints: 2,
    } });
    await transaction.questionTopic.create({ data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" } });
    return { topicId: topic.id, questionId: question.id };
  });

  try {
    const start = await context.request.post("/api/attempts", { headers: { Origin: baseURL }, data: { mode: "practice", topicId: fixture.topicId } });
    expect(start.status(), await start.text()).toBe(201);
    const { id } = z.strictObject({ id: z.uuid() }).parse(await start.json());
    const attemptPath = `/api/attempts/${id}`;
    const cookies = await context.cookies(new URL(attemptPath, baseURL).toString());
    expect(cookies.find(({ name }) => name === "bgm_attempt")).toMatchObject({ httpOnly: true, path: attemptPath });
    expect((await context.cookies(baseURL)).some(({ name }) => name === "bgm_attempt")).toBe(false);

    const answer = { questionId: fixture.questionId, type: "short-response", text: "Вазов" };
    const save = await context.request.post(attemptPath, {
      headers: { Origin: baseURL }, data: { operation: "save", answer, expectedRevision: 0 },
    });
    expect(save.status(), await save.text()).toBe(200);
    const restored = await context.request.get(attemptPath);
    expect(restored.status()).toBe(200);
    expect(await restored.json()).toMatchObject({ questions: [{ answer, revision: 1 }] });
    expect((await request.get(attemptPath)).status()).toBe(404);
    await context.clearCookies();
    expect((await context.request.get(attemptPath)).status()).toBe(404);
  } finally {
    await database.attempt.deleteMany({ where: { topicId: fixture.topicId } });
    await database.questionSnapshot.deleteMany({ where: { questionId: fixture.questionId } });
    await database.question.delete({ where: { id: fixture.questionId } });
    await database.topic.delete({ where: { id: fixture.topicId } });
  }
});
