import "server-only";

import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { evaluationSchema, type Evaluation } from "@/features/questions/evaluation";
import { toPublicQuestion } from "@/features/questions/server/public-questions";
import { readQuestionSnapshot } from "@/features/questions/server/question-snapshots";
import { answerSchema, evaluateAnswer, questionFeedback, sameAnswer, validateAnswer } from "./answers";
import { hasExpired, remainingSeconds } from "./deadline";
import { AttemptError, parseAttemptInput } from "./errors";
import { withOwnedAttempt, type AttemptAccess, type CapturedAttempt, type CapturedQuestion } from "./persistence";
import { attemptResultSchema, summarizeAttempt } from "./result";

const positionSchema = z.number().int().nonnegative().max(2147483647);
const saveSchema = z.strictObject({ answer: answerSchema, expectedRevision: positionSchema });
const navigationSchema = z.strictObject({ position: positionSchema, expectedPosition: positionSchema });

function projectQuestion(question: CapturedQuestion, showFeedback: boolean, revealUnanswered: boolean) {
  const { definition } = readQuestionSnapshot(question.snapshot);
  return {
    question: toPublicQuestion(definition),
    position: question.position,
    answer: question.answer === null ? null : answerSchema.parse(question.answer),
    revision: question.revision,
    savedAt: question.savedAt,
    ...(showFeedback && (question.answer !== null || revealUnanswered) ? {
      evaluation: question.evaluation === null ? null : evaluationSchema.parse(question.evaluation),
      correct: question.correct,
      feedback: questionFeedback(definition),
    } : {}),
  };
}

function projectAttempt(attempt: CapturedAttempt, now: Date) {
  const final = attempt.state !== "ACTIVE";
  return {
    id: attempt.id,
    title: attempt.title,
    mode: attempt.mode,
    state: attempt.state,
    startedAt: attempt.startedAt,
    deadline: attempt.deadline,
    completedAt: attempt.completedAt,
    serverNow: now,
    remainingSeconds: final && attempt.deadline !== null ? 0 : remainingSeconds(attempt.deadline, now),
    position: attempt.position,
    configuration: attempt.configuration,
    questions: attempt.questions.map((question) => projectQuestion(question, attempt.mode === "PRACTICE" || final, final && attempt.mode === "EXAM")),
    result: attempt.result === null ? null : attemptResultSchema.parse(attempt.result),
  };
}

function requireActive(attempt: CapturedAttempt, now: Date) {
  if (attempt.state !== "ACTIVE" || hasExpired(attempt.deadline, now)) throw new AttemptError("closed");
}

export function saveAttemptAnswer(access: AttemptAccess, input: unknown, database?: PrismaClient) {
  return withOwnedAttempt(access, async (transaction, attempt, now) => {
    requireActive(attempt, now);
    const { answer: incoming, expectedRevision } = parseAttemptInput(saveSchema, input);
    const question = attempt.questions.find(({ questionId }) => questionId === incoming.questionId);
    if (!question) throw new AttemptError("invalid");
    const { definition } = readQuestionSnapshot(question.snapshot);
    const answer = validateAnswer(definition, incoming);
    const previous = question.answer === null ? null : answerSchema.parse(question.answer);
    const practice = attempt.mode === "PRACTICE";
    if (practice && !answer) throw new AttemptError("invalid");

    // A repeated request after a lost response may acknowledge the same saved value,
    // even if its revision is stale. It can never overwrite a different value.
    if (expectedRevision <= question.revision && sameAnswer(previous, answer)) {
      return projectQuestion(question, practice, false);
    }
    if (expectedRevision !== question.revision || (practice && previous !== null)) throw new AttemptError("conflict");

    const evaluation = practice && answer ? evaluateAnswer(definition, answer, question.points?.toNumber() ?? null) : null;
    const updated = await transaction.attemptQuestion.update({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.questionId } },
      data: {
        answer: answer ?? Prisma.DbNull,
        evaluation: evaluation?.evaluation ?? Prisma.DbNull,
        correct: evaluation?.correct ?? null,
        savedAt: now,
        revision: { increment: 1 },
      },
      include: { snapshot: true },
    });
    return projectQuestion(updated, practice, false);
  }, database);
}

export function saveAttemptPosition(access: AttemptAccess, input: unknown, database?: PrismaClient) {
  return withOwnedAttempt(access, async (transaction, attempt, now) => {
    requireActive(attempt, now);
    const { position, expectedPosition } = parseAttemptInput(navigationSchema, input);
    if (position >= attempt.questions.length) throw new AttemptError("invalid");
    if (position === attempt.position) return { position };
    if (expectedPosition !== attempt.position) throw new AttemptError("conflict");
    await transaction.attempt.update({ where: { id: attempt.id }, data: { position } });
    return { position };
  }, database);
}

async function finalizeLocked(transaction: Prisma.TransactionClient, attempt: CapturedAttempt, now: Date) {
  if (attempt.state !== "ACTIVE") return attempt;
  const expired = hasExpired(attempt.deadline, now);
  const evaluations: { questionId: string; evaluation: Evaluation; correct: boolean | null }[] = [];
  const questions = attempt.questions.map((question) => {
    if (attempt.mode !== "EXAM" || question.answer === null) return question;
    const { definition } = readQuestionSnapshot(question.snapshot);
    const outcome = evaluateAnswer(definition, answerSchema.parse(question.answer), question.points?.toNumber() ?? null);
    evaluations.push({ questionId: question.questionId, ...outcome });
    return { ...question, ...outcome };
  });
  if (evaluations.length) {
    await transaction.$executeRaw`
      UPDATE "AttemptQuestion" AS question
      SET "evaluation" = grade."evaluation", "correct" = grade."correct"
      FROM jsonb_to_recordset(${JSON.stringify(evaluations)}::jsonb)
          AS grade("questionId" uuid, "evaluation" jsonb, "correct" boolean)
      WHERE question."attemptId" = ${attempt.id}::uuid AND question."questionId" = grade."questionId"
    `;
  }
  const result = summarizeAttempt(questions);
  const updated = await transaction.attempt.update({
    where: { id: attempt.id },
    data: { state: expired ? "EXPIRED" : "SUBMITTED", completedAt: expired ? attempt.deadline : now, result },
  });
  return { ...updated, questions, configuration: attempt.configuration };
}

export function readAttempt(access: AttemptAccess, database?: PrismaClient) {
  return withOwnedAttempt(access, async (transaction, attempt, now) => {
    const current = hasExpired(attempt.deadline, now) ? await finalizeLocked(transaction, attempt, now) : attempt;
    return projectAttempt(current, now);
  }, database);
}

export function finishAttempt(access: AttemptAccess, database?: PrismaClient) {
  return withOwnedAttempt(access, async (transaction, attempt, now) =>
    projectAttempt(await finalizeLocked(transaction, attempt, now), now), database);
}
