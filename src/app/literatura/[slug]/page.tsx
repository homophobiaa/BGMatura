import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { LearningContent, StudyText } from "@/components/learning-content";
import { readPublicWork } from "@/features/learning/server/page-reading";
import { learningPageMetadata, missingLearningMetadata, studyDescription } from "@/features/learning/server/page-metadata";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StartPracticeButton } from "@/features/practice/components/start-practice-button";
import { listPracticeTopicsForWork } from "@/features/practice/server/practice-topics";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const work = await readPublicWork(slug);
  return work ? learningPageMetadata(work.title, studyDescription(work.summary, `Учебни материали за „${work.title}“.`), `/literatura/${encodeURIComponent(work.slug)}`) : missingLearningMetadata();
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const work = await readPublicWork(slug);
  if (!work) notFound();
  const practiceTopics = await listPracticeTopicsForWork(work.id);
  const lists = [
    { title: "Теми", items: work.themes },
    { title: "Герои", items: work.characters },
    { title: "Важни идеи", items: work.importantIdeas },
  ];
  return <article className="max-w-reading space-y-8">
    <Breadcrumbs items={[
      { label: "Литература", href: "/literatura" },
      ...(work.author ? [{ label: work.author.name, href: `/avtori/${encodeURIComponent(work.author.slug)}` }] : []),
      { label: work.title },
    ]} />
    <Link href="/literatura" className="inline-flex min-h-11 items-center text-primary underline">Към всички произведения</Link>
    <header className="space-y-3"><h1>{work.title}</h1>
      {work.author && <p><Link href={`/avtori/${encodeURIComponent(work.author.slug)}`} className="inline-flex min-h-11 items-center text-primary underline">{work.author.name}</Link></p>}
      {work.genre && <p className="text-caption text-muted">Жанр: {work.genre}</p>}
    </header>
    {work.summary?.trim() && <section className="space-y-4"><h2>Накратко</h2><StudyText text={work.summary} /></section>}
    {lists.filter(({ items }) => items.length > 0).map(({ title, items }) => <section key={title} className="space-y-4"><h2>{title}</h2>
      <LearningContent content={{ version: 1, blocks: [{ type: "list", ordered: false, items: items.map((text) => [{ type: "text", text }]) }] }} />
    </section>)}
    {work.interpretation?.trim() && <section className="space-y-4"><h2>Насоки за прочит</h2><StudyText text={work.interpretation} /></section>}
    {practiceTopics.length > 0 && <section aria-labelledby="practice-heading" className="space-y-4 rounded-lg bg-surface-soft p-4 md:p-6">
      <h2 id="practice-heading">Упражнения</h2>
      <ul className="space-y-4">{practiceTopics.map((topic) => <li key={topic.id} className="space-y-2">
        <p className="text-label">{topic.title}</p>
        <StartPracticeButton topicId={topic.id} label={`Упражни „${topic.title}“`} variant="secondary" />
      </li>)}</ul>
    </section>}
  </article>;
}
