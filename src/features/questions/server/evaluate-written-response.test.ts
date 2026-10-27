import { describe, expect, it, vi } from "vitest";

import { evaluationSchema } from "../evaluation";
import type { Evaluation } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type {
  ArgumentativeWritingDefinition,
  ExtendedResponseDefinition,
  MultipleChoiceDefinition,
  ShortResponseDefinition,
} from "./contracts";
import { evaluateWrittenResponse } from "./evaluate-written-response";
import { gradeMultipleChoice } from "./grade-multiple-choice";
import { gradeShortResponse } from "./grade-short-response";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";

vi.mock("server-only", () => ({}));

const rubric = [
  { id: "thesis", description: "Ясна теза", indicativePoints: 4 },
  { id: "arguments", description: "Аргументи и примери", indicativePoints: 6 },
  { id: "style", description: "Езиков стил" },
];

function createExtendedDefinition(
  mode: "self-review" | "ungraded",
  overrides: { rubric?: typeof rubric } = {},
): ExtendedResponseDefinition {
  return {
    id: "extended-1",
    type: "extended-response",
    prompt: "Анализирайте образа на Бай Ганьо.",
    assessment: {
      mode,
      referenceGuidance: "Очаква се анализ на характера и средата.",
      ...(overrides.rubric ? { rubric: overrides.rubric } : {}),
    },
  };
}

function createEssayDefinition(): ArgumentativeWritingDefinition {
  return {
    id: "essay-1",
    type: "argumentative-writing",
    prompt: "Напишете есе по зададена тема.",
    assessment: { mode: "self-review", referenceGuidance: "Спазвайте структурата теза – аргументи – извод.", rubric },
  };
}

describe("evaluateWrittenResponse", () => {
  it("records a self-review extended response with guidance and rubric", () => {
    const review = evaluateWrittenResponse(
      createExtendedDefinition("self-review", { rubric }),
      { questionId: "extended-1", type: "extended-response", text: "Бай Ганьо е..." },
    );

    expect(review).toEqual({
      questionId: "extended-1",
      submittedText: "Бай Ганьо е...",
      evaluation: { status: "self-review" },
      referenceGuidance: "Очаква се анализ на характера и средата.",
      rubric,
    });
  });

  it("records an ungraded extended response and defaults to an empty rubric", () => {
    const review = evaluateWrittenResponse(createExtendedDefinition("ungraded"), {
      questionId: "extended-1",
      type: "extended-response",
      text: "Текст",
    });

    expect(review.evaluation).toEqual({ status: "ungraded", reason: "not-auto-gradable" });
    expect(review.rubric).toEqual([]);
  });

  it("handles argumentative writing the same way", () => {
    const review = evaluateWrittenResponse(createEssayDefinition(), {
      questionId: "essay-1",
      type: "argumentative-writing",
      text: "Есе",
    });

    expect(review.evaluation).toEqual({ status: "self-review" });
    expect(review.rubric).toHaveLength(3);
  });

  it("keeps the submitted text exactly as written", () => {
    const text = "  Първи ред\n\nВтори ред  ";
    const review = evaluateWrittenResponse(createExtendedDefinition("self-review"), {
      questionId: "extended-1",
      type: "extended-response",
      text,
    });

    expect(review.submittedText).toBe(text);
  });

  it("still records an empty submission without scoring it", () => {
    const review = evaluateWrittenResponse(createExtendedDefinition("self-review"), {
      questionId: "extended-1",
      type: "extended-response",
      text: "",
    });

    expect(review.submittedText).toBe("");
    expect(review.evaluation).toEqual({ status: "self-review" });
  });

  it("never assigns machine points, even when the rubric has indicative points", () => {
    const review = evaluateWrittenResponse(createEssayDefinition(), {
      questionId: "essay-1",
      type: "argumentative-writing",
      text: "Много добро есе",
    });

    expect(review).not.toHaveProperty("earnedPoints");
    expect(review).not.toHaveProperty("maximumPoints");
    expect(review.evaluation).not.toHaveProperty("earnedPoints");
    expect(review.evaluation).not.toHaveProperty("maximumPoints");
    expect(evaluationSchema.safeParse(review.evaluation).success).toBe(true);
  });

  it("rejects an answer for another question or of another type", () => {
    const definition = createExtendedDefinition("self-review");

    expect(() =>
      evaluateWrittenResponse(definition, { questionId: "other", type: "extended-response", text: "x" }),
    ).toThrow(InvalidSubmittedAnswerError);
    expect(() =>
      evaluateWrittenResponse(definition, { questionId: "extended-1", type: "argumentative-writing", text: "x" }),
    ).toThrow("Question extended-1 expects an answer of type extended-response but received argumentative-writing.");
    expect(() =>
      evaluateWrittenResponse(definition, { questionId: "extended-1", type: "short-response", text: "x" }),
    ).toThrow(InvalidSubmittedAnswerError);
  });

  it("refuses an invalid rubric", () => {
    const answer: SubmittedAnswer = { questionId: "extended-1", type: "extended-response", text: "x" };

    for (const invalidRubric of [
      [{ id: "a", description: "A" }, { id: "a", description: "B" }],
      [{ id: "a", description: "A", indicativePoints: -1 }],
      [{ id: "a", description: "A", indicativePoints: Number.NaN }],
    ]) {
      expect(() =>
        evaluateWrittenResponse(createExtendedDefinition("self-review", { rubric: invalidRubric }), answer),
      ).toThrow(InvalidQuestionDefinitionError);
    }
  });
});

