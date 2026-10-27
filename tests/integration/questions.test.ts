import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { evaluateWrittenResponse } from "@/features/questions/server/evaluate-written-response";
import { gradeMultipleChoice } from "@/features/questions/server/grade-multiple-choice";
import { gradeShortResponse } from "@/features/questions/server/grade-short-response";
import { InvalidQuestionDefinitionError } from "@/features/questions/server/grading-errors";
import { toQuestionDefinition } from "@/features/questions/server/question-definitions";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

type QuestionInput = Prisma.QuestionUncheckedCreateInput;

const CORRECT_OPTION_MESSAGE = "The correct option must be an option of the same question";

/** A valid objective short-response draft; each test overrides what it needs. */
function questionData(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    subject: "LITERATURE",
    type: "SHORT_RESPONSE",
    prompt: "Кой е авторът на „Под игото“?",
    assessmentMode: "OBJECTIVE",
    maximumPoints: 1,
    explanation: "Авторът е Иван Вазов.",
    acceptedAnswers: ["Иван Вазов"],
    ...overrides,
  };
}

/** A valid written draft; overrides turn it into the invalid shapes under test. */
function writtenData(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    subject: "LITERATURE",
    type: "EXTENDED_RESPONSE",
    prompt: "Анализирайте образа на Бай Ганьо.",
    assessmentMode: "SELF_REVIEW",
    referenceGuidance: "Очаква се анализ на характера и средата.",
    ...overrides,
  };
}

function multipleChoiceData(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return questionData({ type: "MULTIPLE_CHOICE", acceptedAnswers: [], maximumPoints: 2, ...overrides });
}

describe("question bank persistence", () => {
  it("stores a multiple-choice question, maps it to its definition, and grades it", async () => {
    await withDatabaseFixture(async (database) => {
      const created = await database.question.create({
        data: {
          ...multipleChoiceData({ maximumPoints: "1.5" }),
          options: {
            create: [
              { text: "Пейо Яворов", position: 2 },
              { text: "Иван Вазов", position: 1 },
            ],
          },
        },
        include: { options: true },
      });
      const correctOption = created.options.find((option) => option.text === "Иван Вазов");
      if (!correctOption) throw new Error("The correct option was not stored");

      await database.question.update({ where: { id: created.id }, data: { correctOptionId: correctOption.id } });
      const stored = await database.question.findUniqueOrThrow({
        where: { id: created.id },
        include: { options: true },
      });
      const definition = toQuestionDefinition(stored);

      expect(definition).toMatchObject({
        type: "multiple-choice",
        options: [{ id: correctOption.id, text: "Иван Вазов" }, { text: "Пейо Яворов" }],
        assessment: { mode: "objective", maximumPoints: 1.5, correctOptionId: correctOption.id },
      });
      if (definition.type !== "multiple-choice") throw new Error("Expected a multiple-choice definition");
      expect(
        gradeMultipleChoice(definition, {
          questionId: created.id,
          type: "multiple-choice",
          selectedOptionId: correctOption.id,
        }),
      ).toEqual({ status: "scored", earnedPoints: 1.5, maximumPoints: 1.5 });
    });
  });

  it("stores an objective short-response question and grades it with its accepted answers", async () => {
    await withDatabaseFixture(async (database) => {
      const stored = await database.question.create({
        data: questionData({ acceptedAnswers: ["Иван Вазов", "Вазов, Иван"], status: "PUBLISHED" }),
        include: { options: true },
      });
      const definition = toQuestionDefinition(stored);
      if (definition.type !== "short-response") throw new Error("Expected a short-response definition");

      expect(gradeShortResponse(definition, { questionId: stored.id, type: "short-response", text: "вазов, иван" })).toEqual({
        status: "scored",
        earnedPoints: 1,
        maximumPoints: 1,
      });
    });
  });

  it("stores ungraded written records with guidance and a rubric", async () => {
    await withDatabaseFixture(async (database) => {
      const rubric = [
        { id: "thesis", description: "Ясна теза", indicativePoints: 4 },
        { id: "style", description: "Езиков стил" },
      ];
      const essay = await database.question.create({
        data: writtenData({ type: "ARGUMENTATIVE_WRITING", rubric }),
        include: { options: true },
      });
      const extended = await database.question.create({
        data: writtenData({ assessmentMode: "UNGRADED" }),
        include: { options: true },
      });
      const shortWritten = await database.question.create({
        data: writtenData({ type: "SHORT_RESPONSE" }),
        include: { options: true },
      });

      expect(essay.maximumPoints).toBeNull();
      expect(essay.acceptedAnswers).toEqual([]);

      const essayDefinition = toQuestionDefinition(essay);
      if (essayDefinition.type !== "argumentative-writing") throw new Error("Expected an essay definition");
      expect(essayDefinition.assessment).toEqual({
        mode: "self-review",
        referenceGuidance: "Очаква се анализ на характера и средата.",
        rubric,
      });
      expect(
        evaluateWrittenResponse(essayDefinition, { questionId: essay.id, type: "argumentative-writing", text: "Есе" })
          .evaluation,
      ).toEqual({ status: "self-review" });

      const extendedDefinition = toQuestionDefinition(extended);
      if (extendedDefinition.type !== "extended-response") throw new Error("Expected an extended definition");
      expect(extendedDefinition.assessment).not.toHaveProperty("rubric");
      expect(
        evaluateWrittenResponse(extendedDefinition, { questionId: extended.id, type: "extended-response", text: "Текст" })
          .evaluation,
      ).toEqual({ status: "ungraded", reason: "not-auto-gradable" });

      const shortDefinition = toQuestionDefinition(shortWritten);
      if (shortDefinition.type !== "short-response") throw new Error("Expected a short-response definition");
      expect(
        gradeShortResponse(shortDefinition, { questionId: shortWritten.id, type: "short-response", text: "Нещо" }),
      ).toEqual({ status: "self-review" });
    });
  });

  it("keeps incomplete drafts, but the mapper refuses to treat them as gradable", async () => {
    await withDatabaseFixture(async (database) => {
      const draft = await database.question.create({
        data: { ...multipleChoiceData(), options: { create: [{ text: "А", position: 0 }] } },
        include: { options: true },
      });

      expect(draft.status).toBe("DRAFT");
      expect(draft.correctOptionId).toBeNull();
      expect(() => toQuestionDefinition(draft)).toThrow(InvalidQuestionDefinitionError);
    });
  });

  it("refuses a malformed stored rubric when building a definition", async () => {
    await withDatabaseFixture(async (database) => {
      const stored = await database.question.create({
        data: writtenData({ rubric: [{ id: "a" }] }),
        include: { options: true },
      });

      expect(() => toQuestionDefinition(stored)).toThrow("malformed rubric");
    });
  });
});

