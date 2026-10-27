import { describe, expect, it, vi } from "vitest";

import { normalizeShortResponse } from "./normalize-short-response";

vi.mock("server-only", () => ({}));

describe("normalizeShortResponse", () => {
  it.each([
    ["Иван Вазов", "иван вазов"],
    ["  иван   вазов. ", "иван вазов"],
    ["ИВАН ВАЗОВ", "иван вазов"],
    ["иван\t\nвазов", "иван вазов"],
    ["иван вазов", "иван вазов"],
    ["„Иван Вазов“", "иван вазов"],
    ["«Иван Вазов»!", "иван вазов"],
    ["„ Иван Вазов ”", "иван вазов"],
    ["Иван Вазов…", "иван вазов"],
  ])("normalizes whitespace, case, and surrounding punctuation: %j", (input, expected) => {
    expect(normalizeShortResponse(input)).toBe(expected);
  });

  it("ignores stress marks without damaging the letter й", () => {
    expect(normalizeShortResponse("мѝ")).toBe("ми");
    expect(normalizeShortResponse("ма́ма")).toBe("мама");
    expect(normalizeShortResponse("Бой")).toBe("бой");
    expect(normalizeShortResponse("Бой")).toBe("бой");
  });

  it("treats every dash variant as one hyphen and keeps inner punctuation", () => {
    for (const dash of ["-", "‐", "‑", "–", "—", "−"]) {
      expect(normalizeShortResponse(`северо${dash}запад`)).toBe("северо-запад");
    }

    expect(normalizeShortResponse("Вазов, Иван")).toBe("вазов, иван");
  });

  it("does not repair spacing, correct spelling, or reorder words", () => {
    expect(normalizeShortResponse("северо запад")).not.toBe("северо-запад");
    expect(normalizeShortResponse("а - б")).not.toBe(normalizeShortResponse("а-б"));
    expect(normalizeShortResponse("Иван Вазоф")).not.toBe(normalizeShortResponse("Иван Вазов"));
    expect(normalizeShortResponse("Вазов Иван")).not.toBe(normalizeShortResponse("Иван Вазов"));
  });

  it.each(["", "   ", "\n\t", "...", "„“"])("reduces %j to an empty string", (input) => {
    expect(normalizeShortResponse(input)).toBe("");
  });
});
