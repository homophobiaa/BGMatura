import { describe, expect, it } from "vitest";
import { attemptViewSchema, formatPoints, questionOutcome, type AttemptQuestionView } from "./attempt-view";

const questionId = "4c6b5a3e-2f1d-4c8b-9a7e-6d5c4b3a2f10";
const base: AttemptQuestionView = {
  question: { id: questionId, type: "short-response", prompt: "Кой е авторът?" },
  position: 0, answer: null, revision: 0,
};

describe("practice attempt view", () => {
  it("treats a question without an accepted answer as unanswered", () => {
    expect(questionOutcome(base)).toBe("unanswered");
  });

  it("reads the server's correctness for scored answers", () => {
    const answer = { questionId, type: "short-response" as const, text: "Вазов" };
    expect(questionOutcome({ ...base, answer, evaluation: { status: "scored", earnedPoints: 2, maximumPoints: 2 }, correct: true })).toBe("correct");
    expect(questionOutcome({ ...base, answer, evaluation: { status: "scored", earnedPoints: 0, maximumPoints: 2 }, correct: false })).toBe("incorrect");
  });

  it("never turns written answers into a score", () => {
    const answer = { questionId, type: "short-response" as const, text: "Отговор" };
    expect(questionOutcome({ ...base, answer, evaluation: { status: "self-review" } })).toBe("self-review");
    expect(questionOutcome({ ...base, answer, evaluation: { status: "ungraded", reason: "not-auto-gradable" } })).toBe("ungraded");
  });

  it("accepts the server's practice response and ignores extra clock fields", () => {
    const parsed = attemptViewSchema.safeParse({
      id: questionId, title: "Тема", mode: "PRACTICE", state: "ACTIVE", position: 0,
      startedAt: "2026-11-10T07:00:00.000Z", deadline: null, questions: [base], result: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("formats points the Bulgarian way", () => {
    expect(formatPoints(1.5)).toBe("1,5");
  });
});
