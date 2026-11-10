import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { LearningContent } from "@/components/learning-content";
import { readPublicLesson } from "@/features/learning/server/page-reading";
import { learningPageMetadata, missingLearningMetadata } from "@/features/learning/server/page-metadata";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StartPracticeButton } from "@/features/practice/components/start-practice-button";
import { findPracticeTopic } from "@/features/practice/server/practice-topics";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const lesson = await readPublicLesson(slug);
  return lesson ? learningPageMetadata(lesson.title, `${lesson.title}: правила, обяснения и примери по темата „${lesson.topic.title}“.`, `/balgarski-ezik/${encodeURIComponent(lesson.slug)}`) : missingLearningMetadata();
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const lesson = await readPublicLesson(slug);
  if (!lesson) notFound();
  const practice = await findPracticeTopic(lesson.topic.id);
  return <article className="max-w-reading space-y-8">
    <Breadcrumbs items={[{ label: "Български език", href: "/balgarski-ezik" }, { label: lesson.topic.title, href: `/balgarski-ezik#tema-${encodeURIComponent(lesson.topic.slug)}` }, { label: lesson.title }]} />
    <nav aria-label="Навигация на урока" className="flex flex-wrap gap-4">
      <Link href="/balgarski-ezik" className="inline-flex min-h-11 items-center text-primary underline">Всички теми</Link>
      <Link href={`/balgarski-ezik#tema-${encodeURIComponent(lesson.topic.slug)}`} className="inline-flex min-h-11 items-center text-primary underline">{lesson.topic.title}</Link>
    </nav>
    <h1>{lesson.title}</h1><LearningContent content={lesson.content} />
    {practice && <section aria-labelledby="practice-heading" className="space-y-4 rounded-lg bg-surface-soft p-4 md:p-6">
      <h2 id="practice-heading">Упражни темата</h2>
      <p>Провери знанията си с въпроси по „{practice.title}“.</p>
      <StartPracticeButton topicId={practice.id} />
    </section>}
  </article>;
}
