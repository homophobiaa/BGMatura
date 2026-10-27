import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedQuestionAssociations } from "@/features/questions/server/question-associations";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

type Database = Prisma.TransactionClient;

function createQuestion(database: Database, overrides: Partial<Prisma.QuestionUncheckedCreateInput> = {}) {
  return database.question.create({
    data: {
      subject: "LITERATURE",
      type: "SHORT_RESPONSE",
      prompt: "Кой е авторът на „Под игото“?",
      assessmentMode: "OBJECTIVE",
      maximumPoints: 1,
      explanation: "Авторът е Иван Вазов.",
      acceptedAnswers: ["Иван Вазов"],
      ...overrides,
    },
  });
}

function createTopic(database: Database, overrides: Partial<Prisma.TopicUncheckedCreateInput> = {}) {
  return database.topic.create({
    data: { title: "Тестова тема", slug: `fixture-${randomUUID()}`, subject: "LITERATURE", ...overrides },
  });
}

async function createWork(database: Database, overrides: Partial<Prisma.WorkUncheckedCreateInput> = {}) {
  const author = await database.author.create({ data: { name: "Тестов автор", slug: `fixture-${randomUUID()}` } });
  return database.work.create({
    data: { title: "Тестово произведение", slug: `fixture-${randomUUID()}`, authorId: author.id, ...overrides },
  });
}

describe("question topic links", () => {
  it("links one question to several topics of its subject", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const first = await createTopic(database, { title: "Б" });
      const second = await createTopic(database, { title: "А" });

      for (const topic of [first, second]) {
        await database.questionTopic.create({
          data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
        });
      }

      const links = await database.questionTopic.findMany({ where: { questionId: question.id } });
      expect(links.map((link) => link.topicId).sort()).toEqual([first.id, second.id].sort());
    });
  });

  it("links one topic to several questions", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await createTopic(database);
      for (const prompt of ["Първи въпрос", "Втори въпрос"]) {
        const question = await createQuestion(database, { prompt });
        await database.questionTopic.create({
          data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
        });
      }

      expect(await database.questionTopic.count({ where: { topicId: topic.id } })).toBe(2);
    });
  });

  it("rejects linking the same topic twice", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const topic = await createTopic(database);
      const data = { questionId: question.id, topicId: topic.id, subject: "LITERATURE" as const };
      await database.questionTopic.create({ data });

      await expect(database.questionTopic.create({ data })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects a topic from another subject", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { subject: "LITERATURE" });
      const languageTopic = await createTopic(database, { subject: "BULGARIAN_LANGUAGE" });

      await expect(
        database.questionTopic.create({
          data: { questionId: question.id, topicId: languageTopic.id, subject: "LITERATURE" },
        }),
      ).rejects.toThrow("QuestionTopic_topicId_subject_fkey");
    });
  });

  it("rejects a link whose subject does not match its question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { subject: "LITERATURE" });
      const languageTopic = await createTopic(database, { subject: "BULGARIAN_LANGUAGE" });

      await expect(
        database.questionTopic.create({
          data: { questionId: question.id, topicId: languageTopic.id, subject: "BULGARIAN_LANGUAGE" },
        }),
      ).rejects.toThrow("QuestionTopic_questionId_subject_fkey");
    });
  });

  it("refuses to change the subject of a question that is still linked", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const topic = await createTopic(database);
      await database.questionTopic.create({
        data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
      });

      await expect(
        database.question.update({ where: { id: question.id }, data: { subject: "BULGARIAN_LANGUAGE" } }),
      ).rejects.toThrow("QuestionTopic_questionId_subject_fkey");
    });
  });

  it("refuses to delete a topic that questions still use, and allows it once unlinked", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const topic = await createTopic(database);
      await database.questionTopic.create({
        data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
      });

      await expect(database.topic.delete({ where: { id: topic.id } })).rejects.toThrow(
        "QuestionTopic_topicId_subject_fkey",
      );
    });

    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const topic = await createTopic(database);
      await database.questionTopic.create({
        data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
      });
      await database.questionTopic.deleteMany({ where: { topicId: topic.id } });

      await database.topic.delete({ where: { id: topic.id } });
      expect(await database.topic.findUnique({ where: { id: topic.id } })).toBeNull();
    });
  });
});

