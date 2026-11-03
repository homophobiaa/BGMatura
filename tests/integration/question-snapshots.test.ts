import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { evaluateWrittenResponse } from "@/features/questions/server/evaluate-written-response";
import { gradeMultipleChoice } from "@/features/questions/server/grade-multiple-choice";
import { gradeShortResponse } from "@/features/questions/server/grade-short-response";
import { InvalidQuestionDefinitionError } from "@/features/questions/server/grading-errors";
import { toQuestionDefinition } from "@/features/questions/server/question-definitions";
import { captureQuestionSnapshot, readQuestionSnapshot } from "@/features/questions/server/question-snapshots";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

type Database = Prisma.TransactionClient;

/** A published multiple-choice question whose correct option is "Иван Вазов". */
async function createChoiceQuestion(database: Database) {
  const question = await database.question.create({
    data: {
      subject: "LITERATURE",
      type: "MULTIPLE_CHOICE",
      prompt: "Кой е авторът на „Под игото“?",
      assessmentMode: "OBJECTIVE",
      maximumPoints: 2,
      explanation: "Авторът е Иван Вазов.",
      options: {
        create: [
          { text: "Иван Вазов", position: 0 },
          { text: "Пейо Яворов", position: 1 },
          { text: "Елин Пелин", position: 2 },
        ],
      },
    },
    include: { options: true },
  });
  const correct = question.options.find((option) => option.text === "Иван Вазов");
  const wrong = question.options.find((option) => option.text === "Пейо Яворов");
  const other = question.options.find((option) => option.text === "Елин Пелин");
  if (!correct || !wrong || !other) throw new Error("Fixture options were not stored");

  await database.question.update({
    where: { id: question.id },
    data: { correctOptionId: correct.id, status: "PUBLISHED" },
  });

  return { id: question.id, correct, wrong, other };
}

function choiceAnswer(questionId: string, selectedOptionId: string) {
  return { questionId, type: "multiple-choice" as const, selectedOptionId };
}

describe("capturing a question snapshot", () => {
  it("records the grading-relevant version of a published question", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await database.questionProvenance.create({
        data: {
          questionId: question.id,
          origin: "ADAPTED",
          attribution: "По изпитен материал на МОН",
          sourceReference: "ПРИВАТЕН-ИЗТОЧНИК",
          editorName: "ПРИВАТЕН-РЕДАКТОР",
          reviewNotes: "ПРИВАТНА-БЕЛЕЖКА",
        },
      });

      const snapshot = await captureQuestionSnapshot(question.id, database);
      const view = readQuestionSnapshot(snapshot);

      expect(snapshot.formatVersion).toBe(1);
      expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(view.subject).toBe("LITERATURE");
      expect(view.source).toEqual({ origin: "ADAPTED", attribution: "По изпитен материал на МОН" });
      expect(view.definition).toMatchObject({
        id: question.id,
        type: "multiple-choice",
        prompt: "Кой е авторът на „Под игото“?",
        options: [
          { id: question.correct.id, text: "Иван Вазов" },
          { id: question.wrong.id, text: "Пейо Яворов" },
          { id: question.other.id, text: "Елин Пелин" },
        ],
        assessment: {
          mode: "objective",
          maximumPoints: 2,
          explanation: "Авторът е Иван Вазов.",
          correctOptionId: question.correct.id,
        },
      });
      const serialized = JSON.stringify(snapshot.content);
      for (const privateValue of ["ПРИВАТЕН", "ПРИВАТНА", "sourceReference", "editorName", "reviewNotes", "reviewedBy"]) {
        expect(serialized).not.toContain(privateValue);
      }
    });
  });

  it("reuses one snapshot while the question is unchanged", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);

      const first = await captureQuestionSnapshot(question.id, database);
      const second = await captureQuestionSnapshot(question.id, database);

      expect(second.id).toBe(first.id);
      expect(await database.questionSnapshot.count({ where: { questionId: question.id } })).toBe(1);
    });
  });

  it("creates a new snapshot after an edit and leaves the old one untouched", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const before = await captureQuestionSnapshot(question.id, database);

      await database.question.update({ where: { id: question.id }, data: { prompt: "Нов текст на въпроса" } });
      const after = await captureQuestionSnapshot(question.id, database);

      expect(after.id).not.toBe(before.id);
      expect(after.contentHash).not.toBe(before.contentHash);
      expect(readQuestionSnapshot(after).definition.prompt).toBe("Нов текст на въпроса");

      const storedBefore = await database.questionSnapshot.findUniqueOrThrow({ where: { id: before.id } });
      expect(storedBefore).toEqual(before);
      expect(readQuestionSnapshot(storedBefore).definition.prompt).toBe("Кой е авторът на „Под игото“?");
    });
  });

  it("refuses a question that is not published, including one that was unpublished", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await captureQuestionSnapshot(question.id, database);
      await database.question.update({ where: { id: question.id }, data: { status: "DRAFT" } });

      await expect(captureQuestionSnapshot(question.id, database)).rejects.toThrow("must be published");
    });
  });

  it("refuses a question that does not exist", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(captureQuestionSnapshot(randomUUID(), database)).rejects.toThrow(InvalidQuestionDefinitionError);
    });
  });
});

