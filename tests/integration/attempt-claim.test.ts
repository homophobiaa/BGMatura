import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as startRoute } from "@/app/api/attempts/route";
import { GET as readRoute, POST as changeRoute } from "@/app/api/attempts/[id]/route";
import { claimAttempt, readAttempt } from "@/features/attempts/server/session";
import { startPractice } from "@/features/attempts/server/start";
import { getDatabase } from "@/server/database";
import { createTestStudent } from "../fixtures/admin-session";

const database = getDatabase();
const origin = "https://bgmatura.example.test";
const students: Awaited<ReturnType<typeof createTestStudent>>[] = [];
let topicId: string;
let questionId: string;

afterEach(() => vi.unstubAllEnvs());

async function student() {
  const created = await createTestStudent(database, `claim-${randomUUID()}@example.test`);
  students.push(created);
  return created;
}

/** The request a browser sends: the attempt's own cookie, plus the sign-in session cookie when signed in. */
function request(id: string, token: string, signedIn?: Awaited<ReturnType<typeof createTestStudent>>) {
  const session = signedIn?.headers.get("cookie");
  return new NextRequest(`${origin}/api/attempts/${id}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie: [`__Secure-bgm_attempt=${token}`, session].filter(Boolean).join("; ") },
    body: JSON.stringify({ operation: "claim" }),
  });
}

beforeAll(async () => {
  topicId = (await database.topic.create({ data: { slug: randomUUID(), title: "Тема за профили", subject: "LITERATURE", status: "PUBLISHED" } })).id;
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
  await database.topic.delete({ where: { id: topicId } });
  for (const created of students) await created.cleanup().catch(() => undefined);
});

describe("linking attempts to student accounts", () => {
  it("leaves an anonymous attempt anonymous and fully usable", async () => {
    const attempt = await startPractice({ topicId }, database);
    expect((await database.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).userId).toBeNull();
    expect((await readAttempt(attempt, database)).id).toBe(attempt.id);
  });

  it("claims an attempt only with its own token, idempotently, and keeps the token working", async () => {
    const owner = await student();
    const attempt = await startPractice({ topicId }, database);

    await expect(claimAttempt({ id: attempt.id }, owner.user.id, database)).rejects.toMatchObject({ code: "not-found" });
    const other = await startPractice({ topicId }, database);
    await expect(claimAttempt({ id: attempt.id, token: other.token }, owner.user.id, database)).rejects.toMatchObject({ code: "not-found" });
    expect((await database.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).userId).toBeNull();

    expect(await claimAttempt(attempt, owner.user.id, database)).toEqual({ id: attempt.id, claimed: true });
    expect(await claimAttempt(attempt, owner.user.id, database)).toEqual({ id: attempt.id, claimed: true });
    expect((await database.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).userId).toBe(owner.user.id);
    expect((await readAttempt(attempt, database)).id).toBe(attempt.id);
  });

  it("does not let a second account on the same browser take or learn about a claimed attempt", async () => {
    const first = await student();
    const second = await student();
    const attempt = await startPractice({ topicId }, database);
    await claimAttempt(attempt, first.user.id, database);

    await expect(claimAttempt(attempt, second.user.id, database)).rejects.toMatchObject({ code: "not-found" });
    expect((await database.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).userId).toBe(first.user.id);
  });

  it("claims through the route only for a signed-in student, and never for a visitor holding only a link", async () => {
    vi.stubEnv("SITE_URL", origin);
    const signedIn = await student();
    const started = await startRoute(new NextRequest(`${origin}/api/attempts`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ mode: "practice", topicId }),
    }));
    const id = ((await started.json()) as { id: string }).id;
    const token = /__Secure-bgm_attempt=([^;]+)/.exec(started.headers.get("set-cookie") ?? "")?.[1] ?? "";
    const context = { params: Promise.resolve({ id }) };

    // Not signed in: refused, and nothing is linked.
    expect((await changeRoute(request(id, token), context)).status).toBe(401);
    // Signed in but without the attempt's cookie: not found, so a link alone gives nothing.
    expect((await changeRoute(request(id, "x".repeat(43), signedIn), context)).status).toBe(404);
    expect((await database.attempt.findUniqueOrThrow({ where: { id } })).userId).toBeNull();

    const claimed = await changeRoute(request(id, token, signedIn), context);
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toEqual({ id, claimed: true });
    expect((await database.attempt.findUniqueOrThrow({ where: { id } })).userId).toBe(signedIn.user.id);
    expect((await readRoute(new NextRequest(`${origin}/api/attempts/${id}`, { headers: { cookie: `__Secure-bgm_attempt=${token}` } }), context)).status).toBe(200);
  });

  it("links an attempt started while signed in, and not one started after signing out", async () => {
    vi.stubEnv("SITE_URL", origin);
    const signedIn = await student();
    const startWith = async (cookie?: string | null) => {
      const response = await startRoute(new NextRequest(`${origin}/api/attempts`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ mode: "practice", topicId }),
      }));
      return ((await response.json()) as { id: string }).id;
    };

    const linked = await startWith(signedIn.headers.get("cookie"));
    const anonymous = await startWith();
    expect((await database.attempt.findUniqueOrThrow({ where: { id: linked } })).userId).toBe(signedIn.user.id);
    expect((await database.attempt.findUniqueOrThrow({ where: { id: anonymous } })).userId).toBeNull();
  });

  it("detaches attempts instead of deleting them when an account is removed", async () => {
    const leaving = await student();
    const attempt = await startPractice({ topicId }, database);
    await claimAttempt(attempt, leaving.user.id, database);
    await leaving.cleanup();
    expect((await database.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).userId).toBeNull();
  });
});
