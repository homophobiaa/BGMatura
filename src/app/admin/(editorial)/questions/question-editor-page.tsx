import "server-only";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { QuestionForm, type QuestionFormRecord } from "@/features/admin/components/question-form";
import { listTopicOptions } from "@/features/admin/server/learning-lists";
import { listWorkOptions } from "@/features/admin/server/question-editing";

/** Shared body of the "new" and "edit" question pages. */
export async function QuestionEditorPage({ record, created, requestHeaders }: { record: QuestionFormRecord | undefined; created: boolean; requestHeaders: Headers }) {
  const [topics, works] = await Promise.all([listTopicOptions(requestHeaders), listWorkOptions(requestHeaders)]);
  const title = record ? "Редакция на въпрос" : "Нов въпрос";
  return <section className="max-w-reading space-y-6">
    <Breadcrumbs items={[{ label: "Администрация", href: "/admin" }, { label: "Въпроси", href: "/admin/questions" }, { label: title }]} />
    <h1>{title}</h1>
    {created && <Feedback tone="success">Черновата е създадена. Можеш да продължиш с редакцията.</Feedback>}
    <QuestionForm record={record} topics={topics} works={works} />
  </section>;
}
