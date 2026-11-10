import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { PracticeSession } from "@/features/practice/components/practice-session";
import { listTopicLessons } from "@/features/practice/server/practice-topics";

export const metadata: Metadata = { title: "Упражнение — BG Matura", robots: { index: false, follow: false } };

/**
 * The attempt itself is read in the browser: its access cookie is scoped to the attempt API,
 * so this server page never sees answers. It only adds public lesson links for the topic.
 */
export default async function PracticeSessionPage({ params }: { params: Promise<{ topicId: string; attemptId: string }> }) {
  await connection();
  const { topicId, attemptId } = await params;
  if (!z.uuid().safeParse(topicId).success || !z.uuid().safeParse(attemptId).success) notFound();
  const lessons = await listTopicLessons(topicId);
  return <PracticeSession attemptId={attemptId} topicId={topicId} lessons={lessons} />;
}
