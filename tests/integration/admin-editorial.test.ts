import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAdmin } from "../fixtures/admin-session";
import { withDatabaseFixture } from "./fixtures";
import { getDatabase } from "@/server/database";
import { EditorialError } from "@/server/editorial";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import { saveAuthorDraft } from "@/features/literature/server/author-drafts";
import { saveWorkDraft } from "@/features/literature/server/work-drafts";
import { saveTopicDraft } from "@/features/topics/server/topic-drafts";
import { saveLessonDraft } from "@/features/language/server/lesson-drafts";
import { saveQuestionDraft } from "@/features/questions/server/question-drafts";
import { setQuestionPublication } from "@/features/questions/server/question-status";
import { deleteLearningDraft } from "@/features/learning/server/deletion";
import { readLearningPreview } from "@/features/learning/server/previews";
import { setLearningPublication } from "@/features/learning/server/publication";
import { findPublishedAuthorBySlug } from "@/features/literature/server/authors";
import { findPublishedLessonBySlug } from "@/features/language/server/lessons";
import { findPublishedPublicQuestion } from "@/features/questions/server/public-questions";
import { captureQuestionSnapshot, readQuestionSnapshot } from "@/features/questions/server/question-snapshots";
import { gradeShortResponse } from "@/features/questions/server/grade-short-response";

