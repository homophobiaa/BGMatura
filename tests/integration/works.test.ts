import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedWorkBySlug } from "@/features/literature/server/works";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

const fixtureNotice = "Проверка на съхранението; не е проверен учебен материал.";

function createAuthor(database: Prisma.TransactionClient, overrides: Partial<Prisma.AuthorUncheckedCreateInput> = {}) {
  return database.author.create({
    data: { name: "Тестов автор", slug: `fixture-${randomUUID()}`, context: fixtureNotice, ...overrides },
  });
}

function workData(authorId: string, overrides: Partial<Prisma.WorkUncheckedCreateInput> = {}): Prisma.WorkUncheckedCreateInput {
  return { title: "Тестово произведение", slug: `fixture-${randomUUID()}`, authorId, ...overrides };
}

describe("work persistence", () => {
  it("creates a draft work linked to its author with empty study fields", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      const work = await database.work.create({ data: workData(author.id) });

      expect(work.status).toBe("DRAFT");
      expect(work.authorId).toBe(author.id);
      expect(work.genre).toBeNull();
      expect(work.summary).toBeNull();
      expect(work.interpretation).toBeNull();
      expect(work.themes).toEqual([]);
      expect(work.characters).toEqual([]);
      expect(work.importantIdeas).toEqual([]);
      expect(work.createdAt).toBeInstanceOf(Date);
      expect(work.updatedAt).toBeInstanceOf(Date);
    });
  });

  it("stores ordered study lists and interpretation fields", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      const work = await database.work.create({
        data: workData(author.id, {
          genre: "Роман",
          summary: fixtureNotice,
          themes: ["Свобода", "Родолюбие", "Саможертва"],
          characters: ["Бойчо Огнянов", "Рада Госпожина"],
          importantIdeas: ["Цената на свободата"],
          interpretation: fixtureNotice,
        }),
      });

      const stored = await database.work.findUniqueOrThrow({ where: { id: work.id } });
      expect(stored.themes).toEqual(["Свобода", "Родолюбие", "Саможертва"]);
      expect(stored.characters).toEqual(["Бойчо Огнянов", "Рада Госпожина"]);
      expect(stored.importantIdeas).toEqual(["Цената на свободата"]);
    });
  });

  it("keeps absent characters valid, even for a published work", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      const poem = await database.work.create({
        data: workData(author.id, { genre: "Лирика", summary: fixtureNotice, status: "PUBLISHED" }),
      });

      expect(poem.characters).toEqual([]);
      expect(poem.status).toBe("PUBLISHED");
    });
  });

  it("links several works to one author", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      await database.work.create({ data: workData(author.id, { title: "Б" }) });
      await database.work.create({ data: workData(author.id, { title: "А" }) });

      const works = await database.work.findMany({ where: { authorId: author.id }, orderBy: { title: "asc" } });
      expect(works.map((work) => work.title)).toEqual(["А", "Б"]);
    });
  });

  it("enforces unique work slugs", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      const data = workData(author.id);
      await database.work.create({ data });
      await expect(database.work.create({ data: { ...data, title: "Друго заглавие" } })).rejects.toMatchObject({
        code: "P2002",
      });
    });
  });
});

describe("work author relationship", () => {
  it("requires an existing author", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(database.work.create({ data: workData(randomUUID()) })).rejects.toThrow("Work_authorId_fkey");
    });
  });

  it("refuses to delete an author who still has works", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      await database.work.create({ data: workData(author.id) });

      await expect(database.author.delete({ where: { id: author.id } })).rejects.toThrow("Work_authorId_fkey");
    });
  });

  it("allows deleting an author once their works are gone", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      const work = await database.work.create({ data: workData(author.id) });

      await database.work.delete({ where: { id: work.id } });
      await database.author.delete({ where: { id: author.id } });
      expect(await database.author.findUnique({ where: { id: author.id } })).toBeNull();
    });
  });
});

describe("work constraints", () => {
  // Each case names the one constraint it must trip, so a test cannot pass for the wrong reason.
  const rejectedWorks: [string, Partial<Prisma.WorkUncheckedCreateInput>, string][] = [
    ["a blank title", { title: "   " }, "Work_title_nonblank"],
    ["a blank slug", { slug: " " }, "Work_slug_nonblank"],
    ["a blank theme", { themes: ["Свобода", "  "] }, "Work_study_lists_nonblank_items"],
    ["a blank character", { characters: [""] }, "Work_study_lists_nonblank_items"],
    ["a blank important idea", { importantIdeas: ["\n"] }, "Work_study_lists_nonblank_items"],
    ["a published work without a genre", { summary: fixtureNotice, status: "PUBLISHED" }, "Work_published_essentials"],
    ["a published work without a summary", { genre: "Роман", status: "PUBLISHED" }, "Work_published_essentials"],
    [
      "a published work with a blank summary",
      { genre: "Роман", summary: "  ", status: "PUBLISHED" },
      "Work_published_essentials",
    ],
  ];

  it.each(rejectedWorks)("rejects %s", async (_description, overrides, constraint) => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      await expect(database.work.create({ data: workData(author.id, overrides) })).rejects.toThrow(constraint);
    });
  });

  it("allows an incomplete draft", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database);
      await expect(
        database.work.create({ data: workData(author.id, { genre: "  ", themes: ["Свобода"] }) }),
      ).resolves.toMatchObject({ status: "DRAFT" });
    });
  });
});

describe("public work reading boundary", () => {
  it("never resolves a draft work", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database, { status: "PUBLISHED" });
      const draft = await database.work.create({ data: workData(author.id) });

      expect(await findPublishedWorkBySlug(draft.slug, database)).toBeNull();
    });
  });

  it("reads only public study fields of a published work and its published author", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await createAuthor(database, { name: "Тестов автор", status: "PUBLISHED" });
      const work = await database.work.create({
        data: workData(author.id, {
          genre: "Роман",
          summary: fixtureNotice,
          themes: ["Свобода"],
          characters: ["Герой"],
          importantIdeas: ["Идея"],
          interpretation: fixtureNotice,
          status: "PUBLISHED",
        }),
      });

      const reading = await findPublishedWorkBySlug(work.slug, database);

      expect(reading).toEqual({
        id: work.id,
        title: work.title,
        slug: work.slug,
        genre: "Роман",
        summary: fixtureNotice,
        themes: ["Свобода"],
        characters: ["Герой"],
        importantIdeas: ["Идея"],
        interpretation: fixtureNotice,
        author: { name: "Тестов автор", slug: author.slug },
      });
      expect(reading).not.toHaveProperty("status");
      expect(reading).not.toHaveProperty("authorId");
      expect(reading).not.toHaveProperty("createdAt");
    });
  });

  it("does not reveal a draft author through a published work", async () => {
    await withDatabaseFixture(async (database) => {
      const draftAuthor = await createAuthor(database, { name: "Чернова на автор", context: null });
      const work = await database.work.create({
        data: workData(draftAuthor.id, { genre: "Роман", summary: fixtureNotice, status: "PUBLISHED" }),
      });

      const reading = await findPublishedWorkBySlug(work.slug, database);

      expect(reading?.author).toBeNull();
      expect(JSON.stringify(reading)).not.toContain("Чернова на автор");
    });
  });
});
