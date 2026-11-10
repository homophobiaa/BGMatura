import "server-only";
import { getAdminAuth } from "./auth";
import { getAdminEnvironment, roleForEmail, type AuthRole } from "./environment";

export class AdminAuthorizationError extends Error {
  constructor() { super("Admin access is required."); }
}

/** The visitor is not signed in, or their session is missing, expired, or revoked. */
export class SignInRequiredError extends Error {
  constructor() { super("Sign-in is required."); }
}

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AuthRole;
}

/**
 * The signed-in person, administrator or student, or `null`. It always reloads the database session and works the
 * role out again from the current allowlist; it never accepts an identity or role from input or a cached cookie.
 */
export async function getSignedInUser(requestHeaders: Headers): Promise<SignedInUser | null> {
  if (!requestHeaders.get("cookie")) return null;
  const session = await getAdminAuth().api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
  if (!session || !session.user.emailVerified) return null;
  const { id, email, name } = session.user;
  return { id, email, name, role: roleForEmail(email, true) };
}

/** For features that need any signed-in person, such as a student's saved results. Administrators pass too. */
export async function requireSignedInUser(requestHeaders: Headers): Promise<SignedInUser> {
  const user = await getSignedInUser(requestHeaders);
  if (user === null) throw new SignInRequiredError();
  return user;
}

/**
 * Administration is limited to allowlisted editors. A student session, however valid, never passes: the role is
 * derived from the allowlist on every call, so removing an email ends admin access on the next request.
 */
export async function requireAdmin(requestHeaders: Headers) {
  const user = await getSignedInUser(requestHeaders);
  if (user === null || user.role !== "admin") throw new AdminAuthorizationError();
  return { id: user.id, email: user.email, name: user.name };
}

export function requireMutationOrigin(requestHeaders: Headers): void {
  if (requestHeaders.get("origin") !== new URL(getAdminEnvironment().BETTER_AUTH_URL).origin) {
    throw new AdminAuthorizationError();
  }
}
