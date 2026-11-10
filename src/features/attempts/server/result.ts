import "server-only";

import { z } from "zod";
import { evaluationSchema } from "@/features/questions/evaluation";
import { pointUnits } from "@/features/exams/server/configuration";

const count = z.number().int().nonnegative();
export const attemptResultSchema = z.strictObject({
  answered: count, unanswered: count, correct: count, incorrect: count,
  ungraded: count, selfReview: count,
  earnedPoints: z.number().nonnegative(),
  objectiveMaximumPoints: z.number().nonnegative(),
  scoringBasis: z.literal("objective-only"),
});

type ResultQuestion = {
  answer: unknown;
  evaluation: unknown;
  correct: boolean | null;
  points: { toNumber(): number } | null;
};

export function summarizeAttempt(questions: readonly ResultQuestion[]) {
  let answered = 0;
  let correct = 0;
  let incorrect = 0;
  let selfReview = 0;
  let ungraded = 0;
  let earnedUnits = 0;
  let maximumUnits = 0;
  for (const question of questions) {
    if (question.answer === null) {
      maximumUnits += pointUnits(question.points?.toNumber() ?? 0);
      continue;
    }
    answered++;
    const evaluation = evaluationSchema.parse(question.evaluation);
    if (evaluation.status === "self-review") selfReview++;
    else if (evaluation.status === "ungraded") ungraded++;
    else {
      if (question.correct === null) throw new Error("Missing objective correctness");
      if (question.correct) correct++;
      else incorrect++;
      earnedUnits += pointUnits(evaluation.earnedPoints);
      maximumUnits += pointUnits(evaluation.maximumPoints);
    }
  }
  return {
    answered, unanswered: questions.length - answered, correct, incorrect, selfReview, ungraded,
    earnedPoints: earnedUnits / 100, objectiveMaximumPoints: maximumUnits / 100,
    scoringBasis: "objective-only" as const,
  };
}
