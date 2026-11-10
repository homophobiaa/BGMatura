import "server-only";

import { z } from "zod";
import { WRITTEN_ANSWER_MAX_LENGTH } from "@/features/questions/answer-limits";
import type { Evaluation } from "@/features/questions/evaluation";
import type { QuestionDefinition } from "@/features/questions/server/contracts";
import { evaluateWrittenResponse } from "@/features/questions/server/evaluate-written-response";
import { gradeMultipleChoice } from "@/features/questions/server/grade-multiple-choice";
import { gradeShortResponse } from "@/features/questions/server/grade-short-response";
import type { SubmittedAnswer } from "@/features/questions/types";
import { AttemptError } from "./errors";

const questionId = z.uuid();
export const answerSchema = z.discriminatedUnion("type", [
  z.strictObject({ questionId, type: z.literal("multiple-choice"), selectedOptionId: z.uuid().nullable() }),
  z.strictObject({ questionId, type: z.literal("short-response"), text: z.string().max(WRITTEN_ANSWER_MAX_LENGTH["short-response"]) }),
  z.strictObject({ questionId, type: z.literal("extended-response"), text: z.string().max(WRITTEN_ANSWER_MAX_LENGTH["extended-response"]) }),
  z.strictObject({ questionId, type: z.literal("argumentative-writing"), text: z.string().max(WRITTEN_ANSWER_MAX_LENGTH["argumentative-writing"]) }),
]);

export function validateAnswer(definition: QuestionDefinition, answer: SubmittedAnswer): SubmittedAnswer | null {
  if (answer.questionId !== definition.id || answer.type !== definition.type) throw new AttemptError("invalid");
  if (answer.type === "multiple-choice") {
    if (!answer.selectedOptionId) return null;
    if (definition.type !== "multiple-choice" || !definition.options.some(({ id }) => id === answer.selectedOptionId)) {
      throw new AttemptError("invalid");
    }
  } else if (!answer.text.trim()) {
    return null;
  }
  return answer;
}

export function sameAnswer(left: SubmittedAnswer | null, right: SubmittedAnswer | null): boolean {
  if (!left || !right) return left === right;
  if (left.type !== right.type || left.questionId !== right.questionId) return false;
  if (left.type === "multiple-choice" && right.type === "multiple-choice") {
    return left.selectedOptionId === right.selectedOptionId;
  }
  return "text" in left && "text" in right && left.text === right.text;
}

function applyObjectiveAllocation(outcome: Evaluation, maximumPoints: number | null): { evaluation: Evaluation; correct: boolean | null } {
  if (maximumPoints === null) throw new Error("Missing captured objective allocation");
  if (outcome.status !== "scored") return { evaluation: outcome, correct: null };
  const correct = outcome.earnedPoints === 1;
  return {
    evaluation: { status: "scored", earnedPoints: correct ? maximumPoints : 0, maximumPoints },
    correct,
  };
}

export function evaluateAnswer(definition: QuestionDefinition, answer: SubmittedAnswer, maximumPoints: number | null) {
  // The existing objective graders are binary. Evaluate on a one-point scale so
  // correctness survives a zero-point allocation, then apply the captured weight.
  if (definition.type === "multiple-choice") {
    const outcome = gradeMultipleChoice({ ...definition, assessment: { ...definition.assessment, maximumPoints: 1 } }, answer);
    return applyObjectiveAllocation(outcome, maximumPoints);
  }
  if (definition.type === "short-response" && definition.assessment.mode === "objective") {
    const outcome = gradeShortResponse({ ...definition, assessment: { ...definition.assessment, maximumPoints: 1 } }, answer);
    return applyObjectiveAllocation(outcome, maximumPoints);
  }
  const evaluation = definition.type === "short-response"
    ? gradeShortResponse(definition, answer)
    : evaluateWrittenResponse(definition, answer).evaluation;
  return { evaluation, correct: null };
}

export function questionFeedback(definition: QuestionDefinition) {
  const { assessment } = definition;
  if (assessment.mode !== "objective") {
    return { referenceGuidance: assessment.referenceGuidance, rubric: assessment.rubric ?? [] };
  }
  return {
    explanation: assessment.explanation,
    ...("correctOptionId" in assessment ? { correctOptionId: assessment.correctOptionId } : {}),
    ...("acceptedAnswers" in assessment ? { acceptedAnswers: assessment.acceptedAnswers } : {}),
  };
}
