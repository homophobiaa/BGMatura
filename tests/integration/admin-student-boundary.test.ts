import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestAdmin, createTestStudent } from "../fixtures/admin-session";
import { getDatabase } from "@/server/database";
import { GET as readExam } from "@/app/api/admin/exams/[id]/route";
import { POST as examCommand } from "@/app/api/admin/exams/route";
import { GET as readLearning } from "@/app/api/admin/learning/[kind]/[id]/route";
import { POST as learningCommand } from "@/app/api/admin/learning/[kind]/route";
import { POST as questionCommand } from "@/app/api/admin/questions/route";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import { saveAuthorDraft } from "@/features/literature/server/author-drafts";
import { saveQuestionDraft } from "@/features/questions/server/question-drafts";
import { readLearningPreview } from "@/features/learning/server/previews";

const database = getDatabase();
const origin = "http://127.0.0.1:3102";
let student: Awaited<ReturnType<typeof createTestStudent>>;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;

beforeAll(async () => {
  student = await createTestStudent(database, `student-boundary-${randomUUID()}@example.test`);
  admin = await createTestAdmin(database, "admin@example.test");
});
afterAll(async () => {
  await student.cleanup();
  await admin.cleanup();
});

function post(path: string, headers: Headers, body: unknown) {
  return new Request(`${origin}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}
function get(path: string, headers: Headers) {
  return new Request(`${origin}${path}`, { method: "GET", headers });
}

/** Every admin HTTP entry point, each called the way a browser would call it. */
const entryPoints: Array<[string, (headers: Headers) => Promise<Response> | Response]> = [
  ["POST /api/admin/questions", (headers) => questionCommand(post("/api/admin/questions", headers, { operation: "publish", id: randomUUID() }))],
  ["POST /api/admin/exams", (headers) => examCommand(post("/api/admin/exams", headers, { operation: "publish", id: randomUUID() }))],
  ["GET /api/admin/exams/[id]", (headers) => readExam(get("/api/admin/exams/x", headers), { params: Promise.resolve({ id: randomUUID() }) })],
  ["POST /api/admin/learning/author", (headers) => learningCommand(post("/api/admin/learning/author", headers, { operation: "publish", id: randomUUID() }), { params: Promise.resolve({ kind: "author" }) })],
  ["POST /api/admin/learning/lesson", (headers) => learningCommand(post("/api/admin/learning/lesson", headers, { operation: "delete", id: randomUUID(), confirmation: "x" }), { params: Promise.resolve({ kind: "lesson" }) })],
  ["GET /api/admin/learning/[kind]/[id]", (headers) => readLearning(get("/api/admin/learning/author/x", headers), { params: Promise.resolve({ kind: "author", id: randomUUID() }) })],
];

describe("a signed-in student is refused at every administration entry point", () => {
  it.each(entryPoints)("%s refuses a student with a valid session and the right origin", async (_name, call) => {
    const response = await call(student.headers);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it.each(entryPoints)("%s refuses a visitor with no session", async (_name, call) => {
    expect((await call(new Headers({ origin }))).status).toBe(401);
  });

  it.each(entryPoints)("%s lets an administrator past the authorization check", async (_name, call) => {
    expect((await call(admin.headers)).status).not.toBe(401);
  });

  it("refuses a student at the editorial services themselves and stores nothing", async () => {
    const slug = `student-boundary-${randomUUID()}`;
    await expect(saveAuthorDraft({ name: "Не трябва да се запише", slug, context: "Тест" }, student.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(saveQuestionDraft({ prompt: slug }, student.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(readLearningPreview("author", randomUUID(), student.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
    expect(await database.author.count({ where: { slug } })).toBe(0);
    expect(await database.question.count({ where: { prompt: slug } })).toBe(0);
  });
});
