import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestAdmin, adminTestEnvironment } from "../fixtures/admin-session";
import { getDatabase } from "@/server/database";
import { createAdminAuth, getAdminAuth } from "@/features/admin/server/auth";
import {
  AdminAuthorizationError, getSignedInUser, requireAdmin, requireMutationOrigin, requireSignedInUser, SignInRequiredError,
} from "@/features/admin/server/authorization";
import { AdminConfigurationError, getAdminEnvironment, isApprovedAdmin } from "@/features/admin/server/environment";

const database = getDatabase();
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function session(email?: string, verified = true) {
  const admin = await createTestAdmin(database, email, verified);
  cleanups.push(admin.cleanup);
  return admin;
}

describe("real database sessions and production admin authorization", () => {
  it("accepts a verified allowlisted editor and rejects a forged cookie", async () => {
    const admin = await session();
    await expect(requireAdmin(admin.headers)).resolves.toEqual({ id: admin.user.id, email: admin.user.email, name: admin.user.name });
    await expect(requireAdmin(new Headers({ cookie: "better-auth.session_token=forged" }))).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(requireAdmin(new Headers())).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it.each([["outsider@example.test", true], ["admin@example.test", false]])("rejects %s verified=%s", async (email, verified) => {
    const admin = await session(email, verified);
    await expect(requireAdmin(admin.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it("rechecks the allowlist on each request and requires the exact mutation origin", async () => {
    const admin = await session();
    expect(() => requireMutationOrigin(admin.headers)).not.toThrow();
    for (const origin of ["https://attacker.example", "null", "http://127.0.0.1:3102.attacker.example"]) {
      expect(() => requireMutationOrigin(new Headers({ origin }))).toThrow(AdminAuthorizationError);
    }
    expect(() => requireMutationOrigin(new Headers())).toThrow(AdminAuthorizationError);
    vi.stubEnv("ADMIN_EMAILS", "replacement@example.test");
    await expect(requireAdmin(admin.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it("rejects expired and revoked sessions", async () => {
    const admin = await session();
    await database.session.update({ where: { id: admin.session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(requireAdmin(admin.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
    const next = await session("desktop-chromium@example.test");
    await database.session.delete({ where: { id: next.session.id } });
    await expect(requireAdmin(next.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it("sign-out deletes the database session, expires the HttpOnly cookie and removes access", async () => {
    const admin = await session();
    const response = await getAdminAuth().handler(new Request(`${adminTestEnvironment.BETTER_AUTH_URL}/api/auth/sign-out`, { method: "POST", headers: admin.headers }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/session_token=.*Max-Age=0/i);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(await database.session.findUnique({ where: { id: admin.session.id } })).toBeNull();
    await expect(requireAdmin(admin.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
  it("offers Google only, validates verified allowlisted profiles before provisioning, and disables password signup", async () => {
    const auth = createAdminAuth(database, getAdminEnvironment());
    const google = auth.options.socialProviders.google;
    const profile = { aud: "test", azp: "test", email: "ADMIN@example.test", email_verified: true, exp: 9999999999, iat: 0, family_name: "Editor", given_name: "Test", iss: "https://accounts.google.com", name: "Test Editor", picture: "https://example.test/photo", sub: "test-google-subject" };
    expect(google.mapProfileToUser(profile)).toEqual({ name: "Test Editor" });
    expect(() => google.mapProfileToUser({ ...profile, email_verified: false })).toThrow();
    // Any verified Google account may sign in as a student; being an administrator is decided separately.
    expect(google.mapProfileToUser({ ...profile, email: "student@example.test" })).toEqual({ name: "Test Editor" });
    const denied = await auth.handler(new Request(`${adminTestEnvironment.BETTER_AUTH_URL}/api/auth/sign-up/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: adminTestEnvironment.BETTER_AUTH_URL }, body: JSON.stringify({ name: "Denied", email: "outsider@example.test", password: "not-a-real-password" }) }));
    expect(denied.ok).toBe(false);
    expect(await database.user.findUnique({ where: { email: "outsider@example.test" } })).toBeNull();
    expect("plugins" in auth.options).toBe(false);
    const secure = createAdminAuth(database, { ...getAdminEnvironment(), BETTER_AUTH_URL: "https://admin.example.test" });
    expect((await secure.$context).authCookies.sessionToken.attributes).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });
  it("provisions verified accounts through the production OAuth adapter hooks and rolls back unverified users and other providers", async () => {
    const context = await getAdminAuth().$context;
    const user = { email: "admin@example.test", name: "Provisioned test editor", emailVerified: true, image: "https://example.test/unnecessary-photo" };
    const account = { providerId: "google", accountId: "fixture-google-account" };
    const provisioned = await context.internalAdapter.createOAuthUser(user, account);
    cleanups.push(() => database.user.delete({ where: { id: provisioned.user.id } }));
    expect(provisioned.user.image).toBeNull();
    const login = await context.internalAdapter.createSession(provisioned.user.id);
    expect(login.userId).toBe(provisioned.user.id);
    // A verified account that is not an administrator is provisioned as a student, still without a profile image.
    const student = await context.internalAdapter.createOAuthUser({ ...user, email: "outsider@example.test" }, { ...account, accountId: "fixture-student-account" });
    cleanups.push(() => database.user.delete({ where: { id: student.user.id } }));
    expect(student.user.image).toBeNull();
    for (const candidate of [{ ...user, email: "unverified-student@example.test", emailVerified: false }, { ...user, email: "desktop-chromium@example.test", emailVerified: false }]) {
      await expect(context.internalAdapter.createOAuthUser(candidate, { ...account, accountId: candidate.email })).rejects.toThrow();
      expect(await database.user.findUnique({ where: { email: candidate.email } })).toBeNull();
    }
    await expect(context.internalAdapter.createOAuthUser({ ...user, email: "mobile-chromium@example.test" }, { providerId: "credential", accountId: "denied-fixture" })).rejects.toThrow();
    expect(await database.user.findUnique({ where: { email: "mobile-chromium@example.test" } })).toBeNull();
  });
});

describe("student and admin roles on one sign-in", () => {
  it("gives an allowlisted account the admin role and any other verified account the student role", async () => {
    const admin = await session();
    const student = await session("student@example.test");
    await expect(getSignedInUser(admin.headers)).resolves.toEqual({ id: admin.user.id, email: admin.user.email, name: admin.user.name, role: "admin" });
    await expect(getSignedInUser(student.headers)).resolves.toEqual({ id: student.user.id, email: student.user.email, name: student.user.name, role: "student" });
  });

  it("returns nobody for no session, a forged cookie, an expired or revoked session, or an unverified email", async () => {
    expect(await getSignedInUser(new Headers())).toBeNull();
    expect(await getSignedInUser(new Headers({ cookie: "better-auth.session_token=forged" }))).toBeNull();
    const expired = await session("student@example.test");
    await database.session.update({ where: { id: expired.session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getSignedInUser(expired.headers)).toBeNull();
    const revoked = await session("revoked-student@example.test");
    await database.session.delete({ where: { id: revoked.session.id } });
    expect(await getSignedInUser(revoked.headers)).toBeNull();
    const unverified = await session("unverified-student@example.test", false);
    expect(await getSignedInUser(unverified.headers)).toBeNull();
  });

  it("works the role out again on every request, so changing the allowlist changes it at once", async () => {
    const admin = await session();
    const student = await session("student@example.test");
    vi.stubEnv("ADMIN_EMAILS", "student@example.test");
    await expect(getSignedInUser(student.headers)).resolves.toMatchObject({ role: "admin" });
    await expect(requireAdmin(student.headers)).resolves.toMatchObject({ email: "student@example.test" });
    await expect(getSignedInUser(admin.headers)).resolves.toMatchObject({ role: "student" });
    await expect(requireAdmin(admin.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
  });

  it("never lets a student into administration, whatever the request claims", async () => {
    const student = await session("student@example.test");
    expect(() => requireMutationOrigin(student.headers)).not.toThrow();
    await expect(requireAdmin(student.headers)).rejects.toBeInstanceOf(AdminAuthorizationError);
    const forged = new Headers(student.headers);
    forged.set("x-role", "admin");
    forged.set("x-admin", "true");
    forged.set("cookie", `${forged.get("cookie") ?? ""}; role=admin; admin=true`);
    await expect(requireAdmin(forged)).rejects.toBeInstanceOf(AdminAuthorizationError);
    expect((await getSignedInUser(forged))?.role).toBe("student");
  });

  it("lets any signed-in person through requireSignedInUser and refuses visitors", async () => {
    const admin = await session();
    const student = await session("student@example.test");
    await expect(requireSignedInUser(admin.headers)).resolves.toMatchObject({ role: "admin" });
    await expect(requireSignedInUser(student.headers)).resolves.toMatchObject({ role: "student" });
    await expect(requireSignedInUser(new Headers())).rejects.toBeInstanceOf(SignInRequiredError);
    await expect(requireSignedInUser(new Headers({ cookie: "better-auth.session_token=forged" }))).rejects.toBeInstanceOf(SignInRequiredError);
  });
});

describe("admin configuration", () => {
  it("normalizes emails and fails safely without displaying submitted secrets", () => {
    expect(getAdminEnvironment({ ...adminTestEnvironment, ADMIN_EMAILS: " Admin@Example.Test " }).ADMIN_EMAILS).toEqual(["admin@example.test"]);
    expect(isApprovedAdmin(" ADMIN@EXAMPLE.TEST ", true, ["admin@example.test"])).toBe(true);
    for (const override of [{ BETTER_AUTH_SECRET: "too-short-sensitive" }, { BETTER_AUTH_URL: "http://remote.example.test" }, { BETTER_AUTH_URL: "https://example.test/path" }, { ADMIN_EMAILS: "bad" }]) {
      expect(() => getAdminEnvironment({ ...adminTestEnvironment, ...override })).toThrow(AdminConfigurationError);
      expect(() => getAdminEnvironment({ ...adminTestEnvironment, ...override })).not.toThrow(/too-short-sensitive/);
    }
  });
});