describe("question work links", () => {
  it("links a literature question to optional works", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const work = await createWork(database);
      await database.questionWork.create({ data: { questionId: question.id, workId: work.id } });

      const links = await database.questionWork.findMany({ where: { questionId: question.id } });
      expect(links).toEqual([{ questionId: question.id, workId: work.id, subject: "LITERATURE" }]);
    });
  });

  it("allows a question without any work", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      expect(await database.questionWork.count({ where: { questionId: question.id } })).toBe(0);
    });
  });

  it("rejects linking the same work twice", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const work = await createWork(database);
      const data = { questionId: question.id, workId: work.id };
      await database.questionWork.create({ data });

      await expect(database.questionWork.create({ data })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects a work link on a language question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { subject: "BULGARIAN_LANGUAGE" });
      const work = await createWork(database);

      await expect(
        database.questionWork.create({ data: { questionId: question.id, workId: work.id } }),
      ).rejects.toThrow("QuestionWork_questionId_subject_fkey");
    });
  });

  it("rejects a work link that claims another subject", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { subject: "BULGARIAN_LANGUAGE" });
      const work = await createWork(database);

      await expect(
        database.questionWork.create({
          data: { questionId: question.id, workId: work.id, subject: "BULGARIAN_LANGUAGE" },
        }),
      ).rejects.toThrow("QuestionWork_literature_only");
    });
  });

  it("rejects a work that does not exist", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      await expect(
        database.questionWork.create({ data: { questionId: question.id, workId: randomUUID() } }),
      ).rejects.toThrow("QuestionWork_workId_fkey");
    });
  });

  it("refuses to delete a work that questions still use", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const work = await createWork(database);
      await database.questionWork.create({ data: { questionId: question.id, workId: work.id } });

      await expect(database.work.delete({ where: { id: work.id } })).rejects.toThrow("QuestionWork_workId_fkey");
    });
  });

  it("removes a question's links and provenance together with the question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const topic = await createTopic(database);
      const work = await createWork(database);
      await database.questionTopic.create({
        data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
      });
      await database.questionWork.create({ data: { questionId: question.id, workId: work.id } });
      await database.questionProvenance.create({ data: { questionId: question.id, origin: "ORIGINAL" } });

      await database.question.delete({ where: { id: question.id } });

      expect(await database.questionTopic.count({ where: { questionId: question.id } })).toBe(0);
      expect(await database.questionWork.count({ where: { questionId: question.id } })).toBe(0);
      expect(await database.questionProvenance.count({ where: { questionId: question.id } })).toBe(0);
      expect(await database.topic.findUnique({ where: { id: topic.id } })).not.toBeNull();
      expect(await database.work.findUnique({ where: { id: work.id } })).not.toBeNull();
    });
  });
});

describe("question provenance", () => {
  const reviewedAt = new Date("2026-10-01T10:00:00.000Z");

  it("stores an original, unreviewed question with private editorial details", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const provenance = await database.questionProvenance.create({
        data: { questionId: question.id, origin: "ORIGINAL", editorName: "Тестов редактор", reviewNotes: "Бележка" },
      });

      expect(provenance.reviewStatus).toBe("UNREVIEWED");
      expect(provenance.reviewedBy).toBeNull();
      expect(provenance.reviewedAt).toBeNull();
      expect(provenance.attribution).toBeNull();
      expect(provenance.createdAt).toBeInstanceOf(Date);
    });
  });

  it("stores an adapted question with attribution and a completed review", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      const provenance = await database.questionProvenance.create({
        data: {
          questionId: question.id,
          origin: "ADAPTED",
          attribution: "По изпитен материал на МОН",
          sourceReference: "Тестов документ, стр. 3",
          reviewStatus: "REVIEWED",
          reviewedBy: "Тестов рецензент",
          reviewedAt,
        },
      });

      expect(provenance).toMatchObject({ origin: "ADAPTED", reviewStatus: "REVIEWED", reviewedAt });
    });
  });

  it("allows only one provenance record per question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      await database.questionProvenance.create({ data: { questionId: question.id, origin: "ORIGINAL" } });

      await expect(
        database.questionProvenance.create({ data: { questionId: question.id, origin: "OFFICIAL" } }),
      ).rejects.toMatchObject({ code: "P2002" });
    });
  });

  // Each case names the one constraint it must trip, so a test cannot pass for the wrong reason.
  const rejectedProvenance: [string, Partial<Prisma.QuestionProvenanceUncheckedCreateInput>, string][] = [
    ["a blank attribution", { attribution: "  " }, "QuestionProvenance_attribution_nonblank"],
    ["a line-break-only source reference", { sourceReference: "\n" }, "QuestionProvenance_source_reference_nonblank"],
    ["a blank editor name", { editorName: "" }, "QuestionProvenance_editor_name_nonblank"],
    ["blank review notes", { reviewNotes: "\t" }, "QuestionProvenance_review_notes_nonblank"],
    ["a reviewed record without a reviewer", { reviewStatus: "REVIEWED", reviewedAt }, "QuestionProvenance_review_state"],
    ["a reviewed record without a date", { reviewStatus: "REVIEWED", reviewedBy: "Рецензент" }, "QuestionProvenance_review_state"],
    ["an unreviewed record with a reviewer", { reviewedBy: "Рецензент" }, "QuestionProvenance_review_state"],
    ["an unreviewed record with a review date", { reviewedAt }, "QuestionProvenance_review_state"],
    [
      "a reviewed adapted record without attribution",
      { origin: "ADAPTED", reviewStatus: "REVIEWED", reviewedBy: "Рецензент", reviewedAt },
      "QuestionProvenance_reviewed_needs_attribution",
    ],
    [
      "a reviewed official record without attribution",
      { origin: "OFFICIAL", reviewStatus: "REVIEWED", reviewedBy: "Рецензент", reviewedAt },
      "QuestionProvenance_reviewed_needs_attribution",
    ],
  ];

  it.each(rejectedProvenance)("rejects %s", async (_description, overrides, constraint) => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      await expect(
        database.questionProvenance.create({ data: { questionId: question.id, origin: "ORIGINAL", ...overrides } }),
      ).rejects.toThrow(constraint);
    });
  });

  it("allows a reviewed original question without attribution", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database);
      await expect(
        database.questionProvenance.create({
          data: { questionId: question.id, origin: "ORIGINAL", reviewStatus: "REVIEWED", reviewedBy: "Рецензент", reviewedAt },
        }),
      ).resolves.toMatchObject({ reviewStatus: "REVIEWED" });
    });
  });
});

