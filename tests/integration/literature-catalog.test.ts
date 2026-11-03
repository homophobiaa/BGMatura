import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";

import { getLiteratureCatalog, listPublishedAuthorWorks } from "@/features/literature/server/catalog";
import { findPublishedAuthorBySlug } from "@/features/literature/server/authors";
import { withDatabaseFixture } from "./fixtures";

it("searches Bulgarian titles and authors, combines facets, and hides draft relations", async () => {
  await withDatabaseFixture(async (database) => {
    const suffix = randomUUID();
    const author = await database.author.create({ data: { name: `Йовков ${suffix}`, slug: `fixture-${suffix}`, context: "Тестов контекст", status: "PUBLISHED" } });
    const hidden = await database.author.create({ data: { name: `Скрит автор ${suffix}`, slug: `fixture-${randomUUID()}` } });
    const publicWork = await database.work.create({ data: { title: `Песента ${suffix}`, slug: `fixture-${randomUUID()}`, authorId: author.id, genre: "Разказ", summary: "Само тестови данни", status: "PUBLISHED" } });
    const draft = await database.work.create({ data: { title: `Чернова ${suffix}`, slug: `fixture-${randomUUID()}`, authorId: author.id, genre: "Скрит жанр" } });
    const hiddenAuthorWork = await database.work.create({ data: { title: `Друго ${suffix}`, slug: `fixture-${randomUUID()}`, authorId: hidden.id, genre: "Разказ", summary: "Само тестови данни", status: "PUBLISHED" } });
    const catalog = await getLiteratureCatalog({ query: `ПЕСЕНТА ${suffix}`, author: "", genre: "" }, database);
    expect(catalog.works.map((entry) => entry.slug)).toEqual([publicWork.slug]);
    const byAuthor = await getLiteratureCatalog({ query: `ЙОВКОВ ${suffix}`, author: author.slug, genre: "Разказ" }, database);
    expect(byAuthor.works.map((entry) => entry.slug)).toEqual([publicWork.slug]);
    expect(catalog.authors.map((entry) => entry.slug)).not.toContain(hidden.slug);
    expect(catalog.genres).not.toContain("Скрит жанр");
    const all = await getLiteratureCatalog({ query: suffix, author: "", genre: "" }, database);
    expect(all.works.map((entry) => entry.slug)).not.toContain(draft.slug);
    expect(all.works.find((entry) => entry.slug === hiddenAuthorWork.slug)?.author).toBeNull();
    expect(JSON.stringify(all)).not.toContain(hidden.name);
    expect((await listPublishedAuthorWorks(author.slug, database)).map((entry) => entry.slug)).toEqual([publicWork.slug]);
    expect(await findPublishedAuthorBySlug(hidden.slug, database)).toBeNull();
    expect((await getLiteratureCatalog({ query: suffix, author: author.slug, genre: "Няма" }, database)).works).toEqual([]);
    expect(catalog.works[0]).not.toHaveProperty("status");
    expect(catalog.works[0]).not.toHaveProperty("questions");
  });
});