describe("mixed results", () => {
  const multipleChoice: MultipleChoiceDefinition = {
    id: "choice-1",
    type: "multiple-choice",
    prompt: "Кой е авторът на „Под игото“?",
    options: [
      { id: "a", text: "Иван Вазов" },
      { id: "b", text: "Пейо Яворов" },
    ],
    assessment: { mode: "objective", maximumPoints: 2, explanation: "Иван Вазов.", correctOptionId: "a" },
  };
  const shortResponse: ShortResponseDefinition = {
    id: "short-1",
    type: "short-response",
    prompt: "Назовете жанра.",
    assessment: { mode: "objective", maximumPoints: 1, explanation: "Роман.", acceptedAnswers: ["роман"] },
  };

  it("never counts written items as scored, correct, or fully scored", () => {
    const evaluations: Evaluation[] = [
      gradeMultipleChoice(multipleChoice, { questionId: "choice-1", type: "multiple-choice", selectedOptionId: "a" }),
      gradeShortResponse(shortResponse, { questionId: "short-1", type: "short-response", text: "Роман" }),
      evaluateWrittenResponse(createExtendedDefinition("self-review", { rubric }), {
        questionId: "extended-1",
        type: "extended-response",
        text: "Пълен анализ",
      }).evaluation,
      evaluateWrittenResponse(createEssayDefinition(), {
        questionId: "essay-1",
        type: "argumentative-writing",
        text: "Отлично есе",
      }).evaluation,
    ];

    const scored = evaluations.filter(
      (evaluation): evaluation is Extract<Evaluation, { status: "scored" }> => evaluation.status === "scored",
    );
    const notScored = evaluations.filter((evaluation) => evaluation.status !== "scored");

    expect(scored).toHaveLength(2);
    expect(notScored).toHaveLength(2);
    for (const evaluation of notScored) {
      expect(Object.keys(evaluation)).not.toContain("earnedPoints");
      expect(Object.keys(evaluation)).not.toContain("maximumPoints");
    }

    const earnedPoints = scored.reduce((sum, evaluation) => sum + evaluation.earnedPoints, 0);
    const maximumPoints = scored.reduce((sum, evaluation) => sum + evaluation.maximumPoints, 0);
    expect([earnedPoints, maximumPoints]).toEqual([3, 3]);
  });
});
