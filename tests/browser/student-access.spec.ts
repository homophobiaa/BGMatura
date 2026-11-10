import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { adminTestEnvironment, createTestStudent } from "../fixtures/admin-session";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });

test.afterAll(async () => { await database.$disconnect(); });

test("a signed-in student sees why administration is closed, cannot use it, and can sign out", async ({ page, context }, info) => {
  const student = await createTestStudent(database, `student-${info.project.name}-${randomUUID()}@example.test`);

  try {
    await context.addCookies(student.cookies);

    // Not sent round to the sign-in page: the student is told plainly, and can sign out.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Администрация", exact: true })).toBeVisible();
    await expect(page.getByText("Нямаш достъп до администрацията")).toBeVisible();
    await expect(page.getByText(student.user.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Изход" })).toBeVisible();

    // The same valid session is refused by the API, and sees no editor preview.
    const refused = await context.request.post("/api/admin/questions", {
      headers: { Origin: adminTestEnvironment.BETTER_AUTH_URL },
      data: { operation: "save" },
    });
    expect(refused.status()).toBe(401);
    await page.goto(`/admin/preview/author/${randomUUID()}`);
    await expect(page).toHaveURL(/\/admin\/sign-in/);

    // Signing out ends the session for real.
    await page.goto("/admin");
    await page.getByRole("button", { name: "Изход" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    expect(await database.session.findUnique({ where: { id: student.session.id } })).toBeNull();
  } finally {
    await student.cleanup().catch(() => undefined);
  }
});
