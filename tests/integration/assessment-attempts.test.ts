import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST as startRoute } from "@/app/api/attempts/route";
import { GET as readRoute, POST as changeRoute } from "@/app/api/attempts/[id]/route";
import { GET as publicExamRoute } from "@/app/api/exams/[id]/route";
import { getDatabase } from "@/server/database";
import { createTestAdmin } from "../fixtures/admin-session";
import { createExamConfiguration } from "@/features/exams/server/configuration";
import { saveExamDraft, setExamPublication } from "@/features/exams/server/editorial";
import { findPublicExam, listPublicExams } from "@/features/exams/server/catalog";
import { startExam, startPractice } from "@/features/attempts/server/start";
import { finishAttempt, readAttempt, saveAttemptAnswer, saveAttemptPosition } from "@/features/attempts/server/session";
import { hasExpired, remainingSeconds } from "@/features/attempts/server/deadline";

const database = getDatabase();
const topicIds: string[] = [];
const questionIds: string[] = [];
const configurationIds: string[] = [];
const examIds: string[] = [];
let admin: Awaited<ReturnType<typeof createTestAdmin>> | undefined;
let topicId: string;
let shortId: string;
let writtenId: string;
let configurationId: string;
let examId: string;
const session = `Fixture ${randomUUID()}`;
afterEach(() => vi.unstubAllEnvs());

function adminHeaders() {
  if (!admin) throw new Error("Test editor is missing");
  return admin.headers;
}

async function createTopic(status: "DRAFT" | "PUBLISHED" = "PUBLISHED", parentId: string | null = null) {
  const topic = await database.topic.create({
    data: { slug: randomUUID(), title: "Тестова тема", subject: "LITERATURE", status, parentId },
  });
  topicIds.push(topic.id);
  return topic.id;
}

function configuration(version: number, durationMinutes = 25) {
  return {
    targetYear: 2091, session, version, verification: "CONDITIONAL",
    blueprint: {
      formatVersion: 1, sources: ["https://example.test/specification.pdf"],
      checkedOn: "2026-11-10", reviewer: "Private fixture reviewer", gaps: ["Test only"],
      passingPoints: null,
      sections: [{ durationMinutes, tasks: [
        { type: "SHORT_RESPONSE", count: 1, points: 2.25 },
        { type: "ARGUMENTATIVE_WRITING", count: 1, points: 8 },
      ] }],
    },
  };
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    title: "Тестова пробна матура", description: "Учебен пример",
    configurationId, questions: [{ questionId: shortId, points: 2.25 }, { questionId: writtenId, points: 8 }],
    ...overrides,
  };
}

async function createExam(overrides: Record<string, unknown> = {}) {
  const exam = await saveExamDraft(draft(overrides), adminHeaders(), database);
  examIds.push(exam.id);
  return exam;
}

function short(text = "Вазов", expectedRevision = 0) {
  return { answer: { questionId: shortId, type: "short-response", text }, expectedRevision };
}

function written(text = "Това е моят отговор.") {
  return { answer: { questionId: writtenId, type: "argumentative-writing", text }, expectedRevision: 0 };
}

async function expire(id: string) {
  await database.$executeRaw`
    UPDATE "Attempt" SET
      "startedAt" = clock_timestamp() - INTERVAL '25 minutes',
      "deadline" = clock_timestamp() - INTERVAL '1 millisecond'
    WHERE "id" = ${id}::uuid
  `;
}

beforeAll(async () => {
  admin = await createTestAdmin(database);
  topicId = await createTopic();
  const common = {
    status: "PUBLISHED", subject: "LITERATURE",
    provenance: { create: {
      origin: "ORIGINAL", editorName: "Private fixture editor", reviewStatus: "REVIEWED",
      reviewedAt: new Date(), reviewedBy: "fixture", sourceReference: "PRIVATE_FIXTURE_REFERENCE",
    } },
  } as const;
  const shortQuestion = await database.question.create({ data: {
    ...common, type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE", prompt: "Кой е авторът?",
    maximumPoints: 1.5, explanation: "PRIVATE_FIXTURE_EXPLANATION", acceptedAnswers: ["Вазов"], createdAt: new Date(0),
  } });
  shortId = shortQuestion.id;
  questionIds.push(shortId);
  const essayQuestion = await database.question.create({ data: {
    ...common, type: "ARGUMENTATIVE_WRITING", assessmentMode: "SELF_REVIEW", prompt: "Напишете аргумент.",
    referenceGuidance: "PRIVATE_FIXTURE_GUIDANCE", createdAt: new Date(1),
  } });
  writtenId = essayQuestion.id;
  questionIds.push(writtenId);
  await database.questionTopic.createMany({ data: questionIds.map((questionId) => ({
    questionId, topicId, subject: "LITERATURE",
  })) });
  const config = await createExamConfiguration(configuration(1), adminHeaders(), database);
  configurationId = config.id;
  configurationIds.push(config.id);
  const exam = await createExam();
  examId = exam.id;
  await setExamPublication({ id: examId, publish: true }, adminHeaders(), database);
});