describe("question structure constraints", () => {
  // Each case names the one constraint it must trip, so a test cannot pass for the wrong reason.
  const rejectedQuestions: [string, QuestionInput, string][] = [
    ["multiple choice that is not objective", writtenData({ type: "MULTIPLE_CHOICE" }), "Question_type_assessment_mode"],
    [
      "an argumentative essay graded objectively",
      questionData({ type: "ARGUMENTATIVE_WRITING", acceptedAnswers: [] }),
      "Question_type_assessment_mode",
    ],
    [
      "an extended response graded objectively",
      questionData({ type: "EXTENDED_RESPONSE", acceptedAnswers: [] }),
      "Question_type_assessment_mode",
    ],
    ["an objective question without points", questionData({ maximumPoints: null }), "Question_assessment_fields"],
    ["an objective question without an explanation", questionData({ explanation: null }), "Question_assessment_fields"],
    [
      "an objective question with reference guidance",
      questionData({ referenceGuidance: "Насоки" }),
      "Question_assessment_fields",
    ],
    ["an objective question with a rubric", questionData({ rubric: [] }), "Question_assessment_fields"],
    ["negative points", questionData({ maximumPoints: -1 }), "Question_maximum_points_nonnegative"],
    ["a written question with points", writtenData({ maximumPoints: 1 }), "Question_assessment_fields"],
    ["a written question with an explanation", writtenData({ explanation: "Обяснение" }), "Question_assessment_fields"],
    ["a written question without guidance", writtenData({ referenceGuidance: null }), "Question_assessment_fields"],
    [
      "accepted answers on a written question",
      writtenData({ acceptedAnswers: ["Отговор"] }),
      "Question_accepted_answers_short_response_only",
    ],
    [
      "accepted answers on multiple choice",
      multipleChoiceData({ acceptedAnswers: ["Отговор"] }),
      "Question_accepted_answers_short_response_only",
    ],
    ["a rubric that is not a list", writtenData({ rubric: { id: "a" } }), "Question_rubric_is_array"],
    ["a blank prompt", questionData({ prompt: "   " }), "Question_prompt_nonblank"],
    [
      "a published multiple-choice question without a correct option",
      multipleChoiceData({ status: "PUBLISHED" }),
      "Question_published_is_gradable",
    ],
    [
      "a published objective short response without accepted answers",
      questionData({ acceptedAnswers: [], status: "PUBLISHED" }),
      "Question_published_is_gradable",
    ],
    [
      "a published objective question with a blank explanation",
      questionData({ explanation: "  ", status: "PUBLISHED" }),
      "Question_published_is_gradable",
    ],
    [
      "a published written question with blank guidance",
      writtenData({ referenceGuidance: " ", status: "PUBLISHED" }),
      "Question_published_is_gradable",
    ],
  ];

  it.each(rejectedQuestions)("rejects %s", async (_description, data, constraint) => {
    await withDatabaseFixture(async (database) => {
      await expect(database.question.create({ data })).rejects.toThrow(constraint);
    });
  });

  it("accepts a complete published written question", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(database.question.create({ data: writtenData({ status: "PUBLISHED" }) })).resolves.toMatchObject({
        status: "PUBLISHED",
      });
    });
  });

  it("allows zero points for an objective question", async () => {
    await withDatabaseFixture(async (database) => {
      const stored = await database.question.create({ data: questionData({ maximumPoints: 0 }) });
      expect(stored.maximumPoints?.toNumber()).toBe(0);
    });
  });
});

