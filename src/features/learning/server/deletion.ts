import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { EditorialError, editorialId, editorialMutation, parseEditorialInput } from "@/server/editorial";
import { learningKindSchema, type LearningKind } from "./publication";

const deletionSchema = z.strictObject({ kind: learningKindSchema, id: editorialId, confirmation: z.string().min(1).max(200) });

async function loadDeletionCandidate(transaction: Prisma.TransactionClient, kind: LearningKind, id: string) {
  switch (kind) {
    case "author": return { record: await transaction.author.findUniqueOrThrow({ where: { id } }), linked: await transaction.work.count({ where: { authorId: id } }) };
    case "work": return { record: await transaction.work.findUniqueOrThrow({ where: { id } }), linked: await transaction.questionWork.count({ where: { workId: id } }) };
    case "topic": {
      const record = await transaction.topic.findUniqueOrThrow({ where: { id } });
      const children = await transaction.topic.count({ where: { parentId: id } });
      const lessons = await transaction.lesson.count({ where: { topicId: id } });
      const questions = await transaction.questionTopic.count({ where: { topicId: id } });
      return { record, linked: children + lessons + questions };
    }
    case "lesson": return { record: await transaction.lesson.findUniqueOrThrow({ where: { id } }), linked: 0 };
  }
}

export function deleteLearningDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { kind, id, confirmation } = parseEditorialInput(deletionSchema, input);
    const { record, linked } = await loadDeletionCandidate(transaction, kind, id);
    if (record.status !== "DRAFT") throw new EditorialError("unpublish-required", "Unpublish this record instead of deleting published content.");
    if (confirmation !== record.slug) throw new EditorialError("invalid", "Confirm deletion by entering the current slug.", { confirmation: ["The confirmation does not match."] });
    if (linked > 0) throw new EditorialError("linked", "This record is linked to other content. Keep it unpublished, or unlink those records first.");
    switch (kind) {
      case "author": await transaction.author.delete({ where: { id } }); break;
      case "work": await transaction.work.delete({ where: { id } }); break;
      case "topic": await transaction.topic.delete({ where: { id } }); break;
      case "lesson": await transaction.lesson.delete({ where: { id } }); break;
    }
    return { id, slug: record.slug, deleted: true };
  }, database);
}
