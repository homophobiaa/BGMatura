import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { checkDraftVersion, draftIdentity, EditorialError, editorialId, editorialMutation, editorialSlug, editorialTitle, parseEditorialInput } from "@/server/editorial";

const topicDraftSchema = z.strictObject({
  ...draftIdentity, title: editorialTitle, slug: editorialSlug,
  subject: z.enum(["BULGARIAN_LANGUAGE", "LITERATURE"]),
  parentId: editorialId.nullable().default(null), position: z.number().int().min(0).max(10000).default(0),
});

export function saveTopicDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { id, expectedUpdatedAt, ...data } = parseEditorialInput(topicDraftSchema, input);
    if (id) {
      const previous = await transaction.topic.findUniqueOrThrow({ where: { id } });
      checkDraftVersion(previous, expectedUpdatedAt);
      if (previous.subject !== data.subject && (
        await transaction.topic.count({ where: { parentId: id } }) > 0 ||
        await transaction.lesson.count({ where: { topicId: id } }) > 0 ||
        await transaction.questionTopic.count({ where: { topicId: id } }) > 0
      )) throw new EditorialError("linked", "Unlink dependent records before changing this topic's subject.");
    }
    let parentId = data.parentId;
    const visited = new Set<string>();
    while (parentId) {
      if (parentId === id || visited.has(parentId)) throw new EditorialError("invalid", "A topic cannot become its own ancestor.", { parentId: ["Choose a parent outside this topic's descendants."] });
      visited.add(parentId);
      const parent = await transaction.topic.findUnique({ where: { id: parentId }, select: { parentId: true, subject: true } });
      if (!parent || parent.subject !== data.subject) throw new EditorialError("invalid", "Choose an existing parent of the same subject.", { parentId: ["Invalid parent topic."] });
      parentId = parent.parentId;
    }
    return id ? transaction.topic.update({ where: { id }, data }) : transaction.topic.create({ data });
  }, database);
}