describe("results stay stable after editorial changes", () => {
  it("keeps multiple-choice grading after edits, a changed answer key, a deleted option, and unpublishing", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const snapshot = await captureQuestionSnapshot(question.id, database);
      const original = readQuestionSnapshot(snapshot).definition;
      if (original.type !== "multiple-choice") throw new Error("Expected a multiple-choice snapshot");

      // The editor changes points, text, and the answer key, deletes the old key, then unpublishes.
      await database.question.update({
        where: { id: question.id },
        data: { prompt: "Преработен въпрос", maximumPoints: 5, explanation: "Нов отговор", correctOptionId: question.wrong.id },
      });
      await database.questionOption.update({ where: { id: question.wrong.id }, data: { text: "Преименуван отговор" } });
      await database.questionOption.delete({ where: { id: question.correct.id } });
      await database.question.update({ where: { id: question.id }, data: { status: "DRAFT" } });

      const stored = await database.questionSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
      const reviewed = readQuestionSnapshot(stored).definition;
      if (reviewed.type !== "multiple-choice") throw new Error("Expected a multiple-choice snapshot");

      // The snapshot is exactly as captured, so the attempt is graded and reviewed as before.
      expect(stored).toEqual(snapshot);
      expect(reviewed).toEqual(original);
      expect(reviewed.prompt).toBe("Кой е авторът на „Под игото“?");
      expect(reviewed.options.map((option) => option.text)).toEqual(["Иван Вазов", "Пейо Яворов", "Елин Пелин"]);
      expect(gradeMultipleChoice(reviewed, choiceAnswer(question.id, question.correct.id))).toEqual({
        status: "scored",
        earnedPoints: 2,
        maximumPoints: 2,
      });
      expect(gradeMultipleChoice(reviewed, choiceAnswer(question.id, question.wrong.id))).toEqual({
        status: "scored",
        earnedPoints: 0,
        maximumPoints: 2,
      });

      // The live question has genuinely moved on, so this test would catch a snapshot that followed it.
      const live = await database.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: true } });
      expect(live.prompt).toBe("Преработен въпрос");
      expect(live.options.map((option) => option.id)).not.toContain(question.correct.id);
    });
  });

  it("keeps short-response grading after the accepted answers change", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "SHORT_RESPONSE",
          prompt: "Кой е авторът на „Под игото“?",
          assessmentMode: "OBJECTIVE",
          maximumPoints: 1,
          explanation: "Авторът е Иван Вазов.",
          acceptedAnswers: ["Иван Вазов"],
          status: "PUBLISHED",
        },
      });
      const snapshot = await captureQuestionSnapshot(question.id, database);

      await database.question.update({
        where: { id: question.id },
        data: { acceptedAnswers: ["Пейо Яворов"], maximumPoints: 4, status: "DRAFT" },
      });

      const stored = await database.questionSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
      const definition = readQuestionSnapshot(stored).definition;
      if (definition.type !== "short-response") throw new Error("Expected a short-response snapshot");

      expect(gradeShortResponse(definition, { questionId: question.id, type: "short-response", text: "иван вазов" })).toEqual({
        status: "scored",
        earnedPoints: 1,
        maximumPoints: 1,
      });
      expect(gradeShortResponse(definition, { questionId: question.id, type: "short-response", text: "Пейо Яворов" })).toEqual({
        status: "scored",
        earnedPoints: 0,
        maximumPoints: 1,
      });
    });
  });

  it("keeps written guidance and rubric after they are edited", async () => {
    await withDatabaseFixture(async (database) => {
      const rubric = [{ id: "thesis", description: "Ясна теза", indicativePoints: 4 }, { id: "style", description: "Езиков стил" }];
      const question = await database.question.create({
        data: {
          subject: "LITERATURE",
          type: "ARGUMENTATIVE_WRITING",
          prompt: "Напишете есе.",
          assessmentMode: "SELF_REVIEW",
          referenceGuidance: "Първоначални насоки.",
          rubric,
          status: "PUBLISHED",
        },
      });
      const snapshot = await captureQuestionSnapshot(question.id, database);

      await database.question.update({
        where: { id: question.id },
        data: { referenceGuidance: "Променени насоки.", rubric: [{ id: "other", description: "Друго" }], status: "DRAFT" },
      });

      const stored = await database.questionSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
      const definition = readQuestionSnapshot(stored).definition;
      if (definition.type !== "argumentative-writing") throw new Error("Expected an essay snapshot");

      expect(definition.assessment).toEqual({ mode: "self-review", referenceGuidance: "Първоначални насоки.", rubric });
      expect(
        evaluateWrittenResponse(definition, { questionId: question.id, type: "argumentative-writing", text: "Есе" }),
      ).toMatchObject({ evaluation: { status: "self-review" }, referenceGuidance: "Първоначални насоки.", rubric });
    });
  });

  it("keeps a snapshot readable after its question is deleted", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const snapshot = await captureQuestionSnapshot(question.id, database);

      await database.question.delete({ where: { id: question.id } });

      const stored = await database.questionSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
      expect(readQuestionSnapshot(stored).definition.id).toBe(question.id);
    });
  });

  it("builds the same definition from a snapshot as from the live question at capture time", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const live = await database.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: true } });
      const snapshot = await captureQuestionSnapshot(question.id, database);

      expect(readQuestionSnapshot(snapshot).definition).toEqual(toQuestionDefinition(live));
    });
  });
});

