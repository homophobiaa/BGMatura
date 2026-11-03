import Link from "next/link";
import { connection } from "next/server";

import { Feedback } from "@/components/ui/feedback";
import { readCatalogFilters } from "@/features/literature/catalog-filters";
import { LiteratureFilters } from "@/features/literature/components/catalog-filters";
import { getLiteratureCatalog } from "@/features/literature/server/catalog";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { learningPageMetadata } from "@/features/learning/server/page-metadata";

export function generateMetadata() {
  return learningPageMetadata("Литература", "Автори, произведения, теми и насоки за подготовка за ДЗИ по БЕЛ.", "/literatura");
}

export default async function LiteraturePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const filters = readCatalogFilters(await searchParams);
  const { works, authors, genres } = await getLiteratureCatalog(filters);
  const filtered = Boolean(filters.query || filters.author || filters.genre);
  return <div className="space-y-8">
    <Breadcrumbs items={[{ label: "Учи", href: "/uchi" }, { label: "Литература" }]} />
    <div className="max-w-reading space-y-4"><h1>Литература</h1><p className="text-body-lg">Намери произведение и разгледай автора, темите и насоките за прочит.</p></div>
    <LiteratureFilters filters={filters} authors={authors} genres={genres} />
    {works.length === 0 ? <Feedback>{filtered ? "Няма намерени резултати. Промени търсенето или изчисти филтрите." : "Все още няма публикувани произведения. Подготвяме проверени учебни материали."}</Feedback> :
      <ul aria-label="Произведения" className="grid gap-4 md:grid-cols-2">
        {works.map((work) => <li key={work.slug} className="min-w-0 rounded-lg bg-surface-card p-4 md:p-6">
          {work.genre && <p className="mb-2 text-caption text-muted">{work.genre}</p>}
          <h2 className="text-title"><Link href={`/literatura/${encodeURIComponent(work.slug)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{work.title}</Link></h2>
          {work.author && <p><Link href={`/avtori/${encodeURIComponent(work.author.slug)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{work.author.name}</Link></p>}
          {work.summary && <p className="mt-3 line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{work.summary}</p>}
        </li>)}
      </ul>}
  </div>;
}
