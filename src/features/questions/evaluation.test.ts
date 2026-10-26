import { describe, expect, expectTypeOf, it } from "vitest";

import { evaluationSchema } from "./evaluation";
import type { Evaluation } from "./evaluation";
import type {
  ArgumentativeWritingDefinition,
  MultipleChoiceDefinition,
  QuestionDefinition,
} from "./server/contracts";
import type { MultipleChoiceQuestion, Question, SubmittedAnswer } from "./types";

describe("evaluation contract", () => {
  it("accepts a server-scored objective evaluation", () => {
    expect(evaluationSchema.parse({ status: "scored", earnedPoints: 1, maximumPoints: 2 })).toEqual({
      status: "scored",
      earnedPoints: 1,
      maximumPoints: 2,
    });
  });

  it("allows an explicitly configured zero-point objective item", () => {
    expect(evaluationSchema.parse({ status: "scored", earnedPoints: 0, maximumPoints: 0 })).toEqual({
      status: "scored",
      earnedPoints: 0,
      maximumPoints: 0,
    });
  });

  it.each([
    { status: "ungraded", reason: "not-auto-gradable" },
    { status: "ungraded", reason: "answer-rules-unavailable" },
    { status: "self-review" },
  ])("represents $status without fabricated points", (evaluation) => {
    expect(evaluationSchema.parse(evaluation)).toEqual(evaluation);
  });

  it.each([
    { status: "scored", earnedPoints: -1, maximumPoints: 2 },
    { status: "scored", earnedPoints: 3, maximumPoints: 2 },
    { status: "scored", earnedPoints: 0, maximumPoints: -1 },
    { status: "scored", earnedPoints: Number.NaN, maximumPoints: 2 },
    { status: "scored", earnedPoints: Number.POSITIVE_INFINITY, maximumPoints: 2 },
    { status: "scored", earnedPoints: 1 },
    { status: "self-review", earnedPoints: 0, maximumPoints: 30 },
    { status: "ungraded", reason: "not-auto-gradable", earnedPoints: 0 },
  ])("rejects invalid or misleading scoring: %j", (evaluation) => {
    expect(evaluationSchema.safeParse(evaluation).success).toBe(false);
  });

  it("narrows question/answer variants and keeps authoritative fields server-side", () => {
    expectTypeOf<MultipleChoiceQuestion>().toHaveProperty("options");
    expectTypeOf<MultipleChoiceQuestion>().not.toHaveProperty("assessment");
    expectTypeOf<Question>().not.toHaveProperty("correctOptionId");
    expectTypeOf<MultipleChoiceDefinition["assessment"]>().toHaveProperty("correctOptionId");
    expectTypeOf<ArgumentativeWritingDefinition["assessment"]>().not.toHaveProperty("earnedPoints");
    expectTypeOf<QuestionDefinition["type"]>().toEqualTypeOf<Question["type"]>();
    expectTypeOf<Extract<Evaluation, { status: "self-review" }>>().not.toHaveProperty("earnedPoints");
    expectTypeOf<Extract<SubmittedAnswer, { type: "multiple-choice" }>>().toHaveProperty("selectedOptionId");
    expectTypeOf<Extract<SubmittedAnswer, { type: "short-response" }>>().toHaveProperty("text");
    expectTypeOf<Extract<SubmittedAnswer, { type: "extended-response" }>>().toHaveProperty("text");
    expectTypeOf<Extract<SubmittedAnswer, { type: "argumentative-writing" }>>().toHaveProperty("text");
  });
});
