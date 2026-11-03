import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import type { CatalogFilters } from "@/features/literature/catalog-filters";

export function LiteratureFilters({ filters, authors, genres }: {
  filters: CatalogFilters;
  authors: { name: string; slug: string }[];
  genres: string[];
}) {
  return <form action="/literatura" method="get" aria-label="Търсене в литературата" className="rounded-lg bg-surface-soft p-4 md:p-6">
    <div className="grid items-end gap-4 md:grid-cols-3">
      <div><label className="mb-2 block text-label" htmlFor="literature-query">Заглавие или автор</label>
        <Input id="literature-query" type="search" name="q" maxLength={200} defaultValue={filters.query} placeholder="Потърси произведение…" /></div>
      <div><label className="mb-2 block text-label" htmlFor="literature-author">Автор</label>
        <select id="literature-author" name="author" defaultValue={filters.author} className={inputClassName}>
          <option value="">Всички автори</option>
          {filters.author && !authors.some((author) => author.slug === filters.author) && <option value={filters.author}>Авторът не е наличен</option>}
          {authors.map((author) => <option key={author.slug} value={author.slug}>{author.name}</option>)}
        </select></div>
      <div><label className="mb-2 block text-label" htmlFor="literature-genre">Жанр</label>
        <select id="literature-genre" name="genre" defaultValue={filters.genre} className={inputClassName}>
          <option value="">Всички жанрове</option>
          {filters.genre && !genres.includes(filters.genre) && <option value={filters.genre}>Жанрът не е наличен</option>}
          {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
        </select></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-3"><Button type="submit"><Search aria-hidden="true" />Търси</Button>
      <Button asChild variant="secondary"><Link href="/literatura">Изчисти филтрите</Link></Button></div>
  </form>;
}
