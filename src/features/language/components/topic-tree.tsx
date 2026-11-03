import Link from "next/link";

type Topic = { id: string; parentId: string | null; title: string; slug: string };
type Lesson = { topicId: string; title: string; slug: string };

export function TopicTree({ topics, lessons, parentId = null }: { topics: Topic[]; lessons: Lesson[]; parentId?: string | null }) {
  const children = topics.filter((topic) => topic.parentId === parentId);
  if (!children.length) return null;
  return <ul className="space-y-6">{children.map((topic) => {
    const topicLessons = lessons.filter((lesson) => lesson.topicId === topic.id);
    return <li key={topic.id} id={`tema-${topic.slug}`} className="scroll-mt-8 border-l border-border-control pl-4 md:pl-6">
      <p className="text-title text-ink">{topic.title}</p>
      {topicLessons.length > 0 ? <ul className="my-3 space-y-2">{topicLessons.map((lesson) => <li key={lesson.slug}>
        <Link href={`/balgarski-ezik/${encodeURIComponent(lesson.slug)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{lesson.title}</Link>
      </li>)}</ul> : <p className="my-3 text-caption text-muted">Все още няма публикувани уроци към тази тема.</p>}
      <TopicTree topics={topics} lessons={lessons} parentId={topic.id} />
    </li>;
  })}</ul>;
}
