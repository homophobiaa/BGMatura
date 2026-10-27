import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

type WorkDatabase = Pick<Prisma.TransactionClient, "work">;

/**
 * A draft work never resolves through the public reading boundary, and a draft author
 * is never revealed through a published work: the author link is `null` until the
 * author is published too. No admin writes are exposed here.
 */
export async function findPublishedWorkBySlug(slug: string, database: WorkDatabase = getDatabase()) {
  const work = await database.work.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      genre: true,
      summary: true,
      themes: true,
      characters: true,
      importantIdeas: true,
      interpretation: true,
      author: { select: { name: true, slug: true, status: true } },
    },
  });

  if (work === null) {
    return null;
  }

  const { author, ...studyFields } = work;

  return {
    ...studyFields,
    author: author.status === "PUBLISHED" ? { name: author.name, slug: author.slug } : null,
  };
}
