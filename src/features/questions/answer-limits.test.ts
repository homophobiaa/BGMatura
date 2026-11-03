import { describe, expect, it } from "vitest";

import { findWrittenAnswerProblem, WRITTEN_ANSWER_MAX_LENGTH } from "./answer-limits";
import type { WrittenAnswerType } from "./answer-limits";

const types = Object.keys(WRITTEN_ANSWER_MAX_LENGTH) as WrittenAnswerType[];

describe("written answer limits", () => {
  it("allow more room for longer kinds of answer", () => {
    expect(WRITTEN_ANSWER_MAX_LENGTH["short-response"]).toBeLessThan(WRITTEN_ANSWER_MAX_LENGTH["extended-response"]);
    expect(WRITTEN_ANSWER_MAX_LENGTH["extended-response"]).toBeLessThan(
      WRITTEN_ANSWER_MAX_LENGTH["argumentative-writing"],
    );
  });

  it("leave room to rewrite a whole paragraph in a short answer", () => {
    expect(WRITTEN_ANSWER_MAX_LENGTH["short-response"]).toBeGreaterThanOrEqual(400);
  });
});

describe("findWrittenAnswerProblem", () => {
  it.each(types)("accepts an ordinary %s answer", (type) => {
    expect(findWrittenAnswerProblem(type, "Иван Вазов е авторът на „Под игото“.")).toBeNull();
  });

  it.each(types)("treats %s text made only of spaces, tabs, or line breaks as empty", (type) => {
    for (const blank of ["", " ", "   ", "\n", " \n\t\r\n "]) {
      expect(findWrittenAnswerProblem(type, blank)).toBe("empty");
    }
  });

  it.each(types)("accepts a %s answer of exactly the maximum length and rejects one more character", (type) => {
    const limit = WRITTEN_ANSWER_MAX_LENGTH[type];

    expect(findWrittenAnswerProblem(type, "а".repeat(limit))).toBeNull();
    expect(findWrittenAnswerProblem(type, "а".repeat(limit + 1))).toBe("too-long");
  });

  it("counts the text exactly as typed, so padding counts toward the limit", () => {
    const limit = WRITTEN_ANSWER_MAX_LENGTH["short-response"];

    expect(findWrittenAnswerProblem("short-response", `${" ".repeat(limit)}а`)).toBe("too-long");
  });

  it("keeps line breaks inside an answer valid", () => {
    expect(findWrittenAnswerProblem("extended-response", "Първи ред\n\nВтори ред")).toBeNull();
  });

  it("applies the limit of the question type", () => {
    const text = "а".repeat(WRITTEN_ANSWER_MAX_LENGTH["short-response"] + 1);

    expect(findWrittenAnswerProblem("short-response", text)).toBe("too-long");
    expect(findWrittenAnswerProblem("extended-response", text)).toBeNull();
    expect(findWrittenAnswerProblem("argumentative-writing", text)).toBeNull();
  });
});