describe("question option constraints", () => {
  async function createChoiceQuestion(database: Prisma.TransactionClient) {
    return database.question.create({
      data: {
        ...multipleChoiceData(),
        options: {
          create: [
            { text: "А", position: 0 },
            { text: "Б", position: 1 },
          ],
        },
      },
      include: { options: true },
    });
  }

  it("rejects options on a question that is not multiple choice", async () => {
    await withDatabaseFixture(async (database) => {
      const shortResponse = await database.question.create({ data: questionData() });
      await expect(
        database.questionOption.create({
          data: { questionId: shortResponse.id, questionType: "SHORT_RESPONSE", text: "А", position: 0 },
        }),
      ).rejects.toThrow("QuestionOption_multiple_choice_only");
    });
  });

  it("rejects an option whose declared type does not match its question", async () => {
    await withDatabaseFixture(async (database) => {
      const shortResponse = await database.question.create({ data: questionData() });
      await expect(
        database.questionOption.create({
          data: { questionId: shortResponse.id, questionType: "MULTIPLE_CHOICE", text: "А", position: 0 },
        }),
      ).rejects.toThrow("QuestionOption_questionId_questionType_fkey");
    });
  });

  it.each([
    ["blank text", { text: "  ", position: 5 }, "QuestionOption_text_nonblank"],
    ["a negative position", { text: "В", position: -1 }, "QuestionOption_position_nonnegative"],
  ])("rejects an option with %s", async (_description, option, constraint) => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await expect(
        database.questionOption.create({ data: { questionId: question.id, questionType: "MULTIPLE_CHOICE", ...option } }),
      ).rejects.toThrow(constraint);
    });
  });

  it("rejects two options at the same position", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await expect(
        database.questionOption.create({
          data: { questionId: question.id, questionType: "MULTIPLE_CHOICE", text: "В", position: 0 },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects a correct option that belongs to another question", async () => {
    await withDatabaseFixture(async (database) => {
      const first = await createChoiceQuestion(database);
      const second = await createChoiceQuestion(database);
      const foreignOption = second.options[0];
      if (!foreignOption) throw new Error("Expected an option");

      await expect(
        database.question.update({ where: { id: first.id }, data: { correctOptionId: foreignOption.id } }),
      ).rejects.toThrow(CORRECT_OPTION_MESSAGE);
    });
  });

  it("rejects a correct option that does not exist", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await expect(
        database.question.update({ where: { id: question.id }, data: { correctOptionId: randomUUID() } }),
      ).rejects.toThrow(CORRECT_OPTION_MESSAGE);
    });
  });

  it("rejects deleting the option that is the correct answer", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const correct = question.options[0];
      if (!correct) throw new Error("Expected an option");
      await database.question.update({ where: { id: question.id }, data: { correctOptionId: correct.id } });

      await expect(database.questionOption.delete({ where: { id: correct.id } })).rejects.toThrow(
        "Question_correctOptionId_fkey",
      );
    });
  });

  it("allows deleting an option that is not the correct answer", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const [correct, other] = question.options;
      if (!correct || !other) throw new Error("Expected two options");
      await database.question.update({ where: { id: question.id }, data: { correctOptionId: correct.id } });

      await database.questionOption.delete({ where: { id: other.id } });
      expect(await database.questionOption.count({ where: { questionId: question.id } })).toBe(1);
    });
  });

  it("deletes a question together with its options, including its correct option", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      const correct = question.options[0];
      if (!correct) throw new Error("Expected an option");
      await database.question.update({ where: { id: question.id }, data: { correctOptionId: correct.id } });

      await database.question.delete({ where: { id: question.id } });
      expect(await database.questionOption.count({ where: { questionId: question.id } })).toBe(0);
    });
  });

  it("refuses to change the type of a question that still has options", async () => {
    await withDatabaseFixture(async (database) => {
      const question = await createChoiceQuestion(database);
      await expect(
        database.question.update({
          where: { id: question.id },
          data: { type: "SHORT_RESPONSE", acceptedAnswers: ["А"] },
        }),
      ).rejects.toThrow("QuestionOption_questionId_questionType_fkey");
    });
  });

  it("refuses to move the correct option to another question", async () => {
    await withDatabaseFixture(async (database) => {
      const first = await createChoiceQuestion(database);
      const second = await createChoiceQuestion(database);
      const correct = first.options[0];
      if (!correct) throw new Error("Expected an option");
      await database.question.update({ where: { id: first.id }, data: { correctOptionId: correct.id } });

      await expect(
        database.questionOption.update({ where: { id: correct.id }, data: { questionId: second.id, position: 9 } }),
      ).rejects.toThrow("cannot move to another question");
    });
  });
});