describe("public question associations", () => {
  it("never resolves a draft question", async () => {
    await withDatabaseFixture(async (database) => {
      const draft = await createQuestion(database);
      expect(await findPublishedQuestionAssociations(draft.id, database)).toBeNull();
    });
  });

  it("lists only published topics and works of a published question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { status: "PUBLISHED" });
      const publishedTopic = await createTopic(database, { title: "Публикувана тема", status: "PUBLISHED" });
      const draftTopic = await createTopic(database, { title: "Чернова на тема" });
      const author = await database.author.create({ data: { name: "Автор", slug: `fixture-${randomUUID()}` } });
      const publishedWork = await database.work.create({
        data: {
          title: "Публикувано произведение",
          slug: `fixture-${randomUUID()}`,
          authorId: author.id,
          genre: "Роман",
          summary: "Проверка на съхранението.",
          status: "PUBLISHED",
        },
      });
      const draftWork = await database.work.create({
        data: { title: "Чернова на произведение", slug: `fixture-${randomUUID()}`, authorId: author.id },
      });

      for (const topic of [publishedTopic, draftTopic]) {
        await database.questionTopic.create({
          data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
        });
      }
      for (const work of [publishedWork, draftWork]) {
        await database.questionWork.create({ data: { questionId: question.id, workId: work.id } });
      }

      const associations = await findPublishedQuestionAssociations(question.id, database);

      expect(associations).toEqual({
        topics: [
          { id: publishedTopic.id, title: "Публикувана тема", slug: publishedTopic.slug, subject: "LITERATURE" },
        ],
        works: [{ id: publishedWork.id, title: "Публикувано произведение", slug: publishedWork.slug }],
        source: null,
      });
      expect(JSON.stringify(associations)).not.toContain("Чернова");
    });
  });

  it("exposes only origin and attribution, never private editorial details", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { status: "PUBLISHED" });
      await database.questionProvenance.create({
        data: {
          questionId: question.id,
          origin: "ADAPTED",
          attribution: "По изпитен материал на МОН",
          sourceReference: "ПРИВАТЕН-ИЗТОЧНИК",
          editorName: "ПРИВАТЕН-РЕДАКТОР",
          reviewStatus: "REVIEWED",
          reviewedBy: "ПРИВАТЕН-РЕЦЕНЗЕНТ",
          reviewedAt: new Date("2026-10-01T10:00:00.000Z"),
          reviewNotes: "ПРИВАТНА-БЕЛЕЖКА",
        },
      });

      const associations = await findPublishedQuestionAssociations(question.id, database);

      expect(associations?.source).toEqual({ origin: "ADAPTED", attribution: "По изпитен материал на МОН" });
      const serialized = JSON.stringify(associations);
      for (const privateValue of ["ПРИВАТЕН", "ПРИВАТНА", "reviewedBy", "reviewNotes", "editorName", "sourceReference"]) {
        expect(serialized).not.toContain(privateValue);
      }
    });
  });

  it("orders topics by title for stable presentation", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createQuestion(database, { status: "PUBLISHED" });
      for (const title of ["Б тема", "А тема"]) {
        const topic = await createTopic(database, { title, status: "PUBLISHED" });
        await database.questionTopic.create({
          data: { questionId: question.id, topicId: topic.id, subject: "LITERATURE" },
        });
      }

      const associations = await findPublishedQuestionAssociations(question.id, database);
      expect(associations?.topics.map((topic) => topic.title)).toEqual(["А тема", "Б тема"]);
    });
  });
});
