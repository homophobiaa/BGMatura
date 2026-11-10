import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAdmin } from "../fixtures/admin-session";
import { getDatabase } from "@/server/database";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import { listAuthorOptions, listLearningRecords, listTopicOptions } from "@/features/admin/server/learning-lists";
import { learningListPageSize } from "@/features/admin/learning-list-filters";

const database = getDatabase();
const prefix = `admin-list-${randomUUID()}`;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;

beforeAll(async () => {
  admin = await createTestAdmin(database);
  for (let index = 0; index < learningListPageSize + 1; index++) {
    await database.author.create({ data: { name: `${prefix} автор ${index}`, slug: `${prefix}-author-${index}`, status: index === 0 ? "PUBLISHED" : "DRAFT", context: "Само тестови данни." } });
  }
  const author = await database.author.findFirstOrThrow({ where: { slug: `${prefix}-author-0` } });
  await database.work.create({ data: { title: `${prefix} Произведение`, slug: `${prefix}-work`, authorId: author.id } });
  const topic = await database.topic.create({ data: { title: `${prefix} Тема`, slug: `${prefix}-topic`, subject: "BULGARIAN_LANGUAGE" } });
  await database.lesson.create({ data: { title: `${prefix} Урок`, slug: `${prefix}-lesson`, topicId: topic.id } });
});

afterAll(async () => {
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.topic.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.work.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.author.deleteMany({ where: { slug: { startsWith: prefix } } });
  await admin.cleanup();
});

describe("admin learning lists", () => {
  it("require an admin session", async () => {
    await expect(listLearningRecords("author", { query: "", status: "all", page: 1 }, new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(listAuthorOptions(new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(listTopicOptions(new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
  });

  it("search case-insensitively and paginate predictably", async () => {
    const first = await listLearningRecords("author", { query: prefix.toUpperCase(), status: "all", page: 1 }, admin.headers);
    expect(first.total).toBe(learningListPageSize + 1);
    expect(first.pageCount).toBe(2);
    expect(first.items).toHaveLength(learningListPageSize);
    const second = await listLearningRecords("author", { query: prefix, status: "all", page: 2 }, admin.headers);
    expect(second.items).toHaveLength(1);
    const seen = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(seen.size).toBe(learningListPageSize + 1);
  });

  it("clamp a page beyond the end to the last page", async () => {
    const list = await listLearningRecords("author", { query: prefix, status: "all", page: 99 }, admin.headers);
    expect(list.page).toBe(2);
    expect(list.items).toHaveLength(1);
  });

  it("filter by status", async () => {
    const published = await listLearningRecords("author", { query: prefix, status: "PUBLISHED", page: 1 }, admin.headers);
    expect(published.items.map((item) => item.slug)).toEqual([`${prefix}-author-0`]);
    const drafts = await listLearningRecords("author", { query: prefix, status: "DRAFT", page: 1 }, admin.headers);
    expect(drafts.total).toBe(learningListPageSize);
  });

  it("show context for works, topics, and lessons", async () => {
    const works = await listLearningRecords("work", { query: prefix, status: "all", page: 1 }, admin.headers);
    expect(works.items[0]).toMatchObject({ slug: `${prefix}-work`, status: "DRAFT", detail: `${prefix} автор 0` });
    const topics = await listLearningRecords("topic", { query: `${prefix}-topic`, status: "all", page: 1 }, admin.headers);
    expect(topics.items[0]).toMatchObject({ title: `${prefix} Тема`, detail: "Български език" });
    const lessons = await listLearningRecords("lesson", { query: prefix, status: "all", page: 1 }, admin.headers);
    expect(lessons.items[0]).toMatchObject({ title: `${prefix} Урок`, detail: `${prefix} Тема` });
  });

  it("return editor choices including drafts", async () => {
    const authors = await listAuthorOptions(admin.headers);
    expect(authors.filter((author) => author.name.startsWith(prefix))).toHaveLength(learningListPageSize + 1);
    const topics = await listTopicOptions(admin.headers);
    expect(topics.find((topic) => topic.title === `${prefix} Тема`)).toMatchObject({ subject: "BULGARIAN_LANGUAGE", status: "DRAFT", parentId: null });
  });
});
