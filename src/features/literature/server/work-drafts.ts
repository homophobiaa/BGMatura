import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { checkDraftVersion, draftIdentity, EditorialError, editorialId, editorialMutation, editorialSlug, editorialTitle, parseEditorialInput } from "@/server/editorial";

const studyText = z.string().max(20000).nullable().default(null);
const studyList = z.array(z.string().trim().min(1).max(10000)).max(100).default([]);
const workDraftSchema = z.strictObject({
  ...draftIdentity, title: editorialTitle, slug: editorialSlug, authorId: editorialId,
  genre: z.string().max(200).nullable().default(null), summary: studyText,
  themes: studyList, characters: studyList, importantIdeas: studyList, interpretation: studyText,
});

export function saveWorkDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { id, expectedUpdatedAt, ...data } = parseEditorialInput(workDraftSchema, input);
    if (!await transaction.author.findUnique({ where: { id: data.authorId }, select: { id: true } })) {
      throw new EditorialError("invalid", "Choose an existing author.", { authorId: ["The author does not exist."] });
    }
    if (!id) return transaction.work.create({ data });
    const previous = await transaction.work.findUniqueOrThrow({ where: { id } });
    checkDraftVersion(previous, expectedUpdatedAt);
    return transaction.work.update({ where: { id }, data });
  }, database);
}
