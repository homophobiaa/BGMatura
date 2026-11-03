import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";

import { getLanguageCatalog } from "@/features/language/server/published-lessons";
import { findPublishedLessonBySlug } from "@/features/language/server/lessons";
import type { Prisma } from "@/generated/prisma/client";
import { exampleLessonContent } from "../fixtures/learning-content";
import { withDatabaseFixture } from "./fixtures";

function topic(database: Prisma.TransactionClient, overrides: Partial<Prisma.TopicUncheckedCreateInput> = {}) {
  return database.topic.create({ data: { title: "Тестова тема", slug: `fixture-${randomUUID()}`, subject: "BULGARIAN_LANGUAGE", status: "PUBLISHED", ...overrides } });
}
function lessonData(topicId: string, overrides: Partial<Prisma.LessonUncheckedCreateInput> = {}): Prisma.LessonUncheckedCreateInput {
  return { title: "Тестов урок", slug: `fixture-${randomUUID()}`, topicId, content: exampleLessonContent, ...overrides };
}

it("shows only published lessons with published ancestry, including after ancestor unpublication", async () => {
  await withDatabaseFixture(async (database) => {
    const root = await topic(database);
    const child = await topic(database, { parentId: root.id });
    const hidden = await topic(database, { status: "DRAFT" });
    const hiddenChild = await topic(database, { parentId: hidden.id });
    const publicLesson = await database.lesson.create({ data: lessonData(child.id, { status: "PUBLISHED" }) });
    const draft = await database.lesson.create({ data: lessonData(child.id) });
    const hiddenLesson = await database.lesson.create({ data: lessonData(hiddenChild.id, { status: "PUBLISHED" }) });
    const catalog = await getLanguageCatalog(database);
    expect(catalog.lessons.map((entry) => entry.slug)).toContain(publicLesson.slug);
    expect(catalog.lessons.map((entry) => entry.slug)).not.toContain(draft.slug);
    expect(catalog.lessons.map((entry) => entry.slug)).not.toContain(hiddenLesson.slug);
    expect(catalog.topics.map((entry) => entry.id)).not.toContain(hiddenChild.id);
    expect(await findPublishedLessonBySlug(hiddenLesson.slug, database)).toBeNull();
    expect(await findPublishedLessonBySlug(draft.slug, database)).toBeNull();
    expect(await findPublishedLessonBySlug(publicLesson.slug, database)).toEqual({ id: publicLesson.id, title: publicLesson.title, slug: publicLesson.slug, content: exampleLessonContent, topic: { id: child.id, title: child.title, slug: child.slug } });
    await database.topic.update({ where: { id: root.id }, data: { status: "DRAFT" } });
    expect(await findPublishedLessonBySlug(publicLesson.slug, database)).toBeNull();
  });
});

it("rejects malformed blocks and unsafe links even when SQL bypassed an editor", async () => {
  await withDatabaseFixture(async (database) => {
    const parent = await topic(database);
    const malformed = await database.lesson.create({ data: lessonData(parent.id, { status: "PUBLISHED", content: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "link", href: "javascript:alert(1)", text: "bad" }] }] } }) });
    expect(await findPublishedLessonBySlug(malformed.slug, database)).toBeNull();
    expect((await getLanguageCatalog(database)).lessons.map((entry) => entry.slug)).not.toContain(malformed.slug);
  });
});
