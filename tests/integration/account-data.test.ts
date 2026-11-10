import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as deleteRoute } from "@/app/api/account/delete/route";
import { GET as meRoute } from "@/app/api/account/me/route";
import { deleteAccountAndData, removeStaleAccountData } from "@/features/account/data-removal";
import { claimAttempt } from "@/features/attempts/server/session";
import { startPractice } from "@/features/attempts/server/start";
import { getDatabase } from "@/server/database";
import { adminTestEnvironment, createTestStudent } from "../fixtures/admin-session";

const database = getDatabase();
const leftovers: Awaited<ReturnType<typeof createTestStudent>>[] = [];
let topicId: string;
let questionId: string;

async function student() {
  const created = await createTestStudent(database, `data-${randomUUID()}@example.test`);
  leftovers.push(created);
  return created;
}

async function attemptFor(userId: string) {
  const attempt = await startPractice({ topicId }, database);
  await claimAttempt(attempt, userId, database);
  return attempt.id;
}

beforeAll(async () => {
  topicId = (await database.topic.create({ data: { slug: randomUUID(), title: "Тема за изтриване", subject: "LITERATURE", status: "PUBLISHED" } })).id;
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
  for (const created of leftovers) await created.cleanup().catch(() => undefined);
});

describe("deleting an account and its data", () => {
  it("removes the account, its sessions and its attempts, and nobody else's", async () => {
    const leaving = await student();
    const staying = await student();
    const mine = await attemptFor(leaving.user.id);
    const theirs = await attemptFor(staying.user.id);
    const anonymous = (await startPractice({ topicId }, database)).id;

    expect(await deleteAccountAndData(leaving.user.id, database)).toEqual({ attempts: 1, accounts: 1 });

    expect(await database.user.count({ where: { id: leaving.user.id } })).toBe(0);
    expect(await database.session.count({ where: { userId: leaving.user.id } })).toBe(0);
    expect(await database.attempt.count({ where: { id: mine } })).toBe(0);
    expect(await database.attemptQuestion.count({ where: { attemptId: mine } })).toBe(0);
    expect(await database.attempt.count({ where: { id: { in: [theirs, anonymous] } } })).toBe(2);
    expect(await database.user.count({ where: { id: staying.user.id } })).toBe(1);
  });

  it("is refused for a visitor, a foreign origin and a missing confirmation, and works once confirmed", async () => {
    const origin = adminTestEnvironment.BETTER_AUTH_URL;
    const signedIn = await student();
    const attempt = await attemptFor(signedIn.user.id);
    const post = (body: unknown, headers: Record<string, string> = {}) => deleteRoute(new Request(`${origin}/api/account/delete`, {
      method: "POST", headers: { "content-type": "application/json", origin, ...headers }, body: JSON.stringify(body),
    }));
    const cookie = { cookie: signedIn.headers.get("cookie") ?? "" };

    expect((await post({ confirm: true })).status).toBe(401);
    expect((await post({ confirm: true }, { ...cookie, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({}, cookie)).status).toBe(400);
    expect((await post({ confirm: "yes" }, cookie)).status).toBe(400);
    expect(await database.user.count({ where: { id: signedIn.user.id } })).toBe(1);

    const done = await post({ confirm: true }, cookie);
    expect(done.status).toBe(200);
    expect(done.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await database.user.count({ where: { id: signedIn.user.id } })).toBe(0);
    expect(await database.attempt.count({ where: { id: attempt } })).toBe(0);

    // The old session cookie no longer identifies anybody.
    const me = await meRoute(new Request(`${origin}/api/account/me`, { headers: cookie }));
    expect(await me.json()).toEqual({ user: null });
  });
});

describe("retention", () => {
  it("removes expired sessions and long-inactive accounts with their attempts, and keeps active ones", async () => {
    const stale = await student();
    const active = await student();
    const newcomer = await student();
    const staleAttempt = await attemptFor(stale.user.id);
    const longAgo = new Date(Date.now() - 30 * 31 * 24 * 60 * 60 * 1000);
    await database.user.update({ where: { id: stale.user.id }, data: { createdAt: longAgo } });
    await database.user.update({ where: { id: active.user.id }, data: { createdAt: longAgo } });
    await database.session.updateMany({ where: { userId: stale.user.id }, data: { updatedAt: longAgo } });
    await database.session.updateMany({ where: { userId: newcomer.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await removeStaleAccountData(database);

    expect(result.inactiveAccounts).toBeGreaterThanOrEqual(1);
    expect(await database.user.count({ where: { id: stale.user.id } })).toBe(0);
    expect(await database.attempt.count({ where: { id: staleAttempt } })).toBe(0);
    expect(await database.user.count({ where: { id: { in: [active.user.id, newcomer.user.id] } } })).toBe(2);
    expect(await database.session.count({ where: { userId: newcomer.user.id } })).toBe(0);
    expect(await database.session.count({ where: { userId: active.user.id } })).toBeGreaterThan(0);
  });
});
