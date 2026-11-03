// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { choiceFromDraft, isAnswered, toNavigatorItems, useAnswerDrafts } from "./answer-drafts";
import type { Question } from "./types";

afterEach(cleanup);

const choice: Question = {
  id: "choice-1",
  type: "multiple-choice",
  prompt: "Кой е авторът?",
  options: [
    { id: "a", text: "Иван Вазов" },
    { id: "b", text: "Пейо Яворов" },
  ],
};
const short: Question = { id: "short-1", type: "short-response", prompt: "Назовете жанра." };
const extended: Question = { id: "extended-1", type: "extended-response", prompt: "Анализирайте образа." };
const essay: Question = { id: "essay-1", type: "argumentative-writing", prompt: "Напишете есе." };

describe("isAnswered", () => {
  it("counts a chosen option as an answer, and no option as none", () => {
    expect(isAnswered(choice, "a")).toBe(true);
    expect(isAnswered(choice, "")).toBe(false);
    expect(isAnswered(choice, undefined)).toBe(false);
  });

  it.each([short, extended, essay])("counts written text with a visible character as an answer for $type", (question) => {
    expect(isAnswered(question, "роман")).toBe(true);
    expect(isAnswered(question, "  роман \n")).toBe(true);
  });

  it.each([short, extended, essay])("does not count empty or blank text as an answer for $type", (question) => {
    for (const blank of ["", " ", "\n", " \t\r\n ", undefined]) {
      expect(isAnswered(question, blank)).toBe(false);
    }
  });
});

describe("choiceFromDraft", () => {
  it("returns the chosen option or null", () => {
    expect(choiceFromDraft("b")).toBe("b");
    expect(choiceFromDraft("")).toBeNull();
    expect(choiceFromDraft(undefined)).toBeNull();
  });
});

describe("toNavigatorItems", () => {
  it("lists every question in order with whether it has an answer", () => {
    const items = toNavigatorItems([choice, short, extended, essay], {
      "choice-1": "b",
      "short-1": "   ",
      "extended-1": "Бай Ганьо е...",
    });

    expect(items).toEqual([
      { id: "choice-1", answered: true },
      { id: "short-1", answered: false },
      { id: "extended-1", answered: true },
      { id: "essay-1", answered: false },
    ]);
  });

  it("marks everything unanswered when there are no drafts", () => {
    expect(toNavigatorItems([choice, short], {}).every((item) => !item.answered)).toBe(true);
  });
});

describe("useAnswerDrafts", () => {
  it("starts with no drafts", () => {
    const { result } = renderHook(() => useAnswerDrafts());

    expect(result.current.drafts).toEqual({});
  });

  it("keeps each question's answer separately and replaces it when changed", () => {
    const { result } = renderHook(() => useAnswerDrafts());

    act(() => result.current.setDraft("choice-1", "a"));
    act(() => result.current.setDraft("extended-1", "Първи ред\n\nВтори ред"));
    act(() => result.current.setDraft("choice-1", "b"));

    expect(result.current.drafts).toEqual({ "choice-1": "b", "extended-1": "Първи ред\n\nВтори ред" });
  });

  it("stores the text exactly as given, without trimming", () => {
    const { result } = renderHook(() => useAnswerDrafts());

    act(() => result.current.setDraft("short-1", "  Щастие  "));

    expect(result.current.drafts["short-1"]).toBe("  Щастие  ");
  });

  it("creates a new drafts object on every change and leaves the old one alone", () => {
    const { result } = renderHook(() => useAnswerDrafts());
    const before = result.current.drafts;

    act(() => result.current.setDraft("choice-1", "a"));

    expect(result.current.drafts).not.toBe(before);
    expect(before).toEqual({});
  });

  it("gives setDraft a stable identity, so it is safe in effect dependencies", () => {
    const { result, rerender } = renderHook(() => useAnswerDrafts());
    const first = result.current.setDraft;

    act(() => result.current.setDraft("choice-1", "a"));
    rerender();

    expect(result.current.setDraft).toBe(first);
  });
});
