import "server-only";

import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { checkExamAvailability, examWithQuestions } from "@/features/exams/server/availability";
import { captureQuestionSnapshots, readQuestionSnapshot } from "@/features/questions/server/question-snapshots";
import { publishedTopicIds } from "@/features/topics/server/visibility";
import { getDatabase } from "@/server/database";
import { AttemptError, parseAttemptInput } from "./errors";
import { accessLifetimeSeconds, createOwnerToken, databaseClock, ownerDigest, startTransaction } from "./persistence";

const practiceQuestionLimit = 10;
const practiceStartSchema = z.strictObject({ topicId: z.uuid() });
const examStartSchema = z.strictObject({ examId: z.uuid() });

type SelectedQuestion = { questionId: string; allocation?: number };

async function captureOrderedQuestions(transaction: Prisma.TransactionClient, questions: readonly SelectedQuestion[]) {
  const snapshots = await captureQuestionSnapshots(questions.map(({ questionId }) => questionId), transaction);
  return snapshots.map((snapshot, position): Prisma.AttemptQuestionCreateManyAttemptInput => {
    const { definition } = readQuestionSnapshot(snapshot);
    const allocation = questions[position]?.allocation;
    const points = definition.assessment.mode === "objective" ? allocation ?? definition.assessment.maximumPoints : null;
    return { questionId: snapshot.questionId, snapshotId: snapshot.id, position, points };
  });
}

export function startPractice(input: unknown, database: PrismaClient = getDatabase()) {
  const { topicId } = parseAttemptInput(practiceStartSchema, input);
  const token = createOwnerToken();
  return startTransaction(database, async (transaction) => {
    if (!(await publishedTopicIds(transaction)).has(topicId)) throw new AttemptError("not-found");
    const topic = await transaction.topic.findUniqueOrThrow({ where: { id: topicId }, select: { title: true } });
    const questions = await transaction.question.findMany({
      where: {
        status: "PUBLISHED",
        topics: { some: { topicId } },
        works: { none: { work: { OR: [{ status: "DRAFT" }, { author: { status: "DRAFT" } }] } } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: practiceQuestionLimit,
      select: { id: true },
    });
    if (questions.length === 0) throw new AttemptError("no-questions");
    const captured = await captureOrderedQuestions(transaction, questions.map(({ id }) => ({ questionId: id })));
    const startedAt = await databaseClock(transaction);
    const accessUntil = new Date(startedAt.getTime() + accessLifetimeSeconds * 1000);
    const attempt = await transaction.attempt.create({
      data: {
        mode: "PRACTICE", title: topic.title, topicId, ownerDigest: ownerDigest(token),
        startedAt, accessUntil, questions: { createMany: { data: captured } },
      },
      select: { id: true, accessUntil: true },
    });
    return { ...attempt, token };
  });
}

export function startExam(input: unknown, database: PrismaClient = getDatabase()) {
  const { examId } = parseAttemptInput(examStartSchema, input);
  const token = createOwnerToken();
  return startTransaction(database, async (transaction) => {
    const exam = await transaction.exam.findUnique({ where: { id: examId, status: "PUBLISHED" }, include: examWithQuestions });
    if (!exam) throw new AttemptError("not-found");
    const { problems, totals } = checkExamAvailability(exam, await publishedTopicIds(transaction));
    if (!totals || Object.keys(problems).length) throw new AttemptError("not-found");
    const captured = await captureOrderedQuestions(transaction, exam.questions.map(({ questionId, points }) => ({
      questionId, allocation: points.toNumber(),
    })));
    const startedAt = await databaseClock(transaction);
    const accessUntil = new Date(startedAt.getTime() + accessLifetimeSeconds * 1000);
    const deadline = new Date(startedAt.getTime() + totals.durationMinutes * 60_000);
    const attempt = await transaction.attempt.create({
      data: {
        mode: "EXAM", title: exam.title, examId, configurationId: exam.configurationId,
        ownerDigest: ownerDigest(token), startedAt, deadline, accessUntil,
        questions: { createMany: { data: captured } },
      },
      select: { id: true, accessUntil: true },
    });
    return { ...attempt, token };
  });
}
