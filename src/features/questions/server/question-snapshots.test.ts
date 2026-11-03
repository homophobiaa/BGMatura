import { describe, expect, it, vi } from "vitest";

import { InvalidQuestionDefinitionError } from "./grading-errors";
import { readQuestionSnapshot } from "./question-snapshots";

vi.mock("server-only", () => ({}));

const choiceDefinition = {
  id: "question-1",
  type: "multiple-choice",
  prompt: "Кой е авторът на „Под игото“?",
  options: [
    { id: "a", text: "Иван Вазов" },
    { id: "b", text: "Пейо Яворов" },
  ],
  assessment: { mode: "objective", maximumPoints: 2, explanation: "Иван Вазов.", correctOptionId: "a" },
};

function snapshotWith(content: Record<string, unknown>, formatVersion = 1) {
  return { formatVersion, content: { formatVersion: 1, subject: "LITERATURE", source: null, ...content } };
}

describe("readQuestionSnapshot", () => {
  it("reads a multiple-choice snapshot into a definition", () => {
    const view = readQuestionSnapshot(snapshotWith({ definition: choiceDefinition }));

    expect(view.subject).toBe("LITERATURE");
    expect(view.source).toBeNull();
    expect(view.definition).toEqual(choiceDefinition);
  });

  it("reads objective and written short-response snapshots", () => {
    const objective = {
      id: "q",
      type: "short-response",
      prompt: "Автор?",
      assessment: { mode: "objective", maximumPoints: 1, explanation: "Вазов.", acceptedAnswers: ["Иван Вазов"] },
    };
    const written = {
      id: "q",
      type: "short-response",
      prompt: "Обяснете.",
      assessment: { mode: "self-review", referenceGuidance: "Насоки" },
    };

    expect(readQuestionSnapshot(snapshotWith({ definition: objective })).definition).toEqual(objective);
    expect(readQuestionSnapshot(snapshotWith({ definition: written })).definition).toEqual(written);
  });

  it("reads written snapshots with and without a rubric", () => {
    const rubric = [{ id: "thesis", description: "Ясна теза", indicativePoints: 4 }, { id: "style", description: "Стил" }];
    const withRubric = {
      id: "q",
      type: "argumentative-writing",
      prompt: "Есе",
      assessment: { mode: "self-review", referenceGuidance: "Насоки", rubric },
    };
    const withoutRubric = { ...withRubric, type: "extended-response", assessment: { mode: "ungraded", referenceGuidance: "Насоки" } };

    expect(readQuestionSnapshot(snapshotWith({ definition: withRubric })).definition).toEqual(withRubric);
    expect(readQuestionSnapshot(snapshotWith({ definition: withoutRubric })).definition).toEqual(withoutRubric);
  });

  it("returns the public source", () => {
    const view = readQuestionSnapshot(
      snapshotWith({ definition: choiceDefinition, source: { origin: "OFFICIAL", attribution: "МОН" } }),
    );

    expect(view.source).toEqual({ origin: "OFFICIAL", attribution: "МОН" });
  });

  it("refuses a layout version it does not know", () => {
    expect(() => readQuestionSnapshot(snapshotWith({ definition: choiceDefinition }, 2))).toThrow(
      "format version 2 is not supported",
    );
  });

  it.each([
    ["an unknown field", { definition: { ...choiceDefinition, extra: true } }],
    ["a missing prompt", { definition: { ...choiceDefinition, prompt: undefined } }],
    ["a negative maximum", { definition: { ...choiceDefinition, assessment: { ...choiceDefinition.assessment, maximumPoints: -1 } } }],
    ["an unknown question type", { definition: { ...choiceDefinition, type: "essay" } }],
    ["a source with private details", { definition: choiceDefinition, source: { origin: "ADAPTED", attribution: null, editorName: "X" } }],
    ["a malformed rubric", {
      definition: {
        id: "q",
        type: "extended-response",
        prompt: "Есе",
        assessment: { mode: "self-review", referenceGuidance: "Насоки", rubric: [{ id: "a" }] },
      },
    }],
  ])("refuses a snapshot with %s", (_description, content) => {
    expect(() => readQuestionSnapshot(snapshotWith(content))).toThrow(InvalidQuestionDefinitionError);
  });
});
