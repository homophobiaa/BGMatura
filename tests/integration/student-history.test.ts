import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as historyRoute } from "@/app/api/account/attempts/route";
import { GET as readRoute } from "@/app/api/attempts/[id]/route";
import { listStudentHistory } from "@/features/attempts/server/history";
import { claimAttempt, finishAttempt, readAttempt, saveAttemptAnswer } from "@/features/attempts/server/session";
import { startPractice } from "@/features/attempts/server/start";
import { getDatabase } from "@/server/database";
import { adminTestEnvironment, createTestStudent } from "../fixtures/admin-session";

const database = getDatabase();
const students: Awaited<ReturnType<typeof createTestStudent>>[] = [];
let topicId: string;
let questionId: string;

afterEach(() => vi.unstubAllEnvs());

async function student() {
  const created = await createTestStudent(database, `history-${randomUUID()}@example.test`);
  students.push(created);
  return created;
}

/** A finished practice attempt, claimed by the student. `minutesAgo` orders the history. */
async function finished(userId: string, minutesAgo: number, answered = true) {
  const attempt = await startPractice({ topicId }, database);
  await claimAttempt(attempt, userId, database);
  if (answered) await saveAttemptAnswer(attempt, { answer: { questionId, type: "short-response", text: "Вазов" }, expectedRevision: 0 }, database);
  await finishAttempt(attempt, database);
  await database.$executeRaw`UPDATE "Attempt" SET "startedAt" = clock_timestamp() - make_interval(mins => ${minutesAgo + 10}), "completedAt" = clock_timestamp() - make_interval(mins => ${minutesAgo}) WHERE "id" = ${attempt.id}::uuid`;
  return attempt;
}

beforeAll(async () => {
  topicId = (await database.topic.create({ data: { slug: randomUUID(), title: "Тема за история", subject: "LITERATURE", status: "PUBLISHED" } })).id;
  questionId = (await database.question.create({ data: {
    status: "PUBLISHED", subject: "LITERATURE", type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE", prompt: "Кой е авторът?",
    maximumPoints: 1, explanation: "PRIVATE_FIXTURE_EXPLANATION", acceptedAnswers: ["Вазов"],
    provenance: { create: { origin: "ORIGINAL", editorName: "Fixture editor", reviewStatus: "REVIEWED", reviewedAt: new Date(), reviewedBy: "fixture", sourceReference: "PRIVATE_FIXTURE_REFERENCE" } },
  } })).id;
  await database.questionTopic.create({ data: { questionId, topicId, subject: "LITERATURE" } });
});

afterAll(async () => {
  await database.attempt.deleteMany({ where: { topicId } });
  await database.questionSnapshot.deleteMany({ where: { questionId } });
  if (questionId) await database.question.delete({ where: { id: questionId } });
  if (topicId) await database.topic.delete({ where: { id: topicId } });
  for (const created of students) await created.cleanup().catch(() => undefined);
});

describe("a student's history", () => {
  it("lists only the student's own finished attempts, newest first, in pages", async () => {
    const owner = await student();
    const other = await student();
    const ids: string[] = [];
    for (let index = 0; index < 12; index++) ids.push((await finished(owner.user.id, 100 - index)).id);
    await finished(other.user.id, 1);
    const unfinished = await startPractice({ topicId }, database);
    await claimAttempt(unfinished, owner.user.id, database);

    const first = await listStudentHistory(owner.user.id, undefined, database);
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();
    expect(first.items.map(({ id }) => id)).toEqual(ids.toReversed().slice(0, 10));
    const second = await listStudentHistory(owner.user.id, first.nextCursor ?? undefined, database);
    expect(second.items.map(({ id }) => id)).toEqual(ids.toReversed().slice(10));
    expect(second.nextCursor).toBeNull();

    const everything = [...first.items, ...second.items];
    expect(new Set(everything.map(({ id }) => id)).size).toBe(12);
    expect(everything.map(({ id }) => id)).not.toContain(unfinished.id);
    expect(first.items[0]).toMatchObject({ mode: "PRACTICE", title: "Тема за история", totalQuestions: 1, answered: 1, selfReview: 0, points: { earned: 1, maximum: 1 } });
    expect((await listStudentHistory(other.user.id, undefined, database)).items).toHaveLength(1);
  });

  it("counts an unanswered graded question as zero of its points, and an unusable cursor starts from the top", async () => {
    const owner = await student();
    await finished(owner.user.id, 5, false);
    const page = await listStudentHistory(owner.user.id, "not-a-cursor", database);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ answered: 0, points: { earned: 0, maximum: 1 } });
  });

  it("opens an attempt through the account from any device, even after the browser token expired, and for nobody else", async () => {
    const owner = await student();
    const other = await student();
    const attempt = await finished(owner.user.id, 3);
    await database.$executeRaw`UPDATE "Attempt" SET "startedAt" = clock_timestamp() - INTERVAL '40 days', "accessUntil" = clock_timestamp() - INTERVAL '10 days' WHERE "id" = ${attempt.id}::uuid`;

    await expect(readAttempt(attempt, database)).rejects.toMatchObject({ code: "not-found" });
    expect((await readAttempt({ id: attempt.id, userId: owner.user.id }, database)).id).toBe(attempt.id);
    await expect(readAttempt({ id: attempt.id, userId: other.user.id }, database)).rejects.toMatchObject({ code: "not-found" });
    await expect(readAttempt({ id: attempt.id }, database)).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("the history routes", () => {
  it("answer only for a signed-in student and never return the email or another student's attempt", async () => {
    vi.stubEnv("SITE_URL", "https://bgmatura.example.test");
    const origin = adminTestEnvironment.BETTER_AUTH_URL;
    const owner = await student();
    const other = await student();
    const attempt = await finished(owner.user.id, 2);
    const cookie = (who: typeof owner) => ({ cookie: who.headers.get("cookie") ?? "" });

    expect((await historyRoute(new Request(`${origin}/api/account/attempts`))).status).toBe(401);
    const mine = await historyRoute(new Request(`${origin}/api/account/attempts`, { headers: cookie(owner) }));
    expect(mine.status).toBe(200);
    const body = JSON.stringify(await mine.json());
    expect(body).toContain(attempt.id);
    expect(body).not.toContain("@example.test");
    expect(JSON.stringify(await (await historyRoute(new Request(`${origin}/api/account/attempts`, { headers: cookie(other) }))).json())).not.toContain(attempt.id);

    const context = { params: Promise.resolve({ id: attempt.id }) };
    const attemptUrl = `https://bgmatura.example.test/api/attempts/${attempt.id}`;
    expect((await readRoute(new NextRequest(attemptUrl, { headers: cookie(owner) }), context)).status).toBe(200);
    expect((await readRoute(new NextRequest(attemptUrl, { headers: cookie(other) }), context)).status).toBe(404);
    expect((await readRoute(new NextRequest(attemptUrl), context)).status).toBe(404);
  });
});
