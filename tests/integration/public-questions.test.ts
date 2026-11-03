import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedPublicQuestion } from "@/features/questions/server/public-questions";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

// Every private column carries a marker, so a leak shows up in the serialized output.
const SECRET = "ПРИВАТНО-НЕ-ЗА-УЧЕНИКА";

type Database = Prisma.TransactionClient;

async function createPublishedChoiceQuestion(database: Database) {
  const question = await database.question.create({
    data: {
      subject: "LITERATURE",
      type: "MULTIPLE_CHOICE",
      prompt: "Кой е авторът на „Под игото“?",
      assessmentMode: "OBJECTIVE",
      maximumPoints: 7,
      explanation: `${SECRET} обяснение`,
      options: {
        create: [
          { text: "Елин Пелин", position: 2 },
          { text: "Иван Вазов", position: 0 },
          { text: "Пейо Яворов", position: 1 },
        ],
      },
    },
    include: { options: true },
  });
  const correct = question.options.find((option) => option.text === "Иван Вазов");
  if (!correct) throw new Error("Fixture option was not stored");

  await database.question.update({ where: { id: question.id }, data: { correctOptionId: correct.id, status: "PUBLISHED" } });
  await database.questionProvenance.create({
    data: { questionId: question.id, origin: "ADAPTED", attribution: SECRET, editorName: SECRET, reviewNotes: SECRET },
  });

  return { id: question.id, options: question.options };
}

describe("public question projection", () => {
  it("returns only the whitelisted fields of a multiple-choice question, options in stored order", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createPublishedChoiceQuestion(database);

      const publicQuestion = await findPublishedPublicQuestion(question.id, database);

      expect(publicQuestion).toEqual({
        id: question.id,
        type: "multiple-choice",
        prompt: "Кой е авторът на „Под игото“?",
        options: [
          { id: question.options.find((option) => option.text === "Иван Вазов")?.id, text: "Иван Вазов" },
          { id: question.options.find((option) => option.text === "Пейо Яворов")?.id, text: "Пейо Яворов" },
          { id: question.options.find((option) => option.text === "Елин Пелин")?.id, text: "Елин Пелин" },
        ],
      });
    });
  });

  it("never serializes a private column, even when every one holds a marker", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createPublishedChoiceQuestion(database);

      const serialized = JSON.stringify(await findPublishedPublicQuestion(question.id, database));

      for (const privateText of [SECRET, "correctOptionId", "explanation", "maximumPoints", "status", "provenance", "acceptedAnswers"]) {
        expect(serialized).not.toContain(privateText);
      }
    });
  });

  it.each([
    ["short-response", { type: "SHORT_RESPONSE" as const, assessmentMode: "OBJECTIVE" as const, maximumPoints: 7, explanation: `${SECRET} обяснение`, acceptedAnswers: [`${SECRET} отговор`] }],
    ["extended-response", { type: "EXTENDED_RESPONSE" as const, assessmentMode: "SELF_REVIEW" as const, referenceGuidance: `${SECRET} насоки`, rubric: [{ id: "a", description: SECRET }] }],
    ["argumentative-writing", { type: "ARGUMENTATIVE_WRITING" as const, assessmentMode: "UNGRADED" as const, referenceGuidance: `${SECRET} насоки` }],
  ])("returns only id, type, and prompt for %s", async (publicType, fields) => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: { subject: "LITERATURE", prompt: "Тестов въпрос", status: "PUBLISHED", ...fields },
      });

      const publicQuestion = await findPublishedPublicQuestion(question.id, database);

      expect(publicQuestion).toEqual({ id: question.id, type: publicType, prompt: "Тестов въпрос" });
      expect(JSON.stringify(publicQuestion)).not.toContain(SECRET);
    });
  });

  it("never resolves a draft or unpublished question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createPublishedChoiceQuestion(database);
      await database.question.update({ where: { id: question.id }, data: { status: "DRAFT" } });

      expect(await findPublishedPublicQuestion(question.id, database)).toBeNull();
    });
  });

  it("returns null for an unknown question", async () => {
    await withDatabaseFixture(async (database) => {
      expect(await findPublishedPublicQuestion(randomUUID(), database)).toBeNull();
    });
  });
});
