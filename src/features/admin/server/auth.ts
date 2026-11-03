import "server-only";
import { betterAuth, APIError } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDatabase } from "@/server/database";
import { getAdminEnvironment, isApprovedAdmin, type AdminEnvironment } from "./environment";

/** No test plugins, password sign-in, registration form, or account linking. */
export function createAdminAuth(database: PrismaClient, environment: AdminEnvironment) {
  return betterAuth({
    appName: "BG Matura",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(environment.BETTER_AUTH_URL).origin],
    database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
        accessType: "online",
        includeGrantedScopes: false,
        mapProfileToUser(profile) {
          if (!isApprovedAdmin(profile.email, profile.email_verified === true, environment.ADMIN_EMAILS)) {
            throw new APIError("FORBIDDEN", { message: "Admin access is not permitted." });
          }
          return { name: profile.name };
        },
      },
    },
    session: { expiresIn: 12 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true, storeAccountCookie: false },
    user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    advanced: { useSecureCookies: new URL(environment.BETTER_AUTH_URL).protocol === "https:" },
    rateLimit: { enabled: true, window: 60, max: 60 },
    logger: { disabled: true },
    databaseHooks: {
      user: {
        create: { before: (user) => {
          if (!isApprovedAdmin(user.email, user.emailVerified, environment.ADMIN_EMAILS)) {
            throw new APIError("FORBIDDEN", { message: "Admin access is not permitted." });
          }
          return Promise.resolve({ data: { ...user, image: null } });
        } },
      },
      account: { create: { before: (account) => {
        if (account.providerId !== "google") throw new APIError("FORBIDDEN", { message: "Provider is not permitted." });
        return Promise.resolve();
      } } },
    },
  });
}

let auth: ReturnType<typeof createAdminAuth> | undefined;

export function getAdminAuth() {
  auth ??= createAdminAuth(getDatabase(), getAdminEnvironment());
  return auth;
}
