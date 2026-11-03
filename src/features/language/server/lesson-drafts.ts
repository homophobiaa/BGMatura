import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { learningContentSchema } from "@/features/learning/content";
import { checkDraftVersion, draftIdentity, EditorialError, editorialId, editorialMutation, editorialSlug, editorialTitle, parseEditorialInput } from "@/server/editorial";

const lessonDraftSchema = z.strictObject({
  ...draftIdentity, title: editorialTitle, slug: editorialSlug, topicId: editorialId, content: learningContentSchema,
});

export function saveLessonDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { id, expectedUpdatedAt, ...data } = parseEditorialInput(lessonDraftSchema, input);
    const topic = await transaction.topic.findUnique({ where: { id: data.topicId }, select: { subject: true } });
    if (!topic || topic.subject !== "BULGARIAN_LANGUAGE") throw new EditorialError("invalid", "Choose an existing language topic.", { topicId: ["Invalid language topic."] });
    if (!id) return transaction.lesson.create({ data });
    const previous = await transaction.lesson.findUniqueOrThrow({ where: { id } });
    checkDraftVersion(previous, expectedUpdatedAt);
    return transaction.lesson.update({ where: { id }, data });
  }, database);
}
