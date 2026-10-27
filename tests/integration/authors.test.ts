import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedAuthorBySlug } from "@/features/literature/server/authors";
import { getDatabase } from "@/server/database";

import { withDatabaseFixture } from "./fixtures";

describe("author persistence and draft visibility", () => {
  it("creates and reads an author with timestamps and draft defaults", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await database.author.create({ data: {
        name: "Тестов автор — не е учебно съдържание", slug: `fixture-${randomUUID()}`,
      } });
      expect(author.status).toBe("DRAFT");
      expect(author.context).toBeNull();
      expect(author.createdAt).toBeInstanceOf(Date);
      expect(author.updatedAt).toBeInstanceOf(Date);
      expect(await database.author.findUnique({ where: { id: author.id } })).toEqual(author);
      expect(await findPublishedAuthorBySlug(author.slug, database)).toBeNull();
    });
  });

  it("reads only explicitly published author context through the public boundary", async () => {
    await withDatabaseFixture(async (database) => {
      const author = await database.author.create({ data: {
        name: "Тестов автор", slug: `fixture-${randomUUID()}`,
        context: "Проверка на съхранението; не е проверен учебен материал.", status: "PUBLISHED",
      } });
      expect(await findPublishedAuthorBySlug(author.slug, database)).toEqual({
        id: author.id, name: author.name, slug: author.slug, context: author.context,
      });
    });
  });

  it("enforces unique author slugs", async () => {
    await withDatabaseFixture(async (database) => {
      const data = { name: "Тестов автор", slug: `fixture-${randomUUID()}` };
      await database.author.create({ data });
      await expect(database.author.create({ data })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects publishing an author with no context", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(database.author.create({ data: {
        name: "Тестов автор", slug: `fixture-${randomUUID()}`, status: "PUBLISHED",
      } })).rejects.toThrow();
    });
  });

  it("rolls fixtures back after successful assertions", async () => {
    const slug = `fixture-${randomUUID()}`;
    await withDatabaseFixture(async (database) => {
      await database.author.create({ data: { name: "Тестов автор", slug } });
    });
    expect(await getDatabase().author.findUnique({ where: { slug } })).toBeNull();
  });

  it("rolls fixtures back and preserves a failing assertion/error", async () => {
    const slug = `fixture-${randomUUID()}`;
    const failure = new Error("Intentional fixture failure");
    await expect(withDatabaseFixture(async (database) => {
      await database.author.create({ data: { name: "Тестов автор", slug } });
      throw failure;
    })).rejects.toBe(failure);
    expect(await getDatabase().author.findUnique({ where: { slug } })).toBeNull();
  });
});
