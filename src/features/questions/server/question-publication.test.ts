import { describe, expect, it, vi } from "vitest";

import {
  checkPublicationReadiness,
  QuestionNotReadyToPublishError,
} from "./question-publication";
import type { PublicationCandidate, PublicationProblemCode } from "./question-publication";

vi.mock("server-only", () => ({}));

const reviewedOriginal = {
  origin: "ORIGINAL",
  attribution: null,
  editorName: "Тестов редактор",
  reviewStatus: "REVIEWED",
} as const;

const completeChoice: PublicationCandidate = {
  type: "MULTIPLE_CHOICE",
  assessmentMode: "OBJECTIVE",
  prompt: "Кой е авторът на „Под игото“?",
  explanation: "Авторът е Иван Вазов.",
  referenceGuidance: null,
  rubric: null,
  acceptedAnswers: [],
  correctOptionId: "a",
  options: [
    { id: "a", text: "Иван Вазов" },
    { id: "b", text: "Пейо Яворов" },
  ],
  topicLinkCount: 1,
  provenance: reviewedOriginal,
};

const completeShortResponse: PublicationCandidate = {
  ...completeChoice,
  type: "SHORT_RESPONSE",
  acceptedAnswers: ["Иван Вазов"],
  correctOptionId: null,
  options: [],
};

const completeWritten: PublicationCandidate = {
  ...completeChoice,
  type: "ARGUMENTATIVE_WRITING",
  assessmentMode: "SELF_REVIEW",
  explanation: null,
  referenceGuidance: "Очаква се теза, аргументи и извод.",
  rubric: [{ id: "thesis", description: "Ясна теза", indicativePoints: 4 }, { id: "style", description: "Стил" }],
  correctOptionId: null,
  options: [],
};

function codes(candidate: PublicationCandidate): PublicationProblemCode[] {
  return checkPublicationReadiness(candidate).map((problem) => problem.code);
}

