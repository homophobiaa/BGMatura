import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

type QuestionAssociationDatabase = Pick<Prisma.TransactionClient, "question">;

/**
 * The only provenance fields a student may see. Editor names, source references, and review
 * details are private to editors and are deliberately never selected here.
 */
export interface PublicQuestionSource {
  readonly origin: "ORIGINAL" | "ADAPTED" | "OFFICIAL";
  readonly attribution: string | null;
}

/**
 * Where a published question belongs, for public presentation. Drafts never resolve, and
 * only published topics and works are listed, so unpublished content is never revealed
 * through a published question. No admin writes are exposed here.
 */
export async function findPublishedQuestionAssociations(
  questionId: string,
  database: QuestionAssociationDatabase = getDatabase(),
) {
  const question = await database.question.findFirst({
    where: { id: questionId, status: "PUBLISHED" },
    select: {
      topics: {
        where: { topic: { status: "PUBLISHED" } },
        select: { topic: { select: { id: true, title: true, slug: true, subject: true } } },
        orderBy: [{ topic: { title: "asc" } }, { topicId: "asc" }],
      },
      works: {
        where: { work: { status: "PUBLISHED" } },
        select: { work: { select: { id: true, title: true, slug: true } } },
        orderBy: [{ work: { title: "asc" } }, { workId: "asc" }],
      },
      provenance: { select: { origin: true, attribution: true } },
    },
  });

  if (question === null) {
    return null;
  }

  return {
    topics: question.topics.map((link) => link.topic),
    works: question.works.map((link) => link.work),
    source: question.provenance satisfies PublicQuestionSource | null,
  };
}
