import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { checkDraftVersion, draftIdentity, editorialMutation, editorialSlug, editorialTitle, parseEditorialInput } from "@/server/editorial";

const authorDraftSchema = z.strictObject({
  ...draftIdentity, name: editorialTitle, slug: editorialSlug,
  context: z.string().max(20000).nullable().default(null),
});

export function saveAuthorDraft(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { id, expectedUpdatedAt, ...data } = parseEditorialInput(authorDraftSchema, input);
    if (!id) return transaction.author.create({ data });
    const previous = await transaction.author.findUniqueOrThrow({ where: { id } });
    checkDraftVersion(previous, expectedUpdatedAt);
    return transaction.author.update({ where: { id }, data });
  }, database);
}
