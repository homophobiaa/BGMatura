import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { requirePublishedTopicAncestry } from "@/features/learning/server/publication";
import { EditorialError, editorialId, editorialMutation, parseEditorialInput } from "@/server/editorial";
import { publishQuestion, QuestionNotReadyToPublishError } from "./question-publication";
import { toQuestionDefinition } from "./question-definitions";

const schema = z.strictObject({ id: editorialId, publish: z.boolean() });

export function setQuestionPublication(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { id, publish } = parseEditorialInput(schema, input);
    const question = await transaction.question.findUniqueOrThrow({ where: { id }, include: { options: true, topics: true, works: { include: { work: { include: { author: true } } } } } });
    if (!publish) return transaction.question.update({ where: { id }, data: { status: "DRAFT" }, select: { id: true, status: true, updatedAt: true } });
    for (const link of question.topics) await requirePublishedTopicAncestry(transaction, link.topicId);
    if (question.works.some(({ work }) => work.status !== "PUBLISHED" || work.author.status !== "PUBLISHED")) {
      throw new EditorialError("invalid", "Publish linked works and their authors first.", { workIds: ["A linked work or author is unpublished."] });
    }
    try { await publishQuestion(id, transaction); }
    catch (error) {
      if (!(error instanceof QuestionNotReadyToPublishError)) throw error;
      const fields = Object.fromEntries(error.problems.map((problem) => [problem.code, [problem.message]]));
      throw new EditorialError("invalid", "Complete and review this question before publication.", fields);
    }
    toQuestionDefinition(question);
    return transaction.question.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, updatedAt: true } });
  }, database);
}
