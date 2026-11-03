import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createTestAdmin, adminTestEnvironment } from "../fixtures/admin-session";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });
const prefix = `browser-editorial-${randomUUID()}`;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
const identity = z.object({ record: z.object({ id: z.uuid(), slug: z.string(), updatedAt: z.string() }) });
async function saved(response: APIResponse) {
  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return identity.parse(await response.json()).record;
}
async function mutate(request: APIRequestContext, kind: string, command: unknown) {
  return request.post(`/api/admin/learning/${kind}`, { headers: { Origin: adminTestEnvironment.BETTER_AUTH_URL }, data: command });
}
async function unavailable(response: APIResponse, privateText: string) {
  // Next can begin streaming before notFound(): inspect the denied HTML as well
  // as the status, which is then 200 by the framework's documented contract.
  expect([200, 404]).toContain(response.status());
  const body = await response.text();
  expect(body).toContain("Страницата не е намерена");
  expect(body).toContain("noindex");
  expect(body).not.toContain(privateText);
}
test.beforeAll(async ({}, info) => { admin = await createTestAdmin(database, `${info.project.name}@example.test`); });
test.afterAll(async () => {
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.topic.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.work.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.author.deleteMany({ where: { slug: { startsWith: prefix } } });
  await admin.cleanup();
  await database.$disconnect();
});

test("admin endpoints isolate drafts, preview safely, publish fresh pages and revoke access on sign-out", async ({ page, context }) => {
  const request = context.request;
  for (const kind of ["author", "work", "topic", "lesson"]) {
    for (const operation of ["save", "publish", "unpublish", "delete"]) {
      const response = await mutate(request, kind, { operation, id: randomUUID() });
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  }
  expect((await request.post("/api/admin/questions", { data: { operation: "save" } })).status()).toBe(401);
  await page.goto(`/admin/preview/author/${randomUUID()}`);
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole("button", { name: "Вход с Google" })).toBeVisible();
  await context.addCookies(admin.cookies);
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Изход" })).toBeVisible();
  const attack = '<img src=x onerror="window.__unsafe=true">';
  const authorInput = { name: `Тестов автор ${prefix}`, slug: `${prefix}-author`, context: `Само тестови данни. ${attack}` };
  let author = await saved(await mutate(request, "author", { operation: "save", draft: authorInput }));
  await unavailable(await request.get(`/avtori/${author.slug}`), authorInput.name);
  const previewResponse = await page.goto(`/admin/preview/author/${author.id}`);
  expect(previewResponse?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(/Редакторски преглед · Чернова/)).toBeVisible();
  await expect(page.getByText(authorInput.context, { exact: true })).toBeVisible();
  await expect(page.locator('article img')).toHaveCount(0);
  const stolen = await request.post("/api/admin/learning/author", { headers: { Origin: "https://attacker.example" }, data: { operation: "save", draft: authorInput } });
  expect(stolen.status()).toBe(401);
  await saved(await mutate(request, "author", { operation: "publish", id: author.id }));
  await page.goto(`/avtori/${author.slug}`);
  await expect(page.getByRole("heading", { name: authorInput.name, exact: true })).toBeVisible();
  author = await saved(await mutate(request, "author", { operation: "unpublish", id: author.id }));
  await unavailable(await request.get(`/avtori/${author.slug}`), authorInput.name);
  author = await saved(await mutate(request, "author", { operation: "save", draft: { ...authorInput, id: author.id, expectedUpdatedAt: author.updatedAt, context: "Обновен тестов контекст" } }));
  await saved(await mutate(request, "author", { operation: "publish", id: author.id }));
  await page.goto(`/avtori/${author.slug}`);
  await expect(page.getByText("Обновен тестов контекст", { exact: true })).toBeVisible();

  const work = await saved(await mutate(request, "work", { operation: "save", draft: { title: "Тестово произведение", slug: `${prefix}-work`, authorId: author.id, genre: "Тестов жанр", summary: "Тестово резюме", themes: ["Тестова тема"], importantIdeas: ["Тестова идея"], interpretation: "Тестов прочит" } }));
  await page.goto(`/admin/preview/work/${work.id}`);
  await expect(page.getByRole("heading", { name: "Тестово произведение", exact: true })).toBeVisible();
  await saved(await mutate(request, "work", { operation: "publish", id: work.id }));
  expect((await request.get(`/literatura/${work.slug}`)).status()).toBe(200);
  expect(await (await request.get(`/literatura?q=${prefix}`)).text()).toContain(work.slug);
  await saved(await mutate(request, "work", { operation: "unpublish", id: work.id }));
  await unavailable(await request.get(`/literatura/${work.slug}`), "Тестово резюме");
  expect(await (await request.get(`/literatura?q=${prefix}`)).text()).not.toContain(`href="/literatura/${work.slug}"`);

  const topic = await saved(await mutate(request, "topic", { operation: "save", draft: { title: "Тестова тема", slug: `${prefix}-topic`, subject: "BULGARIAN_LANGUAGE" } }));
  const unsafe = await mutate(request, "lesson", { operation: "save", draft: { title: "Тестов урок", slug: `${prefix}-unsafe`, topicId: topic.id, content: { version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] } } });
  expect(unsafe.status()).toBe(400);
  const lesson = await saved(await mutate(request, "lesson", { operation: "save", draft: { title: "Тестов урок", slug: `${prefix}-lesson`, topicId: topic.id, content: { version: 1, blocks: [
    { type: "paragraph", content: [{ type: "text", text: `Тестово правило. ${attack}` }] },
    { type: "example", title: "Тестов пример", content: [{ type: "text", text: "Само тестови данни." }] },
  ] } } }));
  await page.goto(`/admin/preview/lesson/${lesson.id}`);
  await expect(page.getByRole("heading", { name: "Тестов урок", exact: true })).toBeVisible();
  await expect(page.locator("article img")).toHaveCount(0);
  await saved(await mutate(request, "topic", { operation: "publish", id: topic.id }));
  await saved(await mutate(request, "lesson", { operation: "publish", id: lesson.id }));
  expect((await request.get(`/balgarski-ezik/${lesson.slug}`)).status()).toBe(200);
  await saved(await mutate(request, "topic", { operation: "unpublish", id: topic.id }));
  await unavailable(await request.get(`/balgarski-ezik/${lesson.slug}`), "Тестово правило.");
  const linked = await mutate(request, "topic", { operation: "delete", id: topic.id, confirmation: topic.slug });
  expect(linked.status()).toBe(409);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Изход" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  expect(await database.session.findUnique({ where: { id: admin.session.id } })).toBeNull();
  expect((await mutate(request, "author", { operation: "unpublish", id: author.id })).status()).toBe(401);
  const deniedPreview = await request.get(`/api/admin/learning/author/${author.id}`);
  expect(deniedPreview.status()).toBe(401);
  expect(await deniedPreview.text()).not.toContain(authorInput.context);
});