afterAll(async () => {
  await database.attempt.deleteMany({ where: { OR: [{ examId: { in: examIds } }, { topicId: { in: topicIds } }] } });
  await database.exam.deleteMany({ where: { id: { in: examIds } } });
  await database.examConfiguration.deleteMany({ where: { id: { in: configurationIds } } });
  await database.questionSnapshot.deleteMany({ where: { questionId: { in: questionIds } } });
  await database.question.deleteMany({ where: { id: { in: questionIds } } });
  for (const id of topicIds.toReversed()) await database.topic.delete({ where: { id } });
  await admin?.cleanup();
});

describe("curated exam editorial and public boundaries", () => {
  it("authorizes writes, keeps incomplete drafts private and reports invalid links", async () => {
    await expect(saveExamDraft(draft(), new Headers(), database)).rejects.toThrow();
    await expect(setExamPublication({ id: examId, publish: false }, new Headers(), database)).rejects.toThrow();
    await expect(saveExamDraft(draft({ configurationId: randomUUID() }), adminHeaders(), database))
      .rejects.toMatchObject({ fields: { configurationId: ["Configuration not found."] } });
    await expect(saveExamDraft(draft({ questions: [{ questionId: randomUUID(), points: 1 }] }), adminHeaders(), database))
      .rejects.toMatchObject({ code: "invalid" });
    const incomplete = await createExam({ description: "", questions: [] });
    expect(incomplete.status).toBe("DRAFT");
    expect(await findPublicExam(incomplete.id, database)).toBeNull();
    await expect(setExamPublication({ id: incomplete.id, publish: true }, adminHeaders(), database))
      .rejects.toMatchObject({ code: "invalid", fields: { description: ["Add an exam description."] } });
  });

  it("validates configured slots, rejects unsupported official claims and versions changes", async () => {
    const official = await createExam({ classification: "OFFICIAL", attribution: "Test" });
    await expect(setExamPublication({ id: official.id, publish: true }, adminHeaders(), database))
      .rejects.toMatchObject({ fields: { classification: ["Only a verified configuration can be used for an official past paper."] } });
    const reordered = await saveExamDraft(draft({
      id: official.id, expectedUpdatedAt: official.updatedAt.toISOString(),
      questions: [{ questionId: writtenId, points: 8 }, { questionId: shortId, points: 2.5 }],
    }), adminHeaders(), database);
    expect(reordered.questions.map(({ questionId }) => questionId)).toEqual([writtenId, shortId]);
    await expect(setExamPublication({ id: official.id, publish: true }, adminHeaders(), database))
      .rejects.toMatchObject({ fields: { "questions.0": ["Match the question type and point allocation for this blueprint position."] } });
    const second = await createExamConfiguration(configuration(2, 30), adminHeaders(), database);
    configurationIds.push(second.id);
    await expect(database.examConfiguration.update({ where: { id: configurationId }, data: { version: 3 } })).rejects.toThrow();
    expect(await findPublicExam(examId, database)).toMatchObject({ configurationVersion: 1, durationMinutes: 25, objectiveMaximumPoints: 2.25, writtenCount: 1 });
    await expect(createExamConfiguration(configuration(2), adminHeaders(), database)).rejects.toMatchObject({ code: "conflict" });
  });

  it("returns only public metadata and refuses direct unpublished reads", async () => {
    const listing = await listPublicExams(undefined, database);
    expect(listing.exams.some(({ id }) => id === examId)).toBe(true);
    const examResponse = await publicExamRoute(new Request("http://localhost"), { params: Promise.resolve({ id: examId }) });
    expect(examResponse.status).toBe(200);
    const body = await examResponse.text();
    for (const secret of ["PRIVATE_FIXTURE", "Private fixture", "acceptedAnswers", "passingPoints", "questions"]) {
      expect(body).not.toContain(secret);
    }
    const unpublished = await createExam();
    expect((await publicExamRoute(new Request("http://localhost"), { params: Promise.resolve({ id: unpublished.id }) })).status).toBe(404);
  });
});

