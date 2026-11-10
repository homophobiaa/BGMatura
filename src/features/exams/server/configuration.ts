import "server-only";

import { z } from "zod";
import { ExamVerification, QuestionType, type PrismaClient } from "@/generated/prisma/client";
import { editorialMutation, parseEditorialInput } from "@/server/editorial";

export const examQuestionLimit = 100;

/** Use hundredths when comparing or adding decimal allocations. */
export function pointUnits(points: number): number {
  return Math.round(points * 100);
}

export const examPoints = z.number().nonnegative().max(9999.99)
  .refine((value) => value === pointUnits(value) / 100, "Use at most two decimal places.");

const source = z.url({ protocol: /^https$/ }).max(2048).refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return !url.username && !url.password;
}, "Use a public HTTPS source URL.");

const blueprintSchema = z.strictObject({
  formatVersion: z.literal(1),
  sections: z.array(z.strictObject({
    durationMinutes: z.number().int().min(1).max(1440),
    tasks: z.array(z.strictObject({
      type: z.enum(QuestionType),
      count: z.number().int().min(1).max(examQuestionLimit),
      points: examPoints,
    })).min(1).max(examQuestionLimit),
  })).min(1).max(10),
  sources: z.array(source).max(10),
  checkedOn: z.iso.date().nullable(),
  reviewer: z.string().trim().min(1).max(200).nullable(),
  gaps: z.array(z.string().trim().min(1).max(1000)).max(20),
  passingPoints: examPoints.nullable(),
}).superRefine((blueprint, context) => {
  const { durationMinutes, taskCount, maximumPoints } = blueprintTotals(blueprint);
  if (durationMinutes > 1440 || taskCount > examQuestionLimit) {
    context.addIssue({ code: "custom", path: ["sections"], message: "The blueprint exceeds the supported duration or task count." });
  }
  if (blueprint.passingPoints !== null && blueprint.passingPoints > maximumPoints) {
    context.addIssue({ code: "custom", path: ["passingPoints"], message: "The threshold exceeds the blueprint maximum." });
  }
});

const configurationSchema = z.strictObject({
  targetYear: z.number().int().min(2000).max(2200),
  session: z.string().trim().min(1).max(60),
  version: z.number().int().positive().max(2147483647),
  verification: z.enum(ExamVerification),
  blueprint: blueprintSchema,
}).superRefine((configuration, context) => {
  const { verification, blueprint } = configuration;
  if (verification !== "UNVERIFIED" && (!blueprint.sources.length || !blueprint.checkedOn || !blueprint.reviewer)) {
    context.addIssue({ code: "custom", path: ["blueprint"], message: "Add a source, reviewer, and verification date." });
  }
  if (verification === "VERIFIED" && blueprint.gaps.length) {
    context.addIssue({ code: "custom", path: ["blueprint", "gaps"], message: "Resolve verification gaps before marking the blueprint verified." });
  }
});

type Blueprint = z.infer<typeof blueprintSchema>;

export function blueprintTotals({ sections }: Blueprint) {
  let durationMinutes = 0;
  let taskCount = 0;
  let maximumPointUnits = 0;
  for (const section of sections) {
    durationMinutes += section.durationMinutes;
    for (const task of section.tasks) {
      taskCount += task.count;
      maximumPointUnits += task.count * pointUnits(task.points);
    }
  }
  return { durationMinutes, taskCount, maximumPoints: maximumPointUnits / 100 };
}

export function parseExamConfiguration(input: unknown) {
  return configurationSchema.safeParse(input);
}

export function createExamConfiguration(input: unknown, headers: Headers, database?: PrismaClient) {
  return editorialMutation(headers, (transaction) =>
    transaction.examConfiguration.create({ data: parseEditorialInput(configurationSchema, input) }), database);
}
