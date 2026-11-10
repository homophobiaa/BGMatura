import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Input, inputClassName } from "@/components/ui/input";
import { DeleteRecordControl } from "@/features/admin/components/delete-record-control";
import { learningEditPath, learningKindLabels, learningListPath, publicationStatusLabels } from "@/features/admin/learning-kind-labels";
import { learningListHref, readLearningListFilters } from "@/features/admin/learning-list-filters";
import { listLearningRecords } from "@/features/admin/server/learning-lists";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { isLearningKind } from "@/features/learning/kinds";

export const metadata: Metadata = { title: "Съдържание — BG Matura", robots: { index: false, follow: false } };

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" });

export default async function LearningListPage({ params, searchParams }: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind } = await params;
  if (!isLearningKind(kind)) notFound();
  const { requestHeaders } = await requireAdminPage();
  const parameters = await searchParams;
  const filters = readLearningListFilters(parameters);
  const deleted = typeof parameters.deleted === "string" ? parameters.deleted : undefined;
  const labels = learningKindLabels[kind];
  const basePath = learningListPath(kind);
  const list = await listLearningRecords(kind, filters, requestHeaders);
  const filtered = Boolean(filters.query) || filters.status !== "all";
  const current = { ...filters, page: list.page };

  return <section className="space-y-6">
    <Breadcrumbs items={[{ label: "Администрация", href: "/admin" }, { label: labels.plural }]} />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1>{labels.plural}</h1>
      <Button asChild><Link href={`${basePath}/new`}>{labels.create}</Link></Button>
    </div>
    {deleted && <Feedback tone="success">Записът „{deleted}“ е изтрит.</Feedback>}

    <form method="get" action={basePath} aria-label={`Търсене: ${labels.plural}`} className="rounded-lg bg-surface-soft p-4 md:p-6">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_14rem]">
        <div><label htmlFor="list-query" className="mb-2 block text-label">Заглавие, име или адрес</label>
          <Input id="list-query" type="search" name="q" maxLength={200} defaultValue={filters.query} /></div>
        <div><label htmlFor="list-status" className="mb-2 block text-label">Състояние</label>
          <select id="list-status" name="status" defaultValue={filters.status} className={inputClassName}>
            <option value="all">Всички</option>
            <option value="DRAFT">Чернови</option>
            <option value="PUBLISHED">Публикувани</option>
          </select></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit"><Search aria-hidden="true" />Търси</Button>
        {filtered && <Button asChild variant="secondary"><Link href={basePath}>Изчисти филтрите</Link></Button>}
      </div>
    </form>

    {list.items.length === 0
      ? <Feedback>{filtered ? "Няма записи, които отговарят на търсенето." : "Още няма записи. Създай първия."}</Feedback>
      : <>
        <p className="text-caption text-muted" aria-live="polite">Намерени: {list.total}</p>
        <ul aria-label={labels.plural} className="space-y-3">
          {list.items.map((item) => {
            const editHref = learningEditPath(kind, item.id);
            return <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-card p-4">
              <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                <h2 className="text-title"><Link href={editHref} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{item.title}</Link></h2>
                <p className="text-caption text-muted">
                  <span className={item.status === "PUBLISHED" ? "text-success" : "text-pending"}>{publicationStatusLabels[item.status]}</span>
                  {" · "}{item.slug}{item.detail && <> · {item.detail}</>}{" · "}Променен {dateFormat.format(new Date(item.updatedAt))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary"><Link href={editHref} aria-label={`Редактирай „${item.title}“`}>Редактирай</Link></Button>
                {item.status === "DRAFT" && <DeleteRecordControl kind={kind} id={item.id} slug={item.slug} title={item.title} editHref={editHref}
                  afterDeleteHref={learningListHref(basePath, current, { deleted: item.slug })} />}
              </div>
            </li>;
          })}
        </ul>
        {list.pageCount > 1 && <nav aria-label="Страници" className="flex flex-wrap items-center gap-3">
          {list.page > 1 && <Button asChild variant="secondary"><Link href={learningListHref(basePath, current, { page: list.page - 1 })}>Предишна</Link></Button>}
          <span className="text-label">Страница {list.page} от {list.pageCount}</span>
          {list.page < list.pageCount && <Button asChild variant="secondary"><Link href={learningListHref(basePath, current, { page: list.page + 1 })}>Следваща</Link></Button>}
        </nav>}
      </>}
  </section>;
}
