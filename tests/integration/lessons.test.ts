import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findPublishedLessonBySlug } from "@/features/language/server/lessons";
import type { Prisma } from "@/generated/prisma/client";

import { withDatabaseFixture } from "./fixtures";

const document = { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Демонстрация — непроверен тестов текст." }] }] };
const topicData = () => ({ title: "Тестова тема", slug: `fixture-${randomUUID()}`, subject: "BULGARIAN_LANGUAGE" as const });
const lessonData = (topicId: string, overrides: Partial<Prisma.LessonUncheckedCreateInput> = {}): Prisma.LessonUncheckedCreateInput => ({
  title: "Тестов урок", slug: `fixture-${randomUUID()}`, topicId, ...overrides,
});

describe("lesson persistence", () => {
  it("defaults to an empty draft with edit metadata and a required topic", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: topicData() });
      const lesson = await database.lesson.create({ data: lessonData(topic.id) });
      expect(lesson).toMatchObject({ topicId: topic.id, subject: "BULGARIAN_LANGUAGE", status: "DRAFT", content: { version: 1, blocks: [] } });
      expect(lesson.createdAt).toBeInstanceOf(Date);
      expect(lesson.updatedAt).toBeInstanceOf(Date);
      const changed = await database.lesson.update({ where: { id: lesson.id }, data: { title: "Редактиран урок", content: document } });
      expect(changed.updatedAt.getTime()).toBeGreaterThanOrEqual(lesson.updatedAt.getTime());
      expect(changed.content).toEqual(document);
    });
  });

  it("allows several lessons on a subtopic", async () => {
    await withDatabaseFixture(async (database) => {
      const parent = await database.topic.create({ data: topicData() });
      const child = await database.topic.create({ data: { ...topicData(), parentId: parent.id } });
      await database.lesson.create({ data: lessonData(child.id) });
      await database.lesson.create({ data: lessonData(child.id) });
      expect(await database.lesson.count({ where: { topicId: child.id } })).toBe(2);
    });
  });

  it("rejects duplicate slugs", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: topicData() });
      const data = lessonData(topic.id);
      await database.lesson.create({ data });
      await expect(database.lesson.create({ data })).rejects.toMatchObject({ code: "P2002" });
    });
  });

  it("rejects a missing topic", async () => {
    await withDatabaseFixture(async (database) => {
      await expect(database.lesson.create({ data: lessonData(randomUUID()) })).rejects.toThrow("Lesson_topicId_subject_fkey");
    });
  });

  it("rejects a literature topic", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: { ...topicData(), subject: "LITERATURE" } });
      await expect(database.lesson.create({ data: lessonData(topic.id) })).rejects.toThrow("Lesson_topicId_subject_fkey");
    });
  });

  it("prevents deleting the required topic", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: topicData() });
      await database.lesson.create({ data: lessonData(topic.id) });
      await expect(database.topic.delete({ where: { id: topic.id } })).rejects.toThrow("Lesson_topicId_subject_fkey");
    });
  });

  it.each([
    ["blank title", { title: "\n\t " }, "Lesson_title_nonblank"],
    ["blank slug", { slug: "  " }, "Lesson_slug_nonblank"],
    ["unsupported content", { content: { version: 2, blocks: [] } }, "Lesson_content_v1_envelope"],
    ["missing content fields", { content: {} }, "Lesson_content_v1_envelope"],
    ["empty publication", { status: "PUBLISHED" }, "Lesson_published_has_content"],
  ] satisfies [string, Partial<Prisma.LessonUncheckedCreateInput>, string][])("rejects %s", async (_label, overrides, constraint) => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: topicData() });
      await expect(database.lesson.create({ data: lessonData(topic.id, overrides) })).rejects.toThrow(constraint);
    });
  });
});

describe("public lesson reading", () => {
  it("returns only validated published reading fields", async () => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: { ...topicData(), status: "PUBLISHED" } });
      const lesson = await database.lesson.create({ data: lessonData(topic.id, { content: document, status: "PUBLISHED" }) });
      expect(await findPublishedLessonBySlug(lesson.slug, database)).toEqual({
        id: lesson.id, title: lesson.title, slug: lesson.slug, content: document,
        topic: { id: topic.id, title: topic.title, slug: topic.slug },
      });
    });
  });

  it.each(["draft lesson", "draft topic", "unsafe stored block"])("hides %s", async (condition) => {
    await withDatabaseFixture(async (database) => {
      const topic = await database.topic.create({ data: { ...topicData(), status: condition === "draft topic" ? "DRAFT" : "PUBLISHED" } });
      const lesson = await database.lesson.create({ data: lessonData(topic.id, {
        content: condition === "unsafe stored block" ? { version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] } : document,
        status: condition === "draft lesson" ? "DRAFT" : "PUBLISHED",
      }) });
      expect(await findPublishedLessonBySlug(lesson.slug, database)).toBeNull();
    });
  });
});
