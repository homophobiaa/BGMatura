import "server-only";

import { z } from "zod";
import { QuestionOrigin, type PrismaClient } from "@/generated/prisma/client";
import { requireAdmin } from "@/features/admin/server/authorization";
import { publishedTopicIds } from "@/features/topics/server/visibility";
import { getDatabase } from "@/server/database";
import { checkDraftVersion, draftIdentity, EditorialError, editorialId, editorialMutation, editorialTitle, parseEditorialInput } from "@/server/editorial";
import { checkExamAvailability, examWithQuestions } from "./availability";
import { examPoints, examQuestionLimit } from "./configuration";

const draftSchema = z.strictObject({
  ...draftIdentity,
  title: editorialTitle,
  description: z.string().trim().max(4000).default(""),
  classification: z.enum(QuestionOrigin).default("ORIGINAL"),
  attribution: z.string().trim().min(1).max(1000).nullable().default(null),
  configurationId: editorialId,
  questions: z.array(z.strictObject({ questionId: editorialId, points: examPoints })).max(examQuestionLimit).default([]),
});

const examEditorialView = {
  id: true, title: true, description: true, classification: true, attribution: true,
  status: true, configurationId: true, updatedAt: true,
  questions: { orderBy: { position: "asc" }, select: { questionId: true, points: true, position: true } },
} as const;

export function saveExamDraft(input: unknown, headers: Headers, database?: PrismaClient) {
  return editorialMutation(headers, async (transaction) => {
    const { id, expectedUpdatedAt, questions, ...fields } = parseEditorialInput(draftSchema, input);
    if (id) checkDraftVersion(await transaction.exam.findUniqueOrThrow({ where: { id } }), expectedUpdatedAt);

    const ids = questions.map(({ questionId }) => questionId);
    if (new Set(ids).size !== ids.length || await transaction.question.count({ where: { id: { in: ids } } }) !== ids.length) {
      throw new EditorialError("invalid", "Use distinct existing bank questions.", { questions: ["A question is missing or duplicated."] });
    }
    if (!await transaction.examConfiguration.findUnique({ where: { id: fields.configurationId }, select: { id: true } })) {
      throw new EditorialError("invalid", "Select an existing exam configuration.", { configurationId: ["Configuration not found."] });
    }
    const orderedQuestions = questions.map((question, position) => ({ ...question, position }));
    if (id) {
      await transaction.examQuestion.deleteMany({ where: { examId: id } });
      return transaction.exam.update({
        where: { id },
        data: { ...fields, questions: { createMany: { data: orderedQuestions } } },
        select: examEditorialView,
      });
    }
    return transaction.exam.create({
      data: { ...fields, questions: { createMany: { data: orderedQuestions } } },
      select: examEditorialView,
    });
  }, database);
}

export async function readExamDraft(id: string, headers: Headers, database?: PrismaClient) {
  await requireAdmin(headers);
  return (database ?? getDatabase()).exam.findUniqueOrThrow({
    where: { id: parseEditorialInput(editorialId, id) },
    select: examEditorialView,
  });
}

const publicationSchema = z.strictObject({ id: editorialId, publish: z.boolean() });

export function setExamPublication(input: unknown, headers: Headers, database?: PrismaClient) {
  return editorialMutation(headers, async (transaction) => {
    const { id, publish } = parseEditorialInput(publicationSchema, input);
    if (publish) {
      const exam = await transaction.exam.findUniqueOrThrow({ where: { id }, include: examWithQuestions });
      const { problems } = checkExamAvailability(exam, await publishedTopicIds(transaction));
      if (Object.keys(problems).length) {
        throw new EditorialError("invalid", "Complete the exam and resolve blueprint violations before publishing.", problems);
      }
    }
    return transaction.exam.update({
      where: { id }, data: { status: publish ? "PUBLISHED" : "DRAFT" }, select: examEditorialView,
    });
  }, database);
}
