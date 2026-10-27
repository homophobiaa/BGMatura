import { describe, expect, it, vi } from "vitest";

import { evaluationSchema } from "../evaluation";
import type { SubmittedAnswer } from "../types";
import type { ShortResponseDefinition } from "./contracts";
import { gradeShortResponse } from "./grade-short-response";
import { InvalidQuestionDefinitionError, InvalidSubmittedAnswerError } from "./grading-errors";

vi.mock("server-only", () => ({}));

function createObjectiveDefinition(acceptedAnswers: string[], maximumPoints = 1): ShortResponseDefinition {
  return {
    id: "question-1",
    type: "short-response",
    prompt: "Кой е авторът на „Под игото“?",
    assessment: { mode: "objective", maximumPoints, explanation: "Авторът е Иван Вазов.", acceptedAnswers },
  };
}

function createWrittenDefinition(mode: "self-review" | "ungraded"): ShortResponseDefinition {
  return {
    id: "question-1",
    type: "short-response",
    prompt: "Обяснете със свои думи.",
    assessment: { mode, referenceGuidance: "Очаква се кратко обяснение." },
  };
}

function answerWith(text: string, questionId = "question-1"): SubmittedAnswer {
  return { questionId, type: "short-response", text };
}

const scoredFull = { status: "scored", earnedPoints: 1, maximumPoints: 1 };
const scoredZero = { status: "scored", earnedPoints: 0, maximumPoints: 1 };

describe("gradeShortResponse with accepted answers", () => {
  const definition = createObjectiveDefinition(["Иван Вазов"]);

  it.each(["Иван Вазов", "  иван   вазов. ", "„Иван Вазов“", "ИВАН ВАЗОВ", "Иван Вазов"])(
    "accepts %j",
    (text) => {
      expect(gradeShortResponse(definition, answerWith(text))).toEqual(scoredFull);
    },
  );

  it.each([
    ["an extra word", "Иван Вазов е"],
    ["a different word order", "Вазов Иван"],
    ["a misspelling", "Иван Вазоф"],
    ["a different author", "Алеко Константинов"],
  ])("scores %s as zero", (_description, text) => {
    expect(gradeShortResponse(definition, answerWith(text))).toEqual(scoredZero);
  });

  it.each(["", "   ", "...", "\n"])("scores the missing response %j as zero, not ungraded", (text) => {
    expect(gradeShortResponse(definition, answerWith(text))).toEqual(scoredZero);
  });

  it("accepts any of several accepted forms", () => {
    const withAlternatives = createObjectiveDefinition(["Иван Вазов", "Вазов, Иван"]);

    expect(gradeShortResponse(withAlternatives, answerWith("вазов, иван"))).toEqual(scoredFull);
    expect(gradeShortResponse(withAlternatives, answerWith("Иван Вазов"))).toEqual(scoredFull);
    expect(gradeShortResponse(withAlternatives, answerWith("Вазов Иван"))).toEqual(scoredZero);
  });

  it("normalizes the accepted answers the same way as the response", () => {
    const withStressAndDash = createObjectiveDefinition(["мѝ", "Северо–запад"]);

    expect(gradeShortResponse(withStressAndDash, answerWith("ми"))).toEqual(scoredFull);
    expect(gradeShortResponse(withStressAndDash, answerWith("северо-запад"))).toEqual(scoredFull);
    expect(gradeShortResponse(withStressAndDash, answerWith("северо запад"))).toEqual(scoredZero);
  });

  it("awards the configured points", () => {
    const worthThree = createObjectiveDefinition(["Иван Вазов"], 3);

    expect(gradeShortResponse(worthThree, answerWith("Иван Вазов"))).toEqual({
      status: "scored",
      earnedPoints: 3,
      maximumPoints: 3,
    });
  });

  it("returns evaluations that satisfy the shared contract", () => {
    for (const text of ["Иван Вазов", "Иван Вазоф", "", "Ivan Vazov"]) {
      expect(evaluationSchema.safeParse(gradeShortResponse(definition, answerWith(text))).success).toBe(true);
    }
  });
});

describe("gradeShortResponse with ambiguous or unreliable rules", () => {
  it("leaves a Latin-letter response ungraded when no accepted answer uses Latin letters", () => {
    const definition = createObjectiveDefinition(["Иван Вазов"]);

    expect(gradeShortResponse(definition, answerWith("Ivan Vazov"))).toEqual({
      status: "ungraded",
      reason: "not-auto-gradable",
    });
    expect(gradeShortResponse(definition, answerWith("Иван Vazov"))).toEqual({
      status: "ungraded",
      reason: "not-auto-gradable",
    });
  });

  it("grades Latin-letter responses normally when an accepted answer uses Latin letters", () => {
    const definition = createObjectiveDefinition(["Wi-Fi"]);

    expect(gradeShortResponse(definition, answerWith("wi-fi"))).toEqual(scoredFull);
    expect(gradeShortResponse(definition, answerWith("wifi"))).toEqual(scoredZero);
  });

  it.each([[[]], [[""]], [["   ", "..."]]])(
    "reports unavailable answer rules instead of a score for accepted answers %j",
    (acceptedAnswers) => {
      const definition = createObjectiveDefinition(acceptedAnswers);

      expect(gradeShortResponse(definition, answerWith("Иван Вазов"))).toEqual({
        status: "ungraded",
        reason: "answer-rules-unavailable",
      });
      expect(gradeShortResponse(definition, answerWith(""))).toEqual({
        status: "ungraded",
        reason: "answer-rules-unavailable",
      });
    },
  );

  it("ignores empty accepted answers when usable ones remain", () => {
    const definition = createObjectiveDefinition(["", "Иван Вазов"]);

    expect(gradeShortResponse(definition, answerWith("Иван Вазов"))).toEqual(scoredFull);
    expect(gradeShortResponse(definition, answerWith(""))).toEqual(scoredZero);
  });
});

describe("gradeShortResponse for written assessments", () => {
  it("returns self-review without points", () => {
    expect(gradeShortResponse(createWrittenDefinition("self-review"), answerWith("Нещо"))).toEqual({
      status: "self-review",
    });
  });

  it("returns ungraded without points", () => {
    expect(gradeShortResponse(createWrittenDefinition("ungraded"), answerWith("Нещо"))).toEqual({
      status: "ungraded",
      reason: "not-auto-gradable",
    });
  });
});

describe("gradeShortResponse input validation", () => {
  it("rejects an answer for a different question", () => {
    expect(() =>
      gradeShortResponse(createObjectiveDefinition(["Иван Вазов"]), answerWith("Иван Вазов", "question-2")),
    ).toThrow(InvalidSubmittedAnswerError);
  });

  it("rejects an answer of a different type", () => {
    const choiceAnswer: SubmittedAnswer = {
      questionId: "question-1",
      type: "multiple-choice",
      selectedOptionId: "a",
    };

    expect(() => gradeShortResponse(createObjectiveDefinition(["Иван Вазов"]), choiceAnswer)).toThrow(
      "Question question-1 expects a short-response answer but received multiple-choice.",
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses to grade a definition with maximum points %s",
    (maximumPoints) => {
      expect(() =>
        gradeShortResponse(createObjectiveDefinition(["Иван Вазов"], maximumPoints), answerWith("Иван Вазов")),
      ).toThrow(InvalidQuestionDefinitionError);
    },
  );
});
