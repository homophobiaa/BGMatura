import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { testUtils } from "better-auth/plugins";
import type { PrismaClient } from "../../src/generated/prisma/client";

/** Synthetic credentials, restricted to the isolated test runner. Never imported by src/. */
export const adminTestEnvironment = {
  BETTER_AUTH_SECRET: "bgmatura-test-only-signing-secret-not-for-deployment-2026",
  BETTER_AUTH_URL: "http://127.0.0.1:3102",
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-only-not-a-google-credential",
  ADMIN_EMAILS: "admin@example.test,desktop-chromium@example.test,mobile-chromium@example.test,tablet-chromium@example.test",
};

/** Mint real Better Auth database sessions and signed cookies without contacting Google. */
export async function createTestAdmin(database: PrismaClient, email = "admin@example.test", emailVerified = true) {
  const auth = betterAuth({
    baseURL: adminTestEnvironment.BETTER_AUTH_URL, secret: adminTestEnvironment.BETTER_AUTH_SECRET,
    database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
    session: { expiresIn: 12 * 60 * 60, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: false }, logger: { disabled: true },
    plugins: [testUtils()],
  });
  const context = await auth.$context;
  const user = await context.test.saveUser(context.test.createUser({ id: randomUUID(), email, emailVerified, name: "Тестов редактор" }));
  const login = await context.test.login({ userId: user.id });
  login.headers.set("origin", adminTestEnvironment.BETTER_AUTH_URL);
  return { ...login, cleanup: () => database.user.delete({ where: { id: user.id } }) };
}
