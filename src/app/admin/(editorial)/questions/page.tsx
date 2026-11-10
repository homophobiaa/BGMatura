import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Input, inputClassName } from "@/components/ui/input";
import { editorialEditPath, editorialPreviewPath, publicationStatusLabels } from "@/features/admin/learning-kind-labels";
import { assessmentModeLabels, questionListHref, questionTypeLabels, questionTypes, readQuestionListFilters } from "@/features/admin/question-list-filters";
import { listTopicOptions } from "@/features/admin/server/learning-lists";
import { listQuestions } from "@/features/admin/server/question-editing";
import { requireAdminPage } from "@/features/admin/server/page-authorization";

export const metadata: Metadata = { title: "Въпроси — BG Matura", robots: { index: false, follow: false } };

export default async function QuestionListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { requestHeaders } = await requireAdminPage();
  const filters = readQuestionListFilters(await searchParams);
  const [list, topics] = await Promise.all([listQuestions(filters, requestHeaders), listTopicOptions(requestHeaders)]);
  const filtered = Boolean(filters.query) || filters.status !== "all" || filters.type !== "all" || Boolean(filters.topicId);
  const current = { ...filters, page: list.page };

  return <section className="space-y-6">
    <Breadcrumbs items={[{ label: "Администрация", href: "/admin" }, { label: "Въпроси" }]} />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1>Въпроси</h1>
      <Button asChild><Link href="/admin/questions/new">Нов въпрос</Link></Button>
    </div>

    <form method="get" action="/admin/questions" aria-label="Търсене във въпросите" className="rounded-lg bg-surface-soft p-4 md:p-6">
      <div className="grid items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div><label htmlFor="question-query" className="mb-2 block text-label">Текст на условието</label>
          <Input id="question-query" type="search" name="q" maxLength={200} defaultValue={filters.query} /></div>
        <div><label htmlFor="question-topic" className="mb-2 block text-label">Тема</label>
          <select id="question-topic" name="topic" defaultValue={filters.topicId} className={inputClassName}>
            <option value="">Всички теми</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select></div>
        <div><label htmlFor="question-type-filter" className="mb-2 block text-label">Вид</label>
          <select id="question-type-filter" name="type" defaultValue={filters.type} className={inputClassName}>
            <option value="all">Всички видове</option>
            {questionTypes.map((type) => <option key={type} value={type}>{questionTypeLabels[type]}</option>)}
          </select></div>
        <div><label htmlFor="question-status" className="mb-2 block text-label">Състояние</label>
          <select id="question-status" name="status" defaultValue={filters.status} className={inputClassName}>
            <option value="all">Всички</option><option value="DRAFT">Чернови</option><option value="PUBLISHED">Публикувани</option>
          </select></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit"><Search aria-hidden="true" />Търси</Button>
        {filtered && <Button asChild variant="secondary"><Link href="/admin/questions">Изчисти филтрите</Link></Button>}
      </div>
    </form>

    {list.items.length === 0
      ? <Feedback>{filtered ? "Няма въпроси, които отговарят на търсенето." : "Още няма въпроси. Създай първия."}</Feedback>
      : <>
        <p className="text-caption text-muted" aria-live="polite">Намерени: {list.total}</p>
        <ul aria-label="Въпроси" className="space-y-3">
          {list.items.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-card p-4">
            <div className="min-w-0 max-w-reading space-y-1 [overflow-wrap:anywhere]">
              <p className="line-clamp-2">{item.prompt}</p>
              <p className="text-caption text-muted">
                <span className={item.status === "PUBLISHED" ? "text-success" : "text-pending"}>{publicationStatusLabels[item.status]}</span>
                {" · "}{questionTypeLabels[item.type]} · {assessmentModeLabels[item.assessmentMode]}
                {item.topics.length > 0 && <> · {item.topics.join(", ")}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary"><Link href={editorialEditPath("question", item.id)}>Редактирай</Link></Button>
              <Button asChild variant="secondary"><Link href={editorialPreviewPath("question", item.id)}>Преглед</Link></Button>
            </div>
          </li>)}
        </ul>
        {list.pageCount > 1 && <nav aria-label="Страници" className="flex flex-wrap items-center gap-3">
          {list.page > 1 && <Button asChild variant="secondary"><Link href={questionListHref(current, { page: list.page - 1 })}>Предишна</Link></Button>}
          <span className="text-label">Страница {list.page} от {list.pageCount}</span>
          {list.page < list.pageCount && <Button asChild variant="secondary"><Link href={questionListHref(current, { page: list.page + 1 })}>Следваща</Link></Button>}
        </nav>}
      </>}
  </section>;
}