describe("owned practice", () => {
  it("rejects unpublished ancestry and reports an empty topic without creating an attempt", async () => {
    const hiddenParent = await createTopic("DRAFT");
    const hiddenChild = await createTopic("PUBLISHED", hiddenParent);
    await expect(startPractice({ topicId: hiddenChild }, database)).rejects.toMatchObject({ code: "not-found" });
    const empty = await createTopic();
    await expect(startPractice({ topicId: empty }, database)).rejects.toMatchObject({ code: "no-questions" });
    expect(await database.attempt.count({ where: { topicId: { in: [empty, hiddenChild] } } })).toBe(0);
  });

  it("binds ownership, validates answers, restores position and finishes with honest persisted scores", async () => {
    const first = await startPractice({ topicId }, database);
    const second = await startPractice({ topicId }, database);
    await expect(readAttempt({ id: first.id }, database)).rejects.toMatchObject({ code: "not-found" });
    await expect(saveAttemptAnswer({ id: first.id, token: second.token }, short(), database)).rejects.toMatchObject({ code: "not-found" });
    const active = await readAttempt(first, database);
    expect(active.questions.map(({ question }) => question.id)).toEqual([shortId, writtenId]);
    expect(JSON.stringify(active)).not.toContain("PRIVATE_FIXTURE");
    await expect(saveAttemptAnswer(first, { ...short(), answer: { ...short().answer, questionId: randomUUID() } }, database)).rejects.toMatchObject({ code: "invalid" });
    await expect(saveAttemptAnswer(first, short(" "), database)).rejects.toMatchObject({ code: "invalid" });
    const saved = await saveAttemptAnswer(first, short(), database);
    expect(saved).toMatchObject({ revision: 1, correct: true, evaluation: { earnedPoints: 1.5 }, feedback: { explanation: "PRIVATE_FIXTURE_EXPLANATION" } });
    expect(await saveAttemptAnswer(first, short(), database)).toEqual(saved);
    await expect(saveAttemptAnswer(first, short("друго", 1), database)).rejects.toMatchObject({ code: "conflict" });
    await saveAttemptAnswer(first, written(), database);
    await saveAttemptPosition(first, { position: 1, expectedPosition: 0 }, database);
    expect(await readAttempt(first, database)).toMatchObject({ position: 1, questions: [saved, { answer: written().answer }] });
    const complete = await finishAttempt(first, database);
    expect(complete).toMatchObject({ state: "SUBMITTED", result: {
      answered: 2, correct: 1, incorrect: 0, selfReview: 1, earnedPoints: 1.5, objectiveMaximumPoints: 1.5,
    } });
    expect((await finishAttempt(first, database)).result).toEqual(complete.result);
  });

  it("expires credentials independently of the attempt state", async () => {
    const attempt = await startPractice({ topicId }, database);
    await database.$executeRaw`
      UPDATE "Attempt" SET "startedAt" = clock_timestamp() - INTERVAL '2 days',
        "accessUntil" = clock_timestamp() - INTERVAL '1 day' WHERE "id" = ${attempt.id}::uuid
    `;
    await expect(readAttempt(attempt, database)).rejects.toMatchObject({ code: "not-found" });
    await expect(finishAttempt(attempt, database)).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("timed exam submission", () => {
  it("uses server deadlines, saves revisions without feedback and survives unpublication", async () => {
    const attempt = await startExam({ examId }, database);
    const again = await startExam({ examId }, database);
    expect(again.id).not.toBe(attempt.id);
    const active = await readAttempt(attempt, database);
    expect((active.deadline?.getTime() ?? 0) - active.startedAt.getTime()).toBe(25 * 60_000);
    expect(active.configuration?.version).toBe(1);
    const saved = await saveAttemptAnswer(attempt, short("друго"), database);
    expect(saved).not.toHaveProperty("evaluation");
    expect(saved).not.toHaveProperty("feedback");
    await expect(saveAttemptAnswer(attempt, short(), database)).rejects.toMatchObject({ code: "conflict" });
    await expect(saveAttemptAnswer(attempt, { ...short("Вазов", 1), deadline: "2099-01-01" }, database)).rejects.toMatchObject({ code: "invalid" });
    await saveAttemptAnswer(attempt, short("Вазов", 1), database);
    await setExamPublication({ id: examId, publish: false }, adminHeaders(), database);
    try {
      expect(await findPublicExam(examId, database)).toBeNull();
      await expect(startExam({ examId }, database)).rejects.toMatchObject({ code: "not-found" });
      expect(await readAttempt(attempt, database)).toMatchObject({ state: "ACTIVE", result: null });
      const results = await Promise.all([finishAttempt(attempt, database), finishAttempt(attempt, database)]);
      for (const result of results) expect(result).toMatchObject({ state: "SUBMITTED", result: { answered: 1, unanswered: 1, earnedPoints: 2.25, objectiveMaximumPoints: 2.25 } });
      expect(results[0]?.completedAt).toEqual(results[1]?.completedAt);
    } finally {
      await setExamPublication({ id: examId, publish: true }, adminHeaders(), database);
    }
  });

  it("rejects a late save and finalizes once using only the previous saved draft", async () => {
    const attempt = await startExam({ examId }, database);
    await saveAttemptAnswer(attempt, short(), database);
    await expire(attempt.id);
    await expect(saveAttemptAnswer(attempt, short("закъснял отговор", 1), database)).rejects.toMatchObject({ code: "closed" });
    const [resumed, submitted] = await Promise.all([readAttempt(attempt, database), finishAttempt(attempt, database)]);
    expect(resumed).toMatchObject({ state: "EXPIRED", remainingSeconds: 0, result: { answered: 1, earnedPoints: 2.25 } });
    expect(resumed.questions[0]?.answer).toEqual(short().answer);
    expect(resumed.result).toEqual(submitted.result);
    expect(resumed.completedAt).toEqual(resumed.deadline);
    const boundary = new Date(1000);
    expect(hasExpired(boundary, new Date(999))).toBe(false);
    expect(hasExpired(boundary, boundary)).toBe(true);
    expect(remainingSeconds(boundary, new Date(999))).toBe(1);
    expect(remainingSeconds(boundary, new Date(1001))).toBe(0);
  });

  it("rolls back finalization if a captured answer cannot be evaluated", async () => {
    const attempt = await startExam({ examId }, database);
    await saveAttemptAnswer(attempt, short(), database);
    await saveAttemptAnswer(attempt, written(), database);
    await database.attemptQuestion.update({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: writtenId } },
      data: { answer: { corrupt: true } },
    });
    await expect(finishAttempt(attempt, database)).rejects.toThrow();
    const record = await database.attempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { questions: true } });
    expect(record.state).toBe("ACTIVE");
    expect(record.result).toBeNull();
    expect(record.questions.every(({ evaluation }) => evaluation === null)).toBe(true);
  });

  it("samples time after obtaining the lock when a save and submit wait across the cutoff", async () => {
    const attempt = await startExam({ examId }, database);
    await saveAttemptAnswer(attempt, short(), database);
    const pending = await database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${attempt.id}::uuid FOR UPDATE`;
      const requests = Promise.allSettled([saveAttemptAnswer(attempt, written(), database), finishAttempt(attempt, database)]);
      await transaction.$executeRaw`
        UPDATE "Attempt" SET
          "startedAt" = clock_timestamp() - INTERVAL '25 minutes',
          "deadline" = clock_timestamp() - INTERVAL '1 millisecond'
        WHERE "id" = ${attempt.id}::uuid
      `;
      return { requests };
    });
    const [save, submit] = await pending.requests;
    expect(save).toMatchObject({ status: "rejected", reason: { code: "closed" } });
    expect(submit).toMatchObject({ status: "fulfilled", value: { state: "EXPIRED", result: { answered: 1, unanswered: 1 } } });
  });
});

it("enforces cookie ownership and same-origin writes at the actual Next.js handlers", async () => {
  const origin = "https://bgmatura.example.test";
  vi.stubEnv("SITE_URL", origin);
  const headers = { origin, "content-type": "application/json" };
  const body = JSON.stringify({ mode: "practice", topicId });
  expect((await startRoute(new NextRequest(`${origin}/api/attempts`, { method: "POST", headers: { ...headers, origin: "https://example.test" }, body }))).status).toBe(403);
  const started = await startRoute(new NextRequest(`${origin}/api/attempts`, { method: "POST", headers, body }));
  expect(started.status).toBe(201);
  const { id } = z.strictObject({ id: z.uuid() }).parse(await started.json());
  const cookie = started.headers.get("set-cookie") ?? "";
  expect(cookie).toMatch(/^__Secure-bgm_attempt=/);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("; Secure");
  expect(cookie).toContain("SameSite=lax");
  expect(cookie).toContain(`Path=/api/attempts/${id}`);
  const endpoint = `${origin}/api/attempts/${id}`;
  const context = { params: Promise.resolve({ id }) };
  const denied = await readRoute(new NextRequest(endpoint), context);
  expect(denied.status).toBe(404);
  expect(denied.headers.get("cache-control")).toContain("no-store");
  const owner = { ...headers, cookie: cookie.split(";")[0] ?? "" };
  expect((await readRoute(new NextRequest(endpoint, { headers: owner }), context)).status).toBe(200);
  const response = await changeRoute(new NextRequest(endpoint, {
    method: "POST", headers: owner, body: JSON.stringify({ operation: "save", ...short() }),
  }), context);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("PRIVATE_FIXTURE_EXPLANATION");
});
