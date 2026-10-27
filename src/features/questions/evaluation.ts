import { z } from "zod";

const scoredEvaluationSchema = z
  .strictObject({
    status: z.literal("scored"),
    earnedPoints: z.number().nonnegative(),
    maximumPoints: z.number().nonnegative(),
  })
  .refine((evaluation) => evaluation.earnedPoints <= evaluation.maximumPoints, {
    message: "Earned points must not exceed the scored maximum",
    path: ["earnedPoints"],
  });

/** This validates an evaluation's shape; it does not calculate a grade. */
export const evaluationSchema = z.discriminatedUnion("status", [
  scoredEvaluationSchema,
  z.strictObject({
    status: z.literal("ungraded"),
    reason: z.enum(["not-auto-gradable", "answer-rules-unavailable"]),
  }),
  z.strictObject({
    status: z.literal("self-review"),
  }),
]);

export type Evaluation = z.infer<typeof evaluationSchema>;