describe("snapshot database constraints", () => {
  const validHash = "a".repeat(64);

  function snapshotData(questionId: string, overrides: Partial<Prisma.QuestionSnapshotUncheckedCreateInput> = {}) {
    return {
      questionId,
      formatVersion: 1,
      contentHash: validHash,
      content: { formatVersion: 1, definition: { id: questionId } },
      ...overrides,
    };
  }

  it("rejects any change to a stored snapshot", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const snapshot = await captureQuestionSnapshot(question.id, database);

      await expect(
        database.questionSnapshot.update({ where: { id: snapshot.id }, data: { content: { formatVersion: 1 } } }),
      ).rejects.toThrow("Question snapshots are immutable");
      await expect(
        database.questionSnapshot.update({ where: { id: snapshot.id }, data: { contentHash: validHash } }),
      ).rejects.toThrow("Question snapshots are immutable");
    });
  });

  it.each([
    ["a format version below one", { formatVersion: 0, content: { formatVersion: 0, definition: {} } }, "QuestionSnapshot_format_version_positive"],
    ["a content hash that is not SHA-256", { contentHash: "nope" }, "QuestionSnapshot_content_hash_sha256"],
    ["content that is not an object", { content: [] }, "QuestionSnapshot_content_is_object"],
    ["a declared version that differs from the stored one", { formatVersion: 2 }, "QuestionSnapshot_content_format_version"],
  ])("rejects %s", async (_description, overrides, constraint) => {
    await withDatabaseFixture(async (database) => {
      await expect(
        database.questionSnapshot.create({ data: snapshotData(randomUUID(), overrides) }),
      ).rejects.toThrow(constraint);
    });
  });

  it("rejects content that describes a different question", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(
        database.questionSnapshot.create({
          data: snapshotData(randomUUID(), { content: { formatVersion: 1, definition: { id: randomUUID() } } }),
        }),
      ).rejects.toThrow("QuestionSnapshot_content_matches_question");
    });
  });

  it("allows one snapshot per question and content hash only", async () => {
    await withDatabaseFixture(async (database) => {
      const questionId = randomUUID();
      await database.questionSnapshot.create({ data: snapshotData(questionId) });

      await expect(database.questionSnapshot.create({ data: snapshotData(questionId) })).rejects.toMatchObject({
        code: "P2002",
      });
    });
  });

  it("refuses to read a layout version it does not know", async () => {
    await withDatabaseFixture(async (database) => {
      const questionId = randomUUID();
      const stored = await database.questionSnapshot.create({
        data: snapshotData(questionId, { formatVersion: 2, content: { formatVersion: 2, definition: { id: questionId } } }),
      });

      expect(() => readQuestionSnapshot(stored)).toThrow("format version 2 is not supported");
    });
  });
});
