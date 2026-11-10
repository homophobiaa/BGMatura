import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Feedback } from "@/components/ui/feedback";
import { StartPracticeButton } from "@/features/practice/components/start-practice-button";
import { listPracticeTopics, practiceSessionSize, type PracticeTopic } from "@/features/practice/server/practice-topics";

export const metadata: Metadata = {
  title: "Тестове по теми — BG Matura",
  description: "Упражнения по теми с обяснения към отговорите. Без регистрация.",
  alternates: { canonical: "/testove" },
};

const subjects = [
  { subject: "LITERATURE", title: "Литература" },
  { subject: "BULGARIAN_LANGUAGE", title: "Български език" },
] as const;

export default async function PracticeTopicsPage() {
  await connection();
  const topics = await listPracticeTopics();
  return <div className="space-y-8">
    <div className="max-w-reading space-y-4">
      <h1>Тестове</h1>
      <p className="text-body-lg">Избери тема и отговаряй на въпросите един по един. След всеки отговор ще видиш дали е верен и защо. Не е нужна регистрация.</p>
    </div>
    {topics.length === 0
      ? <><Feedback>Все още няма публикувани тестове. Можеш да започнеш с учебните материали.</Feedback>
        <Link href="/uchi" className="inline-flex min-h-11 items-center text-primary underline">Към учебните материали</Link></>
      : subjects.map(({ subject, title }) => {
        const group = topics.filter((topic) => topic.subject === subject);
        if (group.length === 0) return null;
        return <section key={subject} aria-labelledby={`subject-${subject}`} className="space-y-4">
          <h2 id={`subject-${subject}`}>{title}</h2>
          <ul className="grid gap-4 md:grid-cols-2">{group.map((topic) => <TopicCard key={topic.id} topic={topic} />)}</ul>
        </section>;
      })}
  </div>;
}

function TopicCard({ topic }: { topic: PracticeTopic }) {
  const questions = Math.min(topic.questionCount, practiceSessionSize);
  return <li id={`tema-${topic.id}`} className="min-w-0 space-y-4 rounded-lg bg-surface-card p-4 md:p-6">
    <h3 className="text-title [overflow-wrap:anywhere]">{topic.title}</h3>
    <p className="text-caption text-muted">{questions === 1 ? "1 въпрос" : `${questions} въпроса`} в упражнението</p>
    {topic.lessons.length > 0 && <p className="text-caption">Преговори първо: {topic.lessons.map((lesson, index) => <span key={lesson.slug}>
      {index > 0 && ", "}
      <Link href={`/balgarski-ezik/${encodeURIComponent(lesson.slug)}`} className="text-primary underline underline-offset-4">{lesson.title}</Link>
    </span>)}</p>}
    <StartPracticeButton topicId={topic.id} />
  </li>;
}
