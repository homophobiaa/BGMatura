import { describe, expect, it } from "vitest";
import { questionListHref, readQuestionListFilters } from "./question-list-filters";

describe("question list filters", () => {
  const topic = "4c6b5a3e-2f1d-4c8b-9a7e-6d5c4b3a2f10";

  it("reads valid filters", () => {
    expect(readQuestionListFilters({ q: " подлог ", status: "PUBLISHED", type: "SHORT_RESPONSE", topic, page: "2" }))
      .toEqual({ query: "подлог", status: "PUBLISHED", type: "SHORT_RESPONSE", topicId: topic, page: 2 });
  });

  it("drops invalid values", () => {
    expect(readQuestionListFilters({ type: "ESSAY", topic: "1", status: "x" })).toEqual({ query: "", status: "all", type: "all", topicId: "", page: 1 });
  });

  it("keeps filters in links", () => {
    const filters = readQuestionListFilters({ type: "MULTIPLE_CHOICE", topic });
    expect(questionListHref(filters, { page: 2 })).toBe(`/admin/questions?type=MULTIPLE_CHOICE&topic=${topic}&page=2`);
    expect(questionListHref(readQuestionListFilters({}))).toBe("/admin/questions");
  });
});
