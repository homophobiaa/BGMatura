import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

type AuthorDatabase = Pick<Prisma.TransactionClient, "author">;

/** A draft never resolves through the public reading boundary. No admin writes are exposed here. */
export function findPublishedAuthorBySlug(slug: string, database: AuthorDatabase = getDatabase()) {
  return database.author.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, name: true, slug: true, context: true },
  });
}
