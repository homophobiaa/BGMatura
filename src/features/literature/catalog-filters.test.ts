import { expect, it } from "vitest";
import { readCatalogFilters } from "./catalog-filters";

it("normalizes URL filters and bounds untrusted input", () => {
  expect(readCatalogFilters({ q: "  ЙОВКОВ  ", author: ["one", "two"], genre: "Роман" })).toEqual({ query: "ЙОВКОВ", author: "", genre: "Роман" });
  expect(readCatalogFilters({ q: "x".repeat(201) }).query).toHaveLength(200);
  expect(readCatalogFilters({})).toEqual({ query: "", author: "", genre: "" });
});
