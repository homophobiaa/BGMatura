import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Question } from "../types";
import type { QuestionDefinition } from "./contracts";
import { toPublicQuestion } from "./public-questions";

vi.mock("server-only", () => ({}));

// Every private field carries a marker, so a leak shows up in the serialized output.
const SECRET = "ПРИВАТНО-НЕ-ЗА-УЧЕНИКА";

const definitions: Record<Question["type"], QuestionDefinition> = {
  "multiple-choice": {
    id: "choice-1",
    type: "multiple-choice",
    prompt: "Кой е авторът на „Под игото“?",
    options: [
      { id: "a", text: "Иван Вазов" },
      { id: "b", text: "Пейо Яворов" },
    ],
    assessment: { mode: "objective", maximumPoints: 7, explanation: `${SECRET} обяснение`, correctOptionId: "a" },
  },
  "short-response": {
    id: "short-1",
    type: "short-response",
    prompt: "Назовете жанра.",
    assessment: { mode: "objective", maximumPoints: 7, explanation: `${SECRET} обяснение`, acceptedAnswers: [`${SECRET} роман`] },
  },
  "extended-response": {
    id: "extended-1",
    type: "extended-response",
    prompt: "Анализирайте образа.",
    assessment: {
      mode: "self-review",
      referenceGuidance: `${SECRET} насоки`,
      rubric: [{ id: "thesis", description: `${SECRET} критерий`, indicativePoints: 7 }],
    },
  },
  "argumentative-writing": {
    id: "essay-1",
    type: "argumentative-writing",
    prompt: "Напишете есе.",
    assessment: { mode: "ungraded", referenceGuidance: `${SECRET} насоки` },
  },
};

describe("toPublicQuestion", () => {
  it("exposes only id, type, prompt, and option ids and texts for multiple choice", () => {
    expect(toPublicQuestion(definitions["multiple-choice"])).toEqual({
      id: "choice-1",
      type: "multiple-choice",
      prompt: "Кой е авторът на „Под игото“?",
      options: [
        { id: "a", text: "Иван Вазов" },
        { id: "b", text: "Пейо Яворов" },
      ],
    });
  });

  it.each(["short-response", "extended-response", "argumentative-writing"] as const)(
    "exposes only id, type, and prompt for %s",
    (type) => {
      const definition = definitions[type];

      expect(toPublicQuestion(definition)).toEqual({ id: definition.id, type, prompt: definition.prompt });
    },
  );

  it.each(Object.values(definitions))("never serializes a private field of a $type question", (definition) => {
    const serialized = JSON.stringify(toPublicQuestion(definition));

    for (const privateText of [SECRET, "assessment", "correctOptionId", "acceptedAnswers", "explanation", "referenceGuidance", "rubric", "maximumPoints"]) {
      expect(serialized).not.toContain(privateText);
    }
  });

  it("does not copy fields that are added to a definition later", () => {
    const withExtraField = Object.assign({}, definitions["multiple-choice"], { debugKey: SECRET, points: 7 });
    const withExtraOption = {
      ...definitions["multiple-choice"],
      options: [{ id: "a", text: "Иван Вазов", isCorrect: true, hint: SECRET }],
    };

    expect(JSON.stringify(toPublicQuestion(withExtraField))).not.toContain(SECRET);
    expect(JSON.stringify(toPublicQuestion(withExtraOption))).not.toContain(SECRET);
    expect(JSON.stringify(toPublicQuestion(withExtraOption))).not.toContain("isCorrect");
  });

  it("returns a value that matches the client-safe Question type", () => {
    expectTypeOf(toPublicQuestion).returns.toEqualTypeOf<Question>();
  });
});
