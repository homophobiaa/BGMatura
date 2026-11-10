import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { publishedTopicIds } from "@/features/topics/server/visibility";
import { getDatabase } from "@/server/database";
import { checkExamAvailability, examWithQuestions, type ExamWithQuestions } from "./availability";

type CatalogDatabase = Pick<Prisma.TransactionClient, "exam" | "topic">;
const pageSize = 20;

function projectExam(exam: ExamWithQuestions, topics: ReadonlySet<string>) {
  const availability = checkExamAvailability(exam, topics);
  const { configuration, totals } = availability;
  if (!configuration || !totals || Object.keys(availability.problems).length) return null;

  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    classification: exam.classification,
    attribution: exam.attribution,
    targetYear: configuration.targetYear,
    session: configuration.session,
    configurationVersion: configuration.version,
    verification: configuration.verification,
    sources: configuration.blueprint.sources,
    checkedOn: configuration.blueprint.checkedOn,
    durationMinutes: totals.durationMinutes,
    questionCount: totals.taskCount,
    objectiveMaximumPoints: availability.objectiveMaximumPoints,
    writtenCount: availability.writtenCount,
  };
}

export async function listPublicExams(after?: string, database: CatalogDatabase = getDatabase()) {
  const exams = await database.exam.findMany({
    where: { status: "PUBLISHED", ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: "asc" },
    take: pageSize + 1,
    include: examWithQuestions,
  });
  const topics = await publishedTopicIds(database);
  const page = exams.slice(0, pageSize);
  return {
    exams: page.flatMap((exam) => projectExam(exam, topics) ?? []),
    next: exams.length > pageSize ? page.at(-1)?.id ?? null : null,
  };
}

export async function findPublicExam(id: string, database: CatalogDatabase = getDatabase()) {
  const exam = await database.exam.findUnique({ where: { id, status: "PUBLISHED" }, include: examWithQuestions });
  return exam ? projectExam(exam, await publishedTopicIds(database)) : null;
}
