import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestDatabaseUrl } from "../../scripts/database-target";
import { PrismaClient } from "../../src/generated/prisma/client";
import { createTestStudent } from "../fixtures/admin-session";

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertTestDatabaseUrl(process.env.DATABASE_URL ?? "") }) });

/**
 * On a phone the account controls sit inside the menu, which is closed until the button is pressed. The press is
 * repeated until the menu is open, because a press before the page has hydrated does nothing.
 */
async function openMenuIfCollapsed(page: Page) {
  const menu = page.getByRole("button", { name: "Меню" });
  if (!(await menu.isVisible())) return;
  await expect(async () => {
    if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test.afterAll(async () => { await database.$disconnect(); });

test("the sign-in page explains the account honestly and offers Google, and registration leads to it", async ({ page }) => {
  await page.goto("/vhod");
  await expect(page.getByRole("heading", { name: "Вход и регистрация", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вход или регистрация с Google" })).toBeVisible();
  await expect(page.getByText("Не ти трябва профил, за да учиш")).toBeVisible();

  await page.goto("/registraciya?next=/uchi");
  await expect(page).toHaveURL(/\/vhod\?next=%2Fuchi$/);
});

test("a header link leads anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/");
  await openMenuIfCollapsed(page);
  await expect(page.getByRole("link", { name: "Вход", exact: true }).first()).toBeVisible();
});

test("a signed-in student sees their name and can sign out from the header", async ({ page, context }, info) => {
  const student = await createTestStudent(database, `student-${info.project.name}-${randomUUID()}@example.test`);

  try {
    await context.addCookies(student.cookies);
    await page.goto("/vhod?next=https://evil.example");
    await expect(page.getByText("Вече си влязъл")).toBeVisible();
    // An outside address in `next` is ignored, so the way on leads home.
    await expect(page.getByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/");

    await page.goto("/");
    await openMenuIfCollapsed(page);
    const signOut = page.getByRole("button", { name: "Изход" }).first();
    await expect(signOut).toBeVisible();
    await expect(page.getByRole("link", { name: "Администрация" })).toHaveCount(0);

    await signOut.click();
    // Signing out reloads the page, which closes the phone menu, so the menu is opened again on the new page.
    await expect(async () => {
      await openMenuIfCollapsed(page);
      await expect(page.getByRole("link", { name: "Вход", exact: true }).first()).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  } finally {
    await student.cleanup();
  }
});

test("the privacy notice is linked from the footer and the sign-in page", async ({ page }) => {
  await page.goto("/vhod");
  await expect(page.getByRole("link", { name: "известието за поверителност" })).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Поверителност" }).click();
  await expect(page).toHaveURL(/\/poveritelnost$/);
  await expect(page.getByRole("heading", { name: "Поверителност", level: 1 })).toBeVisible();
  await expect(page.getByText("Профил могат да правят ученици на 14 или повече години")).toBeVisible();
});

test("the profile page needs sign-in, and a student can delete the profile after confirming", async ({ page, context }, info) => {
  await page.goto("/profil");
  await expect(page).toHaveURL(/\/vhod\?next=\/profil$/);

  const student = await createTestStudent(database, `student-${info.project.name}-${randomUUID()}@example.test`);
  try {
    await context.addCookies(student.cookies);
    await page.goto("/profil");
    await expect(page.getByRole("heading", { name: "Моят профил", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Изтрий профила и данните ми" }).click();
    await expect(page.getByText("Сигурен ли си?")).toBeVisible();
    await page.getByRole("button", { name: "Отказ" }).click();
    await expect(page.getByText("Сигурен ли си?")).toHaveCount(0);

    await page.getByRole("button", { name: "Изтрий профила и данните ми" }).click();
    await page.getByRole("button", { name: "Да, изтрий всичко" }).click();
    await expect(page).toHaveURL(/\/\?profil=izbrisan$/);
    expect(await database.user.count({ where: { id: student.user.id } })).toBe(0);

    await page.goto("/profil");
    await expect(page).toHaveURL(/\/vhod\?next=\/profil$/);
  } finally {
    await student.cleanup().catch(() => undefined);
  }
});