describe("checkPublicationReadiness", () => {
  it.each([
    ["multiple-choice", completeChoice],
    ["short-response", completeShortResponse],
    ["argumentative-writing", completeWritten],
    ["ungraded extended-response", { ...completeWritten, type: "EXTENDED_RESPONSE", assessmentMode: "UNGRADED", rubric: null }],
    ["written short-response", { ...completeWritten, type: "SHORT_RESPONSE", rubric: null }],
  ] as const)("accepts a complete %s question", (_description, candidate) => {
    expect(checkPublicationReadiness(candidate)).toEqual([]);
  });

  it("accepts an original question without an attribution", () => {
    expect(codes({ ...completeChoice, provenance: { ...reviewedOriginal, attribution: null } })).toEqual([]);
  });

  describe("every question", () => {
    it.each([
      ["a blank prompt", { prompt: "   \n" }, "prompt-missing"],
      ["no topic link", { topicLinkCount: 0 }, "topic-link-missing"],
      ["no provenance record", { provenance: null }, "source-missing"],
      ["no editor", { provenance: { ...reviewedOriginal, editorName: null } }, "editor-missing"],
      ["a blank editor", { provenance: { ...reviewedOriginal, editorName: "  " } }, "editor-missing"],
      ["no review", { provenance: { ...reviewedOriginal, reviewStatus: "UNREVIEWED" } }, "review-missing"],
      [
        "an adapted question without attribution",
        { provenance: { ...reviewedOriginal, origin: "ADAPTED" } },
        "attribution-missing",
      ],
      [
        "an official question with a blank attribution",
        { provenance: { ...reviewedOriginal, origin: "OFFICIAL", attribution: " " } },
        "attribution-missing",
      ],
    ] as const)("rejects %s", (_description, change, code) => {
      expect(codes({ ...completeChoice, ...change })).toEqual([code]);
    });

    it("accepts an adapted question once its attribution is recorded", () => {
      const provenance = { ...reviewedOriginal, origin: "ADAPTED", attribution: "По материал на МОН" } as const;

      expect(codes({ ...completeChoice, provenance })).toEqual([]);
    });
  });

  describe("multiple choice", () => {
    it.each([
      ["no explanation", { explanation: null }, "explanation-missing"],
      ["a blank explanation", { explanation: "  " }, "explanation-missing"],
      ["a single option", { options: [{ id: "a", text: "Иван Вазов" }] }, "multiple-choice-needs-two-options"],
      ["no options", { options: [], correctOptionId: null }, "multiple-choice-needs-two-options"],
      ["no correct option", { correctOptionId: null }, "multiple-choice-correct-option-missing"],
      ["a correct option that is not offered", { correctOptionId: "zzz" }, "multiple-choice-correct-option-missing"],
    ] as const)("rejects %s", (_description, change, code) => {
      expect(codes({ ...completeChoice, ...change })).toContain(code);
    });

    it("rejects options with the same text, ignoring case and spacing", () => {
      const options = [
        { id: "a", text: "Иван Вазов" },
        { id: "b", text: "  иван   ВАЗОВ " },
      ];

      expect(codes({ ...completeChoice, options })).toEqual(["multiple-choice-duplicate-options"]);
    });
  });

  describe("short response", () => {
    it.each([
      ["no accepted answers", { acceptedAnswers: [] }, ["short-response-needs-accepted-answers"]],
      ["only blank accepted answers", { acceptedAnswers: ["", "  ", "..."] }, [
        "short-response-needs-accepted-answers",
        "short-response-blank-accepted-answer",
      ]],
      ["a blank answer next to a usable one", { acceptedAnswers: ["Иван Вазов", " "] }, ["short-response-blank-accepted-answer"]],
    ] as const)("rejects %s", (_description, change, expected) => {
      expect(codes({ ...completeShortResponse, ...change })).toEqual(expected);
    });

    it("requires an explanation for an objective short response", () => {
      expect(codes({ ...completeShortResponse, explanation: null })).toEqual(["explanation-missing"]);
    });
  });

  describe("written responses", () => {
    it.each([
      ["no guidance", { referenceGuidance: null }, "guidance-missing"],
      ["blank guidance", { referenceGuidance: " " }, "guidance-missing"],
      ["a rubric that is not a list", { rubric: { id: "a" } }, "rubric-malformed"],
      ["a criterion without a description", { rubric: [{ id: "a" }] }, "rubric-malformed"],
      ["a negative indicative point value", { rubric: [{ id: "a", description: "A", indicativePoints: -1 }] }, "rubric-malformed"],
    ] as const)("rejects %s", (_description, change, code) => {
      expect(codes({ ...completeWritten, ...change })).toEqual([code]);
    });

    it("does not ask a written question for an explanation or accepted answers", () => {
      expect(codes({ ...completeWritten, explanation: null, acceptedAnswers: [] })).toEqual([]);
    });
  });

  it("reports every problem at once so an editor can fix them in one pass", () => {
    const emptyDraft: PublicationCandidate = {
      ...completeChoice,
      explanation: null,
      options: [],
      correctOptionId: null,
      topicLinkCount: 0,
      provenance: null,
    };

    expect(codes(emptyDraft)).toEqual([
      "explanation-missing",
      "multiple-choice-needs-two-options",
      "multiple-choice-correct-option-missing",
      "topic-link-missing",
      "source-missing",
    ]);
  });

  it("gives every problem an actionable message", () => {
    const problems = checkPublicationReadiness({ ...completeChoice, topicLinkCount: 0, provenance: null });

    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      expect(problem.message.length).toBeGreaterThan(10);
      expect(problem.message).toMatch(/[.]$/);
    }
  });
});

describe("QuestionNotReadyToPublishError", () => {
  it("lists every reason in its message and keeps the structured problems", () => {
    const problems = checkPublicationReadiness({ ...completeChoice, topicLinkCount: 0, provenance: null });
    const error = new QuestionNotReadyToPublishError("question-1", problems);

    expect(error.name).toBe("QuestionNotReadyToPublishError");
    expect(error.message).toContain("question-1");
    expect(error.message).toContain("Link the question to at least one topic.");
    expect(error.message).toContain("Record where the question comes from");
    expect(error.problems).toEqual(problems);
  });
});
