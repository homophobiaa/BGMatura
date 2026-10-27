import { describe, expect, it, vi } from "vitest";

import { evaluationSchema } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type { MultipleChoiceDefinition } from "./contracts";
import { gradeMultipleChoice } from "./grade-multiple-choice";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";

vi.mock("server-only", () => ({}));

function createDefinition(
  overrides: { maximumPoints?: number; correctOptionId?: string; optionIds?: string[] } = {},
): MultipleChoiceDefinition {
  const optionIds = overrides.optionIds ?? ["a", "b", "c"];

  return {
    id: "question-1",
    type: "multiple-choice",
    prompt: "Кой е авторът на „Под игото“?",
    options: optionIds.map((id) => ({ id, text: `Отговор ${id}` })),
    assessment: {
      mode: "objective",
      maximumPoints: overrides.maximumPoints ?? 2,
      explanation: "Авторът е Иван Вазов.",
      correctOptionId: overrides.correctOptionId ?? "b",
    },
  };
}

function answerWith(selectedOptionId: string | null, questionId = "question-1"): SubmittedAnswer {
  return { questionId, type: "multiple-choice", selectedOptionId };
}

describe("gradeMultipleChoice", () => {
  it("awards the configured points for the correct option", () => {
    expect(gradeMultipleChoice(createDefinition(), answerWith("b"))).toEqual({
      status: "scored",
      earnedPoints: 2,
      maximumPoints: 2,
    });
  });

  it("awards zero points for a wrong option", () => {
    expect(gradeMultipleChoice(createDefinition(), answerWith("a"))).toEqual({
      status: "scored",
      earnedPoints: 0,
      maximumPoints: 2,
    });
  });

  it("scores a missing answer as zero instead of rejecting it", () => {
    expect(gradeMultipleChoice(createDefinition(), answerWith(null))).toEqual({
      status: "scored",
      earnedPoints: 0,
      maximumPoints: 2,
    });
  });

  it.each([0, 0.5, 1, 30])("uses %s configured points as both the ceiling and the award", (maximumPoints) => {
    const definition = createDefinition({ maximumPoints });

    expect(gradeMultipleChoice(definition, answerWith("b"))).toEqual({
      status: "scored",
      earnedPoints: maximumPoints,
      maximumPoints,
    });
    expect(gradeMultipleChoice(definition, answerWith("c"))).toEqual({
      status: "scored",
      earnedPoints: 0,
      maximumPoints,
    });
  });

  it("always returns an evaluation that satisfies the shared contract", () => {
    for (const selectedOptionId of ["a", "b", null]) {
      const evaluation = gradeMultipleChoice(createDefinition(), answerWith(selectedOptionId));

      expect(evaluationSchema.safeParse(evaluation).success).toBe(true);
    }
  });

  it("matches option identifiers exactly", () => {
    expect(() => gradeMultipleChoice(createDefinition(), answerWith("B"))).toThrow(InvalidSubmittedAnswerError);
    expect(() => gradeMultipleChoice(createDefinition(), answerWith(" b"))).toThrow(InvalidSubmittedAnswerError);
    expect(() => gradeMultipleChoice(createDefinition(), answerWith(""))).toThrow(InvalidSubmittedAnswerError);
  });

  it("rejects an option the question does not offer", () => {
    expect(() => gradeMultipleChoice(createDefinition(), answerWith("zzz"))).toThrow(
      "Option zzz is not offered by question question-1.",
    );
  });

  it("rejects an answer for a different question", () => {
    expect(() => gradeMultipleChoice(createDefinition(), answerWith("b", "question-2"))).toThrow(
      InvalidSubmittedAnswerError,
    );
  });

  it("rejects an answer of a different type", () => {
    const writtenAnswer: SubmittedAnswer = {
      questionId: "question-1",
      type: "short-response",
      text: "b",
    };

    expect(() => gradeMultipleChoice(createDefinition(), writtenAnswer)).toThrow(
      "Question question-1 expects a multiple-choice answer but received short-response.",
    );
  });

  it.each([
    ["a correct option that is not offered", createDefinition({ correctOptionId: "missing" })],
    ["duplicate option identifiers", createDefinition({ optionIds: ["a", "b", "b"] })],
    ["a negative maximum", createDefinition({ maximumPoints: -1 })],
    ["a non-finite maximum", createDefinition({ maximumPoints: Number.NaN })],
    ["an infinite maximum", createDefinition({ maximumPoints: Number.POSITIVE_INFINITY })],
  ])("refuses to grade a definition with %s", (_description, definition) => {
    expect(() => gradeMultipleChoice(definition, answerWith("b"))).toThrow(InvalidQuestionDefinitionError);
  });
});
