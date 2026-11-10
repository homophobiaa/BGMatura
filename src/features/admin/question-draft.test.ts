import { describe, expect, it } from "vitest";
import { buildQuestionDraft, defaultAssessmentMode, parsePoints, type QuestionEditorState } from "./question-draft";

const base: QuestionEditorState = {
  subject: "BULGARIAN_LANGUAGE", type: "MULTIPLE_CHOICE", assessmentMode: "OBJECTIVE", prompt: "Въпрос?",
  maximumPoints: "1,5", explanation: "Обяснение", acceptedAnswersText: "", options: [{ key: "a", text: "едно" }, { key: "b", text: "две" }],
  correctOptionKey: "b", referenceGuidance: "", rubric: [], topicIds: ["t"], workIds: ["w"],
  provenance: { origin: "ORIGINAL", editorName: " Редактор ", attribution: "", sourceReference: "", reviewNotes: "", reviewed: false },
};

describe("question draft payload", () => {
  it("sends the correct option by its position after reordering", () => {
    const reordered = { ...base, options: [{ key: "b", text: "две" }, { key: "a", text: "едно" }] };
    expect(buildQuestionDraft(reordered)).toMatchObject({ options: [{ text: "две" }, { text: "едно" }], correctOptionIndex: 0, maximumPoints: 1.5 });
  });

  it("sends no key when none is chosen", () => {
    expect(buildQuestionDraft({ ...base, correctOptionKey: null })).toMatchObject({ correctOptionIndex: null });
  });

  it("drops work links outside literature and trims provenance", () => {
    expect(buildQuestionDraft(base)).toMatchObject({ workIds: [], provenance: { editorName: "Редактор", attribution: null } });
  });

  it("turns accepted answers into one item per line", () => {
    const short = { ...base, type: "SHORT_RESPONSE" as const, acceptedAnswersText: "Вазов\n\n Иван Вазов " };
    const draft = buildQuestionDraft(short);
    expect(draft).toMatchObject({ assessmentMode: "OBJECTIVE", acceptedAnswers: ["Вазов", "Иван Вазов"] });
    expect(draft).not.toHaveProperty("options");
  });

  it("never sends points for written questions", () => {
    const written = { ...base, type: "ARGUMENTATIVE_WRITING" as const, assessmentMode: "SELF_REVIEW" as const, referenceGuidance: "Насоки",
      rubric: [{ key: "k", id: "criterion-1", description: "Теза", indicativePoints: "" }, { key: "l", id: "criterion-2", description: "Стил", indicativePoints: "2" }] };
    const draft = buildQuestionDraft(written);
    expect(draft).not.toHaveProperty("maximumPoints");
    expect(draft).toMatchObject({ referenceGuidance: "Насоки", rubric: [{ id: "criterion-1", description: "Теза" }, { id: "criterion-2", indicativePoints: 2 }] });
  });

  it("keeps only modes the type allows", () => {
    expect(defaultAssessmentMode("ARGUMENTATIVE_WRITING", "OBJECTIVE")).toBe("SELF_REVIEW");
    expect(defaultAssessmentMode("MULTIPLE_CHOICE", "SELF_REVIEW")).toBe("OBJECTIVE");
    expect(defaultAssessmentMode("SHORT_RESPONSE", "UNGRADED")).toBe("UNGRADED");
  });

  it("reads decimal commas and treats blank points as missing", () => {
    expect(parsePoints("2,25")).toBe(2.25);
    expect(parsePoints(" ")).toBeNaN();
  });
});
