import "server-only";

import type { Prisma, Subject } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

type TopicDatabase = Pick<Prisma.TransactionClient, "topic">;

/** Administrative callers must authorize before using this internal persistence query. */
export function listTopicChildren(
  subject: Subject,
  parentId: string | null,
  database: TopicDatabase = getDatabase(),
) {
  return database.topic.findMany({
    where: { subject, parentId },
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
  });
}
