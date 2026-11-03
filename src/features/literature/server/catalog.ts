import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CatalogFilters } from "@/features/literature/catalog-filters";
import { getDatabase } from "@/server/database";

type CatalogDatabase = Pick<Prisma.TransactionClient, "work" | "author">;

const workPreview = {
  title: true, slug: true, genre: true, summary: true,
  author: { select: { name: true, slug: true, status: true } },
} satisfies Prisma.WorkSelect;

export async function getLiteratureCatalog(filters: CatalogFilters, database: CatalogDatabase = getDatabase()) {
  const publicWhere = { status: "PUBLISHED" } satisfies Prisma.WorkWhereInput;
  const works = await database.work.findMany({
    where: {
      ...publicWhere,
      ...(filters.author ? { author: { status: "PUBLISHED", slug: filters.author } } : {}),
      ...(filters.genre ? { genre: filters.genre } : {}),
    },
    select: workPreview,
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
  // Facets come from public records only, independent of the current selection.
  const authors = await database.author.findMany({
      where: { status: "PUBLISHED", works: { some: publicWhere } },
      select: { name: true, slug: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  const genres = await database.work.findMany({ where: publicWhere, select: { genre: true }, distinct: ["genre"], orderBy: { genre: "asc" } });
  // The portable local cluster uses C collation, whose ILIKE does not fold Cyrillic.
  // Fold the small public MVP catalog explicitly so search works across hosts.
  const searchText = filters.query.normalize("NFC").toLocaleLowerCase("bg");
  const publicWorks = works.map(({ author, ...work }) => ({
    ...work, author: author?.status === "PUBLISHED" ? { name: author.name, slug: author.slug } : null,
  }));
  return {
    works: publicWorks.filter((work) => [work.title, work.author?.name ?? ""].some((value) => value.normalize("NFC").toLocaleLowerCase("bg").includes(searchText))),
    authors,
    genres: genres.flatMap(({ genre }) => genre?.trim() ? [genre] : []),
  };
}

export function listPublishedAuthorWorks(authorSlug: string, database: CatalogDatabase = getDatabase()) {
  return database.work.findMany({
    where: { status: "PUBLISHED", author: { slug: authorSlug, status: "PUBLISHED" } },
    select: { title: true, slug: true, genre: true },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
}
