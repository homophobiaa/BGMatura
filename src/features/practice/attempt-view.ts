import { z } from "zod";
import { evaluationSchema } from "@/features/questions/evaluation";

/**
 * What the browser receives from GET /api/attempts/{id} for a practice session.
 * The server decides what is visible; this schema only checks the shape it promised.
 * Feedback appears for a question only after the server has accepted its answer.
 */
const questionSchema = z.discriminatedUnion("type", [
  z.object({ id: z.uuid(), type: z.literal("multiple-choice"), prompt: z.string(), options: z.array(z.object({ id: z.uuid(), text: z.string() })) }),
  z.object({ id: z.uuid(), type: z.literal("short-response"), prompt: z.string() }),
  z.object({ id: z.uuid(), type: z.literal("extended-response"), prompt: z.string() }),
  z.object({ id: z.uuid(), type: z.literal("argumentative-writing"), prompt: z.string() }),
]);

export const submittedAnswerSchema = z.discriminatedUnion("type", [
  z.object({ questionId: z.uuid(), type: z.literal("multiple-choice"), selectedOptionId: z.uuid().nullable() }),
  z.object({ questionId: z.uuid(), type: z.literal("short-response"), text: z.string() }),
  z.object({ questionId: z.uuid(), type: z.literal("extended-response"), text: z.string() }),
  z.object({ questionId: z.uuid(), type: z.literal("argumentative-writing"), text: z.string() }),
]);

const feedbackSchema = z.union([
  z.object({ explanation: z.string(), correctOptionId: z.uuid().optional(), acceptedAnswers: z.array(z.string()).optional() }),
  z.object({
    referenceGuidance: z.string(),
    rubric: z.array(z.object({ id: z.string(), description: z.string(), indicativePoints: z.number().optional() })),
  }),
]);

export const attemptQuestionSchema = z.object({
  question: questionSchema,
  position: z.number().int().nonnegative(),
  answer: submittedAnswerSchema.nullable(),
  revision: z.number().int().nonnegative(),
  evaluation: evaluationSchema.nullable().optional(),
  correct: z.boolean().nullable().optional(),
  feedback: feedbackSchema.optional(),
});

export const attemptResultSchema = z.object({
  answered: z.number(), unanswered: z.number(), correct: z.number(), incorrect: z.number(),
  ungraded: z.number(), selfReview: z.number(), earnedPoints: z.number(), objectiveMaximumPoints: z.number(),
});

export const attemptViewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  mode: z.enum(["PRACTICE", "EXAM"]),
  state: z.enum(["ACTIVE", "SUBMITTED", "EXPIRED"]),
  position: z.number().int().nonnegative(),
  questions: z.array(attemptQuestionSchema),
  result: attemptResultSchema.nullable(),
});

export type AttemptView = z.infer<typeof attemptViewSchema>;
export type AttemptQuestionView = z.infer<typeof attemptQuestionSchema>;
export type AttemptResultView = z.infer<typeof attemptResultSchema>;
export type QuestionFeedbackView = z.infer<typeof feedbackSchema>;

/** Objective feedback carries an explanation; written feedback carries guidance for self-review. */
export function isWrittenFeedback(feedback: QuestionFeedbackView): feedback is Extract<QuestionFeedbackView, { referenceGuidance: string }> {
  return "referenceGuidance" in feedback;
}

/** A question's outcome in plain terms, used for labels and the summary list. */
export function questionOutcome(question: AttemptQuestionView): "unanswered" | "correct" | "incorrect" | "self-review" | "ungraded" {
  if (question.answer === null || !question.evaluation) return "unanswered";
  if (question.evaluation.status === "self-review") return "self-review";
  if (question.evaluation.status === "ungraded") return "ungraded";
  return question.correct ? "correct" : "incorrect";
}

export const outcomeLabels = {
  unanswered: "Без отговор",
  correct: "Верен отговор",
  incorrect: "Грешен отговор",
  "self-review": "За самооценка",
  ungraded: "Без автоматична оценка",
} as const;

export function formatPoints(value: number): string {
  return value.toLocaleString("bg-BG", { maximumFractionDigits: 2 });
}
