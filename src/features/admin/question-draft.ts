import type { QuestionTypeValue } from "./question-list-filters";

/**
 * The question editor's working state and its conversion to the payload that
 * saveQuestionDraft validates. Only fields that belong to the chosen type and
 * assessment mode are sent, so the server's strict schema sees one clear variant.
 */
export type AssessmentModeValue = "OBJECTIVE" | "SELF_REVIEW" | "UNGRADED";
export type SubjectValue = "BULGARIAN_LANGUAGE" | "LITERATURE";
export type QuestionOrigin = "ORIGINAL" | "ADAPTED" | "OFFICIAL";

export type EditableOption = { key: string; text: string };
export type EditableCriterion = { key: string; id: string; description: string; indicativePoints: string };

export type QuestionEditorState = {
  subject: SubjectValue;
  type: QuestionTypeValue;
  assessmentMode: AssessmentModeValue;
  prompt: string;
  maximumPoints: string;
  explanation: string;
  acceptedAnswersText: string;
  options: EditableOption[];
  correctOptionKey: string | null;
  referenceGuidance: string;
  rubric: EditableCriterion[];
  topicIds: string[];
  workIds: string[];
  provenance: { origin: QuestionOrigin; editorName: string; attribution: string; sourceReference: string; reviewNotes: string; reviewed: boolean };
};

/** Which assessment modes each type allows. Multiple choice is always objective; long writing never is. */
export const allowedAssessmentModes: Record<QuestionTypeValue, readonly AssessmentModeValue[]> = {
  MULTIPLE_CHOICE: ["OBJECTIVE"],
  SHORT_RESPONSE: ["OBJECTIVE", "SELF_REVIEW", "UNGRADED"],
  EXTENDED_RESPONSE: ["SELF_REVIEW", "UNGRADED"],
  ARGUMENTATIVE_WRITING: ["SELF_REVIEW", "UNGRADED"],
};

export function defaultAssessmentMode(type: QuestionTypeValue, current: AssessmentModeValue): AssessmentModeValue {
  const allowed = allowedAssessmentModes[type];
  return allowed.includes(current) ? current : allowed[0] ?? "OBJECTIVE";
}

const nullableText = (value: string) => value.trim() ? value.trim() : null;
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

/** Bulgarian editors type decimal commas; the server expects a number. */
export function parsePoints(value: string): number {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? Number.NaN : Number(normalized);
}

export function buildQuestionDraft(state: QuestionEditorState): Record<string, unknown> {
  const common = {
    subject: state.subject,
    type: state.type,
    prompt: state.prompt,
    topicIds: state.topicIds,
    workIds: state.subject === "LITERATURE" ? state.workIds : [],
    provenance: {
      origin: state.provenance.origin,
      editorName: nullableText(state.provenance.editorName),
      attribution: nullableText(state.provenance.attribution),
      sourceReference: nullableText(state.provenance.sourceReference),
      reviewNotes: nullableText(state.provenance.reviewNotes),
      reviewed: state.provenance.reviewed,
    },
  };
  const mode = defaultAssessmentMode(state.type, state.assessmentMode);
  if (mode === "OBJECTIVE") {
    const objective = { ...common, assessmentMode: mode, maximumPoints: parsePoints(state.maximumPoints), explanation: state.explanation };
    if (state.type === "MULTIPLE_CHOICE") {
      const correctIndex = state.options.findIndex((option) => option.key === state.correctOptionKey);
      return { ...objective, options: state.options.map((option) => ({ text: option.text })), correctOptionIndex: correctIndex === -1 ? null : correctIndex };
    }
    return { ...objective, acceptedAnswers: lines(state.acceptedAnswersText) };
  }
  const rubric = state.rubric.map((criterion) => {
    const points = parsePoints(criterion.indicativePoints);
    return Number.isNaN(points)
      ? { id: criterion.id, description: criterion.description }
      : { id: criterion.id, description: criterion.description, indicativePoints: points };
  });
  return { ...common, assessmentMode: mode, referenceGuidance: state.referenceGuidance, rubric: rubric.length ? rubric : null };
}

/**
 * Publication checks report problem codes instead of field names. This maps each
 * form field to the server keys whose messages belong under it.
 */
export const questionFieldKeys: Record<string, readonly string[]> = {
  prompt: ["prompt", "prompt-missing"],
  maximumPoints: ["maximumPoints"],
  explanation: ["explanation", "explanation-missing"],
  options: ["options", "correctOptionIndex", "multiple-choice-needs-two-options", "multiple-choice-duplicate-options", "multiple-choice-correct-option-missing"],
  acceptedAnswers: ["acceptedAnswers", "short-response-needs-accepted-answers", "short-response-blank-accepted-answer"],
  referenceGuidance: ["referenceGuidance", "guidance-missing"],
  rubric: ["rubric", "rubric-malformed"],
  topicIds: ["topicIds", "topic-link-missing"],
  workIds: ["workIds"],
  provenance: ["provenance", "source-missing", "editor-missing", "attribution-missing", "review-missing"],
};
