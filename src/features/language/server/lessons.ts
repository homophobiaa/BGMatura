import "server-only";

import { learningContentSchema } from "@/features/learning/content";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";
import { listPublishedLanguageTopics } from "./published-lessons";

type LessonDatabase = Pick<Prisma.TransactionClient, "lesson" | "topic">;

/** No draft lesson/topic or malformed stored document crosses the public boundary. */
export async function findPublishedLessonBySlug(slug: string, database: LessonDatabase = getDatabase()) {
  const lesson = await database.lesson.findFirst({
    where: { slug, status: "PUBLISHED", topic: { status: "PUBLISHED" } },
    select: {
      id: true, title: true, slug: true, content: true,
      topic: { select: { id: true, title: true, slug: true } },
    },
  });
  if (lesson === null) return null;

  const content = learningContentSchema.safeParse(lesson.content);
  if (!content.success || content.data.blocks.length === 0) return null;
  const topics = await listPublishedLanguageTopics(database);
  if (!topics.some((topic) => topic.id === lesson.topic.id)) return null;

  return { ...lesson, content: content.data };
}