const anyArray: unknown = expect.any(Array);
const database = getDatabase();
const prefix = `editorial-fixture-${randomUUID()}`;
const slug = () => `${prefix}-${randomUUID()}`;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
beforeAll(async () => { admin = await createTestAdmin(database); });
afterAll(async () => {
  const questions = await database.question.findMany({ where: { prompt: { startsWith: prefix } }, select: { id: true } });
  for (const question of questions) {
    await database.question.update({ where: question, data: { status: "DRAFT", correctOptionId: null } });
    await database.question.delete({ where: question });
  }
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.work.deleteMany({ where: { slug: { startsWith: prefix } } });
  const topics = await database.topic.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } });
  for (let index = 0; index < topics.length; index++) await database.topic.deleteMany({ where: { id: { in: topics.map((topic) => topic.id) }, children: { none: {} } } });
  await database.author.deleteMany({ where: { slug: { startsWith: prefix } } });
  await admin.cleanup();
});
const content = { version: 1, blocks: [
  { type: "paragraph", content: [{ type: "text", text: "Само тестови данни." }] },
  { type: "example", title: "Тестов пример", content: [{ type: "text", text: "Не е учебно съдържание." }] },
] };
const authorDraft = () => ({ name: "Тестов автор", slug: slug(), context: "Тестов контекст" });
const topicDraft = () => ({ title: "Тестова тема", slug: slug(), subject: "BULGARIAN_LANGUAGE" });
const questionDraft = () => ({ prompt: `${prefix} въпрос`, subject: "BULGARIAN_LANGUAGE", type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE", maximumPoints: 2, explanation: "Тестово обяснение", acceptedAnswers: ["тест"], provenance: { origin: "ORIGINAL", editorName: "Test editor", reviewed: true } });

describe("all editorial services authorize before touching input or persistence", () => {
  const denied = [
    ["create/edit author", saveAuthorDraft], ["create/edit work", saveWorkDraft], ["create/edit topic", saveTopicDraft],
    ["create/edit lesson", saveLessonDraft], ["create/edit question", saveQuestionDraft],
    ["publish/unpublish learning", setLearningPublication], ["publish/unpublish question", setQuestionPublication], ["delete learning", deleteLearningDraft],
  ] as const;
  it.each(denied)("rejects anonymous %s", async (_name, operation) => {
    await expect(operation({ status: "PUBLISHED" }, new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it.each(denied)("rejects cross-origin %s even with a valid session", async (_name, operation) => {
    const headers = new Headers(admin.headers); headers.set("origin", "https://attacker.example");
    await expect(operation({}, headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it("protects preview reads", async () => {
    await expect(readLearningPreview("author", randomUUID(), new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
});

describe("learning drafts, relations, publication and deletion", () => {
  it("saves and edits an author draft, rejects stale saves, duplicate slugs and injected status", async () => {
    const input = authorDraft();
    const saved = await saveAuthorDraft(input, admin.headers);
    expect(saved).toMatchObject({ ...input, status: "DRAFT" });
    expect(await findPublishedAuthorBySlug(saved.slug)).toBeNull();
    expect(await readLearningPreview("author", saved.id, admin.headers)).toMatchObject({ kind: "author", record: { context: input.context } });
    const changed = await saveAuthorDraft({ ...input, id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString(), context: "Нов тестов контекст" }, admin.headers);
    await expect(saveAuthorDraft({ ...input, id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString() }, admin.headers)).rejects.toMatchObject({ code: "conflict" });
    await expect(saveAuthorDraft(input, admin.headers)).rejects.toMatchObject({ code: "conflict", fields: { slug: anyArray } });
    await expect(saveAuthorDraft({ ...authorDraft(), status: "PUBLISHED" }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    await setLearningPublication({ kind: "author", id: saved.id, publish: true }, admin.headers);
    expect(await findPublishedAuthorBySlug(saved.slug)).toMatchObject({ context: changed.context });
    await expect(saveAuthorDraft({ ...input, id: saved.id, expectedUpdatedAt: changed.updatedAt.toISOString() }, admin.headers)).rejects.toMatchObject({ code: "unpublish-required" });
    await setLearningPublication({ kind: "author", id: saved.id, publish: false }, admin.headers);
    expect(await findPublishedAuthorBySlug(saved.slug)).toBeNull();
  });
  it("retains incomplete author drafts and returns field-level publication reasons", async () => {
    const saved = await saveAuthorDraft({ name: "Чернова", slug: slug() }, admin.headers);
    await expect(setLearningPublication({ kind: "author", id: saved.id, publish: true }, admin.headers)).rejects.toMatchObject({ fields: { context: anyArray } });
    expect((await database.author.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe("DRAFT");
  });
  it("persists structured work sections, rejects missing authors and requires published author", async () => {
    const author = await saveAuthorDraft(authorDraft(), admin.headers);
    const input = { title: "Тестово произведение", slug: slug(), authorId: author.id, genre: "Тестов жанр", summary: "Тестово резюме", themes: ["Тестова тема"], characters: [], importantIdeas: ["Тестова идея"], interpretation: "Тестов прочит" };
    const work = await saveWorkDraft(input, admin.headers);
    expect(work).toMatchObject(input);
    await expect(saveWorkDraft({ ...input, slug: slug(), authorId: randomUUID() }, admin.headers)).rejects.toMatchObject({ fields: { authorId: anyArray } });
    await expect(saveWorkDraft({ ...input, slug: slug(), themes: [""] }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    await expect(setLearningPublication({ kind: "work", id: work.id, publish: true }, admin.headers)).rejects.toMatchObject({ fields: { authorId: anyArray } });
    await setLearningPublication({ kind: "author", id: author.id, publish: true }, admin.headers);
    await expect(setLearningPublication({ kind: "work", id: work.id, publish: true }, admin.headers)).resolves.toMatchObject({ status: "PUBLISHED" });
    await expect(deleteLearningDraft({ kind: "work", id: work.id, confirmation: work.slug }, admin.headers)).rejects.toMatchObject({ code: "unpublish-required" });
    await setLearningPublication({ kind: "work", id: work.id, publish: false }, admin.headers);
    await setLearningPublication({ kind: "author", id: author.id, publish: false }, admin.headers);
    await expect(deleteLearningDraft({ kind: "author", id: author.id, confirmation: author.slug }, admin.headers)).rejects.toMatchObject({ code: "linked" });
    await expect(deleteLearningDraft({ kind: "work", id: work.id, confirmation: "wrong" }, admin.headers)).rejects.toMatchObject({ fields: { confirmation: anyArray } });
    await deleteLearningDraft({ kind: "work", id: work.id, confirmation: work.slug }, admin.headers);
    await deleteLearningDraft({ kind: "author", id: author.id, confirmation: author.slug }, admin.headers);
    expect(await database.author.findUnique({ where: { id: author.id } })).toBeNull();
  });
  it("rejects cycles, wrong subject parents and unsafe subject changes while accepting safe reparenting", async () => {
    const root = await saveTopicDraft(topicDraft(), admin.headers);
    const childInput = { ...topicDraft(), parentId: root.id, position: 3 };
    const child = await saveTopicDraft(childInput, admin.headers);
    await expect(saveTopicDraft({ ...topicDraft(), parentId: randomUUID() }, admin.headers)).rejects.toMatchObject({ fields: { parentId: anyArray } });
    await expect(saveTopicDraft({ ...topicDraft(), subject: "LITERATURE", parentId: root.id }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    await expect(saveTopicDraft({ ...topicDraft(), id: root.id, expectedUpdatedAt: root.updatedAt.toISOString(), parentId: child.id }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    await expect(saveTopicDraft({ ...topicDraft(), id: root.id, expectedUpdatedAt: root.updatedAt.toISOString(), subject: "LITERATURE" }, admin.headers)).rejects.toMatchObject({ code: "linked" });
    await expect(deleteLearningDraft({ kind: "topic", id: root.id, confirmation: root.slug }, admin.headers)).rejects.toMatchObject({ code: "linked" });
    const moved = await saveTopicDraft({ ...childInput, id: child.id, expectedUpdatedAt: child.updatedAt.toISOString(), parentId: null }, admin.headers);
    expect(moved).toMatchObject({ parentId: null, position: 3 });
  });
  it("stores safe lesson blocks, enforces topic ancestry and removes published lessons after ancestor unpublish", async () => {
    const topic = await saveTopicDraft(topicDraft(), admin.headers);
    const input = { title: "Тестов урок", slug: slug(), topicId: topic.id, content };
    const lesson = await saveLessonDraft(input, admin.headers);
    expect(lesson.content).toEqual(content);
    expect(await findPublishedLessonBySlug(lesson.slug)).toBeNull();
    await expect(setLearningPublication({ kind: "lesson", id: lesson.id, publish: true }, admin.headers)).rejects.toMatchObject({ fields: { topicId: anyArray } });
    await expect(deleteLearningDraft({ kind: "topic", id: topic.id, confirmation: topic.slug }, admin.headers)).rejects.toMatchObject({ code: "linked" });
    await setLearningPublication({ kind: "topic", id: topic.id, publish: true }, admin.headers);
    await setLearningPublication({ kind: "lesson", id: lesson.id, publish: true }, admin.headers);
    expect(await findPublishedLessonBySlug(lesson.slug)).not.toBeNull();
    await setLearningPublication({ kind: "topic", id: topic.id, publish: false }, admin.headers);
    expect(await findPublishedLessonBySlug(lesson.slug)).toBeNull();
    await setLearningPublication({ kind: "lesson", id: lesson.id, publish: false }, admin.headers);
    await deleteLearningDraft({ kind: "lesson", id: lesson.id, confirmation: lesson.slug }, admin.headers);
    await deleteLearningDraft({ kind: "topic", id: topic.id, confirmation: topic.slug }, admin.headers);
  });
  it("rejects unsafe links, raw HTML blocks, wrong topics and incomplete lesson publication", async () => {
    const topic = await saveTopicDraft(topicDraft(), admin.headers);
    const input = { title: "Тестов урок", slug: slug(), topicId: topic.id };
    for (const badContent of [{ version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] }, { version: 1, blocks: [{ type: "paragraph", content: [{ type: "link", text: "unsafe", href: "javascript:alert(1)" }] }] }]) {
      await expect(saveLessonDraft({ ...input, content: badContent }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    }
    await expect(saveLessonDraft({ ...input, topicId: randomUUID(), content }, admin.headers)).rejects.toMatchObject({ fields: { topicId: anyArray } });
    const empty = await saveLessonDraft({ ...input, content: { version: 1, blocks: [] } }, admin.headers);
    await expect(setLearningPublication({ kind: "lesson", id: empty.id, publish: true }, admin.headers)).rejects.toMatchObject({ fields: { content: anyArray } });
  });
  it("serializes concurrent edits so one writer receives an actionable conflict", async () => {
    const input = authorDraft(); const saved = await saveAuthorDraft(input, admin.headers);
    const result = await Promise.allSettled(["first", "second"].map((context) => saveAuthorDraft({ ...input, id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString(), context }, admin.headers)));
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = result.find((item) => item.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "conflict" });
  });
});

describe("question drafting and availability", () => {
  it("allows incomplete drafts but refuses invalid structure and forged review metadata", async () => {
    const saved = await saveQuestionDraft({ ...questionDraft(), acceptedAnswers: [], explanation: "", provenance: null }, admin.headers);
    expect(saved.status).toBe("DRAFT");
    await expect(setQuestionPublication({ id: saved.id, publish: true }, admin.headers)).rejects.toMatchObject({ code: "invalid" });
    for (const changes of [{ maximumPoints: -1 }, { maximumPoints: 1.234 }, { maximumPoints: 10000 }, { type: "ARGUMENTATIVE_WRITING" }, { provenance: { origin: "ORIGINAL", reviewedBy: "forged" } }]) {
      await expect(saveQuestionDraft({ ...questionDraft(), ...changes }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    }
  });
  it("saves ordered choices, safely changes type, resets review and rolls back invalid edits", async () => {
    const input = { prompt: `${prefix} избор`, subject: "LITERATURE", type: "MULTIPLE_CHOICE", assessmentMode: "OBJECTIVE", maximumPoints: 1, explanation: "", options: [{ text: "А" }, { text: "Б" }], correctOptionIndex: 1 };
    const saved = await saveQuestionDraft(input, admin.headers);
    expect(saved.options.map((option) => option.text)).toEqual(["А", "Б"]);
    expect(saved.correctOptionId).toBe(saved.options[1]?.id);
    await expect(saveQuestionDraft({ ...input, id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString(), correctOptionIndex: 4 }, admin.headers)).rejects.toMatchObject({ fields: { correctOptionIndex: anyArray } });
    const written = await saveQuestionDraft({ id: saved.id, expectedUpdatedAt: saved.updatedAt.toISOString(), prompt: `${prefix} писане`, subject: "LITERATURE", type: "ARGUMENTATIVE_WRITING", assessmentMode: "SELF_REVIEW", referenceGuidance: "Тестови насоки", rubric: [{ id: "idea", description: "Тестова идея" }] }, admin.headers);
    expect(written).toMatchObject({ type: "ARGUMENTATIVE_WRITING", correctOptionId: null, maximumPoints: null, options: [], provenance: null });
    await expect(saveQuestionDraft({ ...questionDraft(), id: written.id, expectedUpdatedAt: written.updatedAt.toISOString(), topicIds: [randomUUID()] }, admin.headers)).rejects.toBeInstanceOf(EditorialError);
    expect((await database.question.findUniqueOrThrow({ where: { id: written.id } })).type).toBe("ARGUMENTATIVE_WRITING");
  });
  it("requires published links, preserves captured grading across unpublish/edit and hides new selections", async () => {
    const topic = await saveTopicDraft(topicDraft(), admin.headers);
    const input = { ...questionDraft(), topicIds: [topic.id] };
    const question = await saveQuestionDraft(input, admin.headers);
    expect(question.provenance).toMatchObject({ reviewedBy: admin.user.id, reviewStatus: "REVIEWED" });
    await expect(setQuestionPublication({ id: question.id, publish: true }, admin.headers)).rejects.toMatchObject({ code: "invalid" });
    await expect(deleteLearningDraft({ kind: "topic", id: topic.id, confirmation: topic.slug }, admin.headers)).rejects.toMatchObject({ code: "linked" });
    await setLearningPublication({ kind: "topic", id: topic.id, publish: true }, admin.headers);
    await setQuestionPublication({ id: question.id, publish: true }, admin.headers);
    expect(await findPublishedPublicQuestion(question.id)).toMatchObject({ id: question.id });
    await withDatabaseFixture(async (transaction) => {
      const snapshot = await captureQuestionSnapshot(question.id, transaction);
      const original = readQuestionSnapshot(snapshot).definition;
      if (original.type !== "short-response" || original.assessment.mode !== "objective") throw new Error("Wrong fixture definition");
      const before = gradeShortResponse(original, { questionId: question.id, type: "short-response", text: "тест" });
      const draft = await setQuestionPublication({ id: question.id, publish: false }, admin.headers);
      expect(await findPublishedPublicQuestion(question.id)).toBeNull();
      await saveQuestionDraft({ ...input, id: question.id, expectedUpdatedAt: draft.updatedAt.toISOString(), maximumPoints: 9, acceptedAnswers: ["променен"], provenance: { origin: "ORIGINAL", editorName: "Test editor" } }, admin.headers);
      const preserved = readQuestionSnapshot(await transaction.questionSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } })).definition;
      if (preserved.type !== "short-response" || preserved.assessment.mode !== "objective") throw new Error("Wrong snapshot definition");
      expect(gradeShortResponse(preserved, { questionId: question.id, type: "short-response", text: "тест" })).toEqual(before);
    });
    expect((await database.questionProvenance.findUniqueOrThrow({ where: { questionId: question.id } })).reviewStatus).toBe("UNREVIEWED");
    await expect(setQuestionPublication({ id: question.id, publish: true }, admin.headers)).rejects.toMatchObject({ fields: { "review-missing": anyArray } });
  });
});
