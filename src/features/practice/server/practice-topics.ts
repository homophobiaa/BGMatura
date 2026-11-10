import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { practiceQuestionWhere } from "@/features/attempts/server/start";
import { publishedTopicIds } from "@/features/topics/server/visibility";
import { getDatabase } from "@/server/database";

export type PracticeTopic = {
  id: string;
  title: string;
  subject: "BULGARIAN_LANGUAGE" | "LITERATURE";
  questionCount: number;
  /** Published lessons on the topic, for "learn first" links. */
  lessons: { title: string; slug: string }[];
};

/** At most this many questions are used per session; see startPractice. */
export const practiceSessionSize = 10;

async function countPracticeQuestions(database: PrismaClient, topicIds: readonly string[]) {
  const counts = new Map<string, number>();
  for (const topicId of topicIds) {
    const count = await database.question.count({ where: practiceQuestionWhere(topicId) });
    if (count > 0) counts.set(topicId, count);
  }
  return counts;
}

/** Public topics a visitor can practice now, with their lessons. Topics without questions are left out. */
export async function listPracticeTopics(database: PrismaClient = getDatabase()): Promise<PracticeTopic[]> {
  const visible = await publishedTopicIds(database);
  const candidates = await database.topic.findMany({
    where: { id: { in: [...visible] }, questions: { some: {} } },
    orderBy: [{ subject: "asc" }, { position: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true, title: true, subject: true,
      lessons: { where: { status: "PUBLISHED" }, orderBy: [{ title: "asc" }, { id: "asc" }], select: { title: true, slug: true } },
    },
  });
  const counts = await countPracticeQuestions(database, candidates.map(({ id }) => id));
  return candidates.flatMap((topic) => {
    const questionCount = counts.get(topic.id);
    return questionCount ? [{ ...topic, questionCount }] : [];
  });
}

/** One public practice topic, or null when it is hidden or has no usable questions. */
export async function findPracticeTopic(topicId: string, database: PrismaClient = getDatabase()): Promise<PracticeTopic | null> {
  const topics = await listPracticeTopics(database);
  return topics.find((topic) => topic.id === topicId) ?? null;
}

/** Practice topics whose questions are about this work, for the work page. */
export async function listPracticeTopicsForWork(workId: string, database: PrismaClient = getDatabase()): Promise<PracticeTopic[]> {
  const linked = await database.questionTopic.findMany({
    where: { question: { status: "PUBLISHED", works: { some: { workId } } } },
    select: { topicId: true },
    distinct: ["topicId"],
  });
  const linkedIds = new Set(linked.map(({ topicId }) => topicId));
  return (await listPracticeTopics(database)).filter((topic) => linkedIds.has(topic.id));
}

/** Published lessons of a visible topic. Used beside a practice session even after the topic stops offering practice. */
export async function listTopicLessons(topicId: string, database: PrismaClient = getDatabase()): Promise<{ title: string; slug: string }[]> {
  if (!(await publishedTopicIds(database)).has(topicId)) return [];
  return database.lesson.findMany({ where: { topicId, status: "PUBLISHED" }, orderBy: [{ title: "asc" }, { id: "asc" }], select: { title: true, slug: true } });
}
