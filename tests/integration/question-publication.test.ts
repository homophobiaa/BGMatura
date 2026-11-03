import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedPublicQuestion } from "@/features/questions/server/public-questions";
import {
  findQuestionPublicationProblems,
  publishQuestion,
  QuestionNotReadyToPublishError,
} from "@/features/questions/server/question-publication";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

type Database = Prisma.TransactionClient;

/** A multiple-choice draft with nothing else done yet, which the database accepts. */
function createBareChoiceDraft(database: Database) {
  return database.question.create({
    data: {
      subject: "LITERATURE",
      type: "MULTIPLE_CHOICE",
      prompt: "Кой е авторът на „Под игото“?",
      assessmentMode: "OBJECTIVE",
      maximumPoints: 2,
      explanation: "Авторът е Иван Вазов.",
    },
  });
}

async function createTopic(database: Database) {
  return database.topic.create({
    data: { title: "Тестова тема", slug: `fixture-${randomUUID()}`, subject: "LITERATURE" },
  });
}

describe("question publication", () => {
  it("accepts an incomplete draft, lists what is missing, and refuses to publish it", async () => {
    await withDatabaseFixture(async (database) => {
      const draft = await createBareChoiceDraft(database);

      const problems = await findQuestionPublicationProblems(draft.id, database);

      expect(problems.map((problem) => problem.code)).toEqual([
        "multiple-choice-needs-two-options",
        "multiple-choice-correct-option-missing",
        "topic-link-missing",
        "source-missing",
      ]);
      await expect(publishQuestion(draft.id, database)).rejects.toThrow(QuestionNotReadyToPublishError);
      expect((await database.question.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("DRAFT");
    });
  });

  it("reports the reasons with the refusal", async () => {
    await withDatabaseFixture(async (database) => {
      const draft = await createBareChoiceDraft(database);

      const error = await publishQuestion(draft.id, database).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(QuestionNotReadyToPublishError);
      if (!(error instanceof QuestionNotReadyToPublishError)) throw new Error("Expected a publication refusal");
      expect(error.problems.map((problem) => problem.code)).toContain("topic-link-missing");
      expect(error.message).toContain("Add at least two answer options.");
      expect(error.message).toContain("Link the question to at least one topic.");
    });
  });

  it("clears the reasons one by one as the editor completes the question", async () => {
    await withDatabaseFixture(async (database) => {
      const draft = await createBareChoiceDraft(database);
      const codesNow = async () => (await findQuestionPublicationProblems(draft.id, database)).map((problem) => problem.code);

      await database.questionOption.create({ data: { questionId: draft.id, questionType: "MULTIPLE_CHOICE", text: "Иван Вазов", position: 0 } });
      await database.questionOption.create({ data: { questionId: draft.id, questionType: "MULTIPLE_CHOICE", text: "Пейо Яворов", position: 1 } });
      expect(await codesNow()).toEqual(["multiple-choice-correct-option-missing", "topic-link-missing", "source-missing"]);

      const correct = await database.questionOption.findFirstOrThrow({ where: { questionId: draft.id, position: 0 } });
      await database.question.update({ where: { id: draft.id }, data: { correctOptionId: correct.id } });
      expect(await codesNow()).toEqual(["topic-link-missing", "source-missing"]);

      const topic = await createTopic(database);
      await database.questionTopic.create({ data: { questionId: draft.id, topicId: topic.id, subject: "LITERATURE" } });
      expect(await codesNow()).toEqual(["source-missing"]);

      await database.questionProvenance.create({ data: { questionId: draft.id, origin: "ORIGINAL" } });
      expect(await codesNow()).toEqual(["editor-missing", "review-missing"]);

      await database.questionProvenance.update({
        where: { questionId: draft.id },
        data: { editorName: "Тестов редактор", reviewStatus: "REVIEWED", reviewedBy: "Тестов рецензент", reviewedAt: new Date() },
      });
      expect(await codesNow()).toEqual([]);
    });
  });

  it("publishes a complete, reviewed question, which students can then see", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "MULTIPLE_CHOICE",
          prompt: "Кой е авторът на „Под игото“?",
          assessmentMode: "OBJECTIVE",
          maximumPoints: 2,
          explanation: "Авторът е Иван Вазов.",
          options: { create: [{ text: "Иван Вазов", position: 0 }, { text: "Пейо Яворов", position: 1 }] },
        },
        include: { options: true },
      });
      const topic = await createTopic(database);
      await database.question.update({ where: { id: question.id }, data: { correctOptionId: question.options[0]?.id ?? "" } });
      await database.questionTopic.create({ data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" } });
      await database.questionProvenance.create({
        data: {
          questionId: question.id,
          origin: "ADAPTED",
          attribution: "По изпитен материал на МОН",
          editorName: "Тестов редактор",
          reviewStatus: "REVIEWED",
          reviewedBy: "Тестов рецензент",
          reviewedAt: new Date(),
        },
      });

      expect(await findPublishedPublicQuestion(question.id, database)).toBeNull();

      await expect(publishQuestion(question.id, database)).resolves.toEqual({ id: question.id, status: "PUBLISHED" });

      expect(await findPublishedPublicQuestion(question.id, database)).toMatchObject({ id: question.id, type: "multiple-choice" });
    });
  });

  it("publishes a complete written question without an explanation or points", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "ARGUMENTATIVE_WRITING",
          prompt: "Напишете есе.",
          assessmentMode: "SELF_REVIEW",
          referenceGuidance: "Очаква се теза, аргументи и извод.",
          rubric: [{ id: "thesis", description: "Ясна теза", indicativePoints: 4 }],
        },
      });
      const topic = await createTopic(database);
      await database.questionTopic.create({ data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" } });
      await database.questionProvenance.create({
        data: { questionId: question.id, origin: "ORIGINAL", editorName: "Тестов редактор", reviewStatus: "REVIEWED", reviewedBy: "Рецензент", reviewedAt: new Date() },
      });

      await expect(publishQuestion(question.id, database)).resolves.toMatchObject({ status: "PUBLISHED" });
    });
  });

  it("refuses an unreviewed question even when everything else is complete", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "SHORT_RESPONSE",
          prompt: "Назовете жанра на „Под игото“.",
          assessmentMode: "OBJECTIVE",
          maximumPoints: 1,
          explanation: "Жанрът е роман.",
          acceptedAnswers: ["роман"],
        },
      });
      const topic = await createTopic(database);
      await database.questionTopic.create({ data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" } });
      await database.questionProvenance.create({ data: { questionId: question.id, origin: "ORIGINAL", editorName: "Тестов редактор" } });

      const error = await publishQuestion(question.id, database).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(QuestionNotReadyToPublishError);
      if (!(error instanceof QuestionNotReadyToPublishError)) throw new Error("Expected a publication refusal");
      expect(error.problems.map((problem) => problem.code)).toEqual(["review-missing"]);
      expect(await findPublishedPublicQuestion(question.id, database)).toBeNull();
    });
  });

  it("leaves an already published question unchanged", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "ARGUMENTATIVE_WRITING",
          prompt: "Напишете есе.",
          assessmentMode: "UNGRADED",
          referenceGuidance: "Насоки.",
        },
      });
      const topic = await createTopic(database);
      await database.questionTopic.create({ data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" } });
      await database.questionProvenance.create({
        data: { questionId: question.id, origin: "ORIGINAL", editorName: "Редактор", reviewStatus: "REVIEWED", reviewedBy: "Рецензент", reviewedAt: new Date() },
      });

      await publishQuestion(question.id, database);

      await expect(publishQuestion(question.id, database)).resolves.toEqual({ id: question.id, status: "PUBLISHED" });
    });
  });

  it("refuses a question that does not exist", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(publishQuestion(randomUUID(), database)).rejects.toThrow("does not exist");
      await expect(findQuestionPublicationProblems(randomUUID(), database)).rejects.toThrow("does not exist");
    });
  });
});
