import { describe, expect, it } from "vitest";
import { learningListHref, readLearningListFilters } from "./learning-list-filters";

describe("learning list filters", () => {
  it("reads valid query state", () => {
    expect(readLearningListFilters({ q: "  Ботев ", status: "DRAFT", page: "3" })).toEqual({ query: "Ботев", status: "DRAFT", page: 3 });
  });

  it("falls back to defaults for invalid or repeated values", () => {
    expect(readLearningListFilters({ status: "ARCHIVED", page: "-2" })).toEqual({ query: "", status: "all", page: 1 });
    expect(readLearningListFilters({ q: ["първо", "второ"], page: "1.5" })).toEqual({ query: "първо", status: "all", page: 1 });
  });

  it("keeps filters when building links", () => {
    const filters = { query: "под игото", status: "PUBLISHED" as const, page: 2 };
    expect(learningListHref("/admin/learning/work", filters, { page: 3 })).toBe("/admin/learning/work?q=%D0%BF%D0%BE%D0%B4+%D0%B8%D0%B3%D0%BE%D1%82%D0%BE&status=PUBLISHED&page=3");
    expect(learningListHref("/admin/learning/work", { query: "", status: "all", page: 1 })).toBe("/admin/learning/work");
    expect(learningListHref("/admin/learning/work", { query: "", status: "DRAFT", page: 1 }, { deleted: "a-b" })).toBe("/admin/learning/work?status=DRAFT&deleted=a-b");
  });
});
