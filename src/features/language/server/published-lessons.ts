import "server-only";

import { learningContentSchema } from "@/features/learning/content";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";

type LanguageDatabase = Pick<Prisma.TransactionClient, "topic" | "lesson">;

/** A published child beneath a draft ancestor is still inaccessible. */
export async function listPublishedLanguageTopics(database: LanguageDatabase = getDatabase()) {
  const topics = await database.topic.findMany({
    where: { subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED" },
    select: { id: true, title: true, slug: true, parentId: true, position: true },
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
  });
  const visibleIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const topic of topics) {
      if (!visibleIds.has(topic.id) && (topic.parentId === null || visibleIds.has(topic.parentId))) {
        visibleIds.add(topic.id);
        changed = true;
      }
    }
  }
  return topics.filter((topic) => visibleIds.has(topic.id));
}

export async function getLanguageCatalog(database: LanguageDatabase = getDatabase()) {
  const topics = await listPublishedLanguageTopics(database);
  const lessons = await database.lesson.findMany({
    where: { status: "PUBLISHED", topicId: { in: topics.map((topic) => topic.id) } },
    select: { title: true, slug: true, topicId: true, content: true },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
  return {
    topics,
    lessons: lessons.filter((lesson) => {
      const parsed = learningContentSchema.safeParse(lesson.content);
      return parsed.success && parsed.data.blocks.length > 0;
    })
      .map(({ title, slug, topicId }) => ({ title, slug, topicId })),
  };
}
